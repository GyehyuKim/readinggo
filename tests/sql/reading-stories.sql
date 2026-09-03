-- #1590 reading story role/security regression. Run after 60_reading_stories.sql in DEV only.
begin;

do $$
declare
  v_owner uuid := '15900001-0000-4000-8000-000000000001';
  v_other uuid := '15900002-0000-4000-8000-000000000002';
  v_viewer uuid := '15900003-0000-4000-8000-000000000003';
  v_book uuid;
  v_owner_ub uuid;
  v_other_ub uuid;
  v_quote uuid;
  v_note uuid;
  v_other_sentence uuid;
  v_story uuid;
  v_report uuid;
  v_slug text;
  v_pages jsonb;
  v_result jsonb;
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (v_owner,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','story-owner@example.invalid','',now(),'{}','{}',now(),now()),
    (v_other,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','story-other@example.invalid','',now(),'{}','{}',now(),now()),
    (v_viewer,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','story-viewer@example.invalid','',now(),'{}','{}',now(),now())
  on conflict(id) do nothing;
  insert into public.users(id,handle,display_name,settings) values
    (v_owner,'story_owner','Story Owner','{"ugc_terms":{"version":"2026-08-01","accepted_at":"2026-09-03T00:00:00Z"}}'),
    (v_other,'story_other','Story Other','{}'),
    (v_viewer,'story_viewer','Story Viewer','{}')
  on conflict(id) do update set settings=excluded.settings,display_name=excluded.display_name;
  insert into public.books(title,author,cover_url) values('Story fixture','Author','https://example.invalid/cover.jpg') returning id into v_book;
  insert into public.user_books(user_id,book_id,status,completed_at,review_text)
    values(v_owner,v_book,'completed',now(),'완독 소감') returning id into v_owner_ub;
  insert into public.user_books(user_id,book_id,status,completed_at)
    values(v_other,v_book,'completed',now()) returning id into v_other_ub;
  insert into public.sentences(user_id,user_book_id,text,my_note,note_private,visibility,page)
    values(v_owner,v_owner_ub,'공개 인용문','공개 생각',false,'public',12) returning id into v_quote;
  insert into public.sentences(user_id,user_book_id,text,my_note,note_private,visibility,page)
    values(v_owner,v_owner_ub,'생각 원문','나의 생각',false,'public',13) returning id into v_note;
  insert into public.sentences(user_id,user_book_id,text,visibility)
    values(v_other,v_other_ub,'남의 문장','public') returning id into v_other_sentence;

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  set local role authenticated;

  -- Owner can atomically create a private draft, but a foreign sentence cannot enter it.
  v_pages := jsonb_build_array(
    jsonb_build_object('type','intro','text','도입'),
    jsonb_build_object('type','quote','sentenceId',v_quote,'isCover',true),
    jsonb_build_object('type','note','sentenceId',v_note),
    jsonb_build_object('type','review','text','완독 소감'),
    jsonb_build_object('type','outro','text','마무리')
  );
  v_result := public.reading_story_save_draft(v_owner_ub,v_pages);
  v_story := (v_result->>'id')::uuid;
  v_slug := v_result->>'slug';
  if v_result->>'status'<>'draft' or v_slug !~ '^[0-9a-f]{36}$' then raise exception 'draft_or_slug_failed'; end if;
  v_result := public.reading_story_owner(v_owner_ub);
  if v_result is null or jsonb_array_length(v_result->'pages')<>5 then raise exception 'owner_draft_read_failed'; end if;
  if public.reading_story_public(v_slug) is not null then raise exception 'draft_was_public'; end if;
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  begin perform public.reading_story_owner(v_owner_ub); raise exception 'anon_owner_read_allowed';
  exception when insufficient_privilege then null; end;
  reset role; perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  begin
    perform public.reading_story_save_draft(v_owner_ub,
      jsonb_build_array(jsonb_build_object('type','quote','sentenceId',v_other_sentence)));
    raise exception 'foreign_sentence_accepted';
  exception when insufficient_privilege then null; end;
  -- Failed replacement is statement-atomic: prior five pages remain.
  reset role;
  if (select count(*) from public.reading_story_pages where story_id=v_story)<>5 then raise exception 'draft_replacement_not_atomic'; end if;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;

  -- Shape, page, quote, cover and authored-text caps.
  begin
    perform public.reading_story_save_draft(v_owner_ub,
      (select jsonb_agg(jsonb_build_object('type','intro','text','x')) from generate_series(1,21)));
    raise exception 'page_cap_not_enforced';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reading_story_save_draft(v_owner_ub,
      (select jsonb_agg(jsonb_build_object('type','quote','sentenceId',v_quote)) from generate_series(1,9)));
    raise exception 'quote_cap_not_enforced';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reading_story_save_draft(v_owner_ub,
      jsonb_build_array(jsonb_build_object('type','intro','text',repeat('x',1201))));
    raise exception 'text_cap_not_enforced';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reading_story_save_draft(v_owner_ub,jsonb_build_array(
      jsonb_build_object('type','quote','sentenceId',v_quote,'isCover',true),
      jsonb_build_object('type','quote','sentenceId',v_note,'isCover',true)));
    raise exception 'cover_cap_not_enforced';
  exception when invalid_parameter_value then null; end;

  -- followers/private sentences and private notes cannot publish.
  reset role;
  update public.sentences set visibility='followers' where id=v_quote;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  begin perform public.reading_story_publish(v_story); raise exception 'followers_quote_published';
  exception when insufficient_privilege then null; end;
  reset role; update public.sentences set visibility='private' where id=v_quote;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  begin perform public.reading_story_publish(v_story); raise exception 'private_quote_published';
  exception when insufficient_privilege then null; end;
  reset role; update public.sentences set visibility='public' where id=v_quote;
  update public.sentences set note_private=true where id=v_note;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  begin perform public.reading_story_publish(v_story); raise exception 'private_note_published';
  exception when insufficient_privilege then null; end;

  -- Total exposed text is capped, while each public quote is bounded to 500 characters.
  reset role; update public.sentences set note_private=false,my_note='공개 생각',text='생각 원문' where id=v_note;
  update public.sentences set text=repeat('q',1000) where id=v_quote;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  v_result:=public.reading_story_save_draft(v_owner_ub,jsonb_build_array(
    jsonb_build_object('type','intro','text',repeat('i',1200)),
    jsonb_build_object('type','quote','sentenceId',v_quote,'isCover',true),
    jsonb_build_object('type','review','text',repeat('r',1200))));
  v_story := (v_result->>'id')::uuid;
  perform public.reading_story_publish(v_story);
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  v_result := public.reading_story_public(v_slug);
  if v_result is null or (select coalesce(sum(char_length(coalesce(p->>'text',''))),0)
      from jsonb_array_elements(v_result->'pages') p) <> 2400 then
    raise exception 'total_text_projection_cap_failed';
  end if;
  reset role; update public.sentences set text='공개 인용문' where id=v_quote;
  update public.sentences set text='생각 원문',my_note='공개 생각' where id=v_note;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  v_result:=public.reading_story_save_draft(v_owner_ub,v_pages);
  v_story := (v_result->>'id')::uuid;
  reset role;
  update public.users set settings='{}' where id=v_owner;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  begin perform public.reading_story_publish(v_story); raise exception 'terms_requirement_not_enforced';
  exception when insufficient_privilege then null; end;
  reset role; update public.users set settings='{"ugc_terms":{"version":"2026-08-01","accepted_at":"2026-09-03T00:00:00Z"}}' where id=v_owner;
  perform set_config('request.jwt.claim.sub',v_other::text,true); set local role authenticated;
  begin perform public.reading_story_publish(v_story); raise exception 'non_owner_publish_allowed';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  perform public.reading_story_publish(v_story);

  -- Failed atomic republish preserves the existing published row and five-page public version.
  reset role; update public.sentences set visibility='private' where id=v_quote;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  begin
    perform public.reading_story_republish(v_owner_ub,
      jsonb_build_array(jsonb_build_object('type','quote','sentenceId',v_quote,'isCover',true)));
    raise exception 'private_quote_republished';
  exception when insufficient_privilege then null; end;
  reset role; update public.sentences set visibility='public' where id=v_quote;
  if (select status from public.reading_stories where id=v_story)<>'published'
     or (select count(*) from public.reading_story_pages where story_id=v_story)<>5 then
    raise exception 'failed_republish_changed_public_story';
  end if;
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  if public.reading_story_public(v_slug) is null then raise exception 'failed_republish_removed_public_story'; end if;

  -- Anonymous sees only the bounded public object and never internal ids.
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  v_result := public.reading_story_public(v_slug);
  if v_result is null or v_result ? 'id' or v_result->'author' ? 'id' then raise exception 'public_shape_failed'; end if;
  if exists(select 1 from jsonb_array_elements(v_result->'pages') p
    where p->>'type'='quote' and char_length(p->>'text')>500) then raise exception 'quote_exposure_cap_failed'; end if;

  -- Unpublish is immediate; saving again returns the same stable slug as a private draft.
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  perform public.reading_story_unpublish(v_story);
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  if public.reading_story_public(v_slug) is not null then raise exception 'unpublished_was_public'; end if;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  v_result:=public.reading_story_save_draft(v_owner_ub,v_pages);
  if v_result->>'slug'<>v_slug then raise exception 'stable_slug_changed'; end if;
  perform public.reading_story_publish(v_story);

  -- Live suspension, story hide, sentence hide and visibility changes fail closed.
  reset role; insert into public.moderation_suspended_users(user_id,suspended_by,reason) values(v_owner,v_viewer,'test');
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  if public.reading_story_public(v_slug) is not null then raise exception 'suspended_story_visible'; end if;
  reset role; delete from public.moderation_suspended_users where user_id=v_owner;
  insert into public.moderation_hidden_stories(story_id,hidden_by,reason) values(v_story,v_viewer,'test');
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  if public.reading_story_public(v_slug) is not null then raise exception 'hidden_story_visible'; end if;
  reset role; delete from public.moderation_hidden_stories where story_id=v_story;
  insert into public.moderation_hidden_sentences(sentence_id,hidden_by,reason) values(v_quote,v_viewer,'test');
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  if public.reading_story_public(v_slug) is not null then raise exception 'hidden_source_visible'; end if;
  reset role; delete from public.moderation_hidden_sentences where sentence_id=v_quote;
  update public.sentences set visibility='private' where id=v_quote;
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  if public.reading_story_public(v_slug) is not null then raise exception 'private_source_visible'; end if;
  perform set_config('request.jwt.claim.sub',v_viewer::text,true); set local role authenticated;
  begin perform public.reading_story_report(v_slug,'spam',null); raise exception 'private_source_story_reported';
  exception when no_data_found then null; end;
  reset role; update public.sentences set visibility='public' where id=v_quote;

  -- Either direction of an authenticated block hides the story; anonymous has no block context.
  insert into public.user_blocks(blocker_id,blocked_id) values(v_owner,v_viewer);
  perform set_config('request.jwt.claim.sub',v_viewer::text,true); set local role authenticated;
  if public.reading_story_public(v_slug) is not null then raise exception 'owner_to_viewer_block_failed'; end if;
  begin perform public.reading_story_report(v_slug,'spam',null); raise exception 'blocked_story_reported';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  if public.reading_story_public(v_slug) is null then raise exception 'anonymous_inherited_block_context'; end if;
  reset role; delete from public.user_blocks where blocker_id=v_owner and blocked_id=v_viewer;
  insert into public.user_blocks(blocker_id,blocked_id) values(v_viewer,v_owner);
  perform set_config('request.jwt.claim.sub',v_viewer::text,true); set local role authenticated;
  if public.reading_story_public(v_slug) is not null then raise exception 'viewer_to_owner_block_failed'; end if;
  reset role; delete from public.user_blocks where blocker_id=v_viewer and blocked_id=v_owner;

  -- Anonymous cannot report; an authenticated viewer reports by slug without receiving the story UUID.
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  begin perform public.reading_story_report(v_slug,'spam',null); raise exception 'anon_story_report_allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',v_viewer::text,true); set local role authenticated;
  v_result:=public.reading_story_report(v_slug,'spam',null);
  v_report:=(v_result->>'id')::uuid;
  v_result:=public.reading_story_report(v_slug,'spam',null);
  if (v_result->>'id')::uuid <> v_report then raise exception 'story_report_retry_not_idempotent'; end if;
  if public.reading_story_public(v_slug) is not null then raise exception 'reported_story_visible_to_reporter'; end if;
  begin perform public.moderation_admin_action(v_report,'hide_story','self escalation'); raise exception 'reporter_became_admin';
  exception when insufficient_privilege then null; end;
  reset role; delete from public.moderation_reports where id=v_report;

  -- Deleted selected source leaves a tombstone page and closes the whole public story immediately.
  delete from public.sentences where id=v_quote;
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  if public.reading_story_public(v_slug) is not null then raise exception 'deleted_source_visible'; end if;

  -- No JWT may mutate, and authenticated clients have no direct base-table DML.
  perform set_config('request.jwt.claim.sub','',true); set local role anon;
  begin perform public.reading_story_save_draft(v_owner_ub,'[]'); raise exception 'anon_mutation_allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',v_owner::text,true); set local role authenticated;
  begin
    insert into public.reading_stories(user_id,user_book_id,book_id,slug)
    values(v_owner,v_owner_ub,v_book,repeat('a',36));
    raise exception 'direct_story_insert_allowed';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

-- Catalog assertions are separate so a privilege error cannot be confused with an RPC assertion.
do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.reading_stories'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.reading_story_pages'::regclass) then
    raise exception 'story_rls_disabled';
  end if;
  if has_table_privilege('anon','public.reading_stories','select,insert,update,delete')
    or has_table_privilege('authenticated','public.reading_stories','select,insert,update,delete')
    or has_table_privilege('anon','public.reading_story_pages','select,insert,update,delete')
    or has_table_privilege('authenticated','public.reading_story_pages','select,insert,update,delete') then
    raise exception 'story_base_privilege_leaked';
  end if;
  if has_function_privilege('anon','public.reading_story_save_draft(uuid,jsonb)','execute')
    or has_function_privilege('anon','public.reading_story_owner(uuid)','execute')
    or has_function_privilege('anon','public.reading_story_publish(uuid)','execute')
    or has_function_privilege('anon','public.reading_story_unpublish(uuid)','execute')
    or has_function_privilege('anon','public.reading_story_report(text,text,text)','execute') then
    raise exception 'anon_mutation_execute_granted';
  end if;
  if not has_function_privilege('authenticated','public.reading_story_save_draft(uuid,jsonb)','execute')
    or not has_function_privilege('authenticated','public.reading_story_owner(uuid)','execute')
    or not has_function_privilege('anon','public.reading_story_public(text)','execute')
    or not has_function_privilege('authenticated','public.reading_story_public(text)','execute')
    or not has_function_privilege('authenticated','public.reading_story_report(text,text,text)','execute') then
    raise exception 'story_rpc_grant_missing';
  end if;
end $$;

rollback;
