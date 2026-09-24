import test from 'node:test';
import assert from 'node:assert/strict';
import { projectChapters, validateChapterRows } from './chapter-core.js';
import { migrateGuestChapters } from './chapter-migration.js';

const rows = [
  { title: 'Part', start_page: 10, depth: 0, position: 0 },
  { title: 'Child A', start_page: 20, depth: 1, position: 1 },
  { title: 'Grandchild', start_page: 30, depth: 2, position: 2 },
  { title: 'Child B', start_page: 40, depth: 1, position: 3 },
  { title: 'Next', start_page: 60, depth: 0, position: 4 },
];
const sentence = (id, page, created_at = '2026-01-01T00:00:00Z') => ({ id, page, created_at });

test('no TOC preserves the complete flat timeline', () => {
  const projection = projectChapters([], [sentence('old', null, '2026-01-01'), sentence('new', 9, '2026-01-02')], 100);
  assert.equal(projection.hasToc, false);
  assert.deepEqual(projection.all.map(x => x.id), ['new', 'old']);
  assert.deepEqual(projection.counts, { all: 2, chaptered: 0, page_missing: 0, outside_toc: 0 });
});

test('ranges use [start,next-1], known totals close last range, null and outside remain separate', () => {
  const projection = projectChapters(rows, [
    sentence('before', 9), sentence('first', 10), sentence('boundary-left', 19),
    sentence('boundary-right', 20), sentence('last', 304), sentence('over', 305), sentence('missing', null),
  ], 304);
  assert.equal(projection.chapters[0].end_page, 19);
  assert.equal(projection.chapters.at(-1).end_page, 304);
  assert.deepEqual(projection.chapters[0].sentences.map(x => x.id), ['first', 'boundary-left']);
  assert.deepEqual(projection.chapters[1].sentences.map(x => x.id), ['boundary-right']);
  assert.deepEqual(projection.page_missing.map(x => x.id), ['missing']);
  assert.deepEqual(projection.outside_toc.map(x => x.id), ['before', 'over']);
});

test('unknown total leaves the last range open', () => {
  const projection = projectChapters(rows, [sentence('far', 9999)], null);
  assert.equal(projection.chapters.at(-1).end_page, null);
  assert.deepEqual(projection.chapters.at(-1).sentences.map(x => x.id), ['far']);
});

test('nested direct and aggregate counts do not duplicate the global count', () => {
  const projection = projectChapters(rows, [
    sentence('p', 10), sentence('a', 20), sentence('g', 30), sentence('b', 40), sentence('n', 60),
  ], 100);
  assert.deepEqual(projection.chapters.map(x => [x.direct_count, x.aggregate_count]),
    [[1, 4], [1, 2], [1, 1], [1, 1], [1, 1]]);
  assert.equal(projection.counts.all, 5);
  assert.equal(projection.counts.chaptered, 5);
});

test('chapter sentence order is deterministic by page, created_at, id', () => {
  const projection = projectChapters([{ title: 'One', start_page: 1, depth: 0, position: 0 }], [
    sentence('z', 2, '2026-01-01'), sentence('b', 1, '2026-01-02'), sentence('a', 1, '2026-01-02'),
  ]);
  assert.deepEqual(projection.chapters[0].sentences.map(x => x.id), ['a', 'b', 'z']);
});

test('validation rejects invalid depth, order, duplicates, positions, and over-total starts', () => {
  const invalid = [
    [{ title: 'A', start_page: 1, depth: 1, position: 0 }],
    [{ title: 'A', start_page: 2, depth: 0, position: 0 }, { title: 'B', start_page: 1, depth: 0, position: 1 }],
    [{ title: 'A', start_page: 1, depth: 0, position: 0 }, { title: 'B', start_page: 1, depth: 0, position: 1 }],
    [{ title: 'A', start_page: 1, depth: 0, position: 1 }],
    [{ title: 'A', start_page: 101, depth: 0, position: 0 }],
    [{ title: 'A', start_page: 1, depth: 0, position: 0 }, { title: 'B', start_page: 2, depth: 2, position: 1 }],
  ];
  invalid.forEach(candidate => assert.equal(validateChapterRows(candidate, 100).valid, false));
});

test('guest migration recovers a lost response and retries idempotently', async () => {
  let remote = [], writes = 0;
  const dataStore = { chapters: {
    list: async () => remote.map(x => ({ ...x })),
    replace: async (_id, intended) => { writes++; remote = intended.map(x => ({ ...x })); throw new Error('response_lost'); },
  } };
  const intended = [{ title: 'A', start_page: 1, depth: 0, position: 0 }];
  assert.equal((await migrateGuestChapters({ chapters: intended, remoteUserBookId: 'ub', dataStore })).complete, true);
  assert.equal(writes, 1);
  assert.equal((await migrateGuestChapters({ chapters: intended, remoteUserBookId: 'ub', dataStore })).replayed, true);
  assert.equal(writes, 1);
});

test('guest migration fails closed and never overwrites a conflicting remote TOC', async () => {
  let writes = 0;
  const dataStore = { chapters: {
    list: async () => [{ title: 'Remote', start_page: 1, depth: 0, position: 0 }],
    replace: async () => { writes++; },
  } };
  await assert.rejects(() => migrateGuestChapters({
    chapters: [{ title: 'Local', start_page: 1, depth: 0, position: 0 }], remoteUserBookId: 'ub', dataStore,
  }), /chapter_migration_conflict/);
  assert.equal(writes, 0);
});
