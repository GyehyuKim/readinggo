import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { selectBookTree } from '../docs/readinggo/js/book-tree-selector.js';

const Fragment = Symbol('Fragment');
globalThis.window = {};
globalThis.React = {
  Fragment,
  createElement(type, props, ...children) {
    return { type, props: { ...(props || {}), children } };
  },
  useEffect() {},
  useState(initial) { return [initial, () => {}]; },
};

const {
  BOOK_TREE_PAGE_SIZE,
  BookTreeHomeContent,
  activateBookTreeBranch,
  bookTreePage,
} = await import('../docs/readinggo/js/book-tree-home-ui.js');

function userBook(id, status = 'reading', overrides = {}) {
  return {
    id,
    book_id: `book-${id}`,
    book: { id: `book-${id}`, title: `책 ${id}`, author: `저자 ${id}`, total_pages: 240 },
    status,
    current_page: 33,
    started_at: '2026-08-22T00:00:00Z',
    ...overrides,
  };
}

function sentence(id, userBookId, overrides = {}) {
  return {
    id,
    user_book_id: userBookId,
    text: `PRIVATE-SENTENCE-${id}`,
    my_note: `PRIVATE-NOTE-${id}`,
    visibility: 'private',
    created_at: '2026-08-22T01:00:00Z',
    ...overrides,
  };
}

const noop = () => {};
function props(tree, overrides = {}) {
  return {
    tree,
    onQuery: noop,
    onStatus: noop,
    onPage: noop,
    onSelect: noop,
    onActivate: noop,
    onAddBook: noop,
    onOpenBook: noop,
    ...overrides,
  };
}

function resolve(node) {
  if (node == null || node === false || node === true || typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map(resolve);
  if (node.type === Fragment) return resolve(node.props.children);
  if (typeof node.type === 'function') return resolve(node.type(node.props));
  return { ...node, props: { ...node.props, children: resolve(node.props.children) } };
}

function flatten(node, rows = []) {
  if (node == null || typeof node !== 'object') return rows;
  if (Array.isArray(node)) {
    node.forEach((child) => flatten(child, rows));
    return rows;
  }
  rows.push(node);
  flatten(node.props?.children, rows);
  return rows;
}

function text(node) {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return text(node.props?.children);
}

function render(tree, overrides = {}) {
  const resolved = resolve(BookTreeHomeContent(props(tree, overrides)));
  return { resolved, nodes: flatten(resolved), copy: text(resolved) };
}

test('empty tree renders one-tree summary and a usable book-search action', () => {
  const tree = selectBookTree();
  let opened = 0;
  const view = render(tree, { onAddBook: () => { opened += 1; } });

  assert.match(view.copy, /책 0권, 문장 0개/);
  assert.match(view.copy, /아직 등록한 책이 없어요/);
  const action = view.nodes.find((node) => node.type === 'button' && text(node) === '책 찾아보기');
  assert.ok(action, '빈 상태에 44px 이상 책 검색 버튼이 있어야 한다');
  assert.equal(action.props.style.minHeight, 44);
  action.props.onClick();
  assert.equal(opened, 1);
});

test('render exposes every status and exact owned private leaf counts without private content', () => {
  const tree = selectBookTree({
    userBooks: [userBook('reading'), userBook('completed', 'completed'), userBook('aborted', 'aborted')],
    sentences: [sentence('one', 'reading'), sentence('two', 'reading'), sentence('done', 'completed')],
    selectedUserBookId: 'reading',
  });
  const view = render(tree, { activeId: 'reading', selectedId: 'reading' });

  assert.match(view.copy, /책 3권, 문장 3개/);
  assert.match(view.copy, /읽는 중/);
  assert.match(view.copy, /완독/);
  assert.match(view.copy, /쉬어가는 중/);
  assert.match(view.copy, /문장 2개/);
  assert.equal(view.copy.includes('PRIVATE-SENTENCE'), false);
  assert.equal(view.copy.includes('PRIVATE-NOTE'), false);
  const options = view.nodes.filter((node) => node.props?.role === 'option');
  assert.equal(options.length, 3);
  assert.equal(options.every((node) => node.props.style.minHeight >= 44), true);
  assert.equal(options.find((node) => node.props['aria-selected'])?.props['aria-label'].includes('활성 책'), true);
});

test('branch selection is accessible and active reading selection preserves DataStore.activeBook.set', async () => {
  const tree = selectBookTree({
    userBooks: [userBook('read'), userBook('done', 'completed')],
    selectedUserBookId: 'read',
  });
  let selected = null;
  const view = render(tree, { onSelect: (id) => { selected = id; } });
  const completedOption = view.nodes.find((node) => node.props?.role === 'option' && node.props['aria-label'].includes('책 done'));
  completedOption.props.onClick();
  assert.equal(selected, 'done', '책 행 클릭은 선택 상세를 바꿔야 한다');

  const writes = [];
  let rerendered = null;
  const dataStore = { activeBook: { set: async (id) => { writes.push(id); } } };
  const reading = tree.branches.find((branch) => branch.id === 'read');
  const completed = tree.branches.find((branch) => branch.id === 'done');
  assert.equal(await activateBookTreeBranch({ dataStore, branch: reading, onActiveBookChange: (branch) => { rerendered = branch.id; } }), true);
  assert.deepEqual(writes, ['read']);
  assert.equal(rerendered, 'read');
  assert.equal(await activateBookTreeBranch({ dataStore, branch: completed }), false);
  assert.deepEqual(writes, ['read'], '완독 가지 상세 선택은 기존 reading 활성 책 계약을 바꾸지 않는다');
});

test('large trees use bounded paged branch DOM and aggregate leaves instead of one node per leaf', () => {
  const books = Array.from({ length: 2_005 }, (_, index) => userBook(String(index).padStart(4, '0')));
  const sentences = books.flatMap((book) => Array.from({ length: 10 }, (_, index) => sentence(`${book.id}-${index}`, book.id)));
  const tree = selectBookTree({ userBooks: books, sentences });
  const firstPage = bookTreePage(tree.branches, '', 'all', 0);
  const lastPage = bookTreePage(tree.branches, '', 'all', 9999);
  const view = render(tree);

  assert.equal(tree.leafCount, 20_050);
  assert.equal(firstPage.branches.length, BOOK_TREE_PAGE_SIZE);
  assert.equal(lastPage.currentPage, lastPage.pageCount - 1);
  assert.equal(view.nodes.filter((node) => node.props?.role === 'option').length, BOOK_TREE_PAGE_SIZE);
  assert.match(view.copy, /1 \/ 101/);
  assert.equal(view.copy.includes('PRIVATE-SENTENCE'), false);
});

test('Phase 2 UI source has no XP, decay, analytics, raw sentence, or write payload', () => {
  const source = fs.readFileSync(new URL('../docs/readinggo/js/book-tree-home-ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bXP\b|decay|crack|rgTrack|analytics/i);
  assert.doesNotMatch(source, /sentence\.text|my_note|sentences\.add|sentences\.remove/);
  assert.match(source, /RG_bookTree\.fromDataStore/);
  assert.match(source, /activeBook\.set/);
});
