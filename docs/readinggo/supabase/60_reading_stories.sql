-- 60_reading_stories.sql
-- #1590 Phase 2: 완독 독서 이야기 저장, 발행, 공개 조회와 moderation 경계.
-- 공개 RPC는 snapshot을 권한 근거로 사용하지 않고 모든 호출에서 원본을 다시 검사한다.

create extension if not exists pgcrypto;

create table if not exists public.reading_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  book_id uuid not null references public.books(id),
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'unpublished')),
  title text,
  intro text,
  outro text,
  cover_sentence_id uuid references public.sentences(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_book_id),
  constraint reading_stories_slug_unguessable
    check (slug ~ '^[0-9a-f]{36}$'),
  constraint reading_stories_title_length
    check (title is null or char_length(title) <= 200),
  constraint reading_stories_intro_length
    check (intro is null or char_length(intro) <= 1200),
  constraint reading_stories_outro_length
    check (outro is null or char_length(outro) <= 1200),
  constraint reading_stories_publish_timestamp check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

create table if not exists public.reading_story_pages (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.reading_stories(id) on delete cascade,
  position integer not null check (position between 0 and 19),
  type text not null check (type in ('intro', 'quote', 'note', 'review', 'outro')),
  sentence_id uuid references public.sentences(id) on delete set null,
  snapshot_text text,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, position),
  constraint reading_story_pages_shape check (
    (type in ('quote', 'note') and snapshot_text is null)
    or (type in ('intro', 'review', 'outro') and sentence_id is null
      and snapshot_text is not null and char_length(btrim(snapshot_text)) between 1 and 1200)
  ),
  constraint reading_story_pages_cover_quote check (not is_cover or type = 'quote')
);

create unique index if not exists reading_story_pages_one_cover
  on public.reading_story_pages (story_id) where is_cover;
create index if not exists reading_story_pages_story_position
  on public.reading_story_pages (story_id, position);
create index if not exists reading_story_pages_sentence
  on public.reading_story_pages (sentence_id) where sentence_id is not null;

