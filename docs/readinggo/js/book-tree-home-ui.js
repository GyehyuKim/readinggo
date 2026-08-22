// Book-tree Phase 2 primary UI (#1453).
// Uses only the read-only projection; sentence text and legacy growth state never enter this view.
const { useEffect: useBookTreeEffect, useState: useBookTreeState } = React;

const BOOK_TREE_PAGE_SIZE = 20;
const BOOK_TREE_STATUS = Object.freeze({
  reading: '읽는 중',
  completed: '완독',
  aborted: '쉬어가는 중',
});

const h = React.createElement;

function bookTreeStatusLabel(status) {
  return BOOK_TREE_STATUS[status] || '상태 없음';
}

function bookTreeMatches(branch, query, status) {
  if (status !== 'all' && branch.status !== status) return false;
  const normalized = String(query || '').trim().toLocaleLowerCase('ko-KR');
  if (!normalized) return true;
  return `${branch.book.title} ${branch.book.author}`.toLocaleLowerCase('ko-KR').includes(normalized);
}

function bookTreePage(branches, query, status, page) {
  const filtered = (branches || []).filter((branch) => bookTreeMatches(branch, query, status));
  const pageCount = Math.max(1, Math.ceil(filtered.length / BOOK_TREE_PAGE_SIZE));
  const currentPage = Math.min(Math.max(0, page), pageCount - 1);
  return Object.freeze({
    branches: filtered.slice(currentPage * BOOK_TREE_PAGE_SIZE, (currentPage + 1) * BOOK_TREE_PAGE_SIZE),
    currentPage,
    pageCount,
    total: filtered.length,
  });
}

async function activateBookTreeBranch({ dataStore, branch, onActiveBookChange }) {
  if (!branch || branch.status !== 'reading') return false;
  if (!dataStore?.activeBook?.set) throw new TypeError('active branch selection requires DataStore.activeBook.set');
  await Promise.resolve(dataStore.activeBook.set(branch.id));
  if (onActiveBookChange) onActiveBookChange(branch);
  return true;
}

