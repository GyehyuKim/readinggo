/* =========================================================
   ReadingGo — data.js
   책 데이터, 초기 상태, 헬퍼 함수
   window.* 으로 export → 다음 파일에서 참조 가능
   ========================================================= */

const RG_BOOKS = [
  {id:"b001",isbn:"9788934972464",title:"사피엔스",author:"유발 하라리",pub:"김영사",total:648,cover:"https://image.aladin.co.kr/product/31424/4/cover500/k482832219_1.jpg",fb:["#F4D9A8","#E8B473"],toc:[[1,"프롤로그",1,20],[2,"1부: 인지혁명",21,138],[3,"2부: 농업혁명",139,270],[4,"3부: 인류의 통합",271,444],[5,"4부: 과학혁명",445,630],[6,"에필로그",631,648]]},
  {id:"b002",isbn:"9788983711892",title:"코스모스",author:"칼 세이건",pub:"사이언스북스",total:719,cover:"https://image.aladin.co.kr/product/87/9/cover500/s412032094_1.jpg",fb:["#1A3A6E","#3A6FB0"],toc:[[1,"코스모스의 바닷가에서",1,54],[2,"우주 생명의 씨앗",55,108],[3,"지상과 천상의 조화",109,162],[4,"천국과 지옥",163,212],[5,"붉은 행성을 위한 블루스",213,262],[6,"여행자의 이야기",263,316],[7,"밤하늘의 등뼈",317,368],[8,"시간과 공간을 가르는 여행",369,428],[9,"별들의 삶과 죽음",429,484],[10,"영원의 벼랑 끝",485,540],[11,"미래로 가는 편지",541,592],[12,"은하 대백과사전",593,656],[13,"누가 우리 지구를 대변하는가",657,719]]},
  {id:"b008",isbn:"9788937460449",title:"데미안",author:"헤르만 헤세",pub:"민음사",total:248,cover:"https://image.aladin.co.kr/product/26/0/cover500/s742633278_2.jpg",fb:["#3A2E22","#7A5A38"],toc:[[1,"두 세계",1,24],[2,"카인",25,50],[3,"강도",51,76],[4,"베아트리체",77,100],[5,"새는 알에서 나오려고 투쟁한다",101,126],[6,"야콥 크노아워",127,150],[7,"에바 부인",151,176],[8,"최후",177,248]]},
  {id:"b010",isbn:"9788937460777",title:"1984",author:"조지 오웰",pub:"민음사",total:452,cover:"https://image.aladin.co.kr/product/41/89/cover500/s122531356_2.jpg",fb:["#C82F2F","#7E1A1A"],toc:[[1,"본문",1,452]]},
  {id:"b104",isbn:"9788937460043",title:"변신, 시골의사",author:"프란츠 카프카",pub:"민음사",total:288,cover:"https://image.aladin.co.kr/product/6/4/cover500/s972932230_1.jpg",fb:["#2A3F4F","#5A7388"],toc:[[1,"본문",1,288]]},
  {id:"b105",isbn:"9788937460050",title:"동물농장",author:"조지 오웰",pub:"민음사",total:184,cover:"https://image.aladin.co.kr/product/4/6/cover500/s93746005x_3.jpg",fb:["#E8B473","#A87844"],toc:[[1,"본문",1,184]]},
  {id:"b037",isbn:"9788937460471",title:"호밀밭의 파수꾼",author:"제롬 데이비드 샐린저",pub:"민음사",total:320,cover:"https://image.aladin.co.kr/product/30882/22/cover500/8937460475_2.jpg",fb:["#E8A53B","#B5722E"],toc:[[1,"본문",1,320]]},
  {id:"b093",isbn:"9788937460753",title:"위대한 개츠비",author:"프랜시스 스콧 피츠제럴드",pub:"민음사",total:308,cover:"https://image.aladin.co.kr/product/41/79/cover500/s582934787_1.jpg",fb:["#0B1F4D","#1E3A6F"],toc:[[1,"본문",1,308]]},
  {id:"b103",isbn:"9788937460036",title:"햄릿",author:"윌리엄 셰익스피어",pub:"민음사",total:248,cover:"https://image.aladin.co.kr/product/16/80/cover500/s962932230_1.jpg",fb:["#3A2E55","#6E5398"],toc:[[1,"본문",1,248]]},
  {id:"b325",isbn:"9788937443848",title:"이방인",author:"알베르 카뮈",pub:"민음사",total:280,cover:"https://image.aladin.co.kr/product/21224/66/cover500/8937443848_1.jpg",fb:["#E8E1C7","#B8AC7E"],toc:[[1,"본문",1,280]]},
  {id:"b337",isbn:"9788937462788",title:"노인과 바다",author:"어니스트 헤밍웨이",pub:"민음사",total:204,cover:"https://image.aladin.co.kr/product/1452/24/cover500/8937462788_3.jpg",fb:["#1E5C7B","#2F8AB5"],toc:[[1,"본문",1,204]]},
  {id:"b172",isbn:"9788937460883",title:"오만과 편견",author:"제인 오스틴",pub:"민음사",total:560,cover:"https://image.aladin.co.kr/product/43/68/cover500/s937460882_1.jpg",fb:["#8C2E48","#C45A77"],toc:[[1,"본문",1,560]]},
];

