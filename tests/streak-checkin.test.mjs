// 스트릭 체크인 회귀 테스트 (#927)
//
// 실제 docs/readinggo/js/datastore.js 를 node vm 에서 실행(localStorage·INITIAL_STATE 스텁)하여
// 스트릭 규칙(systems.md §6.1)을 검증한다:
//   - 연속(어제 기록) 체크인 → current +1
//   - 같은 날 재체크인 → 불변(하루 1회)
//   - 하루 넘게 공백 → current=1 로 리셋(맹목 증가 버그 회귀 방지)
//   - streak.get() 은 끊긴(>1일 공백) 스트릭을 표시상 0 으로 정상화
//   - 순수 헬퍼 _nextStreak/_isStreakBroken 이 같은 규칙을 노출(세리머니/XP 공유)
//
// 실행: node tests/streak-checkin.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore.js'), 'utf8');

// 결정성: 오늘/어제/오래전 날짜를 실행 시점 기준으로 계산(YYYY-MM-DD)
function ymd(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
const TODAY = ymd(0);
const YESTERDAY = ymd(-1);
const THREE_AGO = ymd(-3);

// streak 상태를 주입해 DataStore 와 노출된 헬퍼를 돌려준다.
function makeDS(streakState) {
  const initState = {
    user_books: [{ id: 'ubA', book_id: 'bookA', book: { id: 'bookA', title: 'T', isbn13: '1' }, current_page: 10, status: 'reading', sessions: [] }],
    active_user_book_id: 'ubA',
    bookmarks: {}, wish_books: [], sessions: [], pending: {},
    streak: streakState,
  };
  let store = JSON.stringify(initState);
  const sandbox = {
    window: { INITIAL_STATE: { book: null, streak: 0, xp: 0, myQuotes: [] } },
    console,
    localStorage: {
      getItem: (k) => (k === 'rg_v41' ? store : null),
      setItem: (k, v) => { if (k === 'rg_v41') store = v; },
      removeItem: () => {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window;
}

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('OK   ' + name); } else { fail++; console.error('FAIL ' + name); } }

// 1. 연속(어제 기록, current=5) → 오늘 체크인 시 6
{
  const w = makeDS({ current: 5, longest: 5, last_check_in_date: YESTERDAY });
  const st = w.DataStore.streak.bumpOnCheckIn();
  check('1. 연속 체크인 → current 5→6', st.current === 6);
  check('1. last_check_in_date=오늘', st.last_check_in_date === TODAY);
}

// 2. 같은 날 재체크인(오늘 이미 기록) → 불변
{
  const w = makeDS({ current: 6, longest: 6, last_check_in_date: TODAY });
  const st = w.DataStore.streak.bumpOnCheckIn();
  check('2. 같은 날 재체크인 → current 불변(6)', st.current === 6);
}

// 3. 하루 넘게 공백(3일 전, current=12) → 오늘 체크인 시 1 (맹목 +1 버그면 13 이 됨)
{
  const w = makeDS({ current: 12, longest: 12, last_check_in_date: THREE_AGO });
  const st = w.DataStore.streak.bumpOnCheckIn();
  check('3. 공백 후 체크인 → current 리셋 1 (13 아님)', st.current === 1);
  check('3. longest 보존(12)', st.longest === 12);
}

// 4. streak.get() 표시 정상화: 끊긴(3일 전) 스트릭은 읽을 때 0 으로
{
  const w = makeDS({ current: 12, longest: 12, last_check_in_date: THREE_AGO });
  const st = w.DataStore.streak.get();
  check('4. get(): 끊긴 스트릭 표시 current=0', st.current === 0);
}

// 5. streak.get() 어제 기록(유효, 아직 안 끊김)은 그대로 노출
{
  const w = makeDS({ current: 7, longest: 7, last_check_in_date: YESTERDAY });
  const st = w.DataStore.streak.get();
  check('5. get(): 어제 기록은 유효 current=7 유지', st.current === 7);
}

// 6. 순수 헬퍼 _nextStreak — bumpOnCheckIn 과 동일 규칙(세리머니/XP 공유 SSOT)
{
  const w = makeDS({ current: 0, longest: 0, last_check_in_date: null });
  check('6. _nextStreak 연속 → +1', w._nextStreak(5, YESTERDAY, TODAY) === 6);
  check('6. _nextStreak 같은 날 → 불변', w._nextStreak(5, TODAY, TODAY) === 5);
  check('6. _nextStreak 공백 → 1', w._nextStreak(12, THREE_AGO, TODAY) === 1);
  check('6. _nextStreak 최초(기록 없음) → 1', w._nextStreak(0, null, TODAY) === 1);
  check('6. _isStreakBroken 어제=유효(false)', w._isStreakBroken(YESTERDAY, TODAY) === false);
  check('6. _isStreakBroken 3일전=끊김(true)', w._isStreakBroken(THREE_AGO, TODAY) === true);
}

// 7. 데모 시드 정합: last_check_in_date=어제(현 시드) → 첫 체크인이 12→13 연속(1 로 리셋 안 함)
{
  const w = makeDS({ current: 12, longest: 12, last_check_in_date: YESTERDAY });
  const st = w.DataStore.streak.bumpOnCheckIn();
  check('7. 데모 시드(어제) 첫 체크인 → 12→13 연속', st.current === 13);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
