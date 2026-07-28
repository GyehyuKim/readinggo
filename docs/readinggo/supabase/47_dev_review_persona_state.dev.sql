-- 47_dev_review_persona_state.dev.sql
-- #1350 DEV 전용 합성 검수 페르소나 상태 저장소.
-- 운영 사용자/auth 테이블과 분리된 JSON fixture 전용 테이블이며 DEV 프로젝트에만 적용한다.

create table if not exists public.dev_review_persona_state (
  instance_id text not null check (instance_id ~ '^[a-f0-9]{32}$'),
  persona_id text not null check (persona_id in ('product-explorer', 'community-listener', 'steady-builder')),
  state jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (instance_id, persona_id)
);

-- 최초 local-only 초안 테이블이 이미 생성된 DEV 환경도 안전하게 composite key로 승격한다.
alter table public.dev_review_persona_state add column if not exists instance_id text;
alter table public.dev_review_persona_state add column if not exists revision bigint not null default 1;
delete from public.dev_review_persona_state where instance_id is null;
alter table public.dev_review_persona_state alter column instance_id set not null;
alter table public.dev_review_persona_state drop constraint if exists dev_review_persona_state_pkey;
alter table public.dev_review_persona_state add constraint dev_review_persona_state_pkey primary key (instance_id, persona_id);
alter table public.dev_review_persona_state drop constraint if exists dev_review_persona_state_instance_format;
alter table public.dev_review_persona_state add constraint dev_review_persona_state_instance_format check (instance_id ~ '^[a-f0-9]{32}$');

alter table public.dev_review_persona_state enable row level security;
revoke all on table public.dev_review_persona_state from anon, authenticated;

create or replace function public.touch_dev_review_persona_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_dev_review_persona_state on public.dev_review_persona_state;
create trigger trg_touch_dev_review_persona_state
before update on public.dev_review_persona_state
for each row execute function public.touch_dev_review_persona_state();

comment on table public.dev_review_persona_state is
  '#1350 DEV-only synthetic QA fixtures. No production user rows, auth IDs, emails, or credentials.';
