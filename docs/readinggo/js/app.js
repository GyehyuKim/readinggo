/* =========================================================
   ReadingGo — app.js
   App 최상위 컴포넌트 + ReactDOM 마운트
   ========================================================= */

// Phase 1: Supabase 실데이터 → appState 형태로 적재 (로그인 후 1회). 실패해도 앱은 뜬다.
async function buildStateFromSupabase() {
  const DS = window.SupabaseDataStore;
  if (!DS) return null;
  const [ub, st, xpv, mine, castles] = await Promise.all([
    DS.activeBook.get().catch(() => null),
    DS.streak.get().catch(() => null),
    DS.xp.get().catch(() => 0),
    DS.sentences.listMine().catch(() => []),
    DS.castles.list().catch(() => []),
  ]);
  const out = {
    streak: st ? (st.current || 0) : 0,
    xp: xpv || 0,
    castleCount: (castles || []).length,
  };
  if (ub && ub.book) {
    const total = ub.book.total_pages || 1;
    out.book = {
      id: ub.book_id, title: ub.book.title,
      author: (ub.book.author || '') + (ub.book.publisher ? ' · ' + ub.book.publisher : ''),
      cur: ub.current_page || 0, total, days: 1,
      cover: ub.book.cover_url, fb: ['#9AA7B2', '#C7D0D8'], toc: [],
    };
    out.nest = { lv: getNestStage(Math.round((ub.current_page || 0) / total * 100)).lv };
  }
  if (Array.isArray(mine) && mine.length) {
    out.myQuotes = mine.map(s => ({ id: s.id, text: s.text, bookId: s.book_id || '', page: s.page, when: '', note: s.my_note || '' }));
  }
  // 소셜 isMine 판정 + 스포일러 동기맵: 현재 사용자 + 내 책별 현재 페이지 preload
  try {
    const me = await window.RG_SB.myProfile();
    if (me) window.RG_ME = { id: me.id, handle: me.handle, displayName: me.display_name, avatar: me.avatar_url };
  } catch (e) {}
  try {
    const myb = await DS.myBooks.list();
    const pages = {};
    (myb || []).forEach(u => { if (u.book_id) pages[u.book_id] = u.current_page || 0; });
    window.RG_MY_PAGES = pages;
  } catch (e) {}
  return out;
}

function BootSplash({ text }) {
  return (
    <div className="stage"><div className="app">
      <div className="rg-boot" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ fontSize: 40 }}>🐦</span>
        <span style={{ fontWeight: 800, color: 'var(--ink-2)' }}>{text || '로딩 중...'}</span>
      </div>
    </div></div>
  );
}

function LoginScreen({ onLogin }) {
  const { useState } = React;
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const sendLink = async () => {
    const addr = email.trim();
    if (!addr || busy) return;
    setBusy(true);
    try { await window.RG_SB.signInWithEmail(addr); setSent(true); }
    catch (e) { alert('메일 전송 실패: ' + ((e && e.message) || e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="stage"><div className="app">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 54 }}>🐦</span>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>reading<span style={{ color: 'var(--brand)' }}>GO</span></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5 }}>하루 한 페이지,<br />한 문장에서 시작해요.</div>
        <button onClick={onLogin} style={{ marginTop: 8, padding: '14px 22px', borderRadius: 14, border: '1.5px solid var(--line)', background: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: 18 }}>🟢</span> Google로 시작하기
        </button>
        {sent ? (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.6, background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: '12px 16px', maxWidth: 300 }}>
            📬 <b>{email.trim()}</b>로 로그인 링크를 보냈어요.<br />메일함에서 링크를 눌러 로그인하세요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendLink(); }}
              placeholder="이메일 주소"
              style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 14, fontWeight: 600, outline: 'none' }}
            />
            <button onClick={sendLink} disabled={busy} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? '보내는 중…' : '✉️ 이메일로 시작하기'}
            </button>
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>클로즈베타 · 지인 초대</div>
      </div>
    </div></div>
  );
}

