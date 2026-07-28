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
  /shelf-grid-item['"`]?\s*\+\s*\([^)]*activeBookId/,
  '책장 카드 className은 활성 책에 따라 강조되면 안 된다',
);
assert.doesNotMatch(
  librarySource,
  /shelf-grid-active-pill/,
  '책장 목록에 활성 책 전용 읽는중 pill을 렌더하면 안 된다',
);
assert.doesNotMatch(
  stylesSource,
  /\.shelf-grid-item\.active|\.shelf-grid-active-pill/,
  '제거한 활성 책 강조 스타일이 남으면 안 된다',
);
assert.match(
  librarySource,
  /onClick=\{\(\) => setSelectedBookId\(b\.id\)\}/,
  '각 읽는 중 책은 기존처럼 상세를 열 수 있어야 한다',
);
assert.doesNotMatch(
  librarySource,
  /DataStore\.activeBook\.set/,
  '책장 목록 렌더는 홈 활성 책을 강제로 바꾸면 안 된다',
);

console.log('✅ 책장 다중 읽는 중 책 무강조 회귀 테스트 통과');
