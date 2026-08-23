import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { BookProviderGuard } from '../worker/index.mjs';

for (const configPath of ['wrangler.toml', 'wrangler.dev.toml']) {
  const config = await readFile(new URL(`../${configPath}`, import.meta.url), 'utf8');
  assert.match(config, /name = "BOOK_PROVIDER_GUARD"\s+class_name = "BookProviderGuard"/);
  assert.match(config, /tag = "book-provider-guard-v1"\s+new_sqlite_classes = \["BookProviderGuard"\]/);
}

class AtomicStorage {
  constructor() { this.values = new Map(); this.tail = Promise.resolve(); this.transactions = 0; }
  transaction(fn) {
    this.transactions += 1;
    const run = this.tail.then(() => fn({
      get: async (key) => this.values.get(key),
      put: async (entries) => { for (const [key, value] of Object.entries(entries)) this.values.set(key, value); },
    }));
    this.tail = run.catch(() => {});
    return run;
  }
}

const storage = new AtomicStorage();
const guard = new BookProviderGuard({ storage });
const reserve = () => guard.fetch(new Request('https://guard.test/', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    provider: 'kakao', ip: '203.0.113.7', minuteBucket: 'minute-1', day: '2026-08-23',
    minuteLimit: 2, dailyLimit: 10,
  }),
}));
const concurrent = await Promise.all([reserve(), reserve(), reserve()]);
assert.deepEqual(concurrent.map((response) => response.status), [200, 200, 429]);
assert.equal(storage.values.get('minute:kakao:203.0.113.7').used, 2);
assert.equal(storage.values.get('day:kakao').used, 2, '거부된 요청은 일일 provider budget을 소비하면 안 된다');
assert.equal(storage.transactions, 3, '각 예약은 storage transaction을 사용해야 한다');

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
let upstreamCalls = 0;
let guardCalls = 0;
globalThis.fetch = async (input) => {
  const url = new URL(input);
  if (url.hostname === 'dapi.kakao.com') {
    upstreamCalls += 1;
    return new Response(JSON.stringify({ documents: [{ isbn: '9781234567890', title: '원자적 보호', authors: ['저자'] }] }), {
      headers: { 'content-type': 'application/json' },
    });
  }
  throw new Error(`unexpected upstream: ${url}`);
};
const cacheValues = new Map();
globalThis.caches = { default: {
  async match(request) { const value = cacheValues.get(request.url); return value ? value.clone() : undefined; },
  async put(request, response) { cacheValues.set(request.url, response.clone()); },
} };
const env = {
  ENVIRONMENT: 'production',
  KAKAO_REST_KEY: 'synthetic',
  BOOK_PROVIDER_GUARD: {
    idFromName(name) { assert.equal(name, 'global'); return name; },
    get() { return { async fetch() { guardCalls += 1; return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }); } }; },
  },
};
const ctx = { waitUntil(promise) { return promise; } };
try {
  const first = await worker.fetch(new Request('https://readinggo.example/aladin?query=atomic&max=1', {
    headers: { 'CF-Connecting-IP': '203.0.113.8' },
  }), env, ctx);
  assert.equal(first.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = await worker.fetch(new Request('https://readinggo.example/aladin?max=1&query=atomic', {
    headers: { 'CF-Connecting-IP': '203.0.113.8' },
  }), env, ctx);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('x-readinggo-cache'), 'hit');
  assert.equal(upstreamCalls, 1, '정규화된 동일 검색은 upstream을 다시 호출하면 안 된다');
  assert.equal(guardCalls, 1, 'cache hit은 provider budget을 다시 소비하면 안 된다');

  for (const invalidUrl of [
    'https://readinggo.example/aladin?query=',
    'https://readinggo.example/aladin?isbn=not-an-isbn',
  ]) {
    const invalid = await worker.fetch(new Request(invalidUrl, {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    }), env, ctx);
    assert.equal(invalid.status, 400);
  }
  assert.equal(guardCalls, 1, '잘못된 입력은 provider 일일 예산을 소비하면 안 된다');
  assert.equal(upstreamCalls, 1, '잘못된 입력은 provider를 호출하면 안 된다');

  const blockedEnv = {
    ...env,
    BOOK_PROVIDER_GUARD: {
      idFromName() { return 'global'; },
      get() { return { async fetch() { return new Response(JSON.stringify({ code: 'DAILY_BUDGET_EXCEEDED' }), { status: 429 }); } }; },
    },
  };
  const blocked = await worker.fetch(new Request('https://readinggo.example/aladin?query=blocked', {
    headers: { 'CF-Connecting-IP': '203.0.113.9' },
  }), blockedEnv, ctx);
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { error: 'provider budget exceeded', retryAfter: 60 });
  assert.equal(upstreamCalls, 1, '예약 실패 시 provider를 호출하면 안 된다');

  const unbound = await worker.fetch(new Request('https://readinggo.example/aladin?query=unbound'), {
    ENVIRONMENT: 'production', KAKAO_REST_KEY: 'synthetic',
  }, ctx);
  assert.equal(unbound.status, 503, 'Production에서 원자적 guard binding이 없으면 fail-closed 해야 한다');
  assert.equal(upstreamCalls, 1);
} finally {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
}

console.log('OK: book provider atomic per-IP/daily guard, normalized cache, production fail-closed');
