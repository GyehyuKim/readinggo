-- 13_admin_stats.sql
-- 운영 대시보드 집계를 단일 RPC로 (#256). 기존 클라 count 쿼리(비admin도 콘솔 호출 가능)를
-- SECURITY DEFINER + is_admin() 가드로 옮겨 엄격화. 반환 shape는 기존 admin.stats()와 동일.
-- 적용: node docs/readinggo/supabase/admin-cli.mjs sql 13_admin_stats.sql

create or replace function public.admin_stats()
returns json language sql stable security definer set search_path = public as $$
  select case when not public.is_admin() then '{}'::json
  else json_build_object(
    'users',         (select count(*) from public.users),
    'realUsers',     (select count(*) from public.users where is_npc = false),
    'sentences',     (select count(*) from public.sentences),
    'completed',     (select count(*) from public.user_books where status = 'completed'),
    'todaySessions', (select count(*) from public.reading_sessions where session_date = current_date),
    'trend', (
      select coalesce(json_agg(json_build_object(
        'date', to_char(g.d, 'YYYY-MM-DD'),
        'sessions', (select count(*) from public.reading_sessions r where r.session_date = g.d),
        'signups',  (select count(*) from public.users u where u.is_npc = false and u.created_at::date = g.d)
      ) order by g.d), '[]'::json)
      from generate_series((current_date - 6), current_date, interval '1 day') g(d)
    )
  ) end;
$$;

grant execute on function public.admin_stats() to authenticated;
