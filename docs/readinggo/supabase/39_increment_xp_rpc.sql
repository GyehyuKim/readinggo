-- =====================================================================
-- ReadingGo — 39_increment_xp_rpc.sql  (#1161 XP 원자 increment)
-- schema.sql 이후 실행. 재실행 안전(create or replace).
--
-- 문제: 클라 xp.add 가 read-modify-write(cur = xp; update xp=cur+amount) →
--   두 탭/체크인 경로가 경쟁하면 한 증가분이 덮여 XP 유실.
-- 픽스: 단일 UPDATE 원자 increment RPC. security invoker → RLS users_upd
--   (본인 행) 적용, xp 컬럼만 변경(#1164 is_admin 트리거 무영향).
-- 검증(2026-07-09): 유저 세션에서 increment_xp(7) → xp 0→7 원자 반영.
-- =====================================================================

create or replace function public.increment_xp(p_amount int)
returns int language sql security invoker set search_path = public as $fn$
  update public.users set xp = greatest(0, coalesce(xp, 0) + coalesce(p_amount, 0))
  where id = auth.uid()
  returning xp;
$fn$;

grant execute on function public.increment_xp(int) to authenticated;
