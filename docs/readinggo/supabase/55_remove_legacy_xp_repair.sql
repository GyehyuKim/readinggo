-- =====================================================================
-- ReadingGo — 55_remove_legacy_xp_repair.sql  (#1453 Phase 4)
-- 54_freeze_increment_xp.sql 이후 실행. 재실행 안전.
--
-- XP·둥지·하루 만회는 v17 책나무의 권위 데이터가 아니다. 삭제 전에
-- migration_backups 스키마에 rollback snapshot을 만들고, 함수→세션 XP→
-- 사용자 XP→만회 전용 필드 순으로 제거한다. 책·문장·진도·세션 날짜는 보존한다.
-- Production 적용은 DEV schema readback과 동일 SHA/digest 검증 후 Hyu 승인 대상이다.
-- =====================================================================

-- Transaction ownership: migrate-dev.yml wraps this SQL and the ledger insert atomically.

create schema if not exists migration_backups;
revoke all on schema migration_backups from public, anon, authenticated;

create table if not exists migration_backups.phase4_increment_xp (
  function_identity text primary key,
  function_definition text not null,
  function_owner text not null,
  function_acl text,
  backed_up_at timestamptz not null default now()
);

create table if not exists migration_backups.phase4_users_public_view (
  view_identity text primary key,
  view_definition text not null,
  view_owner text not null,
  view_acl text,
  backed_up_at timestamptz not null default now()
);

create table if not exists migration_backups.phase4_reading_sessions_xp (
  session_id uuid primary key,
  xp_earned int,
  backed_up_at timestamptz not null default now()
);

create table if not exists migration_backups.phase4_users_xp (
  user_id uuid primary key,
  xp int not null,
  backed_up_at timestamptz not null default now()
);

create table if not exists migration_backups.phase4_streak_repair (
  user_id uuid primary key,
  last_repair_date date,
  backed_up_at timestamptz not null default now()
);

create table if not exists migration_backups.phase4_manifest (
  surface text primary key,
  source_row_count bigint not null,
  backup_row_count bigint not null,
  verified_at timestamptz not null default now()
);

-- 함수 정의와 owner/ACL을 먼저 보존한다. 재시도에서 함수가 이미 없으면 기존 snapshot을 유지한다.
do $backup_function$
declare
  function_oid oid := to_regprocedure('public.increment_xp(integer)');
begin
  if function_oid is not null then
    insert into migration_backups.phase4_increment_xp (
      function_identity, function_definition, function_owner, function_acl
    )
    select
      'public.increment_xp(integer)',
      pg_get_functiondef(p.oid),
      pg_get_userbyid(p.proowner),
      p.proacl::text
    from pg_proc p
    where p.oid = function_oid
    on conflict (function_identity) do nothing;

    insert into migration_backups.phase4_manifest(surface, source_row_count, backup_row_count)
    values ('public.increment_xp(integer)', 1, 1)
    on conflict (surface) do nothing;
  end if;
end
$backup_function$;

-- users.xp 컬럼의 의존 view도 정의와 권한을 보존한 뒤 XP 없는 동일 공개 계약으로 교체한다.
do $backup_view$
declare
  view_oid oid := to_regclass('public.users_public');
begin
  if view_oid is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users_public' and column_name = 'xp'
  ) then
    insert into migration_backups.phase4_users_public_view (
      view_identity, view_definition, view_owner, view_acl
    )
    select
      'public.users_public',
      pg_get_viewdef(c.oid, true),
      pg_get_userbyid(c.relowner),
      c.relacl::text
    from pg_class c
    where c.oid = view_oid
    on conflict (view_identity) do nothing;
  end if;
end
$backup_view$;

