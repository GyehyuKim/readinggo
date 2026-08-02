import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.mjs';

const clientSource = readFileSync(new URL('../docs/readinggo/js/datastore-supabase.js', import.meta.url), 'utf8');
assert.match(clientSource, /auth\.getSession\(\)/, '클라이언트가 현재 Supabase 세션을 읽어야 한다');
assert.match(clientSource, /Authorization:\s*'Bearer '\s*\+\s*accessToken/, '클라이언트가 access token을 Worker에 전달해야 한다');

const SUPABASE_URL = 'https://readinggo-auth-test.supabase.co';
const env = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
};
const originalFetch = globalThis.fetch;
const upstream = [];

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  upstream.push({ url: url.toString(), init });
  assert.equal(url.origin, SUPABASE_URL);
  if (url.pathname === '/auth/v1/user') {
    assert.equal(init.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
    return init.headers.Authorization === 'Bearer valid-user-token'
      ? Response.json({ id: '11111111-1111-4111-8111-111111111111' })
      : Response.json({ error: 'invalid token' }, { status: 401 });
  }
  if (url.pathname === '/rest/v1/books' && (init.method || 'GET') === 'GET') return Response.json([]);
  if (url.pathname === '/rest/v1/books' && init.method === 'POST') {
    assert.equal(init.headers.Authorization, `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
    return Response.json([{ id: 'book-created', ...JSON.parse(init.body) }]);
  }
  throw new Error(`unexpected upstream request ${url}`);
};

const request = (token, body = { title: '인증 경계 테스트 책' }) => new Request('https://readinggo.example/api/book-upsert', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

try {
  let response = await worker.fetch(request(''), env, {});
  assert.equal(response.status, 401, '무인증 요청은 body 검증과 DB 접근 전에 거부해야 한다');
  assert.equal(upstream.length, 0);

  response = await worker.fetch(request('foreign-project-token'), env, {});
  assert.equal(response.status, 401, '동일 Supabase 프로젝트에서 검증되지 않은 JWT는 거부해야 한다');
  assert.equal(upstream.length, 1);
  assert.match(upstream[0].url, /\/auth\/v1\/user$/);

  response = await worker.fetch(request('valid-user-token', {}), env, {});
  assert.equal(response.status, 400, '인증 후에만 입력 검증으로 진행해야 한다');
  assert.equal(upstream.length, 2);

  response = await worker.fetch(request('valid-user-token'), env, {});
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.id, 'book-created');
  assert.equal(created.title, '인증 경계 테스트 책');
  assert.equal(upstream.filter(({ url }) => url.includes('/auth/v1/user')).length, 3);
  assert.equal(upstream.filter(({ url }) => url.includes('/rest/v1/books')).length, 2);
  console.log('OK: book-upsert는 동일 프로젝트 사용자 JWT 검증 뒤에만 service-role 쓰기를 수행');
} finally {
  globalThis.fetch = originalFetch;
}
