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
    add({ book, current_page, status }) {
      book = book || {};
      // #772 서가 복원: status='completed'면 완독으로 등록(completed_at·진척 100%). 기본 'reading'.
      const st = (status === 'completed' || status === 'reading') ? status : 'reading';
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
            rating: null, review_text: null,
            started_at: _today(), completed_at: st === 'completed' ? _today() : null, sessions: [], sentences: [],
          };
          s.user_books.push(ub);
        }
        return ub;
      });
    },
    // 스샷 서가 복원 (#772) — 책 목록 일괄 등록. items: [{book, status}]. add 재사용(중복 자동 스킵).
    addBatch(items) {
      const list = Array.isArray(items) ? items : [];
      const out = [];
      for (const it of list) {
        if (!it || !it.book) continue;
        try { out.push(this.add({ book: it.book, status: it.status })); } catch (e) { /* 개별 실패 스킵 */ }
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
        return _applyBookOverrides(ub);
      });
    },
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
      return localStorageAdapter.mutate(s => _allSentences(s).slice());
    },
    feed() {
      // 전체 공개 피드 — 최신순 (§social). Phase 0 은 내 문장만 보유.
      return localStorageAdapter.mutate(s =>
        _allSentences(s).slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      );
    },
    // 추천 (#787) — Phase 0 은 타 사용자 없음 → feed()와 동형(내 문장 최신순). 표면 일치(§7.2).
    feedRecommended() {
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
     books.complete → status='completed' + completed_at (완독 상태·별점·소감, 성 직접 지급 없음).
     castles.list → floor(totalXp / 1600) 파생 (#520/#521). 완독 권수와 분리. */
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

  /* 독서 파트너 대화 아카이브 (#295) — 로컬/게스트는 서버 아카이브 안 함(no-op). Supabase 모드만 실저장. */
  companionSessions: {
    add() { return null; },
    countMine() { return 0; },   // 로컬/게스트는 서버 세션 없음 (#394 backfill 가드)
  },
};

window.DataStore = DataStore;
window.localStorageAdapter = localStorageAdapter;
