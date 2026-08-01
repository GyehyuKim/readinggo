-- 50_ugc_moderation_hardening.sql
-- #1396: 공개 프로필/후기 쓰기와 재신고 lifecycle을 DB에서 fail-closed로 강제한다.

create or replace function public.moderation_terms_accepted(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = p_user_id
      and settings #>> '{ugc_terms,version}' = '2026-08-01'
      and nullif(settings #>> '{ugc_terms,accepted_at}', '') is not null
  );
$$;
revoke all on function public.moderation_terms_accepted(uuid) from public, anon;
grant execute on function public.moderation_terms_accepted(uuid) to authenticated;

create or replace function public.moderation_guard_public_ugc_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
begin
  if v_uid is null or public.is_admin() then return new; end if;
  if tg_table_name = 'users' and (v_old->>'id')::uuid = v_uid and (
    (v_new->>'handle') is distinct from (v_old->>'handle')
    or (v_new->>'display_name') is distinct from (v_old->>'display_name')
    or (v_new->>'avatar_url') is distinct from (v_old->>'avatar_url')
    or (v_new->>'bio') is distinct from (v_old->>'bio')
  ) then
    if public.moderation_user_suspended(v_uid) then
      raise exception 'ugc_user_suspended' using errcode = '42501';
    end if;
    if not public.moderation_terms_accepted(v_uid) then
      raise exception 'ugc_terms_required' using errcode = '42501';
    end if;
  elsif tg_table_name = 'user_books' and (v_new->>'review_text') is distinct from (v_old->>'review_text')
    and nullif(trim(v_new->>'review_text'), '') is not null then
    if public.moderation_user_suspended(v_uid) then
      raise exception 'ugc_user_suspended' using errcode = '42501';
    end if;
    if not public.moderation_terms_accepted(v_uid) then
      raise exception 'ugc_terms_required' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.moderation_guard_public_ugc_write() from public, anon, authenticated;

drop trigger if exists moderation_guard_public_profile_write on public.users;
create trigger moderation_guard_public_profile_write
before update on public.users
for each row execute function public.moderation_guard_public_ugc_write();

drop trigger if exists moderation_guard_public_review_write on public.user_books;
create trigger moderation_guard_public_review_write
before update on public.user_books
for each row execute function public.moderation_guard_public_ugc_write();

alter table public.moderation_reports
  drop constraint if exists moderation_reports_reporter_id_target_type_target_id_key;
drop index if exists public.moderation_reports_active_unique;
create unique index moderation_reports_active_unique
  on public.moderation_reports (reporter_id, target_type, target_id)
  where status in ('open', 'reviewed');

create or replace function public.moderation_report(
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
  on conflict (reporter_id, target_type, target_id) where status in ('open', 'reviewed')
  do update set reason = excluded.reason, detail = excluded.detail
  returning * into v_report;
  return jsonb_build_object('id', v_report.id, 'status', v_report.status);
end;
$$;
revoke all on function public.moderation_report(text, uuid, text, text) from public, anon;
grant execute on function public.moderation_report(text, uuid, text, text) to authenticated;
