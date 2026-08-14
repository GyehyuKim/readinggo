import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isStreakCheckedToday,
  shouldShowStreakRepairCard,
  streakContinuationCopy,
} from './streak-repair-copy.js';

test('스트릭 0일은 다시 시작하는 문구를 표시한다', () => {
  assert.equal(streakContinuationCopy(0), '오늘부터 다시 시작해볼까요');
});

test('스트릭 1일은 1일 연속 대신 다음 날을 안내한다', () => {
  assert.equal(streakContinuationCopy(1), '오늘 읽으면 2일째로 이어져요');
});

test('스트릭 2일 이상은 실제 현재 값의 다음 날을 안내한다', () => {
  assert.equal(streakContinuationCopy(2), '오늘 읽으면 3일째로 이어져요');
  assert.equal(streakContinuationCopy(7), '오늘 읽으면 8일째로 이어져요');
});

test('오늘 기록을 완료하면 복구 카드를 숨긴다', () => {
  assert.equal(isStreakCheckedToday('2026-08-14', '2026-08-14'), true);
  assert.equal(shouldShowStreakRepairCard({
    canRepair: true,
    lastCheckInDate: '2026-08-14',
    today: '2026-08-14',
  }), false);
});

test('날짜가 바뀌면 이전 날짜 기록은 오늘 완료로 보지 않는다', () => {
  assert.equal(isStreakCheckedToday('2026-08-14', '2026-08-15'), false);
  assert.equal(shouldShowStreakRepairCard({
    canRepair: true,
    lastCheckInDate: '2026-08-14',
    today: '2026-08-15',
  }), true);
});

test('복구 불가 상태에서는 날짜와 무관하게 카드를 숨긴다', () => {
  assert.equal(shouldShowStreakRepairCard({
    canRepair: false,
    lastCheckInDate: '2026-08-13',
    today: '2026-08-14',
  }), false);
});
