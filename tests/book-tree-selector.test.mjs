import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import {
  BookTreeSelector,
  selectBookTree,
  selectBookTreeFromDataStore,
} from '../docs/readinggo/js/book-tree-selector.js';

function ub(id, status = 'reading', startedAt = '2026-08-01T00:00:00Z') {
  return {
    id,
    book_id: `book-${id}`,
    book: { id: `book-${id}`, title: `책 ${id}`, author: `저자 ${id}`, total_pages: 300 },
    status,
    current_page: 12,
    started_at: startedAt,
    completed_at: status === 'completed' ? '2026-08-20T00:00:00Z' : null,
  };
}

function sentence(id, userBookId, overrides = {}) {
  return {
    id,
    user_book_id: userBookId,
    page: 10,
    text: `RAW-SENTENCE-${id}`,
    my_note: `RAW-NOTE-${id}`,
    visibility: 'followers',
    created_at: '2026-08-21T00:00:00Z',
    ...overrides,
  };
}

test('empty input still projects exactly one empty tree', () => {
  const tree = selectBookTree();
  assert.equal(tree.treeCount, 1);
  assert.equal(tree.branchCount, 0);
  assert.equal(tree.leafCount, 0);
  assert.deepEqual(tree.branches, []);
  assert.equal(tree.selectedBranch, null);
  assert.equal(tree.candidates, null);
  assert.equal(tree.candidateCount, null);
  assert.equal(tree.familiarSummary, '책 0권 · 문장 0개');
  assert.equal(tree.accessibilitySummary, '책 0권, 문장 0개');
});

test('one/many branches preserve statuses, exact counts, selection, and stable ordering', () => {
  const books = [
    ub('completed', 'completed', '2026-08-02T00:00:00Z'),
    ub('aborted', 'aborted', '2026-08-03T00:00:00Z'),
    ub('reading-b', 'reading', '2026-08-04T00:00:00Z'),
    ub('reading-a', 'reading', '2026-08-04T00:00:00Z'),
  ];
  const sentences = [
    sentence('old', 'reading-a', { created_at: '2026-08-01T00:00:00Z' }),
    sentence('new', 'reading-a', { created_at: '2026-08-22T00:00:00Z' }),
    sentence('done', 'completed'),
  ];

  const first = selectBookTree({ userBooks: books, sentences, selectedUserBookId: 'completed' });
  const second = selectBookTree({ userBooks: [...books].reverse(), sentences: [...sentences].reverse(), selectedUserBookId: 'completed' });

  assert.equal(first.branchCount, 4);
  assert.equal(first.leafCount, 3);
  assert.deepEqual(first.branches.map((branch) => branch.id), ['reading-a', 'reading-b', 'aborted', 'completed']);
  assert.deepEqual(first.branches.map((branch) => branch.status), ['reading', 'reading', 'aborted', 'completed']);
  assert.deepEqual(first.branches[0].leaves.map((leaf) => leaf.id), ['new', 'old']);
  assert.equal(first.selectedBranch.id, 'completed');
  assert.equal(first.selectedBranch.status, 'completed');
  assert.equal(first.selectedBranch.leafCount, 1);
  assert.deepEqual(second, first);
});

test('only owned sentences associated by user_book_id become leaves, including private rows', () => {
  const tree = selectBookTree({
    userBooks: [ub('a'), ub('b')],
    sentences: [
      sentence('private-own', 'a', { visibility: 'private', book_id: 'wrong-book' }),
      sentence('public-own', 'b', { visibility: 'public' }),
      sentence('orphan', 'missing'),
      { ...sentence('foreign-shape', 'a'), user_book_id: null },
    ],
  });

  const a = tree.branches.find((branch) => branch.id === 'a');
  const b = tree.branches.find((branch) => branch.id === 'b');
  assert.equal(tree.leafCount, 2);
  assert.equal(a.leafCount, 1);
  assert.equal(a.leaves[0].visibility, 'private');
  assert.equal(a.leaves[0].userBookId, 'a');
  assert.equal(b.leafCount, 1);
});

