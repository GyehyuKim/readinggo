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
  globalThis.fetch = async (url, init = {}) => {
    const s = String(url);
    if (s === `${SB}/auth/v1/user`) return Response.json({ id:'11111111-1111-1111-1111-111111111111' });
    if (s.includes('/rest/v1/users?')) return Response.json([{ id:'11111111-1111-1111-1111-111111111111', handle:'융디', is_admin:profileIsAdmin }]);
    if (s.includes('/rest/v1/prompt_lab_grants?')) return Response.json(grantRows);
    if (s.includes('/rest/v1/prompt_lab_fixtures?id=eq.')) return Response.json([fixture]);
    if (s.includes(`/rest/v1/prompt_lab_prompt_versions?id=eq.${candidate.id}`)) return Response.json([candidate]);
    if (s.includes(`/rest/v1/prompt_lab_prompt_versions?id=eq.${archived.id}`)) return Response.json([archived]);
    if (s.includes('/rest/v1/prompt_lab_prompt_versions?status=eq.active')) return Response.json([active]);
    if (s.includes('/rest/v1/prompt_lab_prompt_versions?status=eq.candidate')) return Response.json([candidate]);
    if (s.includes('/rest/v1/prompt_lab_prompt_versions?id=eq.') && init.method === 'PATCH') return new Response(null, { status:204 });
    if (s === `${SB}/rest/v1/prompt_lab_prompt_versions` && init.method === 'POST') {
      const row = JSON.parse(init.body);
      return Response.json([{ id:'00000000-0000-0000-0000-000000000030', version_no:3, ...row }]);
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
  const sqlPrompt = (sql.match(/\$prompt\$([\s\S]*?)\$prompt\$/) || [])[1];
  const workerLiteral = (workerSource.match(/const COMPANION_SYSTEM = ('[^\n]+');/) || [])[1];
  const workerPrompt = workerLiteral ? Function(`return ${workerLiteral}`)() : '';
  check('마이그레이션 active v1은 현재 운영 prompt와 동일', !!sqlPrompt && sqlPrompt === workerPrompt);
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\n${passed} passed`);
