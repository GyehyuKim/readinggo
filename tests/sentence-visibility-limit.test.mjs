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
const sandbox = { window: { INITIAL_STATE: {}, WISHLIST: [], localStorage }, localStorage, console, Date, Math, JSON, String, Number, Array, Object, Set, Map };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const ds = sandbox.window.DataStore;
const ub = ds.myBooks.add({ book: { id: 'book-1', title: '테스트 책' }, status: 'reading' });
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '가'.repeat(200), visibility: 'public' }).text.length, 200);
assert.throws(() => ds.sentences.add({ userBookId: ub.id, text: '가'.repeat(201), visibility: 'public' }), /sentence_public_text_too_long/);
const private1000 = ds.sentences.add({ userBookId: ub.id, text: `  ${'가'.repeat(1000)}  `, visibility: 'private' });
assert.equal(private1000.text.length, 1000, '공백 제거 후 private 1000자 저장');
assert.throws(() => ds.sentences.add({ userBookId: ub.id, text: '가'.repeat(1001), visibility: 'private' }), /sentence_text_too_long/);
assert.throws(() => ds.sentences.setVisibility(private1000.id, { visibility: 'followers' }), /sentence_public_text_too_long/, 'visibility 변경 우회 차단');
assert.throws(() => ds.sentences.updateText(private1000.id, '가'.repeat(1001)), /sentence_text_too_long/, '본문 편집 우회 차단');

const supabaseSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore-supabase.js'), 'utf8');
assert.match(supabaseSource, /validateSentenceText\(text, sentenceVisibility\)/, 'Supabase insert 사전 검증');
assert.match(supabaseSource, /select\('visibility'\)[\s\S]+validateSentenceText\(text, current && current\.visibility\)/, 'Supabase 본문 편집 사전 검증');
assert.match(supabaseSource, /select\('text'\)[\s\S]+validateSentenceText\(current && current\.text, patch\.visibility\)/, 'Supabase visibility 변경 사전 검증');

const migration = fs.readFileSync(path.join(root, 'docs/readinggo/supabase/51_sentence_visibility_length.sql'), 'utf8');
assert.match(migration, /char_length\(btrim\(text\)\) between 1 and[\s\S]+case when coalesce\(visibility, 'public'\) = 'private' then 1000 else 200 end/i);
assert.match(migration, /not valid/i, 'forward-only 신규/변경 쓰기 강제 migration');

console.log('sentence visibility limits: ok');
