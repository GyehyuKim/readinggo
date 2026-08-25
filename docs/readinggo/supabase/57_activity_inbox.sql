-- 57_activity_inbox.sql
-- #1260: 현재 clap/follow/poke를 합친 인증 전용 활동함과 bounded seen-key 상태.

create table if not exists public.activity_inbox_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  seen_event_keys text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  constraint activity_inbox_seen_keys_bounded check (cardinality(seen_event_keys) <= 100),
  constraint activity_inbox_seen_keys_valid check (
    array_position(seen_event_keys, null) is null
    and not (seen_event_keys @> array['']::text[])
  )
);

alter table public.activity_inbox_state enable row level security;
drop policy if exists activity_inbox_state_select_own on public.activity_inbox_state;
create policy activity_inbox_state_select_own on public.activity_inbox_state
  for select using (user_id = auth.uid());
revoke all on public.activity_inbox_state from public, anon, authenticated;
grant select on public.activity_inbox_state to authenticated;

-- 내부 projection. 직접 실행 권한은 주지 않고 세 공개 RPC만 이 함수를 호출한다.
create or replace function public.activity_inbox_projection(p_viewer uuid)
returns table (
  kind text,
  event_id uuid,
  event_key text,
  occurred_at timestamptz,
  actor_id uuid,
  actor_display_name text,
  actor_handle text,
  actor_avatar_url text,
  sentence_id uuid,
  sentence_text text,
  sentence_page integer,
  book_id uuid,
  book_title text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with candidates as (
    select
      'clap'::text as kind,
      c.id as event_id,
      ('clap:' || c.id::text)::text as event_key,
      c.created_at as occurred_at,
      c.from_user_id as actor_id,
      s.id as sentence_id,
      s.text as sentence_text,
      s.page as sentence_page,
      ub.book_id,
      b.title as book_title
    from public.claps c
    join public.sentences s on s.id = c.to_sentence_id and s.user_id = p_viewer
    join public.user_books ub on ub.id = s.user_book_id and ub.user_id = p_viewer
    join public.books b on b.id = ub.book_id
    where c.from_user_id <> p_viewer
      and c.created_at >= statement_timestamp() - interval '90 days'
      and not exists (select 1 from public.moderation_hidden_sentences h where h.sentence_id = s.id)

    union all

    select
      'follow'::text,
      null::uuid,
      ('follow:' || encode(digest(
        f.follower_id::text || ':' || f.following_id::text || ':' ||
        to_char(f.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'sha256'
      ), 'hex'))::text,
      f.created_at,
      f.follower_id,
      null::uuid, null::text, null::integer, null::uuid, null::text
    from public.follows f
    where f.following_id = p_viewer
      and f.follower_id <> p_viewer
      and f.created_at >= statement_timestamp() - interval '90 days'

    union all

    select
      'poke'::text,
      p.id,
      ('poke:' || p.id::text)::text,
      p.created_at,
      p.from_user_id,
      null::uuid, null::text, null::integer, null::uuid, null::text
    from public.pokes p
    where p.to_user_id = p_viewer
      and p.from_user_id <> p_viewer
      and p.created_at >= statement_timestamp() - interval '90 days'
  ), visible as (
    select c.*, u.display_name, u.handle, u.avatar_url
    from candidates c
    join public.users u on u.id = c.actor_id
    where not exists (
      select 1 from public.moderation_suspended_users x where x.user_id = c.actor_id
    )
    and not exists (
      select 1 from public.user_blocks bl
      where (bl.blocker_id = p_viewer and bl.blocked_id = c.actor_id)
         or (bl.blocker_id = c.actor_id and bl.blocked_id = p_viewer)
    )
  )
  select
    v.kind, v.event_id, v.event_key, v.occurred_at,
    v.actor_id, v.display_name, v.handle, v.avatar_url,
    v.sentence_id, v.sentence_text, v.sentence_page, v.book_id, v.book_title
  from visible v
  order by v.occurred_at desc, v.kind asc, v.event_key asc
  limit 100;
$$;
revoke all on function public.activity_inbox_projection(uuid) from public, anon, authenticated;

create or replace function public.activity_inbox()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_seen text[] := '{}'::text[];
  v_items jsonb;
  v_unread integer;
begin
  if v_uid is null then raise exception 'activity_inbox_forbidden' using errcode = '42501'; end if;
  select coalesce((
    select s.seen_event_keys from public.activity_inbox_state s where s.user_id = v_uid
  ), '{}'::text[]) into v_seen;

  with projection as (select * from public.activity_inbox_projection(v_uid))
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'kind', p.kind,
      'eventId', p.event_id,
      'eventKey', p.event_key,
      'occurredAt', p.occurred_at,
      'isUnread', not (p.event_key = any(v_seen)),
      'actor', jsonb_build_object(
        'id', p.actor_id, 'displayName', p.actor_display_name,
        'handle', p.actor_handle, 'avatarUrl', p.actor_avatar_url
      ),
      'sentence', case when p.kind = 'clap' then jsonb_build_object(
        'id', p.sentence_id, 'text', p.sentence_text, 'page', p.sentence_page,
        'bookId', p.book_id, 'bookTitle', p.book_title
      ) else null end
    ) order by p.occurred_at desc, p.kind asc, p.event_key asc), '[]'::jsonb),
    count(*) filter (where not (p.event_key = any(v_seen)))::integer
  into v_items, v_unread
  from projection p;

  return jsonb_build_object('items', v_items, 'unreadCount', coalesce(v_unread, 0));
