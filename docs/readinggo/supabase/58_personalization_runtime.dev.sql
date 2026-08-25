-- 58_personalization_runtime.dev.sql — #1309 DEV-only personalization controls/runtime
-- Apply only to the DEV Supabase project before #1373 UAT. Production remains fail-closed.

create table if not exists public.personalization_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null default '2026-08-25',
  enabled boolean not null default false,
  consent_generation bigint not null default 0 check (consent_generation >= 0),
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoke_pending_generation bigint,
  updated_at timestamptz not null default now(),
  check ((enabled and accepted_at is not null and revoked_at is null and revoke_pending_generation is null)
    or (not enabled))
);

create table if not exists public.personalization_source_exclusions (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('sentence','note','qa')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_type, source_id)
);

create table if not exists public.personalization_dispatch_leases (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_generation bigint not null,
  acquired_at timestamptz not null default now(),
  cancel_requested boolean not null default false
);
create index if not exists personalization_dispatch_leases_owner_idx
  on public.personalization_dispatch_leases(user_id, consent_generation);

alter table public.personalization_controls enable row level security;
alter table public.personalization_source_exclusions enable row level security;
alter table public.personalization_dispatch_leases enable row level security;

-- Tables are server-only: not even owners receive direct CRUD. All access is through owner-bound RPCs.
revoke all on public.personalization_controls from anon, authenticated;
revoke all on public.personalization_source_exclusions from anon, authenticated;
revoke all on public.personalization_dispatch_leases from anon, authenticated;

create or replace function public.personalization_control_read()
returns table(owner_id uuid, policy_version text, enabled boolean, consent_generation bigint,
  accepted_at timestamptz, revoked_at timestamptz, revoke_pending_generation bigint)
language sql security definer set search_path = public, pg_temp stable
as $$
  select c.user_id, c.policy_version,
    (c.enabled and c.policy_version = '2026-08-25' and c.accepted_at is not null and c.revoked_at is null
      and c.revoke_pending_generation is null),
    c.consent_generation, c.accepted_at, c.revoked_at, c.revoke_pending_generation
  from public.personalization_controls c where c.user_id = auth.uid()
  union all
  select auth.uid(), '2026-08-25', false, 0, null, null, null
  where auth.uid() is not null and not exists (
    select 1 from public.personalization_controls c where c.user_id = auth.uid()
  ) limit 1;
$$;

create or replace function public.personalization_opt_in(p_expected_owner uuid)
returns table(owner_id uuid, policy_version text, enabled boolean, consent_generation bigint,
  accepted_at timestamptz, revoked_at timestamptz, revoke_pending_generation bigint)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if auth.uid() is distinct from p_expected_owner then raise exception 'session_changed' using errcode='42501'; end if;
  insert into public.personalization_controls(user_id, policy_version, enabled, consent_generation, accepted_at, revoked_at, revoke_pending_generation, updated_at)
    values(auth.uid(), '2026-08-25', true, 1, clock_timestamp(), null, null, clock_timestamp())
  on conflict(user_id) do update set policy_version='2026-08-25', enabled=true,
    consent_generation=personalization_controls.consent_generation+1,
    accepted_at=clock_timestamp(), revoked_at=null, revoke_pending_generation=null, updated_at=clock_timestamp()
    where personalization_controls.revoke_pending_generation is null;
  if not found then raise exception 'revoke_pending' using errcode='P0001'; end if;
  return query select * from public.personalization_control_read();
end $$;

