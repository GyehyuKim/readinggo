// onboarding.js — 가입 여정 A → C1 → C2 → D3
// 의존: data.js, components.js

// ── Screen A: 진입 (비로그인) ─────────────────────────────────────────────────
const ScreenA = ({ onStart }) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
    background: 'linear-gradient(160deg,#F0FDF4 0%,#fff 60%)' }}>
    {/* 상단 로고 */}
    <div style={{ padding: '48px 0 0', textAlign: 'center' }}>
      <div className="sparrow-bounce" style={{ display: 'inline-block', fontSize: 96, lineHeight: 1 }}>
        🐦
      </div>
      <h1 style={{ fontWeight: 900, fontSize: 28, color: '#1F1F1F', margin: '16px 0 8px',
        letterSpacing: '-0.5px', lineHeight: 1.2 }}>
        reading<span style={{ color: '#58CC02' }}>Go</span>
      </h1>
    </div>

    {/* 슬로건 (§4-A, §1.2) */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '0 32px', textAlign: 'center', gap: 16 }}>
      <p style={{ fontWeight: 900, fontSize: 22, color: '#1F1F1F', lineHeight: 1.4, margin: 0 }}>
        "하루 한 페이지,<br/>한 문장에서 시작해요."
      </p>
      <p style={{ fontSize: 15, color: '#AFAFAF', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>
        1페이지만 읽어도 오늘은 성공이에요 🐦
      </p>
    </div>

    {/* CTA */}
    <div style={{ padding: '0 24px 48px' }}>
      <button onClick={onStart} className="btn-duo btn-green" style={{ width: '100%', fontSize: 17 }}>
        시작하기
      </button>
    </div>
  </div>
);

// ── 큐레이션 Top10 제목 목록 (§C-1) — books.tsv에서 title 매칭 ───────────────
const TOP10_RECENT_TITLES  = ['소년이 온다','사피엔스','호모 데우스','21세기를 위한 21가지 제언','설득의 심리학','제로 투 원','몰입','오리지널스','남아 있는 나날','방랑자들'];
const TOP10_STEADY_TITLES  = ['데미안','이방인','1984','호밀밭의 파수꾼','노인과 바다','참을 수 없는 존재의 가벼움','백년의 고독 1','코스모스','차라투스트라는 이렇게 말했다','죄와 벌 1'];

// ── Screen C-1: 책 검색 ────────────────────────────────────────────────────────
const ScreenC1 = ({ onSelect, onManual }) => {
  const [query, setQuery]     = React.useState('');
  const [books, setBooks]     = React.useState([]);
  const [results, setResults] = React.useState([]);
  const [loaded, setLoaded]   = React.useState(false);
  const [tab, setTab]         = React.useState('recent');

  React.useEffect(() => {
    loadBooks().then(b => { setBooks(b); setLoaded(true); });
  }, []);

  React.useEffect(() => {
    if (query.trim()) {
      setResults(fuzzySearch(books, query).slice(0, 20));
    } else {
      setResults([]);
    }
  }, [query, books]);

  const top10 = React.useMemo(() => {
    if (!loaded) return [];
    const titles = tab === 'recent' ? TOP10_RECENT_TITLES : TOP10_STEADY_TITLES;
    return titles.map(t => books.find(b => b.title === t)).filter(Boolean);
  }, [loaded, books, tab]);

  const display = query.trim() ? results : top10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '2px solid #E5E5E5' }}>
        <p style={{ fontWeight: 900, fontSize: 18, color: '#1F1F1F', margin: '0 0 12px' }}>
          어떤 책을 읽고 있나요?
        </p>
        {/* 검색창 */}
        <div style={{ position: 'relative' }}>
          <SearchIcon s={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#AFAFAF' }}/>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="제목, 저자, ISBN 검색..."
            autoFocus
            style={{ width: '100%', border: '2px solid #E5E5E5', borderRadius: 14, padding: '11px 14px 11px 36px',
              fontSize: 15, fontWeight: 600, outline: 'none', fontFamily: 'inherit',
              transition: 'border-color .2s' }}
            onFocus={e => e.target.style.borderColor = '#58CC02'}
            onBlur={e => e.target.style.borderColor  = '#E5E5E5'}
          />
        </div>
        {/* 추천 탭 (검색어 없을 때) */}
        {!query.trim() && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[['recent','요즘 Top 10'],['steady','스테디 Top 10']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 12,
                background: tab === id ? '#58CC02' : '#F7F7F7',
                color:      tab === id ? '#fff'    : '#AFAFAF',
              }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* 결과 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {display.length === 0 && query.trim() && loaded && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: '#AFAFAF', fontWeight: 700, marginBottom: 12 }}>
              찾으시는 책이 없나요? 직접 등록할 수 있어요
            </p>
            <button onClick={onManual} className="btn-duo btn-white" style={{ fontSize: 14 }}>
              직접 등록
            </button>
          </div>
        )}
        {display.map(book => (
          <button key={book.book_id} onClick={() => onSelect(book)} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer',
            borderBottom: '1px solid #F7F7F7', textAlign: 'left'
          }}>
            <BookCover book={book} size={52} radius={10}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 2px',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {book.title}
              </p>
              <p style={{ fontSize: 12, color: '#AFAFAF', margin: 0 }}>
                {book.author} · {book.total_pages}p
              </p>
            </div>
          </button>
        ))}
        {!loaded && (
          <p style={{ textAlign: 'center', color: '#AFAFAF', padding: '32px 0', fontWeight: 700 }}>
            도서 목록 로딩 중...
          </p>
        )}
      </div>
    </div>
  );
};

