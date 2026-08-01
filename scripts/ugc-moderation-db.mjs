import fs from 'node:fs';

const mode = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const refs = { dev: 'zxduehgucrcwzzyrmhhl', prod: 'cttllwwkaddghqttyhkg' };
if (!token || !['validate-dev', 'audit-prod', 'apply-prod'].includes(mode)) process.exit(2);

async function query(ref, sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`Management API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

const migration49 = fs.readFileSync('docs/readinggo/supabase/49_ugc_moderation.sql', 'utf8');
const migration = fs.readFileSync('docs/readinggo/supabase/50_ugc_moderation_hardening.sql', 'utf8');
const tests = fs.readFileSync('tests/sql/ugc-moderation-hardening.sql', 'utf8');
const audit = `
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_sel' and qual like '%moderation_user_visible%') then raise exception 'users_policy_missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='user_books' and policyname='ub_sel' and qual like '%moderation_user_visible%') then raise exception 'user_books_policy_missing'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='sentences' and policyname='sent_sel' and qual like '%auth.uid%') then raise exception 'sentences_owner_policy_missing'; end if;
  if has_table_privilege('authenticated','public.moderation_reports','select') then raise exception 'reports_grant_exposed'; end if;
end $$;`;

if (mode === 'validate-dev') {
  await query(refs.dev, `begin; ${migration49} ${migration} ${tests} rollback;`);
  console.log('OK: DEV migration transaction and separate-identity RLS tests rolled back');
} else if (mode === 'audit-prod') {
  await query(refs.prod, audit);
  console.log('OK: production base policies and grants match migration 49');
} else {
  await query(refs.prod, `begin; ${migration} ${audit} commit;`);
  console.log('OK: production migration 50 committed with catalog readback');
}
