-- 29_admin_insights_v2.sql
-- 운영 대시보드 고도화 (#744 ③): 완독률 · 가입 코호트 리텐션 · 콘텐츠 공명.
-- 전역 집계라 RLS 우회 필요 → SECURITY DEFINER + 본문 is_admin() 가드(비admin 호출 시 빈/0 결과).
-- 원시 행/식별정보 노출 금지, 집계만 반환(analytics.md §7).
-- 적용(수동): node docs/readinggo/supabase/admin-cli.mjs sql 29_admin_insights_v2.sql

-- 1) 완독률 — user_books status 분포 (등록 대비 완독 비율).
create or replace function public.admin_completion_stats()
returns table(total int, completed int, reading int, aborted int, completion_rate numeric)
language sql security definer set search_path = public as $$
  select
    count(*)::int,
    count(*) filter (where status = 'completed')::int,
    count(*) filter (where status = 'reading')::int,
    count(*) filter (where status = 'aborted')::int,
    round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0), 1)
  from public.user_books
  where public.is_admin();
$$;

-- 2) 가입 코호트 리텐션 — 가입 주차 코호트 × N주 후 체크인(reading_sessions) 잔존. NPC 제외.
--    week_offset 0 = 가입 주. retained = 그 주에 체크인한 코호트 인원(distinct).
create or replace function public.admin_cohort_retention(weeks int default 8)
returns table(cohort_week date, cohort_size int, week_offset int, retained int)
language sql security definer set search_path = public as $$
  with u as (
    select id, date_trunc('week', created_at)::date as cw
    from public.users
    where public.is_admin() and not coalesce(is_npc, false)
  ),
  sizes as (
    select cw, count(*)::int as cohort_size from u group by cw
  ),
  s as (
    select distinct user_id, date_trunc('week', session_date)::date as sw
    from public.reading_sessions
  ),
  ret as (
    select u.cw,
           ((s.sw - u.cw) / 7)::int as week_offset,
           count(distinct u.id)::int as retained
    from u
    join s on s.user_id = u.id and s.sw >= u.cw
    where ((s.sw - u.cw) / 7) between 0 and greatest(0, weeks)
    group by u.cw, ((s.sw - u.cw) / 7)
  )
  select r.cw, z.cohort_size, r.week_offset, r.retained
  from ret r
  join sizes z on z.cw = r.cw
  order by r.cw, r.week_offset;
$$;

-- 3) 콘텐츠 공명 — 짹(claps) 많은 공개 한 문장 Top. 익명 집계(작성자 식별 제외).
create or replace function public.admin_content_resonance(lim int default 10)
returns table(sentence_id uuid, sentence_text text, book_title text, claps int)
language sql security definer set search_path = public as $$
  select s.id,
         left(s.text, 120),
         b.title,
         count(c.id)::int as claps
  from public.sentences s
  join public.user_books ub on ub.id = s.user_book_id
  join public.books b on b.id = ub.book_id
  join public.claps c on c.to_sentence_id = s.id
  where public.is_admin()
    and coalesce(s.visibility, 'public') = 'public'
  group by s.id, s.text, b.title
  order by claps desc, s.created_at desc
  limit greatest(1, lim);
$$;

grant execute on function public.admin_completion_stats() to authenticated;
grant execute on function public.admin_cohort_retention(int) to authenticated;
grant execute on function public.admin_content_resonance(int) to authenticated;
