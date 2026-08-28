import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../docs/readinggo/js/search.js', import.meta.url), 'utf8');
const purePrefix = source.slice(0, source.indexOf('const SearchModal'));
const context = { URL, URLSearchParams };
vm.runInNewContext(`${purePrefix}\nthis.rank = rgRankSearchResults; this.fetchWindow = rgFetchRemoteWindow; this.appendStable = rgAppendStableSearchResults;`, context);

const editionHeavy = [
  ...Array.from({ length: 4 }, (_, i) => ({ isbn13: `97800000000${i}`, title: 'Hemingway', author: 'Lynn K', source: 'kakao' })),
  ...Array.from({ length: 2 }, (_, i) => ({ isbn13: `97800000001${i}`, title: 'Hemingway', author: 'Reynolds Michael', source: 'kakao' })),
  { isbn13: '9780000000200', title: 'Hemingway', author: 'Rose Marie Burnwell', source: 'kakao' },
  { isbn13: '9780000000201', title: 'Hemingway', author: 'Reynolds Michael/ /', source: 'kakao' },
  { isbn13: '9780000000202', title: 'Hemingway', author: 'Meyers J', source: 'kakao' },
  { isbn13: '9780000000203', title: 'Ernest Hemingway on Writing', author: '어니스트 헤밍웨이', source: 'kakao' },
];
const nextWorks = Array.from({ length: 10 }, (_, i) => ({
  isbn13: `9790000001${String(i).padStart(3, '0')}`,
  title: `Hemingway work ${i + 1}`,
  author: 'Ernest Hemingway',
  source: 'kakao',
}));

const calls = [];
const pageSizes = [];
const request = async (url) => {
  const parsed = new URL(url);
  const cursor = parsed.searchParams.get('cursor') || '';
  calls.push(cursor);
  pageSizes.push(parsed.searchParams.get('max'));
  if (!cursor) return { ok: true, json: async () => ({ items: editionHeavy, hasMore: true, nextCursor: 'kakao:2' }) };
  if (cursor === 'kakao:2') return { ok: true, json: async () => ({ items: nextWorks.slice(0, 4), hasMore: true, nextCursor: 'kakao:3' }) };
  if (cursor === 'kakao:3') return { ok: true, json: async () => ({ items: nextWorks.slice(4), hasMore: false, nextCursor: '' }) };
  throw new Error(`unexpected cursor ${cursor}`);
};

const first = await context.fetchWindow('https://api.example/aladin', 'Hemingway', '', [], 10, request);
assert.deepEqual(calls, ['', 'kakao:2'], '판 그룹핑 후 10행이 찰 때까지 다음 cursor를 자동 조회해야 한다');
assert.equal(pageSizes.every((size) => size === '50'), true, 'provider는 공식 최대 page size 50으로 조회해야 한다');
assert.equal(context.rank(first.items, 'Hemingway').length, 10);
assert.equal(first.hasMore, true);
assert.equal(first.nextCursor, 'kakao:3');

calls.length = 0;
const more = await context.fetchWindow('https://api.example/aladin', 'Hemingway', first.nextCursor, first.items, 10, request);
assert.deepEqual(calls, ['kakao:3']);
assert.equal(context.rank(more.items, 'Hemingway').length > context.rank(first.items, 'Hemingway').length, true);
assert.equal(more.hasMore, false);
assert.equal(more.nextCursor, '');

const baseWorks = Array.from({ length: 10 }, (_, i) => ({
  isbn13: `9781111111${String(i).padStart(3, '0')}`,
  title: `Hemingway base ${i + 1}`,
  author: 'Base author',
  source: 'kakao',
}));
const overlappingLocal = {
  isbn13: '9789999999999',
  title: 'Hemingway work 5',
  author: 'Ernest Hemingway',
  _source: 'db',
};
const integratedCalls = [];
const integratedRequest = async (url) => {
  const cursor = new URL(url).searchParams.get('cursor') || '';
  integratedCalls.push(cursor);
  if (cursor === 'kakao:2') return { ok: true, json: async () => ({ items: nextWorks, hasMore: true, nextCursor: 'kakao:3' }) };
  if (cursor === 'kakao:3') return { ok: true, json: async () => ({
    items: [{ isbn13: '9799999999999', title: 'Hemingway final work', author: 'Ernest Hemingway', source: 'kakao' }],
    hasMore: false,
    nextCursor: '',
  }) };
  throw new Error(`unexpected integrated cursor ${cursor}`);
};
const countIntegratedRows = (remoteBooks) => context.rank([overlappingLocal, ...remoteBooks], 'Hemingway').length;
const integrated = await context.fetchWindow(
  'https://api.example/aladin', 'Hemingway', 'kakao:2', baseWorks, 10, integratedRequest, countIntegratedRows,
);
assert.deepEqual(integratedCalls, ['kakao:2', 'kakao:3'], 'DB/로컬 작품과 그룹핑돼도 통합 10행이 찰 때까지 계속 조회해야 한다');
assert.equal(countIntegratedRows(integrated.items), countIntegratedRows(baseWorks) + 10);

const previousPage = context.rank([
  { isbn13: '9782000000001', title: '카뮈', author: '최수철', _source: 'aladin' },
  { isbn13: '9782000000002', title: '페스트', author: '알베르 카뮈', _source: 'aladin' },
  { isbn13: '9782000000003', title: '이방인', author: '알베르 카뮈', _source: 'aladin' },
], '카뮈');
const rerankedAfterContinuation = context.rank([
  ...previousPage,
  { isbn13: '9782000000004', title: '카뮈의 철학', author: '신규 저자', _source: 'aladin' },
  { isbn13: '9782000000005', title: '카뮈 평전', author: '신규 저자', _source: 'aladin' },
], '카뮈');
const stableAfterContinuation = context.appendStable(previousPage, rerankedAfterContinuation);
assert.deepEqual(
  Array.from(stableAfterContinuation.slice(0, previousPage.length), (book) => book.title),
  Array.from(previousPage, (book) => book.title),
  'continuation 결과는 기존 작품 행의 상대 순서를 바꾸지 않아야 한다',
);
assert.deepEqual(
  Array.from(stableAfterContinuation.slice(previousPage.length), (book) => book.title),
  ['카뮈의 철학', '카뮈 평전'],
  '새 작품은 새 page 내부 관련도 순서대로 기존 결과 뒤에 추가해야 한다',
);
