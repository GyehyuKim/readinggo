-- 책 정보 수정(#410) — 출판사·총 페이지수를 공유 카탈로그(books)가 아닌
-- 사용자별 user_books override로 분리 (#431).
-- books 테이블은 알라딘 API·TSV로 채워지는 공유 카탈로그 — 한 유저의 수정이
-- 같은 책 읽는 모든 유저에게 전파되면 안 된다.
alter table public.user_books
  add column if not exists publisher_override   text,
  add column if not exists total_pages_override int;

comment on column public.user_books.publisher_override is
  '#431: 사용자가 BookEditModal에서 수정한 출판사. null=books.publisher 사용.';
comment on column public.user_books.total_pages_override is
  '#431: 사용자가 BookEditModal에서 수정한 총 페이지수. null=books.total_pages 사용.';
