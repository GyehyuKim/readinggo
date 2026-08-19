-- 53_sentence_length_1000_all_visibility.sql
-- #1457: 모든 공개범위의 한 문장을 공백 제거 후 1~1,000자로 통일한다.
-- 기존 행을 수정하거나 삭제하지 않고, 신규/변경 쓰기에만 즉시 적용한다.

alter table public.sentences drop constraint if exists sentences_text_len;
alter table public.sentences add constraint sentences_text_len
  check (char_length(btrim(text)) between 1 and 1000) not valid;

-- 적용 후 검증(읽기 전용): 정의와 신규 쓰기 강제 여부를 확인한다.
-- select conname, convalidated, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.sentences'::regclass
--    and conname = 'sentences_text_len';
-- 기대: convalidated=false, 정의에 btrim(text) between 1 and 1000.
-- NOT VALID는 기존 행 전수 검증만 미루며 INSERT/UPDATE에는 즉시 적용된다.

-- rollback(#1424 계약 복원, 기존 행 무손실):
-- alter table public.sentences drop constraint if exists sentences_text_len;
-- alter table public.sentences add constraint sentences_text_len
--   check (
--     char_length(btrim(text)) between 1 and
--       case when coalesce(visibility, 'public') = 'private' then 1000 else 200 end
--   ) not valid;
-- 201~1,000자 public/followers 기존 행은 삭제·수정하지 않지만 rollback 뒤 신규/변경 쓰기는 다시 거부된다.
