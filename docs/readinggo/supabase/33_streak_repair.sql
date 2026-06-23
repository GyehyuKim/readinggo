-- 33_streak_repair.sql
-- #938: 스트릭 '하루 만회'(복구·유예) — systems.md §6.1.
-- 깨진 스트릭을 주 1회·조건 없이 하루치 되살린다. 마지막 만회 일자를 기록해 주 1회 쿨다운을 강제.
-- 코드: DataStore.streak.repair/repairStatus (datastore.js · datastore-supabase.js). 정책 SSOT = _streakRepairStatus.
-- 적용: admin-cli.mjs sql 33_streak_repair.sql (또는 Supabase SQL Editor). 멱등(if not exists).

alter table public.streak
  add column if not exists last_repair_date date;

comment on column public.streak.last_repair_date is
  '스트릭 마지막 하루 만회 일자(#938). 주 1회(7일) 쿨다운 기준 — _streakRepairStatus 정책.';
