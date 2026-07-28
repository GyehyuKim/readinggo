import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.mjs';

const SB = 'https://dev-only.supabase.example';
const env = { ENVIRONMENT: 'development', SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'service-role-test' };
const rows = new Map();
let upstreamCalls = 0;

const fakeFetch = async (input, init = {}) => {
  const url = new URL(input);
  assert.equal(url.origin, SB);
  assert.equal(url.pathname, '/rest/v1/dev_review_persona_state');
  upstreamCalls += 1;
  if ((init.method || 'GET') === 'GET') {
    const id = url.searchParams.get('persona_id').replace(/^eq\./, '');
    const instance = url.searchParams.get('instance_id').replace(/^eq\./, '');
    const key = `${instance}:${id}`;
    return Response.json(rows.has(key) ? [{ ...rows.get(key), updated_at: '2026-07-28T00:00:00Z' }] : []);
  }
  if (init.method === 'POST') {
    const [row] = JSON.parse(init.body);
    const key = `${row.instance_id}:${row.persona_id}`;
    if (rows.has(key)) return Response.json({ error: 'duplicate' }, { status: 409 });
    rows.set(key, { state: row.state, revision: row.revision });
    return Response.json([row]);
  }
  assert.equal(init.method, 'PATCH');
  const id = url.searchParams.get('persona_id').replace(/^eq\./, '');
  const instance = url.searchParams.get('instance_id').replace(/^eq\./, '');
  const expected = Number(url.searchParams.get('revision').replace(/^eq\./, ''));
  const key = `${instance}:${id}`;
  const current = rows.get(key);
  if (!current || current.revision !== expected) return Response.json([]);
  const patch = JSON.parse(init.body);
  rows.set(key, { state: patch.state, revision: patch.revision });
  return Response.json([{ instance_id: instance, persona_id: id, ...patch }]);
};
globalThis.fetch = fakeFetch;

const call = (path, options = {}, runtime = env) => {
  const headers = new Headers(options.headers || {});
  if (options.method === 'PUT' && !headers.has('Origin')) headers.set('Origin', 'https://readinggo-dev.example');
  return worker.fetch(new Request(`https://readinggo-dev.example${path}`, { ...options, headers }), runtime, {});
};
const fixture = {
  user_books: [{ id: 'dev-product-explorer-book-b001', book_id: 'b001', status: 'reading', sessions: [], sentences: [] }],
  active_user_book_id: 'dev-product-explorer-book-b001',
  wish_books: ['b010'], streak: { current: 1, longest: 1 }, xp: 10,
  claps: {}, bookmarks: {}, settings: { default_sentence_visibility: 'public' }, pending: {},
};

let response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', {}, { ...env, ENVIRONMENT: 'production' });
assert.equal(response.status, 404, 'production은 DB 확인보다 먼저 경로를 숨겨야 한다');
assert.equal(upstreamCalls, 0);

response = await worker.fetch(new Request('https://worker.example/api/dev-review-personas', {
  method: 'OPTIONS',
  headers: { Origin: 'http://127.0.0.1:4174', 'Access-Control-Request-Method': 'PUT' },
}), env, {});
assert.equal(response.status, 204);
assert.match(response.headers.get('Access-Control-Allow-Methods') || '', /\bPUT\b/, '교차출처 DEV/네이티브 저장 preflight가 PUT을 허용해야 한다');

response = await call('/api/dev-review-personas?id=unknown');
assert.equal(response.status, 400);
response = await call('/api/dev-review-personas?id=product-explorer&instance=predictable');
assert.equal(response.status, 400, '128-bit 브라우저 capability 외 instance는 거부');
response = await worker.fetch(new Request('https://readinggo-dev.example/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: fixture, expectedRevision: null }),
}), env, {});
assert.equal(response.status, 403, 'Origin 없는 직접 PUT은 service-role 저장 경로를 사용할 수 없어야 한다');
response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', { method: 'POST' });
assert.equal(response.status, 405);
response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', { headers: { Origin: 'https://evil.example' } });
assert.equal(response.status, 403);

response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef');
assert.equal(response.status, 404, '미시드 persona는 404');
response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: fixture, expectedRevision: null }),
});
assert.equal(response.status, 200);
assert.deepEqual(rows.get('0123456789abcdef0123456789abcdef:product-explorer'), { state: fixture, revision: 1 });
response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef');
assert.equal(response.status, 200);
const loaded = await response.json();
assert.deepEqual(loaded.state, fixture);
assert.equal(loaded.revision, 1);
const changed = { ...fixture, xp: 11 };
response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: changed, expectedRevision: 1 }),
});
assert.equal(response.status, 200);
assert.equal((await response.json()).revision, 2);
response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: fixture, expectedRevision: 1 }),
});
assert.equal(response.status, 409, 'stale revision 쓰기는 최신 DEV fixture를 덮어쓰면 안 된다');
response = await call('/api/dev-review-personas?id=product-explorer&instance=fedcba9876543210fedcba9876543210');
assert.equal(response.status, 404, '다른 브라우저 instance는 같은 persona 상태를 읽지 못해야 한다');

for (const forbidden of [
  { ...fixture, contact: 'real@example.com' },
  { ...fixture, auth_id: '123e4567-e89b-42d3-a456-426614174000' },
]) {
  const before = upstreamCalls;
  response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: forbidden, expectedRevision: 2 }),
  });
  assert.equal(response.status, 400, '실사용자 식별자 모양은 저장 전에 거부');
  assert.equal(upstreamCalls, before);
}

response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef', {}, { ENVIRONMENT: 'development' });
assert.equal(response.status, 503);
globalThis.fetch = async () => { throw new Error('network down'); };
response = await call('/api/dev-review-personas?id=product-explorer&instance=0123456789abcdef0123456789abcdef');
assert.equal(response.status, 502, 'DEV DB 네트워크 오류는 안정적인 502로 변환');
globalThis.fetch = fakeFetch;
const migration = readFileSync('docs/readinggo/supabase/47_dev_review_persona_state.dev.sql', 'utf8');
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.dev_review_persona_state from anon, authenticated/i);
assert.match(migration, /persona_id in \('product-explorer', 'community-listener', 'steady-builder'\)/i);
assert.match(migration, /primary key \(instance_id, persona_id\)/i);
assert.match(migration, /revision bigint not null default 1/i);
console.log('OK: DEV persona Worker storage boundary, validation, and production 404');
