-- =====================================================================
-- ReadingGo — 03_demo_seed.sql  (#160 데모 계정 시드, 시연용)
--
-- 사용법:
--   ① 앱에서 데모로 쓸 계정으로 로그인(이메일 매직링크 권장) → public.users 행 자동 생성
--   ② 그 계정의 handle 확인:  select handle from public.users order by created_at desc;
--   ③ 아래 v_handle 을 그 handle(예: reader_xxxxxxxx)로 바꾼 뒤 SQL Editor 에서 Run
--   ※ 한 번만 실행(sentences 는 unique 제약이 없어 재실행 시 중복 누적).
--   재실행 안전: books/user_books/streak 는 on conflict 처리, sentences 만 주의.
-- =====================================================================
do $$
declare
  v_handle text := 'reader_xxxxxxxx';   -- ← 데모 계정 handle 로 교체
  v_uid uuid;
  b_sapiens uuid; b_demian uuid; b_old uuid;
  ub_active uuid;
begin
  select id into v_uid from public.users where handle = v_handle;
  if v_uid is null then
    raise exception '데모 계정 handle 을 찾을 수 없음: %  (먼저 그 계정으로 로그인했는지 확인)', v_handle;
  end if;
  -- 실데이터 덮어쓰기 방지: 이미 책이 있는 계정엔 실행 금지(데모 전용 빈 계정만).
  if exists (select 1 from public.user_books where user_id = v_uid) then
    raise exception '이미 책 데이터가 있는 계정(%). 데모 전용(빈) 계정에만 실행하세요.', v_handle;
  end if;

  -- 책 (isbn13 기준 upsert)
  insert into public.books (isbn13, title, author, publisher, total_pages, cover_url) values
    ('9788934972464','사피엔스','유발 하라리','김영사',648,'https://image.aladin.co.kr/product/31424/4/cover500/k482832219_1.jpg'),
    ('9788937460449','데미안','헤르만 헤세','민음사',248,'https://image.aladin.co.kr/product/26/0/cover500/s742633278_2.jpg'),
    ('9788937462788','노인과 바다','어니스트 헤밍웨이','민음사',204,'https://image.aladin.co.kr/product/1452/24/cover500/8937462788_3.jpg')
  on conflict (isbn13) do nothing;
  select id into b_sapiens from public.books where isbn13='9788934972464';
  select id into b_demian  from public.books where isbn13='9788937460449';
  select id into b_old     from public.books where isbn13='9788937462788';

  -- 읽는 중(사피엔스, 활성 책) — 진척 120/648
  insert into public.user_books (user_id, book_id, status, current_page, started_at)
    values (v_uid, b_sapiens, 'reading', 120, now() - interval '8 days')
  on conflict (user_id, book_id) do update set status='reading', current_page=120
  returning id into ub_active;

  -- 완독 2권 (성 컬렉션 + 별점/소감)
  insert into public.user_books (user_id, book_id, status, current_page, rating, review_text, completed_at) values
    (v_uid, b_demian, 'completed', 248, 4.5, '나를 찾는 여정. 알을 깨고 나오는 새처럼.', now() - interval '5 days'),
    (v_uid, b_old,    'completed', 204, 4.0, '단순하지만 깊다. 패배하지 않는 인간.',     now() - interval '14 days')
  on conflict (user_id, book_id) do nothing;

  -- 활성 책 + XP + 스트릭
  update public.users set active_user_book_id = ub_active, xp = 320 where id = v_uid;
  insert into public.streak (user_id, current, longest, last_check_in_date)
    values (v_uid, 7, 12, current_date)
  on conflict (user_id) do update set current=7, longest=12, last_check_in_date=current_date;

  -- 오늘 세션 1행
  insert into public.reading_sessions (user_book_id, user_id, session_date, current_page)
    values (ub_active, v_uid, current_date, 120)
  on conflict (user_book_id, session_date) do nothing;

  -- 한 문장 몇 개 (활성책 + 완독책)
  insert into public.sentences (user_id, user_book_id, page, text)
    values (v_uid, ub_active, 88, '우리가 함께 믿는 허구가 곧 현실을 움직인다.');
  insert into public.sentences (user_id, user_book_id, page, text)
    select v_uid, id, 142, '새는 알에서 나오려고 투쟁한다. 알은 세계다.'
    from public.user_books where user_id = v_uid and book_id = b_demian;
  insert into public.sentences (user_id, user_book_id, page, text)
    select v_uid, id, 96, '인간은 패배하도록 만들어지지 않았다.'
    from public.user_books where user_id = v_uid and book_id = b_old;

  raise notice '데모 시드 완료: % (사피엔스 읽는중 + 데미안·노인과바다 완독 + 한 문장 3개)', v_handle;
end $$;
-- =====================================================================
