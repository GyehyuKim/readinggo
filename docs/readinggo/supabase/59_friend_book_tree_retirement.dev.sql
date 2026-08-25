-- 59_friend_book_tree_retirement.dev.sql
-- #1389/#1454: retired 책나무 서버 표면을 stable DEV에서도 제거한다.
-- Production은 승인 없이 이 migration을 적용하지 않는다. 각 명령은 재실행 가능하다.

begin;

drop function if exists public.friend_book_tree_leaves(uuid, uuid, integer, integer);
drop function if exists public.friend_book_tree(uuid);
drop function if exists public.friend_book_tree_sharing_status();
drop function if exists public.friend_book_tree_set_sharing(boolean);
drop function if exists public.friend_book_tree_sharing_enabled(uuid);

-- retired 기능의 opt-in/out 상태도 active settings surface에서 제거한다.
update public.users
set settings = settings - 'friend_tree_sharing'
where jsonb_typeof(settings) = 'object'
  and settings ? 'friend_tree_sharing';

commit;
