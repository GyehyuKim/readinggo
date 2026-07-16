import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore.js'), 'utf8');
const storage = new Map();
const localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
const sandbox = {
  window: { INITIAL_STATE: {}, WISHLIST: [], localStorage }, localStorage,
  console, Date, Math, JSON, String, Number, Array, Object, Set, Map,
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const ds = sandbox.window.DataStore;

const ub = ds.myBooks.add({ book: { id: 'book-1', title: '테스트 책' }, status: 'reading' });
assert.equal(ds.settings.get().default_sentence_visibility, 'public', '설정 키가 없으면 public');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '기본 문장' }).visibility, 'public');

ds.settings.update({ default_sentence_visibility: 'private' });
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '새 기본값' }).visibility, 'private');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '문장별 재정의', visibility: 'followers' }).visibility, 'followers');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '공개 재정의', visibility: 'public' }).visibility, 'public');

ds.drafts.save('book-1', [{ text: '열린 초안', visibility: 'private' }]);
ds.settings.update({ default_sentence_visibility: 'public' });
assert.deepEqual(JSON.parse(JSON.stringify(ds.drafts.load('book-1'))), [{ text: '열린 초안', visibility: 'private' }], '열린 초안은 설정 변경과 무관');

for (const file of ['app.js', 'book-detail-modal.js', 'data-import.js']) {
  const text = fs.readFileSync(path.join(root, 'docs/readinggo/js', file), 'utf8');
  const calls = text.match(/(?:DataStore|DS)\.sentences\.add\(\{[^}]+\}\)/g) || [];
  assert.ok(calls.length > 0, `${file}: sentences.add 호출 존재`);
  assert.ok(calls.every((call) => /visibility\s*:|\bvisibility\b/.test(call)), `${file}: 모든 sentences.add 호출이 visibility 전달`);
}

console.log('default sentence visibility: ok');
