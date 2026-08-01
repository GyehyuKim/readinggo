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
begin
  select id into v_admin from public.users where coalesce(is_admin, false) limit 1;
  select id into v_reporter from public.users where id <> coalesce(v_admin, gen_random_uuid()) order by created_at limit 1;
  select id into v_target from public.users where id not in (coalesce(v_admin, gen_random_uuid()), coalesce(v_reporter, gen_random_uuid())) order by created_at limit 1;
  if v_admin is null or v_reporter is null or v_target is null then
    raise exception 'ugc_test_requires_admin_and_two_users';
  end if;

  select id into v_book from public.books limit 1;
  if v_book is null then raise exception 'ugc_test_requires_book'; end if;
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
  select (public.moderation_report('sentence', v_sentence, 'spam', null)->>'id')::uuid into v_second;
  if v_second = v_first then raise exception 'dismissed_report_false_success'; end if;
  if not exists(select 1 from public.moderation_reports where id=v_second and status='open') then raise exception 'rereport_not_open'; end if;

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
