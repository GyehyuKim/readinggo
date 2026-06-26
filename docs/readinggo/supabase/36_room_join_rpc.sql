-- 36_room_join_rpc.sql
-- 숲(방) 입장 권한 = 서버측 강제 — co-reading.md §6.3 / #1022 (CSO HIGH, Broken Access Control · OWASP A01).
--
-- 문제(이전 상태, 34_co_reading_rooms.sql + 35_room_password_hash.sql):
--   입장(멤버십) 권한이 **클라이언트에서만** 강제됐다. 어댑터(datastore-supabase.js rooms.join)가
--   capacity·비밀번호를 브라우저 JS 에서 검사한 뒤(비번은 #996/35 로 room_verify_password 서버검증으로
--   개선됨) 통과 시 village_members 를 **클라가 직접 insert/upsert** 했다.
--   그러나 실제 접근권을 부여하는 건 이 insert 이고, 이를 막는 RLS(vmembers_mod)는
--   `with check (user_id = auth.uid())` 만 확인 — visibility·정원·비밀번호를 **서버에서 일절 안 봤다**.
--   → 공격자가 join UI/검증을 건너뛰고 직접 POST /rest/v1/village_members {village_id, user_id:본인}
--     하면 RLS 통과 → 비번 모르고·정원 초과여도·비공개 방에 입장. 비밀번호가 UX 장식이 됨.
--
-- 해결(이 마이그레이션):
--   1) SECURITY DEFINER RPC room_join(p_room_id, p_password) — 함수 **안에서** 서버가
--        (a) 방 존재, (b) 비번 방이면 room_verify_password(#996/35)=true, (c) capacity 설정 방이면
--        현재 멤버수 < capacity 를 확인한 **뒤에만** village_members insert(on conflict do nothing).
--        실패는 raise exception(틀린 비번/정원초과/없는 방 구분 메시지).
--   2) SECURITY DEFINER RPC room_create_membership(p_room_id) — 방 생성자(created_by=auth.uid())
--        본인 방에 자기 자신을 멤버 등록. create 의 직접 insert 도 이 정의자-권한 경로로.
--   3) **클라 직접 INSERT 차단**: vmembers_mod 를 for all → **for delete(본인 탈퇴)만** 으로 좁힌다.
--        INSERT 정책이 없어지므로(grant 는 있어도 RLS 가 막음) 클라 직접 insert/upsert 는 거부.
--        멤버십 생성은 위 두 SECURITY DEFINER RPC(정의자 권한으로 RLS 우회) 경유만.
--        SELECT 정책(vmembers_sel)은 그대로 유지(멤버/공개 방 조회).
--
-- 적용: Supabase Dashboard > SQL Editor 또는 Management API 로 **수동 1회 실행**.
--       (Supabase 마이그레이션은 자동 적용되지 않는다 — 코드 머지 ≠ DB 적용.
--        35_room_password_hash.sql 을 **먼저** 적용해야 한다: 이 파일이 room_verify_password 에 의존.
--        migrations_applied.py 는 컬럼·테이블만 검사하므로 RPC·정책 변경은 적용 후 수동 확인.)
-- 재실행 안전(idempotent): create or replace / drop policy if exists / on conflict do nothing.

-- ── RPC ① 방 입장 — 서버가 visibility·비번·정원 검증 후에만 멤버 insert ──
-- SECURITY DEFINER 라 RLS 를 우회(정의자 권한)하므로 vmembers_mod 에서 INSERT 가 없어도 행을 만들 수 있다.
-- 검증은 함수 안에서 서버가 수행 — 클라가 어떤 인자를 주든 우회 불가.
create or replace function public.room_join(p_room_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_count    int;
  v_exists   boolean;
begin
  -- (a) 방 존재 확인 (visibility 무관 — 토큰/코드로 도달한 비공개 방도 입장 가능, co-reading §5.2).
  select (id is not null), capacity into v_exists, v_capacity
    from public.villages where id = p_room_id;
  if not coalesce(v_exists, false) then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  -- (b) 비밀번호 방이면 서버 검증(#996, room_verify_password = SECURITY DEFINER, bcrypt 비교).
  --     비번 없는 방은 항상 true → 통과. boolean 만 반환하므로 해시·평문 노출 없음.
  if not public.room_verify_password(p_room_id, coalesce(p_password, '')) then
    raise exception 'invalid room password' using errcode = '28000';
  end if;

  -- (c) capacity 설정 방이면 현재 멤버수 < capacity 인지 서버에서 확인(클라 카운트 신뢰 안 함).
  if v_capacity is not null then
    select count(*) into v_count from public.village_members where village_id = p_room_id;
    -- 이미 멤버면 재입장은 정원과 무관하게 허용(아래 on conflict do nothing).
    if v_count >= v_capacity
       and not exists (
         select 1 from public.village_members
         where village_id = p_room_id and user_id = auth.uid()
       ) then
      raise exception 'room is full' using errcode = '23505';
    end if;
  end if;

  -- 검증 통과 → 멤버 등록. 이미 멤버면 무시(중복 입장 무해).
  insert into public.village_members (village_id, user_id)
  values (p_room_id, auth.uid())
  on conflict (village_id, user_id) do nothing;
end;
$$;

-- ── RPC ② 생성자 멤버 등록 — 방 host 가 자기 방에 자신을 등록 ────────────
-- create 직후 호출. created_by = auth.uid() 가드 — 남의 방엔 못 넣는다.
-- (room_join 을 재사용하지 않는 이유: 생성자는 비번/정원 검증을 면제 = 자기 방이므로.)
create or replace function public.room_create_membership(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select created_by into v_owner from public.villages where id = p_room_id;
  if v_owner is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'only the room host can self-register on create' using errcode = '42501';
  end if;
  insert into public.village_members (village_id, user_id)
  values (p_room_id, auth.uid())
  on conflict (village_id, user_id) do nothing;
end;
$$;

-- 실행 권한 — 로그인 사용자만(멤버십 생성은 인증 필요). anon 제외.
grant execute on function public.room_join(uuid, text)        to authenticated;
grant execute on function public.room_create_membership(uuid) to authenticated;

-- ── 클라 직접 INSERT 차단: vmembers_mod 를 DELETE(본인 탈퇴)만 허용으로 좁힘 ──
-- 이전: for all using/with check (user_id = auth.uid()) — INSERT 도 본인 행이면 통과 → 우회 가능.
-- 변경: for delete 만 — INSERT 정책이 사라지므로(grant insert 가 있어도 RLS 가 행을 거부)
--        클라 직접 insert/upsert 는 거부된다. 멤버십 생성은 위 SECURITY DEFINER RPC 경유만.
--        SELECT 는 vmembers_sel(아래 재확인)이 담당 — 변경 없음.
drop policy if exists vmembers_mod on public.village_members;
create policy vmembers_mod on public.village_members
  for delete using (user_id = auth.uid());

-- SELECT 정책은 변경 없음(존재 보장 — 멤버/공개 방 조회). 재확인용 재선언(idempotent).
drop policy if exists vmembers_sel on public.village_members;
create policy vmembers_sel on public.village_members for select using (
  user_id = auth.uid()
  or public.is_village_member(village_id)
  or exists (select 1 from public.villages v where v.id = village_id and v.visibility = 'public')
);
