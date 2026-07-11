-- 45_active_book_invariant.sql
-- #1217 재발(브람스, #1218 머지 후 재현) — 근본 해결: 불변식을 DB 에서 강제.
--
-- 불변식: users.active_user_book_id 는 **status='reading' 인 user_books 행 또는 null** 만 가리킨다.
--
-- 왜 DB 인가: 클라이언트 JS 픽스(#1218 books.complete 승계)는 (a) 이미 열려 있던 구버전 탭,
--   (b) 구버전 APK(웹 배포가 닿지 않음), (c) active 를 쓰는 다른 경로(부팅 absorb·활성 전환 등)를
--   못 덮는다 — 실제로 #1218 머지 1시간 후 같은 증상 재발. 여기서 한 번 막으면 전 경로·전 버전 커버.
--   (게스트 localStorage 는 DB 밖 — JS 승계 로직은 게스트용으로 유지.)

-- A) 책이 reading 에서 벗어나면(완독·중단 등) 그 책을 active 로 둔 사용자를 자동 승계.
create or replace function public.succeed_active_on_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'reading' and (old.status is distinct from new.status) then
    update public.users u
       set active_user_book_id = (
         select ub.id from public.user_books ub
          where ub.user_id = new.user_id and ub.status = 'reading' and ub.id <> new.id
          order by ub.started_at desc nulls last limit 1)
     where u.id = new.user_id and u.active_user_book_id = new.id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_active_succession on public.user_books;
create trigger trg_active_succession
  after update of status on public.user_books
  for each row execute function public.succeed_active_on_status_change();

-- B) active 를 non-reading 책으로 세팅하려는 쓰기 자체를 교정(구 클라·우회 경로 방어).
--    현행 플로우는 모두 status 를 먼저 reading 으로 만든 뒤 active 를 세팅하므로 정상 경로 무영향.
create or replace function public.coerce_active_to_reading()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.active_user_book_id is not null
     and not exists (select 1 from public.user_books ub
                      where ub.id = new.active_user_book_id and ub.status = 'reading') then
    new.active_user_book_id := (
      select ub.id from public.user_books ub
       where ub.user_id = new.id and ub.status = 'reading'
       order by ub.started_at desc nulls last limit 1);
  end if;
  return new;
end; $$;
drop trigger if exists trg_active_coerce on public.users;
create trigger trg_active_coerce
  before insert or update of active_user_book_id on public.users
  for each row execute function public.coerce_active_to_reading();

-- C) 현재 위반 데이터 교정(재발분 포함).
update public.users u
   set active_user_book_id = (
     select ub2.id from public.user_books ub2
      where ub2.user_id = u.id and ub2.status = 'reading'
      order by ub2.started_at desc nulls last limit 1)
 where u.active_user_book_id is not null
   and exists (select 1 from public.user_books ub
                where ub.id = u.active_user_book_id and ub.status <> 'reading');
