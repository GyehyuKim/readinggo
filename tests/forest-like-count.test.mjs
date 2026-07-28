import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const adapterSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore-supabase.js'), 'utf8');
const roomSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/co-reading.js'), 'utf8');
const cardSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/sentence-card.js'), 'utf8');

const bookId = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000002';
const rows = [
  { id: 'a', clap_count: [{ count: '3' }] },
  { id: 'b', clap_count: [{ count: null }] },
  { id: 'c' },
  { id: 'd', clap_count: [{ count: 'not-a-number' }] },
];

const query = {
  select() { return this; },
  eq() { return this; },
  order() { return this; },
  limit() { return this; },
  neq() { return Promise.resolve({ data: rows, error: null }); },
};
const client = {
  auth: { getSession: async () => ({ data: { session: { user: { id: userId } } } }) },
  from(table) {
    assert.equal(table, 'sentences_public');
    return query;
  },
};
const sandbox = {
  window: { RG_SB: { client: () => client, onAuthChange() {} } },
  console, Date, Math, JSON, String, Number, Array, Object, Set, Map, Promise, Uint8Array,
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(adapterSource, sandbox);

const normalized = await sandbox.window.SupabaseDataStore.sentences.byBook(bookId, { limit: 50, sort: 'likes' });
assert.deepEqual(
  normalized.map((row) => row.clapCount),
  [3, 0, 0, 0],
  'byBook은 문자열·null·누락·비숫자 좋아요 수를 유한한 숫자로 정규화한다',
);
assert.match(roomSource, /claps:\s*s\.clapCount\b/, '숲 한 문장 피드는 정규화된 clapCount만 소비한다');
assert.match(cardSource, /Number\.isFinite\(rawLikeCount\)\s*\?\s*rawLikeCount\s*:\s*0/, '공용 카드는 비정상 입력을 0으로 방어한다');
assert.match(cardSource, /likeCount\s*>\s*0\s*\?\s*`좋아요 \$\{likeCount\}`\s*:\s*'좋아요'/, '0은 숫자를 숨기고 유효한 양수만 표시한다');

console.log('✓ forest sentence like-count normalization regression');
