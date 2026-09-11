-- #1619 unconditional parent gate; private conversation never enters story output.
begin;
create or replace function public.reading_story_publish(p_story_id uuid)
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
    and ub.user_id=v_uid and ub.book_id=v_story.book_id and ub.status='completed'
    and public.book_public_allowed(ub.id)) then
    raise exception 'reading_story_completed_book_required' using errcode = '42501';
  end if;
  if public.moderation_user_suspended(v_uid) then
    raise exception 'reading_story_user_suspended' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = v_uid
      and u.settings #>> '{ugc_terms,version}' = '2026-08-01'
      and nullif(u.settings #>> '{ugc_terms,accepted_at}', '') is not null
  ) then
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
      or not public.book_public_allowed(s.user_book_id)
      or exists (select 1 from public.moderation_hidden_sentences h where h.sentence_id=s.id)
      or (p.type='note' and (nullif(btrim(s.publishable_thought), '') is null))
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

create or replace function public.reading_story_public(p_slug text)
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
    and public.book_public_allowed(s.user_book_id)
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
      or not public.book_public_allowed(s.user_book_id)
      or exists (select 1 from public.moderation_hidden_sentences h where h.sentence_id=s.id)
      or (v_viewer is not null and exists (
        select 1 from public.moderation_reports r where r.reporter_id=v_viewer
          and r.target_type='sentence' and r.target_id=s.id and r.status<>'dismissed'
      ))
      or (p.type='note' and (nullif(btrim(s.publishable_thought), '') is null))
    )
  ) then return null; end if;

  for v_page in
    select p.type, p.position, p.is_cover, s.page,
      case when p.type='quote' then left(s.text, 500)
           when p.type='note' then s.publishable_thought else p.snapshot_text end as raw_text
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


commit;
