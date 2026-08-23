-- 56_friend_book_tree.sql
-- #1454 확장 단계: broad base RLS를 유지한 채 필드 제한 친구 책나무 RPC를 선배포한다.
-- 실제 식별자: RPC friend_book_tree / friend_book_tree_set_sharing,
-- settings.friend_tree_sharing={policy_version:'2026-08-23',opted_out:boolean,revoked_at?:timestamptz}.

create or replace function public.friend_book_tree_sharing_enabled(p_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case
    when u.id is null then false
    -- 코드·RPC 선배포 단계는 opt-in이다. 고지 효력일 이후 기존 계정 기본 활성화가 필요하면
    -- 별도 migration으로 명시적으로 전환하며, 이 migration 자체는 키 없는 계정을 공개하지 않는다.
    when not (coalesce(u.settings, '{}'::jsonb) ? 'friend_tree_sharing') then false
    -- 인식한 객체와 boolean만 허용한다. 손상·미래 형식은 더 넓게 공개하지 않는다.
    when jsonb_typeof(u.settings -> 'friend_tree_sharing') <> 'object' then false
    when jsonb_typeof(u.settings #> '{friend_tree_sharing,opted_out}') <> 'boolean' then false
    else not ((u.settings #>> '{friend_tree_sharing,opted_out}')::boolean)
  end
  from public.users u
  where u.id = p_owner_id;
$$;
revoke all on function public.friend_book_tree_sharing_enabled(uuid) from public, anon, authenticated;

create or replace function public.friend_book_tree_sharing_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'friend_tree_forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('enabled', coalesce(public.friend_book_tree_sharing_enabled(v_uid), false));
end;
$$;
revoke all on function public.friend_book_tree_sharing_status() from public, anon;
grant execute on function public.friend_book_tree_sharing_status() to authenticated;

create or replace function public.friend_book_tree(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
  v_owner boolean;
  v_mutual boolean;
  v_result jsonb;
begin
  if v_viewer is null or p_owner_id is null then
    raise exception 'friend_tree_forbidden' using errcode = '42501';
  end if;
  v_owner := v_viewer = p_owner_id;

  select exists (
    select 1 from public.follows a
    join public.follows b
      on b.follower_id = p_owner_id and b.following_id = v_viewer
    where a.follower_id = v_viewer and a.following_id = p_owner_id
  ) into v_mutual;

  if not v_owner and (
    not v_mutual
    or not public.moderation_user_visible(p_owner_id)
    or not public.friend_book_tree_sharing_enabled(p_owner_id)
  ) then
    raise exception 'friend_tree_forbidden' using errcode = '42501';
  end if;

  with visible_leaves as (
    select s.id, s.user_book_id
    from public.sentences s
    where s.user_id = p_owner_id
      and (v_owner or s.visibility in ('public', 'followers', 'friends'))
      and not exists (
        select 1 from public.moderation_hidden_sentences h where h.sentence_id = s.id
      )
      and not exists (
        select 1 from public.moderation_reports r
        where r.reporter_id = v_viewer and r.target_type = 'sentence'
          and r.target_id = s.id and r.status <> 'dismissed'
      )
  ), branch_rows as (
    select ub.book_id, ub.status, ub.started_at as sort_at,
      jsonb_build_object(
        'book_id', ub.book_id,
        'status', ub.status,
        'book', jsonb_build_object(
          'id', bk.id, 'title', bk.title, 'author', bk.author,
          'cover_url', bk.cover_url, 'total_pages', bk.total_pages
        ),
        'visible_leaf_count', count(vl.id)
      ) as payload
    from public.user_books ub
    join public.books bk on bk.id = ub.book_id
    left join visible_leaves vl on vl.user_book_id = ub.id
    where ub.user_id = p_owner_id and ub.status in ('reading', 'completed', 'aborted')
    group by ub.id, ub.book_id, ub.status, ub.started_at, bk.id, bk.title, bk.author, bk.cover_url, bk.total_pages
  ), candidate_rows as (
    select wb.book_id, wb.created_at as sort_at, jsonb_build_object(
      'book_id', wb.book_id, 'status', 'wish',
      'visible_leaf_count', 0,
      'book', jsonb_build_object(
        'id', bk.id, 'title', bk.title, 'author', bk.author,
        'cover_url', bk.cover_url, 'total_pages', bk.total_pages
      )
    ) as payload
    from public.wish_books wb join public.books bk on bk.id = wb.book_id
    where wb.user_id = p_owner_id
      and not exists (
        select 1 from public.user_books existing
        where existing.user_id = wb.user_id and existing.book_id = wb.book_id
      )
  )
  select jsonb_build_object(
    'owner', jsonb_build_object('id', u.id, 'handle', u.handle, 'display_name', u.display_name, 'avatar_url', u.avatar_url),
    'branches', coalesce((select jsonb_agg(payload order by sort_at desc, book_id) from branch_rows), '[]'::jsonb)
      || coalesce((select jsonb_agg(payload order by sort_at desc, book_id) from candidate_rows), '[]'::jsonb),
    'branch_count', (select count(*) from branch_rows) + (select count(*) from candidate_rows),
    'visible_leaf_count', coalesce((select sum((payload ->> 'visible_leaf_count')::int) from branch_rows), 0)
  ) into v_result
  from public.users u where u.id = p_owner_id;

  if v_result is null then
    raise exception 'friend_tree_forbidden' using errcode = '42501';
  end if;
  return v_result;
end;
$$;
revoke all on function public.friend_book_tree(uuid) from public, anon;
grant execute on function public.friend_book_tree(uuid) to authenticated;

-- 선택한 가지의 viewer-visible 잎만 제한적으로 페이지 조회한다. 첫 tree 응답에는 본문을 넣지 않아
-- 대량 계정의 단일 JSON/DOM 폭증과 선택하지 않은 문장 원문의 과다 전송을 피한다.
create or replace function public.friend_book_tree_leaves(
  p_owner_id uuid,
  p_book_id uuid,
  p_offset integer default 0,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
  v_owner boolean;
  v_mutual boolean;
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_result jsonb;
begin
  if v_viewer is null or p_owner_id is null or p_book_id is null then
    raise exception 'friend_tree_forbidden' using errcode = '42501';
  end if;
  v_owner := v_viewer = p_owner_id;

  select exists (
    select 1 from public.follows a
    join public.follows b
      on b.follower_id = p_owner_id and b.following_id = v_viewer
    where a.follower_id = v_viewer and a.following_id = p_owner_id
  ) into v_mutual;

  if not v_owner and (
    not v_mutual
    or not public.moderation_user_visible(p_owner_id)
    or not public.friend_book_tree_sharing_enabled(p_owner_id)
  ) then
    raise exception 'friend_tree_forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_books ub
    where ub.user_id = p_owner_id and ub.book_id = p_book_id
      and ub.status in ('reading', 'completed', 'aborted')
  ) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(payload order by created_at desc, id), '[]'::jsonb)
  into v_result
  from (
    select s.id, s.created_at, jsonb_build_object(
      'id', s.id,
      'page', s.page,
      'text', s.text,
      'visibility', s.visibility,
      'created_at', s.created_at
    ) as payload
    from public.sentences s
    join public.user_books ub on ub.id = s.user_book_id
    where s.user_id = p_owner_id
      and ub.user_id = p_owner_id
      and ub.book_id = p_book_id
      and ub.status in ('reading', 'completed', 'aborted')
      and (v_owner or s.visibility in ('public', 'followers', 'friends'))
      and not exists (
        select 1 from public.moderation_hidden_sentences h where h.sentence_id = s.id
      )
      and not exists (
        select 1 from public.moderation_reports r
        where r.reporter_id = v_viewer and r.target_type = 'sentence'
          and r.target_id = s.id and r.status <> 'dismissed'
      )
    order by s.created_at desc, s.id
    offset v_offset limit v_limit
  ) leaves_page;
  return v_result;
end;
$$;
revoke all on function public.friend_book_tree_leaves(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.friend_book_tree_leaves(uuid, uuid, integer, integer) to authenticated;

create or replace function public.friend_book_tree_set_sharing(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_value jsonb;
begin
  if v_uid is null or p_enabled is null then
    raise exception 'friend_tree_forbidden' using errcode = '42501';
  end if;
  v_value := jsonb_build_object(
    'policy_version', '2026-08-23',
    'opted_out', not p_enabled,
    'revoked_at', case when p_enabled then null else to_jsonb(clock_timestamp()) end
  );
  update public.users
    set settings = jsonb_set(
      case when jsonb_typeof(settings) = 'object' then settings else '{}'::jsonb end,
      '{friend_tree_sharing}', v_value, true
    )
    where id = v_uid;
  if not found then raise exception 'friend_tree_forbidden' using errcode = '42501'; end if;
  return jsonb_build_object('enabled', p_enabled);
end;
$$;
revoke all on function public.friend_book_tree_set_sharing(boolean) from public, anon;
grant execute on function public.friend_book_tree_set_sharing(boolean) to authenticated;
