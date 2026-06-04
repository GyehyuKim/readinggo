/* =====================================================================
   ReadingGo — Supabase 운영 CLI (admin-cli.mjs)

   레포 루트 .env 에서 시크릿을 읽어 Management API(SQL) + service_role(auth)
   로 운영 작업을 수행한다. 시크릿은 절대 출력하지 않음(불리언/카운트만).
   의존성 없음(Node 18+ 내장 fetch). NPC 시드는 별도 seed_npc.mjs.

   .env 필요 키: SUPABASE_URL, SUPABASE_ACCESS_TOKEN(sbp_…), SUPABASE_SERVICE_ROLE_KEY

   사용법:
     node admin-cli.mjs verify                       # 토큰 2개 연결 확인
     node admin-cli.mjs state                        # users/npc/admin/books/sentences 카운트
     node admin-cli.mjs sql <file.sql>               # SQL 파일 실행(상대경로=supabase/)
     node admin-cli.mjs sql-inline "<SQL>"           # 인라인 SQL 실행
     node admin-cli.mjs create-admin <email> [pw]    # 공통 admin 계정 생성 + is_admin
     node admin-cli.mjs set-admin <email>            # 기존 계정에 is_admin 부여
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(here, '../../../.env'); // supabase → readinggo → docs → repo root

function loadEnv(p) {
  const out = {};
  let txt = '';
  try { txt = readFileSync(p, 'utf8'); } catch { return out; }
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

const env = loadEnv(ENV_PATH);
const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL || '';
const PAT = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN || '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
const REF = (SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || '';

function need(cond, msg) { if (!cond) { console.error('❌ ' + msg); process.exit(1); } }

async function mgmt(sql) {
  need(PAT, 'SUPABASE_ACCESS_TOKEN 없음(.env)');
  need(REF, 'SUPABASE_URL 에서 project ref 파싱 실패');
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Management API ${r.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function authAdmin(method, path, body) {
  need(SR, 'SUPABASE_SERVICE_ROLE_KEY 없음(.env)');
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { ok: r.ok, status: r.status, json };
}

async function mgmtApi(method, path, body) {
  need(PAT, 'SUPABASE_ACCESS_TOKEN 없음(.env)');
  need(REF, 'project ref 파싱 실패');
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, {
    method,
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!r.ok) throw new Error(`Management API ${method} ${path} ${r.status}: ${String(text).slice(0, 400)}`);
  return json;
}

const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function cmdVerify() {
  console.log('project ref  :', REF || '(파싱 실패)');
  console.log('PAT 존재     :', !!PAT);
  console.log('service_role :', !!SR);
  const v = await mgmt('select current_database() as db, now() as ts;');
  console.log('Management API:', JSON.stringify(v));
  const a = await authAdmin('GET', '/auth/v1/admin/users?page=1&per_page=1');
  console.log('service_role :', a.ok ? 'OK' : `실패(${a.status})`);
}

async function cmdState() {
  const q = await mgmt(`select
      (select count(*) from public.users)                                 as users,
      (select count(*) from public.users where is_npc)                    as npcs,
      (select count(*) from public.users where coalesce(is_admin,false))  as admins,
      (select count(*) from public.books)                                 as books,
      (select count(*) from public.user_books)                            as user_books,
      (select count(*) from public.sentences)                             as sentences;`);
  console.log(JSON.stringify(q, null, 2));
}

async function cmdSqlFile(file) {
  need(file, '파일 경로 필요');
  const p = isAbsolute(file) ? file : join(here, file);
  const out = await mgmt(readFileSync(p, 'utf8'));
  console.log('✅ SQL 적용:', file, '→', JSON.stringify(out));
}

async function cmdSqlInline(sql) {
  need(sql, 'SQL 문자열 필요');
  console.log(JSON.stringify(await mgmt(sql), null, 2));
}

async function cmdCreateAdmin(email, password) {
  need(email, 'email 필요: node admin-cli.mjs create-admin <email> [password]');
  const pw = password || ('Rg!' + Math.random().toString(36).slice(2, 10) + 'Z9');
  const c = await authAdmin('POST', '/auth/v1/admin/users', { email, password: pw, email_confirm: true });
  let created = false;
  if (c.ok) created = true;
  else if (/registered|exists|already/i.test(JSON.stringify(c.json))) console.log('ℹ️ 계정 이미 존재 → is_admin 만 부여');
  else throw new Error(`createUser 실패 ${c.status}: ${JSON.stringify(c.json).slice(0, 300)}`);
  const up = await mgmt(`update public.users set is_admin = true
    where id = (select id from auth.users where email = ${sqlStr(email)})
    returning handle, is_admin;`);
  console.log('✅ admin 지정:', JSON.stringify(up));
  if (created) {
    console.log('── 새 공통 admin 계정 ──');
    console.log('   email    :', email);
    console.log('   password :', pw, ' ← 팀 공유. 첫 로그인 후 변경 권장.');
  } else console.log('(기존 계정 — 비밀번호 변경 안 함)');
}

async function cmdSetAdmin(email) {
  need(email, 'email 필요');
  console.log(JSON.stringify(await mgmt(`update public.users set is_admin = true
    where id = (select id from auth.users where email = ${sqlStr(email)})
    returning handle, is_admin;`)));
}

async function cmdAuthGet() {
  const c = await mgmtApi('GET', '/config/auth');
  console.log(JSON.stringify({
    mailer_autoconfirm: c.mailer_autoconfirm,
    external_email_enabled: c.external_email_enabled,
    smtp: c.smtp_host ? '(커스텀 SMTP 설정됨)' : '(기본 내장 메일러 — 발송 한도 매우 낮음)',
    site_url: c.site_url,
    uri_allow_list: c.uri_allow_list,
  }, null, 2));
}

async function cmdAuthAutoconfirm(onoff) {
  const on = /^(on|true|1|yes)$/i.test(String(onoff));
  const c = await mgmtApi('PATCH', '/config/auth', { mailer_autoconfirm: on });
  console.log(`✅ mailer_autoconfirm = ${c.mailer_autoconfirm} (true=가입 즉시 로그인, 확인메일 불필요)`);
}

async function cmdConfirmUser(email) {
  need(email, 'email 필요');
  const out = await mgmt(`update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where email = ${sqlStr(email)}
    returning email, (email_confirmed_at is not null) as confirmed;`);
  console.log(JSON.stringify(out));
}

// ReadingGo 브랜딩 이메일 템플릿 — 사용자가 ReadingGo 발신임을 확인할 수 있도록
const RG_EMAIL_TEMPLATES = {
  confirmation: {
    subject: 'ReadingGo — 이메일을 확인해주세요 🐦',
    content: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="color:#3FD17F;margin-bottom:4px">🐦 ReadingGo</h2>
  <p style="color:#888;font-size:13px;margin-top:0">하루 한 페이지, 한 문장에서 시작해요</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p>ReadingGo에 가입해주셔서 감사합니다!<br>아래 버튼을 눌러 이메일을 확인해주세요.</p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:#3FD17F;color:#fff;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px">이메일 확인하기 →</a>
  <p style="color:#aaa;font-size:12px">본인이 가입하지 않은 경우 이 메일을 무시해주세요.</p>
  <p style="color:#aaa;font-size:12px">문의: <a href="mailto:readinggo.admin@gmail.com" style="color:#3FD17F">readinggo.admin@gmail.com</a></p>
</div>`,
  },
  magic_link: {
    subject: 'ReadingGo — 로그인 링크입니다 🐦',
    content: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="color:#3FD17F;margin-bottom:4px">🐦 ReadingGo</h2>
  <p style="color:#888;font-size:13px;margin-top:0">하루 한 페이지, 한 문장에서 시작해요</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p>ReadingGo 로그인 링크가 도착했습니다.<br>아래 버튼을 클릭하면 바로 로그인됩니다 (10분 유효).</p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:#3FD17F;color:#fff;border-radius:12px;text-decoration:none;font-weight:800;font-size:15px">ReadingGo 시작하기 →</a>
  <p style="color:#aaa;font-size:12px">본인이 요청하지 않은 경우 이 메일을 무시해주세요.</p>
  <p style="color:#aaa;font-size:12px">문의: <a href="mailto:readinggo.admin@gmail.com" style="color:#3FD17F">readinggo.admin@gmail.com</a></p>
</div>`,
  },
};

async function cmdEmailTemplate(sub) {
  if (!sub || sub === 'show') {
    // 현재 설정 확인 — template 관련 필드만 출력
    const c = await mgmtApi('GET', '/config/auth');
    const keys = Object.keys(c).filter(k => k.includes('template') || k.includes('mailer_subject') || k.includes('mailer_content') || k.includes('magic'));
    console.log('현재 이메일 템플릿 관련 설정:', JSON.stringify(Object.fromEntries(keys.map(k => [k, c[k]])), null, 2));
    return;
  }
  if (sub === 'set') {
    // Supabase Management API email template 필드명 (v1)
    const patch = {
      mailer_subjects_confirmation: RG_EMAIL_TEMPLATES.confirmation.subject,
      mailer_templates_confirmation_content: RG_EMAIL_TEMPLATES.confirmation.content,
      mailer_subjects_magic_link: RG_EMAIL_TEMPLATES.magic_link.subject,
      mailer_templates_magic_link_content: RG_EMAIL_TEMPLATES.magic_link.content,
    };
    try {
      const c = await mgmtApi('PATCH', '/config/auth', patch);
      console.log('✅ 이메일 템플릿 적용 완료');
      const keys = Object.keys(patch);
      keys.forEach(k => console.log(' ', k, '=', String(c[k] || '(응답 없음)').slice(0, 60)));
    } catch (e) {
      console.error('템플릿 설정 실패:', e.message);
      console.log('💡 대시보드에서 직접 설정: Authentication > Email Templates');
      console.log('   Confirmation Subject:', RG_EMAIL_TEMPLATES.confirmation.subject);
      console.log('   Magic Link Subject:', RG_EMAIL_TEMPLATES.magic_link.subject);
    }
  }
}

async function cmdAuthSetUrl(url) {
  need(url, 'site_url 필요: node admin-cli.mjs auth-seturl https://xxx.netlify.app');
  const cur = await mgmtApi('GET', '/config/auth');
  const allow = new Set(String(cur.uri_allow_list || '').split(',').map((s) => s.trim()).filter(Boolean));
  const base = url.replace(/\/+$/, '');
  allow.add(base); allow.add(base + '/**');
  const c = await mgmtApi('PATCH', '/config/auth', { site_url: base, uri_allow_list: [...allow].join(',') });
  console.log('✅ site_url =', c.site_url);
  console.log('   uri_allow_list =', c.uri_allow_list);
}

const [cmd, ...rest] = process.argv.slice(2);
const run = {
  verify: () => cmdVerify(),
  state: () => cmdState(),
  sql: () => cmdSqlFile(rest[0]),
  'sql-inline': () => cmdSqlInline(rest[0]),
  'create-admin': () => cmdCreateAdmin(rest[0], rest[1]),
  'set-admin': () => cmdSetAdmin(rest[0]),
  'auth-get': () => cmdAuthGet(),
  'auth-autoconfirm': () => cmdAuthAutoconfirm(rest[0]),
  'auth-seturl': () => cmdAuthSetUrl(rest[0]),
  'confirm-user': () => cmdConfirmUser(rest[0]),
  'email-template': () => cmdEmailTemplate(rest[0]),
}[cmd];
need(run, `알 수 없는 명령: ${cmd || '(없음)'} — verify|state|sql|sql-inline|create-admin|set-admin|auth-get|auth-autoconfirm|auth-seturl|confirm-user|email-template`);
run().catch((e) => { console.error('실패:', e.message || e); process.exit(1); });
