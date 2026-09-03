-- 63_reading_story_report_slug.sql
-- #1590 Phase 3: report a published story by public slug without exposing its internal UUID.

create or replace function public.reading_story_report(
  p_slug text,
  p_reason text,
  p_detail text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_story_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_slug is null or p_slug !~ '^[0-9a-f]{36}$' then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;

  select s.id into v_story_id
  from public.reading_stories s
  where s.slug = p_slug
    and s.status = 'published'
    and exists (
      select 1
      from public.user_books ub
      where ub.id = s.user_book_id
        and ub.user_id = s.user_id
        and ub.book_id = s.book_id
        and ub.status = 'completed'
    )
    and not exists (
      select 1 from public.moderation_hidden_stories h
      where h.story_id = s.id
    )
    and not exists (
      select 1 from public.moderation_suspended_users x
      where x.user_id = s.user_id
    )
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = v_uid and b.blocked_id = s.user_id)
         or (b.blocker_id = s.user_id and b.blocked_id = v_uid)
    )
    and not exists (
      select 1 from public.moderation_reports r
      where r.reporter_id = v_uid
        and r.status <> 'dismissed'
        and r.target_type = 'user'
        and r.target_id = s.user_id
    )
    and not exists (
      select 1
      from public.reading_story_pages p
      left join public.sentences source on source.id = p.sentence_id
      where p.story_id = s.id
        and p.type in ('quote', 'note')
        and (
          source.id is null
          or source.user_id <> s.user_id
          or source.user_book_id <> s.user_book_id
          or source.visibility <> 'public'
          or exists (
            select 1 from public.moderation_hidden_sentences h
            where h.sentence_id = source.id
          )
          or exists (
            select 1 from public.moderation_reports r
            where r.reporter_id = v_uid
              and r.target_type = 'sentence'
              and r.target_id = source.id
              and r.status <> 'dismissed'
          )
          or (p.type = 'note' and (
            source.note_private
            or nullif(btrim(source.my_note), '') is null
          ))
        )
    );

  if v_story_id is null then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;

  return public.moderation_report('story', v_story_id, p_reason, p_detail);
end;
$$;

revoke all on function public.reading_story_report(text, text, text) from public, anon;
grant execute on function public.reading_story_report(text, text, text) to authenticated;
