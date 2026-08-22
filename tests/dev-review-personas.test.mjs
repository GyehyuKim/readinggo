import assert from 'node:assert/strict';

const session = new Map();
const storage = new Map();
const server = new Map();
let activeKey = null;
let activeSeed = null;
let writeHook = null;
let dirty = false;
const versions = new Map();
const revisions = new Map();

const clone = value => JSON.parse(JSON.stringify(value));
const INSTANCE = '0123456789abcdef0123456789abcdef';
const local = {
  configure({ storageKey, initialState }) {
    activeKey = storageKey;
    activeSeed = clone(initialState);
    writeHook = null;
    if (!storage.has(storageKey)) storage.set(storageKey, clone(initialState));
    return storage.get(storageKey);
  },
  reset() {
    const state = clone(activeSeed);
    storage.set(activeKey, state);
    versions.set(activeKey, (versions.get(activeKey) || 0) + 1);
    dirty = true;
    if (writeHook) writeHook(clone(state), versions.get(activeKey));
    return state;
  },
  read: () => storage.get(activeKey),
  replace(state) { storage.set(activeKey, clone(state)); versions.set(activeKey, (versions.get(activeKey) || 0) + 1); return storage.get(activeKey); },
  setWriteHook(hook) { writeHook = hook; },
  isDirty: () => dirty,
  markDirty() { dirty = true; },
  clearDirty() { dirty = false; },
  clientId: () => INSTANCE,
  version: () => versions.get(activeKey) || 0,
  getRevision: () => revisions.get(activeKey) ?? null,
  setRevision(value) { revisions.set(activeKey, value); },
  clearRevision() { revisions.delete(activeKey); },
};

globalThis.sessionStorage = {
  getItem: key => session.get(key) ?? null,
  setItem: (key, value) => session.set(key, String(value)),
  removeItem: key => session.delete(key),
};
globalThis.window = {
  RG_CONFIG: { API_ORIGIN: 'https://readinggo-dev.example' },
  RG_BOOKS: [],
  getBook: id => ({ id, title: `카탈로그 ${id}`, author: '정적 저자', pub: '정적 출판사', total: 300, cover: '', isbn: `isbn-${id}` }),
  LocalDataStore: { local },
  DataStore: null,
  SupabaseDataStore: { profile: { get: () => { throw new Error('Supabase called'); } } },
  RG_SB: { isConfigured: () => true, currentUser: () => { throw new Error('auth called'); } },
};
window.DataStore = window.LocalDataStore;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  assert.equal(url.origin, 'https://readinggo-dev.example');
  assert.equal(url.pathname, '/api/dev-review-personas');
  const id = url.searchParams.get('id');
  assert.equal(url.searchParams.get('instance'), INSTANCE);
  if ((init.method || 'GET') === 'GET') {
    if (!server.has(id)) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    const row = server.get(id);
    return Response.json({ id, state: clone(row.state), revision: row.revision });
  }
  assert.equal(init.method, 'PUT');
  const body = JSON.parse(init.body);
  const current = server.get(id);
  if ((!current && body.expectedRevision !== null) || (current && body.expectedRevision !== current.revision)) {
    return Response.json({ error: 'revision conflict' }, { status: 409 });
  }
  const revision = current ? current.revision + 1 : 1;
  server.set(id, { state: clone(body.state), revision });
  return Response.json({ id, state: clone(body.state), revision });
};

const { devReviewPersonas } = await import('../docs/readinggo/js/dev-review-personas.js');
const personas = devReviewPersonas.list();
assert.equal(personas.length, 3, '합성 페르소나는 정확히 3종이어야 한다');
assert.equal(new Set(personas.map(item => item.id)).size, 3, '페르소나 id는 고유해야 한다');
assert.ok(personas.every(item => item.name.includes('합성')), 'UI에서 합성 데이터임을 명시해야 한다');
assert.deepEqual(personas.map(item => item.handle), ['dev_gyehyu', 'dev_judy', 'dev_jerome']);

