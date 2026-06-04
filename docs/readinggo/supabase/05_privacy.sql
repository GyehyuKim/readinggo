-- =====================================================================
-- ReadingGo — 05_privacy.sql : 한 문장/감상 공개·비공개 (QA #12)
--
-- is_private  : 한 문장 자체를 비공개로(본인만). RLS 로 서버 강제.
-- note_private: 감상(my_note)만 비공개로. 컬럼 단위라 RLS 로는 못 막아
--               클라이언트 표시 단계에서 존중(베타: soft). 본문 text 는 공개 유지.
-- 재실행 안전(if not exists / drop policy 후 create). 적용: node admin-cli.mjs sql 05_privacy.sql
-- =====================================================================

alter table public.sentences add column if not exists is_private   boolean not null default false;
alter table public.sentences add column if not exists note_private boolean not null default false;

-- 비공개 한 문장은 작성자에게만 보이도록 select 정책 갱신(피드·타인프로필 자동 반영).
drop policy if exists sent_sel on public.sentences;
create policy sent_sel on public.sentences for select using (
  is_private = false or user_id = auth.uid()
);

-- =====================================================================
-- 끝. 쓰기 정책(sent_mod: user_id=auth.uid())은 schema.sql 그대로 — 본인만 토글.
-- =====================================================================
