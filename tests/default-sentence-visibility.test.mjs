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
assert.equal(ds.settings.get().default_sentence_visibility, 'public', '설정 키가 없으면 기존 호환상 public');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '기본 문장' }).visibility, 'public');

ds.settings.update({ default_sentence_visibility: 'private' });
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '새 기본값' }).visibility, 'private');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '문장별 재정의 무시', visibility: 'followers' }).visibility, 'private');

ds.settings.update({ default_sentence_visibility: 'followers' });
assert.equal(ds.settings.get().default_sentence_visibility, 'followers', 'followers 설정 round-trip');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '팔로워 기본값', visibility: 'private' }).visibility, 'followers');

ds.settings.update({ default_sentence_visibility: 'friends' });
assert.equal(ds.settings.get().default_sentence_visibility, 'followers', '레거시 friends는 followers로 축소 호환');

ds.settings.update({ default_sentence_visibility: 'unexpected' });
assert.equal(ds.settings.get().default_sentence_visibility, 'private', '알 수 없는 설정은 private fail-closed');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: '안전 기본값', visibility: 'public' }).visibility, 'private');
ds.settings.update({ default_sentence_visibility: null });
assert.equal(ds.settings.get().default_sentence_visibility, 'private', '명시적 null 설정은 private fail-closed');
assert.equal(ds.sentences.add({ userBookId: ub.id, text: 'null 안전 기본값', visibility: 'public' }).visibility, 'private');
const importedPrivate = ds.sentences.importExisting({ userBookId: ub.id, text: '기존 비공개', visibility: 'private' });
assert.equal(importedPrivate.visibility, 'private', '기존 게스트 private 이관은 계정 기본값과 무관하게 보존');
const unknownChanged = ds.sentences.setVisibility(importedPrivate.id, { visibility: 'unexpected' });
assert.equal(unknownChanged.visibility, 'private', '사후 unknown 공개범위도 private fail-closed');
const nullChanged = ds.sentences.setVisibility(importedPrivate.id, { visibility: null });
assert.equal(nullChanged.visibility, 'private', '사후 명시적 null 공개범위도 private fail-closed');

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
const settingsUi = fs.readFileSync(path.join(root, 'docs/readinggo/js/settings-modal.js'), 'utf8');
assert.match(source, /visibility:\s*_ignoredVisibility[\s\S]+계정\/게스트 기본 공개범위가 신규 문장의 단일 정본/, 'local adapter가 호출부 override 무시');
assert.match(supabase, /visibility:\s*_ignoredVisibility[\s\S]+const settings = await A\.settings\.get\(\)[\s\S]+sentenceVisibility = defaultSentenceVisibility/, 'Supabase adapter가 계정 설정을 단일 정본으로 사용');
assert.match(supabase, /hasOwnProperty\.call\(settings, 'default_sentence_visibility'\)[\s\S]+storedSentenceVisibility\(settings\.default_sentence_visibility\)/, 'Supabase도 키 없음과 명시적 null을 구분');
assert.match(settingsUi, /function normalizeDefaultSentenceVisibility[\s\S]+hasOwnProperty\.call\(settings, 'default_sentence_visibility'\)[\s\S]+: 'private'/, '설정 UI도 null·unknown을 private로 표시');
assert.match(source, /importExisting\([\s\S]+visibility: checked\.visibility/, 'local 이관 API가 기존 privacy 보존');
assert.match(supabase, /async importExisting\([\s\S]+sentenceVisibility = storedSentenceVisibility\(visibility\)/, 'Supabase 이관 API가 기존 privacy 보존');
assert.match(supabase, /async setVisibility[\s\S]+hasOwnProperty\.call\(patch, 'visibility'\)[\s\S]+const checked = validateSentenceText\(current && current\.text, patch\.visibility\)[\s\S]+nextPatch\.visibility = checked\.visibility[\s\S]+update\(nextPatch\)/, 'Supabase 사후 unknown·null 공개범위도 private 정규화값으로 UPDATE');
assert.equal((app.match(/DS\.sentences\.importExisting\(/g) || []).length, 2, '게스트 일반·pending 이관은 전용 API 사용');
assert.doesNotMatch(settingsUi, /value:\s*'friends'/, '설정 UI는 friends alias를 새로 저장하지 않음');
assert.ok((settingsUi.match(/value:\s*'followers'/g) || []).length >= 2, '설정 modal·view 모두 followers canonical 값 사용');

console.log('default sentence visibility: ok');
