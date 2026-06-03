-- =====================================================================
-- ReadingGo — 02_admin.sql  (#161 1단계: 운영자 권한)
-- schema.sql 실행 이후에 실행. Supabase 대시보드 → SQL Editor → Run.
-- 재실행 안전(if not exists / create or replace).
-- =====================================================================

-- users.is_admin 플래그
alter table public.users add column if not exists is_admin boolean not null default false;

-- 현재 사용자가 운영자인가 — 정책/집계용 헬퍼
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin);
$$;

-- ── 운영자 지정 (본인 계정 1회) ──────────────────────────────────────
-- 로그인한 본인을 운영자로:
--   update public.users set is_admin = true where id = auth.uid();
-- 또는 handle 로 (대시보드에서 직접):
--   update public.users set is_admin = true where handle = 'reader_xxxxxxxx';

-- ── 메모 ──────────────────────────────────────────────────────────────
-- 모더레이션 읽기: sentences/users/claps 는 이미 select using(true)(공개)라
--   운영자가 별도 정책 없이 전체 조회 가능 → 초기엔 Supabase 대시보드로 운영 충분.
-- 운영자 전용 '삭제'(피드 모더레이션)가 필요해지면 아래처럼 정책 추가:
--   create policy sent_admin_del on public.sentences for delete using (public.is_admin());
-- 2단계(in-app 대시보드: 방문·가입·짹 랭킹·인기책/출판사·문장 집계)는 별도(#161).
-- =====================================================================
