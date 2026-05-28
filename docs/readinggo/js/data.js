// data.js — localStorage helpers, seed data, TSV loader, state schema
// window exports at bottom

// ── localStorage helper ────────────────────────────────────────────────────────
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── Nest evolution stages (§5.2) ───────────────────────────────────────────────
const NEST_STAGES = [
  { max: 20,  name: '나뭇가지 자리', emoji: '🪵', color: '#AFAFAF', bg: '#f3f4f6' },
  { max: 50,  name: '빈 둥지',       emoji: '🪹', color: '#F59E0B', bg: '#FEF3C7' },
  { max: 80,  name: '따뜻한 둥지',   emoji: '🏠', color: '#58CC02', bg: '#F0FDF4' },
  { max: 99,  name: '다정한 집',     emoji: '🏡', color: '#1CB0F6', bg: '#EFF6FF' },
  { max: 100, name: '참새의 성',     emoji: '🏰', color: '#CE82FF', bg: '#FAF5FF' },
];
const getNestStage = pct => NEST_STAGES.find(s => pct <= s.max) || NEST_STAGES[4];

// ── NPC 검색 풀 (소셜 탭 친구 찾기) ───────────────────────────────────────────
const NPC_SEARCH_USERS = [
  { id: 'npc1', handle: 'book_bear',        name: '책읽는곰돌이', stage: 3, isLit: true,  isNpc: true,
    sentence: '"역사는 언제나 승자의 기록이다."',         bio: '매일 아침 30분 독서',   books: ['사피엔스', '데미안'] },
  { id: 'npc2', handle: 'activist_raccoon', name: '활자라쿤',    stage: 4, isLit: true,  isNpc: true,
    sentence: '"빅브라더는 당신을 지켜보고 있다."',       bio: '분석적 인용 독서인',    books: ['1984', '총균쇠'] },
  { id: 'npc3', handle: 'reading_owl',      name: '독서올빼미',  stage: 2, isLit: false, isNpc: true,
    sentence: '"밤에 읽는 책이 더 깊이 스며든다."',       bio: '야간 독서 전문가',      books: ['호밀밭의 파수꾼'] },
  { id: 'npc4', handle: 'page_fox',         name: '한페이지여우', stage: 1, isLit: true,  isNpc: true,
    sentence: '"한 문장이 삶을 바꿀 수 있다."',           bio: '하루 한 페이지 실천 중', books: ['어린 왕자'] },
];

// ── 마을 게시판 시드 ────────────────────────────────────────────────────────────
const SEED_BOARD_POSTS = [
  { id: 'bp1', handle: 'activist_raccoon', name: '활자라쿤',    time: '어제',     isNpc: true,
    text: '1984 다 읽고 나니 SNS가 다르게 보임. 빅브라더가 스마트폰이었나요 우리.' },
  { id: 'bp2', handle: 'book_bear',        name: '책읽는곰돌이', time: '2일 전',   isNpc: true,
    text: '사피엔스 3장 - 인지혁명 파트 읽다가 멍해짐. 스토리텔링이 인류를 만들었다는 게 너무 와닿아서.' },
  { id: 'bp3', handle: 'reading_owl',      name: '독서올빼미',  time: '3일 전',   isNpc: true,
    text: '오늘부터 호밀밭의 파수꾼 시작! 홀든 콜필드 이름이 왜 이렇게 귀엽지' },
];

// ── 독서모임 탭 시드 데이터 (§5.5 신설) ───────────────────────────────────────
const SEED_MEGA_STREAMS = [
  { id: 'mega1', title: '사피엔스', isbn: '9788934972464', membersCount: 42, todayPages: 154, emoji: '🐒' },
  { id: 'mega2', title: '어린 왕자', isbn: '9788937460449', membersCount: 18, todayPages: 45, emoji: '🌹' },
  { id: 'mega3', title: '1984', isbn: '9788937460319', membersCount: 29, todayPages: 82, emoji: '👁️' },
  { id: 'mega4', title: '데미안', isbn: '9788937460647', membersCount: 22, todayPages: 38, emoji: '🥚' },
];

