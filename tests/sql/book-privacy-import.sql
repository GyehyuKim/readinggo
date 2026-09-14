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
 result:=public.sentence_import_private(ub,'16190001-0000-4000-8000-000000000099',' Exact text ',12,null,'Mixed secret',null,'2020-01-02T03:04:05Z');
 if result->>'text'<>' Exact text ' or (result->>'created_at')::timestamptz<>'2020-01-02T03:04:05Z'::timestamptz then raise exception 'import_loss'; end if;
 perform public.sentence_import_private(ub,'16190001-0000-4000-8000-000000000099',' Exact text ',12,null,'Mixed secret',null,'2020-01-02T03:04:05Z');
 begin
  perform public.sentence_import_private(ub,'16190001-0000-4000-8000-000000000099','Changed',12);
  raise exception 'conflict_accepted';
 exception when invalid_parameter_value then null; end;
 reset role;
end $$;
rollback;
