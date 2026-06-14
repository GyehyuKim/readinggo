-- 알라딘/외서 무료 메타 풀 컬럼화 (#489) — normalize()가 채워 upsert(archive·검색 공통).
-- 외서(Google/OpenLibrary)·LLM 보강은 매핑 가능한 필드만, 나머지 NULL. 멱등(add column if not exists).
-- spec: backend.md §7 books 테이블. 최종 컬럼셋은 배포 후 실데이터로 검증.
alter table public.books
  add column if not exists description          text,      -- 책 소개(알라딘 description / Google·OpenLibrary 폴백)
  add column if not exists full_description     text,      -- 출판사 제공 긴 소개(알라딘 OptResult=fulldescription)
  add column if not exists subtitle             text,      -- 부제(subInfo.subTitle)
  add column if not exists original_title       text,      -- 원제(외서, subInfo.originalTitle)
  add column if not exists pub_date             date,      -- 출간일(pubDate)
  add column if not exists category_id          int,       -- 알라딘 분야 ID — 추천(#496) 같은 분야 폴백
  add column if not exists category_name        text,      -- 분야명(categoryName)
  add column if not exists toc                  text,      -- 목차(OptResult=Toc)
  add column if not exists story                text,      -- 줄거리(OptResult=Story)
  add column if not exists price_standard       int,       -- 정가
  add column if not exists price_sales          int,       -- 판매가
  add column if not exists customer_review_rank smallint,  -- 알라딘 별점 0~10
  add column if not exists sales_point          int,       -- 알라딘 판매지수
  add column if not exists aladin_link          text,      -- 알라딘 상세 링크
  add column if not exists adult                boolean,   -- 성인 여부
  add column if not exists source               text,      -- 메타 출처: aladin|google|openlibrary|llm
  add column if not exists enriched_at          timestamptz; -- 메타 보강 시각(빈 필드 재보강 cron 추적)

comment on column public.books.category_id is
  '#489 알라딘 분야 ID — 추천(#496) 같은 분야 폴백에 사용';
comment on column public.books.source is
  '#489 메타 출처: aladin|google|openlibrary|llm (폴백 추적·신뢰 카피 차등)';
comment on column public.books.enriched_at is
  '#489 메타 보강 시각 — 빈 필드 재보강 cron 추적';
