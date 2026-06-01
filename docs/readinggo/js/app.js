/* =========================================================
   ReadingGo — app.js
   App 최상위 컴포넌트 + ReactDOM 마운트
   ========================================================= */

function App() {
  const { useState, useCallback } = React;
  const [activeTab, setActiveTab] = useState('nest');
  const [selectedTownId, setSelectedTownId] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [appState, setAppState] = useState(() => ({
    ...INITIAL_STATE,
    // village sent 상태는 로컬 복사
    village: INITIAL_STATE.village.map(v => ({ ...v })),
  }));

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
  const handleCheckin = useCallback((ns, nestLv) => {
    setAppState(s => ({
      ...s,
      book: ns.book,
      streak: ns.streak,
      xp: ns.xp,
      nest: { ...s.nest, lv: nestLv },
      myQuotes: ns.myQuotes,
    }));
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
  }, [switchTab]);

  const handleSearchSelectBook = useCallback((book) => {
    setIsSearchOpen(false);
    handleSetActiveBook(book.book_id);
  }, [handleSetActiveBook]);

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

        {/* 메인 스크롤 영역 */}
        <main className="main">
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
            />
          )}
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
