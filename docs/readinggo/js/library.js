// library.js — 내서재 탭 (§5.7: 책 목록 + 책 상세 + Markdown export + 설정)
// 의존: data.js, components.js

// ── 책 상세 화면 ───────────────────────────────────────────────────────────────
const BookDetail = ({ userBook, onBack, onDelete }) => {
  const { book, currentPage, sessions = [], sentences = [] } = userBook;
  const pct = Math.min(100, Math.round((currentPage / book.total_pages) * 100));
  const st  = getNestStage(pct);

  // §5.7 Markdown export
  const handleExport = () => {
    const lines = [`# ${book.title} — ${book.author}\n`];
    sentences.slice().reverse().forEach(s => {
      const d = new Date(s.createdAt);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      lines.push(`## ${dateStr} (p.${s.page})`);
      lines.push(`> ${s.text}\n`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${book.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '2px solid #E5E5E5', background: '#fff' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <BackIcon s={22} style={{ color: '#AFAFAF' }}/>
        </button>
        <span style={{ flex: 1, fontWeight: 900, fontSize: 16, color: '#1F1F1F', overflow: 'hidden',
          whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{book.title}</span>
        <button onClick={handleExport} style={{ background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 12px', borderRadius: 10, background: '#F0FDF4', border: '1.5px solid #D7F0BF' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#58CC02' }}>↓ Export</span>
        </button>
      </div>

      <div className="rg-scroll">
        {/* 표지 + 진척 바 */}
        <div className="rg-card" style={{ padding: 20, marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
          <BookCover book={book} size={80} radius={14}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: '#1F1F1F', margin: '0 0 4px',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{book.title}</p>
            <p style={{ fontSize: 12, color: '#AFAFAF', margin: '0 0 10px' }}>{book.author}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#E5E5E5', overflow: 'hidden' }}>
                <div style={{ height: 8, borderRadius: 4, width: `${pct}%`, background: st.color }}/>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{pct}%</span>
            </div>
            <p style={{ fontSize: 11, color: '#AFAFAF', margin: '4px 0 0' }}>
              {currentPage}/{book.total_pages}p · {sessions.length}회 기록
            </p>
          </div>
        </div>

        {/* 오늘의 문장 타임라인 (§5.7: 날짜 desc) */}
        <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', marginBottom: 10 }}>📝 기록한 문장</p>
        {sentences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#AFAFAF' }}>
            <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
              오늘의 문장을 첫 페이지에 남겨보세요
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sentences.slice().reverse().map(s => {
              const d = new Date(s.createdAt);
              const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
              return (
                <div key={s.id} className="rg-card" style={{ borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#58CC02' }}>{dateStr}</span>
                    <span style={{ fontSize: 12, color: '#AFAFAF', fontWeight: 700 }}>p.{s.page}</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#1F1F1F', lineHeight: 1.6, margin: 0,
                    fontStyle: 'italic' }}>{s.text}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* 교보문고 링크 (§5.7) */}
        <a href={KYOBO_URLS[book.isbn] || `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(book.isbn || book.title)}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', textAlign: 'center', marginTop: 16, padding: '12px 0',
            background: '#FFF9F0', border: '1.5px solid #FFE0A0', borderRadius: 14,
            fontSize: 13, fontWeight: 800, color: '#C8901C', textDecoration: 'none' }}>
          교보문고에서 보기 →
        </a>

        {/* 삭제 (§5.7: soft delete) */}
        <button onClick={() => window.confirm('이 책을 삭제할까요? 기록은 보존됩니다.') && onDelete(userBook.id)}
          style={{ marginTop: 20, width: '100%', background: 'none', border: '2px solid #E5E5E5',
            borderRadius: 14, padding: '12px 0', color: '#AFAFAF', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', fontFamily: 'Nunito' }}>
          책 삭제 (기록 보존)
        </button>
      </div>
    </div>
  );
};

// ── 설정 화면 ─────────────────────────────────────────────────────────────────
const SettingsView = ({ state, onBack, onStateChange, onReset }) => {
  const [handle, setHandle] = React.useState(state.user.handle || '');
  const [shieldSim, setShieldSim] = React.useState(false);

  const saveHandle = () => {
    if (!handle.trim()) return;
    onStateChange(prev => ({ ...prev, user: { ...prev.user, handle: handle.trim() } }));
    window._showToast && window._showToast('닉네임이 저장되었어요 ✓');
  };

  // §9 2:45 시뮬레이션: 방패 0 → 스트릭 리셋
  const triggerShieldSim = () => {
    setShieldSim(true);
    onStateChange(prev => ({
      ...prev,
      user: { ...prev.user, streak: 0, shields: 0 },
    }));
    window._showToast && window._showToast('🌱 오늘부터 다시 1일차예요');
    setTimeout(() => setShieldSim(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '2px solid #E5E5E5', background: '#fff' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <BackIcon s={22} style={{ color: '#AFAFAF' }}/>
        </button>
        <span style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>설정</span>
      </div>

      <div className="rg-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 닉네임 */}
        <div className="rg-card" style={{ padding: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 10px' }}>닉네임 (§5.8)</p>
          <p style={{ fontSize: 11, color: '#AFAFAF', margin: '0 0 10px', lineHeight: 1.5 }}>
            영소문자 / 숫자 / 한글 / 언더스코어 · 2~16자
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={handle} onChange={e => setHandle(e.target.value)}
              placeholder="@nickname"
              style={{ flex: 1, border: '2px solid #E5E5E5', borderRadius: 12, padding: '10px 14px',
                fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'Nunito' }}
              onFocus={e => e.target.style.borderColor = '#58CC02'}
              onBlur={e => e.target.style.borderColor  = '#E5E5E5'}
            />
            <button onClick={saveHandle} className="btn-duo btn-green" style={{ padding: '10px 16px', fontSize: 13 }}>
              저장
            </button>
          </div>
        </div>

        {/* 데모 시뮬레이션 패널 (§9) */}
        <div className="rg-card" style={{ padding: 20, borderColor: '#FFC80044' }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 4px' }}>
            🎬 데모 시뮬레이션
          </p>
          <p style={{ fontSize: 11, color: '#AFAFAF', margin: '0 0 12px' }}>Phase 0 발표용</p>
          <button onClick={triggerShieldSim} className="btn-duo btn-yellow" style={{ width: '100%', fontSize: 13 }}>
            미참여 시뮬 (방패 0 → 스트릭 리셋)
          </button>
        </div>

        {/* 로그아웃 */}
        <div className="rg-card" style={{ padding: 20 }}>
          <button onClick={onReset} style={{ width: '100%', background: 'none', border: '2px solid #FF4B4B',
            borderRadius: 14, padding: '12px 0', color: '#FF4B4B', fontWeight: 800, fontSize: 14,
            cursor: 'pointer', fontFamily: 'Nunito' }}>
            로그아웃 / 데이터 초기화
          </button>
          <p style={{ fontSize: 11, color: '#AFAFAF', textAlign: 'center', margin: '8px 0 0' }}>
            Phase 0: localStorage 전체 삭제
          </p>
        </div>
      </div>
    </div>
  );
};

// ── LibraryView (내서재 탭) ────────────────────────────────────────────────────
const LibraryView = ({ state, onStateChange, onAddBook }) => {
  const [query,      setQuery]  = React.useState('');
  const [detail,     setDetail] = React.useState(null); // userBook id
  const [showSettings, setSettings] = React.useState(false);
  const [libTab, setLibTab] = React.useState('shelf'); // 'shelf' | 'wish' | 'bookmark'

  const userBooks  = state.userBooks  || [];
  const wishBooks  = state.wishBooks  || [];
  const bookmarks  = state.bookmarks  || [];
  const activeBook = getActiveBook(state);

  const filtered = query
    ? userBooks.filter(ub =>
        ub.book.title.toLowerCase().includes(query.toLowerCase()) ||
        ub.book.author.toLowerCase().includes(query.toLowerCase()))
    : userBooks;

  const handleDelete = id => {
    onStateChange(prev => ({
      ...prev,
      userBooks: prev.userBooks.map(ub => ub.id === id ? { ...ub, status: 'archived' } : ub),
      activeUserBookId: prev.activeUserBookId === id ? null : prev.activeUserBookId,
    }));
    setDetail(null);
  };

  const handleReset = () => {
    if (window.confirm('모든 데이터를 초기화할까요?')) {
      localStorage.removeItem('rg_v41');
      localStorage.removeItem('rg_pending_sentence');
      window.location.reload();
    }
  };

  // 책 상세 화면
  const detailBook = detail ? userBooks.find(ub => ub.id === detail) : null;
  if (detailBook) return (
    <BookDetail
      userBook={detailBook}
      onBack={() => setDetail(null)}
      onDelete={handleDelete}
    />
  );

  // 설정 화면
  if (showSettings) return (
    <SettingsView
      state={state}
      onBack={() => setSettings(false)}
      onStateChange={onStateChange}
      onReset={handleReset}
    />
  );

  const visible = filtered.filter(ub => ub.status !== 'archived');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '2px solid #E5E5E5', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>📚</span>
          <span style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>내 서재</span>
        </div>
        <button onClick={() => setSettings(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <SettingsIcon s={22} style={{ color: '#AFAFAF' }}/>
        </button>
      </div>

      {/* 탭 행 */}
      <div style={{ display: 'flex', padding: '0 16px', borderBottom: '2px solid #E5E5E5',
        background: '#fff', gap: 0, flexShrink: 0 }}>
        {[['shelf','내 책장'],['wish','관심 책'],['bookmark','책갈피']].map(([id, label]) => (
          <button key={id} onClick={() => setLibTab(id)} style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 800, fontSize: 13, fontFamily: 'inherit',
            color: libTab === id ? '#3FD17F' : '#AFAFAF',
            borderBottom: libTab === id ? '2.5px solid #3FD17F' : '2.5px solid transparent',
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      <div className="rg-scroll">
        {/* ── 관심 책 탭 ── */}
        {libTab === 'wish' && (
          <div style={{ padding: '16px 0' }}>
            {wishBooks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#AFAFAF' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📌</div>
                <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>마음에 드는 책을 발견하면 담아두세요</p>
                <p style={{ fontSize: 12, margin: '6px 0 0', color: '#C7CCD3' }}>소셜 피드 모이 → 책 상세 → 관심 책 추가</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wishBooks.slice().reverse().map((w, i) => (
                  <div key={i} className="rg-card" style={{ padding: '14px 16px' }}>
                    <p style={{ fontWeight: 900, fontSize: 14, color: '#1F1F1F', margin: '0 0 2px' }}>{w.bookTitle}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <a href={KYOBO_URLS[w.isbn] || `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(w.isbn || w.bookTitle)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ flex: 1, textAlign: 'center', padding: '8px 0',
                          background: '#FFF9F0', border: '1.5px solid #FFE0A0', borderRadius: 10,
                          fontSize: 12, fontWeight: 800, color: '#C8901C', textDecoration: 'none' }}>
                        교보문고에서 보기 →
                      </a>
                      <button
                        onClick={() => onStateChange(prev => ({
                          ...prev,
                          wishBooks: prev.wishBooks.filter((_, idx) => idx !== prev.wishBooks.length - 1 - i),
                        }))}
                        style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E5E5E5',
                          background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          color: '#AFAFAF', fontFamily: 'inherit' }}>
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 책갈피 탭 ── */}
        {libTab === 'bookmark' && (
          <div style={{ padding: '16px 0' }}>
            {bookmarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#AFAFAF' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🔖</div>
                <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>저장한 모이가 없어요</p>
                <p style={{ fontSize: 12, margin: '6px 0 0', color: '#C7CCD3' }}>소셜 피드에서 🔖 탭하면 여기에 모여요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bookmarks.slice().reverse().map(b => (
                  <div key={b.id} className="rg-card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#3FD17F' }}>{b.book}</span>
                      {b.page && <span style={{ fontSize: 12, color: '#AFAFAF', fontWeight: 700 }}>p.{b.page}</span>}
                    </div>
                    <p style={{ fontSize: 13, color: '#4a4a4a', fontStyle: 'italic', lineHeight: 1.6,
                      margin: '0 0 8px', borderLeft: '3px solid #3FD17F', paddingLeft: 10 }}>
                      {b.sentence}
                    </p>
                    <p style={{ fontSize: 11, color: '#AFAFAF', margin: 0 }}>@{b.handle} · {b.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 내 책장 탭 ── */}
        {libTab === 'shelf' && (<>
        {/* 현재 읽는 중 카드 (§5.7) */}
        {activeBook && (
          <div onClick={() => setDetail(activeBook.id)} className="rg-card" style={{
            marginBottom: 12, cursor: 'pointer', borderColor: '#D7F0BF' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#58CC02', margin: '0 0 8px' }}>
              📖 현재 읽는 중
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BookCover book={activeBook.book} size={52} radius={10}/>
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 2px' }}>
                  {activeBook.book.title}
                </p>
                <p style={{ fontSize: 12, color: '#AFAFAF', margin: 0 }}>
                  {activeBook.book.author} · {activeBook.currentPage}/{activeBook.book.total_pages}p
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 검색창 */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <SearchIcon s={16} style={{ position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: '#AFAFAF' }}/>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="책 제목, 저자 검색..."
            style={{ width: '100%', border: '2px solid #E5E5E5', borderRadius: 14,
              padding: '11px 14px 11px 36px', fontSize: 14, fontWeight: 600,
              outline: 'none', fontFamily: 'Nunito', background: '#fff', transition: 'border-color .2s' }}
            onFocus={e => e.target.style.borderColor = '#58CC02'}
            onBlur={e => e.target.style.borderColor  = '#E5E5E5'}
          />
        </div>

        {/* 책 목록 */}
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#AFAFAF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>첫 책을 등록해보세요 📚</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {visible.map(ub => {
              const pct = Math.min(100, Math.round((ub.currentPage / ub.book.total_pages) * 100));
              const st  = getNestStage(pct);
              return (
                <button key={ub.id} onClick={() => setDetail(ub.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, background: '#fff',
                  borderRadius: 16, padding: '14px 16px', border: '2px solid #E5E5E5',
                  cursor: 'pointer', textAlign: 'left', width: '100%'
                }}>
                  <BookCover book={ub.book} size={48} radius={10}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 2px',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {ub.book.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#AFAFAF', margin: '0 0 6px' }}>
                      {ub.book.author} · {ub.currentPage}/{ub.book.total_pages}p
                      {ub.status === 'completed' && <span style={{ color: '#58CC02', marginLeft: 6 }}>✓ 완독</span>}
                    </p>
                    <div style={{ height: 5, borderRadius: 3, background: '#E5E5E5', overflow: 'hidden' }}>
                      <div style={{ height: 5, borderRadius: 3, width: `${pct}%`, background: st.color }}/>
                    </div>
                  </div>
                  <RightIcon s={18} style={{ color: '#AFAFAF', flexShrink: 0 }}/>
                </button>
              );
            })}
          </div>
        )}

        {/* + 책 추가하기 */}
        <button onClick={onAddBook} className="btn-duo btn-white" style={{ width: '100%' }}>
          + 책 추가하기
        </button>
        </>)}
      </div>
    </div>
  );
};

window.BookDetail    = BookDetail;
window.SettingsView  = SettingsView;
window.LibraryView   = LibraryView;
