import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const supabase = read('docs/readinggo/js/datastore-supabase.js');
const localSource = read('docs/readinggo/js/datastore.js');
const modal = read('docs/readinggo/js/book-detail-modal.js');
const library = read('docs/readinggo/js/library.js');
const app = read('docs/readinggo/js/app.js');

test('completed metadata uses owner-scoped mutations without rewriting completion fields', () => {
  assert.match(supabase, /async updateReview\(userBookId, reviewText\)[\s\S]+update\(\{ review_text: reviewText \|\| null \}\)[\s\S]+eq\('user_id', id\)[\s\S]+eq\('status', 'completed'\)[\s\S]+select\(\)\.single\(\)/);
  assert.match(supabase, /async updateRating\(userBookId, rating\)[\s\S]+update\(\{ rating: rating \|\| null \}\)[\s\S]+eq\('status', 'completed'\)/);
  const reviewBlock = supabase.match(/async updateReview[\s\S]+?\n\s*},/)?.[0] || '';
  const ratingBlock = supabase.match(/async updateRating[\s\S]+?\n\s*},/)?.[0] || '';
  assert.doesNotMatch(reviewBlock + ratingBlock, /completed_at|status:\s*'completed'/);
});

test('review save keeps modal open on failure and synchronizes projections only on success', () => {
  assert.match(modal, /DataStore\.books\.updateReview\(book\.ubId, next \|\| null\)/);
  assert.match(modal, /rg:book-review-saved[\s\S]+ubId: book\.ubId[\s\S]+bookId: book\.id[\s\S]+review: next/);
  assert.match(modal, /catch \(e\)[\s\S]+입력한 내용은 그대로 두었어요/);
  assert.match(library, /addEventListener\('rg:book-review-saved'/);
  assert.match(library, /setMyBooks[\s\S]+comment: d\.review/);
  assert.match(library, /addEventListener\('rg:book-rating-saved'/);
  assert.match(app, /addEventListener\('rg:book-review-saved'/);
  assert.match(app, /setBookDetailItem[\s\S]+comment: d\.review/);
  assert.match(app, /addEventListener\('rg:book-rating-saved'/);
});

test('local completed review preserves completion time and rejects stale or non-completed rows', () => {
  const start = localSource.indexOf('const DataStore = {');
  assert.ok(start >= 0, 'DataStore definition missing');
  const storage = {};
  const sandbox = {
    window: { loadBooks: () => Promise.resolve([]) },
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem(key, value) { storage[key] = String(value); },
      removeItem(key) { delete storage[key]; },
    },
    crypto: { randomUUID: () => 'uuid' },
    console,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
  };
  const initialState = {
    user_books: [{ id: 'ub1', book_id: 'b1', status: 'completed', completed_at: '2026-08-01', review_text: null }],
    sentences: [], reading_sessions: [], wish_books: [], claps: [],
  };
  vm.runInNewContext(localSource, sandbox);
  sandbox.window.localStorageAdapter.configure({ storageKey: 'rg_dev_review_persona_review-save', initialState });
  const books = sandbox.window.DataStore.books;
  const row = books.updateReview('ub1', '좋았어요');
  assert.equal(row.review_text, '좋았어요');
  assert.equal(row.completed_at, '2026-08-01');
  assert.equal(row.status, 'completed');
  assert.throws(() => books.updateReview('missing', 'x'), /completed_book_not_found/);
  row.status = 'reading';
  assert.throws(() => books.updateReview('ub1', 'x'), /completed_book_not_found/);
  row.status = 'completed';
  assert.equal(books.updateReview('ub1', null).review_text, null);
});
