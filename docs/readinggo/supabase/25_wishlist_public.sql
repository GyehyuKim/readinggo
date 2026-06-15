-- =====================================================================
-- ReadingGo — 25_wishlist_public.sql : 위시리스트 선택적 공개 (#558)
--
-- 변경 내용:
--   1. users.wishlist_public (boolean, 기본 false) 컬럼 추가
--   2. wish_books 의 wish_all 정책을 아래 규칙으로 교체:
--      SELECT : 소유자(user_id = auth.uid())
--               OR 대상 user 의 wishlist_public = true
--      INSERT/UPDATE/DELETE : 소유자만 (user_id = auth.uid())
--
-- 재실행 안전 (if not exists / drop policy 후 create).
-- ⚠️ 라이브 DB에 직접 적용하지 않는다 — PR 머지 후 수동 실행.
--    적용: node docs/readinggo/supabase/admin-cli.mjs sql 25_wishlist_public.sql
-- =====================================================================

-- 1. users 테이블에 wishlist_public 컬럼 추가 (멱등)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wishlist_public BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.wishlist_public IS
  '#558 v8.2: 위시리스트 타인 공개 여부. true=타인도 SELECT 가능, false(기본)=본인만.';

-- 2. wish_books RLS 정책 교체
--    기존 wish_all (FOR ALL using/with check = user_id=auth.uid()) 을 제거하고
--    SELECT 와 쓰기를 분리한다.
DROP POLICY IF EXISTS wish_all ON public.wish_books;

-- SELECT: 소유자 OR 대상 user 의 wishlist_public = true
CREATE POLICY wish_sel ON public.wish_books
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = wish_books.user_id
        AND u.wishlist_public = TRUE
    )
  );

-- INSERT: 소유자만
CREATE POLICY wish_ins ON public.wish_books
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: 소유자만
CREATE POLICY wish_upd ON public.wish_books
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: 소유자만
CREATE POLICY wish_del ON public.wish_books
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================================
-- 끝.
-- 주의: users_upd 정책 (id = auth.uid()) 은 변경 없음 — profile.update 로
--       wishlist_public 을 쓰는 것은 기존 정책이 커버한다.
-- =====================================================================