function App() {
  const { useState, useCallback, useMemo, useEffect } = React;
  // Phase 1: Supabase 설정 시 로그인 게이트 + 실데이터. 미설정/미로그인은 localStorage 폴백.
  const _supa = !!(window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured());
  const [authUser, setAuthUser] = useState(_supa ? undefined : 'local'); // undefined=확인중, null=로그아웃, 그외=OK
  const [dataReady, setDataReady] = useState(!_supa);
  const [activeTab, setActiveTab] = useState('nest');
  const [selectedTownId, setSelectedTownId] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // 스포일러 전역 토글 (§5.7.1): true 면 모든 페이지 블라인드 해제.
  const [spoilerReveal, setSpoilerReveal] = useState(false);
  const [appState, setAppState] = useState(() => ({
    ...INITIAL_STATE,
    // village sent 상태는 로컬 복사
    village: INITIAL_STATE.village.map(v => ({ ...v })),
  }));

  // 성(🏰) 개수 — 로컬: 동기 파생 / Supabase: 데이터 로드 시 주입 (§5.2.1).
  const [castleCount, setCastleCount] = useState(() => {
    try { return _supa ? 0 : DataStore.castles.list().length; } catch { return 0; }
  });

  // 인증 상태 구독 (Supabase 모드)
  useEffect(() => {
    if (!_supa) return;
    window.RG_SB.currentUser().then(u => setAuthUser(u || null)).catch(() => setAuthUser(null));
    return window.RG_SB.onAuthChange(u => setAuthUser(u || null));
  }, []);

  // 로그인 후 Supabase 실데이터 → appState (1회)
  useEffect(() => {
    if (!_supa || !authUser || authUser === 'local') return;
    // 쓰기 경로 보장: index.html S2 스왑이 OAuth 복귀 직후엔 세션 hydration 타이밍상
    // 누락될 수 있어 → 쓰기가 localStorage 로 새고 Supabase 엔 안 저장됨. 로그인 확정
    // 시점에 여기서 DataStore 를 Supabase 로 확실히 교체(쓰기 경로 활성화).
    if (window.SupabaseDataStore && window.DataStore !== window.SupabaseDataStore) {
      window.DataStore = window.SupabaseDataStore;
      console.log('[ReadingGo] DataStore → Supabase (쓰기 경로 활성)');
    }
    let alive = true;
    (async () => {
      try {
        const next = await buildStateFromSupabase();
        if (alive && next) {
          setAppState(s => ({ ...s, ...next }));
          if (typeof next.castleCount === 'number') setCastleCount(next.castleCount);
        }
      } catch (e) { console.error('[ReadingGo] 데이터 로드 실패:', e); }
      finally { if (alive) setDataReady(true); }
    })();
    return () => { alive = false; };
  }, [authUser]);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedTownId(null);
    // 스크롤 맨위로
    const main = document.querySelector('.main');
    if (main) main.scrollTop = 0;
  }, []);

  const handleSelectTown = useCallback((townId) => {
    setSelectedTownId(townId);
  }, []);

  const handleBackToVillage = useCallback(() => {
    setSelectedTownId(null);
  }, []);

  // NestView가 체크인/simskip 후 자체 업데이트하고 콜백으로 상위 동기화.
  // 둥지 단계(nest.lv)는 활성 책 진척률에서 파생 → NestView가 계산해 넘긴다(§5.2).
  const handleCheckin = useCallback((ns, nestLv, xpGain, sentence) => {
    setAppState(s => ({
      ...s,
      book: ns.book,
      streak: ns.streak,
      xp: ns.xp,
      nest: { ...s.nest, lv: nestLv },
      myQuotes: ns.myQuotes,
    }));
    // Phase 1: 백엔드 영속(로그인 시). 낙관적 UI 유지 + 백그라운드 persist.
    // sessions.addToday 가 스트릭 bump 까지 연동(양 어댑터). 활성 책 없으면 no-op.
    (async () => {
      try {
        const ub = await Promise.resolve(DataStore.activeBook.get());
        if (!ub || !ub.id) { console.warn('[ReadingGo] 체크인: 활성 책 없음 — 등록 먼저 필요'); return; }
        await Promise.resolve(DataStore.sessions.addToday({ userBookId: ub.id, page: ns.book.cur }));
        if (sentence) await Promise.resolve(DataStore.sentences.add({ userBookId: ub.id, page: ns.book.cur, text: sentence }));
        if (xpGain) await Promise.resolve(DataStore.xp.add(xpGain, 'checkin'));
        console.log('[ReadingGo] ✅ 체크인 저장 완료 (ub=' + ub.id + ')');
      } catch (e) { console.warn('[ReadingGo] 체크인 영속 실패:', e); }
    })();
  }, []);

  // 하루 거르기: 둥지·XP·성은 존속, 스트릭만 영향 (§5.4).
  const handleSimSkip = useCallback((ns) => {
    setAppState(s => ({
      ...s,
      streak: ns.streak,
    }));
  }, []);

  const handleSendSeed = useCallback((idx) => {
    setAppState(s => {
      const village = s.village.map((v, i) => i === idx ? { ...v } : v);
      if (village[idx].sent) {
        showToast('오늘은 이미 보냈어요 🌱');
        return s;
      }
      village[idx].sent = true;
      showToast(`@${village[idx].name}에게 🪱 콕찌르기를 보냈어요!`);
      return { ...s, village };
    });
  }, []);

  const handleSetActiveBook = useCallback((bookId) => {
    const bk = getBook(bookId);
    if (!bk) return;
    setAppState(s => {
      // 현재 책 진도 저장
      INITIAL_PROGRESS[s.book.id] = { cur: s.book.cur, days: s.book.days };
      const prog = INITIAL_PROGRESS[bookId] || { cur: 1, days: 1 };
      // 둥지 단계는 새 활성 책 진척률로 재계산 (§5.2/§5.3).
      const nestLv = getNestStage(bk.total ? Math.round(prog.cur / bk.total * 100) : 0).lv;
      return {
        ...s,
        book: {
          id: bk.id, title: bk.title,
          author: bk.author + ' · ' + bk.pub,
          cur: prog.cur, total: bk.total, days: prog.days,
          cover: bk.cover, fb: bk.fb, toc: bk.toc,
        },
        nest: { ...s.nest, lv: nestLv },
      };
    });
    showToast(`📖 ${bk.title} — 활성 책으로 설정`);
    switchTab('nest');
    // Phase 1: 로그인(Supabase 모드)이면 책을 백엔드에 등록 + 활성화. myBooks 없는
    // localStorage 폴백에선 skip(데모 시드 사용) — 양 어댑터 안전.
    if (DataStore.myBooks && DataStore.myBooks.add) {
      (async () => {
        try {
          const mine = await Promise.resolve(DataStore.myBooks.list());
          let ub = (mine || []).find(u => u.book && (u.book.isbn13 === bk.isbn || u.book.title === bk.title));
          if (!ub) {
            ub = await Promise.resolve(DataStore.myBooks.add({
              book: { isbn13: bk.isbn, title: bk.title, author: bk.author, publisher: bk.pub, total_pages: bk.total, cover_url: bk.cover },
              current_page: (window.INITIAL_PROGRESS && window.INITIAL_PROGRESS[bookId] && window.INITIAL_PROGRESS[bookId].cur) || 0,
            }));
          }
          if (ub && ub.id) { await Promise.resolve(DataStore.activeBook.set(ub.id)); console.log('[ReadingGo] ✅ 책 등록 완료:', bk.title, '(ub=' + ub.id + ')'); }
        } catch (e) { console.warn('[ReadingGo] 활성책 등록 실패:', e); }
      })();
    }
  }, [switchTab]);

  const handleSearchSelectBook = useCallback((book) => {
    setIsSearchOpen(false);
    handleSetActiveBook(book.book_id);
  }, [handleSetActiveBook]);

  // 이미 등록된 user_book 으로 활성 전환 (서재에서 — 재등록 없이 activeBook.set).
  const handleActivateUserBook = useCallback((item) => {
    if (!item || !item.id) return;
    setAppState(s => ({
      ...s,
      book: {
        id: item.id, title: item.title,
        author: (item.author || '') + (item.pub ? ' · ' + item.pub : ''),
        cur: item.cur || 0, total: item.total || 1, days: 1,
        cover: item.cover, fb: item.fb || ['#9AA7B2', '#C7D0D8'], toc: [],
      },
      nest: { ...s.nest, lv: getNestStage(item.total ? Math.round((item.cur || 0) / item.total * 100) : 0).lv },
    }));
    showToast(`📖 ${item.title} — 활성 책으로 변경`);
    switchTab('nest');
    if (item.ubId && DataStore.activeBook && DataStore.activeBook.set) {
      Promise.resolve(DataStore.activeBook.set(item.ubId)).catch(e => console.warn('[ReadingGo] 활성 전환 실패:', e));
    }
  }, [switchTab]);

  // Phase 1 로그인 게이트 (Supabase 모드에서만)
  if (_supa && authUser === undefined) return (<BootSplash text="확인 중..." />);
  if (_supa && authUser === null) return (<LoginScreen onLogin={() => window.RG_SB.signInWithGoogle()} />);
  if (_supa && !dataReady) return (<BootSplash text="불러오는 중..." />);

  return (
    <div className="stage">
      <div className="app">

        {/* 상단 바 */}
        <header className="topbar">
          <div className="topbar-row">
            <div className="brand-mark">
              <span className="sparrow" aria-hidden="true">🐦</span>
              <span>reading<span className="go">GO</span></span>
            </div>
            <div className="topbar-stats">
              <button
                onClick={() => switchTab('profile')}
                className="stat"
                title="성 컬렉션 (완독 권수)"
                style={{
                  background:'transparent',
                  border:'none',
                  cursor:'pointer',
                  padding:0,
                  font:'inherit',
                }}
              >
                <span className="ico">🏰</span>
                <span>×{castleCount}</span>
              </button>
              <span className="stat fire" title="연속 출석">
                <span className="ico">🔥</span>
                <span>{appState.streak}</span>
              </span>
              <span className="stat gold" title="이번 주 XP">
                <span className="ico">⚡</span>
                <span>{appState.xp}</span>
              </span>
              <span className="stat shield" title="방패 개수">
                <span className="ico">🪶</span>
                <span>{appState.shield}</span>
              </span>
              <button
                onClick={() => setSpoilerReveal(v => !v)}
                aria-pressed={spoilerReveal}
                title={spoilerReveal ? '스포일러 모두 표시 중 — 탭하면 다시 가림' : '스포일러 가리는 중 — 탭하면 안 읽은 부분도 표시'}
                style={{
                  background: spoilerReveal ? 'var(--brand-tint)' : 'transparent',
                  border: spoilerReveal ? '1.5px solid var(--brand)' : '1.5px solid transparent',
                  borderRadius:14,
                  fontSize:16,
                  cursor:'pointer',
                  padding:'4px 6px',
                  marginLeft:4,
                  lineHeight:1,
                }}
              >
                {spoilerReveal ? '🔓' : '🙈'}
              </button>
              <button
                onClick={() => setIsSearchOpen(true)}
                style={{
                  background:'transparent',
                  border:'none',
                  fontSize:20,
                  cursor:'pointer',
                  padding:'4px 8px',
                  marginLeft:8,
                }}
                title="도서 검색"
              >
                🔍
              </button>
            </div>
          </div>
        </header>

        {/* 메인 스크롤 영역 — 스포일러 전역 토글을 4영역 공통 제공 (§5.7.1) */}
        <main className="main">
          <SpoilerContext.Provider value={spoilerReveal}>
          {activeTab === 'nest' && (
            <NestView
              key="nest"
              state={appState}
              onCheckin={handleCheckin}
              onSimSkip={handleSimSkip}
              onGoLibrary={() => switchTab('library')}
              onGoSocial={() => switchTab('social')}
            />
          )}
          {activeTab === 'village' && !selectedTownId && (
            <VillageView
              key="village"
              state={appState}
              onSelectTown={handleSelectTown}
            />
          )}
          {activeTab === 'village' && selectedTownId && (
            <TownDetailView
              key={`town_${selectedTownId}`}
              state={appState}
              townId={selectedTownId}
              onBack={handleBackToVillage}
            />
          )}
          {activeTab === 'social' && (
            <SocialView
              key="social"
              state={appState}
            />
          )}
          {activeTab === 'profile' && (
            <LibraryView
              key="library"
              state={appState}
              onSetActiveBook={handleSetActiveBook}
              onActivateUserBook={handleActivateUserBook}
            />
          )}
          </SpoilerContext.Provider>
        </main>

        {/* 하단 탭바 */}
        <nav className="tabbar">
          {[
            { id: 'nest',    ico: '🏠', label: '둥지'   },
            { id: 'village', ico: '🌳', label: '마을'   },
            { id: 'social',  ico: '🏆', label: '소셜'   },
            { id: 'profile', ico: '👤', label: '프로필' },
          ].map(t => (
            <button
              key={t.id}
              className={'tab' + (activeTab === t.id ? ' active' : '')}
              onClick={() => switchTab(t.id)}
            >
              <span className="ico">{t.ico}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* 전역 Toast */}
        <Toast />

        {/* 도서 검색 모달 */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          books={ALL_BOOKS}
          onSelectBook={handleSearchSelectBook}
          topRecommendations={ALL_BOOKS.slice(0, 8)}
        />

      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
