import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const src = readFileSync('docs/readinggo/js/barcode-scan.js', 'utf8');

const isbnStart = src.indexOf('function classifyIsbn13');
const isbnEnd = src.indexOf('// ISBN-13 →', isbnStart);
assert.ok(isbnStart >= 0 && isbnEnd > isbnStart, 'ISBN 판별 helper 구간을 찾을 수 있어야 한다');

const isbnContext = {};
vm.createContext(isbnContext);
vm.runInContext(`${src.slice(isbnStart, isbnEnd)}\nthis.classify = classifyIsbn13; this.prefer = selectPreferredBarcode; this.action = barcodeDetectionAction;`, isbnContext);
const classify = (value) => JSON.parse(JSON.stringify(isbnContext.classify(value)));
const action = (value, native = false) => JSON.parse(JSON.stringify(isbnContext.action(value, native)));

assert.deepEqual(classify('9788937464652'), { value: '9788937464652', kind: 'isbn' }, '실제 책 ISBN은 검색 대상으로 허용해야 한다');
assert.deepEqual(classify('9767937030326'), { value: '9767937030326', kind: 'product' }, '체크섬이 맞아도 978/979가 아닌 상품 EAN은 거부해야 한다');
assert.deepEqual(classify('9788937464653'), { value: '9788937464653', kind: 'checksum' }, '체크섬이 틀린 978 코드는 검색하지 않아야 한다');
assert.deepEqual(classify('04800'), { value: '04800', kind: 'length' }, 'EAN-5 부가 코드는 ISBN이 아니어야 한다');
assert.equal(isbnContext.prefer([
  { format: 'ean_13', rawValue: '9767937030326' },
  { format: 'ean_13', rawValue: '9788937464652' },
]).rawValue, '9788937464652', '한 프레임에서는 일반 EAN보다 유효 ISBN을 우선해야 한다');
assert.deepEqual(action('9767937030326'), {
  decision: { value: '9767937030326', kind: 'product' },
  shouldLookup: false,
  continueScanning: true,
  nextStatus: 'scanning',
}, '웹은 상품 EAN을 검색하지 않고 현재 카메라 loop를 계속해야 한다');
assert.deepEqual(action('9767937030326', true), {
  decision: { value: '9767937030326', kind: 'product' },
  shouldLookup: false,
  continueScanning: false,
  nextStatus: 'rejected',
}, '네이티브 one-shot은 상품 EAN을 검색하지 않고 거부 결과 화면으로 가야 한다');
assert.deepEqual(action('9788937464652', true), {
  decision: { value: '9788937464652', kind: 'isbn' },
  shouldLookup: true,
  continueScanning: false,
  nextStatus: 'resolving',
}, '유효 ISBN만 검색 상태로 가야 한다');

const start = src.indexOf('function barcodeTrackCapabilities');
const end = src.indexOf('// cameraSupported=false', start);
assert.ok(start >= 0 && end > start, '초점 helper 구간을 찾을 수 있어야 한다');

const context = {};
vm.createContext(context);
vm.runInContext(`${src.slice(start, end)}\nthis.continuous = barcodeApplyContinuousFocus; this.point = barcodeApplyPointFocus;`, context);

const calls = [];
const supportedTrack = {
  getCapabilities: () => ({
    focusMode: ['continuous', 'single-shot'],
    exposureMode: ['single-shot'],
    pointsOfInterest: { max: 1 },
  }),
  applyConstraints: async (value) => { calls.push(value); },
};

assert.equal(await context.continuous(supportedTrack), true);
assert.deepEqual(JSON.parse(JSON.stringify(calls.pop())), { advanced: [{ focusMode: 'continuous' }] });

assert.equal(await context.point(supportedTrack, { x: 0.25, y: 0.75 }), true);
assert.deepEqual(JSON.parse(JSON.stringify(calls.pop())), {
  advanced: [{ focusMode: 'single-shot', exposureMode: 'single-shot', pointsOfInterest: [{ x: 0.25, y: 0.75 }] }],
});