create table if not exists public.moderation_hidden_stories (
  story_id uuid primary key references public.reading_stories(id) on delete cascade,
  report_id uuid null references public.moderation_reports(id),
  hidden_by uuid not null references public.users(id),
  reason text null check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.reading_stories enable row level security;
alter table public.reading_story_pages enable row level security;
alter table public.moderation_hidden_stories enable row level security;

drop policy if exists reading_stories_select_own on public.reading_stories;
create policy reading_stories_select_own on public.reading_stories
  for select using (user_id = auth.uid());
drop policy if exists reading_story_pages_select_own on public.reading_story_pages;
create policy reading_story_pages_select_own on public.reading_story_pages
  for select using (exists (
    select 1 from public.reading_stories s
    where s.id = story_id and s.user_id = auth.uid()
  ));
drop policy if exists moderation_hidden_stories_admin on public.moderation_hidden_stories;
create policy moderation_hidden_stories_admin on public.moderation_hidden_stories
  for all using (public.is_admin()) with check (public.is_admin());

-- PostgREST 역할에는 base table 권한을 주지 않는다. 소유자 mutation도 RPC만 통과한다.
revoke all on public.reading_stories from public, anon, authenticated;
revoke all on public.reading_story_pages from public, anon, authenticated;
revoke all on public.moderation_hidden_stories from public, anon, authenticated;

drop function if exists public.reading_story_save_draft(uuid, jsonb);
create function public.reading_story_save_draft(p_user_book_id uuid, p_pages jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_book_id uuid;
  v_story public.reading_stories;
  v_page jsonb;
  v_type text;
  v_sentence_id uuid;
  v_text text;
  v_is_cover boolean;
  v_position integer := 0;
  v_page_count integer;
  v_quote_count integer;
  v_cover_count integer;
begin
  if v_uid is null then
    raise exception 'reading_story_authentication_required' using errcode = '42501';
  end if;
  if p_pages is null or jsonb_typeof(p_pages) <> 'array' then
    raise exception 'reading_story_pages_must_be_array' using errcode = '22023';
  end if;
  v_page_count := jsonb_array_length(p_pages);
  if v_page_count > 20 then
    raise exception 'reading_story_page_limit' using errcode = '22023';
  end if;

  select ub.book_id into v_book_id
  from public.user_books ub
  where ub.id = p_user_book_id and ub.user_id = v_uid and ub.status = 'completed';
  if v_book_id is null then
    raise exception 'reading_story_completed_book_required' using errcode = '42501';
  end if;

  select count(*) filter (where item->>'type' = 'quote'),
         count(*) filter (where item ? 'isCover' and jsonb_typeof(item->'isCover') = 'boolean'
           and (item->>'isCover')::boolean)
    into v_quote_count, v_cover_count
  from jsonb_array_elements(p_pages) item;
  if v_quote_count > 8 then raise exception 'reading_story_quote_limit' using errcode = '22023'; end if;
  if v_cover_count > 1 then raise exception 'reading_story_cover_limit' using errcode = '22023'; end if;

  -- ON CONFLICT serializes concurrent saves for the canonical user_book story.
  insert into public.reading_stories(user_id, user_book_id, book_id, slug, status, updated_at)
  values (v_uid, p_user_book_id, v_book_id, encode(gen_random_bytes(18), 'hex'), 'draft', now())
  on conflict (user_book_id) do update set
    book_id = excluded.book_id,
    status = 'draft',
    published_at = null,
    updated_at = now()
  where public.reading_stories.user_id = v_uid
  returning * into v_story;
  if v_story.id is null then raise exception 'reading_story_owner_required' using errcode = '42501'; end if;

  delete from public.reading_story_pages where story_id = v_story.id;
  for v_page in select value from jsonb_array_elements(p_pages) with ordinality as p(value, ord) order by ord loop
    if jsonb_typeof(v_page) <> 'object'
       or exists (select 1 from jsonb_object_keys(v_page) k
                  where k not in ('type', 'sentenceId', 'text', 'isCover')) then
      raise exception 'reading_story_invalid_page_shape' using errcode = '22023';
    end if;
    if jsonb_typeof(v_page->'type') <> 'string'
       or (v_page ? 'sentenceId' and jsonb_typeof(v_page->'sentenceId') <> 'string')
       or (v_page ? 'text' and jsonb_typeof(v_page->'text') <> 'string')
       or (v_page ? 'isCover' and jsonb_typeof(v_page->'isCover') <> 'boolean') then
      raise exception 'reading_story_invalid_page_types' using errcode = '22023';
    end if;

    v_type := v_page->>'type';
    v_sentence_id := null;
    v_text := null;
    v_is_cover := coalesce((v_page->>'isCover')::boolean, false);
    if v_type not in ('intro', 'quote', 'note', 'review', 'outro') then
      raise exception 'reading_story_invalid_page_type' using errcode = '22023';
    end if;

    if v_type in ('quote', 'note') then
      if not (v_page ? 'sentenceId') or v_page ? 'text' then
        raise exception 'reading_story_sentence_page_shape' using errcode = '22023';
      end if;
      begin v_sentence_id := (v_page->>'sentenceId')::uuid;
      exception when invalid_text_representation then
        raise exception 'reading_story_invalid_sentence_id' using errcode = '22023';
      end;
      if not exists (
        select 1 from public.sentences s
        where s.id = v_sentence_id and s.user_id = v_uid and s.user_book_id = p_user_book_id
      ) then
        raise exception 'reading_story_sentence_mismatch' using errcode = '42501';
      end if;
    else
      if v_page ? 'sentenceId' or not (v_page ? 'text') or v_is_cover then
        raise exception 'reading_story_text_page_shape' using errcode = '22023';
      end if;
      v_text := btrim(v_page->>'text');
      if char_length(v_text) not between 1 and 1200 then
        raise exception 'reading_story_text_length' using errcode = '22023';
      end if;
    end if;

    if v_is_cover and v_type <> 'quote' then
      raise exception 'reading_story_cover_must_be_quote' using errcode = '22023';
    end if;
    insert into public.reading_story_pages(story_id, position, type, sentence_id, snapshot_text, is_cover)
    values (v_story.id, v_position, v_type, v_sentence_id, v_text, v_is_cover);
    v_position := v_position + 1;
  end loop;

  update public.reading_stories s set
    intro = (select p.snapshot_text from public.reading_story_pages p where p.story_id=s.id and p.type='intro' order by p.position limit 1),
    outro = (select p.snapshot_text from public.reading_story_pages p where p.story_id=s.id and p.type='outro' order by p.position limit 1),
    cover_sentence_id = (select p.sentence_id from public.reading_story_pages p where p.story_id=s.id and p.is_cover limit 1),
    updated_at = now()
  where s.id = v_story.id
  returning * into v_story;

  return jsonb_build_object('id', v_story.id, 'userBookId', v_story.user_book_id,
    'slug', v_story.slug, 'status', v_story.status, 'updatedAt', v_story.updated_at);
end;
$$;
revoke all on function public.reading_story_save_draft(uuid, jsonb) from public, anon;
grant execute on function public.reading_story_save_draft(uuid, jsonb) to authenticated;

drop function if exists public.reading_story_owner(uuid);
create function public.reading_story_owner(p_user_book_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_story public.reading_stories;
  v_pages jsonb;
begin
  if v_uid is null then
    raise exception 'reading_story_authentication_required' using errcode = '42501';
  end if;
  select s.* into v_story
  from public.reading_stories s
  where s.user_book_id = p_user_book_id and s.user_id = v_uid;
  if v_story.id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'type', p.type,
    'position', p.position,
    'sentenceId', p.sentence_id,
    'text', case when p.type = 'quote' then s.text
                 when p.type = 'note' then s.my_note
                 else p.snapshot_text end,
    'isCover', p.is_cover
  ) order by p.position), '[]'::jsonb) into v_pages
  from public.reading_story_pages p
  left join public.sentences s on s.id = p.sentence_id
  where p.story_id = v_story.id;

  return jsonb_build_object(
    'id', v_story.id,
    'userBookId', v_story.user_book_id,
    'slug', v_story.slug,
    'status', v_story.status,
    'publishedAt', v_story.published_at,
    'updatedAt', v_story.updated_at,
    'pages', v_pages
  );
