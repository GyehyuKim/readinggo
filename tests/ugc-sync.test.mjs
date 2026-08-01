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

function harness(state, { failSentenceOnce = false } = {}) {
  let sentenceAttempts = 0;
  const added = [];
  const localStorageAdapter = {
    read: () => state,
    mutate: (fn) => { state = fn(state); },
  };
  const SupabaseDataStore = {
    myBooks: { add: async ({ book }) => ({ id: `remote-${book.title}` }) },
    sessions: { addToday: async () => true },
    sentences: { add: async (row) => {
      sentenceAttempts++;
      if (failSentenceOnce && sentenceAttempts === 1) throw new Error('synthetic sentence failure');
      added.push(row);
      return { id: `sentence-${sentenceAttempts}` };
    } },
    activeBook: { set: async () => true },
  };
  const context = { window: { localStorageAdapter, SupabaseDataStore }, console: { log() {}, warn() {} }, Set };
  const fn = vm.runInNewContext(`(${extractFunction('syncPendingToSupabase')})`, context);
  return { run: fn, state: () => state, added };
}

{
  const h = harness({ user_books: [{ id: 'local-book', book: { title: '책' }, sentences: [
    { text: '비공개', visibility: 'private', _guest: true },
    { text: '공개', visibility: 'public', _guest: true },
  ] }], pending: {} });
  await h.run({ allowPublic: false });
  assert.deepEqual(h.added.map((x) => x.text), ['비공개']);
  assert.equal(h.state().user_books[0].sentences[0]._guest, undefined, 'private sentence without a local id clears after success');
  assert.equal(h.state().user_books[0].sentences[1]._guest, true, 'public sentence remains local before consent');
}

{
  const initial = { user_books: [], pending: { book: { title: '부분 성공 책' }, sentence: { text: '재시도 문장', visibility: 'private' } } };
  const h = harness(initial, { failSentenceOnce: true });
  await h.run({ allowPublic: false });
  assert.ok(h.state().pending.book, 'book marker must survive a sentence failure');
  assert.ok(h.state().pending.sentence, 'failed sentence must survive for retry');
  await h.run({ allowPublic: false });
  assert.equal(h.state().pending.book, undefined);
  assert.equal(h.state().pending.sentence, undefined);
  assert.deepEqual(h.added.map((x) => x.text), ['재시도 문장']);
}

console.log('✅ UGC guest synchronization behavior passed');