const BOOK_BY_ID = Object.fromEntries(RG_BOOKS.map(b => [b.id, b]));
function getBook(id){ return BOOK_BY_ID[id] || RG_BOOKS[0]; }

const INITIAL_PROGRESS = {
  "b008": { cur: 102, days: 12 },
  "b105": { cur: 88,  days: 5  },
  "b337": { cur: 64,  days: 3  },
  "b001": { cur: 21,  days: 8  },
};

// 검증 가능한 출처가 없는 합성 NPC 인용문은 제공하지 않는다(#1431).

// 신규 게스트 = 빈 시작 (#1136, 출시 결정) — 구 데모 시드(데미안 102p·스트릭 12·XP 340·문장 2)는
// Phase 0 시연용이었다. 스토어 유입이 "남의 기록"을 첫 화면에서 만나면 신뢰를 깎고, 빈 상태는
// 이제 약속+기능 예고 카드(#1134)라 휑하지 않다. book 은 Supabase 무책 하이드레이션과 동일한
// 빈 센티널({id:'', _empty:true}) — 홈 빈 상태 가드(!book.id)·effect deps 접근이 그대로 안전.
const INITIAL_STATE = {
  book: { id: '', title: '', author: '', pub: '', cur: 0, total: 0, days: 1, cover: '', fb: ['#9AA7B2', '#C7D0D8'], toc: [], _empty: true },
  streak: 0,
  myQuotes: [],
};

/* ── 완독 기록 (책장) ─────────────────────────── */
// 신규 게스트 = 빈 시작 (#1136) — 구 데모 완독 2권(b105·b037) 제거. 소비처(datastore._seed)는 빈 객체 가드 유지.
const INITIAL_BOOKSHELF = {};

/* ── 찜 목록 (읽고 싶은 책) ──────────────────────── */
// 신규 게스트 = 빈 시작 (#1136) — 구 데모 찜 3권 제거.
const WISHLIST = [];

/* ── TSV 책 로더 ──────────────────────────────────── */
// 표지 그라데이션 팔레트 (TSV에 fb 없으므로 book_id 해시로 선택)
const _FB_PALETTE = [
  ['#F4D9A8','#E8B473'],['#1A3A6E','#3A6FB0'],['#3A2E22','#7A5A38'],
  ['#C82F2F','#7E1A1A'],['#2A3F4F','#5A7388'],['#E8B473','#A87844'],
  ['#E8A53B','#B5722E'],['#0B1F4D','#1E3A6F'],['#3A2E55','#6E5398'],
  ['#E8E1C7','#B8AC7E'],['#1E5C7B','#2F8AB5'],['#8C2E48','#C45A77'],
  ['#4A6741','#2D4A2A'],['#6B3A2A','#9E5C42'],['#2A4A6B','#4A7A9B'],
  ['#5A3A6B','#8B6B9B'],['#6B5A2A','#9B8542'],['#3A6B5A','#5A9B8B'],
];
function _fbForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return _FB_PALETTE[h % _FB_PALETTE.length];
}

// 인라인 12권의 fb/toc 오버라이드 맵 (id 기준)
const _SEED_META = Object.fromEntries(RG_BOOKS.map(b => [b.id, { fb: b.fb, toc: b.toc }]));
// #490(A): isbn13 매칭 — Supabase 책(uuid id)에도 인라인 12권의 fb/toc 시드를 isbn 으로 잇는다.
const _SEED_META_BY_ISBN = Object.fromEntries(RG_BOOKS.filter(b => b.isbn).map(b => [b.isbn, { fb: b.fb, toc: b.toc }]));

