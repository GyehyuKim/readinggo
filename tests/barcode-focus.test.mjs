import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const src = readFileSync('docs/readinggo/js/barcode-scan.js', 'utf8');
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

console.log('OK: barcode autofocus, tap focus, unsupported fallback, and restart contracts');
