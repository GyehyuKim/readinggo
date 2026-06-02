/* =========================================================
   ReadingGo — village.js
   마을 탭: 목록 / 찾기 / 추천 / 지난 마을
   ========================================================= */

function VillageView({ state, onSelectTown }) {
  const { useMemo, useState } = React;
  const [isFinderOpen, setIsFinderOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [finderTab, setFinderTab] = useState('code');
  const [inviteCode, setInviteCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTown, setPreviewTown] = useState(null);
  const [finderError, setFinderError] = useState('');
  const [isPastOpen, setIsPastOpen] = useState(false);
  const [createBookQuery, setCreateBookQuery] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createVisibility, setCreateVisibility] = useState('public');
  const [createCapacity, setCreateCapacity] = useState('');
  const [createPartCount, setCreatePartCount] = useState('3');
  const [createBookId, setCreateBookId] = useState((state.book && state.book.id) || 'b001');
  const [createError, setCreateError] = useState('');

  const towns = state.towns || [];
  const codeInputRef = React.useRef(null);

  const getDday = (dday) => {
    if (dday === 0) return '오늘';
    if (dday < 0) return `D-${Math.abs(dday)}`;
    return `D+${dday}`;
  };

  const getTownProgress = (town) => {
    const totalParts = Math.max(town.totalParts || 1, 1);
    return Math.min(100, Math.max(0, (town.currentPart / totalParts) * 100));
  };

  const getTodayDoneCount = (town) => {
    return (town.members || []).filter((member) => member.todayRecorded).length;
  };

  const activeTowns = useMemo(
    () => towns.filter((town) => (town.collection || 'active') === 'active'),
    [towns]
  );

  const pastTowns = useMemo(
    () => towns.filter((town) => (town.collection || 'active') === 'past'),
    [towns]
  );

  const recommendedTowns = useMemo(() => {
    const currentBookId = state.book && state.book.id;
    return towns
      .filter((town) => (town.collection || 'active') === 'recommended' && (town.visibility || 'public') === 'public')
      .slice()
      .sort((a, b) => {
        const aPriority = a.bookId === currentBookId ? 0 : 1;
        const bPriority = b.bookId === currentBookId ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (b.memberCount || 0) - (a.memberCount || 0);
      });
  }, [towns, state.book]);

  const createBookOptions = useMemo(() => {
    const query = createBookQuery.trim().toLowerCase();
    return (ALL_BOOKS || [])
      .filter((book) => {
        if (!query) return true;
        const haystack = [book.title, book.author, book.publisher, book.isbn].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [createBookQuery]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return recommendedTowns;

    return towns.filter((town) => {
      if ((town.collection || 'active') === 'past') return false;
      if ((town.visibility || 'public') !== 'public') return false;

      const book = getBook(town.bookId);
      const haystack = [town.name, town.currentRange, book.title, book.author, town.bookId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [towns, recommendedTowns, searchQuery]);

  const openFinder = () => {
    setFinderTab('code');
    setInviteCode('');
    setSearchQuery('');
    setPreviewTown(null);
    setFinderError('');
    setIsFinderOpen(true);
  };

  const closeFinder = () => {
    setIsFinderOpen(false);
    setPreviewTown(null);
    setFinderError('');
  };

  const handleCreateTown = () => {
    setCreateBookQuery('');
    setCreateTitle('');
    setCreateDescription('');
    setCreateVisibility('public');
    setCreateCapacity('');
    setCreatePartCount('3');
    setCreateBookId((state.book && state.book.id) || 'b001');
    setCreateError('');
    setIsCreateOpen(true);
  };

  const closeCreateTown = () => {
    setIsCreateOpen(false);
    setCreateError('');
  };

  const submitCreateTown = () => {
    if (!createBookId) {
      setCreateError('책을 먼저 선택해주세요.');
      return;
    }

    const partCount = Math.max(1, parseInt(createPartCount, 10) || 0);
    const capacityValue = createCapacity.trim() ? parseInt(createCapacity, 10) : null;

    if (createCapacity.trim() && (!capacityValue || capacityValue < 2)) {
      setCreateError('직접 정원을 입력할 경우 최소 2명 이상이어야 해요.');
      return;
    }

    if (!createTitle.trim()) {
      setCreateError('마을 이름을 입력해주세요.');
      return;
    }

    // Phase0: create town in-memory and navigate into it
    const id = 'town_' + Math.random().toString(36).slice(2,9);
    const normalizedCapacity = capacityValue || null;
    const invite = createVisibility === 'private' ? Array.from({length:6}).map(()=>String.fromCharCode(65+Math.floor(Math.random()*26))).join('') : null;
    const newTown = {
      id,
      bookId: createBookId,
      name: createTitle.trim(),
      collection: 'active',
      visibility: createVisibility,
      inviteCode: invite,
      capacity: normalizedCapacity,
      myRole: 'admin',
      coAdmins: [],
      memberCount: 1,
      currentPart: 1,
      totalParts: partCount,
      dday: 0,
      isOpen: true,
      leader: '@jerome',
      currentRange: '프롤로그',
      status: 'active',
      milestones: Array.from({ length: partCount }).map((_,i)=>({ part: i+1, dueDate: null, completed: false })),
      members: [ { name: 'jerome', nest: '🏠', avatar: '🐦', todayRecorded: false, quote: '', cumulativePage: state.book ? state.book.cur || 0 : 0, streak: 0, xp: state.xp || 0 } ],
    };
    state.towns = state.towns || [];
    state.towns.push(newTown);
    showToast(`마을을 만들었어요: ${newTown.name}`);
    closeCreateTown();
    onSelectTown(newTown.id);
  };

  const submitInviteCode = () => {
    const normalized = inviteCode.trim().toUpperCase();
    if (normalized.length < 6) {
      setFinderError('코드 6자리를 모두 입력해주세요.');
      return;
    }

    const matchedTown = towns.find((town) => (town.inviteCode || '').toUpperCase() === normalized);
    if (!matchedTown) {
      setFinderError('마을을 찾을 수 없어요. 코드를 다시 확인해주세요.');
      return;
    }

    setFinderError('');
    setPreviewTown(matchedTown);
  };

  const openTownPreview = (town) => {
    setFinderError('');
    setPreviewTown(town);
  };

  const handleJoinTown = () => {
    if (!previewTown) return;
    // edge checks: cannot join past/completed, cannot join if already member, capacity
    const town = previewTown;
    const isPast = (town.collection || '') === 'past' || town.status === 'completed';
    if (isPast) { setFinderError('이 마을은 완료되어 참여할 수 없습니다.'); return; }
    const already = (town.members || []).some(m => m.name === 'jerome');
    if (already) { setFinderError('이미 참여 중인 마을입니다.'); return; }
    if (town.capacity && (town.memberCount || (town.members||[]).length) >= town.capacity) { setFinderError('정원이 마감되었습니다.'); return; }

    // add member (Phase0 in-memory simulation)
    town.members = town.members || [];
    town.members.push({ name: 'jerome', nest: '🏠', avatar: '🐦', todayRecorded: false, quote: '', cumulativePage: state.book ? state.book.cur || 0 : 0, streak: 0, xp: state.xp || 0 });
    town.memberCount = (town.memberCount || 0) + 1;
    showToast('마을에 참여했습니다');
    onSelectTown(town.id);
    closeFinder();
  };

  return (
    <section className="view active">
      <div style={{padding:'14px 16px 6px'}}>
        <div style={{fontSize:24, fontWeight:900, letterSpacing:'-.4px'}}>🏘️ 마을</div>
        <div style={{fontSize:13, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
          함께 읽는 마을을 찾고, 참여하고, 다시 돌아볼 수 있어요
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.3fr .9fr', gap:10, padding:'10px 16px 18px'}}>
        <button
          onClick={openFinder}
          style={{
            padding:'14px 14px',
            border:'none',
            borderRadius:14,
            background:'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
            color:'white',
            fontWeight:800,
            fontSize:15,
            cursor:'pointer',
            boxShadow:'0 8px 18px rgba(34, 122, 83, 0.18)',
          }}
        >
          🔍 마을 찾기
        </button>
        <button
          onClick={handleCreateTown}
          style={{
            padding:'14px 12px',
            border:'1.5px solid var(--line-2)',
            borderRadius:14,
            background:'var(--card)',
            color:'var(--ink-1)',
            fontWeight:800,
            fontSize:14,
            cursor:'pointer',
          }}
        >
          + 만들기
        </button>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:18, padding:'0 16px 20px'}}>
        <TownSection
          title={`참여 중인 마을 (${activeTowns.length})`}
          towns={activeTowns}
          emptyText="참여 중인 마을이 없어요"
          renderTown={(town) => (
            <TownCard
              key={town.id}
              town={town}
              book={getBook(town.bookId)}
              onClick={() => onSelectTown(town.id)}
              dday={getDday(town.dday)}
              metaText={`${town.currentPart}/${town.totalParts} 파트 · ${getDday(town.dday)}`}
              progressLabel={`${getTodayDoneCount(town)}/${town.memberCount || (town.members || []).length}명 완료`}
              progressPercent={getTownProgress(town)}
              showCompletedBadge={town.status === 'completed' || town.collection === 'past'}
            />
          )}
        />

        <div>
          <button
            onClick={() => setIsPastOpen((value) => !value)}
            style={{
              width:'100%',
              display:'flex',
              alignItems:'center',
              justifyContent:'space-between',
              gap:10,
              padding:'0 2px',
              border:'none',
              background:'transparent',
              cursor:'pointer',
              marginBottom:10,
            }}
          >
            <div style={{fontSize:14, fontWeight:900, color:'var(--ink-1)'}}>지난 마을</div>
            <div style={{fontSize:14, color:'var(--ink-2)', fontWeight:800, transform:isPastOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s ease'}}>
              ▾
            </div>
          </button>
          {isPastOpen && (
            <TownSection
              title=""
              towns={pastTowns}
              emptyText="지난 마을이 없어요"
              renderTown={(town) => (
                <TownCard
                  key={town.id}
                  town={town}
                  book={getBook(town.bookId)}
                  onClick={() => onSelectTown(town.id)}
                  dday={town.completedLabel || getDday(town.dday)}
                  metaText={`${town.statusLabel || '완료'} · ${town.completedLabel || '최근'} · 책 ${town.completedBooks || 1}권`}
                  progressLabel="읽기 전용으로 다시 볼 수 있어요"
                  progressPercent={100}
                  showCompletedBadge
                  compact
                />
              )}
            />
          )}
        </div>

        {recommendedTowns.length > 0 && (
          <TownSection
            title="추천 공개 마을"
            towns={recommendedTowns}
            emptyText=""
            renderTown={(town) => {
              const book = getBook(town.bookId);
              return (
                <button
                  key={town.id}
                  onClick={() => openTownPreview(town)}
                  style={{
                    width:'100%',
                    textAlign:'left',
                    padding:'14px',
                    border:'1.5px solid var(--line)',
                    borderRadius:16,
                    background:'var(--card)',
                    cursor:'pointer',
                  }}
                >
                  <div style={{display:'flex', gap:12, alignItems:'center'}}>
                    <div style={{width:52, height:72, flexShrink:0, borderRadius:10, overflow:'hidden', background:'var(--line-2)'}}>
                      {book.cover ? (
                        <img src={book.cover} alt={book.title} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                      ) : (
                        <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24}}>📘</div>
                      )}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:15, fontWeight:800, color:'var(--ink-1)', lineHeight:1.35}}>{town.name}</div>
                      <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, marginTop:3}}>{book.title}</div>
                      <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:8}}>
                        <span>{town.memberCount}명</span>
                        <span>·</span>
                        <span>{town.currentPart}/{town.totalParts} 파트</span>
                        <span>·</span>
                        <span style={{color:'var(--accent)'}}>{getDday(town.dday)}</span>
                      </div>
                    </div>
                    <div style={{alignSelf:'center', color:'var(--brand-3)', fontWeight:800, fontSize:13}}>신청하기</div>
                  </div>
                </button>
              );
            }}
          />
        )}
      </div>

      {isFinderOpen && (
        <div
          style={{
            position:'fixed',
            inset:0,
            background:'rgba(16, 24, 18, 0.52)',
            display:'flex',
            alignItems:'flex-end',
            zIndex:9999,
          }}
          onClick={closeFinder}
        >
          <div
            style={{
              width:'100%',
              background:'var(--paper)',
              borderRadius:'22px 22px 0 0',
              boxShadow:'0 -18px 40px rgba(0,0,0,0.16)',
              maxHeight:'88vh',
              overflow:'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--line)'}}>
              <div style={{fontSize:15, fontWeight:800}}>마을 찾기</div>
              <button onClick={closeFinder} style={{background:'transparent', border:'none', fontSize:20, cursor:'pointer', padding:4}}>×</button>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'12px 16px 0'}}>
              <button
                onClick={() => { setFinderTab('code'); setFinderError(''); }}
                style={{
                  padding:'10px 12px',
                  border:'1.5px solid ' + (finderTab === 'code' ? 'var(--brand)' : 'var(--line)'),
                  background: finderTab === 'code' ? 'var(--brand-tint)' : 'var(--card)',
                  borderRadius:12,
                  fontWeight:800,
                  cursor:'pointer',
                }}
              >
                🔐 코드 입력
              </button>
              <button
                onClick={() => { setFinderTab('search'); setFinderError(''); }}
                style={{
                  padding:'10px 12px',
                  border:'1.5px solid ' + (finderTab === 'search' ? 'var(--brand)' : 'var(--line)'),
                  background: finderTab === 'search' ? 'var(--brand-tint)' : 'var(--card)',
                  borderRadius:12,
                  fontWeight:800,
                  cursor:'pointer',
                }}
              >
                🌐 책으로 검색
              </button>
            </div>

            <div style={{padding:'16px', overflowY:'auto', maxHeight:'calc(88vh - 118px)'}}>
              {finderTab === 'code' ? (
                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:10}}>코드로 참여하기</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:8, marginBottom:14}}>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        onClick={() => { if (codeInputRef && codeInputRef.current) codeInputRef.current.focus(); }}
                        style={{
                          height:48,
                          borderRadius:12,
                          border:'1.5px solid var(--line)',
                          display:'flex',
                          alignItems:'center',
                          justifyContent:'center',
                          fontSize:16,
                          fontWeight:900,
                          background:'var(--card)',
                          letterSpacing:'0.1em',
                          cursor:'text',
                        }}
                      >
                        {(inviteCode[index] || '·').toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <input
                    ref={codeInputRef}
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6));
                      setFinderError('');
                    }}
                    placeholder="코드 6자리 입력"
                    maxLength={6}
                    autoComplete="off"
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      letterSpacing:'0.18em',
                      textAlign:'center',
                      boxSizing:'border-box',
                    }}
                  />
                  <button
                    onClick={submitInviteCode}
                    disabled={inviteCode.trim().length < 6}
                    style={{
                      width:'100%',
                      marginTop:12,
                      padding:'12px 14px',
                      border:'none',
                      borderRadius:12,
                      background: inviteCode.trim().length < 6 ? 'var(--line-2)' : 'var(--brand)',
                      color: inviteCode.trim().length < 6 ? 'var(--ink-3)' : 'white',
                      fontWeight:900,
                      cursor: inviteCode.trim().length < 6 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    코드로 참여하기
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFinderError('');
                    }}
                    placeholder="책 제목 · 저자로 검색..."
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                      marginBottom:12,
                    }}
                  />

                  {searchResults.length > 0 ? (
                    searchResults.map((town) => {
                      const book = getBook(town.bookId);
                      return (
                        <button
                          key={town.id}
                          onClick={() => openTownPreview(town)}
                          style={{
                            width:'100%',
                            textAlign:'left',
                            padding:'12px 14px',
                            border:'1px solid var(--line)',
                            borderRadius:14,
                            background:'var(--card)',
                            marginBottom:10,
                            cursor:'pointer',
                          }}
                        >
                          <div style={{fontSize:14, fontWeight:900, lineHeight:1.35}}>{town.name}</div>
                          <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, marginTop:4}}>{book.title}</div>
                          <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:8}}>
                            <span>{town.memberCount}명</span>
                            <span>·</span>
                            <span>{town.currentPart}/{town.totalParts} 파트</span>
                            <span>·</span>
                            <span style={{color:'var(--accent)'}}>{getDday(town.dday)}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : searchQuery.trim() ? (
                    <div style={{padding:'28px 4px', textAlign:'center', color:'var(--ink-2)'}}>
                      <div style={{fontSize:18, marginBottom:8}}>이 책을 읽는 공개 마을이 없어요.</div>
                      <div style={{fontSize:13}}>직접 만들어볼까요? <span style={{fontWeight:900, color:'var(--brand-3)'}}>마을 만들기 →</span></div>
                    </div>
                  ) : (
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700}}>
                      현재 읽는 책과 참여자 수가 많은 공개 마을을 먼저 보여줘요.
                    </div>
                  )}
                </div>
              )}

              {finderError && (
                <div style={{marginTop:12, padding:'12px 14px', borderRadius:12, background:'var(--rose-soft)', color:'var(--rose)', fontSize:13, fontWeight:700}}>
                  {finderError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div
          style={{
            position:'fixed',
            inset:0,
            background:'rgba(16, 24, 18, 0.52)',
            display:'flex',
            alignItems:'flex-end',
            zIndex:10001,
          }}
          onClick={closeCreateTown}
        >
          <div
            style={{
              width:'100%',
              background:'var(--paper)',
              borderRadius:'22px 22px 0 0',
              boxShadow:'0 -18px 40px rgba(0,0,0,0.16)',
              maxHeight:'90vh',
              overflow:'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--line)'}}>
              <div style={{fontSize:15, fontWeight:800}}>마을 개설</div>
              <button onClick={closeCreateTown} style={{background:'transparent', border:'none', fontSize:20, cursor:'pointer', padding:4}}>×</button>
            </div>

            <div style={{padding:16, overflowY:'auto', maxHeight:'calc(90vh - 58px)'}}>
              <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:10}}>책 선택</div>
              <input
                value={createBookQuery}
                onChange={(e) => setCreateBookQuery(e.target.value)}
                placeholder="내서재 또는 책 제목 검색"
                style={{
                  width:'100%',
                  padding:'12px 14px',
                  borderRadius:12,
                  border:'1.5px solid var(--line)',
                  background:'var(--paper)',
                  fontSize:14,
                  fontWeight:700,
                  boxSizing:'border-box',
                  marginBottom:10,
                }}
              />
              <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
                {createBookOptions.map((book) => (
                  <button
                    key={book.book_id}
                    onClick={() => setCreateBookId(book.book_id)}
                    style={{
                      width:'100%',
                      textAlign:'left',
                      padding:'12px 14px',
                      border:'1.5px solid ' + (createBookId === book.book_id ? 'var(--brand)' : 'var(--line)'),
                      borderRadius:14,
                      background: createBookId === book.book_id ? 'var(--brand-tint)' : 'var(--card)',
                      cursor:'pointer',
                    }}
                  >
                    <div style={{fontSize:14, fontWeight:900, lineHeight:1.35}}>{book.title}</div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, marginTop:4}}>{book.author}</div>
                  </button>
                ))}
              </div>

              <div style={{display:'grid', gap:12}}>
                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>마을 정보</div>
                  <input
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="마을 이름"
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                      marginBottom:8,
                    }}
                  />
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="소개 (선택)"
                    rows={3}
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                      resize:'vertical',
                    }}
                  />
                </div>

                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>공개 설정</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                    {[
                      { value: 'public', label: '공개' },
                      { value: 'private', label: '비공개' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setCreateVisibility(option.value)}
                        style={{
                          padding:'11px 12px',
                          border:'1.5px solid ' + (createVisibility === option.value ? 'var(--brand)' : 'var(--line)'),
                          background: createVisibility === option.value ? 'var(--brand-tint)' : 'var(--card)',
                          borderRadius:12,
                          fontWeight:800,
                          cursor:'pointer',
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>정원 설정</div>
                  <input
                    value={createCapacity}
                    onChange={(e) => setCreateCapacity(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="기본값: 제한 없음"
                    inputMode="numeric"
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                    }}
                  />
                  <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginTop:6}}>직접 설정 시 최소 2명 이상</div>
                </div>

                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>마일스톤</div>
                  <input
                    value={createPartCount}
                    onChange={(e) => setCreatePartCount(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="파트 수"
                    inputMode="numeric"
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                      marginBottom:8,
                    }}
                  />
                  <div style={{padding:'12px 14px', borderRadius:14, background:'var(--card)', border:'1px solid var(--line)'}}>
                    <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:8}}>자동 분할 미리보기</div>
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      {Array.from({ length: Math.max(1, parseInt(createPartCount, 10) || 1) }).slice(0, 3).map((_, index) => (
                        <div key={index} style={{fontSize:12, color:'var(--ink-2)', fontWeight:700}}>
                          파트 {index + 1} · 마감일은 개설 후 지정
                        </div>
                      ))}
                      {(parseInt(createPartCount, 10) || 0) > 3 && (
                        <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700}}>+ 나머지 파트는 동일한 방식으로 이어집니다</div>
                      )}
                    </div>
                  </div>
                </div>

                {createDescription.trim() && (
                  <div style={{padding:'12px 14px', borderRadius:14, background:'var(--brand-tint)', color:'var(--brand-3)', fontSize:13, fontWeight:800}}>
                    {createDescription.trim()}
                  </div>
                )}

                {createError && (
                  <div style={{padding:'12px 14px', borderRadius:12, background:'var(--rose-soft)', color:'var(--rose)', fontSize:13, fontWeight:700}}>
                    {createError}
                  </div>
                )}

                <button
                  onClick={submitCreateTown}
                  style={{
                    width:'100%',
                    padding:'13px 14px',
                    border:'none',
                    borderRadius:14,
                    background:'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
                    color:'white',
                    fontWeight:900,
                    fontSize:14,
                    cursor:'pointer',
                    boxShadow:'0 8px 18px rgba(34, 122, 83, 0.18)',
                  }}
                >
                  마을 개설하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewTown && (() => {
        const book = getBook(previewTown.bookId);
        const currentMilestone = (previewTown.milestones || []).find((milestone) => milestone.part === previewTown.currentPart);
        return (
          <div
            style={{
              position:'fixed',
              inset:0,
              background:'rgba(0,0,0,0.5)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              zIndex:10000,
              padding:16,
            }}
            onClick={() => setPreviewTown(null)}
          >
            <div
              style={{
                width:'100%',
                maxWidth:420,
                background:'var(--paper)',
                borderRadius:20,
                overflow:'hidden',
                boxShadow:'0 24px 60px rgba(0,0,0,0.24)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{padding:'16px 16px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--line)'}}>
                <div style={{fontSize:15, fontWeight:900}}>마을 발견!</div>
                <button onClick={() => setPreviewTown(null)} style={{background:'transparent', border:'none', fontSize:20, cursor:'pointer'}}>×</button>
              </div>

              <div style={{padding:16}}>
                <div style={{display:'flex', gap:12, alignItems:'flex-start', marginBottom:14}}>
                  <div style={{width:68, height:94, flexShrink:0, borderRadius:14, overflow:'hidden', background:'var(--line-2)'}}>
                    {book.cover ? (
                      <img src={book.cover} alt={book.title} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                    ) : (
                      <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28}}>📘</div>
                    )}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:16, fontWeight:900, lineHeight:1.35}}>{previewTown.name}</div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
                      관리자: {previewTown.leader} {previewTown.visibility === 'private' ? '👑' : ''}
                    </div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
                      인원: {previewTown.memberCount} / {previewTown.capacity || 10}명
                    </div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
                      현재: {previewTown.currentPart}/{previewTown.totalParts} 파트 · {getDday(previewTown.dday)}
                    </div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
                      이번 파트: {previewTown.currentRange || currentMilestone?.title || '마일스톤 확인'}
                    </div>
                  </div>
                </div>

                <div style={{padding:'12px 14px', borderRadius:14, background:'var(--brand-tint)', color:'var(--brand-3)', fontSize:13, fontWeight:800, marginBottom:14}}>
                  🐦 파트 {previewTown.currentPart} 진행 중! 지금 참여하면 바로 달릴 수 있어요.
                </div>

                {(() => {
                  const isMember = (previewTown.members || []).some(m => m.name === 'jerome');
                  const isFull = previewTown.capacity && (previewTown.memberCount || (previewTown.members||[]).length) >= previewTown.capacity;
                  const isPast = (previewTown.collection || '') === 'past' || previewTown.status === 'completed';
                  let label = '참여하기';
                  if (isPast) label = '완료된 마을';
                  else if (isMember) label = '참여 중';
                  else if (isFull) label = '정원 마감';

                  return (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                      <button
                        onClick={() => setPreviewTown(null)}
                        style={{
                          padding:'12px 14px',
                          border:'1.5px solid var(--line-2)',
                          borderRadius:12,
                          background:'var(--card)',
                          fontWeight:900,
                          cursor:'pointer',
                        }}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleJoinTown}
                        disabled={isPast || isMember || isFull}
                        style={{
                          padding:'12px 14px',
                          border:'none',
                          borderRadius:12,
                          background: (isPast || isMember || isFull) ? 'var(--line-2)' : 'var(--brand)',
                          color: (isPast || isMember || isFull) ? 'var(--ink-3)' : 'white',
                          fontWeight:900,
                          cursor: (isPast || isMember || isFull) ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

function TownSection({ title, towns, renderTown, emptyText }) {
  if (!title) {
    return towns.length > 0 ? (
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {towns.map((town) => renderTown(town))}
      </div>
    ) : emptyText ? (
      <div style={{padding:'18px 14px', borderRadius:14, border:'1px dashed var(--line-2)', color:'var(--ink-2)', fontSize:13, fontWeight:700}}>{emptyText}</div>
    ) : null;
  }

  return (
    <div>
      <div style={{fontSize:14, fontWeight:900, color:'var(--ink-1)', marginBottom:10}}>{title}</div>
      {towns.length > 0 ? (
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {towns.map((town) => renderTown(town))}
        </div>
      ) : emptyText ? (
        <div style={{padding:'18px 14px', borderRadius:14, border:'1px dashed var(--line-2)', color:'var(--ink-2)', fontSize:13, fontWeight:700}}>{emptyText}</div>
      ) : null}
    </div>
  );
}

function TownCard({ town, book, onClick, dday, metaText, progressLabel, progressPercent, showCompletedBadge, compact }) {
  return (
    <button
      onClick={onClick}
      style={{
        width:'100%',
        textAlign:'left',
        border:'1.5px solid var(--line)',
        borderRadius:18,
        background:'var(--card)',
        padding:14,
        cursor:'pointer',
        boxShadow: compact ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{display:'flex', gap:12}}>
        <div style={{width:62, height:86, flexShrink:0, borderRadius:12, overflow:'hidden', background:`linear-gradient(135deg, ${book.fb[0]} 0%, ${book.fb[1]} 100%)`, boxShadow:'0 4px 12px rgba(0,0,0,0.14)'}}>
          {book.cover ? (
            <img src={book.cover} alt={book.title} style={{width:'100%', height:'100%', objectFit:'cover'}} />
          ) : (
            <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28}}>📘</div>
          )}
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:15, fontWeight:900, color:'var(--ink-1)', lineHeight:1.35}}>{town.name}</div>
              <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>{book.title}</div>
            </div>
            {showCompletedBadge ? <div style={{fontSize:13, fontWeight:900, color:'var(--brand-3)'}}>✅ 완료</div> : null}
          </div>

          <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:10}}>
            <span>{metaText}</span>
          </div>

          <div style={{marginTop:10}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:8, fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>
              <span>{progressLabel}</span>
              <span style={{color:'var(--accent)'}}>{dday}</span>
            </div>
            <div style={{height:8, borderRadius:999, background:'var(--line-2)', overflow:'hidden'}}>
              <div style={{width:`${progressPercent}%`, height:'100%', borderRadius:999, background:'linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%)'}} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

window.VillageView = VillageView;
