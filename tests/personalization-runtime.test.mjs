import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker/index.mjs';
import { composePersonalizationContext, personalizationContextProxy, personalizedCompanion } from '../worker/personalization.mjs';
import { createPersonalizationLifecycle } from '../docs/readinggo/js/personalization.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const S = '11111111-1111-4111-8111-111111111111';
const BOOK = '22222222-2222-4222-8222-222222222222';
const env = { ENVIRONMENT: 'development', SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'server-secret' };
const request = (body, token = 'token-a', path = '/api/companion/context') => new Request(`https://readinggo.test${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const validBody = { current_sentence_id: S, book_id: BOOK, query_text: '합성 검색 단서', preset: 'balanced' };

function fakeUpstream({ owner = A, enabled = true, generation = 1, rows = [], currentOwned = true } = {}) {
  return async (url, init = {}) => {
    if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: owner }), { status: 200 });
    const name = url.split('/rpc/')[1];
    if (name === 'personalization_context_validate') return Response.json(currentOwned);
    if (name === 'personalization_control_read') return Response.json([{ owner_id: owner, policy_version: '2026-08-25', enabled, consent_generation: generation }]);
    if (name === 'personalization_retrieve') return Response.json(rows);
    if (name === 'personalization_lease_acquire' || name === 'personalization_lease_validate' || name === 'personalization_lease_release') return Response.json(true);
    throw new Error(`unexpected upstream ${url} ${init.method || 'GET'}`);
  };
}

// Auth and owner injection boundary.
let response = await personalizationContextProxy(request(validBody, ''), env, fakeUpstream());
assert.equal(response.status, 401, 'bearer 없는 context는 거부');
for (const injected of [{ ...validBody, user_id: B }, { ...validBody, owner_id: B }, { ...validBody, source_ids: [S] }]) {
  response = await personalizationContextProxy(request(injected), env, fakeUpstream());
  assert.equal(response.status, 400, 'body owner/source injection은 거부');
}
response = await personalizationContextProxy(request(validBody), env, fakeUpstream({ enabled: false }));
assert.equal(response.status, 409, 'OFF control은 retrieval을 거부');
response = await personalizationContextProxy(request(validBody), env, fakeUpstream({ currentOwned: false }));
assert.equal(response.status, 404, '다른 계정 또는 다른 책의 현재 source는 동일한 not found');
response = await personalizationContextProxy(request(validBody), env, fakeUpstream());
assert.equal((await response.json()).owner_id, A, 'owner는 bearer 검증 결과만 사용');

// Production path is absent before #1373, before auth/input handling.
response = await worker.fetch(request({ user_id: B }, '', '/api/companion/context'), { ENVIRONMENT: 'production', ASSETS: { fetch: () => new Response('asset') } }, {});
assert.equal(response.status, 404, 'Production context route fail-closed');
response = await worker.fetch(request({ personalization: true, user_id: B }, '', '/api/companion'), { ENVIRONMENT: 'production', OTA_KV: { get: async () => null, put: async () => {} } }, {});
assert.equal(response.status, 404, 'Production personalized companion fail-closed');

const source = (i, text = `본문 ${i}`) => ({ type: 'sentence', id: String(i), book_id: BOOK, page: i, created_at: '2026-08-25T00:00:00Z', title: `책 ${i}`, author: '합성 저자', status: 'reading', preview: `미리보기 ${i}`, text });
for (const count of [0, 1, 5, 6]) {
  const result = composePersonalizationContext(Array.from({ length: count }, (_, i) => source(i)));
  assert.equal(result.sources.length, Math.min(count, 5), `${count}개 후보는 최대 5개로 정규화`);
  assert.equal(Array.from(result.block).length, result.total_chars, 'Unicode code point로 전체 canonical block 계수');
}
for (const limit of [1999, 2000, 2001]) {
  const result = composePersonalizationContext([source(1, '🙂e\u0301'.repeat(2000))], limit);
  assert.equal(result.total_chars, limit, `${limit} code point 경계에서 label/metadata 포함 정확히 절단`);
}

// Provider lease is acquired before send, validated after provider result, and always released.
const rpcOrder = [];
const leaseFetch = async (url, init = {}) => {
  if (url.endsWith('/auth/v1/user')) return Response.json({ id: A });
  const name = url.split('/rpc/')[1]; rpcOrder.push(name);
  if (name === 'personalization_context_validate') return Response.json(true);
  if (name === 'personalization_control_read') return Response.json([{ owner_id: A, policy_version: '2026-08-25', enabled: true, consent_generation: 1 }]);
  if (name === 'personalization_retrieve') return Response.json([source(1)]);
  return Response.json(true);
};
let providerSends = 0;
response = await personalizedCompanion(request({ ...validBody, personalization: true, sentence: '현재 문장' }, 'token-a', '/api/companion'),
  { ...validBody, personalization: true, sentence: '현재 문장' }, env, async (block, assertLeaseActive) => {
    await assertLeaseActive(); providerSends += 1; return { question: block ? '합성 질문' : '' };
  }, leaseFetch);
assert.equal(response.status, 200);
assert.equal(providerSends, 1);
assert.deepEqual(rpcOrder.slice(-4), ['personalization_lease_acquire', 'personalization_lease_validate', 'personalization_lease_validate', 'personalization_lease_release']);

// Revoke/TTL expiry during preliminary work must stop before the provider callback.
let staleValidations = 0; let staleProviderSends = 0;
const staleLeaseFetch = async (url) => {
  if (url.endsWith('/auth/v1/user')) return Response.json({ id: A });
  const name = url.split('/rpc/')[1];
  if (name === 'personalization_context_validate') return Response.json(true);
  if (name === 'personalization_control_read') return Response.json([{ owner_id: A, policy_version: '2026-08-25', enabled: true, consent_generation: 1 }]);
  if (name === 'personalization_retrieve') return Response.json([source(1)]);
  if (name === 'personalization_lease_acquire' || name === 'personalization_lease_release') return Response.json(true);
  if (name === 'personalization_lease_validate') { staleValidations += 1; return Response.json(false); }
  throw new Error(`unexpected stale lease RPC ${name}`);
};
response = await personalizedCompanion(request({ ...validBody, personalization: true, sentence: '현재 문장' }, 'token-a', '/api/companion'),
  { ...validBody, personalization: true, sentence: '현재 문장' }, env, async (block, assertLeaseActive) => {
    await Promise.resolve();
    await assertLeaseActive();
    staleProviderSends += 1;
    return { question: block };
  }, staleLeaseFetch);
assert.equal(response.status, 409);
assert.equal(staleValidations, 1);
assert.equal(staleProviderSends, 0, 'pre-provider revoke/TTL 검증 실패 뒤 provider send 0');

// Client A→B same-generation barrier: delayed A response cannot touch any sink.
let session = { user: { id: A }, access_token: 'token-a' };
let releaseFetch;
const delayedFetch = new Promise((resolve) => { releaseFetch = resolve; });
const control = (owner = session.user.id) => [{ owner_id: owner, policy_version: '2026-08-25', enabled: true, consent_generation: 1 }];
const lifecycle = createPersonalizationLifecycle({
  auth: async () => session,
  rpc: async (name) => name === 'personalization_control_read' ? control() : true,
  fetcher: async () => delayedFetch,
});
await lifecycle.refreshSession(); await lifecycle.readControl();
const pending = lifecycle.requestQuestion(validBody);
session = { user: { id: B }, access_token: 'token-b' }; lifecycle.setSession(session);
releaseFetch(new Response(JSON.stringify({ owner_id: A, consent_generation: 1, question: 'A private', sources: [source(1)] }), { status: 200 }));
const staleProof = await pending;
const sinks = { display: 0, store: 0, analytics: 0 };
assert.equal(lifecycle.commit(staleProof, { display: () => sinks.display++, store: () => sinks.store++, analytics: () => sinks.analytics++ }), false);
assert.deepEqual(sinks, { display: 0, store: 0, analytics: 0 }, 'A 응답은 B의 동일 gen에서도 모든 sink 0');

// Post-readback delay barrier: pre-read gate passes, then epoch changes while RPC is pending.
session = { user: { id: A }, access_token: 'token-a2' };
let readCalls = 0; let releaseRead;
const delayedRead = new Promise((resolve) => { releaseRead = resolve; });
const lifecycle2 = createPersonalizationLifecycle({
  auth: async () => session,
  rpc: async () => { readCalls += 1; return readCalls === 3 ? delayedRead : control(A); },
  fetcher: async () => new Response(JSON.stringify({ owner_id: A, consent_generation: 1, question: 'delayed A', sources: [source(1)] }), { status: 200 }),
});
await lifecycle2.refreshSession(); await lifecycle2.readControl();
const delayedProofPromise = lifecycle2.requestQuestion(validBody);
await new Promise((resolve) => setTimeout(resolve, 0));
session = { user: { id: B }, access_token: 'token-b2' }; lifecycle2.setSession(session);
releaseRead(control(A));
const delayedProof = await delayedProofPromise;
assert.equal(lifecycle2.commit(delayedProof, { display: () => sinks.display++, store: () => sinks.store++, analytics: () => sinks.analytics++ }), false);
assert.deepEqual(sinks, { display: 0, store: 0, analytics: 0 }, 'readback 지연 중 전환도 모든 sink 0');

let revokePending = true;
let finalizeCalls = 0;
const recovery = createPersonalizationLifecycle({
  auth: async () => ({ user: { id: A }, access_token: 'token-a' }),
  rpc: async (name) => {
    if (name === 'personalization_control_read') return { owner_id: A, enabled: false, consent_generation: 2, policy_version: '2026-08-25', revoke_pending_generation: revokePending ? 2 : null };
    if (name === 'personalization_lease_count') return 0;
    if (name === 'personalization_revoke_finalize') { finalizeCalls += 1; revokePending = false; return { status: 'finalized' }; }
    throw new Error(`unexpected recovery rpc ${name}`);
  },
  fetcher: async () => { throw new Error('provider must not run during revoke recovery'); },
});
await recovery.refreshSession();
const recovered = await recovery.readControl();
assert.equal(finalizeCalls, 1, '앱 재시작 뒤 pending revoke를 정확히 한 번 finalize');
assert.equal(recovered.revoke_pending_generation, null);
assert.equal(recovered.enabled, false);

const sql = readFileSync(new URL('../docs/readinggo/supabase/58_personalization_runtime.dev.sql', import.meta.url), 'utf8');
for (const table of ['personalization_controls', 'personalization_source_exclusions', 'personalization_dispatch_leases']) {
  assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`, 'i'), `${table} 직접 권한 없음`);
}
assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete).*personalization_/i, 'control table direct grants 금지');
for (const fn of ['control_read', 'opt_in', 'revoke_start', 'revoke_finalize', 'source_set_excluded', 'source_exclusions_read', 'context_validate', 'retrieve', 'lease_acquire', 'lease_validate', 'lease_release']) {
  assert.match(sql, new RegExp(`personalization_${fn}`), `${fn} RPC 존재`);
}
assert.match(sql, /personalization_opt_in[\s\S]*?on conflict\s*\(user_id\)\s*do update[\s\S]*?where personalization_controls\.revoke_pending_generation is null[\s\S]*?if not found then raise exception 'revoke_pending'/i,
  'opt-in은 revoke pending row의 conflict lock을 획득한 뒤 원자적으로 거부');
