-- 53_feedback_flywheel.sql — 고객 직접 문의와 운영자 내부 메모 분리 (#1407)
-- forward-only / 재실행 안전. 기존 행은 legacy로 보존해 새 자동화에 소급 편입하지 않는다.

alter table public.inquiries
  add column if not exists submission_kind text not null default 'legacy',
  add column if not exists public_status text not null default 'received',
  add column if not exists response_source text,
  add column if not exists github_reconciled_at timestamptz,
  add column if not exists github_sync_key uuid not null default gen_random_uuid(),
  add column if not exists github_sync_claimed_at timestamptz;

alter table public.inquiries drop constraint if exists inquiries_submission_kind_check;
alter table public.inquiries add constraint inquiries_submission_kind_check
  check (submission_kind in ('legacy', 'customer_feedback', 'admin_note')) not valid;

alter table public.inquiries drop constraint if exists inquiries_public_status_check;
alter table public.inquiries add constraint inquiries_public_status_check
  check (public_status in ('received', 'checking', 'answered')) not valid;

create unique index if not exists idx_inquiries_github_issue_unique
  on public.inquiries(github_issue_number) where github_issue_number is not null;
create unique index if not exists idx_inquiries_github_sync_key_unique
  on public.inquiries(github_sync_key);

drop index if exists idx_inquiries_unsynced;
create index if not exists idx_inquiries_customer_unsynced
  on public.inquiries(created_at)
  where submission_kind = 'customer_feedback' and github_issue_number is null;

create index if not exists idx_inquiries_customer_reconcile
  on public.inquiries(github_issue_number)
  where submission_kind = 'customer_feedback'
    and github_issue_number is not null
    and public_status <> 'answered';
