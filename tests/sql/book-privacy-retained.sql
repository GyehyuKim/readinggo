-- Disposable PG only; real roles, all synthetic writes rolled back.
begin;
do $$
declare
 o uuid:='16190002-0000-4000-8000-000000000001';
 v uuid:='16190003-0000-4000-8000-000000000001';
 b uuid; ub uuid; s uuid; payload jsonb; err text; missing_err text;
begin
 insert into auth.users(id,raw_user_meta_data) values(o,'{}'),(v,'{}');
 update public.users set settings='{"ugc_terms":{"version":"2026-08-01","accepted_at":"2026-09-03T00:00:00Z"}}' where id in(o,v);
 insert into public.books(title,author) values('SECURITY67 synthetic','Synthetic') returning id into b;
 insert into public.user_books(user_id,book_id) values(o,b) returning id into ub;
 insert into public.sentences(user_id,user_book_id,text,my_note,publishable_thought)
 values(o,ub,'Private quote','SECRET mixed conversation','Explicit thought') returning id into s;
 insert into public.reading_sessions(user_id,user_book_id,session_date,pages_read_today) values(o,ub,current_date,12);
 perform set_config('request.jwt.claim.sub',v::text,true); set local role authenticated;
 if exists(select 1 from public.reading_sessions where user_book_id=ub) then raise exception 'sessions_leak'; end if;
 if public.sentence_public(s) is not null then raise exception 'private_lookup_leak'; end if;
 begin
  insert into public.claps(from_user_id,to_sentence_id) values(v,s);
  raise exception 'private_clap_accepted';
 exception when insufficient_privilege then get stacked diagnostics err=MESSAGE_TEXT; end;
 begin
  insert into public.claps(from_user_id,to_sentence_id) values(v,gen_random_uuid());
  raise exception 'missing_clap_accepted';
 exception when insufficient_privilege then get stacked diagnostics missing_err=MESSAGE_TEXT; end;
 if err is distinct from missing_err then raise exception 'target_existence_oracle'; end if;
 begin
  perform public.moderation_report('sentence',s,'other'); raise exception 'private_report_accepted';
 exception when no_data_found then get stacked diagnostics err=MESSAGE_TEXT; end;
 begin
  perform public.moderation_report('sentence',gen_random_uuid(),'other'); raise exception 'missing_report_accepted';
 exception when no_data_found then get stacked diagnostics missing_err=MESSAGE_TEXT; end;
 if err is distinct from missing_err then raise exception 'report_existence_oracle'; end if;
 begin
  insert into public.reading_sessions(user_id,user_book_id,session_date,pages_read_today) values(v,ub,current_date,1);
  raise exception 'crossowner_session_write';
 exception when insufficient_privilege then null; end;
 reset role; perform set_config('request.jwt.claim.sub','',true); set local role anon;
 if exists(select 1 from public.social_newcomers_weekly(100) x where x.book_id=b) then raise exception 'private_count_leak'; end if;
 if exists(select 1 from public.sentences_public_feed(b)) or exists(select 1 from public.user_books_public(o)) then raise exception 'private_discovery_leak'; end if;
 reset role; perform set_config('request.jwt.claim.sub',o::text,true); set local role authenticated;
 if not exists(select 1 from public.reading_sessions where user_book_id=ub) then raise exception 'owner_sessions_missing'; end if;
 perform public.book_set_visibility(ub,'public',0,gen_random_uuid());
 reset role; perform set_config('request.jwt.claim.sub','',true); set local role anon;
 payload:=public.sentence_public(s);
 if payload->>'userBookId'<>ub::text or payload->>'thought'<>'Explicit thought' or payload->'parent' is null then raise exception 'public_projection_missing'; end if;
 if payload::text like '%SECRET%' or payload ? 'my_note' or payload ? 'session_id' then raise exception 'secret_projection_leak'; end if;
 if (select count(*) from public.sentences_public_feed(b,o,1,0))<>1 or exists(select 1 from public.sentences_public_feed(b,o,1,1)) then raise exception 'pagination_failed'; end if;
 if (select count(*) from public.user_books_public(o))<>1 then raise exception 'public_books_missing'; end if;
 if (select starters from public.social_newcomers_weekly(100) x where x.book_id=b)<>1 then raise exception 'public_count_missing'; end if;
 reset role; perform set_config('request.jwt.claim.sub',v::text,true); set local role authenticated;
 insert into public.claps(from_user_id,to_sentence_id) values(v,s);
 if (select count(*) from public.claps where to_sentence_id=s)<>1 then raise exception 'public_clap_missing'; end if;
 reset role; perform set_config('request.jwt.claim.sub',o::text,true); set local role authenticated;
 if public.activity_inbox_unread_count()<>1 then raise exception 'public_inbox_missing'; end if;
 perform public.book_set_visibility(ub,'private',1,gen_random_uuid());
 if public.activity_inbox_unread_count()<>0 then raise exception 'withdrawn_inbox_leak'; end if;
 perform public.book_set_visibility(ub,'public',2,gen_random_uuid());
 reset role;
 insert into public.user_blocks(blocker_id,blocked_id) values(v,o);
 perform set_config('request.jwt.claim.sub',v::text,true); set local role authenticated;
 if public.sentence_public(s) is not null or exists(select 1 from public.sentences_public_feed(b)) or exists(select 1 from public.claps where to_sentence_id=s) then raise exception 'blocked_leak'; end if;
 reset role; delete from public.user_blocks where blocker_id=v and blocked_id=o;
 perform set_config('request.jwt.claim.sub',v::text,true); set local role authenticated;
 perform public.moderation_report('sentence',s,'other');
 if public.sentence_public(s) is not null then raise exception 'reported_leak'; end if;
 reset role; delete from public.moderation_reports where reporter_id=v;
 perform set_config('request.jwt.claim.sub','',true);
 insert into public.moderation_hidden_sentences(sentence_id,hidden_by) values(s,v);
 perform set_config('request.jwt.claim.sub','',true); set local role anon;
 if public.sentence_public(s) is not null then raise exception 'hidden_leak'; end if;
 reset role; delete from public.moderation_hidden_sentences where sentence_id=s;
 insert into public.moderation_suspended_users(user_id,suspended_by) values(o,v);
 set local role anon;
 if public.sentence_public(s) is not null or exists(select 1 from public.user_books_public(o)) then raise exception 'suspended_leak'; end if;
 reset role;
end $$;
rollback;
