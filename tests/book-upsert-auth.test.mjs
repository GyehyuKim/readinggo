import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import worker from '../worker/index.mjs';

const SB = 'https://readinggo-auth-test.supabase.co';
const env = {
  SUPABASE_URL: SB,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  RATE_LIMITER: {
    blocked: false,
    calls: 0,
    async limit() { this.calls += 1; return { success: !this.blocked }; },
  },
};
const originalFetch = globalThis.fetch;
const upstream = [];

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  upstream.push({ url: url.toString(), init });
  if (url.pathname === '/auth/v1/user') {
    return init.headers.Authorization === 'Bearer valid-user-token'
      ? Response.json({ id: '11111111-1111-4111-8111-111111111111' })
      : Response.json({ error: 'invalid token' }, { status: 401 });
  }
  if (url.pathname === '/rest/v1/books') {
    return Response.json([{ id: 'canonical-book', isbn13: '9781234567897', title: '서버 정본' }]);
  }
  throw new Error(`unexpected upstream request ${url}`);
};

const request = (token, isbn13 = '9781234567897') => new Request('https://readinggo.example/api/book-upsert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ isbn13, title: '공격자가 보낸 제목' }),
});

try {
  let response = await worker.fetch(request(''), env, {});
  assert.equal(response.status, 401);
  assert.equal(upstream.length, 0, '무인증은 GoTrue/DB에 도달하지 않아야 한다');

  response = await worker.fetch(request('foreign-token'), env, {});
  assert.equal(response.status, 401);
  assert.equal(upstream.filter(({ url }) => url.endsWith('/auth/v1/user')).length, 1);
  assert.equal(upstream.filter(({ url }) => url.includes('/rest/v1/books')).length, 0);

  env.RATE_LIMITER.blocked = true;
  response = await worker.fetch(request('foreign-token'), env, {});
  assert.equal(response.status, 429, 'rate-limit은 인증 upstream보다 먼저 종료해야 한다');
  assert.equal(upstream.filter(({ url }) => url.endsWith('/auth/v1/user')).length, 1);
  env.RATE_LIMITER.blocked = false;

  response = await worker.fetch(request('valid-user-token', ''), env, {});
  assert.equal(response.status, 400, '제목-only 전역 카탈로그 삽입을 허용하지 않아야 한다');

  response = await worker.fetch(request('valid-user-token'), env, {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).title, '서버 정본');
  assert.equal(upstream.some(({ init }) => init.body && String(init.body).includes('공격자가 보낸 제목')), false);
} finally {
  globalThis.fetch = originalFetch;
}

const source = readFileSync(new URL('../docs/readinggo/js/datastore-supabase.js', import.meta.url), 'utf8');
let refreshes = 0;
const clientFetches = [];
const auth = {
  async getSession() { return { data: { session: { access_token: 'expired-token', user: { id: 'u1' } } }, error: null }; },
  async refreshSession() { refreshes += 1; return { data: { session: { access_token: 'fresh-token', user: { id: 'u1' } } }, error: null }; },
};
const context = {
  console,
  Date,
  Math,
  setTimeout,
  clearTimeout,
  window: {
    RG_CONFIG: { API_ORIGIN: 'https://api.example' },
    RG_SB: { client: () => ({ auth }), onAuthChange: () => () => {} },
  },
  fetch: async (_url, init) => {
    clientFetches.push(init);
    return clientFetches.length === 1
      ? new Response('{}', { status: 401 })
      : Response.json({ id: 'canonical-book' });
  },
};
context.window.window = context.window;
vm.runInNewContext(source, context);
const result = await context.window.SupabaseDataStore.books.upsert({ isbn13: '9781234567897', title: '클라이언트 제목' });
assert.equal(result.id, 'canonical-book');
assert.equal(refreshes, 1, '401 뒤 세션 갱신은 한 번이어야 한다');
assert.equal(clientFetches.length, 2, '갱신 뒤 요청을 정확히 한 번 재시도해야 한다');
assert.equal(clientFetches[0].headers.Authorization, 'Bearer expired-token');
assert.equal(clientFetches[1].headers.Authorization, 'Bearer fresh-token');
assert.deepEqual(JSON.parse(clientFetches[1].body), { isbn13: '9781234567897' });

console.log('OK: book-upsert 인증·인증 전 rate-limit·서버 정본·세션 갱신 경계');