const fallbackCalls = [];
const pointRejectingTrack = {
  getCapabilities: supportedTrack.getCapabilities,
  applyConstraints: async (value) => {
    fallbackCalls.push(value);
    if (value.advanced[0].pointsOfInterest) throw new Error('point unsupported');
  },
};
assert.equal(await context.point(pointRejectingTrack, { x: 0.5, y: 0.5 }), true);
assert.equal(fallbackCalls.length, 2, '좌표 제약 거부 시 위치를 뺀 single-shot을 재시도해야 한다');
assert.deepEqual(JSON.parse(JSON.stringify(fallbackCalls[1])), {
  advanced: [{ focusMode: 'single-shot', exposureMode: 'single-shot' }],
});

let unsupportedCalls = 0;
const unsupportedTrack = {
  getCapabilities: () => ({}),
  applyConstraints: async () => { unsupportedCalls += 1; },
};
assert.equal(await context.continuous(unsupportedTrack), false);
assert.equal(await context.point(unsupportedTrack, { x: 0.5, y: 0.5 }), false);
assert.equal(unsupportedCalls, 0, '미지원 track에 알 수 없는 제약을 적용하면 안 된다');

const rejectingTrack = {
  getCapabilities: () => ({ focusMode: ['continuous'] }),
  applyConstraints: async () => { throw new Error('device rejected'); },
};
assert.equal(await context.continuous(rejectingTrack), false, '제약 거부는 스캔 중단 대신 false로 폴백한다');

assert.match(src, /await barcodeApplyContinuousFocus\(trackRef\.current\)/, '카메라 시작 직후 autofocus를 적용해야 한다');
assert.match(src, /onClick=\{onViewfinderTap\}/, '뷰파인더 탭 핸들러가 연결돼야 한다');
assert.match(src, /초점 다시 맞추기/, '수동 초점 재시도 컨트롤이 있어야 한다');
assert.match(src, /카메라 다시 시작/, '카메라 재시작 컨트롤이 있어야 한다');
assert.match(src, /stopCamera\(\);[\s\S]{0,120}setScanNonce/, '재시작 전에 기존 stream과 rAF를 정리해야 한다');

assert.match(src, /const action = barcodeDetectionAction\(raw,[\s\S]{0,160}if \(!action\.shouldLookup\)/,
  '카메라와 네이티브 검출값을 공통 상태 전환으로 분류해야 한다');
assert.match(src, /!action\.shouldLookup[\s\S]{0,900}return action;[\s\S]{0,300}resolveAndRoute\(decision\.value\)/,
  '일반 EAN과 체크섬 오류는 조회하지 않고 유효 ISBN만 검색해야 한다');
assert.match(src, /selectPreferredBarcode\(codes\)/, '다중 검출에서 유효 ISBN 우선 helper를 사용해야 한다');
assert.match(src, /role="status" aria-live="polite" aria-atomic="true"[\s\S]{0,300}\{statusAnnouncement\}/,
  '항상 마운트된 접근성 상태 영역의 내용만 갱신해야 한다');
assert.match(src, /const statusAnnouncement =[\s\S]{0,500}바코드 \$\{scanFeedback\.value\}[\s\S]{0,300}검색하지 않았어요/,
  '접근성 상태도 인식 숫자와 비검색 여부를 공지해야 한다');
assert.match(src, /ISBN .*책을 검색하고 있어요/, '유효 ISBN 검색 중에는 검색 숫자와 상태를 표시해야 한다');
assert.match(src, /<button onClick=\{restartCamera\}[\s\S]{0,400}다시 스캔하기/,
  '네이티브 one-shot 결과의 다시 스캔 버튼이 실제 restart handler에 연결돼야 한다');
assert.match(src, /const action = ean && ean\.rawValue \? onDetectedIsbn\(ean\.rawValue\) : null;[\s\S]{0,120}if \(action && !action\.continueScanning\) return;[\s\S]{0,300}requestAnimationFrame\(tick\)/,
  '웹은 action.continueScanning으로 유효 ISBN일 때만 loop를 끝내고 거부된 EAN 뒤에는 다음 frame을 예약해야 한다');
assert.match(src, /ISBN .*로 검색했지만 찾지 못했어요/, '유효 ISBN 미검색 결과는 사용한 숫자를 명시해야 한다');

console.log('OK: barcode ISBN validation, visible status, autofocus, tap focus, and restart contracts');
