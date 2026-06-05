-- 12_admin_insights.sql
-- 운영 대시보드 C단계(#190): 인기책·활성 사용자(리텐션 프록시).
-- 전역 집계라 RLS 우회 필요 → SECURITY DEFINER + 본문 is_admin() 가드(비admin 호출 시 빈/0 결과).
-- 적용: node docs/readinggo/supabase/admin-cli.mjs sql 12_admin_insights.sql

create or replace function public.admin_popular_books(lim int default 5)
returns table(book_id uuid, title text, registered int, completed int)
language sql security definer set search_path = public as $$
  select b.id, b.title,
    count(ub.id)::int,
    count(ub.id) filter (where ub.status = 'completed')::int
  from public.user_books ub
  join public.books b on b.id = ub.book_id
  where public.is_admin()
  group by b.id, b.title
  order by 3 desc, 4 desc
  limit greatest(1, lim);
$$;

create or replace function public.admin_active_users()
returns table(d7 int, d30 int)
language sql security definer set search_path = public as $$
  select
    count(distinct user_id) filter (where session_date >= current_date - 6)::int,
    count(distinct user_id) filter (where session_date >= current_date - 29)::int
  from public.reading_sessions
  where public.is_admin();
$$;

grant execute on function public.admin_popular_books(int) to authenticated;
grant execute on function public.admin_active_users() to authenticated;
