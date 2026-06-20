/* =========================================================
   ReadingGo — library.js
   프로필 탭: 프로필 정보 + 내서재 (찜한 책, 읽는 중, 완독)
   ========================================================= */
const { useState: _useState, useEffect: _useEffect } = React;

/* ── ProfileView ─────────────────────────────────────– */
// 위시 행 → 표시용 책 (#403). 양 어댑터 모두 {book_id, book} 객체 반환(로컬은 datastore에서 getBook 해소).
function _mapWish(w) {
  const b = (w && w.book) || w || {};
  return { id: b.id || w.book_id, title: b.title || '', author: b.author || '', pub: b.publisher || '', cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], total: b.total_pages || 0, isbn: b.isbn13 || '', cur: 0, status: 'wish' };
}

function LibraryView({ state, onSetActiveBook, onActivateUserBook }) {
  const [selectedBookId, setSelectedBookId] = _useState(null);
  const [activeSubtab, setActiveSubtab] = _useState('reading'); // 'wishlist' | 'reading' | 'completed'
  // 읽은 책 정렬 (#513 → #649 3단 토글). key=정렬축('recent'|'rating'|'title'), dir=방향(1=1차/내림·ㄱ→ㅎ, -1=2차/오름·ㅎ→ㄱ). key=null → 정렬 해제(원본 순서).
  const [completedSort, setCompletedSort] = _useState({ key: 'recent', dir: 1 }); // 기본 최근순(#513 동작 보존)
  // 같은 버튼 반복 클릭 시 3단 사이클: 1차 방향 → 2차 방향 → 해제. 다른 버튼 클릭 시 그 축 1차 방향으로.
  const cycleSort = (key) => setCompletedSort(prev =>
    prev.key !== key ? { key, dir: 1 }     // 다른 축 → 1차
      : prev.dir === 1 ? { key, dir: -1 }  // 1차 → 2차
        : { key: null, dir: 1 }            // 2차 → 해제
  );
  // 읽은 책 별점 필터 (#795) — 다중선택 버킷 Set(빈 Set=전체). 'none'=무평점(OCR 임포트 등 대량 유입 대비).
  const [ratingFilter, setRatingFilter] = _useState(() => new Set());
  const [ratingSheetOpen, setRatingSheetOpen] = _useState(false);
  const [myBooks, setMyBooks] = _useState(null);   // null=로딩
  const [wishlistBooks, setWishlistBooks] = _useState([]);
  const [savedCount, setSavedCount] = _useState(0); // ❤️ 저장(북마크) 문장 수 — stats행 (#471/#472)
  const [followCounts, setFollowCounts] = _useState({ following: 0, followers: 0 }); // 팔로잉/팔로워 수 (#516)
  const [followModal, setFollowModal] = _useState(null); // null | 'following' | 'followers' — 유저 목록 모달 (#509)
  // 좋아요한 문장은 내 한 문장 "전체 보기" 컬렉션 모달 내 필터로 이동 (#12)
  const [adminOpen, setAdminOpen] = _useState(false); // 운영 대시보드 (#161)
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
  // 데이터 내보내기 (#568 — SettingsModal에서 이동, 서재에서 직접)
  const exportData = async () => {
    try {
      const me = window.RG_ME || {};
      const [meRow, books, sents] = await Promise.all([
        Promise.resolve((DataStore.profile && DataStore.profile.get) ? DataStore.profile.get() : null).catch(() => null),
        Promise.resolve((DataStore.myBooks && DataStore.myBooks.list) ? DataStore.myBooks.list() : []).catch(() => []),
        Promise.resolve((DataStore.sentences && DataStore.sentences.listMine) ? DataStore.sentences.listMine() : []).catch(() => []),
      ]);
      const payload = { app: 'ReadingGo', exported_at: new Date().toISOString(), profile: meRow, books, sentences: sents };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `readinggo-export-${(meRow && meRow.handle) || me.handle || 'me'}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('데이터를 내보냈어요 (JSON)');
    } catch (e) { showToast('내보내기 실패'); }
  };
  const isAdmin = !!(window.RG_ME && window.RG_ME.isAdmin);

  // 내 책(읽는중/완독) + 관심책 — 실 Supabase (양 어댑터 정규화). 데모 상수 미사용.
  _useEffect(() => {
    let alive = true;
    Promise.resolve(DataStore.myBooks.list()).then(rows => {
      if (!alive) return;
      setMyBooks((rows || []).map(ub => {
        const b = ub.book || {};
        return {
          ubId: ub.id, id: ub.book_id,
          title: b.title || '제목 없음', author: b.author || '', pub: b.publisher || '',
          cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'],
          total: b.total_pages || 0, isbn: b.isbn13 || '',
          cur: ub.current_page || 0, status: ub.status,
          rating: ub.rating, comment: ub.review_text, completedAt: ub.completed_at,
          recap: ub.companion_recap || '',   // 참새 완독 회고 캐시 (#352)
          description: (b.description || '').trim(),   // 책 소개 DB 값 (#530) — 모달이 우선 사용, 없으면 알라딘 폴백
          source: b.source || '',   // 소개 출처 (#642) — 'llm'이면 AI 작성 칩
        };
      }));
    }).catch(() => { if (alive) setMyBooks([]); });
    Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).then(rows => {
      if (!alive) return;
      setWishlistBooks((rows || []).map(_mapWish));
    }).catch(() => { if (alive) setWishlistBooks([]); });
    // ❤️ 좋아요한 문장 수 — stats행 카운트 (#471/#472→#641 claps 단일)
    Promise.resolve((DataStore.claps && DataStore.claps.list) ? DataStore.claps.list() : []).then(rows => { if (alive) setSavedCount((rows || []).length); }).catch(() => {});
    // 팔로잉/팔로워 수 — Supabase friends.counts (게스트/localStorage는 메서드 부재 → 0 유지) (#516)
    Promise.resolve((DataStore.friends && DataStore.friends.counts) ? DataStore.friends.counts() : { following: 0, followers: 0 }).then(c => { if (alive) setFollowCounts(c || { following: 0, followers: 0 }); }).catch(() => {});
    return () => { alive = false; };
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

  // 위시리스트/완독 변경(검색 책장 선택·찜 삭제·완독 추가, #403/#409) → 목록 즉시 갱신.
  _useEffect(() => {
    const reload = () => {
      Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).then(rows => {
        setWishlistBooks((rows || []).map(_mapWish));
      }).catch(() => {});
      Promise.resolve(DataStore.myBooks.list()).then(rows => {
        setMyBooks((rows || []).map(ub => { const b = ub.book || {}; return { ubId: ub.id, id: ub.book_id, title: b.title || '제목 없음', author: b.author || '', pub: b.publisher || '', cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], total: b.total_pages || 0, isbn: b.isbn13 || '', cur: ub.current_page || 0, status: ub.status, rating: ub.rating, comment: ub.review_text, completedAt: ub.completed_at, recap: ub.companion_recap || '', description: (b.description || '').trim(), source: b.source || '' }; }));
      }).catch(() => {});
    };
    window.addEventListener('rg:wish-changed', reload);
    return () => window.removeEventListener('rg:wish-changed', reload);
  }, []);

  // #593: 중단 탭은 책 있을 때만 노출 → 마지막 중단 책을 다시 읽기로 옮기면 탭이 사라진다.
  // activeSubtab 이 'aborted'에 머물면 빈 화면이 되므로 '읽는 중'으로 되돌린다.
  _useEffect(() => {
    if (activeSubtab === 'aborted' && (myBooks || []).every(b => b.status !== 'aborted')) {
      setActiveSubtab('reading');
    }
  }, [myBooks, activeSubtab]);

  // 찜 삭제 (#403) — 위시리스트 카드 ✕. 낙관적 제거 + 토스트.
  const removeWish = (e, bookId) => {
    if (e) e.stopPropagation();
    setWishlistBooks((prev) => prev.filter((w) => w.id !== bookId));
    if (DataStore.wishBooks && DataStore.wishBooks.remove) Promise.resolve(DataStore.wishBooks.remove(bookId)).catch(() => {});
    showToast('찜 목록에서 제거했어요');
  };

  const books = myBooks || [];
  const activeBookId = (state.book || {}).id;   // #580: 활성 책 없으면 state.book undefined → 책장 렌더 크래시 방지
  const readingBooks = books.filter(b => b.status === 'reading')
    .sort((a, b) => (a.id === activeBookId ? -1 : b.id === activeBookId ? 1 : (b.cur || 0) - (a.cur || 0)));
  const completedBooks = books.filter(b => b.status === 'completed');
  const abortedBooks = books.filter(b => b.status === 'aborted');   // #593 읽다 중단한 책

  const allItems = books.concat(wishlistBooks);
  const selectedBook = selectedBookId ? (allItems.find(x => x.id === selectedBookId) || null) : null;

  // 탭 라벨 축약(#648): 상단 '📚 내 서재' 헤더가 '책' 맥락을 주므로 반복어 '책' 제거 → 가로 스크롤 방지.
  const tabsData = [
    { id: 'wishlist', label: '읽고 싶은 책', books: wishlistBooks },
    { id: 'reading', label: '읽고 있는 책', books: readingBooks },
    { id: 'completed', label: '읽은 책', books: completedBooks },
    // 중단 탭(#593): 읽다 그만둔 책. 책이 있을 때만 노출(빈 탭 노이즈 방지).
    ...(abortedBooks.length > 0 ? [{ id: 'aborted', label: '중단', books: abortedBooks }] : []),
  ];

  const currentTab = tabsData.find(t => t.id === activeSubtab);
  const currentBooks = currentTab?.books || [];

  // 읽은 책 탭: 정렬/필터 적용 (#513 → #649). 무평점은 0점 취급(최하). 다른 탭은 원본 순서 유지.
  // dir=1: 1차(최근순/별점 높은순/ㄱ→ㅎ), dir=-1: 2차(오래된순/별점 낮은순/ㅎ→ㄱ). key=null이면 원본 순서.
  // 별점 버킷 (#795): 무평점→'none', 5.0→'5', 4.x→'4' … 0.5~1.x→'1' (정수 floor). 빈 Set=전체.
  const ratingBucket = (r) => (r == null || r === 0) ? 'none' : (r >= 5 ? '5' : (r >= 1 ? String(Math.floor(r)) : '1'));
  const filteredCompleted = completedBooks.filter(b => ratingFilter.size === 0 || ratingFilter.has(ratingBucket(b.rating)));
  const displayBooks = activeSubtab === 'completed'
    ? (completedSort.key === null
        ? filteredCompleted // 정렬 해제 — myBooks.list() 원본 순서 유지
        : filteredCompleted.slice().sort((a, b) => {
            const d = completedSort.dir;
            if (completedSort.key === 'rating') return ((b.rating || 0) - (a.rating || 0)) * d;
            if (completedSort.key === 'title') return (a.title || '').localeCompare(b.title || '') * d;
            return String(b.completedAt || '').localeCompare(String(a.completedAt || '')) * d; // 최근순
          }))
    : currentBooks;

  // 탭에 속한 책들의 ID 목록 추출 및 문장 필터링(필터 무관 — 탭 전체 문장)
  const currentBookIds = currentBooks.map(b => b.id);
  const tabQuotes = (state.myQuotes || [])
    .filter(q => currentBookIds.includes(q.bookId))
    .sort((a, b) => {
      const dateA = String(a.when || a.createdAt || '');
      const dateB = String(b.when || b.createdAt || '');
      return dateB.localeCompare(dateA); // 최신순
    });

  return (
    <section className="view active">
      {/* 프로필 정보 (#508) — 닉네임·한 줄 소개·팔로잉/팔로워/저장을 최상단으로(#428 '둥지 최상단' → 재배치, SNS 표준 UX) */}
      <div style={{padding:'16px 16px 20px', position:'relative', textAlign:'center'}}>
        <div style={{position:'absolute', top:0, right:12, display:'flex', gap:8}}>
          {/* 설정 ⚙️는 하단 '설정' 탭으로 이전 (#488). 운영 대시보드(📊)만 헤더 유지. */}
          {isAdmin && (
            <button onClick={() => setAdminOpen(true)} title="운영 대시보드"
              style={{background:'var(--card)', border:'1px solid var(--line)', borderRadius:'50%', width:34, height:34, fontSize:16, cursor:'pointer', color:'var(--ink-2)', lineHeight:1}}>📊</button>
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
                style={{fontSize:16, fontWeight:900, padding:'4px 8px', border:'1.5px solid var(--brand)', borderRadius:6, color:'var(--ink)', background:'var(--card)', width:120, textAlign:'center'}} />
              <button onMouseDown={e => { e.preventDefault(); saveHandle(); }} disabled={hdlBusy}
                style={{padding:'4px 12px', borderRadius:6, border:'none', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:800, cursor:hdlBusy ? 'default' : 'pointer', opacity:hdlBusy ? 0.6 : 1}}>저장</button>
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
              style={{flex:1, fontSize:13, padding:'4px 8px', border:'1px solid var(--line)', borderRadius:6, color:'var(--ink)', background:'var(--card)'}} />
            <button onMouseDown={e => { e.preventDefault(); saveBio(); }}
              style={{padding:'4px 12px', borderRadius:6, border:'none', background:'var(--brand)', color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer'}}>저장</button>
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
        {/* 팔로잉/팔로워/저장 (#471/#472) — 팔로우 수는 Supabase friends.counts 실데이터 (#516). 탭 시 유저 목록 모달 (#509) */}
        {/* 가운데정렬 + 좌우 넓게 분배 — space-around 로 풀폭 균등 배치 */}
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
            </div>{/* #641: 구 저장(📌) → ❤️ 좋아요 단일화. 동작·모달 동일(좋아요한 문장 모아보기) */}
          </button>
        </div>
      </div>

      {/* 둥지 캐릭터(NestTheatre) — 프로필 헤더 아래로 이동 (#508, #428 갱신) */}
      <div style={{margin:'0 0 20px'}}>
        {window.NestTheatre && <NestTheatre xp={state.xp} />}
      </div>

      {/* 독서 활동 잔디 (#195) */}
      <div style={{padding:'0 16px', marginBottom:28}}>
        <ActivityHeatmap days={182} />
      </div>

      {/* 📖 독서 기록 섹션(총 독서시간·일평균) 제거 (#471). duration_sec 저장(#430)은 유지(미표시). */}

      {/* 내 한 문장 섹션 제거(#439) — 프로필 → 내서재 → 읽고 있는 책 클릭 → 책 상세에서 그 책의 한 문장 + 참새 대화 확인 */}

      {/* 내 서재 섹션 */}
      <div style={{padding:'0 16px', marginBottom:20}}>
        {/* #832: '스샷으로 복원' 상시 진입점 — 빈 서가(아래 CTA)뿐 아니라 책장이 차 있어도 접근 가능.
            DESIGN 3차(텍스트·아이콘) 버튼 위계. 빈 서가 큰 CTA(아래)는 유지. */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <div style={{fontSize:16, fontWeight:900, color:'var(--ink)', letterSpacing:'-0.3px'}}>내 서재</div>
          <button onClick={() => window.RG_openShelfImport && window.RG_openShelfImport()}
            title="책장 스크린샷으로 읽은 책 한 번에 복원"
            style={{display:'inline-flex', alignItems:'center', gap:4, background:'transparent', border:'none', color:'var(--brand-3)', fontSize:12, fontWeight:800, cursor:'pointer', padding:'4px 2px', whiteSpace:'nowrap'}}>
            📸 스샷으로 복원
          </button>
        </div>

        {/* 탭 버튼들 */}
        <div style={{display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:8, scrollBehavior:'smooth'}}>
          {tabsData.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubtab(tab.id)}
              style={{
                padding:'8px 12px',   // #648 패딩 소폭 축소 — 4탭 너비 내 수용
                background: activeSubtab === tab.id ? 'var(--brand)' : 'var(--card)',
                color: activeSubtab === tab.id ? 'white' : 'var(--ink)',
                border: activeSubtab === tab.id ? 'none' : '1px solid var(--line)',
                borderRadius:'20px',
                fontSize:11.5,   // #648 폰트 소폭 축소
                fontWeight:700,
                cursor:'pointer',
                whiteSpace:'nowrap',
                transition:'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 찜하기 — 위시리스트 탭에서 검색 모달로 책 추가 (#403) */}
        {activeSubtab === 'wishlist' && (
          <button onClick={() => window.RG_openSearch && window.RG_openSearch()}
            style={{ width:'100%', margin:'4px 0 12px', padding:'11px', borderRadius:12, border:'1px dashed var(--brand)', background:'var(--brand-tint)', color:'var(--brand-3)', fontWeight:800, fontSize:13.5, cursor:'pointer' }}>
            ＋ 읽고 싶은 책 찾아 담기
          </button>
        )}

        {/* 읽은 책 탭 정렬/필터 컨트롤 (#513) — 성 컬렉션 선반 대체. 완독 책이 있을 때만 노출. */}
        {activeSubtab === 'completed' && completedBooks.length > 0 && (
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16, paddingLeft:4}}>
            {/* 3단 토글 (#649): 활성 축은 방향에 따라 라벨/화살표를 바꿔 표시. 비활성은 1차 방향 라벨. */}
            {[
              ['recent', { 1: '최근', '-1': '오래된' }],
              ['rating', { 1: '별점 ↑', '-1': '별점 ↓' }],
              ['title', { 1: '제목 ↑', '-1': '제목 ↓' }],
            ].map(([id, labels]) => {
              const active = completedSort.key === id;
              const label = active ? labels[completedSort.dir] : labels[1];
              return (
                <button key={id} onClick={() => cycleSort(id)}
                  style={{padding:'6px 12px', borderRadius:999, border:'none', fontSize:12, fontWeight:800, cursor:'pointer', background: active ? 'var(--brand)' : 'var(--card)', color: active ? '#fff' : 'var(--ink-2)', boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--line)'}}>{label}</button>
              );
            })}
            <button onClick={() => setRatingSheetOpen(true)}
              style={{padding:'6px 12px', borderRadius:999, border:'none', fontSize:12, fontWeight:800, cursor:'pointer', background: ratingFilter.size ? 'var(--gold)' : 'var(--card)', color: ratingFilter.size ? '#fff' : 'var(--ink-2)', boxShadow: ratingFilter.size ? 'none' : 'inset 0 0 0 1px var(--line)'}}>⭐ 별점{ratingFilter.size ? ` ${ratingFilter.size}` : ''}</button>
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
                {[['5','⭐ 5점'],['4','⭐ 4점대'],['3','⭐ 3점대'],['2','⭐ 2점대'],['1','⭐ 1점대'],['none','· 무평점']].map(([k,lbl]) => {
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
          <div className="shelf-grid">
            {displayBooks.map(b => {
              const isCompleted = b.status === 'completed';
              const progText = isCompleted
                ? (typeof b.rating === 'number' ? `⭐ ${b.rating.toFixed(1)}` : '완독')
                : b.status === 'aborted'
                  ? (<span style={{display:'inline-flex', alignItems:'center', gap:3}}>{window.rgIcon('pause',10)}{b.cur > 0 ? `${b.cur}/${b.total}p` : '중단'}</span>)
                  : (b.cur > 0 ? `${b.cur}/${b.total}p` : '미완독');
              return (
                <div
                  key={b.ubId || b.id}
                  className={'shelf-grid-item' + (b.id === activeBookId ? ' active' : '')}
                  onClick={() => setSelectedBookId(b.id)}
                >
                  {b.id === activeBookId && <span className="shelf-grid-active-pill">읽는중</span>}
                  {b.status === 'wish' && (
                    <button onClick={(e) => removeWish(e, b.id)} title="찜 삭제" aria-label="찜 삭제"
                      className="shelf-grid-remove-wish">✕</button>
                  )}
                  <BookCover className="shelf-grid-cover" title={b.title} author={b.author} cover={b.cover} fb={b.fb} />
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
              {activeSubtab === 'wishlist' && '찜한 책이 없어요'}
              {activeSubtab === 'reading' && '읽고 있는 책이 없어요'}
              {activeSubtab === 'completed' && (ratingFilter.size ? '이 별점의 완독한 책이 없어요' : '완독한 책이 없어요')}
              {activeSubtab === 'aborted' && '중단한 책이 없어요'}
            </div>
            {/* 빈 서가 박멸 (#772) — 스샷으로 서가 복원 진입 */}
            <button onClick={() => window.RG_openShelfImport && window.RG_openShelfImport()}
              style={{marginTop:14, padding:'10px 16px', borderRadius:10, border:'1.5px solid var(--brand)', background:'var(--brand-tint)', color:'var(--brand-3)', fontWeight:800, fontSize:13, cursor:'pointer'}}>
              📸 스샷으로 서가 복원
            </button>
          </div>
        )}

        {/* 탭별 문장·감상 섹션 */}
        {myBooks !== null && (
          <div style={{marginTop:24, padding:'0 4px'}}>
            <div style={{fontSize:16, fontWeight:900, marginBottom:12, color:'var(--ink)'}}>💬 이 책들의 문장·감상</div>
            {tabQuotes.length > 0 ? (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {tabQuotes.map((q, i) => {
                  const getB = window.getBook;
                  const _bk = typeof getB === 'function' ? getB(q.bookId) : null;
                  const bkTitle = q.bookTitle || (_bk && (_bk.id === q.bookId || _bk.book_id === q.bookId) ? _bk.title : '') || '책';
                  const typeText = q.kind === 'thought' ? '💭내생각' : '📖책속';
                  const pageText = q.page ? `${q.page}p` : '';
                  const _rawDate = q.when || q.createdAt || '';
                  const dateText = (() => {
                    if (!_rawDate) return '';
                    const s = String(_rawDate);
                    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                    const n = Number(s);
                    if (!isNaN(n) && n > 0) {
                      const ms = n < 1e10 ? n * 1000 : n;
                      const d = new Date(ms);
                      if (!isNaN(d)) return d.toISOString().slice(0, 10);
                    }
                    try { const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0, 10); } catch(e){}
                    return '';
                  })();

                  return (
                    <div key={i} className="my-q-card" onClick={() => setSelectedBookId(q.bookId)} style={{cursor:'pointer'}}>
                      <div className="meta">
                        <span className="kind">{typeText}</span>
                        <span className="dot">·</span>
                        <span className="bk" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:120}}>{bkTitle}</span>
                        {pageText ? <span className="dot">·</span> : null}
                        {pageText ? <span>{pageText}</span> : null}
                        {dateText ? <span className="dot">·</span> : null}
                        {dateText ? <span>{dateText}</span> : null}
                      </div>
                      <div className="quote" style={{
                        fontStyle: q.kind === 'thought' ? 'normal' : 'italic',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxHeight: '4.65em',
                        lineHeight: '1.55'
                      }}>
                        {q.kind === 'thought' ? `💭 ${q.text}` : `"${q.text}"`}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{textAlign:'center', padding:'24px 16px', background:'var(--card)', border:'1.5px dashed var(--line)', borderRadius:'var(--r-md)', color:'var(--ink-3)', fontSize:13, fontWeight:700}}>
                저장된 문장·감상이 없습니다.
              </div>
            )}
          </div>
        )}

        {/* 서비스 외부 공유 (#650 B) — 친구에게 ReadingGo 권하기. 내 공개 한 문장 1개(있으면) 동반.
            referral 코드·보상은 Phase 1 후속(referral.md §4) — 현재는 소개+링크만 graceful. */}
        <button onClick={() => {
          const qs = (state.myQuotes || []).filter(q => q && q.text && (q.visibility ? q.visibility === 'public' : !q.isPrivate));
          const rep = qs[0] || (state.myQuotes || []).find(q => q && q.text) || null;
          if (window.shareService) window.shareService({ source: 'library', sentence: rep });
        }}
          style={{marginTop:20, width:'100%', padding:'12px', borderRadius:10, border:'none', background:'var(--brand)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
          {window.rgIcon('share',15)} 친구에게 ReadingGo 공유하기
        </button>

        {/* 데이터 내보내기 (#568 — 설정에서 서재로 이동, 내 책·한 문장 맥락과 직결) */}
        <button onClick={exportData}
          style={{marginTop:10, width:'100%', padding:'12px', borderRadius:10, border:'1.5px solid var(--line)', background:'transparent', color:'var(--ink-2)', fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
          {window.rgIcon('download',15)} 내 데이터 내보내기 (JSON)
        </button>
      </div>

      {/* 책 상세 모달 */}
      {selectedBook && ReactDOM.createPortal(
        <BookDetailModal
          book={selectedBook}
          allQuotes={state.myQuotes}
          onClose={() => setSelectedBookId(null)}
          onActivate={onActivateUserBook}
        />,
        document.body
      )}
      {adminOpen && ReactDOM.createPortal(
        <AdminDashboardModal onClose={() => setAdminOpen(false)} />,
        document.body
      )}
      {followModal && ReactDOM.createPortal(
        <FollowListModal mode={followModal} onClose={() => setFollowModal(null)} />,
        document.body
      )}
    </section>
  );
}


window.LibraryView = LibraryView;
