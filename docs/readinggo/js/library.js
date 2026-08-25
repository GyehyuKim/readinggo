/* =========================================================
   ReadingGo — library.js
   프로필 탭: 프로필 정보 + 내서재 (찜한 책, 읽는 중, 완독)
   ========================================================= */
const { useState: _useState, useEffect: _useEffect } = React;
const RG_PROMPT_LAB_ENABLED = import.meta.env.VITE_READINGGO_ENV === 'development';

/* ── ProfileView ─────────────────────────────────────– */
function _rgLocalDateKey(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function _rgShiftDateKey(key, delta) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta);
  return _rgLocalDateKey(d);
}

function _rgActivityStats(dateValues, todayKey, year, month) {
  const sourceDates = dateValues instanceof Set ? dateValues : new Set(dateValues || []);
  const dates = new Set([...sourceDates].filter((key) => key <= todayKey));
  let cursor = dates.has(todayKey) ? todayKey : _rgShiftDateKey(todayKey, -1);
  let current = 0;
  while (cursor && dates.has(cursor) && current < 40000) {
    current += 1;
    cursor = _rgShiftDateKey(cursor, -1);
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  let longest = 0;
  let run = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const key = _rgLocalDateKey(new Date(year, month, day));
    run = dates.has(key) ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return { current, longest };
}

function _rgMonthCells(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= lastDay
      ? { day, key: _rgLocalDateKey(new Date(year, month, day)) }
      : null;
  });
}

function ReadingActivityCalendar({ quotes }) {
  const now = new Date();
  const todayKey = _rgLocalDateKey(now);
  const [month, setMonth] = _useState(() => ({ year: now.getFullYear(), month: now.getMonth() }));
  const [sessionDates, setSessionDates] = _useState([]);
  const [calendarState, setCalendarState] = _useState('loading');

  _useEffect(() => {
    let alive = true;
    const selectedStart = new Date(month.year, month.month, 1);
    const daysToSelectedMonth = Math.max(0, Math.ceil((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - selectedStart) / 86400000));
    const days = Math.max(400, daysToSelectedMonth + 42);
    setCalendarState('loading');
    const effectTodayKey = _rgLocalDateKey(now);
    const quoteDates = (quotes || []).map((q) => _rgLocalDateKey(q && (q.createdAt || q.created_at))).filter((key) => key && key <= effectTodayKey);
    const load = (requestedDays) => Promise.resolve((DataStore.sessions && DataStore.sessions.calendar) ? DataStore.sessions.calendar(requestedDays) : { readDates: [] })
      .then((result) => {
        const readDates = ((result && result.readDates) || []).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && String(value) <= effectTodayKey);
        const boundaryStats = _rgActivityStats(new Set(readDates.concat(quoteDates)), _rgLocalDateKey(now), now.getFullYear(), now.getMonth());
        if (boundaryStats.current >= requestedDays - 2 && requestedDays < 40000) {
          return load(Math.min(requestedDays * 2, 40000));
        }
        return readDates;
      });
    load(days)
      .then((readDates) => {
        if (!alive) return;
        // session_date는 이미 사용자 로컬 YYYY-MM-DD다. JS Date로 재파싱하지 않는다.
        setSessionDates(Array.from(new Set(readDates)));
        setCalendarState('ready');
      })
      .catch(() => {
        if (!alive) return;
        setSessionDates([]);
        setCalendarState('error');
      });
    return () => { alive = false; };
  }, [month.year, month.month, quotes]);

  const sentenceDates = (quotes || []).map((q) => _rgLocalDateKey(q && (q.createdAt || q.created_at))).filter((key) => key && key <= todayKey);
  const activityDates = new Set(sessionDates.concat(sentenceDates));
  const stats = _rgActivityStats(activityDates, todayKey, month.year, month.month);
  const cells = _rgMonthCells(month.year, month.month);
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const selectedMonthIndex = month.year * 12 + month.month;
  const moveMonth = (delta) => {
    const next = new Date(month.year, month.month + delta, 1);
    if (next.getFullYear() * 12 + next.getMonth() > currentMonthIndex) return;
    setMonth({ year: next.getFullYear(), month: next.getMonth() });
  };
  const activeCount = cells.filter((cell) => cell && activityDates.has(cell.key)).length;

  return (
    <section className="rg-activity" aria-labelledby="rg-activity-title">
      <div className="rg-activity-head">
        <div>
          <h2 id="rg-activity-title">독서 리듬</h2>
          <p>페이지를 읽거나 한 문장을 남긴 날</p>
        </div>
        <div className="rg-activity-nav" aria-label="활동 월 이동">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
          <strong>{month.year}년 {month.month + 1}월</strong>
          <button type="button" onClick={() => moveMonth(1)} disabled={selectedMonthIndex >= currentMonthIndex} aria-label="다음 달">›</button>
        </div>
      </div>
      {calendarState === 'error' ? (
        <div className="rg-activity-message">활동 기록을 불러오지 못했어요</div>
      ) : (
        <>
          <div className="rg-activity-summary" aria-live="polite">
            <span><strong>{stats.current}</strong>일 현재 연속</span>
            <span><strong>{stats.longest}</strong>일 이달 최장</span>
            <span><strong>{activeCount}</strong>일 활동</span>
          </div>
          <div className="rg-activity-weekdays" aria-hidden="true">
            {['일','월','화','수','목','금','토'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="rg-activity-grid" role="grid" aria-label={`${month.year}년 ${month.month + 1}월 독서 활동`} aria-busy={calendarState === 'loading'}>
            {cells.map((cell, index) => cell ? (
              <div key={cell.key} role="gridcell"
                className={`rg-activity-day${activityDates.has(cell.key) ? ' on' : ''}${cell.key === todayKey ? ' today' : ''}`}
                aria-label={`${month.month + 1}월 ${cell.day}일, 독서 활동 ${activityDates.has(cell.key) ? '있음' : '없음'}`}>
                {cell.day}
              </div>
            ) : <div key={`empty-${index}`} className="rg-activity-day empty" aria-hidden="true" />)}
          </div>
          {calendarState === 'ready' && activeCount === 0 && <div className="rg-activity-message">이달의 첫 독서를 기다리고 있어요</div>}
        </>
      )}
    </section>
  );
}

// 위시 행 → 표시용 책 (#403). 양 어댑터 모두 {book_id, book} 객체 반환(로컬은 datastore에서 getBook 해소).
function _mapWish(w) {
  const b = (w && w.book) || w || {};
  return { id: b.id || w.book_id, title: b.title || '', author: b.author || '', pub: b.publisher || '', cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], total: b.total_pages || 0, isbn: b.isbn13 || '', cur: 0, status: 'wish', updatedAt: w.created_at || '' };
}

