// issue #1350 — development 번들 전용 합성 검수 페르소나.
// 실제 사용자/production row를 복제하지 않으며, 모든 문장·감상·Q/A는 UI 검수용 창작 fixture다.
const MODE_KEY = 'rg_dev_review_mode';
const PERSONA_KEY = 'rg_dev_review_persona';
const DAY = 86400000;
const SYNC_DELAY_MS = 250;
let _syncTimer = null;
let _pendingSync = null;
let _syncChain = Promise.resolve();

function apiUrl(id, instanceId) {
  const base = String((window.RG_CONFIG && window.RG_CONFIG.API_ORIGIN) || '').replace(/\/$/, '');
  return `${base}/api/dev-review-personas?id=${encodeURIComponent(id)}&instance=${encodeURIComponent(instanceId)}`;
}

async function remoteRead(id, instanceId) {
  const response = await fetch(apiUrl(id, instanceId), { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`DEV persona read ${response.status}`);
  const body = await response.json();
  return body && body.state && Number.isInteger(body.revision)
    ? { state: body.state, revision: body.revision }
    : null;
}

async function remoteWrite(id, instanceId, state, expectedRevision) {
  const response = await fetch(apiUrl(id, instanceId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, expectedRevision }),
    keepalive: true,
  });
  if (!response.ok) throw new Error(`DEV persona write ${response.status}`);
  return response.json();
}

function scheduleRemoteWrite(id, instanceId, state, version, localAdapter) {
  _pendingSync = { id, instanceId, state, version, localAdapter };
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    const pending = _pendingSync;
    _pendingSync = null;
    _syncTimer = null;
    if (!pending) return;
    _syncChain = _syncChain
      .then(async () => {
        const result = await remoteWrite(pending.id, pending.instanceId, pending.state, pending.localAdapter.local.getRevision());
        pending.localAdapter.local.setRevision(result.revision);
        if (pending.localAdapter.local.version() === pending.version) pending.localAdapter.local.clearDirty();
      })
      .catch((error) => console.warn('[ReadingGo] DEV persona 동기화 대기:', error.message));
  }, SYNC_DELAY_MS);
}

async function flushRemoteWrite(id, instanceId, state, localAdapter) {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = null;
  _pendingSync = null;
  await _syncChain.catch(() => {});
  const version = localAdapter.local.version();
  const result = await remoteWrite(id, instanceId, state, localAdapter.local.getRevision());
  localAdapter.local.setRevision(result.revision);
  if (localAdapter.local.version() === version) localAdapter.local.clearDirty();
}

function isolateSupabase() {
  const blocked = async () => null;
  window.RG_SB = {
    isConfigured: () => false,
    client: () => null,
    currentUser: blocked,
    accessToken: blocked,
    myProfile: blocked,
    onAuthChange: () => () => {},
    signInWithOAuth: async () => { throw new Error('DEV 검수 모드에서는 실제 로그인을 사용하지 않음'); },
    signInWithEmail: async () => { throw new Error('DEV 검수 모드에서는 실제 로그인을 사용하지 않음'); },
    signOut: blocked,
  };
  window.SupabaseDataStore = null;
}

