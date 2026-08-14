import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.mjs';
import { crawlYes24 } from '../collector/lib/yes24.mjs';
import { writeSeedsAsNpc } from '../collector/lib/npc.mjs';

const SB = 'https://seed-trust-test.supabase.co';
const SERVICE_ROLE = 'service-role-test';
const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE };
process.env.SUPABASE_URL = SB;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE;
const originalFetch = globalThis.fetch;

function seedRequest(body) {
  return new Request('https://readinggo.example/api/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ have: 0, ...body }),
  });
}

// Worker boundary: only an exact canonical ISBN/title pair is queued, and DB values win.
{
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, init });
    if (url.pathname === '/rest/v1/books') {
      return Response.json([{ isbn13: '9788937460449', title: '데미안', author: '헤르만 헤세' }]);
    }
    if (url.pathname === '/rest/v1/seed_queue') return new Response(null, { status: 201 });
    throw new Error(`unexpected fetch ${url}`);
  };

  let response = await worker.fetch(seedRequest({ isbn: '9788937460449', title: '존재하지 않는 책' }), env, {});
  assert.deepEqual(await response.json(), { seeds: [], status: 'skipped', reason: 'unverified-book' });
  assert.equal(calls.filter(({ url }) => url.pathname === '/rest/v1/seed_queue').length, 0);

  calls.length = 0;
  response = await worker.fetch(seedRequest({ isbn: '임의 ISBN', title: '데미안' }), env, {});
  assert.equal((await response.json()).status, 'skipped');
  assert.equal(calls.length, 0, 'invalid ISBN must fail before canonical DB lookup');

  calls.length = 0;
  response = await worker.fetch(seedRequest({ isbn: '9788937460449', title: '데미안', author: '공격자 입력' }), env, {});
  assert.equal((await response.json()).status, 'queued');
  const queued = calls.find(({ url }) => url.pathname === '/rest/v1/seed_queue');
  assert.ok(queued, 'canonical book should be queued');
  assert.deepEqual(JSON.parse(queued.init.body), {
    book_key: '9788937460449', title: '데미안', author: '헤르만 헤세', isbn: '9788937460449', priority: 'high',
  });
}

function fakeManaged(productIsbn) {
  let current = '';
  const page = {
    async goto(url) { current = String(url); },
    async waitForSelector() {},
    url() { return current; },
    async $$eval() { return ['/product/goods/123']; },
    async evaluate(_fn, position) {
      if (position !== undefined) return true;
      return `ISBN ${productIsbn}\n책 속으로\n검증할 수 있는 충분히 긴 원문 발췌 문장입니다.\n출판사 리뷰`;
    },
    async waitForTimeout() {},
    async close() {},
  };
  return { warmup: async () => {}, context: { newPage: async () => page } };
}

// Collector boundary: missing/mismatched ISBN never falls back to the first search result.
{
  let result = await crawlYes24(fakeManaged('9788937460449'), {
    title: '데미안', author: '헤르만 헤세', isbn: '',
  });
  assert.equal(result.status, 'unverified-book');
  assert.deepEqual(result.seeds, []);

  result = await crawlYes24(fakeManaged('9788937460777'), {
    title: '데미안', author: '헤르만 헤세', isbn: '9788937460449',
  });
  assert.equal(result.status, 'isbn-mismatch');
  assert.deepEqual(result.seeds, []);

  result = await crawlYes24(fakeManaged('9788937460449'), {
    title: '데미안', author: '헤르만 헤세', isbn: '9788937460449',
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.seeds.length, 1);
  assert.equal(result.seeds[0].sourceUrl, 'https://www.yes24.com/product/goods/123');
}

// Persistence boundary: unverified source data is omitted before any DB access; unknown books are read-only misses.
{
  let calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: new URL(input), init });
    return Response.json([]);
  };

  let result = await writeSeedsAsNpc(
    { title: '데미안', author: '헤르만 헤세', isbn: '9788937460449' },
    [{ text: '모델이 지어낸 문장', sourceName: 'AI', sourceUrl: '' }],
  );
  assert.equal(result.written, 0);
  assert.equal(calls.length, 0, 'unverified quote must not reach Supabase');

  result = await writeSeedsAsNpc(
    { title: '존재하지 않는 책', author: '', isbn: '9781234567897' },
    [{ text: '출처 표시는 있지만 canonical 책이 없다', sourceName: '예스24 책속으로', sourceUrl: 'https://www.yes24.com/product/goods/999' }],
  );
  assert.equal(result.written, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/rest/v1/books');
  assert.equal(calls[0].init.method, undefined, 'canonical lookup must be read-only');

  calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, init });
    if (url.pathname === '/rest/v1/books') {
      return Response.json([{ id: 'canonical-book-id', isbn13: '9788937460449', title: '데미안', author: '헤르만 헤세' }]);
    }
    if (url.pathname === '/rest/v1/sentences' && !init.method) return Response.json([]);
    if (url.pathname === '/rest/v1/users') return Response.json([{ id: 'npc-1' }]);
    if (url.pathname === '/rest/v1/user_books') return Response.json([{ id: 'npc-user-book-1' }]);
    if (url.pathname === '/rest/v1/sentences' && init.method === 'POST') return new Response(null, { status: 201 });
    if (url.pathname === '/rest/v1/seed_sentences') return new Response(null, { status: 201 });
    throw new Error(`unexpected persistence fetch ${url}`);
  };
  result = await writeSeedsAsNpc(
    { title: '데미안', author: '헤르만 헤세', isbn: '9788937460449' },
    [{ text: '검증된 책에 연결된 출처 있는 문장', sourceName: '예스24 책속으로', sourceUrl: 'https://www.yes24.com/product/goods/123' }],
  );
  assert.equal(result.written, 1, 'verified canonical seed should retain the legitimate Supabase path');
  assert.equal(calls.some(({ url, init }) => url.pathname === '/rest/v1/books' && init.method), false, 'seed path must never write books');
}

globalThis.fetch = originalFetch;

const dataSource = readFileSync(new URL('../docs/readinggo/js/data.js', import.meta.url), 'utf8');
const datastoreSource = readFileSync(new URL('../docs/readinggo/js/datastore.js', import.meta.url), 'utf8');
assert.doesNotMatch(dataSource, /const\s+NPC_QUOTES\s*=/, 'fabricated static NPC quote corpus must be removed');
assert.doesNotMatch(datastoreSource, /_npcFeedRows|NPC_QUOTES/, 'guest feed must not inject synthetic quotes');

console.log('OK: canonical seed book, exact ISBN excerpt, verified source, and real/synthetic boundaries');