end;
$$;
revoke all on function public.reading_story_owner(uuid) from public, anon;
grant execute on function public.reading_story_owner(uuid) to authenticated;

drop function if exists public.reading_story_publish(uuid);
create function public.reading_story_publish(p_story_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_story public.reading_stories;
  v_page_count integer;
  v_quote_count integer;
begin
  if v_uid is null then raise exception 'reading_story_authentication_required' using errcode = '42501'; end if;
  select s.* into v_story from public.reading_stories s
    where s.id = p_story_id and s.user_id = v_uid for update;
  if v_story.id is null then raise exception 'reading_story_not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.user_books ub where ub.id=v_story.user_book_id
    and ub.user_id=v_uid and ub.book_id=v_story.book_id and ub.status='completed') then
    raise exception 'reading_story_completed_book_required' using errcode = '42501';
  end if;
  if public.moderation_user_suspended(v_uid) then
    raise exception 'reading_story_user_suspended' using errcode = '42501';
  end if;
  if not public.moderation_terms_accepted(v_uid) then
    raise exception 'reading_story_terms_required' using errcode = '42501';
  end if;
  if exists (select 1 from public.moderation_hidden_stories h where h.story_id=v_story.id) then
    raise exception 'reading_story_hidden' using errcode = '42501';
  end if;

  select count(*), count(*) filter (where p.type='quote')
  into v_page_count, v_quote_count
  from public.reading_story_pages p
  where p.story_id=v_story.id;

  if v_page_count not between 1 and 20 then raise exception 'reading_story_page_count' using errcode='22023'; end if;
  if v_quote_count not between 1 and 8 then raise exception 'reading_story_public_quote_count' using errcode='22023'; end if;
  if exists (
    select 1 from public.reading_story_pages p
    left join public.sentences s on s.id=p.sentence_id
    where p.story_id=v_story.id and p.type in ('quote','note') and (
      s.id is null or s.user_id<>v_uid or s.user_book_id<>v_story.user_book_id
      or s.visibility<>'public'
      or exists (select 1 from public.moderation_hidden_sentences h where h.sentence_id=s.id)
      or (p.type='note' and (s.note_private or nullif(btrim(s.my_note), '') is null))
    )
  ) then raise exception 'reading_story_source_not_public' using errcode='42501'; end if;

  update public.reading_stories set status='published',
    published_at=coalesce(published_at, now()), updated_at=now()
  where id=v_story.id returning * into v_story;
  return jsonb_build_object('id', v_story.id, 'slug', v_story.slug,
    'status', v_story.status, 'publishedAt', v_story.published_at);
