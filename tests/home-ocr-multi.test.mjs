// 홈 앨범 다중 선택 → 순차 강조 추출 → 기존 초안 보존·누적 계약 (#1378)
// 실행: node tests/home-ocr-multi.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'docs/readinggo/js/nest.js'), 'utf8');

const helperStart = src.indexOf('function _mergeOcrDrafts');
const helperEnd = src.indexOf('window._mergeOcrDrafts', helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error('_mergeOcrDrafts helper를 찾지 못함');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src.slice(helperStart, helperEnd) + 'window._mergeOcrDrafts = _mergeOcrDrafts;', sandbox);
const merge = sandbox.window._mergeOcrDrafts;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('OK   ' + name); }
  else { fail++; console.error('FAIL ' + name); }
}

let result = merge(
  [{ text: '직접 쓴 초안', visibility: 'private' }, { text: '', visibility: 'public' }],
  ['첫 추출', '둘째 추출', '첫 추출', '', '가'.repeat(201)],
  'public',
);
check('기존 사용자 초안과 공개범위를 보존', result[0].text === '직접 쓴 초안' && result[0].visibility === 'private');
check('기존 빈 행부터 채우고 선택 순서대로 누적', result[1].text === '첫 추출' && result[2].text === '둘째 추출');
check('중복·빈 값·200자 초과 제외', result.length === 3);

result = merge([{ text: '', visibility: null }], [], 'private');
check('추출 결과가 없으면 기존 초안을 그대로 유지', result.length === 1 && result[0].text === '' && result[0].visibility === null);

const albumInput = src.match(/<input ref=\{_quickAlbumInputRef\}[^>]+>/)?.[0] || '';
check('홈 앨범 input은 multiple이며 capture가 없음', /\bmultiple\b/.test(albumInput) && !/\bcapture=/.test(albumInput));
check('한 장은 기존 단발 크롭, 여러 장은 배치로 분기', /files\.length === 1[\s\S]{0,180}setQuickOcrFile\(files\[0\]\)/.test(src)
  && /runOcrAlbumBatch\(files\)/.test(src));
check('배치는 기존 강조 추출 API를 순차 호출', /const runOcrAlbumBatch = async[\s\S]+for \(let i = 0; i < files\.length; i\+\+\)[\s\S]+\/api\/extract-highlights/.test(src));
check('부분 성공 결과를 drafts에 누적', /setDrafts\(\(current\) => _mergeOcrDrafts\(current, extracted, visibility\)\)/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
