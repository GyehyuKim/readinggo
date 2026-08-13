/* Prompt Lab 권한·active/candidate 격리 회귀 테스트 (#1304)
 * 실행: node tests/prompt-lab.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SB = 'https://supabase.example';
const LLM = 'https://llm.example';
const env = {
  ENVIRONMENT: 'development',
  SUPABASE_URL: SB,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  UPSTAGE_API_KEY: 'provider-key-test',
  LLM_BASE_URL: LLM,
  LLM_MODEL: 'solar-test',
  PROMPT_LAB_CACHE_TTL_MS: '0',
};
const active = { id:'00000000-0000-0000-0000-000000000001', version_no:1, status:'active', prompt_body:'ACTIVE PROMPT — ordinary traffic only' };
const candidate = { id:'00000000-0000-0000-0000-000000000002', version_no:2, status:'candidate', prompt_body:'CANDIDATE PROMPT — explicit lab run only' };
const archived = { id:'00000000-0000-0000-0000-000000000003', version_no:0, status:'archived', prompt_body:'ARCHIVED PROMPT — rollback target' };
const fixture = {
  id:'00000000-0000-0000-0000-000000000010', fixture_type:'baseline', title:'합성 fixture',
  input:{ bookTitle:'', author:'', sentence:'합성 문장', comment:'합성 메모', kind:'quote', exchanges:[], userStyle:'합성 독자' },
};
let passed = 0;
function check(name, condition) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed += 1; console.log(`OK   ${name}`);
}
function req(path, body, token) {
  return new Request(`https://readinggo.example${path}`, {
    method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
    body:JSON.stringify(body),
  });
}

const originalFetch = globalThis.fetch;
try {
  // 1) ordinary companion은 active만 조회·전달한다. candidate 조회가 발생하면 즉시 실패.
  const ordinarySystems = [];
  globalThis.fetch = async (url, init = {}) => {
    const s = String(url);
    if (s.includes('/prompt_lab_prompt_versions?status=eq.active')) return Response.json([active]);
    if (s.includes('status=eq.candidate')) throw new Error('ordinary companion이 candidate를 조회함');
    if (s === `${LLM}/chat/completions`) {
      const payload = JSON.parse(init.body);
      ordinarySystems.push(payload.messages[0].content);
      return Response.json({ choices:[{ message:{ content:'active 응답' } }] });
    }
    throw new Error('예상하지 못한 ordinary fetch: ' + s);
  };
  let response = await worker.fetch(req('/api/companion', { sentence:'합성 아님 — 일반 요청' }), env, {});
  let body = await response.json();
  check('일반 companion 요청 성공', response.status === 200 && body.question === 'active 응답');
  check('일반 companion system은 active만 사용', ordinarySystems.length === 1 && ordinarySystems[0] === active.prompt_body && !ordinarySystems[0].includes('CANDIDATE'));

  // 공통 Lab mock: 인증 user와 실제 public.users UUID, active grant를 서버가 해소한다.
  const labSystems = [];
  let failProvider = false;
  let grantRows = [{ role:'editor', target_handle:'융디' }];
  let profileIsAdmin = false;
  let promotionRpcCalls = 0;
  let promotionRpcFailure = false;
  let concurrentPromotion = false;
  globalThis.fetch = async (url, init = {}) => {
    const s = String(url);
    if (s === `${SB}/auth/v1/user`) return Response.json({ id:'11111111-1111-1111-1111-111111111111' });
    if (s.includes('/rest/v1/users?')) return Response.json([{ id:'11111111-1111-1111-1111-111111111111', handle:'융디', is_admin:profileIsAdmin }]);
    if (s.includes('/rest/v1/prompt_lab_grants?')) return Response.json(grantRows);
    if (s.includes('/rest/v1/prompt_lab_fixtures?id=eq.')) return Response.json([fixture]);
    if (s.includes('/rest/v1/prompt_lab_prompt_versions?status=eq.active')) return Response.json([active]);
    if (s.includes('/rest/v1/prompt_lab_prompt_versions?status=eq.candidate')) return Response.json([candidate]);
    if (s === `${SB}/rest/v1/rpc/prompt_lab_promote_atomic` && init.method === 'POST') {
      promotionRpcCalls += 1;
      const row = JSON.parse(init.body);
      if (promotionRpcFailure || (concurrentPromotion && promotionRpcCalls % 2 === 0)) {
        return Response.json({ code:'P0001', message:'prompt_lab_already_active' }, { status:400 });
      }
      const source = row.p_action === 'promote' ? candidate : archived;
      return Response.json({
        id:`00000000-0000-0000-0000-00000000003${promotionRpcCalls}`,
        version_no:2 + promotionRpcCalls, status:'active', prompt_body:source.prompt_body,
        change_reason:row.p_reason, created_by:row.p_actor_id, based_on_version:source.id,
      });
    }
    if (s === `${LLM}/chat/completions`) {
      const payload = JSON.parse(init.body);
      const system = payload.messages[0].content;
      labSystems.push(system);
      if (failProvider) return new Response('provider-secret-debug-trace', { status:500 });
      return Response.json({ choices:[{ message:{ content:system === active.prompt_body ? 'active 비교 결과' : 'candidate 비교 결과' } }] });
    }
    if (s === `${SB}/rest/v1/prompt_lab_runs` && init.method === 'POST') {
      const row = JSON.parse(init.body);
      return Response.json([{ id:'00000000-0000-0000-0000-000000000020', ...row, created_at:'2026-07-19T00:00:00Z' }]);
    }
    if (s === `${SB}/rest/v1/prompt_lab_audit_log` && init.method === 'POST') return new Response(null, { status:204 });
    throw new Error('예상하지 못한 Lab fetch: ' + s);
  };

  grantRows = [];
  response = await worker.fetch(req('/api/prompt-lab', { action:'access' }, 'ordinary-token'), env, {});
  body = await response.json();
  check('active grant 없는 로그인 사용자는 서버에서 거부', response.status === 403 && body.error === 'forbidden');

  grantRows = [{ role:'editor', target_handle:'융디' }];
  response = await worker.fetch(req('/api/prompt-lab', { action:'run', fixtureId:fixture.id }, 'yunji-token'), env, {});
  body = await response.json();
  check('융디 editor는 합성 fixture side-by-side 실행 가능', response.status === 200 && body.run.active_output === 'active 비교 결과' && body.run.candidate_output === 'candidate 비교 결과');
  check('Lab 명시 실행만 active와 candidate를 각각 전달', labSystems.length === 2 && labSystems[0] === active.prompt_body && labSystems[1] === candidate.prompt_body);

  response = await worker.fetch(req('/api/prompt-lab', { action:'promote', versionId:candidate.id, reason:'권한 거부 테스트' }, 'yunji-token'), env, {});
  body = await response.json();
  check('editor는 promote 불가', response.status === 403 && body.error === 'forbidden');

  grantRows = [{ role:'promoter', target_handle:'readinggo_admin' }];
  response = await worker.fetch(req('/api/prompt-lab', { action:'promote', versionId:candidate.id, reason:'admin 해제 회귀' }, 'demoted-admin-token'), env, {});
  body = await response.json();
  check('active promoter grant가 있어도 현재 admin이 아니면 promote 불가', response.status === 403 && body.error === 'forbidden');

  profileIsAdmin = true;
  response = await worker.fetch(req('/api/prompt-lab', { action:'promote', versionId:candidate.id, reason:'검토 완료' }, 'admin-token'), env, {});
  body = await response.json();
  check('admin promoter는 candidate를 active로 승격', response.status === 200 && body.version.status === 'active' && body.version.prompt_body === candidate.prompt_body);
  response = await worker.fetch(req('/api/prompt-lab', { action:'rollback', versionId:archived.id, reason:'회귀 감지' }, 'admin-token'), env, {});
  body = await response.json();
  check('admin promoter는 archived 버전으로 rollback', response.status === 200 && body.version.status === 'active' && body.version.prompt_body === archived.prompt_body);
  check('promote와 rollback은 각각 단일 RPC만 호출', promotionRpcCalls === 2);

  concurrentPromotion = true;
  const concurrentResponses = await Promise.all([
    worker.fetch(req('/api/prompt-lab', { action:'promote', versionId:candidate.id, reason:'동시 요청 A' }, 'admin-token'), env, {}),
    worker.fetch(req('/api/prompt-lab', { action:'promote', versionId:candidate.id, reason:'동시 요청 B' }, 'admin-token'), env, {}),
  ]);
  check('동시 승격 요청은 하나만 성공하고 나머지는 conflict', concurrentResponses.filter((r) => r.status === 200).length === 1
    && concurrentResponses.filter((r) => r.status === 409).length === 1);
  concurrentPromotion = false;

  promotionRpcFailure = true;
  response = await worker.fetch(req('/api/prompt-lab', { action:'promote', versionId:candidate.id, reason:'부분 실패' }, 'admin-token'), env, {});
  body = await response.json();
  check('RPC 부분 실패는 transaction conflict로 반환', response.status === 409 && body.error === 'request conflict');
  check('RPC 실패 뒤 Worker 보상 write나 별도 audit를 시도하지 않음', promotionRpcCalls === 5);

  grantRows = [{ role:'editor', target_handle:'융디' }]; failProvider = true; labSystems.length = 0;
  response = await worker.fetch(req('/api/prompt-lab', { action:'run', fixtureId:fixture.id }, 'yunji-token'), env, {});
  const raw = await response.text();
  check('Lab provider 실패는 일반 오류로 반환', response.status === 502 && /Prompt Lab request failed/.test(raw));
  check('Lab 응답에 provider 내부 정보 비노출', !raw.includes('provider-secret-debug-trace') && !raw.includes('LLM HTTP'));

  // 2) 마이그레이션 정적 계약: 10개 baseline + pending grant + immutable/RLS 경계.
  const sql = readFileSync(join(root, 'docs', 'readinggo', 'supabase', '46_prompt_lab.sql'), 'utf8');
  const sqlStatements = sql.replace(/--[^\n]*/g, '');
  const workerSource = readFileSync(join(root, 'worker', 'index.mjs'), 'utf8');
  const baselineCount = (sql.match(/'baseline-[^']+', 'baseline'/g) || []).length;
  check('immutable baseline 합성 fixture가 10개 이상', baselineCount >= 10);
  check('융디 계정 부재 시 pending grant 유지', /'yunji-editor', '융디', 'editor', 'pending'/.test(sql));
  check('기존 handle 기반 Hyu grant를 제거', /delete from public\.prompt_lab_grants where grant_key = 'hyu-promoter'/.test(sqlStatements));
  check('현재 admin 전체를 UUID 기반 active promoter로 seed', /'admin-promoter:' \|\| u\.id::text/.test(sqlStatements)
    && /from public\.users u\s+where u\.is_admin = true/.test(sqlStatements)
    && /'promoter',\s+'active'/.test(sqlStatements));
  check('admin promoter seed는 멱등이며 일반 사용자를 선택하지 않음', /not exists \([\s\S]*g\.user_id = u\.id and g\.role = 'promoter'/.test(sqlStatements)
    && /on conflict \(grant_key\) do update/.test(sqlStatements)
    && !/where u\.is_admin = false[\s\S]*insert into public\.prompt_lab_grants/.test(sqlStatements));
  check('admin 해제 계정의 seeded promoter를 회수', /grant_key like 'admin-promoter:%'[\s\S]*u\.is_admin = true/.test(sqlStatements)
    && /status = 'revoked'/.test(sqlStatements));
  check('권한 seed는 계정을 생성하지 않음', !/insert into public\.users/i.test(sqlStatements));
  check('baseline UPDATE DELETE 차단 trigger 존재', /before update or delete on public\.prompt_lab_fixtures/i.test(sql));
  check('Prompt Lab 테이블 RLS 활성·브라우저 role revoke', /enable row level security/i.test(sql) && /revoke all on table public\.prompt_lab_prompt_versions from anon, authenticated/i.test(sql));
  const atomicSql = readFileSync(join(root, 'docs', 'readinggo', 'supabase', '48_prompt_lab_promotion_atomic.sql'), 'utf8');
  const atomicStatements = atomicSql.replace(/--[^\n]*/g, '');
  check('승격 RPC는 transaction advisory lock으로 동시 요청 직렬화', /pg_advisory_xact_lock/.test(atomicStatements));
  check('승격 RPC 내부에서 active archive·새 active·audit를 함께 기록', /update public\.prompt_lab_prompt_versions[\s\S]*insert into public\.prompt_lab_prompt_versions[\s\S]*insert into public\.prompt_lab_audit_log/.test(atomicStatements));
  check('승격 RPC는 DB에서도 현재 admin과 active promoter를 모두 확인', /u\.is_admin = true/.test(atomicStatements) && /g\.role = 'promoter'/.test(atomicStatements) && /g\.status = 'active'/.test(atomicStatements));
  check('승격 RPC는 브라우저 실행권한을 회수하고 service role만 허용', /revoke all on function public\.prompt_lab_promote_atomic[\s\S]*from public, anon, authenticated/.test(atomicStatements)
    && /grant execute on function public\.prompt_lab_promote_atomic[\s\S]*to service_role/.test(atomicStatements));
  const handoffSql = readFileSync(join(root, 'docs', 'readinggo', 'supabase', '51_prompt_lab_handoff.sql'), 'utf8');
  const handoffStatements = handoffSql.replace(/--[^\n]*/g, '');
  check('DEV handoff artifact는 버전·평가 근거·승인자·server 시각을 보존',
    /'versionNo', v_active\.version_no/.test(handoffStatements)
    && /'evaluationEvidence', v_evidence/.test(handoffStatements)
    && /'devApprovedBy', p_actor_id/.test(handoffStatements)
    && /'devApprovedAt', v_approved_at/.test(handoffStatements));
  check('불완전 baseline 평가 근거는 handoff artifact 생성 거부',
    /prompt_lab_handoff_evidence_incomplete/.test(handoffStatements)
    && /fixture_type = 'baseline'/.test(handoffStatements));
  check('PROD handoff는 현재 admin promoter를 재검증하고 active 교체와 audit를 원자 처리',
    /prompt_lab_activate_handoff/.test(handoffStatements)
    && /pg_advisory_xact_lock/.test(handoffStatements)
    && /u\.is_admin = true/.test(handoffStatements)
    && /update public\.prompt_lab_prompt_versions[\s\S]*insert into public\.prompt_lab_prompt_versions[\s\S]*insert into public\.prompt_lab_audit_log/.test(handoffStatements));
  check('PROD handoff는 malformed artifact와 같은 DEV version 재적용을 거부',
    /jsonb_typeof\(p_artifact\) <> 'object'/.test(handoffStatements)
    && /prompt_lab_handoff_already_active/.test(handoffStatements)
    && /metadata->'artifact'->>'versionId' = p_artifact->>'versionId'/.test(handoffStatements));
  check('handoff RPC는 브라우저 권한을 회수하고 service role만 허용',
    /revoke all on function public\.prompt_lab_create_handoff[\s\S]*from public, anon, authenticated/.test(handoffStatements)
    && /revoke all on function public\.prompt_lab_activate_handoff[\s\S]*from public, anon, authenticated/.test(handoffStatements)
    && (handoffStatements.match(/grant execute on function public\.prompt_lab_[a-z_]+\([^;]+to service_role/g) || []).length === 2);
  const sqlPrompt = (sql.match(/\$prompt\$([\s\S]*?)\$prompt\$/) || [])[1];
  const workerLiteral = (workerSource.match(/const COMPANION_SYSTEM = ('[^\n]+');/) || [])[1];
  const workerPrompt = workerLiteral ? Function(`return ${workerLiteral}`)() : '';
  check('마이그레이션 active v1은 현재 운영 prompt와 동일', !!sqlPrompt && sqlPrompt === workerPrompt);
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\n${passed} passed`);
