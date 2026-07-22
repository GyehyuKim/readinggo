import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const adapterSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore-supabase.js'), 'utf8');
const librarySource = fs.readFileSync(path.join(root, 'docs/readinggo/js/library.js'), 'utf8');
const modalSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/sentence-collection-modal.js'), 'utf8');
const localSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore.js'), 'utf8');

const sentenceId = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000002';
const sanitizedSentence = {
  id: sentenceId,
  user_id: '30000000-0000-4000-8000-000000000003',
  user_book_id: '40000000-0000-4000-8000-000000000004',
  page: 42,
  text: 'sanitized fixture sentence',
  created_at: '2026-07-22T00:00:00Z',
  user_book: { book_id: '50000000-0000-4000-8000-000000000005', book: { title: 'fixture book' } },
};

// RLS 재현: claps 행은 보이지만 owner-only sentences embed는 null이어서 count=1/list=0이 된다.
const legacyRows = [{ sentence_id: sentenceId, sentence: null }];
assert.equal(legacyRows.length, 1, '프로필의 기존 clap 행 카운트');
assert.equal(legacyRows.filter((row) => row.sentence).length, 0, '모달의 기존 렌더 가능 문장 카운트');

let selected = '';
const fixtureRows = [{ sentence_id: sentenceId, sentence: sanitizedSentence }];
const query = {
  select(value) { selected = value; return this; },
  eq() { return this; },
  order() { return Promise.resolve({ data: fixtureRows, error: null }); },
};
const client = {
  auth: { getSession: async () => ({ data: { session: { user: { id: userId } } } }) },
  from(table) { assert.equal(table, 'claps'); return query; },
};
const sandbox = {
  window: {
    RG_SB: { client: () => client, onAuthChange() {} },
    dispatchEvent() {},
    CustomEvent: class CustomEvent {},
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  console, Date, Math, JSON, String, Number, Array, Object, Set, Map, Promise, Uint8Array,
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(adapterSource, sandbox);

const rows = await sandbox.window.SupabaseDataStore.claps.list();
assert.match(selected, /sentence:sentences_public\(/, '좋아요 목록은 공개 문장 뷰를 embed해야 한다');
assert.equal(rows.length, 1);
assert.equal(rows[0].sentence.text, sanitizedSentence.text, '타인 문장이 RLS-safe view에서 목록까지 전달된다');
assert.equal(rows.filter((row) => row.sentence).length, rows.length, '프로필 count와 모달 렌더 수가 일치한다');

for (const [source, label] of [[adapterSource, 'Supabase'], [localSource, 'localStorage']]) {
  assert.match(source, /rg:clap-changed/, `${label} toggle은 공통 갱신 이벤트를 보낸다`);
}
assert.match(librarySource, /addEventListener\('rg:clap-changed', loadSavedCount\)/, '프로필 count가 토글 후 다시 로드된다');
assert.match(modalSource, /addEventListener\('rg:clap-changed', onClapChanged\)/, '열린 모달의 좋아요 집합이 토글 후 갱신된다');
assert.match(modalSource, /if \(detail\.liked\) next\.add\(detail\.sentenceId\);\s*else next\.delete\(detail\.sentenceId\);/, 'like/unlike 양쪽을 반영한다');

console.log('✓ liked sentence count/list/update consistency regression');
