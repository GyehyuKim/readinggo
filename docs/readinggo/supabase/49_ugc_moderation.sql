-- 49_ugc_moderation.sql
-- #1392 Google Play UGC 정책: 공개 게시 동의, 신고, 차단, 운영자 조치.
-- 멱등 실행. Production 적용 후 출시 AAB에서 검증하기 전 Play 설문을 갱신하지 않는다.

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('sentence', 'user')),
  target_id uuid not null,
  reason text not null check (reason in ('sexual', 'violence', 'hate_or_harassment', 'spam', 'illegal', 'other')),
  detail text null check (detail is null or char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  action text null check (action is null or action in ('dismiss', 'hide_sentence', 'suspend_user')),
  moderator_id uuid null references public.users(id),
  moderator_note text null check (moderator_note is null or char_length(moderator_note) <= 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  unique (reporter_id, target_type, target_id)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.moderation_hidden_sentences (
  sentence_id uuid primary key references public.sentences(id) on delete cascade,
  report_id uuid null references public.moderation_reports(id),
  hidden_by uuid not null references public.users(id),
  reason text null,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_suspended_users (
  user_id uuid primary key references public.users(id) on delete cascade,
  report_id uuid null references public.moderation_reports(id),
  suspended_by uuid not null references public.users(id),
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists moderation_reports_reporter_created_idx
  on public.moderation_reports (reporter_id, created_at desc);
create index if not exists moderation_reports_status_created_idx
  on public.moderation_reports (status, created_at);
create index if not exists user_blocks_blocked_blocker_idx
  on public.user_blocks (blocked_id, blocker_id);

alter table public.moderation_reports enable row level security;
alter table public.user_blocks enable row level security;
alter table public.moderation_hidden_sentences enable row level security;
alter table public.moderation_suspended_users enable row level security;

-- 공개 프로필/책장/관계의 공통 서버 가시성. 본인·운영자는 항상 접근하고,
-- 일반 사용자는 정지·신고 즉시숨김·양방향 차단 대상을 원문 단계에서 받지 않는다.
create or replace function public.moderation_user_visible(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_user_id = auth.uid()
    or public.is_admin()
    or (
      auth.uid() is not null
      and not exists (select 1 from public.moderation_suspended_users x where x.user_id = p_user_id)
      and not exists (
        select 1 from public.moderation_reports r
        where r.reporter_id = auth.uid()
          and r.target_type = 'user'
          and r.target_id = p_user_id
          and r.status <> 'dismissed'
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p_user_id)
           or (b.blocker_id = p_user_id and b.blocked_id = auth.uid())
      )
    );
$$;

-- 기존 공개 테이블 정책도 같은 서버 경계를 사용해 users_public 우회 조회를 막는다.
drop policy if exists users_sel on public.users;
create policy users_sel on public.users for select
  using (public.moderation_user_visible(id));
drop policy if exists ub_sel on public.user_books;
create policy ub_sel on public.user_books for select
  using (public.moderation_user_visible(user_id));
drop policy if exists streak_sel on public.streak;
create policy streak_sel on public.streak for select
  using (public.moderation_user_visible(user_id));
drop policy if exists follows_sel on public.follows;
drop policy if exists follows_mod on public.follows;
drop policy if exists follows_ins on public.follows;
drop policy if exists follows_del on public.follows;
create policy follows_sel on public.follows for select using (
  public.moderation_user_visible(follower_id)
  and public.moderation_user_visible(following_id)
);
create policy follows_ins on public.follows for insert with check (
  follower_id = auth.uid()
  and public.moderation_user_visible(following_id)
);
create policy follows_del on public.follows for delete using (follower_id = auth.uid());

drop policy if exists moderation_reports_select on public.moderation_reports;
drop policy if exists moderation_reports_admin_update on public.moderation_reports;
drop policy if exists user_blocks_select on public.user_blocks;
create policy user_blocks_select on public.user_blocks for select
  using (blocker_id = auth.uid());

drop policy if exists moderation_hidden_admin on public.moderation_hidden_sentences;
create policy moderation_hidden_admin on public.moderation_hidden_sentences for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists moderation_suspended_admin on public.moderation_suspended_users;
create policy moderation_suspended_admin on public.moderation_suspended_users for all
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.moderation_reports from anon, authenticated;
revoke all on public.user_blocks from anon, authenticated;
revoke all on public.moderation_hidden_sentences from anon, authenticated;
revoke all on public.moderation_suspended_users from anon, authenticated;
grant select on public.user_blocks to authenticated;

create or replace function public.moderation_user_suspended(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.moderation_suspended_users where user_id = p_user_id);
$$;
revoke all on function public.moderation_user_suspended(uuid) from public, anon;
grant execute on function public.moderation_user_suspended(uuid) to authenticated;

create or replace function public.moderation_accept_terms(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_accepted_at timestamptz := now();
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_version <> '2026-08-01' then raise exception 'invalid_terms_version' using errcode = '22023'; end if;

  update public.users
    set settings = jsonb_set(
      coalesce(settings, '{}'::jsonb),
      '{ugc_terms}',
      jsonb_build_object('version', p_version, 'accepted_at', v_accepted_at),
      true
    )
    where id = v_uid;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;

  return jsonb_build_object('version', p_version, 'accepted_at', v_accepted_at);
end;
$$;

-- 공개/친구공개 쓰기는 현재 UGC 약관 버전과 서버 기록 시각을 함께 강제한다.
drop policy if exists sent_mod on public.sentences;
drop policy if exists sent_ins on public.sentences;
drop policy if exists sent_upd on public.sentences;
drop policy if exists sent_del on public.sentences;
create policy sent_ins on public.sentences for insert with check (
  user_id = auth.uid()
  and not public.moderation_user_suspended(auth.uid())
  and (
    visibility = 'private'
    or exists (
      select 1 from public.users
      where id = auth.uid()
        and settings #>> '{ugc_terms,version}' = '2026-08-01'
        and nullif(settings #>> '{ugc_terms,accepted_at}', '') is not null
    )
  )
);
create policy sent_upd on public.sentences for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and not public.moderation_user_suspended(auth.uid())
    and (
      visibility = 'private'
      or exists (
        select 1 from public.users
        where id = auth.uid()
          and settings #>> '{ugc_terms,version}' = '2026-08-01'
          and nullif(settings #>> '{ugc_terms,accepted_at}', '') is not null
      )
    )
  );
create policy sent_del on public.sentences for delete using (user_id = auth.uid());

drop function if exists public.moderation_report(text, uuid, text, text);
create function public.moderation_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_detail text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_report public.moderation_reports;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_target_type not in ('sentence', 'user') then raise exception 'invalid_target_type' using errcode = '22023'; end if;
  if p_reason not in ('sexual', 'violence', 'hate_or_harassment', 'spam', 'illegal', 'other') then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if p_detail is not null and char_length(p_detail) > 500 then raise exception 'detail_too_long' using errcode = '22001'; end if;
  if (select count(*) from public.moderation_reports where reporter_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'report_rate_limited' using errcode = 'P0001';
  end if;

  if p_target_type = 'sentence' then
    select user_id into v_owner from public.sentences where id = p_target_id;
  else
    select id into v_owner from public.users where id = p_target_id;
  end if;
  if v_owner is null then raise exception 'target_not_found' using errcode = 'P0002'; end if;
  if v_owner = v_uid then raise exception 'cannot_report_self' using errcode = '22023'; end if;

  insert into public.moderation_reports (reporter_id, target_type, target_id, reason, detail)
  values (v_uid, p_target_type, p_target_id, p_reason, nullif(trim(p_detail), ''))
  on conflict (reporter_id, target_type, target_id) do update
    set reason = excluded.reason,
        detail = excluded.detail
    where public.moderation_reports.status in ('open', 'reviewed')
  returning * into v_report;

  if v_report.id is null then
    select * into v_report from public.moderation_reports
      where reporter_id = v_uid and target_type = p_target_type and target_id = p_target_id;
  end if;
  return jsonb_build_object('id', v_report.id, 'status', v_report.status);
end;
$$;

create or replace function public.moderation_block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_user_id = v_uid then raise exception 'cannot_block_self' using errcode = '22023'; end if;
  if not exists (select 1 from public.users where id = p_user_id) then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_uid, p_user_id)
    on conflict do nothing;
  delete from public.follows
    where (follower_id = v_uid and following_id = p_user_id)
       or (follower_id = p_user_id and following_id = v_uid);
end;
$$;

create or replace function public.moderation_unblock_user(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
$$;

create or replace function public.moderation_is_blocked(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = p_user_id)
       or (blocker_id = p_user_id and blocked_id = auth.uid())
  );
$$;

create or replace function public.moderation_list_blocked()
returns table (id uuid, handle text, display_name text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select u.id, u.handle, u.display_name, u.avatar_url
  from public.user_blocks b join public.users u on u.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

create or replace function public.moderation_admin_action(
  p_report_id uuid,
  p_action text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.moderation_reports;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'hide_sentence', 'suspend_user') then raise exception 'invalid_action' using errcode = '22023'; end if;
  select * into v_report from public.moderation_reports where id = p_report_id for update;
  if v_report.id is null then raise exception 'report_not_found' using errcode = 'P0002'; end if;

  if p_action = 'hide_sentence' then
    if v_report.target_type <> 'sentence' then raise exception 'sentence_target_required' using errcode = '22023'; end if;
    insert into public.moderation_hidden_sentences (sentence_id, report_id, hidden_by, reason)
      values (v_report.target_id, v_report.id, v_uid, p_note)
      on conflict (sentence_id) do update set report_id = excluded.report_id, hidden_by = excluded.hidden_by, reason = excluded.reason;
  elsif p_action = 'suspend_user' then
    if v_report.target_type <> 'user' then raise exception 'user_target_required' using errcode = '22023'; end if;
    insert into public.moderation_suspended_users (user_id, report_id, suspended_by, reason)
      values (v_report.target_id, v_report.id, v_uid, p_note)
      on conflict (user_id) do update set report_id = excluded.report_id, suspended_by = excluded.suspended_by, reason = excluded.reason;
  end if;

  update public.moderation_reports
    set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end,
        action = p_action,
        moderator_id = v_uid,
        moderator_note = nullif(trim(p_note), ''),
        reviewed_at = now()
    where id = p_report_id;
end;
$$;

create or replace function public.moderation_admin_review(
  p_report_id uuid,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_note is not null and char_length(p_note) > 1000 then raise exception 'note_too_long' using errcode = '22001'; end if;
  update public.moderation_reports
    set status = 'reviewed',
        moderator_id = v_uid,
        moderator_note = nullif(trim(p_note), ''),
        reviewed_at = now()
    where id = p_report_id and status = 'open';
  if not found then raise exception 'open_report_not_found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.moderation_admin_reports()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare v_rows jsonb;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'reporter', jsonb_build_object('handle', u.handle),
    'target_type', r.target_type,
    'target_id', r.target_id,
    'reason', r.reason,
    'detail', r.detail,
    'status', r.status,
    'action', r.action,
    'moderator_note', r.moderator_note,
    'created_at', r.created_at,
    'reviewed_at', r.reviewed_at
  ) order by r.created_at asc), '[]'::jsonb)
    into v_rows
    from (select * from public.moderation_reports order by created_at asc limit 100) r
    left join public.users u on u.id = r.reporter_id;
  return v_rows;
end;
$$;

revoke all on function public.moderation_accept_terms(text) from public, anon;
revoke all on function public.moderation_user_visible(uuid) from public, anon;
revoke all on function public.moderation_report(text, uuid, text, text) from public, anon;
revoke all on function public.moderation_block_user(uuid) from public, anon;
revoke all on function public.moderation_unblock_user(uuid) from public, anon;
revoke all on function public.moderation_is_blocked(uuid) from public, anon;
revoke all on function public.moderation_list_blocked() from public, anon;
revoke all on function public.moderation_admin_action(uuid, text, text) from public, anon;
revoke all on function public.moderation_admin_review(uuid, text) from public, anon;
revoke all on function public.moderation_admin_reports() from public, anon;
grant execute on function public.moderation_accept_terms(text) to authenticated;
grant execute on function public.moderation_user_visible(uuid) to authenticated;
grant execute on function public.moderation_report(text, uuid, text, text) to authenticated;
grant execute on function public.moderation_block_user(uuid) to authenticated;
grant execute on function public.moderation_unblock_user(uuid) to authenticated;
grant execute on function public.moderation_is_blocked(uuid) to authenticated;
grant execute on function public.moderation_list_blocked() to authenticated;
grant execute on function public.moderation_admin_action(uuid, text, text) to authenticated;
grant execute on function public.moderation_admin_review(uuid, text) to authenticated;
grant execute on function public.moderation_admin_reports() to authenticated;

-- 타인에게 내려가는 공개 문장: 공개범위, 운영자 숨김/정지, 양방향 차단을 서버에서 필터한다.
create or replace view public.sentences_public as
  select s.id, s.user_id, s.user_book_id, s.session_id, s.page, s.text, s.created_at
  from public.sentences s
  where (
    s.visibility = 'public'
    or (
      s.visibility = 'followers'
      and exists (
        select 1 from public.follows f1 join public.follows f2
          on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
        where f1.follower_id = auth.uid() and f1.following_id = s.user_id
      )
    )
  )
  and not exists (select 1 from public.moderation_hidden_sentences h where h.sentence_id = s.id)
  and not exists (select 1 from public.moderation_suspended_users x where x.user_id = s.user_id)
  and not exists (
    select 1 from public.moderation_reports r
    where r.reporter_id = auth.uid()
      and r.status <> 'dismissed'
      and (
        (r.target_type = 'sentence' and r.target_id = s.id)
        or (r.target_type = 'user' and r.target_id = s.user_id)
      )
  )
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = s.user_id)
       or (b.blocker_id = s.user_id and b.blocked_id = auth.uid())
  );
grant select on public.sentences_public to authenticated;
revoke select on public.sentences_public from anon;

create or replace view public.users_public as
  select u.id, u.handle, u.display_name, u.avatar_url, u.bio, u.xp, u.wishlist_public, u.created_at
  from public.users u
  where public.moderation_user_visible(u.id);
grant select on public.users_public to authenticated;
revoke select on public.users_public from anon;
