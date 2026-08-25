import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('docs/readinggo/js/app.js');
const ceremony = read('docs/readinggo/js/ceremony.js');
const reminder = read('docs/readinggo/js/streak-reminder.js');
const settings = read('docs/readinggo/js/settings-modal.js');
const nest = read('docs/readinggo/js/nest.js');
const library = read('docs/readinggo/js/library.js');
const indexHtml = read('docs/readinggo/index.html');

const tabbar = app.slice(app.indexOf('<nav className="tabbar">'), app.indexOf('</nav>', app.indexOf('<nav className="tabbar">')));
const bookshelfRecordStart = app.indexOf('window.RG_openBookshelfRecord = (bookId) => {');
assert.ok(bookshelfRecordStart >= 0, '재키 책장 기록 CTA handler가 있어야 한다');
const bookshelfRecordEnd = app.indexOf('return () => { window.RG_openBookshelfRecord = null; };', bookshelfRecordStart);
assert.ok(bookshelfRecordEnd > bookshelfRecordStart, '재키 책장 기록 CTA cleanup 경계가 있어야 한다');
const bookshelfRecord = app.slice(bookshelfRecordStart, bookshelfRecordEnd);
assert.match(tabbar, /id:\s*'library',\s*label:\s*'서재'/,
  '3번째 탭은 canonical library route와 서재 라벨을 사용해야 한다');
assert.doesNotMatch(tabbar, /id:\s*'nest-grow'|label:\s*'책나무'/,
  'legacy nest-grow와 책나무 라벨은 사용자 탭 표면에 남으면 안 된다');
assert.match(tabbar, /aria-label=\{t\.label\}/,
  '하단 탭 접근성 이름은 표시 라벨과 같아야 한다');
assert.doesNotMatch(tabbar, /label:\s*'둥지'/,
  '하단 탭에 구 둥지 라벨이 남으면 안 된다');
assert.match(app, /addEventListener\('rg:wish-changed', refresh\)/,
  '책 추가·삭제 시 TopBar 집계를 같은 projection으로 다시 읽어야 한다');
assert.match(app, /removeEventListener\('rg:wish-changed', refresh\)/,
  'TopBar 책 변경 listener는 unmount 시 정리해야 한다');
assert.match(app, /tab === 'nest-grow' \? 'library' : tab/,
  'legacy nest-grow 입력은 canonical library route로 정규화해야 한다');
assert.match(bookshelfRecord, /setActiveTab\('library'\)/,
  '재키 책장 기록 CTA는 canonical 서재로 이동해야 한다');
assert.match(bookshelfRecord, /if \(bookId && window\.RG_openBook\) window\.RG_openBook\(bookId\)/,
  '재키 책장 기록 CTA는 요청한 책 상세를 열어야 한다');
