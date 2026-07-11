-- 44_book_prewarm_rank.sql
-- #1133 Part 1 — 인기 시드 선충전 소스 재설계 (알라딘 베스트셀러 → 내부 유기적 신호).
--
-- 배경: 카카오/국중도엔 베스트셀러 API 가 없어, 신규 키 설치 시 알라딘 archive cron 이 자동 중지되고
--   books.sales_point 가 freeze 된다(#1044 ToS). prewarmSeeds 가 sales_point 상위만 뽑던 걸,
--   우리 유저의 실제 책 채택 수(user_books 수)를 1순위 인기 신호로, 남은 sales_point 를 부트스트랩
--   tiebreak 로 쓰도록 이 뷰를 통해 재설계한다. 유저가 늘수록 인기 신호가 강해진다.
--
-- 집계 뷰 = 크론(service_role) 전용. 클라(anon/authenticated) 노출 불필요 → blanket grant 회수.

create or replace view public.book_prewarm_rank as
  select b.isbn13, b.title, b.author,
         count(ub.id) as adoption,
         b.sales_point
    from public.books b
    left join public.user_books ub on ub.book_id = b.id
   where b.isbn13 is not null
   group by b.id;

revoke select on public.book_prewarm_rank from anon, authenticated;
grant  select on public.book_prewarm_rank to service_role;
