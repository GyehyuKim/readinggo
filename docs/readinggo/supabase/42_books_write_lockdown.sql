-- 42_books_write_lockdown.sql
-- #1191 [보안] books 쓰기 워커 경유 — 카탈로그 오염 차단.
--
-- 문제: public.books 는 전역 공유 카탈로그인데 books_ins/books_upd 정책이
--   with check/using (auth.uid() is not null) 라, 로그인만 하면 아무 사용자나 아무 책의
--   title/author/cover 를 insert/overwrite 할 수 있었다(카탈로그 오염).
--
-- 픽스: authenticated 의 books 쓰기(grant + 정책)를 회수. 클라의 load-bearing books.upsert
--   (검색 raw id → 캐노니컬 id 해소)는 워커 /api/book-upsert(service_role, 입력검증·캡·레이트리밋)로
--   이전(#1191). service_role 은 RLS·grant 를 우회하므로 워커 쓰기는 그대로 동작.
-- 유지: books_sel using(true) — 공개 카탈로그 read(게스트 포함)는 변경 없음.

-- 1) authenticated 의 books 쓰기 권한 회수(방어심층 — 정책이 남아도 테이블 권한 자체가 없음)
revoke insert, update, delete on public.books from authenticated;

-- 2) 무의미해진 write 정책 제거(grant 회수로 이미 차단이나 모델을 명확히)
drop policy if exists books_ins on public.books;
drop policy if exists books_upd on public.books;