assert.equal([...bookshelfRecord.matchAll(/setActiveTab\(/g)].length, 1,
  '재키 책장 기록 CTA는 다른 route를 추가로 설정하면 안 된다');
assert.ok(bookshelfRecord.indexOf("setActiveTab('library')") < bookshelfRecord.indexOf('window.RG_openBook(bookId)'),
  '서재 route를 먼저 설정한 뒤 상세를 열어야 한다');
assert.match(app, /BookDetailModal[\s\S]*?onClose=\{\(\) => setBookDetailItem\(null\)\}/,
  '소유 책 상세 닫기는 modal state만 정리해 서재 route를 유지해야 한다');
assert.match(app, /BookInfoModal bookId=\{bookDetailId\} onClose=\{\(\) => setBookDetailId\(null\)\}/,
  '미소유 책 상세 닫기도 modal state만 정리해 서재 route를 유지해야 한다');
assert.match(app, /activeTab === 'library'[\s\S]*?<LibraryView[\s\S]*?mode="library"/,
  '3번째 route는 서재 전용 mode를 렌더해야 한다');
assert.match(app, /activeTab === 'profile'[\s\S]*?<LibraryView[\s\S]*?mode="profile"/,
  '4번째 profile route는 프로필 전용 mode를 렌더해야 한다');
assert.doesNotMatch(app, /activeTab === 'nest-grow'[\s\S]*BookTreeHomeView/,
  '보류된 책나무 화면을 사용자 route로 렌더하면 안 된다');
assert.match(library, /const showProfile = mode !== 'library'/);
assert.match(library, /const showLibrary = mode !== 'profile'/);
assert.match(library, /data-library-mode=\{mode\}/,
  'profile과 library의 비중복 렌더 경계가 DOM에서 검증 가능해야 한다');
assert.match(library, /new Set\(\['wish', 'reading', 'completed', 'aborted'\]\)/,
  '서재는 네 상태를 하나의 projection에 기본 포함해야 한다');
assert.doesNotMatch(library, /activeSubtab|setActiveSubtab/,
  '서재에 상호배타적인 상태 탭을 다시 도입하면 안 된다');
assert.match(indexHtml, /\.shelf-grid\s*\{[\s\S]*?overflow-x:auto[\s\S]*?scroll-snap-type:x mandatory/,
  '서재 책 목록은 유한 가로 scroll-snap rail이어야 한다');
assert.match(indexHtml, /\.shelf-grid-item\s*\{[\s\S]*?scroll-snap-align:start/,
  '각 책 카드는 시작점에 snap해야 한다');
assert.match(library, /\{showProfile && <ReadingActivityCalendar quotes=\{state\.myQuotes \|\| \[\]\} \/>\}/,
  '월간 활동 캘린더는 profile 소유 surface에만 렌더해야 한다');
assert.match(library, /setSessionDates\(Array\.from\(new Set\(readDates\)\)\)/,
  'session_date 문자열은 Date 재파싱 없이 활동 key로 사용해야 한다');
const calendarSurface = library.slice(library.indexOf('function ReadingActivityCalendar'), library.indexOf('// 위시 행'));
assert.doesNotMatch(calendarSurface, /XP|둥지|성|방패|만회|불꽃|보상|징벌/,
  '월간 활동에는 레거시 보상·징벌 UI를 복원하면 안 된다');

const reminderLines = reminder.slice(reminder.indexOf('const RG_REMINDER_LINES'), reminder.indexOf('function _rmPickLine'));
const deleteCopy = [...settings.matchAll(/정말 삭제할까요\?[\s\S]{0,140}?되돌릴 수 없어요\./g)].map((match) => match[0]).join('\n');
const topbar = app.slice(app.indexOf('<div className="topbar-stats">'), app.indexOf('{/* 전역 Toast'));
for (const forbidden of [
  'N번째 둥지', '완성 둥지', '완성된 둥지', '성 획득', '성을 완성', '다음 둥지', '1,600 XP',
  '아직이에요', '기다려요', '둥지가 오늘을 기다려요',
]) {
  // nest.js는 호환 계산·주석을 보존하므로 실제 과거 토스트/세리머니 문자열만 별도 검증한다.
  if (forbidden === '성 획득') continue;
  assert.equal([topbar, ceremony, reminderLines, deleteCopy].join('\n').includes(forbidden), false,
    `전환 대상 사용자 카피에 ${forbidden}가 남으면 안 된다`);
}
assert.doesNotMatch(nest, /showToast\(`🏰 전설의 재키 성주|showToast\('🏰 성 컬렉션/,
  '저장·완독 흐름에서 레거시 성 토스트를 노출하면 안 된다');
assert.match(deleteCopy, /모든 독서 기록\(책·문장·대화\)이 영구 삭제/,
  '계정 삭제는 실제 책·문장·대화 기록을 평이하게 설명해야 한다');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} helper를 찾을 수 있어야 한다`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} helper 끝을 찾을 수 없다`);
}

const sandbox = {};
vm.createContext(sandbox);
const oldTz = process.env.TZ;
process.env.TZ = 'Asia/Seoul';
vm.runInContext(`${extractFunction(library, '_rgLocalDateKey')}; ${extractFunction(library, '_rgShiftDateKey')}; ${extractFunction(library, '_rgActivityStats')}; ${extractFunction(library, '_rgMonthCells')}; this.activity = { _rgLocalDateKey, _rgShiftDateKey, _rgActivityStats, _rgMonthCells };`, sandbox);
assert.equal(sandbox.activity._rgLocalDateKey('2026-08-24T16:30:00.000Z'), '2026-08-25',
  '문장 timestamp는 사용자 로컬 날짜로 변환해야 한다');
assert.equal(sandbox.activity._rgLocalDateKey('2026-08-25'), '2026-08-25',
  '이미 날짜 문자열인 session_date는 그대로 보존해야 한다');
assert.equal(JSON.stringify(sandbox.activity._rgActivityStats(new Set(['2026-08-22','2026-08-23','2026-08-24','2026-08-27']), '2026-08-25', 2026, 7)), JSON.stringify({ current: 3, longest: 3 }),
  '오늘 활동이 없어도 어제까지 이어진 현재 연속일을 유지하고 미래 날짜는 집계하지 않아야 한다');
const augustCells = sandbox.activity._rgMonthCells(2026, 7);
assert.equal(augustCells.length, 42, '월간 캘린더는 일요일 시작 6주 grid를 유지해야 한다');
assert.equal(augustCells[6].key, '2026-08-01', '2026년 8월 1일은 토요일 열에 있어야 한다');
process.env.TZ = oldTz;
vm.runInContext(`${extractFunction(ceremony, 'finishCeremony')}; this.finishCeremony = finishCeremony;`, sandbox);
const calls = [];
sandbox.finishCeremony({
  isComplete: true,
  rating: 4.5,
  reviewText: '  다시 읽고 싶어요  ',
  onComplete: (payload) => calls.push(['complete', payload]),
  onClose: () => calls.push(['close']),
});
assert.equal(JSON.stringify(calls), JSON.stringify([
  ['complete', { rating: 4.5, review_text: '다시 읽고 싶어요' }],
  ['close'],
]), '완독 persistence 진입이 modal close보다 먼저 실행돼야 한다');

const normalCalls = [];
sandbox.finishCeremony({
  isComplete: false,
  rating: 0,
  reviewText: '',
  onComplete: () => normalCalls.push('complete'),
  onClose: () => normalCalls.push('close'),
});
assert.deepEqual(normalCalls, ['close'], '일반 저장은 완료 mutation 없이 modal을 닫아야 한다');
assert.match(ceremony, /className="rating-stars"[\s\S]*className="review-area"/,
  '완독 별점·소감 review 진입은 유지해야 한다');
assert.doesNotMatch(ceremony, /className="stat xp"|xp-breakdown|nest-progress|nest-evo|NEST_STAGES/,
  '세리머니 UI에 XP·성장 단계·둥지 진화가 남으면 안 된다');

console.log('✓ #1518 canonical 서재 route·비중복 profile/library 회귀 계약');
