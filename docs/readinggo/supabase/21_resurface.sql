-- 시간차 되감기 (#346, resurface.md §4) — 마지막 재소환 일시.
-- companion_sessions.is_resurface 는 18_companion_sessions.sql 에 이미 존재(스펙의 resurfaced 와 동일 용도).
alter table public.sentences
  add column if not exists last_resurfaced_at timestamptz;

comment on column public.sentences.last_resurfaced_at is
  '시간차 되감기(#346) — 이 문장이 마지막으로 재소환된 일시. null=한 번도 안 됨.';
