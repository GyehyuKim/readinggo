import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../docs/readinggo/js/app.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const brace = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is not balanced`);
}

function harness(state, options = {}) {
  const remoteBooks = (options.remoteBooks || []).map(x => structuredClone(x));
  const remoteWishes = (options.remoteWishes || []).map(x => structuredClone(x));
  const remoteSentences = [];
  const catalog = new Map(remoteWishes.map(x => [x.book_id || (x.book && x.book.id), x.book]).filter(x => x[0]));
  const booksById = options.booksById || {};
  const calls = { adds: [], aborts: [], reviews: [], sentences: [], active: [], wishAdds: [], upserts: [], sessions: 0 };
  const failed = new Set();
  const failOnce = (kind, key, configured) => {
    if (!configured || !configured.includes(key) || failed.has(`${kind}:${key}`)) return false;
    failed.add(`${kind}:${key}`);
    return true;
  };
  const canonicalIds = new Map();
  const canonicalId = (book) => {
    if (book && /^[0-9a-f-]{36}$/i.test(String(book.id || ''))) return book.id;
    const key = book.isbn13 || `${book.title || ''}|${book.author || ''}`;
    if (!canonicalIds.has(key)) canonicalIds.set(key, `10000000-0000-4000-8000-${String(canonicalIds.size + 1).padStart(12, '0')}`);
    return canonicalIds.get(key);
  };
  let migrationSeq = 0;
  const localStorageAdapter = {
    read: () => state,
    mutate: (fn) => { state = fn(state); },
  };
  const SupabaseDataStore = {
    myBooks: {
      list: async () => remoteBooks.slice(),
      add: async (args) => {
        calls.adds.push(structuredClone(args));
        if (failOnce('book', args.book.title, options.failBookTitlesOnce)) throw new Error('synthetic book failure');
        const book = { ...args.book, id: canonicalId(args.book) };
        const row = { id: args.migrationId || `remote-${book.id}`, book_id: book.id, book, status: args.status, current_page: args.current_page };
        remoteBooks.push(row);
        if (failOnce('book-response', args.book.title, options.commitThenThrowBookTitlesOnce)) throw new Error('synthetic lost book response');
        return row;
      },
      abort: async (id) => {
        if (options.failAbortOnce && !failed.has('abort-once')) { failed.add('abort-once'); throw new Error('synthetic abort failure'); }
        calls.aborts.push(id);
        const row = remoteBooks.find(x => x.id === id);
        if (row) row.status = 'aborted';
        return row;
      },
    },
    books: {
      upsert: async (book) => {
        calls.upserts.push(structuredClone(book));
        const canonical = { ...book, id: canonicalId(book) };
        catalog.set(canonical.id, canonical);
        return canonical;
      },
      updateReview: async (id, review) => {
        if (options.failReviewOnce && !failed.has('review-once')) { failed.add('review-once'); throw new Error('synthetic review failure'); }
        calls.reviews.push({ id, review });
        const row = remoteBooks.find(x => x.id === id);
        if (row) row.review_text = review;
        return true;
      },
    },
    wishBooks: {
      list: async () => remoteWishes.slice(),
      add: async (id) => {
        if (options.failWishOnce && !failed.has('wish-once')) { failed.add('wish-once'); throw new Error('synthetic wish failure'); }
        if (failOnce('wish', id, options.failWishIdsOnce)) throw new Error('synthetic wish failure');
        calls.wishAdds.push(id);
        remoteWishes.push({ book_id: id, book: catalog.get(id) || { id } });
        return remoteWishes;
      },
    },
    sessions: { addToday: async () => { calls.sessions++; throw new Error('must not create a session'); } },
    sentences: {
      importExisting: async (row) => {
        const existing = remoteSentences.find(x => x.id === row.migrationId);
        if (existing) return existing;
        if (failOnce('sentence', row.text, options.failSentenceTextsOnce)) throw new Error('synthetic sentence failure');
        const attempt = (options._sentenceAttempts = (options._sentenceAttempts || 0) + 1);
        if ((options.failSentenceAttemptNumbers || []).includes(attempt)) throw new Error('synthetic indexed sentence failure');
        calls.sentences.push(structuredClone(row));
        const saved = { ...structuredClone(row), id: row.migrationId };
        remoteSentences.push(saved);
        if (failOnce('sentence-response', row.text, options.commitThenThrowSentenceTextsOnce)) throw new Error('synthetic lost sentence response');
        return saved;
      },
    },
    activeBook: { set: async (id) => {
      calls.active.push(id);
      if (options.failActiveOnce && !failed.has('active-once')) {
        failed.add('active-once');
        throw new Error('synthetic active failure');
      }
      return true;
    } },
  };
  const normalizeVisibility = (value) => value === 'friends' ? 'followers' : (value === 'public' || value === 'followers' || value === 'private' ? value : 'private');
  const context = {
    window: {
      localStorageAdapter, SupabaseDataStore,
      RG_normalizeStoredSentenceVisibility: normalizeVisibility,
      getBook: (id) => booksById[id] || options.fallbackBook || null,
      crypto: { randomUUID: () => `20000000-0000-4000-8000-${String(++migrationSeq).padStart(12, '0')}` },
    },
    console: { log() {}, warn() {} }, Set, Map,
  };
  const fn = vm.runInNewContext(`(${extractFunction('syncPendingToSupabase')})`, context);
  return { run: fn, state: () => state, calls, remoteBooks, remoteWishes, remoteSentences };
}

// Private UGC migrates without public consent; public/followers remain retryable until consent.
{
  const h = harness({ user_books: [{ id: 'local-book', book: { isbn13: '9780000000001', title: '책', author: '작가' }, sentences: [
    { text: '비공개', visibility: 'private', _guest: true },
    { text: '공개', visibility: 'public', _guest: true },
    { text: '팔로워', visibility: 'followers', _guest: true },
  ] }], wish_books: [], pending: {} });
  await h.run({ allowPublic: false });
  assert.deepEqual(h.calls.sentences.map(x => x.text), ['비공개']);
  assert.equal(h.state().user_books[0].sentences[0]._guest, undefined);
  assert.equal(h.state().user_books[0].sentences[1]._guest, true);
  assert.equal(h.state().user_books[0].sentences[2]._guest, true);
  await h.run({ allowPublic: true });
  assert.deepEqual(h.calls.sentences.map(x => x.text), ['비공개', '공개', '팔로워']);
  assert.equal(h.state().user_books[0].sentences[1]._guest, undefined);
  assert.equal(h.state().user_books[0].sentences[2]._guest, undefined);
  assert.equal(h.calls.adds.length, 1, 'consent retry must reuse the remote book');
}

// Sentence-less reading/completed/aborted books preserve status/progress/rating/review without inventing today.
{
  const state = {
    active_user_book_id: 'reading-local', wish_books: [], pending: {},
    user_books: [
      { id: 'reading-local', status: 'reading', current_page: 37, book: { id: 'local-r', isbn13: '111', title: '읽는 책', author: 'A' }, sentences: [] },
      { id: 'completed-local', status: 'completed', current_page: 280, rating: 4.5, review_text: '좋았다', book: { id: 'local-c', isbn13: '222', title: '완독 책', author: 'B', total_pages: 300 }, sentences: [] },
      { id: 'aborted-local', status: 'aborted', current_page: 81, book: { id: 'local-a', isbn13: '333', title: '중단 책', author: 'C' }, sentences: [] },
    ],
  };
  const h = harness(state);
  await h.run();
  assert.deepEqual(h.calls.adds.map(x => ({ status: x.status, page: x.current_page, rating: x.rating, activate: x.activate })), [
    { status: 'reading', page: 37, rating: undefined, activate: false },
    { status: 'completed', page: 280, rating: 4.5, activate: false },
    { status: 'reading', page: 81, rating: undefined, activate: false },
  ]);
  assert.deepEqual(h.calls.aborts, [h.remoteBooks[2].id]);
  assert.deepEqual(h.calls.reviews, [{ id: h.remoteBooks[1].id, review: '좋았다' }]);
  assert.deepEqual(h.calls.active, [h.remoteBooks[0].id]);
  assert.equal(h.calls.sessions, 0, 'migration must not call sessions.addToday');
  assert.equal(h.state().user_books.length, 3, 'local books must remain intact');
  assert.deepEqual(h.state().user_books.map(x => x._remote_user_book_id), h.remoteBooks.map(x => x.id));
}

// Partial abort/review failures retain the owned remote marker and retry without duplicate books.
{
  const state = { active_user_book_id: null, wish_books: [], pending: {}, user_books: [
    { id: 'aborted', status: 'aborted', current_page: 9, book: { isbn13: '881', title: '중단 재시도', author: 'K' }, sentences: [] },
    { id: 'completed', status: 'completed', current_page: 99, review_text: '소감 재시도', book: { isbn13: '882', title: '소감 재시도', author: 'L' }, sentences: [] },
  ] };
  const h = harness(state, { failAbortOnce: true, failReviewOnce: true });
  await h.run();
  assert.equal(h.calls.adds.length, 2);
  assert.equal(h.state().user_books[0]._remote_user_book_id, h.remoteBooks[0].id);
  assert.equal(h.state().user_books[1]._remote_user_book_id, h.remoteBooks[1].id);
  assert.equal(h.remoteBooks[0].status, 'reading');
  assert.equal(h.remoteBooks[1].review_text, undefined);
  await h.run();
  assert.equal(h.calls.adds.length, 2, 'retry must not create duplicate books');
  assert.deepEqual(h.calls.aborts, [h.remoteBooks[0].id]);
  assert.deepEqual(h.calls.reviews, [{ id: h.remoteBooks[1].id, review: '소감 재시도' }]);
  assert.equal(h.remoteBooks[0].status, 'aborted');
  assert.equal(h.remoteBooks[1].review_text, '소감 재시도');
}

// Existing remote rows match by ISBN/title+author and are reused without overwriting status/page.
{
  const existing = { id: 'existing-ub', book_id: 'canonical-existing', status: 'completed', current_page: 400, book: { id: 'canonical-existing', isbn13: '444', title: '원격 책', author: '작가' } };
  const h = harness({ active_user_book_id: 'local', wish_books: [], pending: {}, user_books: [
    { id: 'local', status: 'reading', current_page: 12, book: { isbn13: '444', title: '다른 표기', author: '작가' }, sentences: [{ text: '문장', visibility: 'private', _guest: true }] },
  ] }, { remoteBooks: [existing] });
  await h.run();
  assert.equal(h.calls.adds.length, 0);
  assert.equal(h.calls.sentences[0].userBookId, 'existing-ub');
  assert.equal(h.calls.active.length, 0, 'a completed remote row must not become active');
  assert.equal(h.remoteBooks[0].status, 'completed');
  assert.equal(h.remoteBooks[0].current_page, 400);
}

// Wishes resolve local IDs, avoid normalized duplicates, canonicalize new books, and remain idempotent.
{
  const booksById = {
    'wish-new': { id: 'wish-new', isbn13: '555', title: '새 찜', author: 'D' },
    'wish-existing': { id: 'wish-existing', isbn13: '', title: '  이미   찜 ', author: ' E ' },
  };
  const h = harness({ user_books: [], wish_books: ['wish-new', 'wish-existing'], pending: {} }, {
    booksById,
    remoteWishes: [{ book_id: 'canonical-old', book: { id: 'canonical-old', title: '이미 찜', author: 'e' } }],
  });
  await h.run();
  await h.run();
  assert.equal(h.calls.upserts.length, 1);
  assert.equal(h.calls.wishAdds.length, 1);
  assert.equal(h.calls.wishAdds[0], h.remoteWishes.find(x => x.book && x.book.title === '새 찜').book_id);
  assert.deepEqual(h.state().wish_books, ['wish-new', 'wish-existing'], 'local wishes must remain');
}

// One book/wish failure does not block siblings; failed local markers/data survive and retry cleanly.
{
  const state = {
    active_user_book_id: null, pending: {}, wish_books: ['wish-ok', 'wish-retry'],
    user_books: [
      { id: 'ok', status: 'reading', book: { isbn13: '601', title: '성공 책', author: 'F' }, sentences: [{ text: '성공 문장', visibility: 'private', _guest: true }] },
      { id: 'retry', status: 'reading', book: { isbn13: '602', title: '재시도 책', author: 'G' }, sentences: [{ text: '재시도 문장', visibility: 'private', _guest: true }] },
    ],
  };
  const h = harness(state, {
    booksById: {
      'wish-ok': { id: 'wish-ok', isbn13: '701', title: '성공 찜', author: 'H' },
      'wish-retry': { id: 'wish-retry', isbn13: '702', title: '재시도 찜', author: 'I' },
    },
    failBookTitlesOnce: ['재시도 책'], failWishOnce: true,
  });
  await h.run();
  assert.equal(h.state().user_books[0].sentences[0]._guest, undefined);
  assert.equal(h.state().user_books[1].sentences[0]._guest, true);
  assert.deepEqual(h.state().wish_books, ['wish-ok', 'wish-retry']);
  await h.run();
  assert.equal(h.state().user_books[1].sentences[0]._guest, undefined);
  assert.equal(h.remoteBooks.filter(x => x.book.isbn13 === '601').length, 1, 'successful sibling must not duplicate on retry');
  assert.equal(h.calls.wishAdds.length, 2);
}

// Legacy pending.book keeps its remote marker across partial sentence failure and reuses it on retry.
{
  const initial = { user_books: [], wish_books: [], pending: { book: { isbn13: '999', title: '부분 성공 책', author: 'J' }, sentence: { text: '재시도 문장', visibility: 'private' } } };
  const h = harness(initial, { failSentenceTextsOnce: ['재시도 문장'] });
  await h.run({ allowPublic: false });
  assert.ok(h.state().pending.book);
  assert.equal(h.state().pending.book.remote_user_book_id, h.remoteBooks[0].id);
  assert.ok(h.state().pending.sentence);
  await h.run({ allowPublic: false });
  assert.equal(h.state().pending.book, undefined);
  assert.equal(h.state().pending.sentence, undefined);
  assert.deepEqual(h.calls.sentences.map(x => x.text), ['재시도 문장']);
  assert.equal(h.calls.adds.length, 1, 'pending retry must reuse the created remote book');
  assert.deepEqual(h.calls.active, [h.remoteBooks[0].id], 'sentence retry must not reactivate an already activated book');
}

// Active migration retries only when activeBook.set itself fails.
{
  const h = harness({ active_user_book_id: 'active-retry', wish_books: [], pending: {}, user_books: [{
    id: 'active-retry', status: 'reading', book: { isbn13: '998', title: '활성 재시도', author: 'W' }, sentences: [],
  }] }, { failActiveOnce: true });
  await h.run();
  assert.equal(h.state().user_books[0]._migration_complete, false);
  assert.equal(h.state().user_books[0]._migration_active_complete, false);
  await h.run();
  assert.deepEqual(h.calls.active, [h.remoteBooks[0].id, h.remoteBooks[0].id]);
  assert.equal(h.state().user_books[0]._migration_active_complete, true);
  assert.equal(h.state().user_books[0]._migration_complete, true);
  await h.run();
  assert.equal(h.calls.active.length, 2, 'successful active retry must become one-shot');
}

// Lost responses reuse pre-persisted UUIDs: no duplicate book/sentence and deferred status completes.
{
  const state = { active_user_book_id: null, wish_books: [], pending: {}, user_books: [{
    id: 'lost', status: 'aborted', book: { isbn13: '991', title: '응답 유실 책', author: 'M' },
    sentences: [{ text: '응답 유실 문장', visibility: 'private', _guest: true }],
  }] };
  const h = harness(state, { commitThenThrowBookTitlesOnce: ['응답 유실 책'] });
  await h.run();
  assert.equal(h.remoteBooks.length, 1);
  assert.equal(h.state().user_books[0]._remote_user_book_id, undefined);
  assert.ok(h.state().user_books[0]._migration_user_book_id);
  await h.run();
  assert.equal(h.remoteBooks.length, 1, 'lost book response must not duplicate user_books');
  assert.equal(h.remoteBooks[0].status, 'aborted');
  assert.equal(h.state().user_books[0].sentences[0]._guest, undefined);
}

{
  const state = { active_user_book_id: null, wish_books: [], pending: {}, user_books: [{
    id: 'lost-sentence', status: 'reading', book: { isbn13: '992', title: '문장 응답 유실', author: 'N' },
    sentences: [{ text: '한 번만 저장', visibility: 'private', _guest: true }],
  }] };
  const h = harness(state, { commitThenThrowSentenceTextsOnce: ['한 번만 저장'] });
  await h.run();
  assert.equal(h.remoteSentences.length, 1);
  assert.equal(h.state().user_books[0].sentences[0]._guest, true);
  await h.run();
  assert.equal(h.remoteSentences.length, 1, 'lost sentence response must reuse the same sentence PK');
  assert.equal(h.state().user_books[0].sentences[0]._guest, undefined);
}

// Identical id-less sentences keep independent migration IDs and success markers.
{
  const duplicate = { text: '같은 문장', page: 7, visibility: 'private', _guest: true };
  const h = harness({ active_user_book_id: null, wish_books: [], pending: {}, user_books: [{
    id: 'duplicates', status: 'reading', book: { isbn13: '993', title: '중복 문장 책', author: 'O' },
    sentences: [structuredClone(duplicate), structuredClone(duplicate)],
  }] }, { failSentenceAttemptNumbers: [2] });
  await h.run();
  assert.equal(h.state().user_books[0].sentences[0]._guest, undefined);
  assert.equal(h.state().user_books[0].sentences[1]._guest, true);
  await h.run();
  assert.equal(h.remoteSentences.length, 2);
  assert.equal(h.state().user_books[0].sentences[1]._guest, undefined);
}

// Canonical UUIDs work without ISBN; unknown wish fallback and different canonical editions never merge.
{
  const canonical = '30000000-0000-4000-8000-000000000001';
  const other = '30000000-0000-4000-8000-000000000002';
  const h = harness({ active_user_book_id: null, wish_books: ['missing-wish'], pending: {}, user_books: [{
    id: 'canonical-local', status: 'reading', book: { id: canonical, title: '동명 책', author: 'P' },
    sentences: [{ text: '내 판본 문장', visibility: 'private', _guest: true }],
  }] }, {
    fallbackBook: { id: 'b001', title: '사피엔스', author: '유발 하라리' },
    remoteBooks: [{ id: 'existing-edition', book_id: other, status: 'reading', book: { id: other, title: '동명 책', author: 'P' } }],
  });
  await h.run();
  assert.equal(h.calls.adds.length, 1);
  assert.equal(h.calls.adds[0].book.id, canonical, 'canonical UUID without ISBN must be preserved');
  assert.equal(h.calls.sentences[0].userBookId, h.remoteBooks[1].id, 'different canonical edition must not receive the sentence');
  assert.equal(h.calls.wishAdds.length, 0, 'unknown wish must not migrate fallback Sapiens');
}

// Canonical book_id beats a nested legacy id; corrupted markers and completed pending conflicts fail closed.
{
  const canonical = '40000000-0000-4000-8000-000000000001';
  const existing = { id: 'canonical-existing-ub', book_id: canonical, status: 'reading', book: { id: canonical, title: '정본 책', author: 'Q' } };
  const h = harness({ active_user_book_id: null, wish_books: [], pending: {}, user_books: [{
    id: 'canonical-book-id', book_id: canonical, status: 'reading', book: { id: 'b001', title: '정본 책', author: 'Q' },
    sentences: [{ text: '정본 귀속', visibility: 'private', _guest: true }],
  }] }, { remoteBooks: [existing] });
  await h.run();
  assert.equal(h.calls.adds.length, 0);
  assert.equal(h.calls.sentences[0].userBookId, existing.id);
}

{
  const localCanonical = '40000000-0000-4000-8000-000000000002';
  const otherCanonical = '40000000-0000-4000-8000-000000000003';
  const marker = '20000000-0000-4000-8000-000000000099';
  const h = harness({ active_user_book_id: 'marker-mismatch', wish_books: [], pending: {}, user_books: [{
    id: 'marker-mismatch', _migration_user_book_id: marker, status: 'reading',
    book: { id: localCanonical, title: '로컬 판본', author: 'R' },
    sentences: [{ text: '옮기면 안 됨', visibility: 'private', _guest: true }],
  }] }, { remoteBooks: [{ id: marker, book_id: otherCanonical, status: 'reading', book: { id: otherCanonical, title: '다른 판본', author: 'R' } }] });
  await h.run();
  assert.equal(h.calls.adds.length, 0);
  assert.equal(h.calls.sentences.length, 0);
  assert.equal(h.calls.active.length, 0);
  assert.equal(h.state().user_books[0].sentences[0]._guest, true);
}

{
  const h = harness({ active_user_book_id: null, wish_books: [], user_books: [], pending: {
    book: { isbn13: '994', title: '이미 완독', author: 'S' },
  } }, { remoteBooks: [{ id: 'completed-existing', status: 'completed', book: { id: '50000000-0000-4000-8000-000000000001', isbn13: '994', title: '이미 완독', author: 'S' } }] });
  await h.run();
  assert.equal(h.calls.adds.length, 0);
  assert.equal(h.calls.active.length, 0, 'completed remote conflict must not become active');
}

// Completed one-shot migrations never resurrect a remotely deleted book or wish.
{
  const h = harness({ active_user_book_id: 'one-shot', wish_books: [], pending: {}, user_books: [{
    id: 'one-shot', status: 'reading', book: { isbn13: '995', title: '한 번만 이관', author: 'T' }, sentences: [],
  }] });
  await h.run();
  assert.equal(h.calls.adds.length, 1);
  assert.equal(h.calls.active.length, 1);
  assert.equal(h.state().user_books[0]._migration_complete, true);
  h.remoteBooks.splice(0);
  await h.run();
  assert.equal(h.calls.adds.length, 1, 'remote deletion must not resurrect a completed guest book');
  assert.equal(h.calls.active.length, 1, 'completed active migration must not overwrite a later account choice');
}

{
  const h = harness({ user_books: [], wish_books: ['wish-once'], pending: {} }, {
    booksById: { 'wish-once': { id: 'wish-once', isbn13: '996', title: '한 번만 찜', author: 'U' } },
  });
  await h.run();
  assert.equal(h.calls.wishAdds.length, 1);
  assert.equal(Array.from(h.state()._migration_completed_wish_ids).join(','), 'wish-once');
  h.remoteWishes.splice(0);
  await h.run();
  assert.equal(h.calls.wishAdds.length, 1, 'remote deletion must not resurrect a completed guest wish');
}

// Reusing an existing account row imports sentences but never claims active-book ownership.
{
  const canonical = '60000000-0000-4000-8000-000000000001';
  const existing = { id: 'account-reading', book_id: canonical, status: 'reading', book: { id: canonical, isbn13: '997', title: '계정 책', author: 'V' } };
  const h = harness({ active_user_book_id: 'guest-active', wish_books: [], pending: {}, user_books: [{
    id: 'guest-active', status: 'reading', book: { isbn13: '997', title: '계정 책', author: 'V' },
    sentences: [{ text: '기존 책으로 이관', visibility: 'private', _guest: true }],
  }] }, { remoteBooks: [existing] });
  await h.run();
  assert.equal(h.calls.adds.length, 0);
  assert.equal(h.calls.sentences[0].userBookId, existing.id);
  assert.equal(h.calls.active.length, 0, 'guest active id must not overwrite the existing account active book');
  assert.equal(h.state().user_books[0]._migration_owned, false);
  assert.equal(h.state().user_books[0]._migration_complete, true);
  h.remoteBooks.splice(0);
  await h.run();
  assert.equal(h.calls.adds.length, 0, 'deleted existing account row must not be recreated from stale guest data');
}

console.log('✅ UGC guest library synchronization behavior passed');
