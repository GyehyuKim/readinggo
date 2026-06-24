-- =====================================================================
-- ReadingGo — Supabase 스키마 (Phase 1)
-- backend.md §7.3 데이터 모델 + §7.4 인덱스 + §7.5 RLS
--
-- 실행: Supabase 대시보드 → SQL Editor → 새 쿼리 → 전체 붙여넣기 → Run
-- 재실행 안전(if not exists / drop policy 후 create). auth.users 연동.
-- =====================================================================

create extension if not exists pg_trgm;

-- ── 테이블 ────────────────────────────────────────────────────────────
-- users: auth.users 와 1:1 (id 공유). 공개 프로필.
create table if not exists public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  handle              text unique not null,
  display_name        text,
  avatar_url          text,
  bio                 text,
  timezone            text default 'Asia/Seoul',
  is_npc              boolean not null default false,
  daily_pace          int,
  active_user_book_id uuid,                       -- FK 는 user_books 생성 후 추가(순환 회피)
  settings            jsonb not null default '{}'::jsonb,
  xp                  int not null default 0,
  created_at          timestamptz not null default now()
);

create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  isbn13        text unique,
  title         text not null,
  author        text,
  publisher     text,
  total_pages   int,
  cover_url     text,
  -- 알라딘/외서 무료 메타 (#489, 24_aladin_meta.sql) — normalize()가 채워 upsert. 외서·LLM은 가용 필드만.
  description          text,
  full_description     text,
  subtitle             text,
  original_title       text,
  pub_date             date,
  category_id          int,
  category_name        text,
  toc                  text,
  story                text,
  price_standard       int,
  price_sales          int,
  customer_review_rank smallint,
  sales_point          int,
  aladin_link          text,
  adult                boolean,
  source               text,
  enriched_at          timestamptz,
  rank_recent   int,
  rank_steady   int,
  created_at    timestamptz not null default now()
);

create table if not exists public.user_books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  book_id       uuid not null references public.books(id),
  status        text not null default 'reading',   -- 'reading' | 'completed' | 'aborted'(#593 중단, 되돌리기 가능) | 'archived'(예약, 미사용)
  current_page  int not null default 0,
  rating        numeric(2,1),                       -- 완독 별점 0.5~5 (0.5 단위, 반별점)
  review_text   text,
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  unique (user_id, book_id)
);

alter table public.users
  drop constraint if exists users_active_ub_fk,
  add  constraint users_active_ub_fk
    foreign key (active_user_book_id) references public.user_books(id) on delete set null;

create table if not exists public.reading_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_book_id     uuid not null references public.user_books(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  session_date     date not null,
  current_page     int,
  pages_read_today int,
  duration_sec     int default 0,   -- #430: 그날 읽기 세션 누적 시간(초)
  xp_earned        int,
  created_at       timestamptz not null default now(),
  unique (user_book_id, session_date)
);

create table if not exists public.sentences (             -- "한 문장" (테이블명 유지)
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  user_book_id  uuid not null references public.user_books(id) on delete cascade,
  session_id    uuid references public.reading_sessions(id) on delete set null,
  page          int,                                -- 스포일러 블라인드 판정 기준
  text          text not null,                      -- 인용 ≤200자
  my_note       text,                               -- 사후 감상(선택, 사후 추가·편집)
  created_at    timestamptz not null default now()
);

create table if not exists public.streak (
  user_id              uuid primary key references public.users(id) on delete cascade,
  current              int not null default 0,
  longest              int not null default 0,
  last_check_in_date   date,
  shields_remaining    int not null default 0,
  first_shield_granted boolean not null default false
);

create table if not exists public.shield_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  consumed_at  timestamptz not null default now(),
  refunded     boolean not null default false
);

create table if not exists public.follows (
  follower_id   uuid not null references public.users(id) on delete cascade,
  following_id  uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id)
);

