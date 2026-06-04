-- 11_inquiry_response.sql
-- 문의 자동/수동 답변 저장 (#208) — LLM(Hermes/Gemini) 또는 운영자 답변을 기록.
-- response: 답변 본문, answered_at: 답변 시각. UI(AdminDashboardModal)는 response 있으면 표시.
-- 적용: node docs/readinggo/supabase/admin-cli.mjs sql 11_inquiry_response.sql

alter table public.inquiries
  add column if not exists response text,
  add column if not exists answered_at timestamptz;