const SEED_SUB_GROUPS = [
  {
    id: 'sub1',
    name: '🔥 사피엔스 30일 완독 레이스',
    bookTitle: '사피엔스',
    isbn: '9788934972464',
    type: 'public', // 누구나 가입 신청 후 즉시 가입 또는 신청제
    privacy: 'open',
    targetDate: '2026-06-25',
    membersCount: 5,
    maxMembers: 10,
    targetPages: 460,
    description: '사피엔스를 매일 읽고 하루 한 줄 문장을 기록하는 끝장 레이스 모임입니다! 완독 가자!',
    host: 'gyehyu',
    members: [
      { id: 'f1', handle: 'gyehyu', name: '계휴', stage: 4, isLit: true, sentence: '"별은 아름답다, 모래들이 아름답듯이."' },
      { id: 'npc1', handle: 'book_bear', name: '책읽는곰돌이', stage: 3, isLit: true, sentence: '"역사는 언제나 승자의 기록이다."', isNpc: true },
      { id: 'npc2', handle: 'activist_raccoon', name: '활자라쿤', stage: 4, isLit: true, sentence: '"빅브라더는 당신을 지켜보고 있다. 그것도 당신 안에서."', isNpc: true },
      { id: 'f2', handle: 'seungwon', name: '승원', stage: 2, isLit: false, sentence: '' },
      { id: 'me', handle: 'me', name: '나', stage: 1, isLit: false, sentence: '' }
    ]
  },
  {
    id: 'sub2',
    name: '🔒 도파민 인류 극복 모임 (2주 집중)',
    bookTitle: '도파민네이션',
    isbn: '9788950997486',
    type: 'private', // 비공개
    privacy: 'code',
    entryCode: 'DOPAMINE',
    targetDate: '2026-06-10',
    membersCount: 3,
    maxMembers: 8,
    targetPages: 312,
    description: '도파민 중독에서 벗어나기 위해 도파민네이션을 치열하게 읽는 소수정예 비밀 모임.',
    host: 'reading_owl',
    members: [
      { id: 'npc3', handle: 'reading_owl', name: '독서올빼미', stage: 2, isLit: false, sentence: '"밤에 읽는 책이 더 깊이 스며든다."', isNpc: true },
      { id: 'npc4', handle: 'page_fox', name: '한페이지여우', stage: 1, isLit: true, sentence: '"한 문장이 삶을 바꿀 수 있다."', isNpc: true },
      { id: 'f1', handle: 'gyehyu', name: '계휴', stage: 3, isLit: true, sentence: '"몰입의 기쁨을 찾아서."' }
    ]
  },
  {
    id: 'sub3',
    name: '👑 IT경영 AI 비즈니스 스터디',
    bookTitle: 'AI 경영학',
    isbn: '9788934988779',
    type: 'approve', // 승인제
    privacy: 'approve',
    targetDate: '2026-06-20',
    membersCount: 4,
    maxMembers: 15,
    targetPages: 380,
    description: '비즈니스에 어떻게 AI를 적용할지, 전략 사례를 깊이 파고들며 공유하는 학구적인 모임입니다.',
    host: 'activist_raccoon',
    members: [
      { id: 'npc2', handle: 'activist_raccoon', name: '활자라쿤', stage: 4, isLit: true, sentence: '"인공지능 비즈니스는 전략의 게임이다."', isNpc: true },
      { id: 'npc1', handle: 'book_bear', name: '책읽는곰돌이', stage: 3, isLit: true, sentence: '"데이터 플라이휠이 비즈니스를 주도한다."', isNpc: true },
      { id: 'f2', handle: 'seungwon', name: '승원', stage: 2, isLit: false, sentence: '' }
    ]
  }
];

const SEED_GROUP_FEEDS = {
  'sub1': [
    { id: 'gf1', handle: 'gyehyu', name: '계휴', page: 120, sentence: '역사는 단지 한 줌의 지배자들이 만든 이야기일 뿐이다.', time: '2시간 전' },
    { id: 'gf2', handle: 'book_bear', name: '책읽는곰돌이', page: 85, sentence: '인류가 지구를 지배하게 된 원동력은 오직 허구의 믿음이다.', time: '5시간 전' },
    { id: 'gf3', handle: 'activist_raccoon', name: '활자라쿤', page: 198, sentence: '돈은 상호 신뢰 시스템 중 가장 위대하고 효율적인 발명품이다.', time: '어제' }
  ],
  'sub2': [
    { id: 'gf4', handle: 'page_fox', name: '한페이지여우', page: 45, sentence: '우리가 느끼는 쾌락과 고통은 저울의 양팔 저울과 같다.', time: '3시간 전' },
    { id: 'gf5', handle: 'reading_owl', name: '독서올빼미', page: 92, sentence: '끊임없는 자극은 우리 뇌의 도파민 수용체를 마비시킨다.', time: '어제' }
  ]
};