end;
$$;
revoke all on function public.activity_inbox() from public, anon;
grant execute on function public.activity_inbox() to authenticated;

create or replace function public.activity_inbox_unread_count()
returns integer
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_seen text[] := '{}'::text[];
  v_count integer;
begin
  if v_uid is null then raise exception 'activity_inbox_forbidden' using errcode = '42501'; end if;
  select coalesce((
    select s.seen_event_keys from public.activity_inbox_state s where s.user_id = v_uid
  ), '{}'::text[]) into v_seen;
  select count(*)::integer into v_count
    from public.activity_inbox_projection(v_uid) p
    where not (p.event_key = any(v_seen));
  return coalesce(v_count, 0);
end;
$$;
revoke all on function public.activity_inbox_unread_count() from public, anon;
grant execute on function public.activity_inbox_unread_count() to authenticated;

create or replace function public.activity_inbox_mark_seen(p_event_keys text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_requested text[];
  v_seen text[] := '{}'::text[];
  v_unread integer;
begin
  if v_uid is null then raise exception 'activity_inbox_forbidden' using errcode = '42501'; end if;
  if p_event_keys is null or cardinality(p_event_keys) > 100
     or array_position(p_event_keys, null) is not null
     or exists (select 1 from unnest(p_event_keys) k where btrim(k) = '') then
    raise exception 'activity_inbox_invalid_keys' using errcode = '22023';
  end if;

  select coalesce(array_agg(k order by k), '{}'::text[]) into v_requested
  from (select distinct btrim(k) as k from unnest(p_event_keys) k) deduped;

  insert into public.activity_inbox_state(user_id, seen_event_keys, updated_at)
  select
    v_uid,
    coalesce(array_agg(p.event_key order by p.occurred_at desc, p.kind asc, p.event_key asc), '{}'::text[]),
    statement_timestamp()
  from public.activity_inbox_projection(v_uid) p
  where p.event_key = any(v_requested)
  on conflict (user_id) do update set
    seen_event_keys = (
      select coalesce(array_agg(p.event_key order by p.occurred_at desc, p.kind asc, p.event_key asc), '{}'::text[])
      from public.activity_inbox_projection(v_uid) p
      where p.event_key = any(
        select distinct merged.key
        from unnest(public.activity_inbox_state.seen_event_keys || excluded.seen_event_keys) as merged(key)
      )
    ),
    updated_at = statement_timestamp();

  select s.seen_event_keys into v_seen
    from public.activity_inbox_state s where s.user_id = v_uid;
  v_seen := coalesce(v_seen, '{}'::text[]);
  select count(*)::integer into v_unread
  from public.activity_inbox_projection(v_uid) p
  where not (p.event_key = any(v_seen));
  return jsonb_build_object('unreadCount', coalesce(v_unread, 0));
end;
$$;
revoke all on function public.activity_inbox_mark_seen(text[]) from public, anon;
grant execute on function public.activity_inbox_mark_seen(text[]) to authenticated;
