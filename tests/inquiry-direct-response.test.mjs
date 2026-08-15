import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const worker = read('worker/index.mjs');
const wrangler = read('wrangler.toml');
const settings = read('docs/readinggo/js/settings-modal.js');
const admin = read('docs/readinggo/js/admin-dashboard.js');
const policy = read('docs/readinggo/specs/inquiry-sync.md');

for (const forbidden of [
  'syncInquiries',
  'triageInquiry',
  'INQUIRY_TRIAGE_SYSTEM',
  'INQUIRY_RECONCILE_SECRET',
  'feedback:notify-ready',
  'source:beta-inquiry',
  'api.github.com/repos/${GH_REPO}/issues',
]) {
  assert.equal(worker.includes(forbidden), false, `Worker 문의 자동화가 남아 있음: ${forbidden}`);
}
assert.equal(worker.includes("p === '/api/inquiries'"), false, '공개 문의 Worker endpoint를 두지 않는다');
assert.equal(wrangler.includes('*/10 * * * *'), false, '문의 동기화 cron을 두지 않는다');
assert.match(wrangler, /crons\s*=\s*\["0 18 \* \* \*"\]/, '일일 도서 cron은 유지한다');

assert.match(settings, /DataStore\.inquiries\.create\(\{ message: m \}\)/, '인증된 직접 문의 저장은 유지한다');
assert.match(settings, /운영자가 확인합니다/, '직접 확인 안내를 유지한다');
assert.match(admin, /DS\.admin\.inquiries\(\)/, '관리자 문의 목록을 유지한다');
assert.match(admin, /mailto:/, '문의별 직접 이메일 답장을 유지한다');

assert.match(policy, /개별 직접 대응/, '현재 운영 결정을 문서화한다');
assert.match(policy, /GitHub 이슈로 자동 전환하거나 LLM으로 분류·요약하지 않는다/, '폐기된 자동화 정책을 명시한다');

console.log('OK: 문의 자동화 제거, Supabase 접수와 관리자 직접 대응 유지');
