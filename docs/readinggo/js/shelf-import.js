/* =========================================================
   ReadingGo — shelf-import.js  (#772 통합 서가 ① 스샷 서가 복원 · #1038 고도화)
   ShelfImportModal: 구매내역/서재 캡쳐 업로드 → /api/shelf-import(비전 OCR) →
   카탈로그 매칭(loadBooks·랭크매칭) → 검수(목적지 토글·알라딘 보강) →
   DataStore.importStaging.add 로 **검토함 적재**(#1048: 책장 직행 아님 — 로그인 게이트 + 서재 검토함서 확인 후 이동).
   components 이후 로드. window 전역(showToast·DataStore·loadBooks)은 bare/window로 호출.

   #1038 고도화:
   - 목적지 토글: 읽은 책(기본)/읽고싶어요/읽는 중 → 그 status로 등록(구 'completed' 고정 해제).
   - 게스트 패리티: 카탈로그 book(cover/total/isbn)을 어댑터 표면(cover_url/total_pages/isbn13)으로
     정규화해 넘김 → 게스트도 표지·쪽수·ISBN 보존(구: undefined로 소실).
   - 알라딘 보강: 카탈로그 밖 미매칭 책을 /aladin 검색으로 표지·쪽수·ISBN 채움(자동 1차 + "찾기" 버튼).
   - 랭크 매칭: 무순위 hits[0] → 제목 정확도 랭킹으로 오매칭↓.
   - 핵심 로직은 window.RG_shelfImport 로 추출(매핑·매칭·보강 재사용 — #1039 유연 임포트가 재사용).

   #1042 비전 추출:
   - 워커가 비전(Gemini Flash)을 1순위로 써 표지 그리드(왓챠·밀리·교보 서재) 스샷에서 책을 직접 인식
     (텍스트 OCR이 0건 추락하는 케이스). 응답에 별점(rating)이 함께 오면 검수 카드에 ★ 표시 + 등록 시 보존.
   - 업로드/검수 흐름은 동일 — rating 한 필드만 추가로 흐른다(matchRows → rows.rating → addBatch item.rating).

   #1045 큰 이미지 타일링(추출 앞단만 교체):
   - 긴 서재 스샷은 한 장 호출이면 책을 소수만 잡힘(실측 1권) → 클라 canvas 로 세로 ~1800px 조각·~250px
     겹침으로 잘라 각 조각을 순차+지연으로 /api/shelf-import 호출 → 병합·dedup(실측 35권). 진행 표시 N/M.
   - 작은 이미지(모바일 한 화면)는 타일링 없이 단일 호출(현행 보존). 핵심은 RG_shelfImport.extractBooks.
   ========================================================= */

const { useState } = React;

/* ── 재사용 코어 (window.RG_shelfImport) ───────────────────
   매핑·매칭·알라딘 보강을 UI 와 분리해 순수/재사용 가능하게 둔다(#1038 결정 — #1039 재사용).
   - normalizeCatalogBook: 카탈로그 book(data.js: cover/total/isbn) → 어댑터 표면(cover_url/total_pages/isbn13).
   - rankMatch: fuzzySearch 후보를 제목 정확도로 랭크 → 최적 1건(보수 가드 유지: 양방향 포함만 채택).
   - aladinLookup: /aladin 검색으로 미매칭 책 메타(표지·쪽수·ISBN) 보강. */