create table if not exists public.claps (                -- "짹" = 한 문장 좋아요
  id              uuid primary key default gen_random_uuid(),
  from_user_id    uuid not null references public.users(id) on delete cascade,
  to_sentence_id  uuid not null references public.sentences(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (from_user_id, to_sentence_id)
);

create table if not exists public.pokes (                -- "콕찌르기" 🪱 (일 1회)
  id              uuid primary key default gen_random_uuid(),
  from_user_id    uuid not null references public.users(id) on delete cascade,
  to_user_id      uuid not null references public.users(id) on delete cascade,
  day             date not null,
  created_at      timestamptz not null default now(),
  unique (from_user_id, to_user_id, day)
);

create table if not exists public.npc_sentence_seeds (
  id        uuid primary key default gen_random_uuid(),
  npc_id    uuid not null references public.users(id) on delete cascade,
  text      text not null,
  weight    int not null default 1
);

create table if not exists public.wish_books (           -- 관심 책
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.sentence_bookmarks (   -- DEPRECATED (#641): claps(좋아요)로 흡수. 신규 쓰기 없음, 롤백 안전상 보존 (28_deprecate_bookmarks.sql)
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  sentence_id  uuid not null references public.sentences(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, sentence_id)
);

-- 마을(village)/방(room, co-reading) — 스키마 owner=backend(계휴). 같은 책 그룹.
-- capacity/status 는 16_village_board.sql, password/invite_token 은 34_co_reading_rooms.sql 에서 추가됨
-- (이 정의는 신규 프로젝트용 통합 참조 — 마이그레이션 파일이 적용 진실원천).
create table if not exists public.villages (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books(id),
  name          text not null,
  description   text,
  visibility    text not null default 'public',     -- 'public' | 'private'
  invite_code   text unique,                         -- 6자리 사람용 코드
  invite_token  text unique,                         -- 토큰 URL 입장 (co-reading §5.2)
  password      text,                                -- 비공개 방 선택적 비밀번호 (co-reading §5.2)
  capacity      int,                                 -- 정원(선택, 최소 2)
  status        text not null default 'active',
  created_by    uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create table if not exists public.village_parts (
  id            uuid primary key default gen_random_uuid(),
  village_id    uuid not null references public.villages(id) on delete cascade,
  part_order    int not null,
  title         text,
  end_page      int,
  due_date      date,
  unique (village_id, part_order)
);

create table if not exists public.village_members (
  village_id    uuid not null references public.villages(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  primary key (village_id, user_id)
);

-- ── 인덱스 (§7.4) ─────────────────────────────────────────────────────
create index if not exists idx_follows_follower    on public.follows(follower_id);
create index if not exists idx_follows_following    on public.follows(following_id);
create index if not exists idx_sentences_user_created on public.sentences(user_id, created_at desc);
create index if not exists idx_sentences_ub_created   on public.sentences(user_book_id, created_at);
create index if not exists idx_sessions_user_date     on public.reading_sessions(user_id, session_date desc);
create index if not exists idx_books_rank_recent      on public.books(rank_recent);
create index if not exists idx_books_rank_steady      on public.books(rank_steady);
create index if not exists idx_claps_sentence         on public.claps(to_sentence_id);
create index if not exists idx_pokes_to_day           on public.pokes(to_user_id, day);
create index if not exists idx_wish_user_created      on public.wish_books(user_id, created_at desc);
create index if not exists idx_bookmarks_user_created on public.sentence_bookmarks(user_id, created_at desc);
create index if not exists idx_vmembers_user          on public.village_members(user_id);
create index if not exists idx_vmembers_village        on public.village_members(village_id);
create index if not exists idx_vparts_village_order    on public.village_parts(village_id, part_order);
create index if not exists idx_users_handle_trgm  on public.users using gin (handle gin_trgm_ops);
create index if not exists idx_books_title_trgm   on public.books using gin (title gin_trgm_ops);

-- ── 신규 가입 시 프로필+스트릭 자동 생성 (onboarding §7.7) ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, handle, display_name, avatar_url)
  values (
    new.id,
    'reader_' || substr(replace(new.id::text, '-', ''), 1, 8),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '독자'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.streak (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS (§7.5) ────────────────────────────────────────────────────────
alter table public.users              enable row level security;
alter table public.books              enable row level security;
alter table public.user_books         enable row level security;
alter table public.reading_sessions   enable row level security;
alter table public.sentences          enable row level security;
alter table public.streak             enable row level security;
alter table public.shield_log         enable row level security;
alter table public.follows            enable row level security;
alter table public.claps              enable row level security;
alter table public.pokes              enable row level security;
alter table public.npc_sentence_seeds enable row level security;
alter table public.wish_books         enable row level security;
alter table public.sentence_bookmarks enable row level security;
alter table public.villages           enable row level security;
alter table public.village_parts      enable row level security;
alter table public.village_members    enable row level security;

-- users: 모두 select(피드 공개정보), 본인 row 만 insert/update
drop policy if exists users_sel on public.users;
create policy users_sel on public.users for select using (true);
drop policy if exists users_ins on public.users;
create policy users_ins on public.users for insert with check (id = auth.uid());
drop policy if exists users_upd on public.users;
create policy users_upd on public.users for update using (id = auth.uid());

-- books: 공개 카탈로그 select, 로그인 사용자 insert/update (알라딘 등록·upsert)
drop policy if exists books_sel on public.books;
create policy books_sel on public.books for select using (true);
drop policy if exists books_ins on public.books;
create policy books_ins on public.books for insert with check (auth.uid() is not null);
drop policy if exists books_upd on public.books;
create policy books_upd on public.books for update using (auth.uid() is not null);

-- user_books / reading_sessions / streak: select 모두(마을·완독 공개), 본인만 write
drop policy if exists ub_sel on public.user_books;
create policy ub_sel on public.user_books for select using (true);
drop policy if exists ub_mod on public.user_books;
create policy ub_mod on public.user_books for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sess_sel on public.reading_sessions;
create policy sess_sel on public.reading_sessions for select using (true);
drop policy if exists sess_mod on public.reading_sessions;
create policy sess_mod on public.reading_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists streak_sel on public.streak;
create policy streak_sel on public.streak for select using (true);
drop policy if exists streak_mod on public.streak;
create policy streak_mod on public.streak for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- sentences: 모두 select(스포일러는 클라 페이지 블라인드), 본인만 write
drop policy if exists sent_sel on public.sentences;
create policy sent_sel on public.sentences for select using (true);
drop policy if exists sent_mod on public.sentences;
create policy sent_mod on public.sentences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- shield_log: 본인만
drop policy if exists shield_all on public.shield_log;
create policy shield_all on public.shield_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- follows: select 모두, 본인이 follower 인 행만 insert/delete
drop policy if exists follows_sel on public.follows;
create policy follows_sel on public.follows for select using (true);
drop policy if exists follows_mod on public.follows;
create policy follows_mod on public.follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- claps: select 모두(카운트), 본인 from 만 insert/delete
drop policy if exists claps_sel on public.claps;
create policy claps_sel on public.claps for select using (true);
drop policy if exists claps_mod on public.claps;
create policy claps_mod on public.claps for all using (from_user_id = auth.uid()) with check (from_user_id = auth.uid());

-- pokes: 보낸/받은 사람만 select, 본인 from 만 insert
drop policy if exists pokes_sel on public.pokes;
create policy pokes_sel on public.pokes for select using (from_user_id = auth.uid() or to_user_id = auth.uid());
drop policy if exists pokes_ins on public.pokes;
create policy pokes_ins on public.pokes for insert with check (from_user_id = auth.uid());

-- npc_sentence_seeds: 모두 select
drop policy if exists npc_sel on public.npc_sentence_seeds;
create policy npc_sel on public.npc_sentence_seeds for select using (true);

-- wish_books / sentence_bookmarks: 본인만
drop policy if exists wish_all on public.wish_books;
create policy wish_all on public.wish_books for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists bm_all on public.sentence_bookmarks;
create policy bm_all on public.sentence_bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- SECURITY DEFINER 헬퍼: RLS 우회 멤버십 확인 (순환 참조 방지용)
-- village_members 정책 안에서 village_members 를 직접 조회하면 무한순환 발생.
-- 이 함수는 SECURITY DEFINER 로 RLS 를 우회하므로 순환 없이 멤버십 체크 가능.
create or replace function public.is_village_member(p_village_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.village_members
    where village_id = p_village_id
      and user_id = auth.uid()
  );
$$;

-- villages: 공개 마을·생성자·멤버만 select. insert 로그인. 생성자 update
drop policy if exists villages_sel on public.villages;
create policy villages_sel on public.villages for select using (
  visibility = 'public'
  or created_by = auth.uid()
  or public.is_village_member(id)
);
drop policy if exists villages_ins on public.villages;
create policy villages_ins on public.villages for insert with check (created_by = auth.uid());
drop policy if exists villages_upd on public.villages;
create policy villages_upd on public.villages for update using (created_by = auth.uid());

-- village_parts: 마을 볼 수 있으면 select, 생성자만 write
drop policy if exists vparts_sel on public.village_parts;
create policy vparts_sel on public.village_parts for select using (
  exists (
    select 1 from public.villages v
    where v.id = village_id
      and (v.visibility = 'public' or v.created_by = auth.uid() or public.is_village_member(v.id))
  )
);
drop policy if exists vparts_mod on public.village_parts;
create policy vparts_mod on public.village_parts for all using (
  exists (select 1 from public.villages v where v.id = village_id and v.created_by = auth.uid())
) with check (
  exists (select 1 from public.villages v where v.id = village_id and v.created_by = auth.uid())
);

-- village_members: 본인 가입/탈퇴만, 같은 마을/공개 마을 멤버 select
-- ※ 자기참조(village_members 안에서 village_members 조회) 제거 → is_village_member() 사용
drop policy if exists vmembers_sel on public.village_members;
create policy vmembers_sel on public.village_members for select using (
  user_id = auth.uid()
  or public.is_village_member(village_id)
  or exists (select 1 from public.villages v where v.id = village_id and v.visibility = 'public')
);
drop policy if exists vmembers_mod on public.village_members;
create policy vmembers_mod on public.village_members for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 권한(grant) — RLS 가 행 단위 통제. anon=읽기, authenticated=쓰기 ──────
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- =====================================================================
-- 끝. 재실행 안전. 다음: supabaseAdapter(§7.2) + config.js + 알라딘 프록시.
-- =====================================================================
