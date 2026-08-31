import assert from 'node:assert/strict';
import fs from 'node:fs';

const library = fs.readFileSync('docs/readinggo/js/library.js', 'utf8');
const ceremony = fs.readFileSync('docs/readinggo/js/ceremony.js', 'utf8');
const home = fs.readFileSync('docs/readinggo/js/home.js', 'utf8');
const app = fs.readFileSync('docs/readinggo/js/app.js', 'utf8');
const html = fs.readFileSync('docs/readinggo/index.html', 'utf8');

assert.match(library, /const \[shelfFocusId, setShelfFocusId\] = _useState\(null\)/,
  '서재 중앙 선택은 책 상세 modal 선택과 독립된 상태여야 한다');
assert.match(library, /className="shelf-focus-card"[\s\S]*onClick=\{\(\) => setSelectedBookId\(focusedBook\.id\)\}/,
  '중앙 전체 표지를 탭할 때만 기존 책 상세를 열어야 한다');
assert.match(library, /displayBooks\.length > 1[\s\S]*className="shelf-peek-rail"[\s\S]*role="listbox"/,
  '두 권 이상에서만 주변 책 상단부 유한 레일을 렌더해야 한다');
assert.match(library, /className=\{`shelf-peek-item\$\{isFocused \? ' on' : ''\}`\}[\s\S]*role="option"[\s\S]*aria-selected=\{isFocused\}/,
  '주변 책은 현재 중앙 선택을 접근성 상태로 알려야 한다');
assert.match(library, /e\.key !== 'ArrowLeft' && e\.key !== 'ArrowRight'[\s\S]*moveShelfFocus\(e\.key === 'ArrowRight' \? 1 : -1\)/,
  '좌우 화살표 키는 유한한 중앙 선택을 이동해야 한다');
assert.doesNotMatch(library, /DataStore\.activeBook\.set/,
  '서재 탐색은 홈 활성 책을 바꾸면 안 된다');
assert.match(html, /\.shelf-peek-rail\s*\{[\s\S]*overflow-x:auto[\s\S]*scroll-snap-type:x mandatory/,
  '주변 책 레일은 유한 가로 scroll-snap을 사용해야 한다');
assert.match(html, /\.shelf-peek-cover\s*\{[\s\S]*border-radius:[^;]*[2-9][0-9]px[\s\S]*overflow:hidden/,
  '주변 책은 둥근 상단부 조각으로 보여야 한다');

assert.doesNotMatch(ceremony, /className="reward-grid"/,
  '저장 개수를 별도 보상 카드로 반복하면 안 된다');
assert.match(ceremony, /!isComplete && \([\s\S]*className="ceremony-actions"[\s\S]*이 책에서 계속 기록하기[\s\S]*저장한 문장 보기[\s\S]*내 서재로 가기/,
  '일반 저장 완료는 세 가지 다음 행동을 우선순위대로 제공해야 한다');
assert.match(ceremony, /className="ceremony-dismiss"[\s\S]*aria-label="완료 화면 닫기"/,
  '행동과 별개인 단순 닫기를 제공해야 한다');
assert.match(ceremony, /isComplete && \([\s\S]*className="complete-review"[\s\S]*완독 기록 남기기/,
  '완독 별점·소감 흐름은 일반 행동으로 대체하면 안 된다');
assert.match(home, /onContinue=\{openSentenceFromCeremony\}[\s\S]*onViewSaved=\{viewSavedFromCeremony\}[\s\S]*onGoLibrary=\{goLibraryFromCeremony\}/,
  'HomeView가 세 행동을 각각 현재 책 문맥에 연결해야 한다');
assert.match(home, /_bookQuotesRef\.current[\s\S]*scrollIntoView/,
  '저장한 문장 보기는 현재 책 문장 영역으로 이동해야 한다');
assert.match(app, /<HomeView[\s\S]*onNavigate=\{switchTab\}/,
  '내 서재 이동은 기존 canonical tab 전환 함수를 재사용해야 한다');

console.log('✓ #1561 서재 양감 탐색·저장 후 행동 회귀 계약');
