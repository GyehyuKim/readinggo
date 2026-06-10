-- 참새 완독 회고 영속화 (#352) — 완독 책 1권당 회고 1개 캐시.
-- 회고(#345)가 단발(새로고침 시 소실·LLM 재호출)이던 것을 user_books에 저장.
-- RLS: 기존 ub_mod(ALL, user_id=auth.uid())가 UPDATE 커버 — 추가 정책 불필요.
alter table public.user_books
  add column if not exists companion_recap text;

comment on column public.user_books.companion_recap is
  '참새의 완독 회고 캐시 (#352) — /api/companion mode:recap 결과. 다시 받기로 갱신.';
