/* =========================================================
   ReadingGo — datastore.js  (issue #124 · S1)
   backend.md §7.2 DataStore 계약 + localStorageAdapter.

   목적: 모든 데이터 접근을 한 모듈로 가둔다. 피처 코드는
   localStorage/supabase 를 직접 호출하지 않고 DataStore.* 만 부른다.
   Phase 0 → 1 이행 = 어댑터 교체 한 줄 (§7.2).

   백킹: localStorageAdapter 가 rg_v41 키 read/write.
   형상은 §7.8 (user_books[] · active_user_book_id). 최초 로드 시
   INITIAL_STATE/ALL_BOOKS 에서 시드.

   주의 (S1 경계): 이 모듈은 계약·어댑터를 *수립*만 한다. 기존
   appState(useState) 렌더링은 마이그레이션하지 않는다 — 신규 피처
   (S5 성/S6 별점/S7 스포일러)가 이후 이걸 쓰도록 토대만 깐다.
   ========================================================= */

const RG_V41_KEY = 'rg_v41';

/* ── id / 날짜 헬퍼 ─────────────────────────────── */
function _dsId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function _today() {
  // 로컬 날짜 (YYYY-MM-DD). 세션/스트릭 일자 키.
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
function _dayDiff(fromDate, toDate) {
  // YYYY-MM-DD 두 날짜의 일수 차 (to - from).
  const a = new Date(fromDate + 'T00:00:00');
  const b = new Date(toDate + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
/* 스트릭 규칙 SSOT (systems.md §6.1) — bumpOnCheckIn 과 체크인 세리머니/XP 가 같은 값을 쓰도록
   순수 함수로 추출(#927). 입력일자(today) 기준으로 다음 current 값을 계산한다.
   - 같은 날 재기록  → 그대로(하루 1회만 증가)
   - 정확히 1일 차   → +1 (연속)
   - 그 외(공백/최초) → 1 (끊겼다 다시 시작) */
function _nextStreak(prevCurrent, lastDate, today) {
  const cur = Math.max(0, prevCurrent || 0);
  if (lastDate === today) return cur;            // 오늘 이미 기록 — 불변
  if (lastDate && _dayDiff(lastDate, today) === 1) return cur + 1;
  return 1;                                       // 공백 ≥1일 또는 최초
}
/* 표시용: 마지막 기록 이후 하루를 건너뛰었으면 스트릭은 이미 끊긴 것(방패 미적용 Phase 0).
   bumpOnCheckIn 은 다음 체크인 때만 리셋하므로, 부팅/표시에선 이 함수로 정상화한다(#927). */
function _isStreakBroken(lastDate, today) {
  if (!lastDate) return false;                    // 기록 없음 — 끊김 판정 안 함
  return _dayDiff(lastDate, today) > 1;           // 어제·오늘이면 유효, 그보다 오래면 끊김
}
/* 스트릭 복구('하루 만회') 정책 SSOT (#938, systems.md §6.1) — 깨진 스트릭의 복구를 양 어댑터가 같은 규칙으로 쓰도록 순수 함수로 추출.
   관용은 좌절 이탈을 막지만 과다하면 스트릭 의미가 퇴색하므로 **주 1회·조건 없음(광고/결제 X)·하루치 유예**로 제한한다.
   복구 = 끊기기 직전 current 값을 보존하고 last_check_in_date 를 '어제'로 세팅 → 오늘 체크인하면 끊김 없이 +1 로 이어진다.
   입력: streak 행({current, last_check_in_date, last_repair_date?}), today(YYYY-MM-DD).
   반환: { canRepair, lostStreak(복구 시 살아날 값), brokenDays(공백 일수), cooldownDays(다음 만회까지 남은 일), reason } */
const STREAK_REPAIR_COOLDOWN_DAYS = 7; // 주 1회 (관용 상한 — 의미 퇴색 방지)
function _streakRepairStatus(st, today) {
  const cur = Math.max(0, (st && st.current) || 0);
  const last = st && st.last_check_in_date;
  // 끊기지 않았으면(어제/오늘 기록) 복구 불필요. 기록이 아예 없으면 살릴 스트릭도 없음.
  if (!_isStreakBroken(last, today)) return { canRepair: false, lostStreak: cur, brokenDays: 0, cooldownDays: 0, reason: 'not_broken' };
  // 저장된 current(끊긴 시점 값, get()의 0 정상화 전)가 1 미만이면 살릴 것이 없음.
  if (cur < 1) return { canRepair: false, lostStreak: 0, brokenDays: _dayDiff(last, today), cooldownDays: 0, reason: 'nothing_to_save' };
  // 주 1회 제한 — 마지막 만회로부터 7일 안이면 쿨다운.
  const lr = st && st.last_repair_date;
  if (lr) {
    const since = _dayDiff(lr, today);
    if (since < STREAK_REPAIR_COOLDOWN_DAYS) {
      return { canRepair: false, lostStreak: cur, brokenDays: _dayDiff(last, today), cooldownDays: STREAK_REPAIR_COOLDOWN_DAYS - since, reason: 'cooldown' };
    }
  }
  return { canRepair: true, lostStreak: cur, brokenDays: _dayDiff(last, today), cooldownDays: 0, reason: 'ok' };
}
function _todayMinus(n) {
  // n일 전 날짜 (YYYY-MM-DD). 캘린더 since 계산용 (#367).
  const d = new Date(Date.now() - (n || 0) * 86400000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

/* ── localStorageAdapter ────────────────────────────────
   rg_v41 키 하나에 §7.8 JSON 미러를 보관. 최초 로드 시 시드.
   Phase 1 에서는 이 객체를 supabaseAdapter 로 교체. */
const localStorageAdapter = (function () {
  let _cache = null;

  function _seed() {
    // INITIAL_STATE 의 단일 활성 책을 user_books[] 한 행으로 시드.
    // #1136: 신규 게스트 빈 시작 — INITIAL_STATE.book 이 빈 센티널({id:''})이면 유령 행 방지 위해 미시드.
    const _sb = (window.INITIAL_STATE && window.INITIAL_STATE.book) || null;
    const seedBook = (_sb && _sb.id) ? _sb : null;
    const user_books = [];
    let active_user_book_id = null;

    if (seedBook) {
      const id = _dsId('ub');
      active_user_book_id = id;
      user_books.push({
        id,
        book_id: seedBook.id,
        book: {
          id: seedBook.id,
          title: seedBook.title,
          author: seedBook.author,
          total_pages: seedBook.total,
          cover_url: seedBook.cover,
        },
        status: 'reading',
        current_page: seedBook.cur || 0,
        rating: null,
        review_text: null,
        started_at: _today(),
        completed_at: null,
        sessions: [],
        sentences: [],
      });

      // 게스트 데모 세션 시드 (#367) — 스트릭 N일과 캘린더 정합. 최근 N일 연속 읽은 날.
      const streakDays = (window.INITIAL_STATE && window.INITIAL_STATE.streak) || 0;
      for (let i = 0; i < streakDays; i++) {
        user_books[0].sessions.push({
          id: _dsId('sess'), user_book_id: user_books[0].id,
          session_date: _todayMinus(i), current_page: user_books[0].current_page, created_at: Date.now() - i * 86400000,
        });
      }

      // 게스트 데모 시드 문장 (QA ISSUE-006) — UI 시드(INITIAL_STATE.myQuotes)만 있고
      // DataStore 가 비어 피드·컬렉션이 0개로 어긋나던 문제. id 부여해 관리도 가능.
      const seedQuotes = (window.INITIAL_STATE && window.INITIAL_STATE.myQuotes) || [];
      const ub0 = user_books[0];
      seedQuotes.forEach((q, i) => {
        if (!q || q.bookId !== ub0.book_id) return;
        const days = q.when === '어제' ? 1 : (parseInt(q.when, 10) || (i + 1));
        ub0.sentences.push({
          id: _dsId('se'), user_book_id: ub0.id, book_id: ub0.book_id, session_id: null,
          page: (typeof q.page === 'number') ? q.page : null, text: q.text || '',
          my_note: null, kind: 'quote', created_at: Date.now() - days * 86400000,
        });
      });
    }

    // 완독 책을 INITIAL_BOOKSHELF 에서 시드 → 프로필 "읽은 책" 목록(§5.8)에 반영.
    // 성(🏰)은 완독 파생이 아니라 XP 주기 파생(floor(totalXp/1600), #520/#521) — 완독과 별개 축.
    // 활성 책과 별개 행.
    const shelf = window.INITIAL_BOOKSHELF || {};
    Object.keys(shelf).forEach(bookId => {
      const entry = shelf[bookId];
      const bk = (typeof window.getBook === 'function') ? window.getBook(bookId) : null;
      user_books.push({
        id: _dsId('ub'),
        book_id: bookId,
        book: bk ? {
          id: bk.id,
          title: bk.title,
          author: bk.author,
          total_pages: bk.total,
          cover_url: bk.cover,
        } : { id: bookId },
        status: 'completed',
        current_page: bk ? bk.total : 0,
        rating: typeof entry.rating === 'number' ? entry.rating : null,
        review_text: entry.comment || null,
        started_at: null,
        completed_at: entry.completedDate || _today(),
        sessions: [],
        sentences: [],
      });
    });

    return {
      user_books,
      active_user_book_id,
      streak: {
        current: (window.INITIAL_STATE && window.INITIAL_STATE.streak) || 0,
        longest: (window.INITIAL_STATE && window.INITIAL_STATE.streak) || 0,
        // 데모 시드: 마지막 기록 = 어제. 종전 null 은 스트릭 규칙 정상화(#927) 후 첫 체크인 시
        // current 를 1 로 떨어뜨려(기록 이력 없음 판정) 데모의 '12일 연속'이 깨졌다. 어제로 시드하면
        // 부팅 표시(12) 유지 + 오늘 체크인 시 연속 13 으로 자연스럽게 이어진다.
        last_check_in_date: _todayMinus(1),
      },
      xp: (window.INITIAL_STATE && window.INITIAL_STATE.xp) || 0,
      claps: {},      // sentenceId -> true
      bookmarks: {},  // sentenceId -> true
      wish_books: Array.isArray(window.WISHLIST) ? window.WISHLIST.slice() : [],
      pending: {},    // 가입 전 임시 (rg_pending_*)
    };
  }

  function read() {
    if (_cache) return _cache;
    try {
      const raw = localStorage.getItem(RG_V41_KEY);
      if (raw) {
        _cache = JSON.parse(raw);
        return _cache;
      }
    } catch (e) {
      console.warn('[DataStore] rg_v41 파싱 실패, 재시드:', e.message);
    }
    _cache = _seed();
    write(_cache);
    return _cache;
  }

  function write(state) {
    _cache = state;
    try {
      localStorage.setItem(RG_V41_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[DataStore] rg_v41 저장 실패:', e.message);
    }
    return state;
  }

  // mutate(fn): 현재 상태를 fn 으로 수정 후 저장. fn 의 반환값을 그대로 돌려준다.
  function mutate(fn) {
    const state = read();
    const out = fn(state);
    write(state);
    return out;
  }

  return { read, write, mutate };
})();

/* ── 내부 조회 헬퍼 ──────────────────────────────── */
function _activeUB(s) {
  if (!s.active_user_book_id) return null;
  return s.user_books.find(ub => ub.id === s.active_user_book_id) || null;
}
function _ubById(s, userBookId) {
  return s.user_books.find(ub => ub.id === userBookId) || null;
}
// 책 정보 수정(#410/#431) — ub.publisher_override/total_pages_override를
// ub.book.publisher/total_pages에 병합(읽기 시 override 우선). Supabase 어댑터와 표면 일치.
// 원본 state는 변형하지 않고 ub.book만 얕은 복사한 뷰를 반환.
function _applyBookOverrides(ub) {
  if (!ub || !ub.book) return ub;
  if (ub.publisher_override == null && ub.total_pages_override == null) return ub;
  return {
    ...ub,
    book: {
      ...ub.book,
      publisher: ub.publisher_override != null ? ub.publisher_override : ub.book.publisher,
      total_pages: ub.total_pages_override != null ? ub.total_pages_override : ub.book.total_pages,
    },
  };
}
// #871 Vite 회귀 픽스 — datastore-supabase.js 가 cross-file 로 호출(옛 loadBabel 전역). 모듈 스코프라 전역 노출 필요.
window._today = _today; window._dayDiff = _dayDiff; window._applyBookOverrides = _applyBookOverrides;
window._nextStreak = _nextStreak; window._isStreakBroken = _isStreakBroken; // 체크인 세리머니/XP 가 스트릭 규칙 공유(#927)
window._streakRepairStatus = _streakRepairStatus; window._todayMinus = _todayMinus; // 스트릭 복구 정책 SSOT(#938) — 양 어댑터 공유
function _allSentences(s) {
  const out = [];
  s.user_books.forEach(ub => {
    (ub.sentences || []).forEach(se => out.push(se));
  });
  return out;
}
function _findSentence(s, sentenceId) {
  return _allSentences(s).find(se => se.id === sentenceId) || null;
}

// 정적 카탈로그 row(getBook/loadBooks: {id,isbn,title,author,pub,total,cover,description})를
// Supabase books 표면({id,isbn13,title,author,publisher,total_pages,cover_url})으로 정규화 (#856).
// BookInfoModal·search.js 가 Supabase 필드명을 기대하므로 어댑터 간 표면을 맞춘다.
function _catalogRow(b) {
  if (!b) return null;
  return {
    id: b.id,
    isbn13: b.isbn || b.isbn13 || '',
    title: b.title,
    author: b.author,
    publisher: b.pub || b.publisher || '',
    total_pages: b.total || b.total_pages || 0,
    cover_url: b.cover || b.cover_url || '',
    description: b.description || '',
  };
}

// Phase 0 데모 피드 보충 (#854) — data.js NPC_QUOTES 를 피드 row(§7.2 shape)로 변환.
// 미로그인/localStorage 상태에선 타 사용자 문장이 없어 피드가 항상 빈 화면이라,
// NPC 더미를 섞어 소셜 탭 첫인상의 "빈 공간"감을 없앤다.
// row 에 id 를 부여하지 않아 SentenceCard.canReact=false → 좋아요 버튼 자동 비활성(합성 row 토글 불가).
// Phase 1(Supabase 어댑터)에선 이 localStorage feed 가 호출되지 않아 자동으로 실데이터로 대체된다(별도 분기 불필요).
function _npcFeedRows() {
  const src = window.NPC_QUOTES;
  if (!src) return [];
  const rows = [];
  Object.keys(src).forEach(bookId => {
    const bk = (typeof window.getBook === 'function') ? window.getBook(bookId) : null;
    // getBook 미스 시 사피엔스(RG_BOOKS[0]) 폴백이라 id 일치할 때만 책 정보 사용(오표시 방지).
    const book = (bk && bk.id === bookId)
      ? { id: bk.id, title: bk.title, author: bk.author, cover_url: bk.cover }
      : { id: bookId };
    (src[bookId] || []).forEach(it => {
      rows.push({
        // id 미부여 — SentenceCard.canReact=!!item.id 가 false → 좋아요 버튼 자동 비활성(합성 row 토글 불가).
        text: it.q,
        page: it.page,
        user_id: null,
        user: { handle: (it.nick || '').replace(/^@/, '') },
        user_book: { book_id: bookId, book },
        created_at: null,
        avatar: it.avatar,   // 이모지 아바타 — surrogate-safe 하게 매핑에서 직접 사용
        claps: it.claps,     // 더미 박수 수(표시용, 합성 row 라 토글 불가)
        time: it.time,       // "2시간 전" 등 상대시간 문자열(created_at 없음 → 폴백 대체)
        _isNpc: true,
      });
    });
  });
  return rows;
}

/* ── DataStore 계약 (§7.2) ───────────────────────────────
   localStorageAdapter 백킹의 실제 동작 구현 (스텁 아님). */
const DataStore = {

  /* 책 / 활성 책 ──────────────────────────────── */
  activeBook: {
    get() {
      return localStorageAdapter.mutate(s => _applyBookOverrides(_activeUB(s)));
    },
    set(userBookId) {
      return localStorageAdapter.mutate(s => {
        if (_ubById(s, userBookId)) s.active_user_book_id = userBookId;
        return s.active_user_book_id;
      });
    },
  },

  /* 내 책 목록 / 추가 (Supabase 어댑터 표면 일치 §7.2) ──────
     localStorage 모드(게스트/Phase0)에서 LibraryView·둥지 캐러셀이 호출.
     누락 시 DataStore.myBooks.list() 가 throw → 서재 탭 전체 크래시(무가드). */
  myBooks: {
    list() {
      return localStorageAdapter.mutate(s => (s.user_books || []).map(_applyBookOverrides));
    },
    add({ book, current_page, status, rating, activate }) {
      book = book || {};
      // #772 서가 복원: status='completed'면 완독으로 등록(completed_at·진척 100%). 기본 'reading'.
      const st = (status === 'completed' || status === 'reading') ? status : 'reading';
      // 별점(#1042 스샷 비전 추출) — 0.5~5.0, 0.5 단위 스냅(Supabase ub_rating_range 와 동일 규칙), 아니면 null.
      const rn = Number(rating);
      const rt = (Number.isFinite(rn) && rn > 0) ? Math.min(5, Math.max(0.5, Math.round(rn * 2) / 2)) : null;
      return localStorageAdapter.mutate(s => {
        s.user_books = s.user_books || [];
        // 동일 책(isbn13 또는 title) 있으면 재사용 — 중복 등록 방지.
        let ub = s.user_books.find(u => u.book && ((book.isbn13 && u.book.isbn13 === book.isbn13) || (book.title && u.book.title === book.title)));
        if (!ub) {
          const tp = book.total_pages || 0;
          ub = {
            id: _dsId('ub'),
            book_id: book.id || _dsId('bk'),
            book: {
              id: book.id || '', title: book.title || '', author: book.author || '',
              publisher: book.publisher || '', total_pages: tp,
              cover_url: book.cover_url || '', isbn13: book.isbn13 || '',
            },
            status: st,
            current_page: st === 'completed' ? (tp || current_page || 0) : (current_page || 0),
            rating: rt, review_text: null,
            started_at: _today(), completed_at: st === 'completed' ? _today() : null, sessions: [], sentences: [],
          };
          s.user_books.push(ub);
        } else if (rt != null && ub.rating == null) {
          // 기존 책이고 아직 별점이 없으면 스샷 별점으로 채움(기존 평가는 덮어쓰지 않음).
          ub.rating = rt;
        }
        // 새 '읽기 시작' 책은 자동으로 활성 책 전환 (#1196, Edgar 피드백) — 이전 책이 남아 홈에서 화살표로
        // 겨우 바꾸던 문제 해소. status='reading' 만(완독 담기·찜 제외). addBatch 는 activate:false 로 대량복원 하이재킹 방지.
        if (st === 'reading' && activate !== false) s.active_user_book_id = ub.id;
        return ub;
      });
    },
    // 스샷 서가 복원 (#772·#1038·#1042) — 책 목록 일괄 등록. items: [{book, status, rating?}].
    // status 라우팅: 'wish' → 위시리스트(wish_books), 그 외('completed'/'reading') → user_books(add 재사용).
    // 'wish' 는 user_book 이 아니라 wish_books 에 담아 기존 위시 UX(library.js)와 일치시킨다.
    // 매칭/알라딘 책의 메타(표지·쪽수·isbn)는 BOOK_BY_ID 에 시드해 getBook 으로 해소 → 위시 카드 표지 보존(#1038 게스트 패리티).
    // rating(#1042): user_books 경로만 별점 보존(wish_books 엔 별점 컬럼 없음 → 무시).
    // 모두 add 류처럼 개별 try/catch — 한 권 실패해도 나머지 진행(무중단).
    addBatch(items) {
      const list = Array.isArray(items) ? items : [];
      const out = [];
      for (const it of list) {
        if (!it || !it.book) continue;
        try {
          if (it.status === 'wish') {
            const w = DataStore.wishBooks.addOne(it.book);
            if (w) out.push(w);
          } else {
            out.push(this.add({ book: it.book, status: it.status, rating: it.rating, activate: false }));
          }
        } catch (e) { /* 개별 실패 스킵 */ }
      }
      return out;
    },
    // 책 정보 수정 (출판사·페이지수, #410/#431) — user_book override 컬럼에 저장
    // (공유 books 카탈로그가 아닌 사용자별 user_books override). Supabase 어댑터와 표면 일치.
    updateBook(userBookId, fields) {
      fields = fields || {};
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId);
        if (!ub || !ub.book) return null;
        if (fields.publisher !== undefined) ub.publisher_override = fields.publisher;
        if (fields.total_pages !== undefined) ub.total_pages_override = Number(fields.total_pages) || 0;
        return _applyBookOverrides(ub);
      });
    },
    // 읽던 책 중단 (#593) — status='aborted'. current_page 보존(되돌리기 가능),
    // 활성 책이면 active 해제 → "읽는 중"·둥지 캐러셀에서 빠지고 "중단" 탭으로 이동.
    // 활성 책 중단 시 남은 '읽는 중' 책으로 active 승계 (#643) — 홈이 빈 상태로 떨어지지 않게.
    // 남은 reading 책이 없을 때만 null 유지(빈 상태가 올바름). 승계 대상은 캐러셀 순서(저장 순)의 첫 책.
    abort(userBookId) {
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId);
        if (!ub) return null;
        ub.status = 'aborted';
        if (s.active_user_book_id === ub.id) {
          const next = (s.user_books || []).find(u => u.id !== ub.id && (u.status || 'reading') === 'reading');
          s.active_user_book_id = next ? next.id : null;
        }
        return _applyBookOverrides(ub);
      });
    },
    // 중단 책 다시 읽기 (#593) — 'aborted' → 'reading'. completed_at 미설정(완독과 무관).
    resume(userBookId) {
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId);
        if (!ub) return null;
        ub.status = 'reading';
        s.active_user_book_id = ub.id;   // #1203: 다시 읽기 = 활성 책으로 (홈 즉시 표시·새로고침 유지)
        return _applyBookOverrides(ub);
      });
    },
    // 잘못 담은 책 완전 삭제 (#1195, Edgar 피드백) — abort(중단, 되돌리기 가능)와 달리 영구 제거.
    // 문장·세션은 ub 에 내포돼 user_book 행과 함께 사라진다(Supabase 는 FK on delete cascade 로 대응).
    // 활성 책 삭제 시 남은 '읽는 중' 책으로 active 승계 (#643 abort 동일) — 홈이 빈 상태로 떨어지지 않게.
    remove(userBookId) {
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId);
        if (!ub) return null;
        s.user_books = (s.user_books || []).filter(u => u.id !== userBookId);
        if (s.active_user_book_id === userBookId) {
          const next = (s.user_books || []).find(u => (u.status || 'reading') === 'reading');
          s.active_user_book_id = next ? next.id : null;
        }
        return { id: userBookId };
      });
    },
  },

  /* 스샷 서가 복원 검토함 (#1048) — 로그인(Supabase) 전용 스테이징(import_staging).
     게스트/로컬은 RG_openShelfImport 게이트(app.js)로 차단돼 여기 도달하지 않는다.
     DataStore 계약(§7.2) 표면 패리티만 유지하려고 같은 시그니처를 두되 **미지원 no-op**:
     검토함 적재/이동은 SupabaseDataStore.importStaging 만 구현. (Promise 표면도 일치 — 호출부 await 안전.) */
  importStaging: {
    add() { return Promise.resolve([]); },     // no-op — 로컬은 검토함 미지원
    list() { return Promise.resolve([]); },     // 검토함 비어있음(섹션 미노출)
    remove() { return Promise.resolve([]); },
    commit() { return Promise.resolve(null); },
  },

  /* 일일 기록 (세션) ──────────────────────────────
     sessions.addToday: 그날 세션 1행 생성(같은 날 재호출 중복 방지)
     + streak.bumpOnCheckIn 연동. */
  sessions: {
    addToday({ userBookId, page, duration_sec }) {
      const today = _today();
      const session = localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId) || _activeUB(s);
        if (!ub) return null;
        if (typeof page === 'number') ub.current_page = page;
        ub.sessions = ub.sessions || [];
        let row = ub.sessions.find(se => se.session_date === today);
        if (!row) {
          row = {
            id: _dsId('sess'),
            user_book_id: ub.id,
            session_date: today,
            current_page: ub.current_page,
            duration_sec: (typeof duration_sec === 'number' && duration_sec > 0) ? duration_sec : 0,
            created_at: Date.now(),
          };
          ub.sessions.push(row);
        } else {
          if (typeof page === 'number') row.current_page = page;
          // 같은 날 재호출(여러 읽기 세션) → 독서 시간 누적 (#430)
          if (typeof duration_sec === 'number' && duration_sec > 0) row.duration_sec = (row.duration_sec || 0) + duration_sec;
        }
        return row;
      });
      // 입력 즉시 스트릭 갱신 (§7.2: streak.bumpOnCheckIn 연동).
      DataStore.streak.bumpOnCheckIn();
      return session;
    },
    list(userBookId) {
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId) || _activeUB(s);
        return ub ? (ub.sessions || []).slice() : [];
      });
    },
    // 스트릭 캘린더 (#367) — 최근 days일 읽은 날짜. supabase 어댑터와 표면 일치(§7.2).
    // 로컬엔 방패 로그 미보유 → shieldDates 빈 배열. 전 책의 session_date 합집합.
    calendar(days) {
      return localStorageAdapter.mutate(s => {
        const since = _todayMinus(days || 35);
        const set = new Set();
        (s.user_books || []).forEach(ub => (ub.sessions || []).forEach(se => {
          if (se.session_date && se.session_date >= since) set.add(se.session_date);
        }));
        return { readDates: [...set], shieldDates: [] };
      });
    },
  },

  /* 한 문장 (sentences) ───────────────────────────── */
  sentences: {
    add({ userBookId, sessionId, page, text, my_note, kind }) {
      return localStorageAdapter.mutate(s => {
        // #565: userBookId 가 명시됐는데 못 찾으면 active 책으로 폴백하지 않는다(잘못된 귀속 방지) — null 로 실패.
        // userBookId 미명시(레거시 호출)일 때만 active 책 사용.
        const ub = userBookId ? _ubById(s, userBookId) : _activeUB(s);
        if (!ub) return null;
        ub.sentences = ub.sentences || [];
        const row = {
          id: _dsId('se'),
          user_book_id: ub.id,
          book_id: ub.book_id,
          session_id: sessionId || null,
          page: typeof page === 'number' ? page : (ub.current_page || 0),
          text: text || '',
          my_note: my_note || null,
          kind: 'quote',   // '내 생각'(thought) 폐기 — 항상 인용(quote) (#596)
          _guest: true,   // 게스트가 직접 남긴 문장(시드 아님) — 로그인 시 backfill 대상 (#370)
          created_at: Date.now(),
        };
        ub.sentences.push(row);
        return row;
      });
    },
    listByBook(userBookId) {
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId) || _activeUB(s);
        return ub ? (ub.sentences || []).slice() : [];
      });
    },
    listMine() {
      // #1224: 게스트 등록 책은 book_id 가 카탈로그 밖 생성 id('bk_…')라 getBook 으로 제목 해소 불가
      // → 소속 user_book 내장 book 의 제목(book_title)을 행에 실어 준다(흔적 카드 '책' 폴백 방지).
      return localStorageAdapter.mutate(s => {
        const out = [];
        (s.user_books || []).forEach(ub => (ub.sentences || []).forEach(se =>
          out.push({ ...se, book_title: (ub.book && ub.book.title) || '' })));
        return out;
      });
    },
    feed() {
      // 전체 공개 피드 — 최신순 (§social). Phase 0 은 내 문장 상단 + NPC 더미 하단(#854).
      const mine = localStorageAdapter.mutate(s =>
        _allSentences(s).slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      );
      return [...mine, ..._npcFeedRows()];
    },
    // 추천 (#787) — Phase 0 은 타 사용자 없음 → feed()와 동형(내 문장 최신순 + NPC 더미, #854). 표면 일치(§7.2).
    feedRecommended() {
      const mine = localStorageAdapter.mutate(s =>
        _allSentences(s).slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      );
      return [...mine, ..._npcFeedRows()];
    },
    // 사후 감상 추가·편집 (§5.8.4) — Supabase 어댑터와 표면 일치(§7.2)
    setNote(sentenceId, my_note) {
      return localStorageAdapter.mutate(s => {
        const se = _findSentence(s, sentenceId);
        if (se) se.my_note = my_note;
        return se;
      });
    },
    // 한 문장 본문 편집 (오타 수정, #325)
    updateText(sentenceId, text) {
      return localStorageAdapter.mutate(s => {
        const se = _findSentence(s, sentenceId);
        if (se) se.text = text || '';
        return se;
      });
    },
    // 한 문장 페이지 번호 편집 (#683) — Supabase 어댑터와 표면 일치(§7.2). null = 페이지 미상.
    setPage(sentenceId, page) {
      return localStorageAdapter.mutate(s => {
        const se = _findSentence(s, sentenceId);
        if (se) se.page = (typeof page === 'number' && isFinite(page)) ? page : null;
        return se;
      });
    },
    // 공개 범위 변경 — Supabase 어댑터와 표면 일치
    setVisibility(sentenceId, { visibility }) {
      return localStorageAdapter.mutate(s => {
        const se = _findSentence(s, sentenceId);
        if (se) se.visibility = visibility;
        return se;
      });
    },
    // 종류 변경 인용↔내 의견 (#381) — Supabase 어댑터와 표면 일치
    setKind(sentenceId, kind) {
      return localStorageAdapter.mutate(s => {
        const se = _findSentence(s, sentenceId);
        if (se) se.kind = kind === 'thought' ? 'thought' : 'quote';
        return se;
      });
    },
    // 한 문장 삭제 — 소속 책의 sentences 배열에서 제거 (Supabase 어댑터와 표면 일치 §7.2)
    remove(sentenceId) {
      return localStorageAdapter.mutate(s => {
        for (const ub of s.user_books) {
          const arr = ub.sentences || [];
          const i = arr.findIndex(se => se.id === sentenceId);
          if (i >= 0) { arr.splice(i, 1); return true; }
        }
        return false;
      });
    },
    // 시간차 되감기 후보 (#346, resurface.md §2) — 대화(Q/A) 저장된 문장 중 14일+ 경과,
    // 재소환 14일+ 미경과 제외. 우선순위: 가장 긴 내 답변 → 동률 랜덤.
    resurfaceCandidate() {
      return localStorageAdapter.mutate(s => {
        const now = Date.now(), TH = 14 * 86400000;
        const cands = [];
        s.user_books.forEach(ub => {
          (ub.sentences || []).forEach(se => {
            const note = se.my_note || '';
            if (!/(^|\n)Q\.\s/.test(note) || !/(^|\n)A\.\s/.test(note)) return; // 답변 없는 문장 제외
            const created = typeof se.created_at === 'number' ? se.created_at : Date.parse(se.created_at) || 0;
            if (!created || now - created < TH) return;
            if (se.last_resurfaced_at && now - se.last_resurfaced_at < TH) return;
            const answers = [...note.matchAll(/(^|\n)A\.\s([\s\S]*?)(?=\nQ\.|\n\n|$)/g)].map(m => (m[2] || '').trim());
            cands.push({
              id: se.id, text: se.text, bookId: se.book_id || ub.book_id,
              bookTitle: (ub.book && ub.book.title) || '', page: se.page, note,
              kind: se.kind || 'quote',
              daysAgo: Math.floor((now - created) / 86400000),
              lastAnswer: answers[answers.length - 1] || '',
              _longest: Math.max(0, ...answers.map(a => a.length)),
            });
          });
        });
        if (!cands.length) return null;
        const best = Math.max(...cands.map(c => c._longest));
        const top = cands.filter(c => c._longest === best);
        return top[Math.floor(Math.random() * top.length)];
      });
    },
    markResurfaced(sentenceId) {
      return localStorageAdapter.mutate(s => {
        const se = _findSentence(s, sentenceId);
        if (se) se.last_resurfaced_at = Date.now();
        return !!se;
      });
    },
    // 무작위 회상 (§5.8.7)
    random() {
      return localStorageAdapter.mutate(s => {
        const all = _allSentences(s);
        return all.length ? all[Math.floor(Math.random() * all.length)] : null;
      });
    },
    // 같은 책 피드 (Supabase 어댑터와 표면 일치) — 로컬(Phase 0)엔 타 사용자 없음 → 빈 배열.
    // (bookId, {limit?, sort?}) 시그니처는 supabase 표면 일치용 — 게스트는 sort='likes'(#594)도 빈 폴백.
    byBook(bookId, opts) { return []; },
  },

  /* 시간차 되감기 노출 게이트 (#346, resurface.md §2.1·§4.2) — 1일 1회.
     기기 로컬 넛지 억제라 양 어댑터 모두 localStorage 키 rg_resurface_last 사용. */
  resurface: {
    shownToday() { try { return localStorage.getItem('rg_resurface_last') === _today(); } catch (e) { return false; } },
    markToday() { try { localStorage.setItem('rg_resurface_last', _today()); } catch (e) {} },
  },

  /* 마일스톤 회고 노출 게이트 (#938, A2, nest.md §5.4) — 기기 로컬 빈도 가드(서버 저장 불필요, 양 어댑터 동일).
     절제 규칙(피로 방지): ① 같은 마일스톤 key 는 1회만 ② 하루 최대 1회(여러 마일스톤이 한 세션에 겹쳐도 1개만).
     key 예: 'complete:<ubId>', 'streak:7', 'streak:30', 'castle:2'. rg_milestone_seen(JSON map) + rg_milestone_last(YYYY-MM-DD). */
  milestone: {
    _seen() { try { return JSON.parse(localStorage.getItem('rg_milestone_seen') || '{}') || {}; } catch (e) { return {}; } },
    // 이 마일스톤을 지금 회고로 띄워도 되는가 — 미열람 key + 오늘 아직 미노출.
    shouldShow(key) {
      if (!key) return false;
      try {
        if (this._seen()[key]) return false;                       // 이미 본 마일스톤
        if (localStorage.getItem('rg_milestone_last') === _today()) return false; // 오늘 이미 1회 노출
        return true;
      } catch (e) { return false; }
    },
    // 노출 확정 — key 영구 마킹 + 오늘 날짜 기록(하루 1회 캡).
    markShown(key) {
      try {
        const seen = this._seen(); if (key) seen[key] = _today();
        localStorage.setItem('rg_milestone_seen', JSON.stringify(seen));
        localStorage.setItem('rg_milestone_last', _today());
      } catch (e) {}
    },
  },

  /* 스트릭 ──────────────────────────────────────── */
  streak: {
    get() {
      // 표시 정상화(#927): 마지막 기록이 하루 넘게 지났으면 끊긴 스트릭이다. bumpOnCheckIn 은
      // 다음 체크인 때만 0으로 내리므로, 부팅/표시 시점에 죽은 스트릭을 살아있는 것처럼 보이지
      // 않게 current=0 으로 정상화해 돌려준다(저장값은 다음 체크인 때 갱신, Phase 0 방패 미적용).
      return localStorageAdapter.mutate(s => {
        const st = { ...s.streak };
        if (_isStreakBroken(st.last_check_in_date, _today())) st.current = 0;
        return st;
      });
    },
    bumpOnCheckIn() {
      const today = _today();
      return localStorageAdapter.mutate(s => {
        const st = s.streak;
        if (st.last_check_in_date === today) return { ...st }; // 하루 1회만 증가
        st.current = _nextStreak(st.current, st.last_check_in_date, today); // 규칙 SSOT(#927)
        if (st.current > (st.longest || 0)) st.longest = st.current;
        st.last_check_in_date = today;
        return { ...st };
      });
    },
    // 스트릭 복구 가능 여부 (#938, systems.md §6.1) — UI가 복구 카드 노출/문구를 결정. 저장값(raw current) 기준.
    repairStatus() {
      return localStorageAdapter.mutate(s => _streakRepairStatus(s.streak, _today()));
    },
    // '하루 만회' 실행 (#938) — 깨진 스트릭을 끊김 직전 값으로 되살리고 last_check_in_date 를 '어제'로.
    // 주 1회·조건 없음(_streakRepairStatus 게이트). 오늘 체크인하면 +1 로 자연스럽게 이어진다.
    // 반환: { ok, streak(복구 후 행), lostStreak, reason }. 불가 시 ok:false + 사유.
    repair() {
      const today = _today();
      return localStorageAdapter.mutate(s => {
        const status = _streakRepairStatus(s.streak, today);
        if (!status.canRepair) return { ok: false, reason: status.reason, cooldownDays: status.cooldownDays, streak: { ...s.streak } };
        const st = s.streak;
        // 끊김 직전 값 보존 + 어제로 세팅(오늘 체크인 시 _nextStreak 가 +1). longest 도 안전하게 유지.
        st.current = Math.max(1, status.lostStreak);
        if (st.current > (st.longest || 0)) st.longest = st.current;
        st.last_check_in_date = _todayMinus(1);
        st.last_repair_date = today;   // 주 1회 쿨다운 기준
        return { ok: true, reason: 'repaired', lostStreak: st.current, streak: { ...st } };
      });
    },
  },

  /* XP ──────────────────────────────────────────── */
  xp: {
    get() {
      return localStorageAdapter.mutate(s => s.xp || 0);
    },
    add(amount, reason) {
      return localStorageAdapter.mutate(s => {
        s.xp = (s.xp || 0) + (amount || 0);
        return s.xp;
      });
    },
  },

  /* 완독 / 성(🏰) ─────────────────────────────────
     books.complete → status='completed' + completed_at (완독 상태·별점·소감, 성 직접 지급 없음).
     castles.list → floor(totalXp / 1600) 파생 (#520/#521). 완독 권수와 분리. */
  books: {
    // 책 카탈로그 단건 조회 (§7.2 Supabase 어댑터 getById 표면 일치) — Phase 0/게스트는 정적 카탈로그(getBook).
    // 누락돼 있어 BookInfoModal 의 `DS.books.getById` 가 undefined → 게스트(미로그인) 책 상세가
    // 전부 "책 정보를 찾을 수 없어요"로 깨졌다(#856). loadBooks() 를 먼저 await 해 인라인 12권 밖
    // (TSV/Supabase) 책도 BOOK_BY_ID 에 색인된 뒤 getBook 으로 조회한다.
    getById(id) {
      if (!id) return null;
      return Promise.resolve(window.loadBooks ? window.loadBooks() : null).then(() => {
        const b = (typeof window.getBook === 'function') ? window.getBook(id) : null;
        // getBook 미스 시 사피엔스(RG_BOOKS[0]) 폴백 → id 불일치면 없음 처리(오표시 방지).
        return (b && b.id === id) ? _catalogRow(b) : null;
      });
    },
    // 단건 조회 별칭 (Supabase get 표면 일치).
    get(bookId) { return this.getById(bookId); },
    // 우리 DB 책 검색 (Supabase ilike 표면 일치) — Phase 0/게스트는 정적 카탈로그 퍼지 검색.
    search(query) {
      const q = (query || '').trim();
      if (!q || !window.loadBooks) return Promise.resolve([]);
      return window.loadBooks().then(list =>
        (window.fuzzySearch ? window.fuzzySearch(list, q) : []).slice(0, 20).map(_catalogRow)
      );
    },
    complete(userBookId, opts) {
      opts = opts || {};
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId);
        if (!ub) return null;
        ub.status = 'completed';
        ub.completed_at = _today();
        if (typeof opts.rating !== 'undefined') ub.rating = opts.rating;
        if (typeof opts.review_text !== 'undefined') ub.review_text = opts.review_text;
        // 완독한 책이 활성이면 남은 '읽는 중' 책으로 active 승계 (abort #643 동일, #1217).
        if (s.active_user_book_id === userBookId) {
          const next = s.user_books
            .filter(x => x.status === 'reading' && x.id !== userBookId)
            .sort((a, b) => (Date.parse(b.started_at || 0) || 0) - (Date.parse(a.started_at || 0) || 0))[0];
          s.active_user_book_id = next ? next.id : null;
        }
        return ub;
      });
    },
    // 참새 완독 회고 캐시 (#352) — Supabase 어댑터와 표면 일치(§7.2)
    saveRecap(userBookId, recap) {
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId);
        if (!ub) return null;
        ub.companion_recap = recap || null;
        return ub;
      });
    },
    // social.md §5.7 "이번 주 신규 시작러 Top3" — 이번 주(월~) started_at 기준 책별 집계.
    startedThisWeek(lim = 3) {
      return localStorageAdapter.mutate(s => {
        const ws = new Date(); ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7)); ws.setHours(0, 0, 0, 0);
        const by = {};
        (s.user_books || []).forEach(ub => {
          const t = ub.started_at ? new Date(ub.started_at) : null;
          if (!t || t < ws) return;
          const b = ub.book || {};
          if (!by[ub.book_id]) by[ub.book_id] = { bookId: ub.book_id, title: b.title || '', author: b.author || '', cover_url: b.cover_url || b.cover || '', starters: 0 };
          by[ub.book_id].starters += 1;
        });
        return Object.values(by).sort((a, b) => b.starters - a.starters).slice(0, lim);
      });
    },
    // 관련 도서 추천 (#496) — "이 책과 함께 읽으면 좋은 책".
    // Phase 0: worker /api/related(LLM) + 실존 books 매칭(환각 필터). 저장소 무관 로직이라
    // data.js recommendRelated 에 위임. Phase 1에 Supabase '함께 읽은 사람들' 집계로 강화 예정.
    related(book, limit) {
      return window.recommendRelated ? window.recommendRelated(book, limit) : Promise.resolve([]);
    },
  },
  castles: {
    // 성(🏰) = XP 주기 완료 수 (#520/#521, backend.md §7.2). length = floor(totalXp / 1600).
    // 완독 권수 파생 폐기 — 완독과 성은 별개 축(완독 책은 '읽은 책' 목록에 남음).
    list() {
      return localStorageAdapter.mutate(s => {
        const n = (typeof window.nestCastleCount === 'function')
          ? window.nestCastleCount(s.xp)
          : Math.floor(Math.max(0, s.xp || 0) / 1600);
        return Array.from({ length: n }, (_, i) => ({ index: i + 1, earnedAtXp: (i + 1) * 1600 }));
      });
    },
  },

  /* 소셜 (좋아요 / 관심책) ─────────────────────
     claps.toggle = ❤️ 좋아요 (한 문장 반응+저장 단일화, #641) 토글.
     #641: 짹+저장(구 bookmark) → claps 단일 수렴. 자기 문장 좋아요(저장) 허용 — localStorage는 작성자 구분 없이 토글. */
  claps: {
    toggle(sentenceId) {
      return localStorageAdapter.mutate(s => {
        if (s.claps[sentenceId]) delete s.claps[sentenceId];
        else s.claps[sentenceId] = true;
        return !!s.claps[sentenceId];
      });
    },
    isMine(sentenceId) {
      return localStorageAdapter.mutate(s => !!s.claps[sentenceId]);
    },
    // #641: 내가 좋아요한 문장 목록(sentence 임베드) — '좋아요한 문장 모아보기'. 구 bookmarks.list 대체.
    list() {
      return localStorageAdapter.mutate(s => {
        const all = _allSentences(s);
        return Object.keys(s.claps || {}).filter(k => s.claps[k]).map(sid => {
          const se = all.find(x => x.id === sid) || null;
          return { sentence_id: sid, sentence: se };
        });
      });
    },
  },
  wishBooks: {
    add(bookId) {
      return localStorageAdapter.mutate(s => {
        if (!s.wish_books.includes(bookId)) s.wish_books.push(bookId);
        return s.wish_books.slice();
      });
    },
    // 책 객체로 찜 추가 (#1038 일괄 임포트) — 매칭/알라딘 책의 메타를 BOOK_BY_ID 에 시드해
    // getBook 으로 해소되게 한 뒤 id 를 wish_books 에 담는다(표지·쪽수·isbn 보존).
    // id 없으면(미확인) isbn/제목 기반 안정 id 를 만들어 시드 → 위시 카드에 제목·저자만이라도 보존.
    // 반환: {book_id, book} (addBatch out 표면). 중복(이미 찜)이면 그대로 반환.
    addOne(book) {
      book = book || {};
      const id = String(book.id || book.isbn13 || book.isbn || ('wbk_' + (book.title || '').replace(/\s+/g, '').slice(0, 24)) || _dsId('wbk'));
      if (!id) return null;
      // 메타를 인덱스에 시드(없을 때만) → getBook 이 올바른 표지/제목을 돌려주게(미시드 시 Sapiens 폴백 오표시 방지).
      try {
        if (typeof window !== 'undefined' && window.BOOK_BY_ID && !window.BOOK_BY_ID[id]) {
          window.BOOK_BY_ID[id] = {
            id, isbn: book.isbn13 || book.isbn || '', title: book.title || '', author: book.author || '',
            pub: book.publisher || '', total: book.total_pages || 0, cover: book.cover_url || '',
            description: '', fb: ['#9AA7B2', '#C7D0D8'], toc: [],
          };
        }
      } catch (e) { /* 인덱스 시드 실패해도 등록은 진행 */ }
      localStorageAdapter.mutate(s => { if (!s.wish_books.includes(id)) s.wish_books.push(id); return s.wish_books; });
      const bk = (typeof window.getBook === 'function') ? window.getBook(id) : null;
      return { book_id: id, book: (bk && bk.id === id) ? { id: bk.id, title: bk.title, author: bk.author, publisher: bk.pub || bk.publisher, total_pages: bk.total, cover_url: bk.cover, isbn13: bk.isbn } : { id, title: book.title || '', author: book.author || '' } };
    },
    list() {
      // Supabase 어댑터와 표면 일치 — {book_id, book} 객체 배열 반환(getBook으로 해소, #403).
      return localStorageAdapter.mutate(s => s.wish_books.map(id => {
        const bk = (typeof window.getBook === 'function') ? window.getBook(id) : null;
        return { book_id: id, book: bk ? { id: bk.id, title: bk.title, author: bk.author, publisher: bk.pub || bk.publisher, total_pages: bk.total, cover_url: bk.cover, isbn13: bk.isbn } : { id } };
      }));
    },
    remove(bookId) {
      return localStorageAdapter.mutate(s => {
        s.wish_books = s.wish_books.filter(id => id !== bookId);
        return s.wish_books.slice();
      });
    },
  },

  /* 방(room) — 같이읽기 P1 (co-reading.md §6.2). localStorage 어댑터(게스트/Phase0).
     타 사용자 부재 → members 는 나 1명, byBook/myRooms 는 로컬 방 목록. Supabase 어댑터와
     같은 메서드 표면(Promise)만 보장(backend.md §7.2). 로컬 방은 rg_rooms_v1 키에 영속. */
  rooms: {
    _load() { try { return JSON.parse(localStorage.getItem('rg_rooms_v1') || '[]') || []; } catch (e) { return []; } },
    _save(list) { try { localStorage.setItem('rg_rooms_v1', JSON.stringify(list || [])); } catch (e) {} },
    _token() {
      const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let s = ''; for (let i = 0; i < 26; i++) s += a[Math.floor(Math.random() * a.length)]; return s;
    },
    // 로컬 방을 Supabase 어댑터 표면으로 — book 임베드(getBook 해소) + village_members count.
    // 표면 일치(#996): Supabase 는 password_hash 를 클라에 안 주고 has_password 플래그만 노출한다.
    // 로컬도 동일하게 — 평문 password 는 반환 객체에서 제거(저장 레코드엔 유지, 로컬 join 검증용)하고
    // has_password 만 노출한다. (로컬은 서버가 없어 클라 비교가 불가피 — 한계, co-reading §6.4.)
    _shape(r) {
      const bk = (typeof window.getBook === 'function') ? window.getBook(r.book_id) : null;
      const book = bk ? { id: bk.id, isbn13: bk.isbn, title: bk.title, author: bk.author, cover_url: bk.cover, total_pages: bk.total } : { id: r.book_id };
      const { password, ...safe } = r;   // 비번 폐기(B안, #1094 후속) — 평문 제거, has_password 는 항상 false
      return { ...safe, has_password: false, book, village_members: [{ count: (r._members && r._members.length) || 1 }] };
    },
    async create({ bookId, name, visibility, capacity }) {
      const list = this._load();
      const vis = visibility === 'private' ? 'private' : 'public';
      const r = {
        id: _dsId('room'), book_id: bookId, name: name || '', visibility: vis,
        capacity: capacity != null ? capacity : null,
        invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        invite_token: this._token(),
        created_by: (window.RG_ME && window.RG_ME.id) || 'me',
        created_at: new Date().toISOString(),
        _members: [(window.RG_ME && window.RG_ME.id) || 'me'],   // 로컬 멤버십(나만)
      };
      list.unshift(r); this._save(list);
      return this._shape(r);
    },
    async join(roomId) {
      const list = this._load();
      const r = list.find(x => x.id === roomId);
      if (r) {
        if (r.capacity && (r._members || []).length >= r.capacity) throw new Error('정원이 마감되었습니다.');
        const me = (window.RG_ME && window.RG_ME.id) || 'me';
        r._members = r._members || []; if (!r._members.includes(me)) r._members.push(me);
        this._save(list);
      }
      return true;
    },
    async leave(roomId) {
      const list = this._load();
      const r = list.find(x => x.id === roomId);
      if (r) {
        const me = (window.RG_ME && window.RG_ME.id) || 'me';
        r._members = (r._members || []).filter(m => m !== me);
        this._save(list);
      }
      return true;
    },
    async byBook(bookId, opts) {
      // 정렬 = 멤버 인원수 desc, 동률은 최신순(supabase 어댑터·자동합류·추천 통일, §4.2·§7.6).
      //   _load() 는 unshift 순(최신 먼저)이라 동률 안정 정렬이 곧 최신순. limit 은 정렬 뒤 적용.
      let out = this._load().filter(r => r.visibility === 'public' && (!bookId || r.book_id === bookId))
        .map(r => this._shape(r));
      const cnt = (r) => (r.village_members && r.village_members[0] && r.village_members[0].count) || 0;
      out.sort((a, b) => cnt(b) - cnt(a));
      if (opts && opts.limit) out = out.slice(0, opts.limit);
      return out;
    },
    async myRooms() {
      const me = (window.RG_ME && window.RG_ME.id) || 'me';
      return this._load().filter(r => (r._members || []).includes(me)).map(r => this._shape(r));
    },
    async get(roomId) {
      const r = this._load().find(x => x.id === roomId);
      return r ? this._shape(r) : null;
    },
    // 멤버 진척 그리드 — 로컬은 나 1명. 내 활성/지정 책 진도·오늘 기록·최근 한 문장 반영.
    async members(roomId) {
      const r = this._load().find(x => x.id === roomId);
      if (!r) return [];
      const me = window.RG_ME || {};
      const myUb = localStorageAdapter.mutate(s => (s.user_books || []).find(u => u.book_id === r.book_id) || null);
      const today = _today();
      const recordedToday = localStorageAdapter.mutate(s =>
        (s.user_books || []).some(u => (u.sessions || []).some(se => se.session_date === today)));
      const lastSent = myUb && (myUb.sentences || []).length ? myUb.sentences[myUb.sentences.length - 1] : null;
      return [{
        joined_at: r.created_at,
        user: {
          id: me.id || 'me', handle: me.handle || 'me', display_name: me.display_name || me.handle || '나',
          nest_emoji: me.nest_emoji || null, streak: me.streak ? [{ current: me.streak }] : [],
          cumulativePage: (myUb && myUb.current_page) || 0,
          todayRecorded: !!recordedToday,
          todaySentence: lastSent ? { text: lastSent.text, page: lastSent.page } : null,
        },
      }];
    },
    async findByToken(token) {
      if (!token) return null;
      const r = this._load().find(x => x.invite_token === String(token).trim());
      return r ? this._shape(r) : null;
    },
    async findByCode(code) {
      if (!code) return null;
      const r = this._load().find(x => x.invite_code === String(code).toUpperCase().trim());
      return r ? this._shape(r) : null;
    },
    /* ── 마일스톤(함께 읽기 일정/구간) — village_parts (co-reading.md §6, P2 마일스톤) ──
       host(created_by)가 구간 목록(제목·목표페이지·마감)을 만들고, 멤버는 읽기만.
       로컬/게스트는 방 객체에 _parts 배열로 인라인 보관(supabase village_parts 표면 일치). */
    async listParts(roomId) {
      const r = this._load().find(x => x.id === roomId);
      const parts = (r && r._parts) || [];
      return parts.slice().sort((a, b) => (a.part_order || 0) - (b.part_order || 0));
    },
    // host 가 구간 목록 전체를 교체(set). parts = [{title,end_page,due_date}] 순서대로 part_order 부여.
    async setParts(roomId, parts) {
      const list = this._load();
      const r = list.find(x => x.id === roomId);
      if (!r) return [];
      const me = (window.RG_ME && window.RG_ME.id) || 'me';
      if (r.created_by && r.created_by !== me) throw new Error('일정은 숲을 만든 사람만 정할 수 있어요.');
      // 빈 행(제목·목표·마감 전부 없음)은 버린다 — supabase 어댑터와 동일 필터(표면 일치).
      r._parts = (Array.isArray(parts) ? parts : [])
        .filter(p => p && ((p.title && String(p.title).trim()) || (p.end_page != null && p.end_page !== '') || p.due_date))
        .map((p, i) => ({
          id: p.id || _dsId('vpart'),
          village_id: roomId,
          part_order: i + 1,
          title: (p.title || '').trim(),
          end_page: (p.end_page != null && p.end_page !== '') ? Number(p.end_page) : null,
          due_date: p.due_date || null,
        }));
      this._save(list);
      return r._parts.slice();
    },
  },

  /* 유저 공개 데이터 — Phase 0 로컬 어댑터 stub (표면 일치용)
     Phase 1 에서 SupabaseDataStore.users 로 실구현. */
  users: {
    // 위시리스트 공개 — 로컬/게스트 모드는 항상 [] (Supabase 없이 공개 불가). (#558)
    publicWishlist(/* userId */) { return []; },
  },

  /* 스포일러 (read-side 계산, 저장 컬럼 없음) ─────────
     spoiler.myCurrentPage: 활성/지정 책의 내 현재 페이지 → 블라인드 판정용. */
  spoiler: {
    myCurrentPage(bookId) {
      return localStorageAdapter.mutate(s => {
        const ub = bookId
          ? s.user_books.find(u => u.book_id === bookId)
          : _activeUB(s);
        return ub ? (ub.current_page || 0) : 0;
      });
    },
  },

  /* 가입 전 임시 (pending) ─────────────────────────
     onboarding 의 rg_pending_sentence 등을 흡수 (§7.7). */
  pending: {
    get(key) {
      return localStorageAdapter.mutate(s =>
        typeof s.pending[key] === 'undefined' ? null : s.pending[key]
      );
    },
    set(key, value) {
      return localStorageAdapter.mutate(s => {
        s.pending[key] = value;
        return value;
      });
    },
  },

  /* 데이터 활용 동의 (#294) — 클라 측 플래그. 'yes' | 'no' | null(미질문). */
  consent: {
    get() { try { return localStorage.getItem('rg_data_consent'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('rg_data_consent', v); } catch (e) {} return v; },
  },

  /* 콕찌르기/응원 (pokes) — 로컬/게스트는 타 사용자 부재라 no-op(표면 일치).
     숲 마일스톤 응원이 Supabase pokes.send 와 같은 표면을 쓰도록 어댑터 대칭 유지(새 테이블 없음). */
  pokes: {
    async send() { return null; },        // 로컬은 받을 상대가 없음 → 조용히 no-op
    async listReceived() { return []; },
  },

  /* 같이읽기 기본 모드 (co-reading.md §7.5, P2) — 클라 측 플래그(consent 선례).
     'together'(기본=같이+공개) | 'solo'(혼자). 책 등록 시 공개 숲 자동합류 여부. */
  coReadMode: {
    get() { try { return localStorage.getItem('rg_coread_mode') === 'solo' ? 'solo' : 'together'; } catch (e) { return 'together'; } },
    set(v) { const m = v === 'solo' ? 'solo' : 'together'; try { localStorage.setItem('rg_coread_mode', m); } catch (e) {} return m; },
  },

  /* 독서 파트너 대화 아카이브 (#295) — 로컬/게스트는 서버 아카이브 안 함(no-op). Supabase 모드만 실저장. */
  companionSessions: {
    add() { return null; },
    countMine() { return 0; },   // 로컬/게스트는 서버 세션 없음 (#394 backfill 가드)
  },

  /* AI 완독 후 카드 (§5.8.6, #946) — Phase 0 하드코딩 시뮬. Supabase 어댑터와 표면 일치
     (둘 다 data.js 헬퍼에 위임 — 저장소 무관 로직). Phase 1+ 는 §7.9 Gemini 프록시. */
  ai: {
    recommendBooks(book) {
      return window.recommendNextBooks ? window.recommendNextBooks(book) : Promise.resolve([]);
    },
    extractBook(book, quotes) {
      return window.extractBookSummary ? window.extractBookSummary(book, quotes) : Promise.resolve(null);
    },
  },
  // 한 문장 초안 임시저장 (#1198) — 미확정 문장 뭉치. 로컬 전용(양 모드), 커밋 전까지 미기록.
  //   피처 파일이 localStorage 를 직접 만지지 않도록 계약 도메인으로 노출(어댑터만 저장소 접근).
  drafts: {
    _key(bookId) { return 'rg_sentence_drafts:' + (bookId || '_'); },
    load(bookId) {
      try { const r = JSON.parse(localStorage.getItem(this._key(bookId)) || '[]'); return (Array.isArray(r) && r.length) ? r.map(x => String(x || '')) : ['']; } catch (e) { return ['']; }
    },
    save(bookId, arr) {
      try { const k = this._key(bookId); if ((arr || []).some(x => x && x.trim())) localStorage.setItem(k, JSON.stringify(arr)); else localStorage.removeItem(k); } catch (e) { /* 초안 저장 실패 무해 */ }
    },
  },
};

window.DataStore = DataStore;
window.localStorageAdapter = localStorageAdapter;
