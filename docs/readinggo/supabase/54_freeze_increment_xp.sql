-- =====================================================================
-- ReadingGo — 54_freeze_increment_xp.sql  (#1453 Phase 3-B)
-- schema.sql + 39_increment_xp_rpc.sql 이후 실행. 재실행 안전.
--
-- v17 책나무 전환 후 XP는 신규 사용자 경험의 정본이 아니다. 구 APK가 계속
-- increment_xp(int)를 호출해도 404/함수 없음으로 깨지지 않도록 서명·권한은
-- 유지하되, 기존 XP를 읽어 반환만 하고 users 행은 변경하지 않는다.
-- 기존 users.xp 값과 컬럼은 보존한다. Production 적용은 별도 승인 대상이다.
-- =====================================================================

create or replace function public.increment_xp(p_amount int)
returns int language sql security invoker set search_path = public as $fn$
  select coalesce((
    select xp
    from public.users
    where id = auth.uid()
  ), 0);
$fn$;

grant execute on function public.increment_xp(int) to authenticated;

comment on function public.increment_xp(int) is
  'Legacy compatibility no-op: returns current XP without mutating users.xp (#1453 Phase 3-B).';