test('projection reflects sentence and book deletion solely through fresh input', () => {
  const books = [ub('a'), ub('b')];
  const rows = [sentence('a1', 'a'), sentence('a2', 'a'), sentence('b1', 'b')];
  const before = selectBookTree({ userBooks: books, sentences: rows });
  const afterSentenceDelete = selectBookTree({ userBooks: books, sentences: rows.filter((row) => row.id !== 'a1') });
  const afterBookDelete = selectBookTree({ userBooks: books.filter((book) => book.id !== 'b'), sentences: rows.filter((row) => row.user_book_id !== 'b') });

  assert.deepEqual([before.branchCount, before.leafCount], [2, 3]);
  assert.deepEqual([afterSentenceDelete.branchCount, afterSentenceDelete.leafCount], [2, 2]);
  assert.deepEqual([afterBookDelete.branchCount, afterBookDelete.leafCount], [1, 2]);
});

test('wish rows never count as branches and are separate only when wishBooks is supported', () => {
  const wish = { book_id: 'wish-1', book: { id: 'wish-1', title: '읽고 싶은 책' }, created_at: '2026-08-22T00:00:00Z' };
  const tree = selectBookTree({
    userBooks: [ub('real'), { ...ub('legacy-wish'), status: 'wish' }],
    sentences: [sentence('wish-leaf', 'legacy-wish')],
    wishBooks: [wish],
  });

  assert.equal(tree.branchCount, 1);
  assert.equal(tree.leafCount, 0);
  assert.equal(tree.candidateCount, 1);
  assert.equal(tree.candidates[0].bookId, 'wish-1');
  assert.equal(selectBookTree({ userBooks: [ub('real')] }).candidates, null);
});

test('DataStore compatibility shim reads only the required read surfaces', async () => {
  const calls = [];
  const dataStore = {
    myBooks: { list: async () => { calls.push('myBooks.list'); return [ub('a')]; } },
    sentences: { listMine: async () => { calls.push('sentences.listMine'); return [sentence('a1', 'a')]; } },
    wishBooks: { list: async () => { calls.push('wishBooks.list'); return []; } },
    xp: { get: () => { throw new Error('must not read XP'); } },
    streak: { get: () => { throw new Error('must not read streak'); } },
    castles: { list: () => { throw new Error('must not read castles'); } },
    likes: { list: () => { throw new Error('must not read likes'); } },
    reactions: { list: () => { throw new Error('must not read reactions'); } },
  };

  const tree = await selectBookTreeFromDataStore(dataStore, { selectedUserBookId: 'a' });
  assert.deepEqual(calls.sort(), ['myBooks.list', 'sentences.listMine', 'wishBooks.list']);
  assert.equal(tree.selectedBranch.id, 'a');
  assert.equal(BookTreeSelector.select, selectBookTree);
  assert.equal(BookTreeSelector.fromDataStore, selectBookTreeFromDataStore);
});

test('large input remains deterministic, immutable, and excludes raw sentence text from projection/logging', () => {
  const books = Array.from({ length: 2_000 }, (_, index) => ub(`ub-${String(index).padStart(4, '0')}`, index % 3 === 0 ? 'completed' : index % 3 === 1 ? 'reading' : 'aborted', '2026-08-01T00:00:00Z'));
  const rows = [];
  for (const book of books) {
    for (let index = 0; index < 10; index += 1) {
      rows.push(sentence(`${book.id}-s-${index}`, book.id, {
        text: `DO-NOT-LOG-${book.id}-${index}`,
        visibility: index % 2 ? 'private' : 'followers',
        created_at: index,
      }));
    }
  }

  const seenLogs = [];
  const originalLog = console.log;
  console.log = (...args) => seenLogs.push(args);
  let tree;
  const started = performance.now();
  try {
    tree = selectBookTree({ userBooks: books, sentences: rows });
  } finally {
    console.log = originalLog;
  }
  const elapsed = performance.now() - started;

  assert.equal(tree.branchCount, 2_000);
  assert.equal(tree.leafCount, 20_000);
  assert.equal(seenLogs.length, 0);
  assert.ok(elapsed < 2_000, `projection took ${elapsed.toFixed(1)}ms`);
  assert.equal(JSON.stringify(tree).includes('DO-NOT-LOG'), false);
  assert.equal(JSON.stringify(tree).includes('RAW-NOTE'), false);
  assert.equal(Object.isFrozen(tree), true);
  assert.equal(Object.isFrozen(tree.branches), true);
  assert.equal(Object.isFrozen(tree.branches[0].leaves), true);
});