let _booksCache = null;

// 책 인덱스 — id + isbn13 양쪽 키로 BOOK_BY_ID 채움 (#490 A: isbn13 매칭으로 b001↔uuid 동일시).
function _indexBooks(list) {
  (list || []).forEach((b) => {
    if (b.id) window.BOOK_BY_ID[b.id] = b;
    if (b.isbn) window.BOOK_BY_ID[b.isbn] = b;
  });
}
// Supabase books 행 → data.js book 형태. fb/toc 는 isbn 시드(없으면 기본).
function _mapDbBook(b) {
  const id = String(b.id || '');
  const isbn = String(b.isbn13 || b.isbn || '').trim();
  const seed = _SEED_META[id] || (isbn ? _SEED_META_BY_ISBN[isbn] : null);
  return {
    id,
    isbn,
    title: (b.title || '').trim(),
    author: (b.author || '').trim(),
    pub: (b.publisher || '').trim(),
    total: parseInt(b.total_pages, 10) || 0,
    cover: (b.cover_url || '').trim(),
    description: (b.description || '').trim(),
    fb: seed ? seed.fb : _fbForId(id),
    toc: seed ? seed.toc : [],
  };
}

async function loadBooks() {
  if (_booksCache) return _booksCache;
  // #490: Supabase `books` 가 canonical. 게스트도 publishable key + anon RLS read 로 같은 카탈로그.
  // 책 식별은 isbn13 매칭(id 체계 b001↔uuid 무관). 실패/빈/미설정 → 인라인 RG_BOOKS(12) 최소 폴백(데모 무중단).
  try {
    const sb = (window.RG_SB && window.RG_SB.client) ? window.RG_SB.client() : null;
    if (sb) {
      const { data, error } = await sb.from('books')
        .select('id,isbn13,title,author,publisher,total_pages,cover_url,description')
        .limit(2000);
      if (!error && Array.isArray(data) && data.length) {
        _booksCache = data.map(_mapDbBook).filter(b => b.id && b.title);
        _indexBooks(_booksCache);
        return _booksCache;
      }
    }
  } catch (e) {
    console.warn('[ReadingGo] Supabase books 로드 실패, 인라인 폴백:', e && e.message);
  }
  // 최소 폴백: 인라인 RG_BOOKS(12) — Supabase 미설정/장애 시 데모 무중단용.
  // (구 정적 books.tsv 폴백은 #490 완료로 제거 — 과도기 잔재이자 stale(542≠canonical) 드리프트 원인. #972)
  _booksCache = RG_BOOKS;
  _indexBooks(_booksCache);
  return _booksCache;
}

function fuzzySearch(books, query) {
  if (!query || !query.trim()) return books;
  // 토큰 기반(#1118) — 질의를 단어로 쪼개, 모든 토큰이 제목+저자+출판사 합본에 들어가면 매칭.
  // 구버전은 질의 전체를 한 필드에 substring 검사해 "민음사 시지프 신화"(출판사+제목)를 0건으로
  // 떨궜다(title="시지프 신화"·pub="민음사" 분리). 합본 + 토큰 AND 로 필드를 가로지르는 질의도 잡는다.
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return books.filter(b => {
    const hay = (b.title + ' ' + b.author + ' ' + b.pub).toLowerCase();
    return tokens.every(t => hay.includes(t));
  });
}

// 검색/폴백용 ALL_BOOKS: 인라인 RG_BOOKS(12)를 평탄 row 형식으로 변환
const ALL_BOOKS = RG_BOOKS.map(b => ({
  book_id: b.id,
  isbn: b.isbn,
  title: b.title,
  author: b.author,
  publisher: b.pub,
  total_pages: b.total,
  cover_url: b.cover,
}));

