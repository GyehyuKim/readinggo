-- #1260 activity inbox deterministic regression. Run after 57_activity_inbox.sql in DEV only.
begin;

do $$
declare
  v_viewer uuid := '12600000-0000-4000-8000-000000000001';
  v_actor uuid := '12600000-0000-4000-8000-000000000002';
  v_other uuid := '12600000-0000-4000-8000-000000000003';
  v_book uuid;
  v_ub uuid;
  v_sentence uuid;
  v_fixed timestamptz := statement_timestamp() - interval '1 hour';
  v_first_follow_key text;
  v_second_follow_key text;
  v_keys text[];
  v_result jsonb;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_viewer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inbox-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_actor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inbox-actor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inbox-other@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
  on conflict(id) do nothing;
  insert into public.users(id, handle, display_name)
  values (v_viewer, 'inbox_viewer', 'Viewer'), (v_actor, 'inbox_actor', 'Actor'), (v_other, 'inbox_other', 'Other')
  on conflict(id) do update set display_name=excluded.display_name;
  insert into public.books(title) values ('Activity inbox fixture') returning id into v_book;
  insert into public.user_books(user_id, book_id, status) values (v_viewer, v_book, 'reading') returning id into v_ub;

  -- 101 same-timestamp claps: event_key tie-break makes latest-100 boundary deterministic.
  for i in 1..101 loop
    insert into public.sentences(user_id, user_book_id, text, visibility, created_at)
      values(v_viewer, v_ub, 'inbox fixture ' || i, 'public', v_fixed) returning id into v_sentence;
    insert into public.claps(from_user_id, to_sentence_id, created_at)
      values(v_actor, v_sentence, v_fixed);
  end loop;

  perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  set local role authenticated;
  v_result := public.activity_inbox();
  if jsonb_array_length(v_result->'items') <> 100 then raise exception 'top100_bound_failed'; end if;
  if (select bool_and(prev_key <= event_key) from (
    select item->>'eventKey' event_key,
      lag(item->>'eventKey') over (order by ordinal) prev_key
    from jsonb_array_elements(v_result->'items') with ordinality rows(item, ordinal)
  ) q where prev_key is not null) is not true then raise exception 'same_timestamp_order_failed'; end if;

  select array_agg(x."eventKey") into v_keys
    from jsonb_to_recordset(v_result->'items') as x("eventKey" text);
  perform public.activity_inbox_mark_seen(v_keys);

  -- Late same-timestamp key was not in the rendered response and remains unread.
  reset role;
  insert into public.sentences(user_id, user_book_id, text, visibility, created_at)
    values(v_viewer, v_ub, 'late same timestamp', 'public', v_fixed) returning id into v_sentence;
  insert into public.claps(id, from_user_id, to_sentence_id, created_at)
    values('00000000-0000-4000-8000-000000000001', v_other, v_sentence, v_fixed);
  perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  set local role authenticated;
  if public.activity_inbox_unread_count() < 1 then raise exception 'late_same_timestamp_was_marked'; end if;

  -- Follow identity includes source created_at, so unfollow/refollow is a new key.
  reset role;
  insert into public.follows(follower_id, following_id, created_at) values(v_actor, v_viewer, statement_timestamp() - interval '30 minutes');
  select event_key into v_first_follow_key from public.activity_inbox_projection(v_viewer) where kind='follow';
  delete from public.follows where follower_id=v_actor and following_id=v_viewer;
  insert into public.follows(follower_id, following_id, created_at) values(v_actor, v_viewer, statement_timestamp() - interval '29 minutes');
  select event_key into v_second_follow_key from public.activity_inbox_projection(v_viewer) where kind='follow';
  if v_first_follow_key = v_second_follow_key then raise exception 'refollow_key_reused'; end if;

  -- Arbitrary/other-user keys cannot enter state; mark input is bounded and rejects blanks.
  perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  set local role authenticated;
  perform public.activity_inbox_mark_seen(array['clap:00000000-0000-4000-8000-000000000099']);
  if exists(select 1 from public.activity_inbox_state where user_id=v_viewer and 'clap:00000000-0000-4000-8000-000000000099'=any(seen_event_keys)) then
    raise exception 'arbitrary_key_persisted';
  end if;
  begin
    perform public.activity_inbox_mark_seen(array['']);
    raise exception 'blank_key_accepted';
  exception when invalid_parameter_value then null; end;
end $$;

-- RLS/grant/auth assertions.
do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.activity_inbox_state'::regclass) then raise exception 'state_rls_disabled'; end if;
  if has_table_privilege('anon', 'public.activity_inbox_state', 'select') then raise exception 'anon_state_select'; end if;
  if has_table_privilege('authenticated', 'public.activity_inbox_state', 'insert,update,delete') then raise exception 'direct_state_mutation_granted'; end if;
  if has_function_privilege('anon', 'public.activity_inbox()', 'execute') then raise exception 'anon_rpc_execute'; end if;
  if not has_function_privilege('authenticated', 'public.activity_inbox()', 'execute') then raise exception 'authenticated_rpc_missing'; end if;
end $$;

rollback;
