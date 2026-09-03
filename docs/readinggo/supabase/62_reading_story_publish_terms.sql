-- 62_reading_story_publish_terms.sql
-- #1590 Phase 2: keep story publishing independent from historical helper drift.

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
    and ub.user_id=v_uid and ub.book_id=v_story.book_id and ub.status='completed') then
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
