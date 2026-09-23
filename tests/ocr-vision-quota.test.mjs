import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import worker, { VisionProviderGuard, reserveVisionProviderSlot } from '../worker/index.mjs';
import {
  HIGHLIGHT_REQUEST_DELAY_MS,
  extractHighlightBatch,
  requestHighlight,
} from '../docs/readinggo/js/ocr-highlight-client.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function guardedEnv() {
  let reservations = 0;
  return {
    env: {
      GEMINI_API_KEY: 'test-key',
      VISION_BASE_URL: 'https://vision.example/v1beta/openai',
      VISION_MODEL: 'gemini-test',
      VISION_PROVIDER_GUARD: {
        getByName(name) {
          assert.equal(name, 'gemini-project');
          return {
            async fetch() {
              reservations += 1;
              return Response.json({ waitMs: 0, intervalMs: 6200 });
            },
          };
        },
      },
    },
    reservationCount: () => reservations,
  };
}

function request() {
  const form = new FormData();
  form.append('document', new Blob(['image'], { type: 'image/jpeg' }), 'page.jpg');
  return new Request('https://readinggo.example/api/extract-highlights', {
    method: 'POST',
    headers: { Origin: 'https://readinggo.example' },
    body: form,
  });
}

function providerJson(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('long Gemini quota windows return a safe 429 with Retry-After', async () => {
  let calls = 0;
  const guard = guardedEnv();
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      error: { message: 'SECRET_PROVIDER_DETAIL. Please retry in 36.545s.' },
    }), { status: 429, headers: { 'content-type': 'application/json' } });
  };

  const response = await worker.fetch(request(), guard.env, {});
  const body = await response.json();

  assert.equal(calls, 1, 'long quota windows must be delegated to the client instead of sleeping inside the Worker');
  assert.equal(guard.reservationCount(), 1, 'every Gemini attempt must reserve the project-wide slot');
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '37');
  assert.deepEqual(body, { error: 'vision rate limited', code: 'vision_rate_limited' });
  assert.doesNotMatch(JSON.stringify(body), /SECRET_PROVIDER_DETAIL/);
});

test('short transient provider failures retry and reserve every attempt', async () => {
  let calls = 0;
  const guard = guardedEnv();
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response('temporary', { status: 500 });
    return providerJson('["밑줄 친 문장"]');
  };

  const response = await worker.fetch(request(), guard.env, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sentences: ['밑줄 친 문장'] });
  assert.equal(calls, 2);
  assert.equal(guard.reservationCount(), 2);
});

test('VisionProviderGuard serializes concurrent reservations on one 6.2 second timeline', async () => {
  const values = new Map();
  let transactionTail = Promise.resolve();
  const storage = {
    transaction(fn) {
      const result = transactionTail.then(() => fn({
        get: async (key) => values.get(key),
        put: async (key, value) => values.set(key, value),
      }));
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  const guard = new VisionProviderGuard({ storage });
  const reserve = () => guard.fetch(new Request('https://guard/reserve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ intervalMs: 6200 }),
  })).then((response) => response.json());

  const reservations = await Promise.all([reserve(), reserve(), reserve()]);
  assert.ok(reservations[0].waitMs < 200, `first reservation unexpectedly waited ${reservations[0].waitMs}ms`);
  assert.ok(reservations[1].waitMs >= 6000, `second reservation only waited ${reservations[1].waitMs}ms`);
  assert.ok(reservations[2].waitMs >= 12200, `third reservation only waited ${reservations[2].waitMs}ms`);
});

test('Worker honors the full provider reservation beyond five minutes', async () => {
  const waits = [];
  const env = {
    VISION_PROVIDER_GUARD: {
      getByName() {
        return { fetch: async () => Response.json({ waitMs: 309998, intervalMs: 6200 }) };
      },
    },
  };
  await reserveVisionProviderSlot(env, async (ms) => waits.push(ms));
  assert.deepEqual(waits, [309998]);
});

test('client retries the same image on 429 and stops after success', async () => {
  const seen = [];
  const waits = [];
  const file = new Blob(['same-image'], { type: 'image/jpeg' });
  const apiFetch = async (_url, options) => {
    const uploaded = options.body.get('document');
    seen.push({ name: uploaded.name, text: await uploaded.text() });
    if (seen.length < 3) return new Response('', { status: 429, headers: { 'retry-after': '1' } });
    return Response.json({ sentences: ['성공'] });
  };

  const response = await requestHighlight(file, 'page.jpg', {
    apiFetch,
    wait: async (ms) => waits.push(ms),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(seen, [
    { name: 'page.jpg', text: 'same-image' },
    { name: 'page.jpg', text: 'same-image' },
    { name: 'page.jpg', text: 'same-image' },
  ]);
  assert.deepEqual(waits, [HIGHLIGHT_REQUEST_DELAY_MS, HIGHLIGHT_REQUEST_DELAY_MS]);
});

test('client exhausts three 429 attempts and returns the final response', async () => {
  let calls = 0;
  const response = await requestHighlight(new Blob(['image']), 'page.jpg', {
    apiFetch: async () => {
      calls += 1;
      return new Response('', { status: 429 });
    },
    wait: async () => {},
  });
  assert.equal(calls, 3);
  assert.equal(response.status, 429);
});

test('batch preserves successful images when later images fail', async () => {
  let call = 0;
  const progress = [];
  const responses = [
    Response.json({ sentences: ['첫 문장', '중복 문장'] }),
    new Error('network'),
    Response.json({ sentences: ['중복 문장', '마지막 문장'] }),
  ];
  const result = await extractHighlightBatch([
    new Blob(['a']), new Blob(['b']), new Blob(['c']),
  ], {
    request: async () => {
      const value = responses[call++];
      if (value instanceof Error) throw value;
      return value;
    },
    wait: async () => {},
    onProgress: (value) => progress.push(value),
  });

  assert.deepEqual(result, { items: ['첫 문장', '중복 문장', '마지막 문장'], failed: 1 });
  assert.deepEqual(progress, [
    { done: 1, total: 3 },
    { done: 2, total: 3 },
    { done: 3, total: 3 },
  ]);
});
