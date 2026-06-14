-- 독서 시간 통계 (#430) — reading_sessions에 duration_sec 누적 컬럼 추가.
-- 읽기 세션 종료 시 타이머(secs)를 누적 저장 → 프로필 "총 독서 시간/일평균" 집계.
alter table public.reading_sessions
  add column if not exists duration_sec int default 0;

comment on column public.reading_sessions.duration_sec is
  '#430: 그날 읽기 세션 누적 시간(초). 같은 날 여러 세션이면 addToday에서 누적.';
