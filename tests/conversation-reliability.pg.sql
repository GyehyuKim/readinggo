begin;
-- Existing disposable-cluster synthetic sentence only; all writes roll back.
create temporary table conversation_fixture on commit drop as
 select id as sid,user_id as owner from public.sentences limit 1;
do $$ begin
 if not exists(select 1 from conversation_fixture) then raise exception 'conversation fixture missing'; end if;
end $$;
grant select on conversation_fixture to authenticated;
select set_config('request.jwt.claim.sub', (select owner::text from conversation_fixture), true);
set local role authenticated;
select count(*)=2 as pair_saved from public.sentence_conversation_save_pair((select sid from conversation_fixture), '[{"id":"70000000-0000-4000-8000-000000000001","role":"assistant","content":"Q"},{"id":"70000000-0000-4000-8000-000000000002","role":"user","content":"A"}]');
select count(*)=2 as pair_replayed from public.sentence_conversation_save_pair((select sid from conversation_fixture), '[{"id":"70000000-0000-4000-8000-000000000001","role":"assistant","content":"Q"},{"id":"70000000-0000-4000-8000-000000000002","role":"user","content":"A"}]');
select set_config('test.sentence', (select sid::text from conversation_fixture), true);
do $$ begin
 begin
 perform * from public.sentence_conversation_save_pair(current_setting('test.sentence')::uuid,'[{"id":"70000000-0000-4000-8000-000000000003","role":"assistant","content":"Q"},{"id":"70000000-0000-4000-8000-000000000004","role":"user","content":""}]');
 raise exception 'invalid pair accepted';
 exception when invalid_parameter_value then null; end;
 if (select count(*) from public.sentence_conversation_turns where id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002'))<>2 then raise exception 'replay duplicated'; end if;
 if exists(select 1 from public.sentence_conversation_turns where id='70000000-0000-4000-8000-000000000003') then raise exception 'partial write'; end if;
 begin
 perform * from public.sentence_conversation_save_pair(current_setting('test.sentence')::uuid,'[{"id":"70000000-0000-4000-8000-000000000001","role":"assistant","content":"changed"},{"id":"70000000-0000-4000-8000-000000000002","role":"user","content":"A"}]');
 raise exception 'conflict accepted'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000099',true);
do $$ begin
 if exists(select 1 from public.sentence_conversation_turns) then raise exception 'nonowner read'; end if;
 begin
 perform * from public.sentence_conversation_import(current_setting('test.sentence')::uuid,'[{"id":"70000000-0000-4000-8000-000000000003","role":"assistant","content":"Q"}]');
 raise exception 'nonowner write'; exception when insufficient_privilege then null; end;
end $$;
rollback;