// ── Seed data (Phase 0 시뮬레이션) ────────────────────────────────────────────
const SEED_FRIENDS = [
  { id: 'npc1', handle: 'book_bear',        name: '책읽는곰돌이', stage: 3, isLit: true,
    sentence: '"역사는 언제나 승자의 기록이다. 그러나 우리는 그 너머를 봐야 한다."', isNpc: true },
  { id: 'npc2', handle: 'activist_raccoon', name: '활자라쿤',     stage: 4, isLit: true,
    sentence: '"빅브라더는 당신을 지켜보고 있다. 그것도 당신 안에서."',             isNpc: true },
  { id: 'f1',   handle: 'gyehyu',           name: '계휴',         stage: 4, isLit: true,
    sentence: '"별은 아름답다, 모래들이 아름답듯이."' },
  { id: 'f2',   handle: 'seungwon',         name: '승원',         stage: 2, isLit: false, sentence: '' },
];

const SEED_LEAGUE = [
  { handle: 'gyehyu',           name: '계휴',         xp: 420 },
  { handle: 'activist_raccoon', name: '활자라쿤',     xp: 380, isNpc: true },
  { handle: 'me',               name: '나',           xp: 240, isMe: true },
  { handle: 'seungwon',         name: '승원',         xp: 180 },
  { handle: 'book_bear',        name: '책읽는곰돌이',  xp: 120, isNpc: true },
];

const SEED_FEED = [
  { id: 'fd1', handle: 'gyehyu',           name: '계휴',
    book: '어린 왕자', isbn: '9788937460449', page: 72,
    sentence: '"별은 아름답다, 모래들이 아름답듯이."',   time: '2시간 전', jaeks: 3 },
  { id: 'fd2', handle: 'activist_raccoon', name: '활자라쿤',
    book: '1984',     isbn: '9788937460319', page: 156,
    sentence: '"빅브라더는 당신을 지켜보고 있다."',      time: '4시간 전', jaeks: 7 },
  { id: 'fd3', handle: 'book_bear',        name: '책읽는곰돌이',
    book: '사피엔스', isbn: '9788934972464', page: 89,
    sentence: '"역사는 언제나 승자의 기록이다."',        time: '어제',     jaeks: 5 },
  { id: 'fd4', handle: 'reading_owl',      name: '독서올빼미',
    book: '데미안',   isbn: '9788937460647', page: 114,
    sentence: '"새는 알을 깨고 나온다. 알은 세계다."',   time: '3시간 전', jaeks: 12 },
  { id: 'fd5', handle: 'page_fox',         name: '한페이지여우',
    book: '어린 왕자', isbn: '9788937460449', page: 38,
    sentence: '"가장 중요한 것은 눈에 보이지 않아."',    time: '5시간 전', jaeks: 9 },
];

// ── TSV loader ─────────────────────────────────────────────────────────────────
let _booksCache = null;
async function loadBooks() {
  if (_booksCache) return _booksCache;
  try {
    const res = await fetch('data/books.tsv');
    const text = await res.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split('\t').map(h => h.trim());
    _booksCache = lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = line.split('\t');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      obj.total_pages = parseInt(obj.total_pages) || 0;
      return obj;
    });
    return _booksCache;
  } catch { return []; }
}

// 클라이언트 fuzzy 검색 (Phase 0 — Fuse.js 없이 includes 기반)
function fuzzySearch(books, q) {
  if (!q.trim()) return books;
  const low = q.toLowerCase().trim();
  return books.filter(b =>
    b.title.toLowerCase().includes(low) ||
    b.author.toLowerCase().includes(low) ||
    (b.isbn || '').includes(low)
  );
}

// ── Utils ──────────────────────────────────────────────────────────────────────
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function calcLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

// ── App state schema (Phase 0 localStorage) ────────────────────────────────────
//
// userBooks[] = [{
//   id, book:{book_id,isbn,title,author,total_pages,cover_url,...},
//   currentPage, status:'reading'|'completed',
//   sessions:[{id,sessionDate,currentPage,xpEarned,createdAt}],
//   sentences:[{id,text,page,sessionId,createdAt}]
// }]

