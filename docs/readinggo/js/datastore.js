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

/* ── localStorageAdapter ────────────────────────────────
   rg_v41 키 하나에 §7.8 JSON 미러를 보관. 최초 로드 시 시드.
   Phase 1 에서는 이 객체를 supabaseAdapter 로 교체. */
const localStorageAdapter = (function () {
  let _cache = null;

  function _seed() {
    // INITIAL_STATE 의 단일 활성 책을 user_books[] 한 행으로 시드.
    const seedBook = (window.INITIAL_STATE && window.INITIAL_STATE.book) || null;
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
    }

    // 완독 책(성 컬렉션)을 INITIAL_BOOKSHELF 에서 시드 → castles.list 가
    // 데모의 실제 완독 집합(프로필 "완독" 목록과 동일)을 반영. 별도 카운터 없이
    // status==='completed' 행에서 파생(§5.2.1). 활성 책과 별개 행.
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
        last_check_in_date: null,
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

/* ── DataStore 계약 (§7.2) ───────────────────────────────
   localStorageAdapter 백킹의 실제 동작 구현 (스텁 아님). */
const DataStore = {

  /* 책 / 활성 책 ──────────────────────────────── */
  activeBook: {
    get() {
      return localStorageAdapter.mutate(s => _activeUB(s));
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
      return localStorageAdapter.mutate(s => (s.user_books || []).slice());
    },
    add({ book, current_page }) {
      book = book || {};
      return localStorageAdapter.mutate(s => {
        s.user_books = s.user_books || [];
        // 동일 책(isbn13 또는 title) 있으면 재사용 — 중복 등록 방지.
        let ub = s.user_books.find(u => u.book && ((book.isbn13 && u.book.isbn13 === book.isbn13) || (book.title && u.book.title === book.title)));
        if (!ub) {
          ub = {
            id: _dsId('ub'),
            book_id: book.id || _dsId('bk'),
            book: {
              id: book.id || '', title: book.title || '', author: book.author || '',
              publisher: book.publisher || '', total_pages: book.total_pages || 0,
              cover_url: book.cover_url || '', isbn13: book.isbn13 || '',
            },
            status: 'reading', current_page: current_page || 0,
            rating: null, review_text: null,
            started_at: _today(), completed_at: null, sessions: [], sentences: [],
          };
          s.user_books.push(ub);
        }
        return ub;
      });
    },
  },

  /* 일일 기록 (세션) ──────────────────────────────
     sessions.addToday: 그날 세션 1행 생성(같은 날 재호출 중복 방지)
     + streak.bumpOnCheckIn 연동. */
  sessions: {
    addToday({ userBookId, page }) {
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
            created_at: Date.now(),
          };
          ub.sessions.push(row);
        } else if (typeof page === 'number') {
          row.current_page = page;
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
  },

  /* 한 문장 (sentences) ───────────────────────────── */
  sentences: {
    add({ userBookId, sessionId, page, text, my_note }) {
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId) || _activeUB(s);
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
      return localStorageAdapter.mutate(s => _allSentences(s).slice());
    },
    feed() {
      // 전체 공개 피드 — 최신순 (§social). Phase 0 은 내 문장만 보유.
      return localStorageAdapter.mutate(s =>
        _allSentences(s).slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      );
    },
    // 사후 감상 추가·편집 (§5.8.4) — Supabase 어댑터와 표면 일치(§7.2)
    setNote(sentenceId, my_note) {
      return localStorageAdapter.mutate(s => {
        const se = _findSentence(s, sentenceId);
        if (se) se.my_note = my_note;
        return se;
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
    byBook() { return []; },
  },

  /* 스트릭 ──────────────────────────────────────── */
  streak: {
    get() {
      return localStorageAdapter.mutate(s => ({ ...s.streak }));
    },
    bumpOnCheckIn() {
      const today = _today();
      return localStorageAdapter.mutate(s => {
        const st = s.streak;
        if (st.last_check_in_date === today) return { ...st }; // 하루 1회만 증가
        if (st.last_check_in_date && _dayDiff(st.last_check_in_date, today) === 1) {
          st.current = (st.current || 0) + 1;
        } else {
          st.current = 1; // 끊겼거나 첫 체크인
        }
        if (st.current > (st.longest || 0)) st.longest = st.current;
        st.last_check_in_date = today;
        return { ...st };
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
     books.complete → status='completed' + completed_at.
     castles.list → status==='completed' user_books 파생 (별도 카운터 금지). */
  books: {
    complete(userBookId, opts) {
      opts = opts || {};
      return localStorageAdapter.mutate(s => {
        const ub = _ubById(s, userBookId);
        if (!ub) return null;
        ub.status = 'completed';
        ub.completed_at = _today();
        if (typeof opts.rating !== 'undefined') ub.rating = opts.rating;
        if (typeof opts.review_text !== 'undefined') ub.review_text = opts.review_text;
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
  },
  castles: {
    list() {
      return localStorageAdapter.mutate(s =>
        s.user_books.filter(ub => ub.status === 'completed')
      );
    },
  },

  /* 소셜 (짹 / 책갈피 / 관심책) ─────────────────────
     claps.toggle = 짹 (한 문장 좋아요) 토글. */
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
  },
  bookmarks: {
    toggle(sentenceId) {
      return localStorageAdapter.mutate(s => {
        if (s.bookmarks[sentenceId]) delete s.bookmarks[sentenceId];
        else s.bookmarks[sentenceId] = true;
        return !!s.bookmarks[sentenceId];
      });
    },
    // Supabase 어댑터와 표면 일치 — 책갈피한 문장 목록(sentence 임베드). 좋아요 뷰용(#11).
    list() {
      return localStorageAdapter.mutate(s => {
        const all = _allSentences(s);
        return Object.keys(s.bookmarks || {}).filter(k => s.bookmarks[k]).map(sid => {
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
    list() {
      return localStorageAdapter.mutate(s => s.wish_books.slice());
    },
    remove(bookId) {
      return localStorageAdapter.mutate(s => {
        s.wish_books = s.wish_books.filter(id => id !== bookId);
        return s.wish_books.slice();
      });
    },
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

  /* 마을 패치 — 멤버·게시판·마일스톤 변경사항 로컬 영속 ──────
     app.js 가 localStorage 를 직접 호출하지 않도록 어댑터로 위임. */
  villages: {
    _KEY: 'rg_town_patches_v1',
    patches: {
      load() {
        try { return JSON.parse(localStorage.getItem('rg_town_patches_v1') || '{}'); } catch(e) { return {}; }
      },
      save(p) {
        try { localStorage.setItem('rg_town_patches_v1', JSON.stringify(p)); } catch(e) {}
      },
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
};

window.DataStore = DataStore;
window.localStorageAdapter = localStorageAdapter;
