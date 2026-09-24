import test from 'node:test';
import assert from 'node:assert/strict';
import * as chapterCore from './chapter-core.js';

class MemoryStorage {
  constructor() { this.values = new Map(); this.failNext = false; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    if (this.failNext) { this.failNext = false; throw new Error('quota'); }
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

test('local adapter preserves null pages and atomically replaces chapters', async () => {
  const storage = new MemoryStorage();
  const state = {
    user_books: [{ id: 'ub-1', book_id: 'book-1', current_page: 7, visibility: 'private',
      book: { total_pages: 100 }, sessions: [], sentences: [], chapters: [] }],
    active_user_book_id: 'ub-1', streak: { current: 0, longest: 0, last_check_in_date: null },
    claps: {}, bookmarks: {}, wish_books: [], wish_book_created_at: {}, settings: {}, pending: {},
  };
  storage.setItem('rg_v41', JSON.stringify(state));
  globalThis.window = globalThis;
  globalThis.localStorage = storage;
  globalThis.RG_chapters = { assertValid: chapterCore.assertValidChapterRows,
    sameRows: chapterCore.sameChapterRows, project: chapterCore.projectChapters, validate: chapterCore.validateChapterRows };
  globalThis.INITIAL_STATE = {};
  globalThis.INITIAL_BOOKSHELF = {};
  globalThis.WISHLIST = [];
  await import(`./datastore.js?chapter-test=${Date.now()}`);

  const missing = globalThis.DataStore.sentences.add({ userBookId: 'ub-1', page: null, text: 'missing' });
  const defaulted = globalThis.DataStore.sentences.add({ userBookId: 'ub-1', text: 'defaulted' });
  assert.equal(missing.page, null);
  assert.equal(defaulted.page, 7);

  const first = [{ title: 'One', start_page: 1, depth: 0, position: 0 }];
  const saved = globalThis.DataStore.chapters.replace('ub-1', first);
  assert.deepEqual(saved.map(({ title, start_page, depth, position }) => ({ title, start_page, depth, position })), first);
  assert.deepEqual(globalThis.DataStore.chapters.list('ub-1').map(x => x.title), ['One']);
  assert.deepEqual(await globalThis.DataStore.chapters.publicByBook('ub-1'), []);

  storage.failNext = true;
  assert.throws(() => globalThis.DataStore.chapters.replace('ub-1', [
    { title: 'Replacement', start_page: 2, depth: 0, position: 0 },
  ]), /quota/);
  assert.deepEqual(globalThis.DataStore.chapters.list('ub-1').map(x => x.title), ['One']);

  const remote = saved.map(row => ({ ...row, created_at: '2026-01-01', updated_at: '2026-01-01' }));
  const query = {
    select() { return this; }, eq() { return this; }, order() { return this; },
    then(resolve) { resolve({ data: remote.map(row => ({ ...row })), error: null }); },
  };
  globalThis.RG_SB = {
    client: () => ({ from: () => Object.create(query), rpc: async () => ({ data: remote.map(({ title, start_page, depth, position }) => ({ title, start_page, depth, position })), error: null }) }),
    onAuthChange: () => {},
  };
  await import(`./datastore-supabase.js?chapter-test=${Date.now()}`);
  const supabaseRows = await globalThis.SupabaseDataStore.chapters.list('ub-1');
  const publicRows = await globalThis.SupabaseDataStore.chapters.publicByBook('ub-1');
  assert.equal(chapterCore.sameChapterRows(saved, supabaseRows), true);
  assert.equal(chapterCore.sameChapterRows(saved, publicRows), true);
  const sentences = [{ id: 's2', page: 2, created_at: '2026-01-02' }, { id: 's1', page: null, created_at: '2026-01-01' }];
  assert.deepEqual(chapterCore.projectChapters(saved, sentences, 100).counts,
    chapterCore.projectChapters(supabaseRows, sentences, 100).counts);
});
