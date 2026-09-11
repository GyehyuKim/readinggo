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
assert.equal(ub.visibility, 'private', '신규 책은 private');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '기본 문장' }).visibility, 'private');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '새 기본값' }).visibility, 'private');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '문장별 재정의 무시', visibility: 'followers' }).visibility, 'private');
const importedPrivate = ds.sentences.importExisting({ userBookId: ub.id, text: '기존 비공개', visibility: 'private' });
assert.equal(importedPrivate.visibility, 'private', '기존 게스트 private 이관은 계정 기본값과 무관하게 보존');
assert.equal(ds.sentences.setVisibility, undefined, '문장별 공개 setter는 제거');
ds.myBooks.setVisibility(ub.id, 'public', { requestId: 'publish', expectedRevision: 0 });
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '부모 공개 상속', visibility: 'private' }).visibility, 'public');

ds.drafts.save('book-1', [{ text: '열린 초안', visibility: 'public' }]);
assert.deepEqual(JSON.parse(JSON.stringify(ds.drafts.load('book-1'))), [{ text: '열린 초안', visibility: 'public' }], '레거시 초안 원본은 보존');

const surfaces = Object.fromEntries(['home.js', 'batch-quote-import.js', 'book-detail-modal.js', 'data-import.js']
  .map((file) => [file, fs.readFileSync(path.join(root, 'docs/readinggo/js', file), 'utf8')]));
for (const [file, text] of Object.entries(surfaces)) {
  assert.doesNotMatch(text, /<SentenceVisibilitySelect\b/, `${file}: 신규 문장별 공개범위 selector 제거`);
}
assert.doesNotMatch(surfaces['batch-quote-import.js'], /visibility\s*:/, 'batch 초안은 공개범위를 보관하지 않음');
assert.doesNotMatch(surfaces['data-import.js'], /sentences\.add\(\{[^}]*visibility\s*:/, '외부 가져오기는 문장별 override를 전달하지 않음');
assert.doesNotMatch(surfaces['book-detail-modal.js'], /sentences\.add\(\{[^}]*visibility\s*:/, '책 상세 신규 추가는 문장별 override를 전달하지 않음');

const supabase = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore-supabase.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'docs/readinggo/js/app.js'), 'utf8');
assert.match(source, /visibility:\s*'private',\s*visibility_revision:\s*0/, 'local 신규 책 기본은 private');
assert.match(supabase, /visibility:\s*'private',\s*visibility_revision:\s*0/, 'Supabase 신규 책 기본은 private');
assert.match(source, /importExisting\([\s\S]+visibility: checked\.visibility/, 'local 이관 API가 기존 privacy 보존');
assert.match(supabase, /sentence_import_private/, 'Supabase 이관 API는 private 전용 RPC 사용');
assert.doesNotMatch(supabase, /sentences:\s*\{[\s\S]*?async setVisibility\(/, 'Supabase 문장별 setter 제거');
assert.equal((app.match(/DS\.sentences\.importExisting\(/g) || []).length, 2, '게스트 일반·pending 이관은 전용 API 사용');

console.log('default sentence visibility: ok');
