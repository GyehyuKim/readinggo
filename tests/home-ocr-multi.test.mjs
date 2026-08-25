// 홈 앨범 다중 선택 → 순차 일반 OCR → 문장 분리 → 기존 초안 보존·누적 계약 (#1378/#1495)
// 실행: node tests/home-ocr-multi.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'docs/readinggo/js/nest.js'), 'utf8');

const helperStart = src.indexOf('function _mergeOcrDrafts');
const helperEnd = src.indexOf('function _retainUnsavedDrafts', helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error('홈 다중 OCR helper를 찾지 못함');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src.slice(helperStart, helperEnd), sandbox);
const merge = sandbox.window._mergeOcrDrafts;
const split = sandbox.window._splitOcrPageTexts;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('OK   ' + name); }
  else { fail++; console.error('FAIL ' + name); }
}

let result = merge(
  [{ text: '직접 쓴 초안', visibility: 'private' }, { text: '', visibility: 'public' }],
  ['첫 추출', '둘째 추출', '첫 추출', '', '가'.repeat(1000), '나'.repeat(1001)],
);
check('기존 사용자 초안 본문을 보존하고 레거시 공개범위는 제거', result[0].text === '직접 쓴 초안' && !('visibility' in result[0]));
check('기존 빈 행부터 채우고 선택 순서대로 누적', result[1].text === '첫 추출' && result[2].text === '둘째 추출');
check('중복·빈 값만 제외하고 1000·1001자 모두 검토 초안에 보존', result.length === 5 && result[3].text.length === 1000 && result[4].text.length === 1001);

result = merge([{ text: '', visibility: null }], []);
check('추출 결과가 없으면 빈 본문 초안만 유지', result.length === 1 && result[0].text === '' && !('visibility' in result[0]));

const sentences = split([
  '첫 문장입니다. 두 번째 문장은 다음 사진에서 계속',
  '됩니다! 그는 “좋다”고 말했다. “정말인가요?” 넷째입니다. 다섯째입니다. 1.0 버전 잔여',
]);
check('연속 페이지를 이어 임의의 4개 상한 없이 문장 분리', sentences.length === 7
  && sentences[1] === '두 번째 문장은 다음 사진에서 계속 됩니다!');
check('닫는 따옴표 자체는 경계가 아니며 종결부호 뒤 따옴표는 앞 문장에 포함',
  sentences[2] === '그는 “좋다”고 말했다.' && sentences[3] === '“정말인가요?”');
const unicodeClosers = split(['첫 문장입니다.） 다음 문장입니다.】 마지막 문장입니다.»']);
check('전각·문서용 닫는 괄호와 인용부호도 앞 문장에 포함',
  JSON.stringify(unicodeClosers) === JSON.stringify(['첫 문장입니다.）', '다음 문장입니다.】', '마지막 문장입니다.»']));
check('소수점은 문장 경계가 아니며 마지막 비완결 잔여도 보존', sentences[6] === '1.0 버전 잔여');
const separated = split(['앞 페이지 잔여', null, '뒤 페이지 시작.']);
check('실패·빈 페이지는 hard boundary라 비연속 본문을 합치지 않음',
  separated.length === 2 && separated[0] === '앞 페이지 잔여' && separated[1] === '뒤 페이지 시작.');
check('빈 페이지들만 있으면 초안을 만들지 않음', split([null, '', undefined]).length === 0);

const albumInput = src.match(/<input ref=\{_quickAlbumInputRef\}[^>]+>/)?.[0] || '';
const batchStart = src.indexOf('const runOcrAlbumBatch');
const batchEnd = src.indexOf('const saveOcrReview', batchStart);
const quickStart = src.indexOf('const runOcrQuick');
const quickSource = src.slice(quickStart, batchStart);
const batchSource = src.slice(batchStart, batchEnd);
const ocrTrackingSource = quickSource + batchSource;
const failureCalls = ocrTrackingSource.split('\n').filter((line) => line.includes("rgTrack('ocr_failed'")).join('\n');
check('홈 앨범 input은 multiple이며 capture가 없음', /\bmultiple\b/.test(albumInput) && !/\bcapture=/.test(albumInput));
check('한 장은 기존 단발 크롭, 여러 장은 배치로 분기', /files\.length === 1[\s\S]{0,180}setQuickOcrFile\(files\[0\]\)/.test(src)
  && /runOcrAlbumBatch\(files\)/.test(src));
check('배치는 기존 일반 OCR helper를 순차 호출하고 강조 API를 사용하지 않음',
  /for \(let i = 0; i < files\.length; i\+\+\)[\s\S]+window\.ocrExtractSentence/.test(batchSource)
  && !/\/api\/extract-highlights/.test(batchSource));
check('페이지 index를 보존해 분리한 부분 성공 결과를 본문-only drafts에 누적',
  /const pageTexts = Array\(files\.length\)\.fill\(null\)/.test(batchSource)
  && /const extracted = _splitOcrPageTexts\(pageTexts\)/.test(batchSource)
  && /setDrafts\(\(current\) => _mergeOcrDrafts\(current, extracted\)\)/.test(batchSource));
check('단발 OCR 성공은 source·book_id·Unicode 글자 수를 기록',
  /rgTrack\('ocr_extracted', \{ source: 'home_single', book_id: nestState\.book\.id, chars: Array\.from\(String\(d\.text\)\)\.length \}\)/.test(quickSource));
check('홈 배치 시작은 canonical count를 기록',
  /rgTrack\('ocr_batch_started', \{ source: 'home_album', count: files\.length \}\)/.test(batchSource));
check('홈 배치 성공은 이미지마다 source·page_idx·Unicode chars를 기록',
  /rgTrack\('ocr_extracted', \{ source: 'home_album', page_idx: i, chars: Array\.from\(text\)\.length \}\)/.test(batchSource)
  && !/const extractedItems =/.test(batchSource));
check('OCR 실패는 공통 폐쇄형 helper를 사용하고 book_id·http_status를 전송하지 않음',
  /RG_createOcrFailureProps/.test(quickSource)
  && /RG_createOcrFailureProps/.test(batchSource)
  && !/\bbook_id\s*:/.test(failureCalls)
  && !/\bhttp_status\s*:/.test(failureCalls));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
