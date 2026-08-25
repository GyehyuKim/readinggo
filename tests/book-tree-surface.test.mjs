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
