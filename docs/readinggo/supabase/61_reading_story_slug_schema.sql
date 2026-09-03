-- 61_reading_story_slug_schema.sql
-- #1590 Phase 2: Supabase installs pgcrypto in extensions; qualify slug generation
-- under the SECURITY DEFINER function's locked search_path.

create or replace function public.reading_story_save_draft(p_user_book_id uuid, p_pages jsonb)
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

  insert into public.reading_stories(user_id, user_book_id, book_id, slug, status, updated_at)
  values (v_uid, p_user_book_id, v_book_id, encode(extensions.gen_random_bytes(18), 'hex'), 'draft', now())
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
