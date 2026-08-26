import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../docs/readinggo/js/companion.js', import.meta.url), 'utf8');
const start = source.indexOf('const saveFreeNote = () => {');
const end = source.indexOf('\n  // 한 문장 삭제', start);

assert.ok(start >= 0 && end > start, '내 감상 저장 handler를 찾을 수 있어야 한다');
const flow = source.slice(start, end);
const successStart = flow.indexOf('.then(() => {');
const failureStart = flow.indexOf('.catch(() => {', successStart);
assert.ok(successStart >= 0 && failureStart > successStart, '성공·실패 저장 분기가 있어야 한다');
const success = flow.slice(successStart, failureStart);
const failure = flow.slice(failureStart);

test('내 감상 저장 성공은 목록을 갱신하고 모달을 닫은 뒤 보이는 완료 안내를 낸다', () => {
  const eventAt = success.indexOf("rg:sentence-note");
  const idleAt = success.indexOf('setNoteSaving(false)');
  const closeAt = success.indexOf('onClose()');
  const toastAt = success.indexOf("showToast(free ? '내 감상을 저장했어요' : '감상을 비웠어요')");

  assert.ok(eventAt >= 0, '문장 카드의 감상 상태를 즉시 갱신해야 한다');
  assert.ok(eventAt < idleAt && idleAt < closeAt && closeAt < toastAt,
    '상태 갱신 → 저장 상태 해제 → 모달 닫기 → 성공 안내 순서를 지켜야 한다');
});

test('내 감상 저장 실패는 초안과 모달을 유지해 재시도할 수 있다', () => {
  assert.match(failure, /setNoteSaving\(false\)/);
  assert.match(failure, /showToast\('저장 실패 — 잠시 후 다시'\)/);
  assert.doesNotMatch(failure, /onClose\(\)/);
});

test('내 감상 저장 중에는 중복 제출을 막는다', () => {
  assert.match(source, /<button onClick=\{saveFreeNote\} disabled=\{noteSaving\}/);
  assert.match(source, /\{noteSaving \? '저장 중…' : '내 감상 저장'\}/);
});