// ── Screen C-2: 확인 / 직접 등록 + 오늘의 한 문장 입력 ───────────────────────────
const ScreenC2 = ({ book, isManual, onBack, onConfirm }) => {
  const [page,         setPage]         = React.useState('0');
  const [sentencePage, setSentencePage] = React.useState('');
  const [sentenceText, setSentenceText] = React.useState(() => {
    try { return DataStore.pending.get('sentence') || ''; } catch { return ''; }
  });
  const [title,      setTitle]      = React.useState(book ? book.title : '');
  const [author,     setAuthor]     = React.useState(book ? book.author : '');
  const [totalPages, setTotalPages] = React.useState(book ? String(book.total_pages) : '');

  React.useEffect(() => {
    try { DataStore.pending.set('sentence', sentenceText); } catch {}
  }, [sentenceText]);

  const valid = isManual
    ? title.trim() && parseInt(totalPages) > 0 && sentenceText.trim().length > 0
    : sentenceText.trim().length > 0;

  const handleConfirm = () => {
    const b = isManual
      ? { book_id: genId(), title: title.trim(), author: author.trim(), total_pages: parseInt(totalPages), cover_url: '' }
      : book;
    const currPage = parseInt(page) || 0;
    const sPage    = parseInt(sentencePage) || currPage;
    onConfirm(b, currPage, sentenceText.trim(), sPage);
  };

  const focus = e => e.target.style.borderColor = '#58CC02';
  const blur  = e => e.target.style.borderColor = '#E5E5E5';
  const iStyle = { marginBottom: 12 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '2px solid #E5E5E5', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <BackIcon s={22} style={{ color: '#AFAFAF' }}/>
        </button>
        <span style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>
          {isManual ? '책 직접 등록' : '책 확인'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {/* 표지 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <BookCover book={isManual ? null : book} size={100} radius={16}/>
        </div>

        {isManual ? (
          <>
            <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', marginBottom: 6 }}>제목 *</p>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="책 제목" className="rg-input" style={iStyle} onFocus={focus} onBlur={blur}/>
            <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', marginBottom: 6 }}>저자</p>
            <input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="저자명" className="rg-input" style={iStyle} onFocus={focus} onBlur={blur}/>
            <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', marginBottom: 6 }}>총 페이지 *</p>
            <input type="number" value={totalPages} onChange={e=>setTotalPages(e.target.value)} placeholder="예: 300" className="rg-input" style={iStyle} onFocus={focus} onBlur={blur}/>
          </>
        ) : (
          <div style={{ background: '#F0FDF4', border: '2px solid #D7F0BF', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: '0 0 4px' }}>{book.title}</p>
            <p style={{ fontSize: 13, color: '#AFAFAF', margin: 0 }}>{book.author} · 전 {book.total_pages}p</p>
          </div>
        )}

        <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', marginBottom: 6 }}>현재까지 읽은 페이지</p>
        <input type="number" value={page} onChange={e=>setPage(e.target.value)} placeholder="0"
          min={0} max={isManual ? parseInt(totalPages) || 9999 : book.total_pages}
          className="rg-input" style={iStyle} onFocus={focus} onBlur={blur}/>

        {/* 오늘의 한 문장 */}
        <div style={{ height: 1, background: '#E5E5E5', margin: '8px 0 16px' }}/>
        <p style={{ fontWeight: 900, fontSize: 15, color: '#1F1F1F', margin: '0 0 4px' }}>오늘의 한 문장 🐦</p>
        <p style={{ fontSize: 12, color: '#AFAFAF', fontWeight: 600, marginBottom: 14 }}>
          오늘 읽은 내용 중 마음에 남는 한 문장
        </p>

        <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', marginBottom: 6 }}>어느 페이지에서?</p>
        <input type="number" value={sentencePage} onChange={e=>setSentencePage(e.target.value)}
          placeholder={page || '페이지 번호'}
          className="rg-input" style={iStyle} onFocus={focus} onBlur={blur}/>

        <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', marginBottom: 6 }}>문장</p>
        <textarea
          value={sentenceText}
          onChange={e => { if (e.target.value.length <= 200) setSentenceText(e.target.value); }}
          placeholder="마음에 든 한 줄을 적어주세요 (최대 200자)"
          rows={4}
          style={{ width: '100%', border: '2px solid #E5E5E5', borderRadius: 16, padding: '14px 16px',
            fontSize: 15, fontWeight: 600, outline: 'none', resize: 'none',
            fontFamily: 'inherit', lineHeight: 1.6, transition: 'border-color .2s',
            boxSizing: 'border-box', marginBottom: 4 }}
          onFocus={focus} onBlur={blur}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: sentenceText.length > 180 ? '#FF4B4B' : '#AFAFAF', fontWeight: 700 }}>
            {sentenceText.length}/200
          </span>
        </div>
      </div>

      <div className="rg-bottom-bar">
        <button onClick={handleConfirm} disabled={!valid}
          className={`btn-duo ${valid ? 'btn-green' : 'btn-off'}`}
          style={{ width: '100%' }}>
          이 책으로 시작
        </button>
      </div>
    </div>
  );
};


