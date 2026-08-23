-- Run after migration 56 in DEV inside a transaction; always ROLLBACK.
-- Role matrix and non-inference regression for #1454.
begin;

do $$
declare
  v_owner uuid := '14540001-0000-4000-8000-000000000001';
  v_friend uuid := '14540002-0000-4000-8000-000000000002';
  v_stranger uuid := '14540003-0000-4000-8000-000000000003';
  v_book uuid;
  v_ub uuid;
  v_public uuid;
  v_followers uuid;
  v_private uuid;
  v_result jsonb;
  v_leaves jsonb;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'friend-tree-owner@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_friend, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'friend-tree-friend@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'friend-tree-stranger@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
  on conflict(id) do nothing;
  insert into public.users(id, handle, display_name, settings) values
    (v_owner, 'tree_owner', 'Tree owner', '{}'::jsonb),
    (v_friend, 'tree_friend', 'Tree friend', '{}'::jsonb),
    (v_stranger, 'tree_stranger', 'Tree stranger', '{}'::jsonb)
  on conflict(id) do update set settings=excluded.settings;
  insert into public.follows(follower_id, following_id) values
    (v_owner, v_friend), (v_friend, v_owner)
  on conflict do nothing;
  select id into v_book from public.books limit 1;
  if v_book is null then insert into public.books(title) values ('Friend tree fixture') returning id into v_book; end if;
  insert into public.user_books(user_id, book_id, status) values(v_owner, v_book, 'reading')
    on conflict(user_id, book_id) do update set status='reading' returning id into v_ub;
  insert into public.sentences(user_id, user_book_id, text, visibility) values
    (v_owner, v_ub, 'FRIEND_TREE_PUBLIC', 'public') returning id into v_public;
  insert into public.sentences(user_id, user_book_id, text, visibility) values
    (v_owner, v_ub, 'FRIEND_TREE_FOLLOWERS', 'followers') returning id into v_followers;
  insert into public.sentences(user_id, user_book_id, text, visibility) values
    (v_owner, v_ub, 'FRIEND_TREE_PRIVATE', 'private') returning id into v_private;

  -- owner_control
  perform set_config('request.jwt.claim.sub', v_owner::text, true); set local role authenticated;
  v_result := public.friend_book_tree(v_owner);
  if (v_result->>'visible_leaf_count')::int <> 3 then raise exception 'owner_control'; end if;
  v_leaves := public.friend_book_tree_leaves(v_owner, v_book, 0, 20);
  if jsonb_array_length(v_leaves) <> 3 then raise exception 'owner_leaves_control'; end if;
  reset role;

  -- default_opt_in_required: mutual friendship alone never activates a legacy/missing setting.
  perform set_config('request.jwt.claim.sub', v_friend::text, true); set local role authenticated;
  begin perform public.friend_book_tree(v_owner); raise exception 'default_opt_in_required';
  exception when insufficient_privilege then null; end;
  reset role;

  perform set_config('request.jwt.claim.sub', v_owner::text, true); set local role authenticated;
  perform public.friend_book_tree_set_sharing(true); reset role;

  -- friend_control, private_body_absent, private_count_absent, direct_private_id_absent
  perform set_config('request.jwt.claim.sub', v_friend::text, true); set local role authenticated;
  v_result := public.friend_book_tree(v_owner);
  v_leaves := public.friend_book_tree_leaves(v_owner, v_book, 0, 20);
  if (v_result->>'visible_leaf_count')::int <> 2 then raise exception 'friend_control'; end if;
  if jsonb_array_length(v_leaves) <> 2 then raise exception 'friend_leaves_control'; end if;
  if v_result::text like '%FRIEND_TREE_%' then raise exception 'summary_body_absent'; end if;
  if v_leaves::text not like '%FRIEND_TREE_PUBLIC%' or v_leaves::text not like '%FRIEND_TREE_FOLLOWERS%' then raise exception 'visible_body_present'; end if;
  if v_leaves::text like '%FRIEND_TREE_PRIVATE%' then raise exception 'private_body_absent'; end if;
  if (v_result::text || v_leaves::text) like '%' || v_private::text || '%' then raise exception 'direct_private_id_absent'; end if;
  if v_result::text ~ 'private[_ ]count' then raise exception 'private_count_absent'; end if;
  if jsonb_array_length(public.friend_book_tree_leaves(v_owner, v_book, 0, 1)) <> 1 then raise exception 'leaf_limit_control'; end if;
  reset role;

  -- nonfriend_denied
  perform set_config('request.jwt.claim.sub', v_stranger::text, true); set local role authenticated;
  begin perform public.friend_book_tree(v_owner); raise exception 'nonfriend_denied';
  exception when insufficient_privilege then null; end;
  begin perform public.friend_book_tree_leaves(v_owner, v_book, 0, 20); raise exception 'nonfriend_leaves_denied';
  exception when insufficient_privilege then null; end;
  reset role;

  -- blocked_denied
  insert into public.user_blocks(blocker_id, blocked_id) values(v_friend, v_owner) on conflict do nothing;
  perform set_config('request.jwt.claim.sub', v_friend::text, true); set local role authenticated;
  begin perform public.friend_book_tree(v_owner); raise exception 'blocked_denied';
  exception when insufficient_privilege then null; end;
  begin perform public.friend_book_tree_leaves(v_owner, v_book, 0, 20); raise exception 'blocked_leaves_denied';
  exception when insufficient_privilege then null; end;
  reset role;
  delete from public.user_blocks where blocker_id=v_friend and blocked_id=v_owner;
  insert into public.follows(follower_id, following_id) values(v_owner,v_friend),(v_friend,v_owner) on conflict do nothing;

  -- opt_out_immediate
  perform set_config('request.jwt.claim.sub', v_owner::text, true); set local role authenticated;
  perform public.friend_book_tree_set_sharing(false); reset role;
  perform set_config('request.jwt.claim.sub', v_friend::text, true); set local role authenticated;
  begin perform public.friend_book_tree(v_owner); raise exception 'opt_out_immediate';
  exception when insufficient_privilege then null; end;
  begin perform public.friend_book_tree_leaves(v_owner, v_book, 0, 20); raise exception 'opt_out_leaves_immediate';
  exception when insufficient_privilege then null; end;
  reset role;

  -- anonymous_denied (EXECUTE is revoked; SQLSTATE depends on caller role configuration).
  perform set_config('request.jwt.claim.sub', '', true); set local role anon;
  begin perform public.friend_book_tree(v_owner); raise exception 'anonymous_denied';
  exception when insufficient_privilege then null; end;
  begin perform public.friend_book_tree_leaves(v_owner, v_book, 0, 20); raise exception 'anonymous_leaves_denied';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;

rollback;