const INITIAL_STATE = {
  appPhase: 'onboarding',   // 'onboarding' | 'home'
  onboardingStep: 'A',      // A | C1 | C2 | D1 | D2 | D3 | E
  onboardingBook: null,          // book object from C1
  onboardingPage: 0,             // session last page from D1
  onboardingText: '',            // sentence text from D2
  onboardingSentencePage: null,  // sentence-specific page from D2 (null = use onboardingPage)
  user: { handle: '', displayName: '나', xp: 0, level: 1, streak: 0, shields: 0 },
  userBooks: [],
  activeUserBookId: null,
  feed: SEED_FEED,
  friends: SEED_FRIENDS,
  leagueData: SEED_LEAGUE,
  jaekFeed: {},             // feedId -> bool (짹 여부)
  bookmarks: [],            // [{id,name,handle,book,isbn,page,sentence,time,jaeks,bookmarkedAt}]
  wishBooks: [],            // [{bookTitle,isbn,addedAt}]
  pokes: {},                // friendId -> bool (오늘 보냈는지)
  simDate: null,            // 날짜 시뮬레이터 (null = 오늘)
  joinedGroupIds: ['sub1'], // 사용자가 이미 가입한 서브 모임 ID 목록 (§5.5 신설)
  pendingGroupIds: [],      // 가입 신청 대기 중인 모임 ID 목록 (§5.5 신설)
};

function loadAppState() {
  const s = LS.get('rg_v42', null);
  if (!s) return { ...INITIAL_STATE };
  // 새 필드 merge
  return {
    ...INITIAL_STATE,
    ...s,
    user: { ...INITIAL_STATE.user, ...(s.user || {}) },
    feed: s.feed || SEED_FEED,
    friends: s.friends || SEED_FRIENDS,
    leagueData: s.leagueData || SEED_LEAGUE,
    jaekFeed:  s.jaekFeed  || {},
    bookmarks: s.bookmarks || [],
    wishBooks: s.wishBooks || [],
    joinedGroupIds: s.joinedGroupIds || ['sub1'],
    pendingGroupIds: s.pendingGroupIds || [],
  };
}

function getActiveBook(state) {
  if (!state.activeUserBookId) return null;
  return state.userBooks.find(ub => ub.id === state.activeUserBookId) || null;
}

function hasDoneToday(userBook, activeDate) {
  if (!userBook) return false;
  const today = activeDate || todayISO();
  return (userBook.sessions || []).some(s => s.sessionDate === today);
}

function getSessionDates(userBooks) {
  const dates = new Set();
  (userBooks || []).forEach(ub => (ub.sessions || []).forEach(s => dates.add(s.sessionDate)));
  return dates;
}

function advanceSimDate(simDate) {
  const d = simDate ? new Date(simDate) : new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── 교보문고 직접 링크 (ISBN → product URL) ────────────────────────────────────
// ISBN으로 자동 생성 불가 — 확인된 URL만 추가
const KYOBO_URLS = {
  '9788934972464': 'https://product.kyobobook.co.kr/detail/S000000597165', // 사피엔스
};

// ── window exports ─────────────────────────────────────────────────────────────
window.NPC_SEARCH_USERS  = NPC_SEARCH_USERS;
window.SEED_BOARD_POSTS  = SEED_BOARD_POSTS;
window.LS            = LS;
window.NEST_STAGES   = NEST_STAGES;
window.getNestStage  = getNestStage;
window.SEED_FRIENDS  = SEED_FRIENDS;
window.SEED_LEAGUE   = SEED_LEAGUE;
window.SEED_FEED     = SEED_FEED;
window.loadBooks     = loadBooks;
window.fuzzySearch   = fuzzySearch;
window.genId         = genId;
window.todayISO      = todayISO;
window.todayLabel    = todayLabel;
window.calcLevel     = calcLevel;
window.INITIAL_STATE = INITIAL_STATE;
window.loadAppState  = loadAppState;
window.KYOBO_URLS         = KYOBO_URLS;
window.getActiveBook      = getActiveBook;
window.hasDoneToday       = hasDoneToday;
window.getSessionDates    = getSessionDates;
window.advanceSimDate     = advanceSimDate;
window.SEED_MEGA_STREAMS  = SEED_MEGA_STREAMS;
window.SEED_SUB_GROUPS    = SEED_SUB_GROUPS;
window.SEED_GROUP_FEEDS   = SEED_GROUP_FEEDS;

