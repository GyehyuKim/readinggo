-- 10_inquiry_version.sql
-- 문의에 앱 버전(app_version) 기록 — "어느 버전에서 발생/해결됐는지" 추적 (RG_VERSION, config.js)
-- 적용: node docs/readinggo/supabase/admin-cli.mjs sql 10_inquiry_version.sql

alter table public.inquiries
  add column if not exists app_version text;
