-- 64_reading_story_atomic_republish.sql
-- #1590 Phase 3: replace a published story and republish in one transaction.
-- If validation or publication fails, PostgreSQL rolls back the nested draft write,
-- preserving the previously published story and its stable slug.

create or replace function public.reading_story_republish(p_user_book_id uuid, p_pages jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saved jsonb;
begin
  v_saved := public.reading_story_save_draft(p_user_book_id, p_pages);
  return public.reading_story_publish((v_saved->>'id')::uuid);
end;
$$;

alter function public.reading_story_republish(uuid, jsonb) owner to postgres;

revoke all on function public.reading_story_republish(uuid, jsonb) from public, anon;
grant execute on function public.reading_story_republish(uuid, jsonb) to authenticated;

-- The Worker renders dynamic OG from the same narrow, fail-closed public RPC.
grant execute on function public.reading_story_public(text) to service_role;