-- 컬럼이 남아 있는 최초 실행에서만 동적 SQL로 snapshot을 갱신한다.
-- 동적 SQL은 컬럼 삭제 후 재실행해도 parse 단계에서 실패하지 않게 한다.
do $backup_columns$
declare
  source_count bigint;
  backup_count bigint;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_sessions' and column_name = 'xp_earned'
  ) then
    execute $sql$
      insert into migration_backups.phase4_reading_sessions_xp(session_id, xp_earned)
      select id, xp_earned from public.reading_sessions
      on conflict (session_id) do nothing
    $sql$;
    execute 'select count(*) from public.reading_sessions' into source_count;
    select count(*) into backup_count from migration_backups.phase4_reading_sessions_xp;
    if backup_count <> source_count then
      raise exception 'reading_sessions.xp_earned backup mismatch: source %, backup %', source_count, backup_count;
    end if;
    insert into migration_backups.phase4_manifest values ('public.reading_sessions.xp_earned', source_count, backup_count, now())
    on conflict (surface) do nothing;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'xp'
  ) then
    execute $sql$
      insert into migration_backups.phase4_users_xp(user_id, xp)
      select id, xp from public.users
      on conflict (user_id) do nothing
    $sql$;
    execute 'select count(*) from public.users' into source_count;
    select count(*) into backup_count from migration_backups.phase4_users_xp;
    if backup_count <> source_count then
      raise exception 'users.xp backup mismatch: source %, backup %', source_count, backup_count;
    end if;
    insert into migration_backups.phase4_manifest values ('public.users.xp', source_count, backup_count, now())
    on conflict (surface) do nothing;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'streak' and column_name = 'last_repair_date'
  ) then
    execute $sql$
      insert into migration_backups.phase4_streak_repair(user_id, last_repair_date)
      select user_id, last_repair_date from public.streak
      on conflict (user_id) do nothing
    $sql$;
    execute 'select count(*) from public.streak' into source_count;
    select count(*) into backup_count from migration_backups.phase4_streak_repair;
    if backup_count <> source_count then
      raise exception 'streak.last_repair_date backup mismatch: source %, backup %', source_count, backup_count;
    end if;
    insert into migration_backups.phase4_manifest values ('public.streak.last_repair_date', source_count, backup_count, now())
    on conflict (surface) do nothing;
  end if;
end
$backup_columns$;

-- 의존성 순서: RPC → users_public view → 세션 XP → 사용자 XP → 만회 필드.
drop function if exists public.increment_xp(int);

-- CREATE OR REPLACE VIEW는 기존 컬럼 제거를 허용하지 않으므로 같은 transaction에서 drop/create한다.
-- CASCADE를 사용하지 않아 예상하지 못한 의존 객체가 있으면 migration 전체가 rollback된다.
drop view if exists public.users_public;
create view public.users_public as
  select u.id, u.handle, u.display_name, u.avatar_url, u.bio, u.wishlist_public, u.created_at
  from public.users u
  where public.moderation_user_visible(u.id);
grant select on public.users_public to authenticated;
revoke select on public.users_public from public, anon;

alter table if exists public.reading_sessions drop column if exists xp_earned;
alter table if exists public.users drop column if exists xp;
alter table if exists public.streak drop column if exists last_repair_date;

-- 같은 transaction 안에서 삭제와 보존 경계를 readback한다.
do $readback$
begin
  if to_regprocedure('public.increment_xp(integer)') is not null then
    raise exception 'readback failed: public.increment_xp(integer) still exists';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'reading_sessions' and column_name = 'xp_earned')
        or (table_name = 'users' and column_name = 'xp')
        or (table_name = 'streak' and column_name = 'last_repair_date'))
  ) then
    raise exception 'readback failed: a legacy XP/repair column still exists';
  end if;
  if to_regclass('public.users_public') is null
    or exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'users_public' and column_name = 'xp'
    )
    or not has_table_privilege('authenticated', 'public.users_public', 'select')
    or has_table_privilege('anon', 'public.users_public', 'select')
  then
    raise exception 'readback failed: users_public XP-free visibility contract is missing';
  end if;
  if to_regclass('public.books') is null
    or to_regclass('public.user_books') is null
    or to_regclass('public.sentences') is null
    or to_regclass('public.reading_sessions') is null
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'reading_sessions' and column_name = 'session_date'
    )
  then
    raise exception 'readback failed: protected book/sentence/progress/session_date surface is missing';
  end if;
end
$readback$;
