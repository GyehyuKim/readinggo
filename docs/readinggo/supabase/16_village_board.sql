-- 16_village_board.sql
-- 마을 기능 확장: 정원(capacity), 완료 상태(status), 게시판(village_topics/village_opinions)
-- 적용: Supabase Dashboard > SQL Editor 에서 실행

-- ── villages: capacity + status 컬럼 추가 ──────────────────────────────
alter table public.villages add column if not exists capacity int;
alter table public.villages add column if not exists status text not null default 'active';

-- ── village_topics ────────────────────────────────────────────────────
create table if not exists public.village_topics (
  id          uuid primary key default gen_random_uuid(),
  village_id  uuid not null references public.villages(id) on delete cascade,
  title       text not null,
  description text,
  due_days    int not null default 3,
  created_by  uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── village_opinions ──────────────────────────────────────────────────
create table if not exists public.village_opinions (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.village_topics(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

-- ── 인덱스 ──────────────────────────────────────────────────────────
create index if not exists idx_vtopics_village   on public.village_topics(village_id);
create index if not exists idx_vopinions_topic   on public.village_opinions(topic_id);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.village_topics   enable row level security;
alter table public.village_opinions enable row level security;

-- topics: 모두 읽기, 마을 멤버만 등록, 본인·마을 관리자만 수정/삭제
drop policy if exists vtopics_sel on public.village_topics;
create policy vtopics_sel on public.village_topics for select using (true);
drop policy if exists vtopics_ins on public.village_topics;
create policy vtopics_ins on public.village_topics for insert
  with check (auth.uid() = created_by);
drop policy if exists vtopics_upd on public.village_topics;
create policy vtopics_upd on public.village_topics for update
  using (auth.uid() = created_by);
drop policy if exists vtopics_del on public.village_topics;
create policy vtopics_del on public.village_topics for delete
  using (
    auth.uid() = created_by or
    auth.uid() in (select created_by from public.villages where id = village_id)
  );

-- opinions: 모두 읽기, 본인·마을 관리자만 삭제
drop policy if exists vopinions_sel on public.village_opinions;
create policy vopinions_sel on public.village_opinions for select using (true);
drop policy if exists vopinions_ins on public.village_opinions;
create policy vopinions_ins on public.village_opinions for insert
  with check (auth.uid() = author_id);
drop policy if exists vopinions_del on public.village_opinions;
create policy vopinions_del on public.village_opinions for delete
  using (
    auth.uid() = author_id or
    auth.uid() in (
      select v.created_by from public.villages v
      join public.village_topics t on t.village_id = v.id
      where t.id = topic_id
    )
  );