assert.match(sql, /personalization_lease_acquire[\s\S]*?perform 1 from public\.personalization_controls[\s\S]*?for update[\s\S]*?delete from public\.personalization_dispatch_leases[\s\S]*?insert into public\.personalization_dispatch_leases/i,
  'lease acquire는 control→lease lock 순서로 revoke와 직렬화한 뒤 insert');
assert.equal((sql.match(/acquired_at\s*(?:>|<=)\s*now\(\)\s*-\s*interval '2 minutes'/gi) || []).length, 4,
  'finalize/acquire/validate/count는 같은 2분 lease TTL을 적용');
assert.match(sql, /revoke_pending_generation/);
assert.match(sql, /source_type[\s\S]*'sentence'[\s\S]*'qa'[\s\S]*'note'/, '문장·Q\/A·자유 감상을 한 sentence source로 분류');
assert.doesNotMatch(sql, /embedding|profile_summary/i, 'embedding/profile summary 저장소 없음');
assert.match(sql, /personalization_source_exclusions_read[\s\S]*?x\.user_id=auth\.uid\(\)[\s\S]*?grant execute on function public\.personalization_source_exclusions_read\(\) to authenticated/i,
  '제외 목록은 owner-bound RPC로만 read');

const clientSource = readFileSync(new URL('../docs/readinggo/js/personalization.js', import.meta.url), 'utf8');
const companionSource = readFileSync(new URL('../docs/readinggo/js/companion.js', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../docs/readinggo/js/settings-modal.js', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../worker/index.mjs', import.meta.url), 'utf8');
assert.match(workerSource, /if \(p === '\/api\/companion'\)[\s\S]*?request\.clone\(\)\.json\(\)[\s\S]*?candidate\.personalization === true[\s\S]*?return json\(\{ error: 'not found' \}, 404\)[\s\S]*?rateLimited/,
  'Production personalized mode는 rate-limit/Turnstile 전 canonical 404');