function TreeOverview({ tree }) {
  return h('section', {
    'aria-labelledby': 'book-tree-heading',
    style: {
      background: 'var(--brand-tint)', border: '1px solid var(--brand-soft)',
      borderRadius: 'var(--r-lg)', padding: 20, textAlign: 'center',
    },
  },
  h('div', {
    'aria-hidden': 'true',
    style: { height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  }, h('svg', { width: 152, height: 108, viewBox: '0 0 152 108', fill: 'none' },
    h('path', { d: 'M76 101V55M76 70L48 45M76 63l29-27M76 82l-38-8M76 78l40 4', stroke: 'var(--brand-3)', strokeWidth: 7, strokeLinecap: 'round' }),
    h('circle', { cx: 48, cy: 36, r: 25, fill: 'var(--brand-soft)' }),
    h('circle', { cx: 78, cy: 27, r: 29, fill: 'var(--brand-soft)' }),
    h('circle', { cx: 108, cy: 40, r: 24, fill: 'var(--brand-soft)' }),
    h('circle', { cx: 36, cy: 68, r: 20, fill: 'var(--brand-soft)' }),
    h('circle', { cx: 116, cy: 73, r: 22, fill: 'var(--brand-soft)' }),
  )),
  h('h1', { id: 'book-tree-heading', style: { margin: '2px 0 4px', color: 'var(--ink)', fontSize: 22, fontWeight: 900 } }, '내 책과 문장'),
  h('p', { role: 'status', 'aria-live': 'polite', style: { margin: 0, color: 'var(--ink-2)', fontSize: 14, fontWeight: 800 } }, tree.accessibilitySummary),
  h('p', { style: { margin: '8px 0 0', color: 'var(--ink-3)', fontSize: 12.5, lineHeight: 1.55 } }, '책마다 남긴 문장 수를 한눈에 살펴보세요.'),
  );
}

function BranchRow({ branch, selected, active, onSelect }) {
  const status = bookTreeStatusLabel(branch.status);
  return h('button', {
    type: 'button',
    role: 'option',
    'aria-selected': selected,
    'aria-label': `${branch.book.title || '제목 없는 책'}, ${status}, 문장 ${branch.leafCount}개${active ? ', 활성 책' : ''}`,
    onClick: () => onSelect(branch.id),
    style: {
      width: '100%', minHeight: 64, padding: '10px 12px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
      background: selected ? 'var(--brand-soft)' : 'var(--card)',
      border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--line)'}`,
      borderRadius: 'var(--r-md)', color: 'var(--ink)', fontFamily: 'inherit',
    },
  },
  h('span', { 'aria-hidden': 'true', style: { width: 38, height: 48, flexShrink: 0, borderRadius: 'var(--r-sm)', background: 'var(--paper-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--brand-3)' } }, window.rgIcon ? window.rgIcon('book', 22) : null),
  h('span', { style: { flex: 1, minWidth: 0 } },
    h('span', { style: { display: 'block', fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, branch.book.title || '제목 없는 책'),
    h('span', { style: { display: 'block', marginTop: 3, fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, branch.book.author || '저자 정보 없음'),
  ),
  h('span', { style: { flexShrink: 0, textAlign: 'right' } },
    h('span', { style: { display: 'block', fontSize: 11.5, fontWeight: 800, color: 'var(--brand-3)' } }, status),
    h('span', { style: { display: 'block', marginTop: 4, fontSize: 12, color: 'var(--ink-2)' } }, `문장 ${branch.leafCount}개`),
  ));
}

function SelectedBranchDetail({ branch, active, busy, onActivate, onOpenBook }) {
  if (!branch) return null;
  const canActivate = branch.status === 'reading' && !active;
  return h('section', {
    'aria-labelledby': 'selected-book-heading',
    style: { marginTop: 16, padding: 16, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' },
  },
  h('p', { style: { margin: '0 0 5px', color: 'var(--brand-3)', fontSize: 12, fontWeight: 900 } }, active ? '현재 홈에서 읽는 책' : '선택한 책'),
  h('h2', { id: 'selected-book-heading', style: { margin: 0, color: 'var(--ink)', fontSize: 18, fontWeight: 900 } }, branch.book.title || '제목 없는 책'),
  h('p', { style: { margin: '7px 0 0', color: 'var(--ink-2)', fontSize: 13 } }, `${bookTreeStatusLabel(branch.status)} · 문장 ${branch.leafCount}개`),
  h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 } },
    canActivate ? h('button', {
      type: 'button', disabled: busy, onClick: () => onActivate(branch),
      style: { minHeight: 44, padding: '10px 14px', border: '1px solid var(--brand-soft)', borderRadius: 'var(--r-sm)', background: 'var(--brand)', color: 'var(--paper)', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' },
    }, busy ? '바꾸는 중…' : '홈에서 이 책 읽기') : null,
    h('button', {
      type: 'button', onClick: () => onOpenBook(branch.bookId),
      style: { minHeight: 44, padding: '10px 14px', border: '1px solid var(--brand-soft)', borderRadius: 'var(--r-sm)', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' },
    }, branch.leafCount ? '저장한 문장 보기' : '책 상세 보기'),
  ));
}

function BookTreeHomeContent({
  tree, loading = false, error = '', query = '', status = 'all', page = 0,
  selectedId = null, activeId = null, busy = false, onQuery, onStatus, onPage,
  onSelect, onActivate, onAddBook, onOpenBook,
}) {
  if (loading) return h('div', { role: 'status', style: { padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)' } }, '책과 문장을 불러오는 중…');
  if (error) return h('div', { role: 'alert', style: { padding: 20, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', color: 'var(--ink-2)' } }, error);

  const selected = tree.branches.find((branch) => String(branch.id) === String(selectedId)) || tree.selectedBranch || null;
  const list = bookTreePage(tree.branches, query, status, page);

  return h('div', { style: { paddingBottom: 24 } },
    h(TreeOverview, { tree }),
    tree.branchCount === 0 ? h('section', {
      style: { marginTop: 16, padding: '28px 18px', textAlign: 'center', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)' },
    },
    h('h2', { style: { margin: 0, color: 'var(--ink)', fontSize: 17, fontWeight: 900 } }, '아직 등록한 책이 없어요'),
    h('p', { style: { margin: '8px 0 16px', color: 'var(--ink-3)', fontSize: 13, lineHeight: 1.55 } }, '읽고 싶은 책을 찾아 첫 기록을 시작해 보세요.'),
    h('button', { type: 'button', onClick: onAddBook, style: { minHeight: 44, padding: '10px 18px', border: '1px solid var(--brand)', borderRadius: 'var(--r-sm)', background: 'var(--brand)', color: 'var(--paper)', fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' } }, '책 찾아보기'),
    ) : h(React.Fragment, null,
      h('section', { 'aria-labelledby': 'book-list-heading', style: { marginTop: 20 } },
        h('h2', { id: 'book-list-heading', style: { margin: '0 0 10px', color: 'var(--ink)', fontSize: 17, fontWeight: 900 } }, '책 목록'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: 8, marginBottom: 10 } },
          h('label', { style: { minWidth: 0 } },
            h('span', { style: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } }, '책 제목 또는 저자 검색'),
            h('input', { type: 'search', value: query, placeholder: '책 또는 저자 검색', onChange: (event) => onQuery(event.target.value), style: { boxSizing: 'border-box', width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13 } }),
          ),
          h('label', null,
            h('span', { style: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } }, '독서 상태'),
            h('select', { value: status, onChange: (event) => onStatus(event.target.value), style: { width: '100%', minHeight: 44, padding: '9px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12.5 } },
              h('option', { value: 'all' }, '전체 상태'),
              h('option', { value: 'reading' }, '읽는 중'),
              h('option', { value: 'completed' }, '완독'),
              h('option', { value: 'aborted' }, '쉬어가는 중'),
            ),
          ),
        ),
        h('div', { role: 'listbox', 'aria-label': `책 ${list.total}권`, style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          list.branches.length ? list.branches.map((branch) => h(BranchRow, { key: branch.id, branch, selected: String(branch.id) === String(selected?.id), active: String(branch.id) === String(activeId), onSelect }))
            : h('p', { role: 'status', style: { margin: 0, padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 } }, '조건에 맞는 책이 없어요.'),
        ),
        list.pageCount > 1 ? h('nav', { 'aria-label': '책 목록 페이지', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 } },
          h('button', { type: 'button', disabled: list.currentPage === 0, onClick: () => onPage(list.currentPage - 1), style: { minHeight: 44, padding: '9px 13px', border: 'none', background: 'transparent', color: 'var(--brand-3)', fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer' } }, '이전'),
          h('span', { 'aria-live': 'polite', style: { color: 'var(--ink-3)', fontSize: 12 } }, `${list.currentPage + 1} / ${list.pageCount}`),
          h('button', { type: 'button', disabled: list.currentPage >= list.pageCount - 1, onClick: () => onPage(list.currentPage + 1), style: { minHeight: 44, padding: '9px 13px', border: 'none', background: 'transparent', color: 'var(--brand-3)', fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer' } }, '다음'),
        ) : null,
      ),
      h(SelectedBranchDetail, { branch: selected, active: String(selected?.id) === String(activeId), busy, onActivate, onOpenBook }),
    ),
  );
}

function BookTreeHomeView({ dataStore = window.DataStore, activeUserBookId = null, onActiveBookChange, onOpenSearch }) {
  const [tree, setTree] = useBookTreeState(null);
  const [activeId, setActiveId] = useBookTreeState(activeUserBookId);
  const [selectedId, setSelectedId] = useBookTreeState(activeUserBookId);
  const [query, setQuery] = useBookTreeState('');
  const [status, setStatus] = useBookTreeState('all');
  const [page, setPage] = useBookTreeState(0);
  const [busy, setBusy] = useBookTreeState(false);
  const [error, setError] = useBookTreeState('');
  const [revision, setRevision] = useBookTreeState(0);

  useBookTreeEffect(() => {
    setActiveId(activeUserBookId);
    if (activeUserBookId != null) setSelectedId(activeUserBookId);
  }, [activeUserBookId]);

  useBookTreeEffect(() => {
    let alive = true;
    setError('');
    window.RG_bookTree.fromDataStore(dataStore, { selectedUserBookId: selectedId })
      .then((nextTree) => { if (alive) setTree(nextTree); })
      .catch(() => { if (alive) setError('책과 문장을 불러오지 못했어요. 잠시 후 다시 열어 주세요.'); });
    return () => { alive = false; };
  }, [dataStore, selectedId, revision]);

  useBookTreeEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('rg:sentence-added', refresh);
    window.addEventListener('rg:sentence-removed', refresh);
    return () => {
      window.removeEventListener('rg:sentence-added', refresh);
      window.removeEventListener('rg:sentence-removed', refresh);
    };
  }, []);

  const activate = async (branch) => {
    setBusy(true);
    setError('');
    try {
      await activateBookTreeBranch({ dataStore, branch, onActiveBookChange });
      setActiveId(branch.id);
      setSelectedId(branch.id);
      setRevision((value) => value + 1);
    } catch (_error) {
      setError('활성 책을 바꾸지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return h(BookTreeHomeContent, {
    tree: tree || { treeCount: 1, branchCount: 0, leafCount: 0, branches: [], selectedBranch: null, accessibilitySummary: '책 0권, 문장 0개' },
    loading: !tree && !error, error, query, status, page, selectedId, activeId, busy,
    onQuery: (value) => { setQuery(value); setPage(0); },
    onStatus: (value) => { setStatus(value); setPage(0); },
    onPage: setPage, onSelect: setSelectedId, onActivate: activate,
    onAddBook: onOpenSearch || (() => window.RG_openSearch?.()),
    onOpenBook: (bookId) => window.RG_openBook?.(bookId),
  });
}

window.BookTreeHomeView = BookTreeHomeView;

export {
  BOOK_TREE_PAGE_SIZE,
  BookTreeHomeContent,
  BookTreeHomeView,
  activateBookTreeBranch,
  bookTreePage,
  bookTreeStatusLabel,
};
