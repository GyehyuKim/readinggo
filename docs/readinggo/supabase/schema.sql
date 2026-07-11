-- =====================================================================
-- ReadingGo — Supabase 스키마 (Phase 1)
-- backend.md §7.3 데이터 모델 + §7.4 인덱스 + §7.5 RLS
--
-- 실행: Supabase 대시보드 → SQL Editor → 새 쿼리 → 전체 붙여넣기 → Run
-- 재실행 안전(if not exists / drop policy 후 create). auth.users 연동.
-- =====================================================================

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;   -- 숲 비밀번호 bcrypt 해시·검증 (co-reading §6.4, #996)

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
-- capacity/status 는 16_village_board.sql, invite_token 은 34_co_reading_rooms.sql 에서 추가됨.
-- password 는 35_room_password_hash.sql 에서 bcrypt 해시(password_hash)로 격상·평문 제거(#996).
-- (이 정의는 신규 프로젝트용 통합 참조 — 마이그레이션 파일이 적용 진실원천).
create table if not exists public.villages (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books(id),
  name          text not null,
  description   text,
  visibility    text not null default 'public',     -- 'public' | 'private'
  invite_code   text unique,                         -- 6자리 사람용 코드
  invite_token  text unique,                         -- 토큰 URL 입장 (co-reading §5.2)
  password_hash text,                                -- 비공개 방 선택 비번 bcrypt 해시 (co-reading §6.4, #996). 클라 read 차단(아래 REVOKE)
  has_password  boolean not null default false,      -- 비번 걸렸나(비-비밀 플래그) — 미리보기 입력칸 노출 판단 (#996)
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

-- users: 로그인 사용자만 select(#1165 anon PII 차단), 본인 row 만 insert/update
drop policy if exists users_sel on public.users;
create policy users_sel on public.users for select using (auth.uid() is not null);
drop policy if exists users_ins on public.users;
create policy users_ins on public.users for insert with check (id = auth.uid());
drop policy if exists users_upd on public.users;
create policy users_upd on public.users for update using (id = auth.uid());

-- books: 공개 카탈로그 select(게스트 포함). 쓰기는 워커(service_role)만 — #1191.
--   옛 books_ins/books_upd(auth.uid() is not null)는 로그인만 하면 누구나 카탈로그를 오염시켜 제거.
--   클라의 books.upsert(캐노니컬 id 해소)는 워커 /api/book-upsert 경유(입력검증·캡·레이트리밋).
--   authenticated write grant 회수는 아래 grants 섹션 참조(42_books_write_lockdown.sql).
drop policy if exists books_sel on public.books;
create policy books_sel on public.books for select using (true);
drop policy if exists books_ins on public.books;
drop policy if exists books_upd on public.books;

-- user_books / reading_sessions / streak: 로그인 사용자만 select(#1165 anon 차단), 본인만 write
drop policy if exists ub_sel on public.user_books;
create policy ub_sel on public.user_books for select using (auth.uid() is not null);
drop policy if exists ub_mod on public.user_books;
create policy ub_mod on public.user_books for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sess_sel on public.reading_sessions;
create policy sess_sel on public.reading_sessions for select using (auth.uid() is not null);
drop policy if exists sess_mod on public.reading_sessions;
create policy sess_mod on public.reading_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists streak_sel on public.streak;
create policy streak_sel on public.streak for select using (auth.uid() is not null);
drop policy if exists streak_mod on public.streak;
create policy streak_mod on public.streak for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- sentences: 본인 행만 select(#1166 — my_note 는 개인 사후 감상, 타 인증사용자 유출 차단), 본인만 write.
--   피드/프로필의 *남의* 문장 본문은 아래 public.sentences_public 뷰로 노출(my_note 제외).
drop policy if exists sent_sel on public.sentences;
create policy sent_sel on public.sentences for select using (user_id = auth.uid());
drop policy if exists sent_mod on public.sentences;
create policy sent_mod on public.sentences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- #1166 공개 뷰 — my_note(비공개 사후 감상) 제외한 비민감 컬럼만. 소유자(postgres) 권한 실행(security
--   definer 기본)이라 base RLS 우회 → 전 공개 문장 본문 노출하되 my_note 컬럼 자체가 없다. FK 컬럼
--   (user_id·user_book_id·id)을 모두 노출해 PostgREST 임베드(users·user_books·claps)가 해소되게 한다.
create or replace view public.sentences_public as
  select id, user_id, user_book_id, session_id, page, text, created_at
  from public.sentences;

-- shield_log: 본인만
drop policy if exists shield_all on public.shield_log;
create policy shield_all on public.shield_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- follows: select 모두, 본인이 follower 인 행만 insert/delete
drop policy if exists follows_sel on public.follows;
create policy follows_sel on public.follows for select using (auth.uid() is not null);
drop policy if exists follows_mod on public.follows;
create policy follows_mod on public.follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- claps: select 모두(카운트), 본인 from 만 insert/delete
drop policy if exists claps_sel on public.claps;
create policy claps_sel on public.claps for select using (auth.uid() is not null);
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

-- 숲 비밀번호 — bcrypt 해시 저장 + 서버측 검증 RPC (co-reading §6.4, #996, 35_room_password_hash.sql).
-- 평문 금지·해시 비노출: 해시 컬럼은 클라 read 차단(아래 REVOKE), 검증은 boolean 만 반환.
create or replace function public.room_set_password(p_room_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select created_by into v_owner from public.villages where id = p_room_id;
  if v_owner is null then raise exception 'room not found'; end if;
  if v_owner <> auth.uid() then raise exception 'only the room host can set the password'; end if;
  update public.villages
     set password_hash = case when p_password is null or p_password = '' then null
                              else crypt(p_password, gen_salt('bf')) end,
         has_password  = (p_password is not null and p_password <> '')
   where id = p_room_id;
end; $$;
create or replace function public.room_verify_password(p_room_id uuid, p_password text)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare v_hash text; v_exists boolean;
begin
  select (id is not null), password_hash into v_exists, v_hash from public.villages where id = p_room_id;
  if not coalesce(v_exists, false) then return false; end if;   -- 없는 방
  if v_hash is null then return true; end if;                    -- 비번 미설정 = 입장 자유
  return v_hash = crypt(coalesce(p_password, ''), v_hash);
end; $$;
grant execute on function public.room_set_password(uuid, text)    to authenticated;
grant execute on function public.room_verify_password(uuid, text) to anon, authenticated;

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

-- village_members: 본인 탈퇴(delete)만 클라 직접 허용, 같은 마을/공개 마을 멤버 select.
-- ※ 자기참조(village_members 안에서 village_members 조회) 제거 → is_village_member() 사용.
-- ※ 입장(INSERT)은 클라 직접 불가 — 서버측 검증(visibility·비번·정원) 후 SECURITY DEFINER
--   RPC(room_join / room_create_membership, 36_room_join_rpc.sql, #1022)만 멤버 행을 만든다.
--   vmembers_mod 가 for delete 만이라 INSERT 정책이 없어 클라 직접 insert/upsert 는 거부된다.
drop policy if exists vmembers_sel on public.village_members;
create policy vmembers_sel on public.village_members for select using (
  user_id = auth.uid()
  or public.is_village_member(village_id)
  or exists (select 1 from public.villages v where v.id = village_id and v.visibility = 'public')
);
-- (#1022) for all → for delete: 클라 직접 INSERT 차단. 멤버십 생성은 RPC 경유만.
drop policy if exists vmembers_mod on public.village_members;
create policy vmembers_mod on public.village_members for delete using (user_id = auth.uid());

-- 숲 입장 권한 = 서버측 강제 (co-reading §6.3, #1022, 36_room_join_rpc.sql).
-- 클라가 village_members 를 직접 insert 못 하게 막고(위 vmembers_mod = delete 만), 멤버십 생성은
-- 아래 SECURITY DEFINER RPC 경유만. 함수 안에서 서버가 방존재·비번·정원을 검증한 뒤에만 insert.
create or replace function public.room_join(p_room_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public as $$
declare v_capacity int; v_count int; v_exists boolean;
begin
  select (id is not null), capacity into v_exists, v_capacity from public.villages where id = p_room_id;
  if not coalesce(v_exists, false) then raise exception 'room not found' using errcode = 'P0002'; end if;
  if not public.room_verify_password(p_room_id, coalesce(p_password, '')) then
    raise exception 'invalid room password' using errcode = '28000'; end if;
  if v_capacity is not null then
    select count(*) into v_count from public.village_members where village_id = p_room_id;
    if v_count >= v_capacity
       and not exists (select 1 from public.village_members where village_id = p_room_id and user_id = auth.uid()) then
      raise exception 'room is full' using errcode = '23505'; end if;
  end if;
  insert into public.village_members (village_id, user_id) values (p_room_id, auth.uid())
  on conflict (village_id, user_id) do nothing;
end; $$;
create or replace function public.room_create_membership(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select created_by into v_owner from public.villages where id = p_room_id;
  if v_owner is null then raise exception 'room not found' using errcode = 'P0002'; end if;
  if v_owner <> auth.uid() then raise exception 'only the room host can self-register on create' using errcode = '42501'; end if;
  insert into public.village_members (village_id, user_id) values (p_room_id, auth.uid())
  on conflict (village_id, user_id) do nothing;
end; $$;
grant execute on function public.room_join(uuid, text)        to authenticated;
grant execute on function public.room_create_membership(uuid) to authenticated;

-- 체크인 원자 RPC (#1161, 43_checkin_atomic.sql) — user_books.current_page /
-- reading_sessions upsert / streak bump 을 한 트랜잭션으로. 스트릭 규칙은
-- datastore.js `_nextStreak`(systems.md §6.1) 복제 — 변경 시 함께 갱신.
-- p_today = 클라 로컬 날짜(_today()); 서버 current_date(UTC) 는 KST 자정~오전9시 하루 어긋남.
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
as $$
declare
  v_uid            uuid := auth.uid();
  v_owner          uuid;
  v_ub_page        int;
  v_dur_base       int := greatest(coalesce(p_duration, 0), 0);
  v_pages_today    int := 0;
  v_duration_today int;
  v_delta          int;
  v_prev_pages     int;
  v_prev_dur       int;
  v_streak         public.streak%rowtype;
  v_cur            int;
  v_longest        int;
  v_session        public.reading_sessions%rowtype;
begin
  v_duration_today := v_dur_base;

  select user_id, current_page into v_owner, v_ub_page
    from public.user_books where id = p_user_book_id;
  if v_owner is null then
    raise exception 'checkin_atomic: user_book % not found', p_user_book_id;
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'checkin_atomic: not owner';
  end if;

  if p_page is not null then
    v_delta := greatest(0, p_page - coalesce(v_ub_page, 0));
    select pages_read_today, duration_sec into v_prev_pages, v_prev_dur
      from public.reading_sessions
      where user_book_id = p_user_book_id and session_date = p_today;
    v_pages_today := coalesce(v_prev_pages, 0) + v_delta;
    v_duration_today := v_dur_base + coalesce(v_prev_dur, 0);
    update public.user_books set current_page = p_page where id = p_user_book_id;
  end if;

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

  select * into v_streak from public.streak where user_id = v_uid;
  if found and v_streak.last_check_in_date is distinct from p_today then
    v_cur := 1;
    if v_streak.last_check_in_date is not null
       and (p_today - v_streak.last_check_in_date) = 1 then
      v_cur := coalesce(v_streak.current, 0) + 1;
    end if;
    v_longest := greatest(coalesce(v_streak.longest, 0), v_cur);
    update public.streak
      set current = v_cur, longest = v_longest, last_check_in_date = p_today
      where user_id = v_uid;
  end if;

  return v_session;
end;
$$;
grant execute on function public.checkin_atomic(uuid, int, int, date) to authenticated;

-- ── 권한(grant) — RLS 가 행 단위 통제. anon=읽기, authenticated=쓰기 ──────
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- #1165 방어심층 — anon 은 PII 테이블 select 자체를 못 하게 회수(정책 회귀 대비).
-- 공개 유지: books·npc_sentence_seeds(게스트 카탈로그·시드), villages(자체 visibility 정책).
-- #1166 sentences_public 뷰도 authenticated 전용(anon 문장 접근 불가) — 위 blanket grant 회수.
revoke select on
  public.users, public.user_books, public.reading_sessions,
  public.streak, public.sentences, public.follows, public.claps,
  public.sentences_public
from anon;

-- 숲 비밀번호 해시는 클라이언트가 절대 읽지 못한다 (#996, co-reading §6.4).
-- `grant select on all tables` 가 password_hash 까지 열어주므로 컬럼 단위로 회수 — 검증은 RPC 만.
revoke select (password_hash) on public.villages from anon, authenticated;

-- #1191 books 는 전역 공유 카탈로그 — authenticated 쓰기 회수(위 `grant insert,update,delete` 상쇄).
-- 쓰기는 워커(service_role, RLS·grant 우회)의 /api/book-upsert 만. read(books_sel)는 공개 유지.
revoke insert, update, delete on public.books from authenticated;

-- #1133 Part 1 — 인기 시드 선충전 랭크(내부 채택 수 + sales_point 부트스트랩). 크론(service_role) 전용.
create or replace view public.book_prewarm_rank as
  select b.isbn13, b.title, b.author, count(ub.id) as adoption, b.sales_point
    from public.books b
    left join public.user_books ub on ub.book_id = b.id
   where b.isbn13 is not null
   group by b.id;
revoke select on public.book_prewarm_rank from anon, authenticated;
grant  select on public.book_prewarm_rank to service_role;

-- =====================================================================
-- 끝. 재실행 안전. 다음: supabaseAdapter(§7.2) + config.js + 알라딘 프록시.
-- =====================================================================
