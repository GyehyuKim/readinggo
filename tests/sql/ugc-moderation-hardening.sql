-- Executed after migration 50 inside a DEV transaction; caller always rolls back.
do $$
declare
  v_reporter uuid;
  v_target uuid;
  v_admin uuid;
  v_sentence uuid;
  v_book uuid;
  v_ub uuid;
  v_first uuid;
  v_second uuid;
  v_result jsonb;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('13960000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ugc-reporter@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('13970000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ugc-target@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('13980000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ugc-admin@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
  on conflict(id) do nothing;
  insert into public.users(id, handle, display_name, is_admin)
  values
    ('13960000-0000-4000-8000-000000000001', 'ugc_tx_reporter', 'UGC reporter', false),
    ('13970000-0000-4000-8000-000000000002', 'ugc_tx_target', 'UGC target', false),
    ('13980000-0000-4000-8000-000000000003', 'ugc_tx_admin', 'UGC admin', true)
  on conflict(id) do update set is_admin=excluded.is_admin;
  v_reporter := '13960000-0000-4000-8000-000000000001';
  v_target := '13970000-0000-4000-8000-000000000002';
  v_admin := '13980000-0000-4000-8000-000000000003';

  select id into v_book from public.books limit 1;
  if v_book is null then
    insert into public.books(title) values ('UGC transaction book') returning id into v_book;
  end if;
  insert into public.user_books(user_id, book_id, status) values (v_target, v_book, 'reading')
    on conflict(user_id, book_id) do update set status = excluded.status returning id into v_ub;
  insert into public.sentences(user_id, user_book_id, text, visibility)
    values(v_target, v_ub, 'ugc-hardening-transaction-fixture', 'public') returning id into v_sentence;

  perform set_config('request.jwt.claim.sub', v_reporter::text, true);
  set local role authenticated;
  if exists(select 1 from public.sentences where id = v_sentence) then raise exception 'base_sentence_bypass'; end if;
  if not exists(select 1 from public.sentences_public where id = v_sentence) then raise exception 'public_sentence_control_missing'; end if;
  select (public.moderation_report('sentence', v_sentence, 'spam', null)->>'id')::uuid into v_first;
  if exists(select 1 from public.sentences_public where id = v_sentence) then raise exception 'reported_sentence_visible'; end if;

  reset role;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  perform public.moderation_admin_action(v_first, 'dismiss', 'transaction test');
  reset role;
  perform set_config('request.jwt.claim.sub', v_reporter::text, true);
  set local role authenticated;
  select public.moderation_report('sentence', v_sentence, 'spam', null) into v_result;
  v_second := (v_result->>'id')::uuid;
  if v_second = v_first then raise exception 'dismissed_report_false_success'; end if;
  if v_result->>'status' <> 'open' then raise exception 'rereport_not_open'; end if;

  reset role;
  update public.users set settings = settings - 'ugc_terms' where id = v_reporter;
  perform set_config('request.jwt.claim.sub', v_reporter::text, true);
  set local role authenticated;
  begin
    update public.users set bio='must fail' where id=v_reporter;
    raise exception 'profile_consent_bypass';
  exception when insufficient_privilege then null; end;
  update public.users set settings = jsonb_set(settings, '{private_test}', 'true'::jsonb, true) where id=v_reporter;
  reset role;
end $$;

do $$ begin
  if (select count(*) from pg_policies
      where schemaname='public' and (
        (tablename='users' and policyname='users_sel' and qual like '%moderation_user_visible%') or
        (tablename='user_books' and policyname='ub_sel' and qual like '%moderation_user_visible%') or
        (tablename='sentences' and policyname='sent_sel' and qual like '%auth.uid%')
      )) <> 3 then raise exception 'base_policy_missing'; end if;
end $$;
