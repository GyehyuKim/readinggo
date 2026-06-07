-- 17_social_newcomers.sql
-- social.md §5.7 "이번 주 신규 독서 시작러 Top3"
-- 이번 주(월~일, date_trunc('week') = 월요일 00:00 UTC) 새로 시작한 user_books 기준
-- 책별 시작자 수(distinct user) 상위 N권을 반환.
--
-- 공개 집계(비-admin): 사용자 PII 없이 책 메타 + 집계 카운트만 반환하므로
-- SECURITY DEFINER 로 user_books RLS 를 우회해도 안전. (admin_popular_books 와 달리 is_admin 게이트 없음)
-- 적용: Supabase SQL Editor 또는 admin-cli.mjs sql 17_social_newcomers.sql

create or replace function public.social_newcomers_weekly(lim int default 3)
returns table(book_id uuid, title text, author text, cover_url text, starters bigint)
language sql
security definer
stable
set search_path = public
as $$
  select ub.book_id, b.title, b.author, b.cover_url,
         count(distinct ub.user_id) as starters
  from public.user_books ub
  join public.books b on b.id = ub.book_id
  where ub.started_at >= date_trunc('week', now())
  group by ub.book_id, b.title, b.author, b.cover_url
  order by starters desc, max(ub.started_at) desc
  limit greatest(1, coalesce(lim, 3))
$$;

grant execute on function public.social_newcomers_weekly(int) to anon, authenticated;
