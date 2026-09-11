-- #1619: append-only retained-surface cutover. Deploy with adapter cutover.
-- Bounds below are operational pagination, NOT a copyright safe-harbor.
create or replace function public.sentence_public_allowed(p_sentence_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.sentences s join public.user_books ub
  on ub.id=s.user_book_id and ub.user_id=s.user_id
  where s.id=p_sentence_id and public.book_public_allowed(ub.id)
  and not exists(select 1 from public.moderation_hidden_sentences h where h.sentence_id=s.id)
  and not exists(select 1 from public.moderation_reports r where r.reporter_id=auth.uid()
   and r.target_type='sentence' and r.target_id=s.id and r.status<>'dismissed'));
$$;
revoke all on function public.sentence_public_allowed(uuid) from public,anon;
grant execute on function public.sentence_public_allowed(uuid) to authenticated;

-- Personal sessions and aggregate streak are never public book projections.
drop policy if exists session_owner_fence on public.reading_sessions;
create policy session_owner_fence on public.reading_sessions as restrictive for all to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists streak_owner_fence on public.streak;
create policy streak_owner_fence on public.streak as restrictive for select to authenticated using(user_id=auth.uid());
revoke select on public.reading_sessions,public.streak from anon;
create or replace function public.session_parent_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.user_books ub where ub.id=new.user_book_id and ub.user_id=new.user_id)
 or (auth.uid() is not null and new.user_id<>auth.uid()) then
  raise exception 'session_parent_unavailable' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists session_parent_guard on public.reading_sessions;
create trigger session_parent_guard before insert or update on public.reading_sessions
 for each row execute function public.session_parent_guard();

-- Trigger precedes FK/uniqueness checks: missing/private/hidden targets share one error.
create or replace function public.clap_parent_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.user_books ub join public.sentences s on s.user_book_id=ub.id
 where s.id=new.to_sentence_id for share of ub,s;
 if auth.uid() is null or new.from_user_id<>auth.uid()
 or not public.moderation_terms_accepted(auth.uid())
 or public.moderation_user_suspended(auth.uid())
 or not public.sentence_public_allowed(new.to_sentence_id) then
  raise exception 'clap_target_unavailable' using errcode='42501'; end if;
 return new;
end $$;
drop trigger if exists clap_parent_guard on public.claps;
create trigger clap_parent_guard before insert or update on public.claps
 for each row execute function public.clap_parent_guard();
drop policy if exists clap_public_fence on public.claps;
create policy clap_public_fence on public.claps as restrictive for select to authenticated
 using(public.sentence_public_allowed(to_sentence_id));
revoke select on public.claps from anon;

create or replace function public.social_newcomers_weekly(lim int default 3)
returns table(book_id uuid,title text,author text,cover_url text,starters bigint)
language sql stable security definer set search_path=public,pg_temp as $$
 select ub.book_id,b.title,b.author,b.cover_url,count(distinct ub.user_id)
 from public.user_books ub join public.books b on b.id=ub.book_id
 where ub.started_at>=now()-interval '7 days' and public.book_public_allowed(ub.id)
 group by ub.book_id,b.title,b.author,b.cover_url
 order by count(distinct ub.user_id) desc,max(ub.started_at) desc,ub.book_id
 limit least(50,greatest(1,coalesce(lim,3)));
$$;
revoke all on function public.social_newcomers_weekly(integer) from public;
grant execute on function public.social_newcomers_weekly(integer) to anon,authenticated;

-- Minimal parent-aware projection; deliberately excludes my_note/session/internal state.
create or replace function public.sentence_public(p_sentence_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',s.id,'userId',s.user_id,'userBookId',s.user_book_id,
  'bookId',ub.book_id,'page',s.page,'text',s.text,'thought',s.publishable_thought,
  'createdAt',s.created_at,'parent',public.book_public(ub.id))
 from public.sentences s join public.user_books ub on ub.id=s.user_book_id and ub.user_id=s.user_id
 where s.id=p_sentence_id and public.sentence_public_allowed(s.id);
