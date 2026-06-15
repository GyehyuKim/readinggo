-- 26_social_newcomers_rolling.sql
-- #576: 소셜(피드) 탭 '새로 시작한 책' 랭킹 윈도우 — 주간 경계 → 롤링 7일.
--
-- 기존 17_social_newcomers.sql 은 `started_at >= date_trunc('week', now())` (월요일 00:00 UTC).
-- 매주 월요일 리셋 직후 새 시작이 쌓이기 전까지 RPC 가 0건 → 섹션이 통째로 사라지는 버그(#576).
-- 실측: 이번주(월~,UTC) 1권 / 최근 7일 6권 / 최근 14일 501권(시드 덤프).
-- → 롤링 7일이 스위트스폿(Top5 채워짐 + 시드 덤프 제외 + 월요일 절벽 제거).
--
-- 함수명·시그니처·반환 컬럼은 그대로 유지(클라 startedThisWeek 호출부 무변경). 윈도우만 교체.
-- 적용: admin-cli.mjs sql 26_social_newcomers_rolling.sql (또는 Supabase SQL Editor)

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
  where ub.started_at >= now() - interval '7 days'   -- #576: 롤링 7일 (was date_trunc('week', now()))
  group by ub.book_id, b.title, b.author, b.cover_url
  order by starters desc, max(ub.started_at) desc
  limit greatest(1, coalesce(lim, 3))
$$;

grant execute on function public.social_newcomers_weekly(int) to anon, authenticated;