end;
$$;
revoke all on function public.reading_story_publish(uuid) from public, anon;
grant execute on function public.reading_story_publish(uuid) to authenticated;

drop function if exists public.reading_story_unpublish(uuid);
create function public.reading_story_unpublish(p_story_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_story public.reading_stories;
begin
  if v_uid is null then raise exception 'reading_story_authentication_required' using errcode='42501'; end if;
  update public.reading_stories set status='unpublished', updated_at=now()
    where id=p_story_id and user_id=v_uid returning * into v_story;
  if v_story.id is null then raise exception 'reading_story_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('id', v_story.id, 'slug', v_story.slug,
    'status', v_story.status, 'publishedAt', v_story.published_at);
end;
$$;
revoke all on function public.reading_story_unpublish(uuid) from public, anon;
grant execute on function public.reading_story_unpublish(uuid) to authenticated;

drop function if exists public.reading_story_public(text);
create function public.reading_story_public(p_slug text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_story public.reading_stories;
  v_pages jsonb := '[]'::jsonb;
  v_viewer uuid := auth.uid();
  v_page record;
  v_text text;
  v_remaining integer := 2400;
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{36}$' then return null; end if;
  select s.* into v_story from public.reading_stories s
  where s.slug=p_slug and s.status='published'
    and not exists (select 1 from public.moderation_hidden_stories h where h.story_id=s.id)
    and not exists (select 1 from public.moderation_suspended_users x where x.user_id=s.user_id)
    and (v_viewer is null or not exists (
      select 1 from public.moderation_reports r
      where r.reporter_id=v_viewer and r.status<>'dismissed'
        and ((r.target_type='story' and r.target_id=s.id)
          or (r.target_type='user' and r.target_id=s.user_id))
    ))
    and (v_viewer is null or not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id=v_viewer and b.blocked_id=s.user_id)
         or (b.blocker_id=s.user_id and b.blocked_id=v_viewer)
    ));
  if v_story.id is null then return null; end if;

  -- 선택된 원문 하나라도 삭제/비공개/숨김/비공개 note가 되면 전체를 닫는다.
  -- 일부 page 생략은 이야기 의미와 cover를 조용히 바꿀 수 있어 fail-closed가 더 안전하다.
  if exists (
    select 1 from public.reading_story_pages p
    left join public.sentences s on s.id=p.sentence_id
    where p.story_id=v_story.id and p.type in ('quote','note') and (
      s.id is null or s.user_id<>v_story.user_id or s.user_book_id<>v_story.user_book_id
      or s.visibility<>'public'
      or exists (select 1 from public.moderation_hidden_sentences h where h.sentence_id=s.id)
      or (v_viewer is not null and exists (
        select 1 from public.moderation_reports r where r.reporter_id=v_viewer
          and r.target_type='sentence' and r.target_id=s.id and r.status<>'dismissed'
      ))
      or (p.type='note' and (s.note_private or nullif(btrim(s.my_note), '') is null))
    )
  ) then return null; end if;

  for v_page in
    select p.type, p.position, p.is_cover, s.page,
      case when p.type='quote' then left(s.text, 500)
           when p.type='note' then s.my_note else p.snapshot_text end as raw_text
    from public.reading_story_pages p
    left join public.sentences s on s.id=p.sentence_id
    where p.story_id=v_story.id
    order by p.position
  loop
    exit when v_remaining <= 0;
    v_text := left(coalesce(v_page.raw_text, ''), v_remaining);
    v_pages := v_pages || jsonb_build_array(jsonb_build_object(
      'type', v_page.type,
      'position', v_page.position,
      'text', v_text,
      'page', case when v_page.type in ('quote','note') then v_page.page else null end,
      'isCover', v_page.is_cover
    ));
    v_remaining := v_remaining - char_length(v_text);
  end loop;
  return (select jsonb_build_object(
    'slug', v_story.slug,
    'title', coalesce(v_story.title, b.title),
    'publishedAt', v_story.published_at,
    'completedAt', ub.completed_at,
    'book', jsonb_build_object('title', b.title, 'author', b.author, 'coverUrl', b.cover_url),
    'author', jsonb_build_object('displayName', u.display_name, 'handle', u.handle, 'avatarUrl', u.avatar_url),
    'pages', v_pages
  ) from public.user_books ub join public.books b on b.id=ub.book_id
    join public.users u on u.id=v_story.user_id
    where ub.id=v_story.user_book_id and ub.user_id=v_story.user_id and ub.book_id=v_story.book_id
      and ub.status='completed');
