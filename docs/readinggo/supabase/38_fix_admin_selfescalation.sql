-- =====================================================================
-- ReadingGo — 38_fix_admin_selfescalation.sql  (#1164 P0 보안)
-- 관리자 자가승격 차단. schema.sql / 02_admin.sql 이후 실행. 재실행 안전.
--
-- 문제: users_upd RLS 는 `using (id = auth.uid())` 만 있고 WITH CHECK 없음 +
--   authenticated 에 users 전 컬럼 UPDATE grant → 로그인 유저가 자기 행에
--   is_admin=true 로 PATCH → 관리자 승격(전 사용자 문의·통계 열람).
-- 실측(2026-07-08, Codex 감사 #1164): users_upd.with_check=null, is_admin 컬럼
--   authenticated UPDATE grant 존재. 컬럼 revoke 는 테이블 grant 뒤라 무력(password_hash
--   실증) → 트리거로 가드.
--
-- 픽스: BEFORE UPDATE 트리거로 "로그인 유저(비관리자)의 is_admin 변경"만 거부.
--   auth.uid() null(SQL 에디터·서버) 과 실제 관리자는 통과 → 02_admin.sql 의
--   관리자 지정 흐름(SQL 에디터 update) 유지. 다른 컬럼 업데이트에 영향 없음.
-- 검증: 비관리자 세션 is_admin=true → 차단(P0001), display_name 변경 → 통과.
-- =====================================================================

create or replace function public.prevent_user_privilege_escalation()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if (new.is_admin is distinct from old.is_admin)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'is_admin change not permitted (#1164 privilege-escalation guard)';
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_users_no_priv_escalation on public.users;
create trigger trg_users_no_priv_escalation
  before update on public.users
  for each row execute function public.prevent_user_privilege_escalation();