const first = await devReviewPersonas.activate(personas[0].id);
assert.equal(first.id, personas[0].id);
assert.equal(activeKey, `rg_dev_review_persona_${personas[0].id}`);
assert.equal(session.get('rg_dev_review_mode'), '1');
assert.equal(window.RG_ME.handle, 'dev_gyehyu');
assert.equal(window.RG_SB.isConfigured(), false, '검수 모드는 실제 auth gateway를 차단해야 한다');
assert.equal(window.SupabaseDataStore, null, '검수 모드는 직접 Supabase adapter 우회도 차단해야 한다');
assert.ok(server.has(personas[0].id), '최초 fixture를 DEV 서버 저장소에 seed해야 한다');

const fixture = storage.get(activeKey);
assert.ok(fixture.user_books.some(book => book.status === 'reading'));
assert.ok(fixture.user_books.some(book => book.status === 'completed'));
assert.ok(fixture.user_books.flatMap(book => book.sessions).length >= 4);
assert.ok(fixture.user_books.flatMap(book => book.sentences).some(row => /Q\.\s/.test(row.my_note || '') && /A\.\s/.test(row.my_note || '')));
assert.ok(fixture.streak.current > 0 && fixture.wish_books.length > 0);
assert.equal(Object.hasOwn(fixture, 'xp'), false, 'Phase 4 fixture에는 XP 상태가 없어야 한다');

fixture.settings.default_sentence_visibility = 'private';
storage.set(activeKey, fixture);
versions.set(activeKey, (versions.get(activeKey) || 0) + 1);
dirty = true;
writeHook(clone(fixture), versions.get(activeKey));
await new Promise(resolve => setTimeout(resolve, 320));
assert.equal(server.get(personas[0].id).state.settings.default_sentence_visibility, 'private', '변경을 DEV 서버 저장소에 동기화해야 한다');

await devReviewPersonas.activate(personas[1].id);
await devReviewPersonas.activate(personas[0].id);
assert.equal(storage.get(activeKey).settings.default_sentence_visibility, 'private', '페르소나별 변경은 전환 뒤에도 유지돼야 한다');
const serverBeforeConflict = server.get(personas[0].id);
server.set(personas[0].id, {
  state: {
    ...clone(serverBeforeConflict.state),
    settings: { ...serverBeforeConflict.state.settings, default_sentence_visibility: 'friends' },
  },
  revision: serverBeforeConflict.revision + 1,
});
const staleLocal = storage.get(activeKey);
staleLocal.settings.default_sentence_visibility = 'public';
versions.set(activeKey, (versions.get(activeKey) || 0) + 1);
dirty = true;
writeHook(clone(staleLocal), versions.get(activeKey));
await new Promise(resolve => setTimeout(resolve, 320));
assert.equal(server.get(personas[0].id).state.settings.default_sentence_visibility, 'friends', 'stale 탭은 최신 서버 revision을 덮어쓰면 안 된다');
assert.equal(dirty, true, 'revision 충돌 상태는 재시도/리셋 전까지 dirty로 남겨야 한다');
await devReviewPersonas.reset();
assert.equal(storage.get(activeKey).settings.default_sentence_visibility, 'public', '리셋은 초기 fixture를 복원해야 한다');
assert.equal(server.get(personas[0].id).state.settings.default_sentence_visibility, 'public', '리셋 상태도 DEV 서버에 저장해야 한다');

const serialized = JSON.stringify([...server.values()].map(row => row.state));
assert.doesNotMatch(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/i, 'fixture에 이메일이 있으면 안 된다');
assert.doesNotMatch(serialized, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i, 'fixture에 UUID가 있으면 안 된다');

await devReviewPersonas.clear();
assert.equal(await devReviewPersonas.restore(), null);
session.set('rg_dev_review_mode', '1');
session.set('rg_dev_review_persona', 'unknown-persona');
assert.equal(await devReviewPersonas.restore(), null, '알 수 없는 페르소나 세션은 fail-closed로 정리해야 한다');
assert.equal(session.has('rg_dev_review_mode'), false);
assert.equal(session.has('rg_dev_review_persona'), false);

console.log('OK: synthetic DEV review personas, server persistence, isolation, and reset');
