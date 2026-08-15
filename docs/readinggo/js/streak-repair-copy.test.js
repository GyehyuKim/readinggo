import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  createStreakRepairLifecycle,
  resolveStreakRepairView,
  streakContinuationCopy,
} from './streak-repair-copy.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const datastoreSource = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'datastore.js'), 'utf8');
const policySandbox = {
  window: { INITIAL_STATE: { book: null, streak: 0, xp: 0, myQuotes: [] } },
  console,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
vm.createContext(policySandbox);
vm.runInContext(datastoreSource, policySandbox);
const repairStatus = (streak, today) => policySandbox.window._streakRepairStatus(streak, today);

test('도달 가능한 1일 만회 상태는 선행 행동과 다음 스트릭을 정확히 안내한다', () => {
  const status = repairStatus({ current: 1, last_check_in_date: '2026-08-13', last_repair_date: null }, '2026-08-15');
  assert.equal(status.canRepair, true);
  const view = resolveStreakRepairView({
    status,
    current: { current: 0, last_check_in_date: '2026-08-13' },
    today: '2026-08-15',
  });

  assert.deepEqual(view, {
    checkedToday: false,
    repairCard: { lostStreak: 1, brokenDays: 2 },
  });
  assert.equal(streakContinuationCopy(view.repairCard.lostStreak), '하루 만회 후 오늘 읽으면 2일째로 이어져요');
});

test('도달 가능한 2일 이상 만회 상태도 하루 만회 후 이어지는 값을 안내한다', () => {
  const status = repairStatus({ current: 7, last_check_in_date: '2026-08-12', last_repair_date: null }, '2026-08-15');
  assert.equal(status.canRepair, true);
  const view = resolveStreakRepairView({
    status,
    current: { current: 0, last_check_in_date: '2026-08-12' },
    today: '2026-08-15',
  });

  assert.deepEqual(view.repairCard, { lostStreak: 7, brokenDays: 3 });
  assert.equal(streakContinuationCopy(view.repairCard.lostStreak), '하루 만회 후 오늘 읽으면 8일째로 이어져요');
});

test('오늘 기록한 실제 상태는 checkedToday=true이고 만회 카드를 숨긴다', () => {
  const status = repairStatus({ current: 4, last_check_in_date: '2026-08-15', last_repair_date: null }, '2026-08-15');
  assert.deepEqual(resolveStreakRepairView({
    status,
    current: { current: 4, last_check_in_date: '2026-08-15' },
    today: '2026-08-15',
  }), { checkedToday: true, repairCard: null });
});

test('날짜 rollover와 resume/focus마다 상태를 다시 읽고 정리 시 리스너·타이머를 제거한다', async () => {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  Object.defineProperty(documentTarget, 'visibilityState', { value: 'visible', writable: true });

  let today = '2026-08-15';
  let stored = {
    status: repairStatus({ current: 2, last_check_in_date: today, last_repair_date: null }, today),
    current: { current: 2, last_check_in_date: today },
  };
  const states = [];
  let reads = 0;
  let timerCallback = null;
  let timerCleared = 0;
  let resumeCallback = null;
  let resumeRemoved = 0;
  const capApp = {
    addListener(event, callback) {
      assert.equal(event, 'resume');
      resumeCallback = callback;
      return Promise.resolve({ remove: () => { resumeRemoved += 1; } });
    },
  };

  const stop = createStreakRepairLifecycle({
    read: async () => { reads += 1; return stored; },
    onState: (state) => states.push(state),
    getToday: () => today,
    now: () => new Date(2026, 7, 15, 23, 59, 59, 900),
    windowTarget,
    documentTarget,
    capApp,
    setTimeoutFn: (callback) => { timerCallback = callback; return 42; },
    clearTimeoutFn: (id) => { assert.equal(id, 42); timerCleared += 1; },
  });
  await flush();
  assert.deepEqual(states.at(-1), { checkedToday: true, repairCard: null });

  today = '2026-08-16';
  stored = {
    status: repairStatus({ current: 2, last_check_in_date: '2026-08-14', last_repair_date: null }, today),
    current: { current: 0, last_check_in_date: '2026-08-14' },
  };
  timerCallback();
  await flush();
  assert.deepEqual(states.at(-1), { checkedToday: false, repairCard: { lostStreak: 2, brokenDays: 2 } });

  resumeCallback();
  windowTarget.dispatchEvent(new Event('focus'));
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  await flush();
  assert.equal(reads, 5, '마운트·rollover·resume·focus·visible에서 각각 다시 읽는다');

  stop();
  const readsAtStop = reads;
  resumeCallback();
  windowTarget.dispatchEvent(new Event('focus'));
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  timerCallback();
  await flush();
  assert.equal(reads, readsAtStop, '정리 후에는 stale 콜백이 평가를 재실행하지 않는다');
  assert.equal(resumeRemoved, 1);
  assert.ok(timerCleared >= 1);
});

test('체크인·만회 mutation은 진행 중인 stale read를 무효화하고 저장 뒤 권위값을 다시 읽는다', async () => {
  let resolveInitial;
  let reads = 0;
  const states = [];
  const today = '2026-08-15';
  const stale = {
    status: repairStatus({ current: 4, last_check_in_date: '2026-08-13', last_repair_date: null }, today),
    current: { current: 0, last_check_in_date: '2026-08-13' },
  };
  const persisted = {
    status: repairStatus({ current: 5, last_check_in_date: today, last_repair_date: null }, today),
    current: { current: 5, last_check_in_date: today },
  };
  const windowTarget = new EventTarget();
  const stop = createStreakRepairLifecycle({
    read: () => {
      reads += 1;
      if (reads === 1) return new Promise((resolve) => { resolveInitial = resolve; });
      return Promise.resolve(persisted);
    },
    onState: (state) => states.push(state),
    getToday: () => today,
    windowTarget,
    documentTarget: null,
    capApp: null,
    setTimeoutFn: () => 42,
    clearTimeoutFn: () => {},
  });

  const finishMutation = stop.beginMutation(); // 낙관적 체크인/만회 직전부터 저장 완료까지 lifecycle 중단
  windowTarget.dispatchEvent(new Event('focus'));
  assert.equal(reads, 1, '저장 중 focus는 stale 조회를 새로 시작하지 않는다');
  resolveInitial(stale); // mutation 이전 조회가 나중에 도착
  await flush();
  assert.equal(states.length, 0, 'mutation 이전 stale snapshot은 UI를 덮어쓰지 않는다');

  await finishMutation(); // 저장 완료 뒤 마지막 mutation이 권위값 재조회
  assert.deepEqual(states, [{ checkedToday: true, repairCard: null }]);
  assert.equal(reads, 2);
  stop();
});

test('겹친 mutation은 모두 끝날 때까지 lifecycle을 중단하고 각 종료 토큰은 자기 인스턴스에만 작용한다', async () => {
  const windowTarget = new EventTarget();
  let reads = 0;
  const create = () => createStreakRepairLifecycle({
    read: async () => {
      reads += 1;
      return { status: { canRepair: false }, current: { last_check_in_date: '2026-08-15' } };
    },
    onState: () => {},
    getToday: () => '2026-08-15',
    windowTarget,
    documentTarget: null,
    capApp: null,
    setTimeoutFn: () => 42,
    clearTimeoutFn: () => {},
  });

  const first = create();
  await flush();
  assert.equal(reads, 1);
  const finishA = first.beginMutation();
  const finishB = first.beginMutation();
  await finishA();
  windowTarget.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(reads, 1, '첫 작업만 끝났을 때 두 번째 작업이 lifecycle 조회를 계속 막는다');
  await finishB();
  assert.equal(reads, 2, '마지막 작업 종료 시 한 번만 권위값을 읽는다');

  const staleFinish = first.beginMutation();
  first();
  const second = create();
  await flush();
  const secondFinish = second.beginMutation();
  await staleFinish();
  windowTarget.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(reads, 3, '이전 lifecycle 종료 토큰은 새 lifecycle의 mutation을 해제하지 않는다');
  await secondFinish();
  assert.equal(reads, 4);
  second();
});
