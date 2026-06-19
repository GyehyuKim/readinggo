-- 31_seed_queue.sql — 마중물 시드 큐 (#774, seed-collector.md 큐 방식)
--
-- 큐 기반 비동기 온디맨드: 워커(/api/seed)가 stored 없을 때 책을 큐잉(빈 배열 반환),
-- 맥미니 collector 가 seed_queue 를 폴링해 예스24 크롤 → NPC 명의 sentences 적재 → status='done'.
-- Cloudflare Tunnel·인바운드 불필요 — collector 는 Supabase 로 아웃바운드 폴링만 한다.
--
-- 설계:
--   book_key UNIQUE 로 중복 큐잉 방지(워커가 on_conflict do nothing upsert).
--   priority: 유저 온디맨드(high) > 배치 prewarm(low). collector 가 priority desc, created_at asc 로 소진.
--   RLS on / 정책 없음 → service_role(워커·collector)만 접근. 클라 직접 접근 없음.
--
-- 적용(수동): Supabase SQL Editor 붙여넣기 Run, 또는
--   node docs/readinggo/supabase/admin-cli.mjs sql 31_seed_queue.sql
-- (memory: supabase-migrations-manual — .sql 자동적용 안 됨)

create table if not exists public.seed_queue (
  id          uuid primary key default gen_random_uuid(),
  book_key    text not null unique,          -- isbn13(우선) | 정규화 제목(소문자·공백 접기). 중복 큐잉 방지
  title       text not null,
  author      text,
  isbn        text,
  priority    text not null default 'low',   -- high(온디맨드) | low(배치 prewarm)
  status      text not null default 'pending', -- pending | done | failed
  attempts    int  not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_seed_queue_status   on public.seed_queue(status);
-- collector 픽업 순서: pending 을 priority(high 먼저)·오래된 것 먼저.
create index if not exists idx_seed_queue_pickup    on public.seed_queue(status, priority desc, created_at);

-- updated_at 자동 갱신.
create or replace function public.touch_seed_queue() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_touch_seed_queue on public.seed_queue;
create trigger trg_touch_seed_queue before update on public.seed_queue
  for each row execute function public.touch_seed_queue();

-- RLS on, 정책 없음 → anon/authenticated 차단. service_role(워커·collector)만 bypass.
alter table public.seed_queue enable row level security;
