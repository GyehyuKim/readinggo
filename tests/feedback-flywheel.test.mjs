import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.mjs';

const SB = 'https://feedback-test.supabase.co';
const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'service-test', GITHUB_TOKEN: 'github-test', INQUIRY_RECONCILE_SECRET: 'reconcile-test' };
const originalFetch = globalThis.fetch;
const writes = [];
let actorAdmin = false;
let githubIssue = { state: 'open', state_reason: null, labels: [] };
let reconcileRows = [];

const request = (path, body, headers = {}) => new Request(`https://readinggo.example${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body || {}),
});

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  if (url.origin === SB && url.pathname === '/auth/v1/user') return Response.json({ id: actorAdmin ? 'admin-actor' : 'customer-actor' });
  if (url.origin === SB && url.pathname === '/rest/v1/users') return Response.json([{ id: actorAdmin ? 'admin-actor' : 'customer-actor', is_admin: actorAdmin }]);
  if (url.origin === SB && url.pathname === '/rest/v1/inquiries' && init.method === 'POST') {
    const row = JSON.parse(init.body); writes.push({ type: 'insert', row });
    return Response.json([{ id: 'inquiry-row', message: row.message, submission_kind: row.submission_kind, public_status: row.public_status, created_at: '2026-08-13T00:00:00Z' }]);
  }
  if (url.origin === SB && url.pathname === '/rest/v1/inquiries' && !init.method) {
    if (url.searchParams.get('github_issue_number') === 'is.null') return Response.json([{ id: 'customer-inquiry', created_at: '2026-08-13T00:00:00Z' }]);
    return Response.json(reconcileRows);
  }
  if (url.origin === SB && url.pathname === '/rest/v1/inquiries' && init.method === 'PATCH') {
    writes.push({ type: 'patch', row: JSON.parse(init.body), query: url.search });
    return new Response(null, { status: 204 });
  }
  if (url.hostname === 'api.github.com' && url.pathname.endsWith('/issues') && init.method === 'POST') {
    const row = JSON.parse(init.body); writes.push({ type: 'github-create', row });
    return Response.json({ number: 1408 }, { status: 201 });
  }
  if (url.hostname === 'api.github.com' && /\/issues\/\d+$/.test(url.pathname)) return Response.json(githubIssue);
  throw new Error(`unexpected fetch ${url} ${init.method || 'GET'}`);
};

try {
  let response = await worker.fetch(request('/api/inquiries', { message: 'email@example.com / user 1234' }), env, {});
  assert.equal(response.status, 401, '무인증 제출은 거부');

  response = await worker.fetch(request('/api/inquiries', { message: 'email@example.com / user 1234' }, { Authorization: 'Bearer customer-token' }), env, {});
  assert.equal(response.status, 201);
  assert.equal(writes.at(-1).row.submission_kind, 'customer_feedback', '일반 사용자는 서버가 customer_feedback으로 결정');
  assert.equal('email' in writes.at(-1).row, false, '문의 저장 요청에 이메일 복제 금지');

  actorAdmin = true;
  response = await worker.fetch(request('/api/inquiries', { message: '타인에게 들은 운영 메모' }, { Authorization: 'Bearer admin-token' }), env, {});
  assert.equal(response.status, 201);
  assert.equal(writes.at(-1).row.submission_kind, 'admin_note', 'admin은 서버가 내부 메모로 결정');

  const pending = [];
  await worker.scheduled({ cron: '*/10 * * * *' }, env, { waitUntil(p) { pending.push(p); } });
  await Promise.all(pending);
  const ghCreate = writes.find((entry) => entry.type === 'github-create').row;
  assert.deepEqual(ghCreate.labels, ['source:customer-feedback']);
  assert.equal(JSON.stringify(ghCreate).includes('email@example.com'), false);
  assert.equal(JSON.stringify(ghCreate).includes('customer-actor'), false);
  assert.equal(JSON.stringify(ghCreate).includes('customer-inquiry'), false);
  assert.equal(writes.some((entry) => entry.type === 'patch' && entry.row.public_status === 'checking'), true);

  reconcileRows = [{ id: 'customer-inquiry', github_issue_number: 1408 }];
  const reconcile = () => worker.fetch(request('/api/internal/reconcile-inquiries', {}, { 'X-Reconcile-Secret': 'reconcile-test' }), env, {});
  response = await worker.fetch(request('/api/internal/reconcile-inquiries', {}), env, {});
  assert.equal(response.status, 401, 'reconciliation은 secret 보호');

  const cases = [
    [{ state: 'closed', state_reason: 'completed', labels: [] }, false, '라벨 없는 close'],
    [{ state: 'open', state_reason: null, labels: [{ name: 'feedback:notify-ready' }] }, false, 'reopen/open'],
    [{ state: 'closed', state_reason: 'not_planned', labels: [{ name: 'feedback:notify-ready' }] }, false, 'not-planned'],
    [{ state: 'closed', state_reason: 'completed', labels: [{ name: 'feedback:notify-ready' }] }, true, '완료+notify-ready'],
  ];
  for (const [issue, expected, name] of cases) {
    githubIssue = issue;
    const before = writes.filter((entry) => entry.type === 'patch' && entry.row.response_source).length;
    response = await reconcile();
    assert.equal(response.status, 200);
    const after = writes.filter((entry) => entry.type === 'patch' && entry.row.response_source).length;
    assert.equal(after > before, expected, name);
  }

  const dataStore = readFileSync(new URL('../docs/readinggo/js/datastore-supabase.js', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../docs/readinggo/js/settings-modal.js', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../docs/readinggo/supabase/51_feedback_flywheel.sql', import.meta.url), 'utf8');
  assert.match(dataStore, /inquiries:[\s\S]*create\([\s\S]*\/api\/inquiries[\s\S]*listMine/);
  assert.match(settings, /내 문의 내역/);
  for (const label of ['접수', '확인중', '답변']) assert.match(settings, new RegExp(label));
  assert.match(migration, /default 'legacy'/, '기존 문의를 소급 자동화하지 않고 보존');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('OK: feedback actor 분리, PII 비공개, 상태 조회, notify-ready reconciliation');