// ── 관련 도서 추천 (#496) ─────────────────────────────
// worker /api/related(LLM)가 {isbn, title, author} 후보를 주면, LLM이 준 ISBN을 신뢰하지 않고
// 실존 books DB의 ISBN과 정확 일치(+ 정규화 제목 일치)일 때만 실제 책 객체를 돌려준다(ISBN 환각 필터).
// 결과는 책 단위 메모리 캐시. Phase 0은 LLM 추천 기반. Supabase '함께 읽은 사람들' 집계는 Phase 1 (#496 결정).
const _relatedCache = {};
// ISBN-13 정규화 — 숫자만 남겨 정확히 13자리일 때만 반환, 아니면 '' (누락·형식 오류는 빈 문자열).
function normalizeIsbn13(s) {
  const d = String(s == null ? '' : s).replace(/[^0-9]/g, '');
  return d.length === 13 ? d : '';
}
function _normTitle(t) {
  return String(t || '').toLowerCase().replace(/[\s·,.:;!?'"“”‘’()\[\]<>「」『』、~\-_]/g, '').trim();
}
// 정규화 제목 완전 일치(부분/prefix 아님). ISBN이 정확히 일치한 DB 책의 제목이 후보 제목과 같은지 확인.
function _titleEq(a, b) {
  const x = _normTitle(a), y = _normTitle(b);
  return !!x && x === y;
}
// ISBN 환각 필터 (순수 함수 — 테스트 가능). LLM 후보 {isbn,title,author} 중 다음만 통과:
//  · ISBN-13 형식이 유효하고  · 현재 책 ISBN이 아니며  · 중복 ISBN이 아니고
//  · DB에 그 ISBN이 실재하며  · DB 책의 정규화 제목이 후보 제목과 일치.
// 반환은 매칭된 실제 DB 책 객체 배열. 제목 prefix/부분 매칭은 환각 필터로 쓰지 않는다.
function filterRelatedCandidates(candidates, dbBooks, selfIsbn, limit = 6) {
  const self = normalizeIsbn13(selfIsbn);
  const byIsbn = new Map();
  for (const b of (dbBooks || [])) {
    const bi = normalizeIsbn13(b && b.isbn);
    if (bi && !byIsbn.has(bi)) byIsbn.set(bi, b);
  }
  const out = [];
  const used = new Set();
  for (const c of (candidates || [])) {
    if (!c || typeof c !== 'object') continue;
    const ci = normalizeIsbn13(c.isbn);
    if (!ci) continue;                            // ISBN 누락/형식 오류
    if (self && ci === self) continue;            // 현재 책과 동일 ISBN
    if (used.has(ci)) continue;                   // 중복 ISBN
    const db = byIsbn.get(ci);
    if (!db) continue;                            // DB 미존재(지어낸 ISBN)
    if (!_titleEq(db.title, c.title)) continue;   // ISBN-제목 불일치
    used.add(ci);
    out.push(db);
    if (out.length >= limit) break;
  }
  return out;
}
async function recommendRelated(book, limit = 6) {
  if (!book || !book.title) return [];
  const ck = book.id || book.isbn || book.title;
  if (_relatedCache[ck]) return _relatedCache[ck];
  let suggestions = [];
  try {
    const res = await window.RG_apiFetch('/api/related', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: book.title, author: book.author || '', isbn: book.isbn || '' }),
    });
    if (res.ok) { const d = await res.json(); suggestions = (d && d.books) || []; }
  } catch (e) { suggestions = []; }
  if (!suggestions.length) { _relatedCache[ck] = []; return []; }
  // ISBN 환각 필터 — 실존 books DB의 ISBN과 정확 일치(+제목 일치) 시만 통과.
  const all = await loadBooks();
  const out = filterRelatedCandidates(suggestions, all, book.isbn, limit);
  _relatedCache[ck] = out;
  return out;
}

// ── 완독 후 AI: 다음 책 추천 + 추출 책 (§5.8.6, #946) ───────────────
// Phase 0 = 하드코딩 시뮬(실 LLM 호출 없음 — Gemini 는 별도 스코프). 저장소 무관 로직이라
// 두 어댑터(datastore.js / datastore-supabase.js)가 이 헬퍼에 위임해 표면(shape)을 일치시킨다.
// Phase 1+ 는 backend.md §7.9 의 Gemini Flash 프록시로 교체 예정(빈 매칭 시 폴백 자리 동일).

