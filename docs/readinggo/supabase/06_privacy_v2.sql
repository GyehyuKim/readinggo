-- 06_privacy_v2.sql
-- sentences.visibility 3단계 (public|followers|private) + RLS 업데이트
-- 적용: node docs/readinggo/supabase/admin-cli.mjs sql 06_privacy_v2.sql
-- v7.1 is_private(binary) → v7.2 visibility(3단계) 확장

-- =====================================================================
-- 1. visibility 컬럼 추가
-- =====================================================================
ALTER TABLE public.sentences
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

-- =====================================================================
-- 2. 기존 is_private 데이터 마이그레이션
-- =====================================================================
UPDATE public.sentences SET visibility = 'private' WHERE is_private = true;
UPDATE public.sentences SET visibility = 'public'  WHERE is_private = false OR is_private IS NULL;

-- =====================================================================
-- 3. CHECK 제약 추가 (NOT VALID: 기존 데이터 검사 스킵, 라이브 테이블 안전)
-- =====================================================================
ALTER TABLE public.sentences
  ADD CONSTRAINT sentences_visibility_chk
  CHECK (visibility IN ('public', 'followers', 'private')) NOT VALID;

-- =====================================================================
-- 4. RLS: 기존 is_private 기반 정책 제거 → visibility 기반 정책으로 교체
--    public    : 누구나
--    followers : 작성자 본인 OR 상호 팔로워(양방향 follows 존재)
--    private   : 작성자 본인만
-- =====================================================================
DROP POLICY IF EXISTS sent_sel ON public.sentences;

CREATE POLICY sent_sel ON public.sentences FOR SELECT USING (
  visibility = 'public'
  OR user_id = auth.uid()
  OR (
    visibility = 'followers'
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = sentences.user_id
    )
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = sentences.user_id AND following_id = auth.uid()
    )
  )
);

-- =====================================================================
-- 끝. note_private(감상 비공개)·쓰기 정책(sent_mod)은 변경 없음.
-- is_private 컬럼은 deprecated — 신규 코드는 visibility 사용.
-- =====================================================================
