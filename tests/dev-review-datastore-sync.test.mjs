import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key),
};
globalThis.window = {
  INITIAL_STATE: { book: null, streak: 0, xp: 0, myQuotes: [] },
  getBook: id => ({ id, title: id }),
};

await import(`../docs/readinggo/js/datastore.js?sync-test=${Date.now()}`);
const adapter = window.LocalDataStore;
const fixture = {
  user_books: [], active_user_book_id: null,
  streak: { current: 1, longest: 1 }, xp: 10,
  claps: {}, bookmarks: {}, wish_books: [],
  settings: { default_sentence_visibility: 'public' }, pending: {},
};
adapter.local.configure({ storageKey: 'rg_dev_review_persona_sync-test', initialState: fixture });
let writes = 0;
let lastVersion = 0;
adapter.local.setWriteHook((_state, version) => { writes += 1; lastVersion = version; });

const beforeVersion = adapter.local.version();
assert.equal(adapter.settings.get().default_sentence_visibility, 'public');
assert.equal(adapter.xp.get(), 10);
assert.equal(writes, 0, '순수 조회는 write hook을 호출하면 안 된다');
assert.equal(adapter.local.isDirty(), false, '순수 조회는 dirty를 만들면 안 된다');
assert.equal(adapter.local.version(), beforeVersion, '순수 조회는 local version을 올리면 안 된다');

adapter.settings.update({ compact: true });
assert.equal(writes, 1, '실제 변경은 한 번만 동기화 예약해야 한다');
assert.equal(adapter.local.isDirty(), true);
assert.equal(lastVersion, adapter.local.version());
adapter.local.setRevision(3);
assert.equal(adapter.local.getRevision(), 3);
adapter.local.clearRevision();
assert.equal(adapter.local.getRevision(), null);

console.log('OK: DEV local DataStore reads stay clean and writes carry versions');
