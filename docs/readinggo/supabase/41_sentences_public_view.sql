-- 41_sentences_public_view.sql
-- #1166 [P0 출시블로커] my_note(사후 감상) 인증사용자 간 유출 봉쇄.
--
-- 문제: #1165 로 sent_sel = using(auth.uid() is not null) 가 되어, 피드/프로필을 읽는
--   아무 로그인 사용자나 *남의* sentences 행 전체(my_note 포함)를 select 로 가져갈 수 있었다.
--   my_note 는 개인 사후 감상(Q/A 대화·자유 메모)이라 타인에게 보여선 안 된다. `note_private`
--   는 클라 표시 관례일 뿐 DB 강제가 아니다. Postgres 는 테이블 grant 뒤의 컬럼 revoke 가
--   무효(villages.password_hash 로 실증)라 컬럼 회수만으로는 못 막는다.
--
-- 픽스: (a) base 테이블 sentences 의 select 를 본인 행으로 한정(user_id = auth.uid()).
--   (b) 비공개 컬럼(my_note) 을 뺀 공개 뷰 public.sentences_public 을 만들어 피드/프로필이
--   *남의* 문장 본문은 계속 보되 my_note 는 못 읽게 한다. 뷰는 소유자(postgres) 권한으로
--   실행(security definer 기본)돼 base RLS 를 우회하므로 전 공개 문장을 노출하되 my_note 컬럼
--   자체가 없다. (c) 클라 피드 읽기를 이 뷰로 전환(별도 커밋).
-- 유지: 본인 문장 읽기(listMine·listByBook·resurface)는 base 테이블로 — my_note 필요, owner-only RLS 통과.
-- 범위 밖: 문장 본문의 visibility(followers/private) 는 #1165 이후 DB 미강제(전 인증 노출) — 별도 이슈.

-- 1) base 테이블 select 를 본인 행 한정으로 (auth.uid() is not null → user_id = auth.uid())
alter policy sent_sel on public.sentences using (user_id = auth.uid());

-- 2) 공개 뷰 — my_note 제외한 비민감 컬럼만. FK 임베드(user_id→users, user_book_id→user_books,
--    id←claps.sentence_id)가 PostgREST 에서 그대로 해소되도록 FK 컬럼을 모두 노출한다.
create or replace view public.sentences_public as
  select id, user_id, user_book_id, session_id, page, text, created_at
  from public.sentences;

-- 3) 권한 — authenticated 만(anon 은 #1165 방침대로 문장 접근 불가).
--    Supabase 기본 privileges 가 새 뷰를 anon 에도 grant 할 수 있어 명시적으로 회수.
grant select on public.sentences_public to authenticated;
revoke select on public.sentences_public from anon;
