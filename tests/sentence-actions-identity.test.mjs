// 새 한 문장 identity 및 홈 액션 즉시 노출 회귀 테스트 (#1338)
//
// 실행: node tests/sentence-actions-identity.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datastoreSrc = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore.js'), 'utf8');
const nestSrc = fs.readFileSync(path.join(root, 'docs/readinggo/js/nest.js'), 'utf8');
const actionsSrc = fs.readFileSync(path.join(root, 'docs/readinggo/js/sentence-card.js'), 'utf8');
const supabaseSrc = fs.readFileSync(path.join(root, 'docs/readinggo/js/datastore-supabase.js'), 'utf8');

function bootLocal(initialStore = null) {
  let store = initialStore;
  const sandbox = {
    window: { INITIAL_STATE: { book: null, streak: 0, xp: 0, myQuotes: [] } },
    console,
    localStorage: {
      getItem: key => key === 'rg_v41' ? store : null,
      setItem: (key, value) => { if (key === 'rg_v41') store = value; },
      removeItem: () => {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(datastoreSrc, sandbox);
  return { DataStore: sandbox.window.DataStore, saved: () => store };
}

const fixture = JSON.stringify({
  user_books: [{
    id: 'ub-1338',
    book_id: 'book-1338',
    book: { id: 'book-1338', title: '테스트 책' },
    current_page: 42,
    status: 'reading',
    sentences: [],
  }],
  active_user_book_id: 'ub-1338',
  settings: { default_sentence_visibility: 'private' },
  streak: { current: 0, longest: 0 },
  xp: 0,
  claps: {},
  bookmarks: {},
  wish_books: [],
  pending: {},
});

// 게스트 저장은 반환 순간부터 영속 identity를 제공하고, 리로드 뒤에도 같은 id를 유지한다.
const first = bootLocal(fixture);
const created = first.DataStore.sentences.add({
  userBookId: 'ub-1338',
  page: 42,
  text: '저장 직후 액션이 보여야 한다.',
});
assert.match(created.id, /^se_[a-z0-9]+$/);
assert.equal(created.user_book_id, 'ub-1338');
assert.equal(created.visibility, 'private');

const reloaded = bootLocal(first.saved());
const rows = reloaded.DataStore.sentences.listMine();
assert.equal(rows.length, 1);
assert.equal(rows[0].id, created.id, '리로드 후에도 생성 시 반환한 identity를 유지해야 한다');

// 홈은 id 없는 낙관 행에 권한을 부여하지 않고, app의 권위 행 교체만 받아 액션을 연다.
assert.match(actionsSrc, /if \(!id\) return null;/, '안정 id 없는 행의 액션 가드를 유지해야 한다');
assert.match(
  nestSrc,
  /setNestState\(\(ns\) => \(\{ \.\.\.ns, myQuotes: state\.myQuotes \}\)\);\s*\}, \[state\.myQuotes\]\);/,
  '영속 완료 후 id 포함 부모 문장 목록을 홈에 동기화해야 한다',
);
assert.match(
  supabaseSrc,
  /\.insert\(\{[\s\S]*?\}\)\.select\(\)\.single\(\)/,
  '로그인 저장도 DB가 확정한 행(identity 포함)을 반환해야 한다',
);

console.log('OK: 새 한 문장은 안정 identity를 받은 뒤 즉시 액션이 열리고 리로드에도 유지된다');
