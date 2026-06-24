-- 34_co_reading_rooms.sql
-- 같이읽기(방) P1 — co-reading.md §6.1. 기존 마을 스키마(villages/village_members)를
-- 그대로 재사용하고 컬럼 2개만 더한다. 새 테이블·새 RLS 신설 없음(병렬 rooms 테이블 금지).
--   - password     : 비공개 방 선택적 비밀번호(§5.2). nullable.
--   - invite_token : 모든 방의 토큰 URL 입장(§5.2). unique. 추측 불가 랜덤(22+자, 어댑터 생성).
-- 적용: Supabase Dashboard > SQL Editor 또는 Management API. (read-only 검사는 migrations_applied.py)
--
-- RLS 메모: 기존 정책(villages_sel: public OR 생성자 OR is_village_member; vmembers_sel/_mod)을
--           그대로 쓴다. password/invite_token 은 단순 컬럼이라 RLS 변경 불필요 —
--           입장 검증(정원·비밀번호)은 어댑터·미리보기 단계, 멤버 insert 가 곧 접근권 부여(§6.3).

-- ── villages: 비밀번호(선택) + 토큰 URL 초대 ───────────────────────────
alter table public.villages add column if not exists password      text;
alter table public.villages add column if not exists invite_token  text unique;

-- 토큰 URL 입장(findByToken) 직접 조회용 인덱스 — unique 제약이 인덱스를 만들지만
-- 명시적으로 두어 의도를 드러낸다(부분 인덱스: 토큰 있는 방만).
create index if not exists idx_villages_invite_token
  on public.villages (invite_token) where invite_token is not null;