const RG_shelfImport = (function () {
  function _norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

  // 카탈로그 book(loadBooks/_mapDbBook 산출: {id,isbn,title,author,pub,total,cover})을
  // 어댑터(add/addBatch)가 기대하는 표면({cover_url,total_pages,isbn13,publisher})으로 정규화.
  // 양 어댑터 모두 이 표면을 읽으므로 게스트·로그인 패리티가 맞는다([P1-2]).
  // 이미 어댑터 표면이면(cover_url 등 존재) 그대로 보존(중복 매핑 안전).
  function normalizeCatalogBook(b) {
    if (!b) return null;
    return {
      id: b.id || '',
      title: (b.title || '').trim(),
      author: (b.author || '').trim(),
      publisher: b.publisher || b.pub || '',
      total_pages: b.total_pages || b.total || 0,
      cover_url: b.cover_url || b.cover || '',
      isbn13: b.isbn13 || b.isbn || '',
    };
  }

  // 추출 제목(q)에 대해 카탈로그 후보들을 제목 정확도로 랭크해 최적 1건 반환(없으면 null).
  // 점수: 완전일치 > prefix > 짧은 길이차(포함관계). 보수 가드(양방향 정규화 포함)는 유지 —
  // 동명/포함관계 오매칭을 줄이되, 갖다붙이기(가드 실패)는 여전히 미확인으로 떨어뜨린다([P2-1]).
  function rankMatch(catalog, q, author) {
    const qn = _norm(q);
    if (!qn || !Array.isArray(catalog) || !catalog.length) return null;
    let hits = [];
    try {
      hits = (window.fuzzySearch ? window.fuzzySearch(catalog, q) : []) || [];
    } catch (e) { hits = []; }
    const an = _norm(author);
    let best = null, bestScore = -Infinity;
    for (const c of hits) {
      const cn = _norm(c.title);
      if (!cn) continue;
      // 보수 가드: 제목이 양방향 포함 관계일 때만 후보(환각 표지 방지 — 기존 가드 유지).
      if (!(cn === qn || cn.includes(qn) || qn.includes(cn))) continue;
      let score = 0;
      if (cn === qn) score += 100;                 // 완전 일치 최우선
      else if (cn.startsWith(qn) || qn.startsWith(cn)) score += 60; // prefix
      else score += 30;                            // 단순 포함
      // 길이차 페널티(짧을수록 가까움) — "1984" vs "1984 다이어리" 구분.
      score -= Math.abs(cn.length - qn.length);
      // 저자 일치 가산(있을 때만) — 동명 제목 타이브레이크.
      if (an && _norm(c.author) && _norm(c.author).includes(an)) score += 8;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // 미매칭 책을 알라딘 검색(worker /aladin → ItemSearch)으로 보강([P1-1]).
  // 반환: 어댑터 표면 book({title,author,publisher,total_pages,cover_url,isbn13}) | null.
  // graceful: 프록시 미배포·실패·0건이면 null(호출부가 기존 텍스트 등록으로 폴백).
  // 워커가 결과를 Supabase books 에 비파괴 upsert 하므로(#489) 카탈로그도 점진적으로 채워진다.
  async function aladinLookup(title, author) {
    const q = String(title || '').trim();
    if (!q) return null;
    const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
    if (!proxy) return null;
    try {
      // 제목+저자로 좁혀 오검색↓(저자 없으면 제목만).
      const query = author ? `${q} ${author}` : q;
      const r = await fetch(`${proxy}?query=${encodeURIComponent(query)}`);
      if (!r.ok) return null;
      const d = await r.json();
      const items = (d && Array.isArray(d.items)) ? d.items : [];
      if (!items.length) return null;
      // 제목 정확도로 알라딘 결과도 랭크(엉뚱한 1위 방지) — rankMatch 재사용. 없으면 1위 폴백.
      const it = rankMatch(items, q, author) || items[0];
      if (!it || !it.title) return null;
      return {
        title: it.title, author: it.author || author || '',
        publisher: it.publisher || '', total_pages: it.total_pages || 0,
        cover_url: it.cover_url || '', isbn13: it.isbn13 || '',
      };
    } catch (e) { return null; }
  }

  // 추출 결과(books)를 카탈로그와 매칭 — 행 배열 생성. UI 가 호출.
  // 행: {title, author, rating, book|null, checked, source}. source: 'catalog'(매칭)|'' (미확인).
  // rating(#1042): 비전 추출이 별점을 주면 0.5~5.0 숫자로 보존(없으면 null) → 검수 표시·등록 보존.
  async function matchRows(books) {
    let catalog = [];
    try { catalog = (await (window.loadBooks ? window.loadBooks() : [])) || []; } catch (e) { catalog = []; }
    return (books || []).map((b) => {
      const hit = rankMatch(catalog, b.title, b.author);
      const book = hit ? normalizeCatalogBook(hit) : null;
      const rn = Number(b && b.rating);
      const rating = (Number.isFinite(rn) && rn > 0) ? Math.min(5, Math.max(0.5, rn)) : null;
      return {
        title: b.title,
        author: b.author || (book && book.author) || '',
        rating,
        book,
        checked: true,
        source: book ? 'catalog' : '',
      };
    });
  }

  /* ── #1045 큰 이미지 클라(canvas) 타일링 ──────────────────────
     긴 서재 스샷(왓챠 풀페이지·여러 화면 이어붙인 캡쳐)을 한 장으로 비전 호출하면 책을 소수만
     잡는다(실측: 풀이미지 1권 vs 타일링 35권 — Gemini가 큰 그리드의 일부만 읽음). 가로 폭은 그대로,
     세로를 ~1800px 조각으로 잘라(경계서 잘린 책을 다음 조각이 통째로 잡게 ~250px 겹침) 각 조각을
     순차로 /api/shelf-import 에 보낸다(Gemini 무료티어 rate limit 대응 — 조각 간 지연, #844 배치 OCR
     순차+지연 패턴 차용). 결과는 정규화 제목으로 dedup(겹침 중복 제거)하고 UI 잡음을 블랙리스트로 건다.
     작은 이미지(모바일 한 화면)는 타일링 없이 원본 그대로 단일 호출 — 현행 동작·화질 보존. */
  const TILE_TRIGGER_HEIGHT = 2200;  // 이 높이(px) 초과면 타일링(아래 비율 트리거와 OR)
  const TILE_TRIGGER_RATIO = 2.3;    // 세로/가로 비율이 길면(여러 화면 이어붙인 캡쳐) 타일링
  const TILE_HEIGHT = 1800;          // 조각 세로(px)
  const TILE_OVERLAP = 250;          // 조각 간 겹침(px) — 경계 책 보존(필수)
  const TILE_DELAY_MS = 1800;        // 조각 간 지연(무료티어 rate limit, 1.5~3s 범위)
  const TILE_MAX = 12;               // 조각 수 안전 상한(폭주 방지)

  // 알려진 UI 문구 — 추출에 가끔 버튼/탭/메뉴 텍스트가 섞인다(예: "오늘부터 독서시작").
  // 정규화(소문자·공백제거) 완전일치만 거른다 — 부분일치는 실제 제목 오삭제 위험이라 피함.
  // 못 거른 잡음은 검수 단계에서 유저가 체크 해제(무중단).
  const UI_NOISE = new Set([
    '오늘부터독서시작', '독서시작', '내서재', '전체보기', '더보기',
    '구매내역', '주문내역', '장바구니', '담기', '로그인', '회원가입',
    '카테고리', '베스트셀러', '바로구매',
  ]);

  function _sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

  // 업로드 파일(또는 조각 Blob)을 /api/shelf-import 로 POST. {ok,status,data} 반환(파싱 실패→data null).
  async function _postImage(blob, filename) {
    const fd = new FormData();
    fd.append('document', blob, filename);
    const r = await fetch('/api/shelf-import', { method: 'POST', body: fd });
    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }
    return { ok: r.ok, status: r.status, data };
  }

  // 파일 → 이미지 디코드. {img,width,height,cleanup} 반환(cleanup 으로 objectURL 해제).
  function _loadImage(file) {
    return new Promise((resolve, reject) => {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      const revoke = () => { try { URL.revokeObjectURL(objUrl); } catch (e) { /* noop */ } };
      img.onload = () => resolve({
        img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: revoke,
      });
      img.onerror = () => { revoke(); reject(new Error('image decode failed')); };
      img.src = objUrl;
    });
  }

  // 이미지를 세로 ~TILE_HEIGHT 조각(가로 그대로, ~TILE_OVERLAP 겹침)으로 잘라 jpeg Blob 배열로.
  // 마지막 조각은 바닥까지 덮고(겹침 보장), 안전 상한(TILE_MAX)을 넘지 않는다.
  function sliceToBlobs(img, w, h) {
    const step = Math.max(1, TILE_HEIGHT - TILE_OVERLAP);
    const slices = [];
    for (let y = 0; y < h; y += step) {
      const sliceH = Math.min(TILE_HEIGHT, h - y);
      slices.push({ y, sliceH });
      if (y + sliceH >= h || slices.length >= TILE_MAX) break;
    }
    return Promise.all(slices.map(({ y, sliceH }) => new Promise((resolve) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = sliceH;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, y, w, sliceH, 0, 0, w, sliceH);
      cv.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    }))).then((bs) => bs.filter(Boolean));
  }

  // 조각별 books 를 합쳐 정규화 제목으로 dedup + UI 잡음 제거. author·rating 은 채워진 쪽 우선.
  function dedupeBooks(books) {
    const byKey = new Map(), out = [];
    for (const b of (books || [])) {
      const title = String((b && b.title) || '').trim();
      const key = _norm(title);
      if (!title || !key || UI_NOISE.has(key)) continue;   // 빈 제목·UI 잡음 제외
      const rn = Number(b && b.rating);
      const rating = (Number.isFinite(rn) && rn > 0) ? rn : null;
      const author = String((b && b.author) || '').trim();
      if (byKey.has(key)) {
        const ex = byKey.get(key);                          // 겹침 중복 — 빈 필드만 보강
        if (!ex.author && author) ex.author = author;
        if (!(ex.rating > 0) && rating) ex.rating = rating;
        continue;
      }
      const row = { title, author };
      if (rating) row.rating = rating;
      byKey.set(key, row);
      out.push(row);
    }
    return out;
  }

  // 단일 응답(data) → { books, empty?, demo? }. 단일 호출 경로 2곳(폴백·작은 이미지) 공용.
  function _fromResponse(data) {
    if (data && data.demo) return { demo: true };
    const books = (data && Array.isArray(data.books)) ? data.books : [];
    return { books: dedupeBooks(books), empty: !books.length && !!(data && data.empty) };
  }

  // 업로드 이미지 → 책 목록 추출. 큰/긴 이미지는 클라 타일링(순차+지연+병합), 작으면 단일 호출.
  // 반환: { books, empty?, demo? }. demo=true 면 워커 미설정(데모) — 호출부가 안내한다.
  // onProgress(done,total): 진행 표시("책 찾는 중… N/M 조각"). 단일 호출은 total=1.
  async function extractBooks(file, opts) {
    const onProgress = (opts && opts.onProgress) || function () { /* noop */ };
    let loaded = null;
    try { loaded = await _loadImage(file); } catch (e) { loaded = null; }
    // 디코드 실패(희귀) → 원본 그대로 단일 호출 폴백.
    if (!loaded) {
      onProgress(0, 1);
      const { data } = await _postImage(file, file.name || 'shelf.jpg');
      onProgress(1, 1);
      return _fromResponse(data);
    }
    const { img, width, height, cleanup } = loaded;
    const isBig = height > TILE_TRIGGER_HEIGHT || (width > 0 && height / width >= TILE_TRIGGER_RATIO);
    try {
      // 작은 이미지(모바일 한 화면) — 현행대로 원본 그대로 단일 호출(재인코딩 없음).
      if (!isBig) {
        onProgress(0, 1);
        const { data } = await _postImage(file, file.name || 'shelf.jpg');
        onProgress(1, 1);
        return _fromResponse(data);
      }
      // 큰/긴 이미지 — 세로 타일 분할 → 순차 호출(+지연) → 병합.
      const tiles = await sliceToBlobs(img, width, height);
      const total = tiles.length || 1;
      const all = [];
      let demo = false;
      for (let i = 0; i < tiles.length; i++) {
        onProgress(i, total);
        try {
          const { data } = await _postImage(tiles[i], 'tile-' + i + '.jpg');
          if (data && data.demo) { demo = true; break; }    // 워커 미설정 — 즉시 중단
          if (data && Array.isArray(data.books)) all.push(...data.books);
        } catch (e) { /* 이 조각 실패 — 부분 병합 계속 */ }
        onProgress(i + 1, total);
        if (i < tiles.length - 1) await _sleep(TILE_DELAY_MS);
      }
      if (demo) return { demo: true };
      const books = dedupeBooks(all);
      return { books, empty: books.length === 0 };
    } finally {
      cleanup();
    }
  }

  return { normalizeCatalogBook, rankMatch, aladinLookup, matchRows, extractBooks, dedupeBooks, sliceToBlobs };
})();
window.RG_shelfImport = RG_shelfImport;

