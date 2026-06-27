-- 37_import_staging.sql
-- 스샷 서가 복원 검토함(스테이징) — integrated-shelf.md §4.7 / #1048 (로그인 게이트 후속).
--
-- 배경(이전 상태, #1040/#1042/#1045):
--   shelf-import 검수 "등록"이 책장에 직행(myBooks.addBatch)했다. 비전(Gemini) 오인식·UI 잡음이
--   실계정 책장에 바로 영속돼 정리 부담이 컸다. → 검수 "등록"을 **검토함(import_staging)** 으로 보내
--   사용자가 한 번 더 본 뒤 [내 서재로 이동]/[제외]하게 한다(영속, 세션 넘어 유지).
--
-- 이 마이그레이션:
--   public.import_staging — 로그인 사용자별 임포트 검토 큐. shelf-import 가 검수분을 적재하고,
--   서재(library.js) "📦 가져온 책 · 검토" 뷰가 항목별/일괄로 책장 이동(commit)·제외(remove)한다.
--   책장 이동 시 어댑터(datastore-supabase.js importStaging.commit)가 myBooks.addBatch 로 라우팅
--   (status: completed/wish/reading) 후 이 행을 삭제한다.
--
-- book_id: 카탈로그(Supabase books) 랭크 매칭이 성공한 경우의 canonical books.id (없으면 null=미확인).
--   하드 FK 를 두지 않는다 — 검토함은 일시 큐이고 메타(title·author·cover_url·isbn13·total_pages)를
--   행에 자체 보존하며, commit 이 book_id 있으면 그대로, 없으면 isbn13/제목으로 books upsert 재해소한다.
--   (알라딘 보강분은 client 에 id 가 없어 null → commit 시 upsert. 비-UUID raw id 도 null 로 떨군다.)
--
-- 적용: Supabase Dashboard > SQL Editor 또는 Management API 로 **수동 1회 실행**.
--       (Supabase 마이그레이션은 자동 적용되지 않는다 — 코드 머지 ≠ DB 적용.
--        적용 전까지 CI `migrations` 게이트가 import_staging 누락으로 RED — SQL 버그 아님, 미적용 신호(#633).)
-- 재실행 안전(idempotent): create table if not exists / drop policy 후 create / 조건부 grant.

-- ── 검토함 테이블 ────────────────────────────────────────────────────
create table if not exists public.import_staging (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  book_id          uuid,                                   -- 매칭된 canonical books.id (없으면 null=미확인). 하드 FK 없음(위 주석).
  title            text not null,
  author           text,
  cover_url        text,
  isbn13           text,
  total_pages      int  not null default 0,
  suggested_status text not null default 'completed',      -- 검수 목적지 토글값: 'completed'|'wish'|'reading'
  rating           numeric,                                -- 비전 추출 별점 0.5~5.0 (없으면 null). user_books 와 동일 규칙.
  created_at       timestamptz not null default now(),
  constraint import_staging_rating_range check (rating is null or (rating >= 0.5 and rating <= 5))
);

-- 사용자별 최신순 조회 인덱스(검토함 뷰 list()).
create index if not exists idx_import_staging_user_created
  on public.import_staging(user_id, created_at desc);

-- ── RLS — 본인만(wish_books 패턴) ────────────────────────────────────
alter table public.import_staging enable row level security;
drop policy if exists import_staging_all on public.import_staging;
create policy import_staging_all on public.import_staging
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── grant ────────────────────────────────────────────────────────────
-- schema.sql 의 `grant ... on all tables`(1회성)는 이 테이블 생성 *이전*에 실행됐으므로
-- 새 테이블엔 적용 안 됨 → 여기서 명시. 검토함은 로그인 전용이라 anon 권한은 부여하지 않는다.
grant select, insert, update, delete on public.import_staging to authenticated;
