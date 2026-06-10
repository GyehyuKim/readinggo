-- 한 문장 종류 구분 (#360) — 인용(quote) vs 내 의견/생각(thought).
-- 배경: '즐거웠다' 사례 — 인용이 아닌 내 의견을 남길 길이 없어 한 문장으로 들어옴.
-- LLM(#359)·표시(책상세 💭)·수집 모두 kind 로 구분. 기존 행은 전부 quote.
alter table public.sentences
  add column if not exists kind text not null default 'quote'
  check (kind in ('quote', 'thought'));

comment on column public.sentences.kind is
  '문장 종류 (#360): quote=책 속 인용(기본), thought=독자의 의견/생각.';