// ── Screen Jacky: 재키(AI 독서 친구) 소개 (#502) ───────────────────────────────
// 첫 한 문장을 남긴 직후, 재키가 그 문장을 읽고 함께 생각을 나누는 AI 친구임을 전달.
const ScreenJacky = ({ onContinue }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', background: '#fff', padding: '0 24px',
    position: 'relative', overflow: 'hidden' }}>
    <div className="sparrow-bounce" style={{ marginBottom: 18, fontSize: 80, lineHeight: 1 }}>
      🐦
    </div>
    <h2 className="pop-in" style={{ fontWeight: 900, fontSize: 24, color: '#1F1F1F', margin: '0 0 12px', textAlign: 'center' }}>
      참새 ‘재키’를 소개할게요
    </h2>
    <p style={{ fontSize: 15, color: '#5B5B5B', lineHeight: 1.65, textAlign: 'center', margin: '0 0 10px', fontWeight: 600, maxWidth: 300 }}>
      재키는 당신의 <b style={{ color: '#1F1F1F' }}>AI 독서 친구</b>예요.<br/>
      방금 남긴 한 문장을 읽고, 함께 생각을 나눠요.
    </p>
    <p style={{ fontSize: 13, color: '#AFAFAF', margin: '0 0 30px', fontWeight: 700, textAlign: 'center' }}>
      영어 이름은 Jacky · 부담 없이, 남기고 싶을 때만
    </p>
    <button onClick={onContinue} className="btn-duo btn-green" style={{ width: '100%', maxWidth: 280, fontSize: 16 }}>
      좋아요 →
    </button>
  </div>
);


