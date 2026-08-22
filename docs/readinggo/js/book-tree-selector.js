// Book-tree Phase 1 projection (#1453).
// Pure/read-only: derives one tree from the current user's DataStore rows without
// reading or changing XP, streak, nest/castle, social, or reaction state.

const BRANCH_STATUSES = new Set(['reading', 'completed', 'aborted']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compareText(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  return left < right ? -1 : left > right ? 1 : 0;
}

function timeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function freezeList(list) {
  list.forEach(Object.freeze);
  return Object.freeze(list);
}

function bookSummary(row) {
  const book = row && row.book ? row.book : {};
  return Object.freeze({
    id: row?.book_id ?? book.id ?? null,
    title: book.title || '',
    author: book.author || '',
    coverUrl: book.cover_url || book.cover || '',
    totalPages: Number(book.total_pages ?? book.total) || 0,
  });
}

function leafSummary(row) {
  return {
    id: row.id ?? null,
    userBookId: row.user_book_id,
    page: row.page !== null && row.page !== undefined && row.page !== '' && Number.isFinite(Number(row.page))
      ? Number(row.page)
      : null,
    visibility: row.visibility || 'private',
    createdAt: row.created_at ?? null,
    readingRoundId: row.reading_round_id ?? null,
  };
}

function sortLeaves(left, right) {
  return timeValue(right.createdAt) - timeValue(left.createdAt)
    || compareText(left.id, right.id);
}

function sortBranches(left, right) {
  return timeValue(right.startedAt) - timeValue(left.startedAt)
    || compareText(left.id, right.id);
}

function candidateSummary(row) {
  const book = row && row.book ? row.book : {};
  return {
    bookId: row?.book_id ?? book.id ?? null,
    book: bookSummary({ book_id: row?.book_id, book }),
    createdAt: row?.created_at ?? null,
  };
}

function sortCandidates(left, right) {
  return timeValue(right.createdAt) - timeValue(left.createdAt)
    || compareText(left.book.title, right.book.title)
    || compareText(left.bookId, right.bookId);
}

/**
 * Deterministically project authoritative user_books and owned sentences.
 * Sentence text/my_note are intentionally omitted: this summary is safe to pass
 * to navigation or aggregate analytics without leaking raw sentence content.
 */
export function selectBookTree({
  userBooks = [],
  sentences = [],
  wishBooks,
  selectedUserBookId = null,
} = {}) {
  const leavesByBranch = new Map();
  for (const sentence of asArray(sentences)) {
    if (!sentence || sentence.user_book_id == null) continue;
    const key = String(sentence.user_book_id);
    if (!leavesByBranch.has(key)) leavesByBranch.set(key, []);
    leavesByBranch.get(key).push(leafSummary(sentence));
  }

  const branches = [];
  for (const row of asArray(userBooks)) {
    if (!row || row.id == null || !BRANCH_STATUSES.has(row.status)) continue;
    const leaves = leavesByBranch.get(String(row.id)) || [];
    leaves.sort(sortLeaves);
    freezeList(leaves);
    branches.push({
      id: row.id,
      bookId: row.book_id ?? row.book?.id ?? null,
      book: bookSummary(row),
      status: row.status,
      currentPage: Number(row.current_page) || 0,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
      leafCount: leaves.length,
      leaves,
    });
  }
  branches.sort(sortBranches);
  branches.forEach(Object.freeze);
  Object.freeze(branches);

  const totalLeafCount = branches.reduce((sum, branch) => sum + branch.leafCount, 0);
  const selectedBranch = selectedUserBookId == null
    ? null
    : branches.find((branch) => String(branch.id) === String(selectedUserBookId)) || null;

  let candidates = null;
  if (Array.isArray(wishBooks)) {
    candidates = wishBooks.filter(Boolean).map(candidateSummary);
    candidates.sort(sortCandidates);
    candidates.forEach((candidate) => Object.freeze(candidate));
    Object.freeze(candidates);
  }

  return Object.freeze({
    treeCount: 1,
    branchCount: branches.length,
    leafCount: totalLeafCount,
    branches,
    selectedBranch,
    candidateCount: candidates ? candidates.length : null,
    candidates,
    accessibilitySummary: `책 ${branches.length}권, 문장 ${totalLeafCount}개`,
  });
}

/** Compatibility shim for the existing DataStore/window-global architecture. */
export async function selectBookTreeFromDataStore(dataStore, options = {}) {
  if (!dataStore?.myBooks?.list || !dataStore?.sentences?.listMine) {
    throw new TypeError('book-tree selector requires DataStore.myBooks.list and sentences.listMine');
  }
  const supportsWishes = typeof dataStore.wishBooks?.list === 'function';
  const [userBooks, sentences, wishBooks] = await Promise.all([
    Promise.resolve(dataStore.myBooks.list()),
    Promise.resolve(dataStore.sentences.listMine()),
    supportsWishes ? Promise.resolve(dataStore.wishBooks.list()) : Promise.resolve(undefined),
  ]);
  return selectBookTree({ ...options, userBooks, sentences, wishBooks });
}

export const BookTreeSelector = Object.freeze({
  select: selectBookTree,
  fromDataStore: selectBookTreeFromDataStore,
});

if (typeof window !== 'undefined') {
  window.RG_bookTree = BookTreeSelector;
  window.RG_selectBookTree = selectBookTree;
}