assert.match(workerSource, /if \(beforeProviderSend\) await beforeProviderSend\(\)[\s\S]*?callLLM/,
  'personalized provider 호출 직전 lease 검증');
assert.match(clientSource, /window\.RG_apiFetch/, '개인화 provider 호출도 Turnstile 중앙 래퍼 사용');
assert.match(clientSource, /listExcludedSources[\s\S]*?personalization_source_exclusions_read/,
  'client가 owner-bound 제외 목록을 read');
assert.match(settingsSource, /setSourceExcluded\(item\.source_type, item\.source_id, false\)/,
  '설정 surface가 source re-include RPC를 호출');
assert.match(settingsSource, /대화에서 제외한 내 기록/);
assert.match(settingsSource, />다시 포함<\/button>/);
for (const copy of ['참고한 내 기록', '기록으로 이동', '이 기록 제외', '기록 삭제']) assert.match(companionSource, new RegExp(copy));

if (['0', '1'].includes(process.env.EXPECT_PERSONALIZATION_BUILD)) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const assets = path.join(root, '..', 'docs', 'readinggo', 'dist', 'assets');
  const bundle = readdirSync(assets).filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(path.join(assets, name), 'utf8')).join('\n');
  const expected = process.env.EXPECT_PERSONALIZATION_BUILD === '1';
  for (const marker of ['personalization_control_read', 'personalization_revoke_start']) {
    assert.equal(bundle.includes(marker), expected, `${marker} development-only build boundary`);
  }
}

console.log('✓ personalization auth, budget, lease, account/epoch barriers, grants and production gate');
