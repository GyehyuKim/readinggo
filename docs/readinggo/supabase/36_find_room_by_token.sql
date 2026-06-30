-- 36_find_room_by_token.sql
-- 비공개 숲 토큰 입장 (#1094 후속, B안) — villages_sel RLS(visibility='public' OR 생성자 OR 멤버)가
-- 비멤버의 비공개 방 조회를 막으므로, 토큰을 아는 사람(=초대받은 사람)에게 SECURITY DEFINER 로
-- 방 1건을 반환한다. 토큰=초대장(추측 불가 22+자 랜덤). password_hash 는 반환에서 제외(클라 노출 금지).
-- 반환 shape = datastore-supabase.js rooms._SEL 와 일치(book 객체 + village_members[{count}]).
--
-- 배경: 초대 링크 `?r=<token>`(#1094)을 받은 비멤버/게스트가 공개 숲은 anon RLS read 로 미리보기가
--       됐지만, 비공개 숲은 RLS 가 막아 "찾을 수 없어요"가 떴다. B안(비밀번호 폐기, 토큰 초대만)에서
--       비공개 입장 경로 = 이 RPC 한 곳으로 단순화.
--
-- 적용: Supabase Dashboard > SQL Editor 또는 Management API 로 **수동 1회 실행**.
--       (Supabase 마이그레이션은 자동 적용되지 않는다 — 코드 머지 ≠ DB 적용.)
-- 재실행 안전(idempotent): create or replace.

create or replace function public.find_room_by_token(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', v.id, 'book_id', v.book_id, 'name', v.name, 'description', v.description,
    'visibility', v.visibility, 'invite_code', v.invite_code, 'invite_token', v.invite_token,
    'has_password', v.has_password, 'capacity', v.capacity, 'status', v.status,
    'created_by', v.created_by, 'created_at', v.created_at,
    'book', (select jsonb_build_object('id', b.id, 'isbn13', b.isbn13, 'title', b.title,
               'author', b.author, 'cover_url', b.cover_url, 'total_pages', b.total_pages)
             from public.books b where b.id = v.book_id),
    'village_members', jsonb_build_array(jsonb_build_object('count',
             (select count(*) from public.village_members m where m.village_id = v.id)))
  )
  from public.villages v
  where v.invite_token = p_token
  limit 1;
$$;

-- 토큰 자체가 자격(추측 불가) → anon·authenticated 모두 실행 허용. password_hash 는 위 select 에서 제외돼 노출 안 됨.
revoke all on function public.find_room_by_token(text) from public;
grant execute on function public.find_room_by_token(text) to anon, authenticated;
