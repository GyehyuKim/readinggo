-- Run with psql -v ON_ERROR_STOP=1 after migrations 65/66 on disposable DB only.
-- Role fixtures and all writes roll back. This file is not production migration SQL.
begin;
do $$
declare
 owner_id uuid:='16190001-0000-4000-8000-000000000001';
 book_id uuid; ub uuid; sentence_id uuid; result jsonb;
 request_id uuid:=gen_random_uuid(); story_id uuid; slug text;
begin
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(owner_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','privacy@example.invalid','','{}','{}',now(),now());
 insert into public.users(id,handle,display_name,settings)
 values(owner_id,'privacy_fixture','Privacy fixture','{"ugc_terms":{"version":"2026-08-01","accepted_at":"2026-09-03T00:00:00Z"}}')
 on conflict(id) do update set settings=excluded.settings;
 insert into public.books(title,author) values('Privacy fixture','Author') returning id into book_id;
 insert into public.user_books(user_id,book_id,status,completed_at)
 values(owner_id,book_id,'completed',now()) returning id into ub;
 insert into public.sentences(user_id,user_book_id,text,my_note,visibility)
 values(owner_id,ub,'Quote','Q. secret A. secret','public') returning id into sentence_id;
 if (select visibility from public.user_books where id=ub)<>'private' then raise exception 'default_not_private'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true); set local role authenticated;
 result:=public.book_set_visibility(ub,'public',0,request_id);
 if result->>'revision'<>'1' then raise exception 'revision_failed'; end if;
 if exists(select 1 from public.book_public_quotes(ub) where thought is not null) then raise exception 'legacy_note_leak'; end if;
 update public.sentences set publishable_thought='Explicit thought' where id=sentence_id;
 insert into public.sentence_conversation_turns(sentence_id,user_id,role,content)
 values(sentence_id,owner_id,'assistant','Private assistant');
 if (select thought from public.book_public_quotes(ub))<>'Explicit thought' then raise exception 'explicit_thought_missing'; end if;
 perform public.book_set_visibility(ub,'private',1,gen_random_uuid());
 result:=public.book_set_visibility(ub,'public',0,request_id);
 if result->>'visibility'<>'private' or result->>'revision'<>'2' or result->>'replayed'<>'true' then
  raise exception 'stale_replay_republished'; end if;
 begin
  perform public.book_set_visibility(ub,'public',0,gen_random_uuid());
  raise exception 'stale_write_accepted';
 exception when serialization_failure then null; end;
 begin
  update public.user_books set visibility='public' where id=ub;
  raise exception 'direct_write_accepted';
 exception when insufficient_privilege then null; end;
 reset role;
 -- Forge a pre-existing intro-only published snapshot to exercise unconditional gate.
 insert into public.reading_stories(user_id,user_book_id,book_id,slug,status)
 values(owner_id,ub,book_id,encode(gen_random_bytes(18),'hex'),'published') returning id,reading_stories.slug into story_id,slug;
 insert into public.reading_story_pages(story_id,position,type,snapshot_text,is_cover)
 values(story_id,0,'intro','Must not leak',false);
 perform set_config('request.jwt.claim.sub','',true); set local role anon;
 if public.book_public(ub) is not null or exists(select 1 from public.book_public_quotes(ub)) then raise exception 'private_public_leak'; end if;
 if public.reading_story_public(slug) is not null then raise exception 'intro_only_leak'; end if;
 begin perform 1 from public.sentence_conversation_turns; raise exception 'anonymous_conversation_read';
 exception when insufficient_privilege then null; end;
 reset role;
 if (select my_note from public.sentences where id=sentence_id)<>'Q. secret A. secret' then raise exception 'legacy_data_changed'; end if;
end $$;
rollback;
