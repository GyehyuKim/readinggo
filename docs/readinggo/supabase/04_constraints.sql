-- =====================================================================
-- ReadingGo — 04_constraints.sql : 서버측 입력 검증 (보안 감사 Medium #1)
--
-- 클라이언트 검증은 anon 키로 PostgREST 에 직접 POST 하면 우회됨 → DB 가
-- 최종 방어선. 길이·형식·범위 제약을 컬럼 CHECK 로 강제한다.
-- 클라(js/validate.js)와 동일 규칙 — 양쪽이 같은 "값 생성 규칙"을 공유.
--
-- NOT VALID: 기존 행은 검사하지 않고 신규/수정 행에만 적용 → 라이브 적용 안전.
-- 재실행 안전(drop constraint if exists 후 add).
-- 적용: node admin-cli.mjs sql 04_constraints.sql
-- =====================================================================

-- 한 문장: 인용 1~200자 / 사후감상 ≤1000자
alter table public.sentences drop constraint if exists sentences_text_len;
alter table public.sentences add  constraint sentences_text_len
  check (char_length(text) between 1 and 200) not valid;
alter table public.sentences drop constraint if exists sentences_note_len;
alter table public.sentences add  constraint sentences_note_len
  check (my_note is null or char_length(my_note) <= 1000) not valid;

-- 프로필: 아이디(handle) 2~20자 한글·영문·숫자·_ / 표시이름 1~40자 / bio ≤300자
alter table public.users drop constraint if exists users_handle_fmt;
alter table public.users add  constraint users_handle_fmt
  check (handle ~ '^[A-Za-z0-9_가-힣]{2,20}$') not valid;
alter table public.users drop constraint if exists users_dname_len;
alter table public.users add  constraint users_dname_len
  check (display_name is null or char_length(display_name) between 1 and 40) not valid;
alter table public.users drop constraint if exists users_bio_len;
alter table public.users add  constraint users_bio_len
  check (bio is null or char_length(bio) <= 300) not valid;

-- 완독: 별점 0.5~5.0(0.5 단위) / 소감 ≤1000자
alter table public.user_books drop constraint if exists ub_rating_range;
alter table public.user_books add  constraint ub_rating_range
  check (rating is null or rating in (0.5,1,1.5,2,2.5,3,3.5,4,4.5,5)) not valid;
alter table public.user_books drop constraint if exists ub_review_len;
alter table public.user_books add  constraint ub_review_len
  check (review_text is null or char_length(review_text) <= 1000) not valid;

-- =====================================================================
-- 끝. 신규 쓰기부터 즉시 강제. 기존 행 정합이 필요하면 추후 VALIDATE CONSTRAINT.
-- =====================================================================
