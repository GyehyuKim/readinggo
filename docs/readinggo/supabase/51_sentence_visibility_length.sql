-- 51_sentence_visibility_length.sql
-- #1424: private 한 문장은 1~1,000자, public/followers는 1~200자로 제한한다.
-- INSERT뿐 아니라 본문 편집·공개범위 변경·PostgREST 직접 쓰기에도 같은 CHECK가 적용된다.
-- NOT VALID는 기존 행 전체 검증만 미루며, 신규/변경 행에는 즉시 강제된다.

alter table public.sentences drop constraint if exists sentences_text_len;
alter table public.sentences add constraint sentences_text_len
  check (
    char_length(btrim(text)) between 1 and
      case when coalesce(visibility, 'public') = 'private' then 1000 else 200 end
  ) not valid;
