// OCR 단발 검토 흐름 회귀 테스트 (#1265)
// 실행: node tests/ocr-review-flow.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'docs/readinggo/js/nest.js'), 'utf8');
const start = src.indexOf('function _validateOcrReview');
const end = src.indexOf('window._validateOcrReview', start);
if (start < 0 || end < 0) throw new Error('OCR 검토 validator를 찾지 못함');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src.slice(start, end) + 'window._validateOcrReview = _validateOcrReview;', sandbox);
const validate = sandbox.window._validateOcrReview;

function sourceSection(startToken, endToken) {
  const sectionStart = src.indexOf(startToken);
  const sectionEnd = src.indexOf(endToken, sectionStart);
  if (sectionStart < 0 || sectionEnd < 0) throw new Error(`${startToken} 검증 구간을 찾지 못함`);
  return src.slice(sectionStart, sectionEnd);
}

const ocrSuccessFlow = sourceSection('const runOcrQuick', 'const saveOcrReview');
const ocrSaveFlow = sourceSection('const saveOcrReview', '// 입력 페이지 정규화');
const ocrCloseFlow = sourceSection('const closeOcrReview', '// 읽는 중 책 목록');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('OK   ' + name); }
  else { fail++; console.error('FAIL ' + name); }
}

let result = validate('  책의 문장  ', '', 37, 300);
check('앞뒤 공백 제거', result.sentence === '책의 문장');
check('빈 페이지는 현재 페이지', result.page === 37 && result.valid);
check('1자 허용', validate('가', '1', 20, 300).valid);
check('200자 허용', validate('가'.repeat(200), '300', 20, 300).valid);
check('빈 원문 거부', !validate('   ', '10', 20, 300).valid);
check('201자 거부', !validate('가'.repeat(201), '10', 20, 300).valid);
check('0 페이지 거부', !validate('문장', '0', 20, 300).valid);
check('총 페이지 초과 거부', !validate('문장', '301', 20, 300).valid);
check('총 페이지 미상은 1 이상 허용', validate('문장', '999', 20, 0).valid);

check('OCR 성공은 drafts에 삽입하지 않음', /setOcrReview\(/.test(ocrSuccessFlow) && !/setDrafts\(/.test(ocrSuccessFlow));
check('검토 dialog 접근성 계약', /role="dialog" aria-modal="true" aria-labelledby="ocr-review-title"/.test(src));
check('기존 handleCheckin 단일 호출 경로 사용', /await Promise\.resolve\(handleCheckin\(\{ page: progressPage, sentence: checked\.sentence[^}]+awaitPersistence: true/.test(ocrSaveFlow)
  && (ocrSaveFlow.match(/handleCheckin\(/g) || []).length === 1);
check('중복 저장 차단', /if \(!ocrReview \|\| ocrSaving\) return;/.test(src) && /disabled=\{ocrSaving\}/.test(src));
check('실패 시 검토값 보존 안내', /내용을 유지했으니 다시 시도해주세요/.test(src));
check('취소·뒤로가기·Escape 후 시작 버튼 포커스 복귀', /window\.history\.back\(\)/.test(ocrCloseFlow)
  && /e\.key === 'Escape'/.test(ocrCloseFlow) && /_ocrTriggerRef\.current\.focus\(\)/.test(ocrCloseFlow));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
