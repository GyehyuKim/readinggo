// OCR 단발 검토 흐름 회귀 테스트 (#1265)
// 실행: node tests/ocr-review-flow.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'docs/readinggo/js/home.js'), 'utf8');
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

const checkinFlow = sourceSection('const handleCheckin = async', '// 빠른 기록');
const ocrSuccessFlow = sourceSection('const runOcrQuick', 'const runOcrAlbumBatch');
const ocrSaveFlow = sourceSection('const saveOcrReview', '// 입력 페이지 정규화');
const ocrCloseFlow = sourceSection('const closeOcrReview', '// 읽는 중 책 목록');
const ocrPhotoInputs = sourceSection('{/* 사진으로 입력(OCR)', '{/* 크롭 오버레이 */');

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
check('201자 허용', validate('가'.repeat(201), '10', 20, 300).valid);
check('1000자 허용', validate('가'.repeat(1000), '10', 20, 300).valid);
check('이모지 1000자 허용', validate('😀'.repeat(1000), '10', 20, 300).valid);
check('빈 원문 거부', !validate('   ', '10', 20, 300).valid);
result = validate('가'.repeat(1001), '10', 20, 300);
check('1001자는 앞 1000자로 저장 정규화', result.valid && result.truncated && result.originalLength === 1001 && Array.from(result.sentence).length === 1000);
result = validate('😀'.repeat(1001), '10', 20, 300);
check('이모지 1001자는 surrogate pair를 깨지 않고 절단', result.valid && result.truncated && Array.from(result.sentence).length === 1000 && result.sentence === '😀'.repeat(1000));
check('0 페이지 거부', !validate('문장', '0', 20, 300).valid);
check('총 페이지 초과 거부', !validate('문장', '301', 20, 300).valid);
check('총 페이지 미상은 1 이상 허용', validate('문장', '999', 20, 0).valid);

check('OCR 성공은 drafts에 삽입하지 않음', /setOcrReview\(/.test(ocrSuccessFlow) && !/setDrafts\(/.test(ocrSuccessFlow));
check('검토 dialog 접근성 계약', /role="dialog" aria-modal="true" aria-labelledby="ocr-review-title"/.test(src));
check('기존 handleCheckin 단일 호출 경로 사용', /await Promise\.resolve\(handleCheckin\(\{ page: progressPage, sentence: checked\.sentence[^}]+awaitPersistence: true/.test(ocrSaveFlow)
  && (ocrSaveFlow.match(/handleCheckin\(/g) || []).length === 1);
check('OCR 단일 저장은 권위 readback 뒤 완료 화면을 연다',
  /const deferCeremony = awaitPersistence && \(sentenceCount === 0 \|\| source === 'ocr_review'\);/.test(checkinFlow)
  && /if \(deferCeremony\) \{[\s\S]*_openFreshCeremony\(resolvedCeremony\)/.test(checkinFlow));
check('일반 단일 입력은 기존 낙관 완료 화면을 유지한다',
  /if \(!deferCeremony\) \{[\s\S]*_openFreshCeremony\(ceremonyData\)/.test(checkinFlow));
check('201~1000자도 길이 기반 private 강제 없이 기존 기본 공개범위 유지',
  !/checked\.sentence\.length > 200/.test(ocrSaveFlow)
  && /sentence: checked\.sentence, kind: 'quote'/.test(ocrSaveFlow));
check('검토 화면은 N/1,000 카운터를 표시하고 장문 비공개 안내를 제거',
  /Array\.from\(ocrReview\.text\.trim\(\)\)\.length\}\/1,000자/.test(src)
  && /저장 시 앞 1,000자만 남아요/.test(src)
  && !/200자를 넘어 나만 보기로 저장돼요/.test(src));
check('OCR 추출 응답은 검토 전 1000자에서 자동 절단하지 않음',
  !/String\(d\.text\)\.slice\(0,\s*1000\)/.test(fs.readFileSync(path.join(root, 'docs/readinggo/js/data.js'), 'utf8')));
check('OCR 저장 성공 후 절단 사실을 알림', /checked\.truncated[\s\S]+앞부분만 저장했어요/.test(ocrSaveFlow));
check('중복 저장 차단', /if \(!ocrReview \|\| ocrSaving\) return;/.test(src) && /disabled=\{ocrSaving\}/.test(src));
check('실패 시 검토값 보존 안내', /내용을 유지했으니 다시 시도해주세요/.test(src));
check('공개 UGC 동의 필요 시 원인별 재시도 안내', /code === 'ugc_terms_required'[\s\S]+\uCEE4뮤니티 안내에 동의한 뒤 다시 저장/.test(ocrSaveFlow));
check('OCR 저장 실패 진단은 공통 경로에 맡기고 원문을 직접 기록하지 않음',
  /source: 'ocr_review'/.test(ocrSaveFlow)
  && !/rgTrack\('checkin_save_failed'/.test(ocrSaveFlow)
  && !/checkin_save_failed[^\n]+(?:sentence|text|user_id|book_id)/.test(ocrSaveFlow));
check('취소·뒤로가기·Escape 후 시작 버튼 포커스 복귀', /window\.history\.back\(\)/.test(ocrCloseFlow)
  && /e\.key === 'Escape'/.test(ocrCloseFlow) && /_ocrTriggerRef\.current\.focus\(\)/.test(ocrCloseFlow));
check('카메라 입력은 후면 촬영 capture 계약', /type="file" accept="image\/\*" capture="environment"/.test(ocrPhotoInputs));
check('앨범 입력은 capture 없는 별도 다중 image input', /ref=\{_quickAlbumInputRef\} type="file" accept="image\/\*" multiple style=/.test(ocrPhotoInputs)
  && !/ref=\{_quickAlbumInputRef\}[^>]*capture=/.test(ocrPhotoInputs));
check('카메라와 앨범 한 장은 같은 크롭 및 OCR 파이프라인 사용',
  /ref=\{_quickOcrInputRef\}[\s\S]{0,220}setQuickOcrFile\(f\)/.test(ocrPhotoInputs)
  && /files\.length === 1\) setQuickOcrFile\(files\[0\]\)/.test(ocrPhotoInputs)
  && /<OcrCropOverlay file=\{quickOcrFile\}[\s\S]{0,200}runOcrQuick\(blob\)/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
