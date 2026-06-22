-- 32_inquiry_github_sync.sql — 문의 → GitHub 이슈 동기화 멱등 게이트 (#701)
-- inquiry-sync.md §3. Worker 크론(*/10)이 github_issue_number IS NULL 인 문의를 GitHub 이슈로.
-- (스펙엔 29_ 로 적혔으나 그 번호는 사용 중 → 다음 번호 32_.)
--
-- 적용(수동): Supabase SQL Editor 또는 admin-cli.mjs sql 32_inquiry_github_sync.sql
-- 멱등: add column if not exists / create index if not exists.

alter table public.inquiries
  add column if not exists github_issue_number int;   -- null = 미동기화, 값 = 생성된 이슈 번호

-- 미동기화분 빠른 조회(부분 인덱스).
create index if not exists idx_inquiries_unsynced
  on public.inquiries(created_at) where github_issue_number is null;

-- RLS: 컬럼 갱신은 service_role(Worker)만 — service_role 은 RLS 우회라 추가 정책 불요.