create or replace function public.personalization_revoke_start(p_expected_owner uuid)
returns table(owner_id uuid, consent_generation bigint, status text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare g bigint;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if auth.uid() is distinct from p_expected_owner then raise exception 'session_changed' using errcode='42501'; end if;
  insert into public.personalization_controls(user_id, policy_version, enabled, consent_generation, revoked_at, revoke_pending_generation, updated_at)
    values(auth.uid(),'2026-08-25',false,1,clock_timestamp(),1,clock_timestamp())
  on conflict(user_id) do update set enabled=false,
    consent_generation=personalization_controls.consent_generation+1,
    revoked_at=clock_timestamp(), revoke_pending_generation=personalization_controls.consent_generation+1,
    updated_at=clock_timestamp()
  returning personalization_controls.consent_generation into g;
  update public.personalization_dispatch_leases set cancel_requested=true
    where user_id=auth.uid() and consent_generation < g;
  return query select auth.uid(), g, 'pending'::text;
end $$;

create or replace function public.personalization_revoke_finalize(p_generation bigint, p_expected_owner uuid)
returns table(owner_id uuid, consent_generation bigint, status text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare changed int;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if auth.uid() is distinct from p_expected_owner then raise exception 'session_changed' using errcode='42501'; end if;
  if exists(select 1 from public.personalization_dispatch_leases
      where user_id=auth.uid() and consent_generation < p_generation
        and acquired_at > now() - interval '2 minutes')
    then return query select auth.uid(), p_generation, 'pending'::text; return; end if;
  update public.personalization_controls set revoke_pending_generation=null, updated_at=clock_timestamp()
    where user_id=auth.uid() and enabled=false and consent_generation=p_generation and revoke_pending_generation=p_generation;
  get diagnostics changed = row_count;
  return query select auth.uid(), p_generation, case when changed=1 then 'finalized' else 'superseded' end;
end $$;

create or replace function public.personalization_source_set_excluded(
  p_source_type text, p_source_id uuid, p_excluded boolean, p_expected_owner uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if auth.uid() is distinct from p_expected_owner then raise exception 'session_changed' using errcode='42501'; end if;
  if p_source_type not in ('sentence','note','qa') then raise exception 'invalid source type'; end if;
  -- sentence/note/qa는 같은 sentence row를 source identity로 사용한다. 한 문장의 여러
  -- 블록을 별도 record처럼 부풀리지 않으며, type+sentence ID만 제외 목록에 저장한다.
  -- Do not reveal whether another owner's UUID exists.
  if not exists(select 1 from public.sentences s where s.id=p_source_id and s.user_id=auth.uid()) then return false; end if;
  if p_excluded then
    insert into public.personalization_source_exclusions(user_id,source_type,source_id)
      values(auth.uid(),p_source_type,p_source_id) on conflict do nothing;
  else
    delete from public.personalization_source_exclusions where user_id=auth.uid() and source_type=p_source_type and source_id=p_source_id;
  end if;
  return true;
end $$;

create or replace function public.personalization_source_exclusions_read()
returns table(source_type text, source_id uuid, book_id uuid, title text, preview text)
language sql security definer set search_path = public, pg_temp stable
as $$
  select x.source_type, x.source_id, ub.book_id, b.title,
    left(case when x.source_type='sentence' then s.text else coalesce(nullif(s.my_note,''),s.text) end,120) preview
  from public.personalization_source_exclusions x
  join public.sentences s on s.id=x.source_id and s.user_id=auth.uid()
  join public.user_books ub on ub.id=s.user_book_id and ub.user_id=auth.uid()
  join public.books b on b.id=ub.book_id
  where x.user_id=auth.uid()
  order by x.created_at desc, x.source_id;
$$;

create or replace function public.personalization_context_validate(p_current_sentence_id uuid, p_book_id uuid)
returns boolean language sql security definer set search_path = public, pg_temp stable
as $$ select exists(
  select 1
  from public.sentences s
  join public.user_books ub on ub.id=s.user_book_id and ub.user_id=auth.uid()
  where s.id=p_current_sentence_id and s.user_id=auth.uid() and ub.book_id=p_book_id
) $$;

create or replace function public.personalization_retrieve(p_current_sentence_id uuid, p_book_id uuid, p_query_text text, p_preset text)
returns table(type text,id uuid,book_id uuid,page int,created_at timestamptz,title text,author text,status text,preview text,text text,score int)
language sql security definer set search_path = public, pg_temp stable
as $$
  with ctl as (
    select consent_generation from public.personalization_controls where user_id=auth.uid()
      and policy_version='2026-08-25' and enabled and accepted_at is not null and revoked_at is null and revoke_pending_generation is null
  ), words as (
    select distinct lower(w) word from regexp_split_to_table(left(coalesce(p_query_text,''),2000), E'[^[:alnum:]가-힣]+') w where length(w)>=2 limit 64
  ), owned as (
    select s.*, ub.book_id, ub.status, b.title, coalesce(b.author,'') author,
      case
        when btrim(coalesce(s.my_note,''))='' then 'sentence'::text
        when coalesce(s.my_note,'') ~ '(^|\n\n)Q\.\s' then 'qa'::text
        else 'note'::text
      end source_type
    from ctl, public.sentences s
    join public.user_books ub on ub.id=s.user_book_id and ub.user_id=auth.uid()
    join public.books b on b.id=ub.book_id
    where s.user_id=auth.uid() and s.id is distinct from p_current_sentence_id and btrim(s.text)<>''
  ), candidates as (
    select o.source_type type,o.id,o.book_id,o.page,o.created_at,o.title,o.author,o.status,
      case when o.source_type='sentence' then '' else left(o.text,180) end preview,
      case when o.source_type='sentence' then o.text else o.my_note end text,
      (case when o.book_id=p_book_id then 100 else 0 end
       + 10*(select count(*) from words where lower(o.text||' '||coalesce(o.my_note,'')||' '||o.title||' '||o.author) like '%'||word||'%')
       + greatest(0,30-least(30,(extract(epoch from (clock_timestamp()-o.created_at))/86400)::int)))::int score
    from owned o
    where not exists(select 1 from public.personalization_source_exclusions x
      where x.user_id=auth.uid() and x.source_type=o.source_type and x.source_id=o.id)
  ) select * from candidates order by score desc, created_at desc, id limit 6;
$$;

create or replace function public.personalization_lease_acquire(p_request_id uuid, p_generation bigint)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return false; end if;
  -- Serialize lease insertion with revoke_start's UPDATE of the same control row.
  -- Either the lease commits before revoke scans/cancels it, or acquire observes
  -- the post-revoke disabled generation and fails before provider dispatch.
  perform 1 from public.personalization_controls
    where user_id=auth.uid() and policy_version='2026-08-25'
      and enabled and accepted_at is not null and revoked_at is null
      and revoke_pending_generation is null and consent_generation=p_generation
    for update;
  if not found then return false; end if;
  delete from public.personalization_dispatch_leases
    where user_id=auth.uid() and acquired_at <= now() - interval '2 minutes';
  insert into public.personalization_dispatch_leases(request_id,user_id,consent_generation)
    values(p_request_id,auth.uid(),p_generation) on conflict do nothing;
  return found;
end $$;

create or replace function public.personalization_lease_validate(p_request_id uuid, p_generation bigint)
returns boolean language sql security definer set search_path = public, pg_temp stable
as $$ select exists(
  select 1 from public.personalization_dispatch_leases l join public.personalization_controls c on c.user_id=l.user_id
  where l.request_id=p_request_id and l.user_id=auth.uid() and l.consent_generation=p_generation and not l.cancel_requested
    and l.acquired_at > now() - interval '2 minutes'
    and c.enabled and c.revoke_pending_generation is null and c.consent_generation=p_generation and c.policy_version='2026-08-25'
) $$;

create or replace function public.personalization_lease_release(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$ begin delete from public.personalization_dispatch_leases where request_id=p_request_id and user_id=auth.uid(); return found; end $$;

create or replace function public.personalization_lease_count(p_before_generation bigint)
returns bigint language sql security definer set search_path = public, pg_temp stable
as $$ select count(*) from public.personalization_dispatch_leases
  where user_id=auth.uid() and consent_generation < p_before_generation
    and acquired_at > now() - interval '2 minutes' $$;

revoke all on function public.personalization_control_read() from public, anon;
revoke all on function public.personalization_opt_in() from public, anon;
revoke all on function public.personalization_revoke_start() from public, anon;
revoke all on function public.personalization_revoke_finalize(bigint) from public, anon;
revoke all on function public.personalization_source_set_excluded(text,uuid,boolean) from public, anon;
revoke all on function public.personalization_source_exclusions_read() from public, anon;
revoke all on function public.personalization_context_validate(uuid,uuid) from public, anon;
revoke all on function public.personalization_retrieve(uuid,uuid,text,text) from public, anon;
revoke all on function public.personalization_lease_acquire(uuid,bigint) from public, anon;
revoke all on function public.personalization_lease_validate(uuid,bigint) from public, anon;
revoke all on function public.personalization_lease_release(uuid) from public, anon;
revoke all on function public.personalization_lease_count(bigint) from public, anon;
grant execute on function public.personalization_control_read() to authenticated;
grant execute on function public.personalization_opt_in() to authenticated;
grant execute on function public.personalization_revoke_start() to authenticated;
grant execute on function public.personalization_revoke_finalize(bigint) to authenticated;
grant execute on function public.personalization_source_set_excluded(text,uuid,boolean) to authenticated;
grant execute on function public.personalization_source_exclusions_read() to authenticated;
grant execute on function public.personalization_context_validate(uuid,uuid) to authenticated;
grant execute on function public.personalization_retrieve(uuid,uuid,text,text) to authenticated;
grant execute on function public.personalization_lease_acquire(uuid,bigint) to authenticated;
grant execute on function public.personalization_lease_validate(uuid,bigint) to authenticated;
grant execute on function public.personalization_lease_release(uuid) to authenticated;
grant execute on function public.personalization_lease_count(bigint) to authenticated;