function dateAgo(days) {
  const d = new Date(Date.now() - days * DAY);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function timestampAgo(days, hour = 20) {
  const d = new Date(`${dateAgo(days)}T${String(hour).padStart(2, '0')}:00:00`);
  return d.getTime();
}

function bookMeta(id) {
  const b = typeof window.getBook === 'function' ? window.getBook(id) : null;
  if (!b || b.id !== id) return { id, title: '합성 검수 도서', author: '검수용 저자', total_pages: 240, cover_url: '' };
  return { id: b.id, title: b.title, author: b.author, publisher: b.pub, total_pages: b.total, cover_url: b.cover, isbn13: b.isbn };
}

function sentence(personaId, bookId, index, page, text, note, daysAgo) {
  return {
    id: `dev-${personaId}-sentence-${index}`,
    user_book_id: `dev-${personaId}-book-${bookId}`,
    book_id: bookId,
    session_id: `dev-${personaId}-session-${index}`,
    page,
    text,
    my_note: note,
    kind: 'quote',
    visibility: index % 2 ? 'private' : 'public',
    created_at: timestampAgo(daysAgo),
  };
}

function sessions(personaId, bookId, pages, startDaysAgo = 0) {
  return pages.map((page, index) => ({
    id: `dev-${personaId}-session-${bookId}-${index + 1}`,
    user_book_id: `dev-${personaId}-book-${bookId}`,
    session_date: dateAgo(startDaysAgo + index),
    current_page: page,
    duration_sec: 720 + index * 180,
    created_at: timestampAgo(startDaysAgo + index),
  }));
}

function userBook(personaId, id, status, currentPage, opts = {}) {
  const meta = bookMeta(id);
  return {
    id: `dev-${personaId}-book-${id}`,
    book_id: id,
    book: meta,
    status,
    current_page: status === 'completed' ? meta.total_pages : currentPage,
    rating: opts.rating ?? null,
    review_text: opts.review ?? null,
    started_at: dateAgo(opts.startedDaysAgo ?? 18),
    completed_at: status === 'completed' ? dateAgo(opts.completedDaysAgo ?? 7) : null,
    sessions: sessions(personaId, id, opts.pages || [currentPage], opts.sessionStartDaysAgo || 0),
    sentences: opts.sentences || [],
    companion_recap: opts.recap || null,
  };
}

const DEFINITIONS = [
  {
    id: 'product-explorer',
    name: '합성 · 계휴 스타일 제품 탐험가',
    handle: 'dev_gyehyu',
    displayName: '계휴 스타일 QA',
    bio: '실제 계휴 기록이 아닌 제품 흐름 검수용 합성 페르소나',
    role: '새 흐름을 빠르게 훑는 기획형 독자',
    description: '읽는 중 여러 권, 공개·비공개 문장과 위시리스트 경계를 함께 검수해요.',
    xp: 2860,
    streak: 9,
    longest: 16,
    active: 'b001',
    wish: ['b010', 'b337'],
    books: [
      ['b001', 'reading', 214, { pages: [214, 198, 176, 151], startedDaysAgo: 24 }],
      ['b008', 'reading', 118, { pages: [118, 104], startedDaysAgo: 11, sessionStartDaysAgo: 2 }],
      ['b105', 'completed', 184, { rating: 4, review: '합성 감상: 짧은 장면마다 선택의 구조를 메모하며 읽었다.', completedDaysAgo: 12, pages: [184, 160], recap: '합성 회고: 다음 읽기에서는 인물의 선택을 비교한다.' }],
    ],
    sentences: [
      ['b001', 1, 176, '합성 문장: 익숙한 설명을 다른 질문으로 바꾸면 지도가 새로 보인다.', 'Q. 이 문장이 지금 만드는 기능과 닮은 점은?\nA. 당연하게 둔 진입 경로를 다시 관찰하게 한다.', 18],
      ['b008', 2, 104, '합성 문장: 천천히 고른 방향도 분명한 전진이 될 수 있다.', 'Q. 오늘 가장 작게 검증할 것은?\nA. 한 화면에서 선택과 복귀가 자연스러운지 확인한다.', 4],
      ['b105', 3, 151, '합성 문장: 규칙은 이름보다 실제로 누가 움직이는지를 보여 준다.', '합성 감상: 권한과 행동의 차이를 생각했다.', 13],
    ],
  },
  {
    id: 'community-listener',
    name: '합성 · Judy 스타일 문장 수집가',
    handle: 'dev_judy',
    displayName: 'Judy 스타일 QA',
    bio: '실제 Judy 기록이 아닌 프롬프트·대화 검수용 합성 페르소나',
    role: '대화와 감상을 오래 남기는 커뮤니티형 독자',
    description: '완독 기록과 긴 감상, 재키 Q/A가 많은 상태를 검수해요.',
    xp: 4875,
    streak: 21,
    longest: 34,
    active: 'b002',
    wish: ['b008', 'b172'],
    books: [
      ['b002', 'reading', 402, { pages: [402, 389, 371, 350, 328], startedDaysAgo: 40 }],
      ['b337', 'completed', 204, { rating: 5, review: '합성 감상: 결과보다 되돌아오는 태도를 중심으로 기록했다.', completedDaysAgo: 20, pages: [204, 188, 160], recap: '합성 회고: 고요한 반복이 만드는 힘을 기억한다.' }],
      ['b010', 'completed', 452, { rating: 4, review: '합성 감상: 서로 다른 해석을 나란히 적어 보니 질문이 선명해졌다.', completedDaysAgo: 45, pages: [452, 420] }],
    ],
    sentences: [
      ['b002', 1, 371, '합성 문장: 멀리 보는 일은 지금의 작은 좌표를 정확히 읽는 데서 시작한다.', 'Q. 최근 대화에서 놓친 작은 좌표는?\nA. 말한 내용보다 망설인 순간을 더 주의 깊게 듣고 싶다.\nQ. 다음에는 어떻게 확인할까?\nA. 결론 전에 상대의 표현을 한 번 되짚는다.', 25],
      ['b337', 2, 160, '합성 문장: 같은 자리로 돌아오는 힘은 실패와 반복을 구분한다.', 'Q. 반복을 지루하지 않게 만드는 것은?\nA. 어제와 다른 한 가지를 발견해 기록하는 일이다.', 21],
      ['b010', 3, 420, '합성 문장: 혼자 확신하는 말보다 함께 검증한 질문이 오래 남는다.', '합성 감상: 공개 문장 카드의 긴 텍스트 레이아웃 검수용이다.', 46],
    ],
  },
  {
    id: 'steady-builder',
    name: '합성 · Jerome 스타일 꾸준한 완독가',
    handle: 'dev_jerome',
    displayName: 'Jerome 스타일 QA',
    bio: '실제 Jerome 기록이 아닌 회귀·누적 상태 검수용 합성 페르소나',
    role: '진도와 성취를 꼼꼼히 쌓는 개발형 독자',
    description: '여러 완독과 촘촘한 독서 기록의 누적 상태를 검수해요.',
    xp: 7460,
    streak: 47,
    longest: 63,
    active: 'b010',
    wish: ['b001', 'b002', 'b105'],
    books: [
      ['b010', 'reading', 333, { pages: [333, 320, 301, 287, 268, 249, 230], startedDaysAgo: 52 }],
      ['b008', 'completed', 248, { rating: 5, review: '합성 감상: 매일 적은 짧은 메모를 완독 뒤 다시 연결해 보았다.', completedDaysAgo: 9, pages: [248, 231, 215, 198], recap: '합성 회고: 작은 기록이 쌓이면 읽기의 방향이 보인다.' }],
      ['b337', 'completed', 204, { rating: 4, review: '합성 감상: 일정한 리듬을 유지하는 장면에 표시를 남겼다.', completedDaysAgo: 31, pages: [204, 181, 157] }],
      ['b105', 'completed', 184, { rating: 3, review: '합성 감상: 짧게 읽고 바로 질문을 남기는 방식으로 완독했다.', completedDaysAgo: 64, pages: [184, 142] }],
    ],
    sentences: [
      ['b010', 1, 301, '합성 문장: 정확한 기록은 기억을 대신하지 않고 다시 생각할 발판을 만든다.', 'Q. 오늘 기록에서 다시 확인할 가정은?\nA. 저장됐다는 표시와 실제 재로딩 결과가 같은지 확인한다.', 16],
      ['b008', 2, 215, '합성 문장: 큰 변화는 눈에 띄지 않는 반복의 방향에서 먼저 드러난다.', 'Q. 꾸준함을 확인하는 가장 작은 증거는?\nA. 하루가 지나도 이어지는 데이터와 다음 행동이다.', 29],
      ['b337', 3, 181, '합성 문장: 속도를 늦추면 이전에는 지나친 경계가 보이기 시작한다.', '합성 감상: 세션 목록과 완독 카드 검수용 메모.', 32],
    ],
  },
];

function makeFixture(definition) {
  const grouped = new Map();
  definition.sentences.forEach(args => {
    const row = sentence(definition.id, ...args);
    const rows = grouped.get(row.book_id) || [];
    rows.push(row);
    grouped.set(row.book_id, rows);
  });
  const books = definition.books.map(([id, status, page, opts]) => userBook(definition.id, id, status, page, {
    ...opts,
    sentences: grouped.get(id) || [],
  }));
  return {
    user_books: books,
    active_user_book_id: `dev-${definition.id}-book-${definition.active}`,
    streak: { current: definition.streak, longest: definition.longest, last_check_in_date: dateAgo(0) },
    xp: definition.xp,
    claps: {},
    bookmarks: {},
    wish_books: definition.wish.slice(),
    settings: { default_sentence_visibility: 'public' },
    pending: {},
  };
}

function publicPersona(definition) {
  return {
    id: definition.id,
    name: definition.name,
    handle: definition.handle,
    displayName: definition.displayName,
    role: definition.role,
    description: definition.description,
    summary: `${definition.books.filter(row => row[1] === 'reading').length}권 읽는 중 · ${definition.books.filter(row => row[1] === 'completed').length}권 완독 · ${definition.streak}일 스트릭`,
  };
}

function definitionById(id) {
  return DEFINITIONS.find(item => item.id === id) || null;
}

async function activate(id) {
  const definition = definitionById(id);
  const localAdapter = window['LocalDataStore'];
  if (!definition || !localAdapter?.local?.configure) throw new Error('합성 페르소나를 시작할 수 없음');
  const previous = current();
  if (previous && previous.id !== id && window.DataStore === localAdapter && localAdapter.local.isDirty()) {
    try {
      await flushRemoteWrite(previous.id, localAdapter.local.clientId(), localAdapter.local.read(), localAdapter);
    } catch (error) {
      console.warn('[ReadingGo] 이전 DEV persona 동기화 보류:', error.message);
    }
  }
  window.DataStore = localAdapter;
  isolateSupabase();
  window.RG_ME = {
    id: `dev-persona-${definition.id}`,
    handle: definition.handle,
    displayName: definition.displayName,
    display_name: definition.displayName,
    bio: definition.bio,
    avatar: '',
    isAdmin: false,
    wishlist_public: false,
  };
  const localState = localAdapter.local.configure({
    storageKey: `rg_dev_review_persona_${definition.id}`,
    initialState: makeFixture(definition),
  });
  const instanceId = localAdapter.local.clientId();
  try {
    if (localAdapter.local.isDirty()) {
      await flushRemoteWrite(definition.id, instanceId, localState, localAdapter);
    } else {
      const remoteState = await remoteRead(definition.id, instanceId);
      if (remoteState && Array.isArray(remoteState.state.user_books)) {
        localAdapter.local.replace(remoteState.state);
        localAdapter.local.setRevision(remoteState.revision);
        localAdapter.local.clearDirty();
      } else {
        localAdapter.local.clearRevision();
        await flushRemoteWrite(definition.id, instanceId, localState, localAdapter);
      }
    }
  } catch (error) {
    localAdapter.local.markDirty();
    console.warn('[ReadingGo] DEV persona 서버 동기화 보류:', error.message);
  }
  localAdapter.local.setWriteHook((state, version) => scheduleRemoteWrite(definition.id, instanceId, state, version, localAdapter));
  sessionStorage.setItem(MODE_KEY, '1');
  sessionStorage.setItem(PERSONA_KEY, definition.id);
  return publicPersona(definition);
}

async function restore() {
  if (sessionStorage.getItem(MODE_KEY) !== '1') return null;
  const id = sessionStorage.getItem(PERSONA_KEY);
  if (!definitionById(id)) {
    sessionStorage.removeItem(MODE_KEY);
    sessionStorage.removeItem(PERSONA_KEY);
    return null;
  }
  return activate(id);
}

function current() {
  const definition = definitionById(sessionStorage.getItem(PERSONA_KEY));
  return definition ? publicPersona(definition) : null;
}

async function reset() {
  const localAdapter = window['LocalDataStore'];
  const persona = current();
  if (!persona || window.DataStore !== localAdapter) throw new Error('활성 합성 페르소나가 없음');
  let remoteState = null;
  try { remoteState = await remoteRead(persona.id, localAdapter.local.clientId()); } catch (error) {}
  if (remoteState) localAdapter.local.setRevision(remoteState.revision);
  const state = localAdapter.local.reset();
  try {
    await flushRemoteWrite(persona.id, localAdapter.local.clientId(), state, localAdapter);
  } catch (error) {
    localAdapter.local.markDirty();
    console.warn('[ReadingGo] DEV persona reset 동기화 보류:', error.message);
  }
  return state;
}

async function clear() {
  const persona = current();
  const localAdapter = window['LocalDataStore'];
  if (persona && localAdapter?.local?.isDirty && localAdapter.local.isDirty()) {
    try { await flushRemoteWrite(persona.id, localAdapter.local.clientId(), localAdapter.local.read(), localAdapter); } catch (error) {}
  }
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(PERSONA_KEY);
}

export const devReviewPersonas = {
  list: () => DEFINITIONS.map(publicPersona),
  activate,
  restore,
  current,
  reset,
  clear,
};
