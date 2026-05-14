// app.js — App 최상위 컴포넌트 + ReactDOM 마운트
// 의존: data.js, components.js, onboarding.js, nest.js, village.js, social.js, library.js

const App = () => {
  const [state, setStateRaw] = React.useState(() => loadAppState());
  const [tab,   setTab]      = React.useState('nest');
  const [toast, setToast]    = React.useState(null);

  // localStorage 동기화
  React.useEffect(() => {
    LS.set('rg_v42', state);
  }, [state]);

  // Toast 전역 헬퍼 (village.js, library.js에서 window._showToast로 호출)
  React.useEffect(() => {
    window._showToast = msg => { setToast(msg); };
    return () => { delete window._showToast; };
  }, []);

  const setState = React.useCallback(updater => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);

  // 온보딩 완료 → 책 등록 + 첫 세션 처리
  const handleOnboardingDone = React.useCallback(() => {
    setStateRaw(prev => {
      const { onboardingBook, onboardingPage, onboardingText, onboardingSentencePage } = prev;
      if (!onboardingBook) return { ...prev, appPhase: 'home' };

      const ubId      = genId();
      const sessionId = genId();
      const dateISO   = todayISO();
      const xpGained  = 10;
      const newXP     = prev.user.xp + xpGained;

      const newSession = {
        id: sessionId, sessionDate: dateISO,
        currentPage: onboardingPage, xpEarned: xpGained,
        createdAt: new Date().toISOString(),
        date: todayLabel(), sentence: onboardingText,
      };
      const newSentence = {
        id: genId(), text: onboardingText,
        page: onboardingSentencePage != null ? onboardingSentencePage : onboardingPage,
        sessionId, createdAt: new Date().toISOString(),
      };
      const newUb = {
        id: ubId, book: onboardingBook,
        currentPage: onboardingPage, status: 'reading',
        sessions: [newSession], sentences: [newSentence],
      };

      // NPC 자동 팔로우 (§4-G)
      const friends = prev.friends && prev.friends.length > 0
        ? prev.friends
        : SEED_FRIENDS;

      // 피드에 첫 기록 추가
      const newFeed = [
        { id: genId(), handle: 'me', name: prev.user.displayName || '나',
          book: onboardingBook.title, sentence: onboardingText, time: '방금', claps: 0 },
        ...prev.feed,
      ];

      return {
        ...prev,
        appPhase: 'home',
        userBooks: [newUb],
        activeUserBookId: ubId,
        user: { ...prev.user, xp: newXP, level: calcLevel(newXP), streak: 1 },
        friends,
        feed: newFeed,
        // league에 본인 추가
        leagueData: prev.leagueData.map(l => l.isMe ? { ...l, xp: xpGained } : l),
      };
    });
    setTab('nest');
  }, []);

  // 내서재에서 "+ 책 추가하기" → 온보딩 C1으로
  const handleAddBook = React.useCallback(() => {
    setStateRaw(prev => ({
      ...prev,
      appPhase: 'onboarding',
      onboardingStep: 'C1',
      onboardingBook: null,
      onboardingPage: 0,
      onboardingText: '',
    }));
  }, []);

  // 온보딩에서 추가 책 등록 완료
  const handleAddBookDone = React.useCallback(() => {
    setStateRaw(prev => {
      const { onboardingBook, onboardingPage, onboardingText } = prev;
      if (!onboardingBook) return { ...prev, appPhase: 'home' };

      const ubId = genId();
      const newUb = {
        id: ubId, book: onboardingBook,
        currentPage: onboardingPage, status: 'reading',
        sessions: [], sentences: [],
      };

      return {
        ...prev,
        appPhase: 'home',
        userBooks: [...prev.userBooks, newUb],
        activeUserBookId: ubId,
      };
    });
    setTab('library');
  }, []);

  // 날짜 시뮬레이터
  const advanceDay = React.useCallback(() => {
    setState(prev => ({ ...prev, simDate: advanceSimDate(prev.simDate), pokes: {} }));
  }, []);

  // ── 렌더 ──────────────────────────────────────────────────────────────────────

  // 온보딩 단계 (책 추가 포함)
  if (state.appPhase === 'onboarding') {
    const isFirstTime = state.userBooks.length === 0;
    const onDone = isFirstTime ? handleOnboardingDone : handleAddBookDone;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <OnboardingFlow state={state} onStateChange={setState} onDone={onDone}/>
      </div>
    );
  }

  // 홈 (4탭)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tab === 'nest'    && <NestView    state={state} onStateChange={setState}/>}
        {tab === 'village' && <VillageView state={state} onStateChange={setState}/>}
        {tab === 'social'  && <SocialView  state={state} onStateChange={setState}/>}
        {tab === 'library' && <LibraryView state={state} onStateChange={setState} onAddBook={handleAddBook}/>}
      </div>

      <BottomNav active={tab} onChange={setTab}/>

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast(null)}/>}

      {/* 날짜 시뮬레이터 (데모용 플로팅 버튼) */}
      <button onClick={advanceDay} style={{
        position: 'absolute', bottom: 80, right: 12, zIndex: 100,
        background: '#1F1F1F', color: '#fff', border: 'none', borderRadius: 20,
        padding: '8px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,.3)', fontFamily: 'inherit', opacity: 0.75,
      }}>
        🗓 {state.simDate || todayISO()} +1일
      </button>
    </div>
  );
};

// ── 마운트 ─────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