// ── Screen D-3: 세리머니 ──────────────────────────────────────────────────────
const ScreenD3 = ({ sessionNum, xpGained, onContinue, isLoggedIn }) => {
  const colors = ['#3FD17F','#FFC233','#FF8A3D','#5AB5F0','#F08A9A','#B690F0','#2EB867','#FFD66B'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', background: '#fff', padding: '0 24px',
      position: 'relative', overflow: 'hidden' }}>

      {/* Confetti 18조각 (§4-D3) */}
      {Array.from({ length: 18 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${4 + i * 5.5}%`, top: -16,
          width: 9, height: 9, borderRadius: 3,
          background: colors[i % 8],
          animation: `confetti 2.4s ${i * 0.014}s cubic-bezier(.25,.5,.5,1) forwards`,
        }}/>
      ))}

      {/* 참새 bounce */}
      <div className="sparrow-bounce" style={{ marginBottom: 12, fontSize: 88, lineHeight: 1 }}>
        🐦
      </div>

      <h2 className="pop-in" style={{ fontWeight: 900, fontSize: 26, color: '#1F1F1F', margin: '0 0 6px', textAlign: 'center' }}>
        훌륭해요!
      </h2>
      <p style={{ fontSize: 14, color: '#AFAFAF', margin: '0 0 28px', fontWeight: 700 }}>
        로드맵 {sessionNum}번째 노드 획득!
      </p>

      {/* 보상 카드 3그리드 (§4-D3) */}
      <div className="pop-in" style={{ display: 'flex', gap: 10, marginBottom: 32, width: '100%', maxWidth: 280 }}>
        {[
          ['🔥', '스트릭 +1', '#FFF3E0', '#FF9600'],
          ['⚡', `+${xpGained} XP`,  '#E0F4FF', '#1CB0F6'],
          ['⬆️', 'hop!',            '#F0FDF4', '#58CC02'],
        ].map(([emoji, label, bg, color]) => (
          <div key={label} style={{ flex: 1, background: bg, borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>{emoji}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color, marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

      <button onClick={onContinue} className="btn-duo btn-green" style={{ width: '100%', maxWidth: 280, fontSize: 16 }}>
        {isLoggedIn ? '내일도 짹 →' : 'Google로 계속'}
      </button>
    </div>
  );
};


// ── Onboarding 컨테이너 ────────────────────────────────────────────────────────
const OnboardingFlow = ({ state, onStateChange, onDone }) => {
  const step = state.onboardingStep;

  const go = s => onStateChange(prev => ({ ...prev, onboardingStep: s }));

  const handleSelectBook = book => {
    onStateChange(prev => ({ ...prev, onboardingBook: book, onboardingStep: 'C2' }));
  };
  const handleConfirmBook = (book, page, text, sentencePage) => {
    onStateChange(prev => ({
      ...prev,
      onboardingBook: book,
      onboardingPage: page,
      onboardingText: text,
      onboardingSentencePage: sentencePage,
      onboardingStep: 'JACKY',
    }));
  };
  const handleLogin = () => {
    onStateChange(prev => ({
      ...prev,
      user: { ...prev.user, handle: 'me', displayName: '나' },
    }));
    onDone();
  };
  const handleContinue = () => {
    if (state.user.handle) {
      onDone();
    } else {
      handleLogin();
    }
  };

  if (step === 'A')  return <ScreenA onStart={() => go('C1')}/>;
  if (step === 'C1') return <ScreenC1 onSelect={handleSelectBook} onManual={() => go('C2_manual')}/>;
  if (step === 'C2' || step === 'C2_manual') return (
    <ScreenC2
      book={state.onboardingBook}
      isManual={step === 'C2_manual'}
      onBack={() => go('C1')}
      onConfirm={handleConfirmBook}
    />
  );
  if (step === 'JACKY') return <ScreenJacky onContinue={() => go('D3')}/>;
  if (step === 'D3') return (
    <ScreenD3
      sessionNum={1}
      xpGained={10}
      onContinue={handleContinue}
      isLoggedIn={!!state.user.handle}
    />
  );
  return <ScreenA onStart={() => go('C1')}/>;
};

// ── window exports ─────────────────────────────────────────────────────────────
window.ScreenA        = ScreenA;
window.ScreenC1       = ScreenC1;
window.ScreenC2       = ScreenC2;
window.ScreenD3       = ScreenD3;
window.OnboardingFlow = OnboardingFlow;
