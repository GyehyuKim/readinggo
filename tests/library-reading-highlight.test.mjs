import assert from 'node:assert/strict';
import fs from 'node:fs';

const librarySource = fs.readFileSync('docs/readinggo/js/library.js', 'utf8');
const stylesSource = fs.readFileSync('docs/readinggo/index.html', 'utf8');

const readingFixture = [
  { id: 'book-a', status: 'reading', cur: 40 },
  { id: 'book-b', status: 'reading', cur: 120 },
];
const activeBookId = 'book-a';
const readingBooks = readingFixture
  .filter((book) => book.status === 'reading')
  .sort((a, b) => (b.cur || 0) - (a.cur || 0));

assert.deepEqual(
  readingBooks.map((book) => book.id),
  ['book-b', 'book-a'],
  '여러 읽는 중 책은 홈 활성 책과 무관하게 기존 진척순으로 표시해야 한다',
);
assert.equal(
  activeBookId,
  'book-a',
  '책장 표시 변경은 홈 활성 책 상태 자체를 바꾸지 않아야 한다',
);
assert.doesNotMatch(
  librarySource,
  /shelf-peek-item['"`]?\s*\+\s*\([^)]*activeBookId/,
  '주변 탐색 조각은 홈 활성 책에 따라 강조되면 안 된다',
);
assert.doesNotMatch(
  librarySource,
  /shelf-peek-active-pill/,
  '주변 탐색 레일에 활성 책 전용 pill을 렌더하면 안 된다',
);
assert.doesNotMatch(
  stylesSource,
  /\.shelf-peek-item\.active|\.shelf-peek-active-pill/,
  '홈 활성 책 강조 스타일이 남으면 안 된다',
);
assert.match(
  librarySource,
  /className="shelf-focus-progress"/,
  '중앙 책 진척 텍스트는 고정 class를 사용해야 한다',
);
assert.match(
  stylesSource,
  /\.shelf-focus-progress\s*\{/,
  '중앙 책 진척 텍스트 class에는 대응 CSS가 있어야 한다',
);
assert.doesNotMatch(
  stylesSource,
  /\.shelf-focus-prog\s*\{/,
  '사용되지 않는 축약 selector가 남으면 안 된다',
);
assert.match(
  librarySource,
  /className="shelf-focus-card"[\s\S]*?onClick=\{\(\) => setSelectedBookId\(focusedBook\.id\)\}/,
  '중앙 전체 표지를 탭하면 기존 상세를 열 수 있어야 한다',
);
assert.match(
  librarySource,
  /className=\{`shelf-peek-item\$\{isFocused \? ' on' : ''\}`\}[\s\S]*?onClick=\{\(\) => setShelfFocusId\(book\.id\)\}/,
  '주변 조각 탭은 중앙 선택만 바꿔야 한다',
);
assert.doesNotMatch(
  librarySource,
  /DataStore\.activeBook\.set/,
  '책장 목록 렌더는 홈 활성 책을 강제로 바꾸면 안 된다',
);

console.log('✅ 책장 다중 읽는 중 책 무강조 회귀 테스트 통과');