$$;
create or replace function public.sentences_public_feed(
 p_book_id uuid default null,p_owner_id uuid default null,p_limit integer default 20,p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.sentence_public(s.id)
 from public.sentences s join public.user_books ub on ub.id=s.user_book_id and ub.user_id=s.user_id
 where (p_book_id is null or ub.book_id=p_book_id) and (p_owner_id is null or ub.user_id=p_owner_id)
 and public.sentence_public_allowed(s.id)
 order by s.created_at desc,s.id desc
 limit least(50,greatest(1,coalesce(p_limit,20))) offset least(10000,greatest(0,coalesce(p_offset,0)));
$$;
create or replace function public.user_books_public(p_owner_id uuid,p_limit integer default 20,p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select public.book_public(ub.id) from public.user_books ub
 where ub.user_id=p_owner_id and public.book_public_allowed(ub.id)
 order by ub.id
 limit least(50,greatest(1,coalesce(p_limit,20))) offset least(10000,greatest(0,coalesce(p_offset,0)));
$$;
-- Existing quote reader is bounded too; feed provides explicit continuation.
create or replace function public.book_public_quotes(p_user_book_id uuid,p_sentence_id uuid default null)
returns table(id uuid,user_book_id uuid,page integer,text text,thought text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.id,s.user_book_id,s.page,s.text,s.publishable_thought,s.created_at
 from public.sentences s where s.user_book_id=p_user_book_id
 and (p_sentence_id is null or s.id=p_sentence_id) and public.sentence_public_allowed(s.id)
 order by s.created_at,s.id limit 50;
$$;
revoke all on function public.sentence_public(uuid),public.sentences_public_feed(uuid,uuid,integer,integer),
 public.user_books_public(uuid,integer,integer) from public;
grant execute on function public.sentence_public(uuid),public.sentences_public_feed(uuid,uuid,integer,integer),
 public.user_books_public(uuid,integer,integer) to anon,authenticated;

-- All inbox/count/mark paths already share this revoked internal projection.
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
      and public.sentence_public_allowed(s.id)
      and c.created_at >= statement_timestamp() - interval '90 days'
      and not exists (select 1 from public.moderation_hidden_sentences h where h.sentence_id = s.id)

    union all

    select
      'follow'::text,
      null::uuid,
      ('follow:' || encode(extensions.digest(
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


-- UUID report paths must not reveal private sentence/story existence.
create or replace function public.moderation_report(p_target_type text, p_target_id uuid, p_reason text, p_detail text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid:=auth.uid(); v_owner uuid; v_report public.moderation_reports;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_target_type not in ('sentence','user','story') then raise exception 'invalid_target_type' using errcode='22023'; end if;
  if p_reason not in ('sexual','violence','hate_or_harassment','spam','illegal','other') then raise exception 'invalid_reason' using errcode='22023'; end if;
  if p_detail is not null and char_length(p_detail)>500 then raise exception 'detail_too_long' using errcode='22001'; end if;
  if (select count(*) from public.moderation_reports where reporter_id=v_uid and created_at>now()-interval '1 hour')>=20 then
    raise exception 'report_rate_limited' using errcode='P0001'; end if;
  if p_target_type='sentence' then select user_id into v_owner from public.sentences where id=p_target_id and public.sentence_public_allowed(id);
  elsif p_target_type='story' then select user_id into v_owner from public.reading_stories where id=p_target_id and public.reading_story_public(slug) is not null;
  else select id into v_owner from public.users where id=p_target_id; end if;
  if v_owner is null then raise exception 'target_not_found' using errcode='P0002'; end if;
  if v_owner=v_uid then raise exception 'cannot_report_self' using errcode='22023'; end if;
  insert into public.moderation_reports(reporter_id,target_type,target_id,reason,detail)
  values(v_uid,p_target_type,p_target_id,p_reason,nullif(btrim(p_detail),''))
  on conflict (reporter_id,target_type,target_id) where status in ('open','reviewed')
  do update set reason=excluded.reason,detail=excluded.detail returning * into v_report;
  return jsonb_build_object('id',v_report.id,'status',v_report.status);
end $$;
revoke all on function public.moderation_report(text, uuid, text, text) from public, anon;
grant execute on function public.moderation_report(text, uuid, text, text) to authenticated;


revoke all on function public.session_parent_guard(), public.clap_parent_guard() from public,anon,authenticated;
-- Slug reporting shares the current parent/explicit-thought projection, not legacy flags.
create or replace function public.reading_story_report(p_slug text,p_reason text,p_detail text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if public.reading_story_public(p_slug) is null then
  raise exception 'target_not_found' using errcode='P0002'; end if;
 select id into v_id from public.reading_stories where slug=p_slug;
 return public.moderation_report('story',v_id,p_reason,p_detail);
end $$;
revoke all on function public.reading_story_report(text,text,text) from public,anon;
grant execute on function public.reading_story_report(text,text,text) to authenticated;
