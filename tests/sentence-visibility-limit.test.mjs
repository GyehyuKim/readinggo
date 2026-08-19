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
const scopes = ['public', 'followers', 'private'];
for (const visibility of scopes) {
  for (const length of [200, 201, 1000]) {
    const row = ds.sentences.add({ userBookId: ub.id, text: `  ${'가'.repeat(length)}  `, visibility });
    assert.equal(Array.from(row.text).length, length, `${visibility} ${length}자 저장`);
    assert.equal(row.visibility, visibility, `${visibility} 공개범위 보존`);
  }
  const error = visibility === 'private' ? /sentence_text_too_long/ : /sentence_public_text_too_long/;
  assert.throws(() => ds.sentences.add({ userBookId: ub.id, text: '가'.repeat(1001), visibility }), error, `${visibility} 1001자 거부`);
  assert.equal(Array.from(ds.sentences.add({ userBookId: ub.id, text: '😀'.repeat(1000), visibility }).text).length, 1000, `${visibility} 이모지 1000자 저장`);
  assert.throws(() => ds.sentences.add({ userBookId: ub.id, text: '😀'.repeat(1001), visibility }), error, `${visibility} 이모지 1001자 거부`);
}
const private1000 = ds.sentences.add({ userBookId: ub.id, text: '가'.repeat(1000), visibility: 'private' });
assert.equal(ds.sentences.setVisibility(private1000.id, { visibility: 'followers' }).visibility, 'followers', '1000자 공개범위 변경 허용');
assert.throws(() => ds.sentences.updateText(private1000.id, '가'.repeat(1001)), /sentence_public_text_too_long/, '본문 편집 우회 차단');

const supabaseSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore-supabase.js'), 'utf8');
assert.match(supabaseSource, /validateSentenceText\(text, sentenceVisibility\)/, 'Supabase insert 사전 검증');
assert.match(supabaseSource, /select\('visibility'\)[\s\S]+validateSentenceText\(text, current && current\.visibility\)/, 'Supabase 본문 편집 사전 검증');
assert.match(supabaseSource, /select\('text'\)[\s\S]+validateSentenceText\(current && current\.text, patch\.visibility\)/, 'Supabase visibility 변경 사전 검증');

const migration = fs.readFileSync(path.join(root, 'docs/readinggo/supabase/53_sentence_length_1000_all_visibility.sql'), 'utf8');
assert.match(migration, /drop constraint if exists sentences_text_len/i, '기존 visibility별 제약 교체');
assert.match(migration, /char_length\(btrim\(text\)\) between 1 and 1000/i);
assert.match(migration, /not valid/i, 'forward-only 신규/변경 쓰기 강제 migration');
assert.match(migration, /rollback[\s\S]+case when coalesce\(visibility, 'public'\) = 'private' then 1000 else 200 end/i, '이전 공개범위별 제약 rollback 절차');
const schema = fs.readFileSync(path.join(root, 'docs/readinggo/supabase/schema.sql'), 'utf8');
assert.match(schema, /constraint sentences_text_len check \(char_length\(btrim\(text\)\) between 1 and 1000\)/i, 'canonical schema 동기화');

const config = fs.readFileSync(path.join(root, 'docs/readinggo/js/config.js'), 'utf8');
const batchImport = fs.readFileSync(path.join(root, 'docs/readinggo/js/batch-quote-import.js'), 'utf8');
const dataImport = fs.readFileSync(path.join(root, 'docs/readinggo/js/data-import.js'), 'utf8');
const bookDetail = fs.readFileSync(path.join(root, 'docs/readinggo/js/book-detail-modal.js'), 'utf8');
const nest = fs.readFileSync(path.join(root, 'docs/readinggo/js/nest.js'), 'utf8');
const companion = fs.readFileSync(path.join(root, 'docs/readinggo/js/companion.js'), 'utf8');
const sentenceCard = fs.readFileSync(path.join(root, 'docs/readinggo/js/sentence-card.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'docs/readinggo/js/app.js'), 'utf8');
assert.match(config, /sentence:[\s\S]+Array\.from\(s\)\.length > 1000 \? \{ ok: false, value: s,/, '공통 validator는 Unicode 문자 수를 쓰고 원문을 절단하지 않는다');
assert.doesNotMatch(config, /sentence:[\s\S]{0,240}slice\(0, 1000\)/, '문장 validator silent truncation 금지');
assert.match(batchImport, /const _bqiLength = \(value\) => Array\.from/);
assert.match(batchImport, /RG_saveSentenceBatch = saveSentenceBatch[\s\S]+retainFailedBatchItems\(valid, failed\)/, 'batch 부분 실패는 실행 검증된 helper로 실패 초안만 남긴다');
assert.match(dataImport, /RG_saveSentenceBatch\(list[\s\S]+result\.failedIndices\.length[\s\S]+else \{ showToast\(`\$\{result\.saved\}개를 가져왔어요`\); onClose\(\); \}/, '외부 import는 공용 helper를 사용하고 전부 성공한 경우에만 닫는다');
assert.match(bookDetail, /RG_saveSentenceBatch\(list[\s\S]+return result/, '책 상세 batch는 공용 helper의 부분 실패 결과를 반환한다');
assert.doesNotMatch(bookDetail, /r\.saved \|\| quotes\.length/, '0건 저장을 전체 성공으로 오인하지 않는다');
assert.match(bookDetail, /onChange=\{e => setAddText\(e\.target\.value\)\}/, '책 상세 직접 입력은 1001자 원문도 state에 보존');
assert.match(nest, /onChange=\{\(e\) => setDraft\(0, \{ text: e\.target\.value \}\)\}/, '홈 직접 입력은 1001자 원문도 초안에 보존');
assert.match(nest, /_retainUnsavedDrafts\(prev, saved\)/, '홈 부분 실패는 실행 검증된 helper로 성공 초안만 제거한다');
assert.match(app, /RG_saveSentenceBatch\(batch[\s\S]+result\.failedIndices\.length[\s\S]+throw error[\s\S]+completion\.onSuccess/, '홈 batch 실패는 공용 helper를 거쳐 성공 콜백 전에 reject한다');
assert.match(companion, /const saveText = async \(\) =>[\s\S]+Array\.from\(v\)\.length > 1000[\s\S]+await Promise\.resolve/, '기존 문장 편집은 Unicode 검증 후 저장 성공에만 반영');
assert.match(sentenceCard, /Array\.from\(text\)\.length > 1000[\s\S]+aria-invalid=\{Array\.from\(dText\.trim\(\)\)\.length > 1000\}/, '공용 인라인 편집도 Unicode 카운터와 명시 오류를 쓴다');

console.log('sentence visibility limits: ok');