end;
$$;
revoke all on function public.reading_story_public(text) from public;
grant execute on function public.reading_story_public(text) to anon, authenticated;

-- moderation_reports의 기존 sentence/user 계약을 유지하며 story만 명시적으로 확장한다.
alter table public.moderation_reports drop constraint if exists moderation_reports_target_type_check;
alter table public.moderation_reports add constraint moderation_reports_target_type_check
  check (target_type in ('sentence', 'user', 'story'));
alter table public.moderation_reports drop constraint if exists moderation_reports_action_check;
alter table public.moderation_reports add constraint moderation_reports_action_check
  check (action is null or action in ('dismiss', 'hide_sentence', 'hide_story', 'suspend_user'));

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
  if p_target_type='sentence' then select user_id into v_owner from public.sentences where id=p_target_id;
  elsif p_target_type='story' then select user_id into v_owner from public.reading_stories where id=p_target_id and status='published';
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

create or replace function public.moderation_admin_action(p_report_id uuid,p_action text,p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid:=auth.uid(); v_report public.moderation_reports;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_action not in ('dismiss','hide_sentence','hide_story','suspend_user') then raise exception 'invalid_action' using errcode='22023'; end if;
  if p_note is not null and char_length(p_note)>1000 then raise exception 'note_too_long' using errcode='22001'; end if;
  select * into v_report from public.moderation_reports where id=p_report_id for update;
  if v_report.id is null then raise exception 'report_not_found' using errcode='P0002'; end if;
  if p_action='hide_sentence' then
    if v_report.target_type<>'sentence' then raise exception 'sentence_target_required' using errcode='22023'; end if;
    insert into public.moderation_hidden_sentences(sentence_id,report_id,hidden_by,reason)
    values(v_report.target_id,v_report.id,v_uid,p_note) on conflict(sentence_id) do update
    set report_id=excluded.report_id,hidden_by=excluded.hidden_by,reason=excluded.reason;
  elsif p_action='hide_story' then
    if v_report.target_type<>'story' then raise exception 'story_target_required' using errcode='22023'; end if;
    insert into public.moderation_hidden_stories(story_id,report_id,hidden_by,reason)
    values(v_report.target_id,v_report.id,v_uid,p_note) on conflict(story_id) do update
    set report_id=excluded.report_id,hidden_by=excluded.hidden_by,reason=excluded.reason;
  elsif p_action='suspend_user' then
    if v_report.target_type<>'user' then raise exception 'user_target_required' using errcode='22023'; end if;
    insert into public.moderation_suspended_users(user_id,report_id,suspended_by,reason)
    values(v_report.target_id,v_report.id,v_uid,p_note) on conflict(user_id) do update
    set report_id=excluded.report_id,suspended_by=excluded.suspended_by,reason=excluded.reason;
  end if;
  update public.moderation_reports set status=case when p_action='dismiss' then 'dismissed' else 'actioned' end,
    action=p_action,moderator_id=v_uid,moderator_note=nullif(btrim(p_note),''),reviewed_at=now()
  where id=p_report_id;
end $$;
revoke all on function public.moderation_admin_action(uuid, text, text) from public, anon;
grant execute on function public.moderation_admin_action(uuid, text, text) to authenticated;
