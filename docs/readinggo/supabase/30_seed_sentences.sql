-- 30_seed_sentences.sql — 통합 서가 ② 마중물 시드 영속 (#774)
-- integrated-shelf.md §5.7. 책당 문장 10개 미만이면 시드로 채워 영속.
--
-- 설계: sentences 는 user_id/user_book_id NOT NULL + byBook inner join 이라 '유저 없는 시드' 부적합.
--       데모 책 id 도 비-UUID('b008') → 별도 테이블, 책 키 = isbn13/제목(Phase 0/1·데모 공통).
--       워커(/api/seed)가 service role 로만 read/write — 클라 직접 접근 없음 → 공개 RLS 불필요.
--
-- 적용(수동): Supabase SQL Editor 또는
--   node docs/readinggo/supabase/admin-cli.mjs < docs/readinggo/supabase/30_seed_sentences.sql
-- (memory: supabase-migrations-manual — .sql 자동적용 안 됨)

create table if not exists public.seed_sentences (
  id          uuid primary key default gen_random_uuid(),
  book_key    text not null,          -- isbn13(우선) | 정규화 제목(소문자·공백 접기)
  text        text not null,          -- 정제된 한 문장(인용 최소)
  source_name text,                   -- 블로그/매체 이름
  source_url  text,                   -- 원글 링크(저작권·진정성 — 출처 표기)
  created_at  timestamptz not null default now()
);

create index if not exists idx_seed_sentences_book on public.seed_sentences(book_key);
-- 같은 책 + 같은 출처는 1회만(재크롤 중복 방지). source_url null 은 유니크 대상 아님 → coalesce 키.
create unique index if not exists uniq_seed_sentences_book_src
  on public.seed_sentences(book_key, coalesce(source_url, ''));

-- RLS on, 정책 없음 → anon/authenticated 차단. service_role(워커)만 bypass.
-- 권리자 삭제 요청 시 SQL/콘솔로 직접 삭제(운영 경로).
alter table public.seed_sentences enable row level security;