function _mapUserBook(ub) {
  const b = ub.book || {};
  return {
    ubId: ub.id, id: ub.book_id,
    title: b.title || '제목 없음', author: b.author || '', pub: b.publisher || '',
    cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'],
    total: b.total_pages || 0, isbn: b.isbn13 || '',
    cur: ub.current_page || 0, status: ub.status,
    rating: ub.rating, comment: ub.review_text, completedAt: ub.completed_at,
    updatedAt: (ub.status === 'completed' ? ub.completed_at : ub.started_at) || '',
    recap: ub.companion_recap || '',
    description: (b.description || '').trim(),
    source: b.source || '',
  };
}

function LibraryView({ state, onActivateUserBook, mode = 'combined' }) {
  const [selectedBookId, setSelectedBookId] = _useState(null);
  const [includedStatuses, setIncludedStatuses] = _useState(() => new Set(['wish', 'reading', 'completed', 'aborted']));
  // 통합 서재 정렬. key=정렬축('recent'|'rating'|'title'), dir=방향(1=최근·높은·ㄱ→ㅎ, -1=반대).
  const [librarySort, setLibrarySort] = _useState({ key: 'recent', dir: 1 });
  // 같은 버튼 반복 클릭 시 두 방향을 전환하고, 다른 버튼은 1차 방향으로 시작한다.
  const cycleSort = (key) => setLibrarySort(prev =>
    prev.key !== key ? { key, dir: 1 }     // 다른 축 → 1차
      : { key, dir: prev.dir === 1 ? -1 : 1 }
  );
  // 읽은 책 별점 필터 (#795) — 다중선택 버킷 Set(빈 Set=전체). 'none'=무평점(OCR 임포트 등 대량 유입 대비).
  const [ratingFilter, setRatingFilter] = _useState(() => new Set());
  const [ratingSheetOpen, setRatingSheetOpen] = _useState(false);
  const [myBooks, setMyBooks] = _useState(null);   // null=로딩
  const [wishlistBooks, setWishlistBooks] = _useState([]);
  const [stagedItems, setStagedItems] = _useState([]);    // 📦 검토함(import_staging) — 로그인 전용 임포트 스테이징 (#1048)
  const [stagedStatus, setStagedStatus] = _useState({});  // 검토함 항목별 목적지 토글 {id: 'completed'|'wish'|'reading'} (기본 suggested_status)
  const [savedCount, setSavedCount] = _useState(0); // ❤️ 저장(북마크) 문장 수 — stats행 (#471/#472)
  const [followCounts, setFollowCounts] = _useState({ following: 0, followers: 0 }); // 팔로잉/팔로워 수 (#516)
  const [followModal, setFollowModal] = _useState(null); // null | 'following' | 'followers' — 유저 목록 모달 (#509)
  // 좋아요한 문장은 내 한 문장 "전체 보기" 컬렉션 모달 내 필터로 이동 (#12)
  const [adminOpen, setAdminOpen] = _useState(false); // 운영 대시보드 (#161)
  const [promptLabOpen, setPromptLabOpen] = _useState(false); // 합성 prompt 실험실 (#1304)
  const [promptLabAccess, setPromptLabAccess] = _useState(null); // 서버 역할 확인 결과. UI 숨김은 편의일 뿐 권한 아님.
  const [importOpen, setImportOpen] = _useState(false); // 타사 앱 밑줄 가져오기 (#1150)
  const [bulkImportOpen, setBulkImportOpen] = _useState(false); // 한번에 추가하기 서브 선택지 토글
  const [sentenceImportOpen, setSentenceImportOpen] = _useState(false); // 문장 가져오기 바텀시트
  const [wikiOpening, setWikiOpening] = _useState(false); // 독서 위키 상시 진입점 중복 탭 방지 (#1274)
  const openWikiAsk = async () => {
    if (wikiOpening) return;
    setWikiOpening(true);
    try {
      const rows = await Promise.resolve((DataStore.sentences && DataStore.sentences.listMine) ? DataStore.sentences.listMine() : []);
      if (!Array.isArray(rows) || rows.length === 0) {
        showToast('먼저 홈에서 마음에 든 한 문장을 저장해 보세요');
        return;
      }
      if (window.RG_openCollection) window.RG_openCollection({ mode: 'ask' });
    } catch (e) {
      showToast('내 문장을 불러오지 못했어요 — 잠시 후 다시');
    } finally {
      setWikiOpening(false);
    }
  };
  // 한 줄 소개 인라인 편집 (#515) — 설정 탭에서 이동, 프로필 헤더에서 직접 수정.
  const [bioEditing, setBioEditing] = _useState(false);
  const [bioText, setBioText] = _useState((window.RG_ME && window.RG_ME.bio) || '');
  const saveBio = () => {
    const v = bioText.trim().slice(0, 100);
    Promise.resolve(DataStore.profile.update({ bio: v || null }))
      .then(() => { if (window.RG_ME) window.RG_ME.bio = v; setBioEditing(false); showToast('소개 저장됨'); })
      .catch(() => showToast('저장 실패 — 잠시 후 다시'));
  };
  // 닉네임 인라인 편집 (#568) — SettingsModal에서 이동, bio 패턴 동일하게.
  const [hdlEditing, setHdlEditing] = _useState(false);
  const [hdlText, setHdlText] = _useState((window.RG_ME && window.RG_ME.handle) || '');
  const [hdlMsg, setHdlMsg] = _useState('');
  const [hdlBusy, setHdlBusy] = _useState(false);
  const saveHandle = async () => {
    if (hdlBusy) return;
    const V = window.RG_VALIDATE || {};
    const r = V.handle ? V.handle(hdlText) : { ok: true, value: (hdlText || '').replace(/^@/, '').trim() };
    if (!r.ok) { setHdlMsg(r.msg); return; }
    const me = window.RG_ME || {};
    if (r.value === (me.handle || '')) { setHdlEditing(false); setHdlMsg(''); return; }
    setHdlBusy(true); setHdlMsg('확인 중…');
    try {
      const ok = (DataStore.users && DataStore.users.isHandleAvailable)
        ? await Promise.resolve(DataStore.users.isHandleAvailable(r.value)) : true;
      if (!ok) { setHdlMsg('이미 사용 중인 닉네임이에요'); return; }
      if (DataStore.profile && DataStore.profile.update) await Promise.resolve(DataStore.profile.update({ handle: r.value, display_name: r.value }));
      if (window.RG_ME) { window.RG_ME.handle = r.value; window.RG_ME.displayName = r.value; }
      setHdlEditing(false); setHdlMsg(''); showToast('닉네임 저장됨 — 새로고침하면 피드에 반영돼요');
    } catch (e) { setHdlMsg('이미 사용 중이거나 저장 실패'); }
    finally { setHdlBusy(false); }
  };
  const isAdmin = !!(window.RG_ME && window.RG_ME.isAdmin);

  // 융디 editor / Hyu promoter는 is_admin UI 플래그와 별도다. Worker가 실제 세션 UUID와
  // active grant를 확인한 결과만 진입 버튼에 반영하며, 모든 후속 API도 다시 서버에서 검사한다.
  _useEffect(() => {
    let alive = true;
    if (!RG_PROMPT_LAB_ENABLED) return () => { alive = false; };
    if (!window.RG_promptLab || !window.RG_SB || !window.RG_SB.accessToken) return () => { alive = false; };
    Promise.resolve(window.RG_promptLab('access')).then((r) => {
      if (alive && r && r.allowed) setPromptLabAccess(r.actor || {});
    }).catch(() => { if (alive) setPromptLabAccess(null); });
    return () => { alive = false; };
  }, []);

  // 내 책(읽는중/완독) + 관심책 — 실 Supabase (양 어댑터 정규화). 데모 상수 미사용.
  _useEffect(() => {
    let alive = true;
    const loadSavedCount = () => Promise.resolve((DataStore.claps && DataStore.claps.list) ? DataStore.claps.list() : [])
      .then(rows => { if (alive) setSavedCount((rows || []).filter(row => row && row.sentence).length); }).catch(() => {});
    Promise.resolve(DataStore.myBooks.list()).then(rows => {
      if (!alive) return;
      setMyBooks((rows || []).map(_mapUserBook));
    }).catch(() => { if (alive) setMyBooks([]); });
    Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).then(rows => {
      if (!alive) return;
      setWishlistBooks((rows || []).map(_mapWish));
    }).catch(() => { if (alive) setWishlistBooks([]); });
    // ❤️ 좋아요한 문장 수 — stats행 카운트 (#471/#472→#641 claps 단일)
    loadSavedCount();
    // 팔로잉/팔로워 수 — Supabase friends.counts (게스트/localStorage는 메서드 부재 → 0 유지) (#516)
    Promise.resolve((DataStore.friends && DataStore.friends.counts) ? DataStore.friends.counts() : { following: 0, followers: 0 }).then(c => { if (alive) setFollowCounts(c || { following: 0, followers: 0 }); }).catch(() => {});
    window.addEventListener('rg:clap-changed', loadSavedCount);
    return () => { alive = false; window.removeEventListener('rg:clap-changed', loadSavedCount); };
  }, []);

  // 회고 저장 시 myBooks 의 해당 book.recap 즉시 갱신 (#404) — 모달 재오픈 시 stale 빈 화면 방지.
  _useEffect(() => {
    const onRecap = (e) => {
      const d = e && e.detail; if (!d) return;
      setMyBooks((prev) => (prev || []).map((b) => (b.ubId === d.ubId || b.id === d.bookId) ? { ...b, recap: d.recap } : b));
    };
    window.addEventListener('rg:recap-saved', onRecap);
    return () => window.removeEventListener('rg:recap-saved', onRecap);
  }, []);

  // 완독 메타데이터 저장 성공 시 목록 projection도 즉시 갱신한다 (#1402).
  _useEffect(() => {
    const onReview = (e) => {
      const d = e && e.detail; if (!d) return;
      setMyBooks((prev) => (prev || []).map((b) => (b.ubId === d.ubId || b.id === d.bookId) ? { ...b, comment: d.review } : b));
    };
    const onRating = (e) => {
      const d = e && e.detail; if (!d) return;
      setMyBooks((prev) => (prev || []).map((b) => (b.ubId === d.ubId || b.id === d.bookId) ? { ...b, rating: d.rating } : b));
    };
    window.addEventListener('rg:book-review-saved', onReview);
    window.addEventListener('rg:book-rating-saved', onRating);
    return () => {
      window.removeEventListener('rg:book-review-saved', onReview);
      window.removeEventListener('rg:book-rating-saved', onRating);
    };
  }, []);

  // 위시리스트/완독 변경(검색 책장 선택·찜 삭제·완독 추가, #403/#409) → 목록 즉시 갱신.
  _useEffect(() => {
    const reload = () => {
      Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).then(rows => {
        setWishlistBooks((rows || []).map(_mapWish));
      }).catch(() => {});
      Promise.resolve(DataStore.myBooks.list()).then(rows => {
        setMyBooks((rows || []).map(_mapUserBook));
      }).catch(() => {});
    };
    window.addEventListener('rg:wish-changed', reload);
    return () => window.removeEventListener('rg:wish-changed', reload);
  }, []);

  // 📦 검토함(import_staging, #1048) 로드 + 갱신 구독. 로그인 전용 — local(게스트)은 importStaging.list()
  // no-op([]) → 섹션 미노출. shelf-import 적재(rg:import-staged)·책장 이동/제외 후 재로드. 메서드 부재(구버전) 가드.
  _useEffect(() => {
    let alive = true;
    const load = () => {
      Promise.resolve((DataStore.importStaging && DataStore.importStaging.list) ? DataStore.importStaging.list() : [])
        .then((rows) => { if (alive) setStagedItems(Array.isArray(rows) ? rows : []); })
        .catch(() => { if (alive) setStagedItems([]); });
    };
    load();
    window.addEventListener('rg:import-staged', load);
    return () => { alive = false; window.removeEventListener('rg:import-staged', load); };
  }, []);


  // 찜 삭제 (#403) — 위시리스트 카드 ✕. 낙관적 제거 + 토스트.
  const removeWish = (e, bookId) => {
    if (e) e.stopPropagation();
    setWishlistBooks((prev) => prev.filter((w) => w.id !== bookId));
    if (DataStore.wishBooks && DataStore.wishBooks.remove) Promise.resolve(DataStore.wishBooks.remove(bookId)).catch(() => {});
    showToast('찜 목록에서 제거했어요');
  };

  // 📦 검토함(#1048) 액션 — 항목별 목적지(책장 토글)·이동(commit, 별점 보존)·제외(remove) + 일괄.
  const STAGED_DESTS = window.RG_SHELF_STATUS_OPTIONS;
  const stagedDestOf = (it) => stagedStatus[it.id] || it.suggested_status || 'completed';
  const setStagedDest = (id, st) => setStagedStatus((m) => ({ ...m, [id]: st }));
  // 검토함 → 내 서재로 이동. commit 이 myBooks.addBatch 라우팅(별점 보존) 후 staging row 삭제.
  // 낙관적 제거 + 성공 시 rg:wish-changed(서재 갱신) / 실패 시 rg:import-staged 로 재로드 복구.
  const moveStaged = (it) => {
    if (!(DataStore.importStaging && DataStore.importStaging.commit)) return;
    const st = stagedDestOf(it);
    setStagedItems((prev) => prev.filter((x) => x.id !== it.id));
    Promise.resolve(DataStore.importStaging.commit(it.id, st))
      .then(() => { window.dispatchEvent(new CustomEvent('rg:wish-changed')); })
      .catch(() => { window.dispatchEvent(new CustomEvent('rg:import-staged')); });
    showToast(st === 'wish' ? '읽고싶어요로 옮겼어요' : '내 서재로 옮겼어요');
  };
  const excludeStaged = (it) => {
    if (!(DataStore.importStaging && DataStore.importStaging.remove)) return;
    setStagedItems((prev) => prev.filter((x) => x.id !== it.id));
    Promise.resolve(DataStore.importStaging.remove(it.id)).catch(() => {});
    showToast('검토함에서 제외했어요');
  };
  const moveAllStaged = () => {
    const list = stagedItems.slice();
    if (!list.length || !(DataStore.importStaging && DataStore.importStaging.commit)) return;
    setStagedItems([]);
    Promise.all(list.map((it) => Promise.resolve(DataStore.importStaging.commit(it.id, stagedDestOf(it))).catch(() => null)))
      .then(() => { window.dispatchEvent(new CustomEvent('rg:wish-changed')); window.dispatchEvent(new CustomEvent('rg:import-staged')); });
    showToast(`${list.length}권을 내 서재로 옮겼어요`);
  };
  const excludeAllStaged = () => {
    const list = stagedItems.slice();
    if (!list.length || !(DataStore.importStaging && DataStore.importStaging.remove)) return;
    setStagedItems([]);
    Promise.all(list.map((it) => Promise.resolve(DataStore.importStaging.remove(it.id)).catch(() => null)))
      .then(() => { window.dispatchEvent(new CustomEvent('rg:import-staged')); });
    showToast('검토함을 비웠어요');
  };

  const books = myBooks || [];
  const allItems = books.concat(wishlistBooks.filter(w => !books.some(b => b.id === w.id)));
  const selectedBook = selectedBookId ? (allItems.find(x => x.id === selectedBookId) || null) : null;
  const statusFilters = [
    { id: 'wish', label: '읽고 싶어요' },
    { id: 'reading', label: '읽는 중' },
    { id: 'completed', label: '읽었어요' },
    { id: 'aborted', label: '중단' },
  ];
  const toggleStatus = (status) => setIncludedStatuses((prev) => {
    const next = new Set(prev);
    if (next.has(status)) next.delete(status); else next.add(status);
    return next;
  });
  // 별점 버킷 (#795): 무평점→'none', 5.0→'5', 4.x→'4' … 0.5~1.x→'1'. 빈 Set=전체.
  const ratingBucket = (r) => (r == null || r === 0) ? 'none' : (r >= 5 ? '5' : (r >= 1 ? String(Math.floor(r)) : '1'));
  const displayBooks = allItems
    .filter((b) => includedStatuses.has(b.status))
    .filter((b) => ratingFilter.size === 0 || ratingFilter.has(ratingBucket(b.rating)))
    .slice()
    .sort((a, b) => {
      const d = librarySort.dir;
      if (librarySort.key === 'title') {
        const aMissing = !a.title;
        const bMissing = !b.title;
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        return (a.title || '').localeCompare(b.title || '') * d;
      }
      if (librarySort.key === 'rating') {
        const aMissing = a.rating == null || a.rating === 0;
        const bMissing = b.rating == null || b.rating === 0;
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        return ((b.rating || 0) - (a.rating || 0)) * d;
      }
      const aDate = String(a.updatedAt || '');
      const bDate = String(b.updatedAt || '');
      if (!aDate !== !bDate) return aDate ? -1 : 1;
      return bDate.localeCompare(aDate) * d;
    });

  const currentBookIds = displayBooks.map(b => b.id);
  const tabQuotes = (state.myQuotes || [])
    .filter(q => currentBookIds.includes(q.bookId))
    .sort((a, b) => {
      const dateA = String(a.when || a.createdAt || '');
      const dateB = String(b.when || b.createdAt || '');
      return dateB.localeCompare(dateA); // 최신순
    });

  const showProfile = mode !== 'library';
  const showLibrary = mode !== 'profile';

  return (
    <section className="view active" data-library-mode={mode}>
      {/* 프로필 정보 (#508) — 닉네임·한 줄 소개·팔로잉/팔로워/저장을 최상단으로(#428 '둥지 최상단' → 재배치, SNS 표준 UX) */}
      {showProfile && <div style={{padding:'16px 16px 20px', position:'relative', textAlign:'center'}}>
        <div style={{position:'absolute', top:0, right:12, display:'flex', gap:8}}>
          {/* 설정 ⚙️는 하단 '설정' 탭으로 이전 (#488). 운영 대시보드(📊)만 헤더 유지. */}
          {isAdmin && (
            <button onClick={() => setAdminOpen(true)} title="운영 대시보드"
              style={{background:'var(--card)', border:'1px solid var(--line)', borderRadius:'50%', width:34, height:34, fontSize:16, cursor:'pointer', color:'var(--ink-2)', lineHeight:1}}>📊</button>
          )}
          {RG_PROMPT_LAB_ENABLED && promptLabAccess && (
            <button onClick={() => setPromptLabOpen(true)} title="Prompt Lab" aria-label="Prompt Lab 열기"
              style={{background:'var(--brand-soft)', border:'1px solid var(--brand-soft)', borderRadius:12, height:34, padding:'0 10px', display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer', color:'var(--brand-3)', fontSize:11, fontWeight:900}}>{window.rgIcon('pen',14)} Lab</button>
          )}
        </div>
        {/* 닉네임 인라인 편집 (#568) — 탭 → 입력, Enter/저장 → 저장, ESC/바깥 → 취소 */}
        {hdlEditing ? (
          <div style={{marginTop:2, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
            <div style={{display:'flex', gap:6, alignItems:'center', justifyContent:'center'}}>
              <window.SparrowMark size={22} />
              <span style={{color:'var(--ink-3)', fontWeight:800, fontSize:16}}>@</span>
              <input value={hdlText} maxLength={20} autoFocus
                onChange={e => { setHdlText(e.target.value); setHdlMsg(''); }}
                onKeyDown={e => { if (e.key === 'Enter') saveHandle(); else if (e.key === 'Escape') { setHdlText((window.RG_ME && window.RG_ME.handle) || ''); setHdlEditing(false); setHdlMsg(''); } }}
                onBlur={() => { if (!hdlBusy) { setHdlText((window.RG_ME && window.RG_ME.handle) || ''); setHdlEditing(false); setHdlMsg(''); } }}
                placeholder="닉네임"
                style={{fontSize:16, fontWeight:900, padding:'4px 8px', border:'1.5px solid var(--brand)', borderRadius:12, color:'var(--ink)', background:'var(--card)', width:120, textAlign:'center'}} />
              <button onMouseDown={e => { e.preventDefault(); saveHandle(); }} disabled={hdlBusy}
                style={{padding:'4px 12px', borderRadius:12, border:'none', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:800, cursor:hdlBusy ? 'default' : 'pointer', opacity:hdlBusy ? 0.6 : 1}}>저장</button>
            </div>
            {hdlMsg && <div style={{fontSize:11, color: hdlMsg.indexOf('✓') === 0 ? 'var(--brand)' : '#d33', fontWeight:700}}>{hdlMsg}</div>}
          </div>
        ) : (
          <div onClick={() => { setHdlText((window.RG_ME && window.RG_ME.handle) || ''); setHdlEditing(true); setHdlMsg(''); }}
            title="탭하여 닉네임 편집"
            style={{fontSize:22, fontWeight:900, color:'var(--ink)', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6}}>
            <window.SparrowMark size={24} /> {(window.RG_ME && (window.RG_ME.displayName || window.RG_ME.handle)) || '독자'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
        )}
        {/* 한 줄 소개 인라인 편집 (#515) — 탭 → 입력, Enter/저장 → 저장, ESC/바깥 → 취소 */}
        {bioEditing ? (
          <div style={{marginTop:4, display:'flex', gap:6, alignItems:'center', justifyContent:'center'}}>
            <input value={bioText} maxLength={100} autoFocus
              onChange={e => setBioText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveBio(); else if (e.key === 'Escape') { setBioText((window.RG_ME && window.RG_ME.bio) || ''); setBioEditing(false); } }}
              onBlur={() => { setBioText((window.RG_ME && window.RG_ME.bio) || ''); setBioEditing(false); }}
              placeholder="한 줄 소개를 입력해보세요"
              style={{flex:1, fontSize:13, padding:'4px 8px', border:'1px solid var(--line)', borderRadius:12, color:'var(--ink)', background:'var(--card)'}} />
            <button onMouseDown={e => { e.preventDefault(); saveBio(); }}
              style={{padding:'4px 12px', borderRadius:12, border:'none', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer'}}>저장</button>
          </div>
        ) : (
          <div onClick={() => { setBioText((window.RG_ME && window.RG_ME.bio) || ''); setBioEditing(true); }}
            title="탭하여 한 줄 소개 편집"
            style={{fontSize:13, color:'var(--ink-3)', marginTop:4, minHeight:18, cursor:'pointer'}}>
            <span style={{display:'inline-flex', alignItems:'center', gap:4}}>
              {(window.RG_ME && window.RG_ME.bio) ? window.RG_ME.bio : '한 줄 소개를 입력해보세요'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </span>
          </div>
        )}
        <div style={{display:'flex', justifyContent:'space-around', marginTop:14, padding:'0 8px'}}>
          <button onClick={() => setFollowModal('following')}
            style={{textAlign:'center', background:'none', border:'none', cursor:'pointer', padding:0}}>
            <div style={{fontSize:17, fontWeight:900, color:'var(--ink)'}}>{followCounts.following}</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>팔로잉</div>
          </button>
          <button onClick={() => setFollowModal('followers')}
            style={{textAlign:'center', background:'none', border:'none', cursor:'pointer', padding:0}}>
            <div style={{fontSize:17, fontWeight:900, color:'var(--ink)'}}>{followCounts.followers}</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2}}>팔로워</div>
          </button>
          <button onClick={() => window.RG_openCollection && window.RG_openCollection({ filter: 'fav' })}
            style={{textAlign:'center', background:'none', border:'none', cursor:'pointer', padding:0}}>
            <div style={{fontSize:17, fontWeight:900, color:'var(--ink)'}}>{savedCount}</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:2, display:'flex', alignItems:'center', justifyContent:'center', gap:3}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              좋아요
            </div>
          </button>
        </div>
      </div>}

      {showProfile && <ReadingActivityCalendar quotes={state.myQuotes || []} />}

      {/* 독서 위키 상시 진입점 (#1274) — 활성 책 문장 수와 무관하게 책장에서 발견 가능. */}
      {showProfile && <div style={{padding:'0 16px', margin:'0 0 20px'}}>
        <button onClick={openWikiAsk} disabled={wikiOpening}
          aria-label="내 문장에게 묻기"
          style={{width:'100%', boxSizing:'border-box', border:'1px solid var(--brand-soft)', borderRadius:16, background:'var(--brand-tint)', color:'var(--ink)', padding:'14px 16px', cursor:wikiOpening?'default':'pointer', opacity:wikiOpening?0.7:1, display:'flex', alignItems:'center', gap:12, textAlign:'left'}}>
          <span aria-hidden="true" style={{width:36, height:36, borderRadius:12, background:'var(--brand-soft)', color:'var(--brand-3)', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            {window.rgIcon('search',18)}
          </span>
          <span style={{minWidth:0, flex:1}}>
            <span style={{display:'block', fontSize:14, fontWeight:900, lineHeight:1.35}}>내 문장에게 묻기</span>
            <span style={{display:'block', marginTop:3, fontSize:12, fontWeight:600, color:'var(--ink-3)', lineHeight:1.45}}>모아둔 문장에서 생각과 연결을 찾아보세요</span>
          </span>
          <span aria-hidden="true" style={{color:'var(--brand-3)', fontSize:18, flexShrink:0}}>›</span>
        </button>
      </div>}


      {/* 📖 독서 기록 섹션(총 독서시간·일평균) 제거 (#471). duration_sec 저장(#430)은 유지(미표시). */}

      {/* 내 한 문장 섹션 제거(#439) — 프로필 → 내서재 → 읽고 있는 책 클릭 → 책 상세에서 그 책의 한 문장 + 참새 대화 확인 */}

      {/* 내 서재 섹션 */}
      {showLibrary && <div style={{padding:'16px 16px 0', marginBottom:20}}>
        {/* 상시 임포트 진입점 — 텍스트/파일 가져오기(#1039, 1순위)와 스샷 복원(#772, #832)을 나란히.
            DESIGN 3차(텍스트·아이콘) 버튼 위계. 빈 서가 큰 CTA(아래)는 유지. 텍스트/파일을 먼저(왼쪽). */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <div style={{fontSize:16, fontWeight:900, color:'var(--ink)', letterSpacing:'-0.3px'}}>내 서재</div>
          <button onClick={() => setBulkImportOpen(true)}
            style={{display:'inline-flex', alignItems:'center', gap:4, background:'var(--brand-tint)', border:'1px solid var(--brand-soft)', borderRadius:999, padding:'5px 10px', color:'var(--brand-3)', fontSize:12, fontWeight:800, cursor:'pointer', lineHeight:1}}>
            + 책 추가하기
          </button>
        </div>

        {/* 📦 검토함 (#1048) — 임포트가 책장 직행 대신 여기로 적재. 항목별 책장 토글 + [내 서재로][제외] + 일괄.
            로그인 전용(local/게스트는 stagedItems=[]로 미노출). 영속(import_staging) — 세션 넘어 유지. */}
        {stagedItems.length > 0 && (
          <div style={{marginBottom:18, border:'1.5px solid var(--brand)', borderRadius:12, background:'var(--brand-tint)', padding:'12px 12px 14px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8}}>
              <div style={{fontSize:13.5, fontWeight:900, color:'var(--brand-3)', display:'inline-flex', alignItems:'center', gap:5}}>{window.rgIcon('box',15)} 가져온 책 {stagedItems.length}권 · 검토</div>
              <div style={{display:'flex', gap:6, flexShrink:0}}>
                <button onClick={moveAllStaged}
                  style={{fontSize:11, fontWeight:800, color:'#fff', background:'var(--brand)', border:'none', borderRadius:12, padding:'5px 9px', cursor:'pointer'}}>전체 이동</button>
                <button onClick={excludeAllStaged}
                  style={{fontSize:11, fontWeight:800, color:'var(--ink-2)', background:'var(--card)', border:'1px solid var(--line)', borderRadius:12, padding:'5px 9px', cursor:'pointer'}}>전체 제외</button>
              </div>
            </div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:10, lineHeight:1.5}}>
              스샷에서 찾은 책이에요. 책장을 고르고 <b>내 서재로</b> 옮기거나, 아닌 책은 <b>제외</b>하세요.
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {stagedItems.map((it) => {
                const dest = stagedDestOf(it);
                // 상태 판정: 카탈로그 매칭(book_id) > ISBN+표지 확인(isbn13) > 미확인.
                // 알라딘으로 ISBN·표지가 채워졌지만 캐노니컬 book_id 없는 책은 '확인됨'(긍정)으로 — '미확인' 오해 방지.
                const stageStatus = it.book_id
                  ? { label: '매칭됨', dim: false }
                  : (it.isbn13 ? { label: '확인됨', dim: false } : { label: '미확인', dim: true });
                return (
                  <div key={it.id} style={{display:'flex', alignItems:'center', gap:10, background:'var(--card)', border:'1px solid var(--line)', borderRadius:12, padding:'8px 10px'}}>
                    <BookCover title={it.title} author={it.author || ''} cover={it.cover_url || ''} fb={['#9AA7B2','#C7D0D8']} style={{width:34, height:48, borderRadius:12, flexShrink:0}} />
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:800, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{it.title}</div>
                      <div style={{fontSize:11, color:'var(--ink-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                        {it.author || '저자 미상'}
                        {typeof it.rating === 'number' && it.rating > 0 ? ` · ★ ${it.rating}` : ''}
                        {' · '}
                        <span style={{color: stageStatus.dim ? 'var(--ink-3)' : 'var(--brand)', fontWeight: stageStatus.dim ? 400 : 700}}>{stageStatus.label}</span>
                      </div>
                      <div style={{display:'flex', gap:4, marginTop:6}}>
                        {STAGED_DESTS.map((d) => (
                          <button key={d.value} onClick={() => setStagedDest(it.id, d.value)}
                            style={{fontSize:10, fontWeight:800, padding:'3px 7px', borderRadius:999, cursor:'pointer',
                              border: dest === d.value ? '1.5px solid var(--brand)' : '1px solid var(--line)',
                              background: dest === d.value ? 'var(--brand)' : 'var(--card)',
                              color: dest === d.value ? '#fff' : 'var(--ink-2)'}}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:5, flexShrink:0}}>
                      <button onClick={() => moveStaged(it)}
                        style={{fontSize:11, fontWeight:800, color:'#fff', background:'var(--brand)', border:'none', borderRadius:12, padding:'6px 9px', cursor:'pointer', whiteSpace:'nowrap'}}>내 서재로</button>
                      <button onClick={() => excludeStaged(it)}
                        style={{fontSize:11, fontWeight:800, color:'var(--ink-3)', background:'transparent', border:'none', borderRadius:12, padding:'6px 9px', cursor:'pointer', whiteSpace:'nowrap'}}>제외</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 네 상태 통합 projection의 포함·제외 filter */}
        <div className="rg-shelf-filters" aria-label="서재 상태 필터">
          {statusFilters.map(filter => {
            const active = includedStatuses.has(filter.id);
            const count = allItems.filter((book) => book.status === filter.id).length;
            return (
            <button
              key={filter.id}
              type="button"
              className={`rg-shelf-filter${active ? ' on' : ''}`}
              aria-pressed={active}
              onClick={() => toggleStatus(filter.id)}
            >
              {filter.label} {count}
            </button>
            );
          })}
        </div>

        {/* 찜하기 버튼(구 #403, 위시 탭 전용)은 '내 서재' 타이틀 아래 상시 '책 찾아 담기'로 승격·이전(#1060).
            위시 전용 중복 버튼은 제거 — 같은 RG_openSearch 진입이고 이제 항상 보인다. */}

        {/* 통합 서재 정렬/별점 필터 */}
        {allItems.length > 0 && (
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16, paddingLeft:4}}>
            {/* 3단 토글 (#649): 활성 축은 방향에 따라 라벨/화살표를 바꿔 표시. 비활성은 1차 방향 라벨. */}
            {[
              ['recent', { 1: '최근', '-1': '오래된' }],
              ['rating', { 1: '별점 ↑', '-1': '별점 ↓' }],
              ['title', { 1: '제목 ↑', '-1': '제목 ↓' }],
            ].map(([id, labels]) => {
              const active = librarySort.key === id;
              const label = active ? labels[librarySort.dir] : labels[1];
              return (
                <button key={id} onClick={() => cycleSort(id)}
                  style={{padding:'6px 12px', borderRadius:999, border:'none', fontSize:12, fontWeight:800, cursor:'pointer', background: active ? 'var(--brand)' : 'var(--card)', color: active ? '#fff' : 'var(--ink-2)', boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--line)'}}>{label}</button>
              );
            })}
            <button onClick={() => setRatingSheetOpen(true)}
              style={{padding:'6px 12px', borderRadius:999, border:'none', fontSize:12, fontWeight:800, cursor:'pointer', background: ratingFilter.size ? 'var(--gold)' : 'var(--card)', color: ratingFilter.size ? '#fff' : 'var(--ink-2)', boxShadow: ratingFilter.size ? 'none' : 'inset 0 0 0 1px var(--line)'}}>★ 별점{ratingFilter.size ? ` ${ratingFilter.size}` : ''}</button>
          </div>
        )}

        {/* 별점 필터 바텀시트 (#795·#807) — createPortal로 .view 밖(body)에 렌더.
            .view의 fadeUp 애니메이션(transform)이 containing block을 만들어 position:fixed를
            가두는 문제 방지 — 이 코드베이스 모달 표준 패턴(app.js/library.js 다른 모달과 동일). */}
        {ratingSheetOpen && ReactDOM.createPortal((
          <div onClick={() => setRatingSheetOpen(false)}
            style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1200, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
            <div onClick={(e) => e.stopPropagation()}
              style={{width:'100%', maxWidth:480, background:'var(--card)', borderRadius:'18px 18px 0 0', padding:'18px 18px calc(env(safe-area-inset-bottom) + 18px)'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
                <span style={{fontSize:15, fontWeight:900, color:'var(--ink)'}}>별점 필터</span>
                <button onClick={() => setRatingFilter(new Set())}
                  style={{background:'none', border:'none', color:'var(--ink-3)', fontSize:13, fontWeight:700, cursor:'pointer'}}>초기화</button>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16}}>
                {[['5','★ 5점'],['4','★ 4점대'],['3','★ 3점대'],['2','★ 2점대'],['1','★ 1점대'],['none','· 무평점']].map(([k,lbl]) => {
                  const on = ratingFilter.has(k);
                  return (
                    <button key={k} onClick={() => setRatingFilter(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                      style={{padding:'11px 12px', borderRadius:12, border:'none', fontSize:13, fontWeight:800, cursor:'pointer', textAlign:'left', background: on ? 'var(--brand-tint)' : 'var(--paper)', color: on ? 'var(--brand-3)' : 'var(--ink-2)', boxShadow: on ? 'inset 0 0 0 1.5px var(--brand)' : 'inset 0 0 0 1px var(--line)'}}>
                      {(on ? '☑ ' : '☐ ') + lbl}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setRatingSheetOpen(false)}
                style={{width:'100%', padding:'13px', borderRadius:12, border:'none', background:'var(--brand)', color:'#fff', fontWeight:900, fontSize:14, cursor:'pointer'}}>완료</button>
            </div>
          </div>
        ), document.body)}

        {/* 책 목록 */}
        {myBooks === null ? (
          <div style={{textAlign:'center', padding:'40px 20px', color:'var(--ink-3)', fontSize:13, fontWeight:700}}>불러오는 중…</div>
        ) : displayBooks.length > 0 ? (
          <div className="shelf-grid" role="list" tabIndex="0" aria-label="서재 책 목록, 좌우로 넘겨보기"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              e.currentTarget.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * e.currentTarget.clientWidth * 0.72, behavior: 'smooth' });
            }}>
            {displayBooks.map(b => {
              const isCompleted = b.status === 'completed';
              const progText = isCompleted
                ? (typeof b.rating === 'number' ? `★ ${b.rating.toFixed(1)}` : '완독')
                : b.status === 'aborted'
                  ? (<span style={{display:'inline-flex', alignItems:'center', gap:3}}>{window.rgIcon('pause',10)}{b.cur > 0 ? `${b.cur}/${b.total}p` : '중단'}</span>)
                  : (b.total > 0 ? `${b.cur}/${b.total}쪽` : '읽는 중');   /* #1224: 읽는 중 책에 '미완독' 오표기 → 진행률(0쪽 포함), 쪽수 미상만 '읽는 중' */
              return (
                <div
                  key={b.ubId || b.id}
                  className="shelf-grid-item"
                  role="listitem"
                  tabIndex="0"
                  aria-label={`${b.title}, ${statusFilters.find((filter) => filter.id === b.status)?.label || '서재 책'}`}
                  onClick={() => setSelectedBookId(b.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                    e.preventDefault();
                    setSelectedBookId(b.id);
                  }}
                >
                  {b.status === 'wish' && (
                    <button onClick={(e) => removeWish(e, b.id)} title="찜 삭제" aria-label="찜 삭제"
                      className="shelf-grid-remove-wish">{window.rgIcon('close',14)}</button>
                  )}
                  <BookCover className="shelf-grid-cover" title={b.title} author={b.author} cover={b.cover} fb={b.fb} />
                  <div className={`shelf-grid-status ${b.status}`}>{statusFilters.find((filter) => filter.id === b.status)?.label || ''}</div>
                  <div className="shelf-grid-title">{b.title}</div>
                  <div className="shelf-grid-prog">{b.status === 'wish' ? (b.author || '관심책') : progText}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{textAlign:'center', padding:'40px 20px', color:'var(--ink-3)'}}>
            <div style={{fontSize:24, marginBottom:8}}>📭</div>
            <div style={{fontSize:13, fontWeight:700}}>
              {allItems.length === 0 ? '아직 서재에 책이 없어요' : '선택한 필터에 맞는 책이 없어요'}
            </div>
            {/* 빈 서가 CTA — 위 '내 서재' 타이틀 하단 버튼 2개로 통합, 여기선 안내 텍스트만 */}
          </div>
        )}

        {/* 탭별 문장·감상 섹션 */}
        {myBooks !== null && (
          <div style={{marginTop:24, padding:'0 4px'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
              <div style={{fontSize:16, fontWeight:900, color:'var(--ink)'}}>💬 이 책들의 문장·감상</div>
              <button onClick={() => setSentenceImportOpen(true)}
                style={{display:'inline-flex', alignItems:'center', gap:4, background:'var(--brand-tint)', border:'1px solid var(--brand-soft)', borderRadius:999, padding:'5px 10px', color:'var(--brand-3)', fontSize:12, fontWeight:800, cursor:'pointer', lineHeight:1}}>
                + 밑줄 가져오기
              </button>
            </div>
            {tabQuotes.length > 0 ? (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {tabQuotes.map((q, i) => (
                  // 공용 QuoteCard(통일) — 메타(칩·책·페이지·날짜)·인용(이탤릭·3줄 줄임)·생각아이콘을 홈과 동일 렌더.
                  // library 변종: 카드 탭 → 책 상세(setSelectedBookId). 액션 footer 없음(브라우즈용).
                  <window.QuoteCard key={i} q={q} variant="library" onOpenBook={setSelectedBookId} />
                ))}
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'24px 16px', background:'var(--card)', border:'1.5px dashed var(--line)', borderRadius:'var(--r-md)', color:'var(--ink-3)', fontSize:13, fontWeight:700, lineHeight:1.6}}>
                아직 남긴 문장·감상이 없어요.<br />읽으며 만난 한 줄을 남겨보세요.
              </div>
            )}
          </div>
        )}

      </div>}

      {/* 책 상세 모달 */}
      {showLibrary && selectedBook && ReactDOM.createPortal(
        <BookDetailModal
          book={selectedBook}
          allQuotes={state.myQuotes}
          onClose={() => setSelectedBookId(null)}
          onActivate={onActivateUserBook}
        />,
        document.body
      )}
      {showLibrary && importOpen && ReactDOM.createPortal(
        <DataImport onClose={() => setImportOpen(false)} />,
        document.body
      )}
      {showLibrary && sentenceImportOpen && ReactDOM.createPortal(
        <>
          <div onClick={() => setSentenceImportOpen(false)}
            style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200}} />
          <div style={{position:'fixed', bottom:0, left:0, right:0, background:'var(--bg)', borderRadius:'20px 20px 0 0', padding:'20px 16px 48px', zIndex:201, boxShadow:'0 -4px 24px rgba(0,0,0,0.15)'}}>
            <div style={{width:36, height:4, background:'var(--line)', borderRadius:'var(--r-sm)', margin:'0 auto 20px'}} />
            <div style={{fontSize:15, fontWeight:900, color:'var(--ink)', marginBottom:16}}>밑줄 가져오기</div>
            <button onClick={() => { setImportOpen(true); setSentenceImportOpen(false); }}
              style={{width:'100%', padding:'14px 16px', borderRadius:12, border:'1.5px solid var(--brand-soft)', background:'var(--brand-soft)', color:'var(--brand-3)', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left'}}>
              {window.rgIcon('upload',16)}
              <span style={{flex:1}}>
                <span style={{display:'block'}}>타사 앱 밑줄 가져오기</span>
                <span style={{display:'block', fontSize:11.5, fontWeight:600, color:'var(--ink-3)', marginTop:2}}>교보·밀리 등 밑줄 스크린샷 → 문장만 골라 담기</span>
              </span>
            </button>
          </div>
        </>,
        document.body
      )}
      {showProfile && adminOpen && ReactDOM.createPortal(
        <AdminDashboardModal onClose={() => setAdminOpen(false)} />,
        document.body
      )}
      {showProfile && RG_PROMPT_LAB_ENABLED && promptLabOpen && window.PromptLabModal && ReactDOM.createPortal(
        <window.PromptLabModal onClose={() => setPromptLabOpen(false)} />,
        document.body
      )}
      {showProfile && followModal && ReactDOM.createPortal(
        <FollowListModal mode={followModal} onClose={() => setFollowModal(null)} />,
        document.body
      )}
      {showLibrary && bulkImportOpen && ReactDOM.createPortal(
        <>
          <div onClick={() => setBulkImportOpen(false)}
            style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200}} />
          <div style={{position:'fixed', bottom:0, left:0, right:0, background:'var(--bg)', borderRadius:'20px 20px 0 0', padding:'20px 16px 48px', zIndex:201, boxShadow:'0 -4px 24px rgba(0,0,0,0.15)'}}>
            <div style={{width:36, height:4, background:'var(--line)', borderRadius:'var(--r-sm)', margin:'0 auto 20px'}} />
            <div style={{fontSize:15, fontWeight:900, color:'var(--ink)', marginBottom:16}}>책 추가하기</div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <button onClick={() => { window.RG_openSearch && window.RG_openSearch(); setBulkImportOpen(false); }}
                style={{width:'100%', padding:'14px 16px', borderRadius:12, border:'1.5px solid var(--brand)', background:'var(--brand-tint)', color:'var(--brand-3)', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left'}}>
                {window.rgIcon('search',16)}
                <span style={{flex:1}}>
                  <span style={{display:'block'}}>책 찾아 담기</span>
                  <span style={{display:'block', fontSize:11.5, fontWeight:600, color:'var(--ink-3)', marginTop:2}}>제목·저자로 검색해서 책장에 담기</span>
                </span>
              </button>
              <button onClick={() => { window.RG_openTextImport && window.RG_openTextImport(); setBulkImportOpen(false); }}
                style={{width:'100%', padding:'14px 16px', borderRadius:12, border:'1.5px solid var(--line)', background:'var(--card)', color:'var(--ink)', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left'}}>
                {window.rgIcon('paste',16)}
                <span style={{flex:1}}>
                  <span style={{display:'block'}}>텍스트/파일로 가져오기</span>
                  <span style={{display:'block', fontSize:11.5, fontWeight:600, color:'var(--ink-3)', marginTop:2}}>노션·엑셀·메모 붙여넣기 또는 파일 업로드</span>
                </span>
              </button>
              <button onClick={() => { window.RG_openShelfImport && window.RG_openShelfImport(); setBulkImportOpen(false); }}
                style={{width:'100%', padding:'14px 16px', borderRadius:12, border:'1.5px solid var(--line)', background:'var(--card)', color:'var(--ink)', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left'}}>
                {window.rgIcon('camera',16)}
                <span style={{flex:1}}>
                  <span style={{display:'block'}}>사진으로 가져오기</span>
                  <span style={{display:'block', fontSize:11.5, fontWeight:600, color:'var(--ink-3)', marginTop:2}}>책장 스크린샷으로 읽은 책 한 번에 복원</span>
                </span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </section>
  );
}


window.RG_LIBRARY_ACTIVITY = { localDateKey: _rgLocalDateKey, shiftDateKey: _rgShiftDateKey, activityStats: _rgActivityStats, monthCells: _rgMonthCells };
window.LibraryView = LibraryView;
