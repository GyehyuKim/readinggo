-- 18_companion_sessions.sql — LLM 독서 파트너 대화 아카이브 (#295, analytics.md §4)
-- 멀티턴 대화(질문/답변)를 익명 집계용으로 저장. 동의(consented) 유저만 집계 뷰에 포함.
-- 적용: Supabase SQL Editor에서 1회 실행.

create table if not exists public.companion_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  book_id       uuid references public.books(id) on delete set null,
  sentence      text not null,
  comment       text,
  lens          text,                          -- 감정 | 연결 | 반론 | 투사 | why
  question      text,
  answer        text,
  is_resurface  boolean not null default false,
  consented     boolean not null default true, -- 동의 스냅샷 (작성 시점)
  created_at    timestamptz not null default now()
);

create index if not exists companion_sessions_user_idx on public.companion_sessions(user_id);
create index if not exists companion_sessions_book_idx on public.companion_sessions(book_id);

alter table public.companion_sessions enable row level security;

-- 본인 행만 read/write (집계는 아래 뷰/RPC로 별도).
drop policy if exists companion_sessions_own on public.companion_sessions;
create policy companion_sessions_own on public.companion_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 익명 집계용 뷰 — user_id 제외, 동의 유저만. (book_id별 어떤 문장이 어떤 대화를 유발하는지)
create or replace view public.companion_sessions_agg as
  select book_id, sentence, lens, question, answer, created_at
  from public.companion_sessions
  where consented = true;