// 목적지(등록 status) 옵션 — 일괄 토글 1개로 충분(책별은 후속, #1038 결정).
const SHELF_DESTS = [
  { value: 'completed', label: '읽은 책', hint: '다 읽은 책으로 추가' },
  { value: 'wish', label: '읽고싶어요', hint: '위시리스트로 추가' },
  { value: 'reading', label: '읽는 중', hint: '읽는 중으로 추가' },
];

function ShelfImportModal({ onClose }) {
  const [phase, setPhase] = useState('upload');   // upload | loading | review
  const [rows, setRows] = useState([]);           // [{title, author, rating, book|null, checked, source}]
  const [dest, setDest] = useState('completed');  // 목적지 토글(기본 '읽은 책')
  const [enriching, setEnriching] = useState(false); // 알라딘 보강 진행 표시
  const [progress, setProgress] = useState(null);  // 타일링 진행 {done,total} — 큰 이미지일 때만(#1045)
  const [err, setErr] = useState('');

  // 업로드 → 추출(#1045 타일링: 큰 이미지는 클라가 세로 조각으로 잘라 순차 호출·병합, 작으면 단일)
  // → 매칭 → 검수. 추출 오케스트레이션은 RG_shelfImport.extractBooks 가 담당(진행 콜백으로 N/M 표시).
  const onPick = async (file) => {
    if (!file) return;
    setErr('');
    if (file.size > 8 * 1024 * 1024) { setErr('이미지가 너무 커요 (최대 8MB)'); return; }
    setPhase('loading');
    setProgress(null);
    if (window.rgTrack) window.rgTrack('shelf_import_started', {});
    try {
      const out = await RG_shelfImport.extractBooks(file, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (out && out.demo) { setErr('데모 환경에선 서가 복원이 비활성이에요.'); setPhase('upload'); return; }
      const books = (out && Array.isArray(out.books)) ? out.books : [];
      if (!books.length) {
        setErr(out && out.empty ? '사진에서 글자를 못 찾았어요 — 더 또렷한 캡쳐로 다시 시도해요.' : '책을 찾지 못했어요 — 책 목록이 잘 보이는 캡쳐가 필요해요.');
        setPhase('upload');
        return;
      }
      const matched = await RG_shelfImport.matchRows(books);
      setRows(matched);
      setPhase('review');
      if (window.rgTrack) window.rgTrack('shelf_import_extracted', { count: matched.length });
      // 미매칭 책은 백그라운드로 알라딘 보강 시도([P1-1]) — 표지·쪽수·ISBN 자동 채움.
      autoEnrich(matched);
    } catch (e) {
      setErr('처리 중 문제가 생겼어요 — 잠시 후 다시 시도해요.'); setPhase('upload');
    }
  };

  // 미매칭 행을 알라딘으로 일괄 보강(자동). 찾으면 book 채우고 source='aladin'.
  // 동시 과다호출 방지: 순차 처리. 실패/0건은 미확인 유지(무중단).
  // 매칭 키는 안정적인 인덱스(원배열 위치) — 제목 편집 중 레이스를 피하려 위치로 병합.
  const autoEnrich = async (matched) => {
    const targets = [];
    (matched || []).forEach((r, idx) => { if (!r.book && (r.title || '').trim()) targets.push({ idx, r }); });
    if (!targets.length) return;
    setEnriching(true);
    for (const { idx, r } of targets) {
      let found = null;
      try { found = await RG_shelfImport.aladinLookup(r.title, r.author); } catch (e) { found = null; }
      if (found) {
        setRows((rs) => rs.map((row, j) => (j === idx && !row.book
          ? { ...row, book: found, author: row.author || found.author, source: 'aladin' } : row)));
      }
    }
    setEnriching(false);
  };

  // 단건 수동 보강("찾기" 버튼) — 자동이 못 찾은 책을 유저가 다시 시도(제목 편집 후 등).
  const enrichOne = async (i) => {
    const r = rows[i];
    if (!r) return;
    setRows((rs) => rs.map((x, j) => (j === i ? { ...x, _finding: true } : x)));
    let found = null;
    try { found = await RG_shelfImport.aladinLookup(r.title, r.author); } catch (e) { found = null; }
    setRows((rs) => rs.map((x, j) => (j === i
      ? { ...x, _finding: false, book: found || x.book, author: x.author || (found && found.author) || '', source: found ? 'aladin' : x.source }
      : x)));
  };

  const toggle = (i) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, checked: !r.checked } : r)));
  const edit = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  // 검수 "등록" → 책장 직행이 아니라 **검토함(import_staging)** 으로 적재(#1048). 사용자가 서재
  // "📦 가져온 책 · 검토"에서 한 번 더 보고 [내 서재로 이동]/[제외]. 비전 오인식·UI 잡음이 실계정
  // 책장에 바로 영속되지 않게 한다. dest(목적지 토글)는 suggested_status 로 보존(검토함서 항목별 변경 가능),
  // 별점(#1042)도 보존. 게스트는 RG_openShelfImport 게이트(app.js)로 차단돼 여기 도달하지 않음.
  const register = () => {
    const picked = rows.filter((r) => r.checked && (r.title || '').trim());
    if (!picked.length) { setErr('등록할 책을 한 권 이상 선택해요.'); return; }
    const DS = window.DataStore || {};
    if (!(DS.importStaging && DS.importStaging.add)) { setErr('검토함이 준비되지 않았어요.'); return; }
    // 매칭/보강된 책은 어댑터 표면 메타(정규화 완료), 미확인은 제목·저자만. status=목적지 토글값.
    const items = picked.map((r) => ({
      book: r.book ? r.book : { title: r.title.trim(), author: (r.author || '').trim() },
      status: dest,
      rating: (typeof r.rating === 'number' && r.rating > 0) ? r.rating : null,
    }));
    Promise.resolve(DS.importStaging.add(items))
      .then((res) => {
        const n = Array.isArray(res) ? res.length : 0;
        if (!n) { setErr('검토함에 담지 못했어요 — 다시 시도해요.'); return; }   // 로컬 no-op/실패도 여기로
        if (window.rgTrack) window.rgTrack('shelf_import_staged', { count: n, status: dest });
        try { window.dispatchEvent(new CustomEvent('rg:import-staged')); } catch (e) {}
        if (window.showToast) window.showToast(`📦 검토함에 ${n}권 담았어요 — 책장에서 검토하세요`);
        onClose();
      })
      .catch(() => { setErr('검토함 담기에 문제가 생겼어요 — 다시 시도해요.'); });
  };

  const checkedCount = rows.filter((r) => r.checked).length;
  const matchedCount = rows.filter((r) => r.book).length;
  const destLabel = (SHELF_DESTS.find((d) => d.value === dest) || {}).label || '읽은 책';
  // 별점 표시 문자열(#1042) — ★ 정수 + 반점(½)은 ⯨ 대신 0.5 텍스트로 간결히. 0/없음이면 '' .
  const fmtStars = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return '';
    const full = Math.floor(v);
    return '★'.repeat(full) + (v - full >= 0.5 ? '½' : '');
  };
  // 별점은 '읽은 책'/'읽는 중' 맥락에서만 의미(위시는 아직 안 읽음) — wish 목적지면 표시 숨김.
  const showRating = dest !== 'wish';

  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="스샷으로 서가 복원">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', top: 10, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', lineHeight: 1, zIndex: 2 }}>✕</button>
        <div style={{ padding: '8px 20px 20px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: '4px 0 6px', color: 'var(--ink)' }}>📸 스샷으로 서가 복원</h2>

          {phase === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 14 }}>
                알라딘·교보·밀리 등 <b>주문내역이나 내 서재 화면을 캡쳐</b>해서 올리면, 사진 속 책들을 읽어 서가에 한 번에 복원해요.
              </p>
              {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #d23)', marginBottom: 10 }}>{err}</div>}
              <label className="submit-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', width: '100%', margin: 0 }}>
                사진 고르기
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onPick(e.target.files && e.target.files[0])} />
              </label>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.5 }}>사진은 책 인식에만 쓰고 저장하지 않아요 · 최대 8MB</p>
            </div>
          )}

          {phase === 'loading' && (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>🔎</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>사진에서 책을 찾는 중…</div>
              {progress && progress.total > 1 && (
                <div style={{ fontSize: 12, marginTop: 6, color: 'var(--ink-3)' }}>
                  큰 사진이라 나눠 읽는 중 · {Math.min(progress.done, progress.total)}/{progress.total} 조각
                </div>
              )}
            </div>
          )}

          {phase === 'review' && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 8 }}>
                {rows.length}권 찾았어요 (서가 매칭 {matchedCount}권){enriching ? ' · 표지 채우는 중…' : ''}. 등록할 책을 확인하세요.
              </div>

              {/* 목적지 토글 — 일괄 status 선택([P2-3]/#1038 결정) */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {SHELF_DESTS.map((d) => (
                  <button key={d.value} type="button" onClick={() => setDest(d.value)} title={d.hint}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      border: dest === d.value ? '1.5px solid var(--brand, #2a7)' : '1.5px solid var(--line)',
                      background: dest === d.value ? 'var(--brand-tint, rgba(42,119,119,0.1))' : 'var(--card)',
                      color: dest === d.value ? 'var(--brand, #2a7)' : 'var(--ink-2)',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>

              {err && <div style={{ fontSize: 12.5, color: 'var(--danger, #d23)', marginBottom: 10 }}>{err}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '42vh', overflowY: 'auto', marginBottom: 14 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 10, padding: '8px 10px', opacity: r.checked ? 1 : 0.5 }}>
                    <input type="checkbox" checked={r.checked} onChange={() => toggle(i)} aria-label="등록 선택" style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <div style={{ width: 30, height: 42, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'var(--line)' }}>
                      {r.book && r.book.cover_url && <img src={r.book.cover_url} alt="" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input value={r.title} onChange={(e) => edit(i, 'title', e.target.value)} placeholder="제목" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', padding: 0 }} />
                      <input value={r.author} onChange={(e) => edit(i, 'author', e.target.value)} placeholder="저자" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 11.5, color: 'var(--ink-3)', padding: 0, marginTop: 2 }} />
                      {showRating && r.rating > 0 && (
                        <div title={`내 별점 ${r.rating}점 (스샷에서 인식)`} style={{ fontSize: 11, color: '#f5a623', marginTop: 1, letterSpacing: 0.5 }}>
                          {fmtStars(r.rating)} <span style={{ color: 'var(--ink-3)' }}>{r.rating}</span>
                        </div>
                      )}
                    </div>
                    {!r.book && (
                      <button type="button" onClick={() => enrichOne(i)} disabled={r._finding}
                        title="알라딘에서 표지·정보 찾기"
                        style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand, #2a7)', background: 'var(--brand-tint, rgba(42,119,119,0.1))', border: 'none', borderRadius: 6, padding: '3px 7px', flexShrink: 0, cursor: 'pointer' }}>
                        {r._finding ? '찾는 중…' : '🔍 찾기'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button className="submit-btn" style={{ width: '100%', margin: 0 }} disabled={!checkedCount} onClick={register}>
                {checkedCount}권 검토함에 담기
              </button>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, textAlign: 'center', lineHeight: 1.5 }}>
                바로 책장에 넣지 않고 <b>검토함</b>에 담아요 · 책장(서재)에서 확인하고 옮기세요 ({destLabel} 기본)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
window.ShelfImportModal = ShelfImportModal;
