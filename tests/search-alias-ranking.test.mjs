import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../docs/readinggo/js/search.js', import.meta.url), 'utf8');
const purePrefix = source.slice(0, source.indexOf('const SearchModal'));
const context = {};
vm.runInNewContext(`${purePrefix}\nthis.expand = rgExpandSearchQueries; this.fuzzy = rgFuseSearchBooks; this.rank = rgRankSearchResults;`, context);

assert.deepEqual(
  [...context.expand('오뒷세이아')],
  ['오뒷세이아', '오디세이', '오뒷세이', 'oddesay'],
  '오디세이 작품군의 확인된 한국어 표기·영문 오타를 함께 검색해야 한다',
);
assert.deepEqual([...context.expand('데미안')], ['데미안'], '일반 질의는 임의 확장하지 않아야 한다');

const rows = {
  오뒷세이아: [
    { item: { isbn: '1', title: '오뒷세이아', author: '호메로스' }, score: 0 },
    { item: { isbn: '2', title: '오뒷세이', author: '호메로스' }, score: 0.2 },
  ],
  오디세이: [
    { item: { isbn: '3', title: '오디세이', author: '호메로스' }, score: 0 },
    { item: { isbn: 'noise', title: '2010 스페이스 오디세이', author: '아서 C. 클라크' }, score: 0.08 },
  ],
  오뒷세이: [
    { item: { isbn: '2', title: '오뒷세이', author: '호메로스' }, score: 0 },
  ],
  oddesay: [
    { item: { isbn: '4', title: 'Oddesay', author: 'Homer' }, score: 0.1 },
  ],
};
const calls = [];
const fuse = { search(query) { calls.push(query); return rows[query] || []; } };
const candidates = context.fuzzy(fuse, '오뒷세이아', 20);
assert.deepEqual(calls, ['오뒷세이아', '오디세이', '오뒷세이', 'oddesay']);
assert.equal(candidates.length, 4, 'alias별 중복 ISBN은 한 번만 남겨야 한다');
assert.equal(candidates.find((row) => row.item.isbn === '2').score, 0, '같은 책은 가장 강한 Fuse 점수를 보존해야 한다');

const ranked = context.rank(
  candidates.map(({ item, score }) => ({ ...item, _source: 'local', _fuzzyScore: score })),
  '오뒷세이아',
);
assert.deepEqual(
  [...ranked.map((book) => book.title)],
  ['오뒷세이아', '오뒷세이', '오디세이', 'Oddesay'],
  '통합 정렬기가 alias/Fuse 후보를 tier 0으로 다시 제거하면 안 된다',
);

assert.match(source, /includeScore:\s*true/, 'Fuse 신뢰도를 통합 정렬에 전달해야 한다');
console.log('✓ #1388 오디세이 유사 표기 검색·통합 정렬 회귀');