// "카테고리별 하드코딩 추천 3권" — 책 정보(제목·표지·ISBN)는 하드코딩하지 않고(CLAUDE.md 룰)
// 시드 books DB 의 **id 리스트만** 큐레이션하고, 실 책 객체는 getBook(id) 으로 해소한다.
// 키 = 완독 책 id, 값 = 다음 추천 id 3개 + 한 줄 이유(나↔책 fit, 친구 매칭 아님 §5.8.6).
const NEXT_BOOK_PICKS = {
  // 교양·과학 — 사피엔스 / 코스모스
  b001: [['b002', '인류사 다음은 우주의 스케일로 — 같은 ‘큰 그림’ 독서'], ['b010', '문명을 통찰했다면 그 그림자(전체주의)도'], ['b008', '거대 서사 뒤, 한 개인의 자아 찾기로 호흡 전환']],
  b002: [['b001', '우주를 봤다면 그 안의 인류사로 — 스케일 잇기'], ['b010', '과학적 사고 다음, 과학이 통제로 쓰일 때'], ['b337', '광활함 뒤의 단단한 의지 한 편']],
  // 고전소설 — 데미안 / 이방인 / 위대한 개츠비 / 호밀밭
  b008: [['b325', '자아를 찾았다면 부조리 앞의 실존으로'], ['b037', '성장통의 또 다른 목소리 — 방황하는 청춘'], ['b093', '내면 성장 다음, 욕망과 환멸의 미국']],
  b325: [['b008', '부조리 다음, 알을 깨는 자기 탐구로'], ['b103', '실존의 질문을 비극의 언어로'], ['b337', '무의미 속에서도 끝까지 — 의지의 드라마']],
  b093: [['b037', '환멸의 미국, 그 청춘의 시선으로 이어 읽기'], ['b008', '욕망을 봤다면 자아의 성장으로'], ['b325', '아메리칸드림의 균열을 부조리로 확장']],
  b037: [['b008', '방황하는 청춘 다음, 자아를 깨는 성장담'], ['b093', '환멸의 정서를 미국 재즈시대로'], ['b325', '소외감을 실존의 부조리로 밀어붙이기']],
  // 디스토피아·정치 — 1984 / 동물농장
  b010: [['b105', '전체주의를 우화로 다시 — 권력의 부패'], ['b001', '감시사회 너머, 인류는 어떻게 여기 왔나'], ['b325', '체제에 짓눌린 개인의 실존']],
  b105: [['b010', '우화 다음, 감시국가의 정면 묘사'], ['b001', '권력의 메커니즘을 인류사의 스케일로'], ['b103', '배신과 권력욕을 비극의 무대로']],
};
// 기본 폴백 — 매핑에 없는 책(또는 시드 외 임포트 책)이면 보편 명작 3권.
const NEXT_BOOK_DEFAULT = [
  ['b008', '내면의 성장을 그린 헤세의 대표작'],
  ['b001', '세상을 보는 눈을 넓히는 인류사 교양서'],
  ['b093', '욕망과 환멸을 그린 20세기 고전'],
];
// 다음 책 추천 (§5.8.6 ①). 반환 shape: [{ id, title, author, cover, isbn, reason }] (최대 3).
// 자기 자신은 제외하고, getBook 으로 실 책을 해소(없으면 스킵). Promise 로 어댑터 표면(async) 일치.
function recommendNextBooks(book) {
  const selfId = (book && book.id) || '';
  const picks = (NEXT_BOOK_PICKS[selfId] || NEXT_BOOK_DEFAULT).filter(([id]) => id !== selfId);
  const get = (typeof window !== 'undefined' && window.getBook) ? window.getBook : null;
  const out = [];
  const seen = new Set();
  for (const [id, reason] of picks) {
    if (seen.has(id)) continue;
    const b = get ? get(id) : null;
    if (!b || !b.id || b.id === selfId) continue;   // getBook 폴백(RG_BOOKS[0]) 자기참조 가드
    seen.add(id);
    out.push({ id: b.id, title: b.title, author: b.author, cover: b.cover, isbn: b.isbn, reason });
    if (out.length >= 3) break;
  }
  return Promise.resolve(out);
}

