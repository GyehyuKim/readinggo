import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../docs/readinggo/js/search.js', import.meta.url), 'utf8');
const purePrefix = source.slice(0, source.indexOf('const SearchModal'));
const context = { URL, URLSearchParams };
vm.runInNewContext(`${purePrefix}\nthis.rank = rgRankSearchResults; this.fetchWindow = rgFetchRemoteWindow;`, context);

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
const request = async (url) => {
  const parsed = new URL(url);
  const cursor = parsed.searchParams.get('cursor') || '';
  calls.push(cursor);
  if (!cursor) return { ok: true, json: async () => ({ items: editionHeavy, hasMore: true, nextCursor: 'kakao:2' }) };
  if (cursor === 'kakao:2') return { ok: true, json: async () => ({ items: nextWorks.slice(0, 4), hasMore: true, nextCursor: 'kakao:3' }) };
  if (cursor === 'kakao:3') return { ok: true, json: async () => ({ items: nextWorks.slice(4), hasMore: false, nextCursor: '' }) };
  throw new Error(`unexpected cursor ${cursor}`);
};

const first = await context.fetchWindow('https://api.example/aladin', 'Hemingway', '', [], 10, request);
assert.deepEqual(calls, ['', 'kakao:2'], '판 그룹핑 후 10행이 찰 때까지 다음 cursor를 자동 조회해야 한다');
assert.equal(context.rank(first.items, 'Hemingway').length, 10);
assert.equal(first.hasMore, true);
assert.equal(first.nextCursor, 'kakao:3');

calls.length = 0;
const more = await context.fetchWindow('https://api.example/aladin', 'Hemingway', first.nextCursor, first.items, 10, request);
assert.deepEqual(calls, ['kakao:3']);
assert.equal(context.rank(more.items, 'Hemingway').length > context.rank(first.items, 'Hemingway').length, true);
assert.equal(more.hasMore, false);
assert.equal(more.nextCursor, '');
