-- =====================================================================
-- ReadingGo — 43_checkin_atomic.sql  (#1161 체크인 원자 트랜잭션)
-- schema.sql 이후 실행. 재실행 안전(create or replace).
--
-- 문제: 로그인 체크인(datastore-supabase.js sessions.addToday)이 순차 네트워크
--   쓰기 3개 — user_books.current_page / reading_sessions upsert / streak bump —
--   를 트랜잭션 없이 실행. 중간 실패 시 부분상태(진도만 오르고 세션 없음, 또는
--   세션만 있고 스트릭 미반영)가 남는다. (XP increment_xp 는 별도 원자 RPC 유지 — 무관.)
-- 픽스: 세 쓰기를 한 plpgsql 함수 본문(=단일 트랜잭션)으로 묶어 함께 커밋/롤백.
--   security invoker → 호출자 권한 실행, RLS(user_id = auth.uid())가 그대로 적용.
--
-- 스트릭 규칙은 datastore.js `_nextStreak` (systems.md §6.1)의 SSOT 를 그대로 복제:
--   같은 날 재체크인 → 불변(no-op) · 정확히 +1일 → current+1 · 그 외(공백/최초) → 1.
--   이 SQL 은 그 규칙의 *중복본*이다. _nextStreak 변경 시 반드시 함께 갱신할 것.
--
-- p_today: 클라 로컬 날짜(_today()). 서버 current_date 는 UTC 라 KST 자정~오전9시
--   구간에서 하루 어긋나 세션/스트릭 날짜가 틀어진다 → 클라 로컬 날짜를 넘겨받는다
--   (기존 addToday 가 _today() 로 계산하던 것과 동일 동작 보존). default 는 안전망.
-- =====================================================================

create or replace function public.checkin_atomic(
  p_user_book_id uuid,
  p_page int,
  p_duration int,
  p_today date default current_date
)
returns public.reading_sessions
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_uid          uuid := auth.uid();
  v_owner        uuid;
  v_ub_page      int;
  v_dur_base     int := greatest(coalesce(p_duration, 0), 0);   -- duration>0 ? duration : 0
  v_pages_today  int := 0;
  v_duration_today int;
  v_delta        int;
  v_prev_pages   int;
  v_prev_dur     int;
  v_streak       public.streak%rowtype;
  v_cur          int;
  v_longest      int;
  v_session      public.reading_sessions%rowtype;
begin
  v_duration_today := v_dur_base;

  -- 소유권 확인 — 본인 책이 아니면 예외(RLS 로도 write 0행이 되지만 명확히 실패시킴).
  select user_id, current_page into v_owner, v_ub_page
    from public.user_books where id = p_user_book_id;
  if v_owner is null then
    raise exception 'checkin_atomic: user_book % not found', p_user_book_id;
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'checkin_atomic: not owner';
  end if;

  -- 진도/누적쪽수/누적시간 계산 (addToday 로직 그대로) — page 가 주어질 때만.
  if p_page is not null then
    v_delta := greatest(0, p_page - coalesce(v_ub_page, 0));   -- 재독(음수) → 0 클램프
    select pages_read_today, duration_sec into v_prev_pages, v_prev_dur
      from public.reading_sessions
      where user_book_id = p_user_book_id and session_date = p_today;
    v_pages_today := coalesce(v_prev_pages, 0) + v_delta;
    v_duration_today := v_dur_base + coalesce(v_prev_dur, 0);
    -- current_page 덮어쓰기(#1203 재독 시 하향도 허용).
    update public.user_books set current_page = p_page where id = p_user_book_id;
  end if;

  -- 세션 upsert (그날 1행, 같은 날 재호출 시 누적값으로 덮어씀).
  insert into public.reading_sessions
      (user_book_id, user_id, session_date, current_page, pages_read_today, duration_sec)
    values
      (p_user_book_id, v_uid, p_today, p_page, v_pages_today, v_duration_today)
  on conflict (user_book_id, session_date) do update
    set current_page     = excluded.current_page,
        pages_read_today = excluded.pages_read_today,
        duration_sec     = excluded.duration_sec,
        user_id          = excluded.user_id
  returning * into v_session;

  -- 스트릭 bump (bumpOnCheckIn 그대로): 스트릭 행이 있고, 오늘 아직 체크인 안 했을 때만.
  select * into v_streak from public.streak where user_id = v_uid;
  if found and v_streak.last_check_in_date is distinct from p_today then
    v_cur := 1;                                        -- 공백/최초 → 1
    if v_streak.last_check_in_date is not null
       and (p_today - v_streak.last_check_in_date) = 1 then
      v_cur := coalesce(v_streak.current, 0) + 1;      -- 정확히 +1일 → 연속
    end if;
    v_longest := greatest(coalesce(v_streak.longest, 0), v_cur);
    update public.streak
      set current = v_cur, longest = v_longest, last_check_in_date = p_today
      where user_id = v_uid;
  end if;

  return v_session;
end;
$fn$;

grant execute on function public.checkin_atomic(uuid, int, int, date) to authenticated;