// 추출 책 (§5.8.6 ②) — Phase 0 = '한 문장 나열 + 고정 카피 시뮬'.
// 입력: 그 책에서 내가 남긴 한 문장 배열([{text, page}]). 출력 shape:
//   { topics:[s1,s2,s3], topQuote:{text,page}, summary, quotes:[{text,page}] }
// 한 문장이 하나도 없으면 null(카드 미노출). 실 LLM 분석은 Phase 1+(§7.9).
const EXTRACT_TOPICS = ['기억에 남은 장면', '곱씹게 되는 문장', '나에게 남긴 질문'];
function extractBookSummary(book, quotes) {
  const list = (quotes || [])
    .map((q) => ({ text: (q && q.text ? String(q.text) : '').trim(), page: (q && typeof q.page === 'number') ? q.page : null }))
    .filter((q) => q.text);
  if (!list.length) return Promise.resolve(null);
  // '가장 인상 깊었던 한 문장' — Phase 0 휴리스틱: 가장 긴 문장(없으면 첫 문장).
  const topQuote = list.reduce((a, b) => (b.text.length > a.text.length ? b : a), list[0]);
  const title = (book && book.title) || '이 책';
  const summary = `${title}을(를) 읽으며 ${list.length}개의 문장을 남겼어요. 그 문장들이 모여 나만의 추출 책이 됩니다.`;
  return Promise.resolve({
    topics: EXTRACT_TOPICS.slice(),
    topQuote: { text: topQuote.text, page: topQuote.page },
    summary,
    quotes: list,
  });
}

/* 공유 OCR 헬퍼 (#939) — 책 사진 한 장 → worker /api/ocr(Upstage Document OCR + solar-pro3 보정)
   → 한 문장 텍스트. 읽기모드 빠른입력(#498 home.js runOcrQuick)이 이 호출을 쓴다(인라인 중복 구현 금지).
   반환: { text } | { empty, code, stage } | { error, stage, status } (배타).
   호출측이 토스트·busy·tracking 을 담당하고 provider 원문은 보존하지 않는다. */
const OCR_MAX_BYTES = 8 * 1024 * 1024;   // 8MB — ocrProxy OCR_MAX_BYTES 와 동일
function ocrExtractSentence(file) {
  if (!file) return Promise.resolve({ text: '', error: 'ocr_image_missing', stage: 'request', status: 0 });
  if (file.size && file.size > OCR_MAX_BYTES) return Promise.resolve({ text: '', error: 'ocr_image_too_large', stage: 'request', status: 413 });
  const fd = new FormData();
  fd.append('document', file, file.name || 'page.jpg');
  return window.RG_apiFetch('/api/ocr', { method: 'POST', body: fd })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    .then(({ status, body: d }) => {
      // 검토 화면이 1,000자 초과를 직접 차단하고 원문을 보존한다(#1424).
      // 여기서 자르면 사용자가 초과 사실을 알거나 필요한 구간을 편집할 수 없다.
      if (d && d.text) return { text: String(d.text) };
      if (d && d.empty) return { text: '', empty: true, code: d.code || 'ocr_empty', stage: d.stage || 'result' };
      return { text: '', error: (d && d.code) || 'ocr_failed', stage: (d && d.stage) || 'request', status };
    })
    .catch(() => ({ text: '', error: 'ocr_network_failure', stage: 'network', status: 0 }));
}

// 책을 담을 때 쓰는 상태 선택의 정본. 사용자 여정·책장 순서와 같은
// 읽는 중 → 읽고 싶은 책 → 읽은 책 순서이며 저장 status 값은 그대로 유지한다.
const RG_SHELF_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: 'reading', label: '읽는 중', hint: '지금 읽는 책으로' }),
  Object.freeze({ value: 'wish', label: '읽고 싶은 책', hint: '관심 책에 담아요' }),
  Object.freeze({ value: 'completed', label: '읽은 책', hint: '완독으로 담아요' }),
]);

window.RG_BOOKS=RG_BOOKS; window.BOOK_BY_ID=BOOK_BY_ID; window.getBook=getBook;
window.INITIAL_PROGRESS=INITIAL_PROGRESS;
window.INITIAL_STATE=INITIAL_STATE;
window.INITIAL_BOOKSHELF=INITIAL_BOOKSHELF; window.WISHLIST=WISHLIST;
window.ALL_BOOKS=ALL_BOOKS;
window.loadBooks=loadBooks; window.fuzzySearch=fuzzySearch; window.recommendRelated=recommendRelated;
window.recommendNextBooks=recommendNextBooks; window.extractBookSummary=extractBookSummary;
window.ocrExtractSentence=ocrExtractSentence;
window.normalizeIsbn13=normalizeIsbn13; window.filterRelatedCandidates=filterRelatedCandidates;
window.RG_SHELF_STATUS_OPTIONS=RG_SHELF_STATUS_OPTIONS;
