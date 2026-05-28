// village.js — 독서모임 탭 (§5.5 신설 및 리딩 빌리지 전면 대체)
// 의존: data.js, components.js

// ── 책 상세 시트 (메가 스트림 및 그룹 상세에서 사용) ───────────────────────────
const VillageBookDetail = ({ title, onClose }) => {
  const [bookInfo, setBookInfo] = React.useState(null);

  React.useEffect(() => {
    loadBooks().then(books => {
      setBookInfo(books.find(b => b.title === title) || null);
    });
  }, [title]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'flex-end' }} onClick={onClose} className="fade-in">
      <div style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '20px 20px 40px', maxHeight: '70%', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()} className="slide-up">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: 0 }}>책 정보</p>
          <button onClick={onClose} className="rg-btn-icon"><XIcon s={20}/></button>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <BookCover book={bookInfo || { cover_url: '', title }} size={88} radius={14}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F', margin: '0 0 6px', lineHeight: 1.3 }}>{title}</p>
            {bookInfo ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#5A5F69', margin: '0 0 4px' }}>{bookInfo.author}</p>
                <p style={{ fontSize: 13, color: '#AFAFAF', margin: '0 0 4px' }}>{bookInfo.publisher}</p>
                <p style={{ fontSize: 13, color: '#AFAFAF', margin: 0 }}>총 {bookInfo.total_pages}p</p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#AFAFAF', margin: 0 }}>로딩 중...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 멤버 상세 시트 ────────────────────────────────────────────────────────────
const MemberDetail = ({ member, onClose }) => {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'flex-end' }} onClick={onClose} className="fade-in">
      <div style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '20px 20px 40px', maxHeight: '60%', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()} className="slide-up">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NestIcon stage={member.stage || 1} size={44} isLit={member.isLit}/>
            <div>
              <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: 0 }}>{member.name}</p>
              <p style={{ fontSize: 12, color: '#AFAFAF', margin: 0 }}>@{member.handle}
                {member.isNpc && <span style={{ fontSize: 10, color: '#AFAFAF' }}> · NPC</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rg-btn-icon"><XIcon s={20}/></button>
        </div>
        
        {member.sentence ? (
          <>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', marginBottom: 8 }}>오늘의 문장</p>
            <div style={{ background: '#FAF6F0', borderRadius: 14, padding: '12px 14px',
              borderLeft: '3px solid #3FD17F' }}>
              <p style={{ fontSize: 13, color: '#2A2D33', fontStyle: 'italic',
                lineHeight: 1.6, margin: 0 }}>{member.sentence}</p>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#AFAFAF', fontStyle: 'italic', margin: 0 }}>아직 오늘 한 줄을 기록하지 않았습니다.</p>
        )}
      </div>
    </div>
  );
};

// ── 모임 만들기 모달 ──────────────────────────────────────────────────────────
const CreateGroupModal = ({ onClose, onCreate }) => {
  const [name, setName] = React.useState('');
  const [bookTitle, setBookTitle] = React.useState('');
  const [privacy, setPrivacy] = React.useState('open');
  const [entryCode, setEntryCode] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('2026-06-30');
  const [desc, setDesc] = React.useState('');
  const [booksList, setBooksList] = React.useState([]);
  const [searchResults, setSearchResults] = React.useState([]);

  React.useEffect(() => {
    loadBooks().then(setBooksList);
  }, []);

  const handleBookChange = (val) => {
    setBookTitle(val);
    if (val.trim().length >= 2) {
      setSearchResults(fuzzySearch(booksList, val).slice(0, 5));
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectBook = (title) => {
    setBookTitle(title);
    setSearchResults([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !bookTitle.trim()) {
      window._showToast && window._showToast('모임 이름과 도서를 입력해 주세요.');
      return;
    }
    const newGroup = {
      id: 'sub_' + Date.now(),
      name,
      bookTitle,
      type: privacy === 'open' ? 'public' : privacy === 'approve' ? 'approve' : 'private',
      privacy,
      entryCode: privacy === 'code' ? (entryCode || '1234') : '',
      targetDate,
      membersCount: 1,
      maxMembers: 10,
      targetPages: 300,
      description: desc || '함께 모여 꾸준한 독서 레이스를 펼치는 모임입니다.',
      host: 'me',
      members: [
        { id: 'me', handle: 'me', name: '나', stage: 1, isLit: false, sentence: '' }
      ]
    };
    onCreate(newGroup);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} className="fade-in">
      <div style={{ width: '100%', background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 10px 25px rgba(0,0,0,.15)' }}
        className="pop-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontWeight: 900, fontSize: 18, color: '#1F1F1F', margin: 0 }}>📚 서브 독서모임 만들기</p>
          <button onClick={onClose} className="rg-btn-icon"><XIcon s={20}/></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', display: 'block', marginBottom: 4 }}>모임 이름</label>
            <input type="text" className="rg-input" placeholder="예: 매일 사피엔스 격파단" value={name} onChange={e => setName(e.target.value)} required/>
          </div>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', display: 'block', marginBottom: 4 }}>대상 책</label>
            <input type="text" className="rg-input" placeholder="책 제목 또는 저자 검색" value={bookTitle} onChange={e => handleBookChange(e.target.value)} required/>
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, background: '#fff', border: '2px solid #E5E5E5',
                borderRadius: 14, zIndex: 110, marginTop: 4, maxHeight: 150, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
                {searchResults.map(b => (
                  <div key={b.title} onClick={() => handleSelectBook(b.title)} style={{ padding: '8px 12px', cursor: 'pointer',
                    borderBottom: '1px solid #F7F7F7', fontSize: 13, fontWeight: 700, color: '#2A2D33' }}>
                    {b.title} <span style={{ fontSize: 11, color: '#AFAFAF', fontWeight: 600 }}>({b.author})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', display: 'block', marginBottom: 4 }}>접근 방식</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['open', '공개'], ['approve', '승인제'], ['code', '입장코드']].map(([k, v]) => (
                <button type="button" key={k} onClick={() => setPrivacy(k)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: 12, border: '2px solid',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  borderColor: privacy === k ? '#3FD17F' : '#E5E5E5',
                  background: privacy === k ? '#F1FBF5' : '#fff',
                  color: privacy === k ? '#1F8E4D' : '#5A5F69',
                }}>{v}</button>
              ))}
            </div>
          </div>
          {privacy === 'code' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', display: 'block', marginBottom: 4 }}>입장 코드</label>
              <input type="text" className="rg-input" placeholder="입장 코드를 설정하세요 (예: 1234)" value={entryCode} onChange={e => setEntryCode(e.target.value)} required/>
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', display: 'block', marginBottom: 4 }}>종료 목표 날짜</label>
            <input type="date" className="rg-input" value={targetDate} onChange={e => setTargetDate(e.target.value)} required/>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', display: 'block', marginBottom: 4 }}>한 줄 설명</label>
            <textarea className="rg-input" placeholder="모임에 대한 짧은 소개글을 적어주세요." rows="2" style={{ resize: 'none' }} value={desc} onChange={e => setDesc(e.target.value)}/>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-duo btn-white" style={{ flex: 1, padding: '10px 0' }}>취소</button>
            <button type="submit" className="btn-duo btn-green" style={{ flex: 1, padding: '10px 0' }}>모임 개설</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── 독서모임 상세 화면 (메가 스트림 / 서브 모임 모두 대응) ──────────────────
const GroupDetailView = ({ group, isMega, joined, pending, onBack, onJoin, onVerifyCode, onApproveSimulate, state, onStateChange }) => {
  const [selectedMember, setSelectedMember] = React.useState(null);
  const [selectedBook, setSelectedBook] = React.useState(null);
  const [codeVal, setCodeVal] = React.useState('');
  const [boardText, setBoardText] = React.useState('');
  
  // 로컬 보드 포스트
  const [boardPosts, setBoardPosts] = React.useState([]);

  React.useEffect(() => {
    if (isMega) {
      setBoardPosts(SEED_BOARD_POSTS.filter(bp => bp.text.includes(group.title) || group.title === '사피엔스')); // 임시 필터링
    } else {
      setBoardPosts([
        { id: 'bp1', handle: 'gyehyu', name: '계휴', time: '1시간 전', text: '다들 매일 한 페이지만이라도 꾸준히 읽어봅시다! 화이팅 🔥' },
        { id: 'bp2', handle: 'book_bear', name: '책읽는곰돌이', time: '3시간 전', text: '사피엔스는 정말 읽을 때마다 머리를 한 대 맞는 기분이에요.' }
      ]);
    }
  }, [group, isMega]);

  const pokes = state.pokes || {};
  const sendPoke = id => {
    onStateChange(prev => ({ ...prev, pokes: { ...prev.pokes, [id]: true } }));
    window._showToast && window._showToast('🪱 모이를 보냈어요!');
  };

  const handleAddPost = (e) => {
    e.preventDefault();
    if (!boardText.trim()) return;
    const newPost = {
      id: 'gp_' + Date.now(),
      handle: 'me',
      name: '나',
      time: '방금 전',
      text: boardText,
    };
    setBoardPosts([newPost, ...boardPosts]);
    setBoardText('');
    window._showToast && window._showToast('✍️ 글을 등록했습니다.');
  };

  // 마일스톤 게이지 & 디데이 계산
  const daysLeft = group.targetDate ? Math.max(0, Math.ceil((new Date(group.targetDate) - new Date()) / (1000 * 60 * 60 * 24))) : 14;
  const progressPct = isMega ? 68 : 45; // 데모용 고정 값

  // 메가 스트림 피드 데이터
  const megaFeeds = SEED_FEED.filter(f => f.book === group.title);
  // 서브 모임 피드 데이터
  const subFeeds = SEED_GROUP_FEEDS[group.id] || [];

  return (
    <div className="rg-screen fade-in" style={{ background: '#F7F7F7' }}>
      {/* 헤더 */}
      <div className="rg-tab-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} className="rg-btn-icon"><BackIcon s={22}/></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isMega ? `📚 ${group.title} 메가 스트림` : group.name}
          </p>
          <p style={{ fontSize: 11, color: '#AFAFAF', fontWeight: 600, margin: 0 }}>
            {isMega ? `누구나 자유롭게 소통하는 광장` : `🎯 목표: ${group.bookTitle}`}
          </p>
        </div>
      </div>

      <div className="rg-scroll">
        {/* 모임 기본 정보 카드 */}
        <div className="rg-card" style={{ padding: 16, marginBottom: 16, borderColor: '#ECE6DA', background: '#fff' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
            <button onClick={() => setSelectedBook(isMega ? group.title : group.bookTitle)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
              <BookCover book={{ title: isMega ? group.title : group.bookTitle }} size={60} radius={10}/>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#2A2D33', margin: '0 0 4px', lineHeight: 1.3 }}>
                {isMega ? `전체 ${group.membersCount}명의 리더들과 실시간 레이싱!` : group.description}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <span className="rg-badge-green">👥 {group.membersCount}명 가입</span>
                {!isMega && <span style={{ fontSize: 11, fontWeight: 700, color: '#FF8A3D' }}>⏳ D-{daysLeft}일</span>}
              </div>
            </div>
          </div>

          {/* 게이지 바 */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#AFAFAF', marginBottom: 4 }}>
              <span>🏃 레이스 평균 진도율</span>
              <span style={{ color: '#3FD17F' }}>{progressPct}%</span>
            </div>
            <div style={{ width: '100%', height: 10, background: '#E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#3FD17F', transition: 'width 0.5s ease' }}/>
            </div>
          </div>
        </div>

        {/* 미가입 시 접근 차단 */}
        {!joined && !isMega ? (
          <div className="rg-card" style={{ padding: 30, textAlign: 'center', background: '#fff', borderColor: '#E5E5E5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 44 }}>🔒</span>
            <div>
              <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: '0 0 6px' }}>가입자 전용 피드입니다</p>
              <p style={{ fontSize: 13, color: '#AFAFAF', fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
                이 서브 모임은 비공개/수락 기반입니다.<br/>코드를 입력하거나 가입을 신청하고 참여해 보세요.
              </p>
            </div>

            {/* 가입 방식별 대응 */}
            {group.privacy === 'code' && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  className="rg-input"
                  placeholder="입장 코드 입력 (DOPAMINE)"
                  value={codeVal}
                  onChange={e => setCodeVal(e.target.value)}
                  style={{ textAlign: 'center', letterSpacing: 2 }}
                />
                <button
                  onClick={() => onVerifyCode(codeVal)}
                  className="btn-duo btn-green"
                  style={{ width: '100%', padding: '10px 0' }}
                >
                  입장하기
                </button>
              </div>
            )}

            {group.privacy === 'approve' && (
              <div style={{ width: '100%', marginTop: 8 }}>
                {pending ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                    <button className="btn-duo btn-off" style={{ width: '100%', padding: '10px 0' }} disabled>
                      ⌛ 모임장 승인 대기 중
                    </button>
                    <button
                      onClick={onApproveSimulate}
                      className="btn-duo btn-white"
                      style={{ width: '100%', padding: '8px 0', border: '1.5px dashed #3FD17F!important', color: '#1F8E4D' }}
                    >
                      🚀 모임장 즉시 수락 연출 (데모용)
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onJoin}
                    className="btn-duo btn-green"
                    style={{ width: '100%', padding: '10px 0' }}
                  >
                    📝 가입 신청하기
                  </button>
                )}
              </div>
            )}

            {group.privacy === 'open' && (
              <button
                onClick={onJoin}
                className="btn-duo btn-green"
                style={{ width: '100%', padding: '10px 0', marginTop: 8 }}
              >
                🏃 즉시 가입하기
              </button>
            )}
          </div>
        ) : (
          /* 가입 상태인 경우 상세 피드와 멤버 리스트 공개 */
          <>
            {/* 멤버 둥지 그리드 (3열) */}
            <p style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', marginBottom: 8 }}>👥 함께 달리는 멤버들</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {/* 메가 스트림은 전체 친구 리스트 노출, 서브 모임은 해당 멤버 노출 */}
              {(isMega ? state.friends : group.members).map(m => (
                <div key={m.id} className="rg-card" onClick={() => setSelectedMember(m)} style={{
                  padding: 10, cursor: 'pointer', background: '#fff',
                  borderColor: m.isLit ? '#D7F0BF' : '#E5E5E5',
                  boxShadow: m.isLit ? '0 0 8px rgba(255,194,51,0.4)' : '0 2px 6px rgba(0,0,0,.02)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <NestIcon stage={m.stage || 3} size={32} isLit={m.isLit}/>
                    {m.isLit && <span className="rg-badge-green" style={{ fontSize: 9, padding: '1px 5px' }}>읽음</span>}
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 11, color: '#1F1F1F', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{m.handle}
                  </p>
                  {m.sentence ? (
                    <p className="line-clamp-2" style={{ fontSize: 9, color: '#AFAFAF', lineHeight: 1.3, margin: '0 0 6px', fontStyle: 'italic' }}>
                      {m.sentence}
                    </p>
                  ) : (
                    <p style={{ fontSize: 9, color: '#C7CCD3', margin: '0 0 6px' }}>아직 쉬는 중</p>
                  )}

                  {/* 🪱 모이 콕 찌르기 */}
                  {!m.isLit && m.handle !== 'me' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if(!pokes[m.id]) sendPoke(m.id); }}
                      disabled={!!pokes[m.id]}
                      style={{
                        width: '100%', padding: '4px 0', borderRadius: 8, border: 'none',
                        cursor: pokes[m.id] ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 9,
                        background: pokes[m.id] ? '#E5E5E5' : '#58CC02',
                        color:      pokes[m.id] ? '#AFAFAF' : '#fff',
                        boxShadow:  pokes[m.id] ? 'none' : '0 2px 0 #46A302',
                        fontFamily: 'Nunito',
                      }}>
                      {pokes[m.id] ? '완료' : '🪱 모이'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 실시간 모이 하이라이트 (피드) */}
            <p style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', marginBottom: 8 }}>💬 실시간 모이 피드</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {(isMega ? megaFeeds : subFeeds).length > 0 ? (
                (isMega ? megaFeeds : subFeeds).map(f => (
                  <div key={f.id} className="rg-card" style={{ background: '#fff', padding: 12, borderColor: '#ECE6DA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: '#1F1F1F' }}>@{f.handle}</span>
                      <span style={{ fontSize: 11, color: '#3FD17F', fontWeight: 700 }}>📖 {f.page}p</span>
                      <span style={{ fontSize: 10, color: '#AFAFAF', marginLeft: 'auto' }}>{f.time}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#2A2D33', fontStyle: 'italic', lineHeight: 1.5, margin: 0, borderLeft: '3px solid #FFC233', paddingLeft: 8 }}>
                      {f.sentence}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rg-card" style={{ padding: 24, textAlign: 'center', background: '#fff', color: '#AFAFAF', fontWeight: 700, fontSize: 12 }}>
                  🐦 오늘의 첫 모이를 모아보세요!
                </div>
              )}
            </div>

            {/* 모임 게시판 / 방명록 */}
            <div className="rg-card" style={{ padding: 16, background: '#fff', borderColor: '#E5E5E5' }}>
              <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', margin: '0 0 12px' }}>📋 자유게시판</p>
              
              <form onSubmit={handleAddPost} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input
                  type="text"
                  className="rg-input"
                  placeholder="모임원들에게 인사나 응원을 남겨보세요!"
                  value={boardText}
                  onChange={e => setBoardText(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                />
                <button type="submit" className="btn-duo btn-green" style={{ padding: '8px 16px', fontSize: 12, borderRadius: 12, height: 42, whiteSpace: 'nowrap' }}>
                  등록
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 200, overflowY: 'auto' }}>
                {boardPosts.map(bp => (
                  <div key={bp.id} style={{ borderBottom: '1px solid #F7F7F7', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: 11, color: '#1F1F1F' }}>@{bp.handle}</span>
                      <span style={{ fontSize: 9, color: '#AFAFAF' }}>· {bp.name}</span>
                      <span style={{ fontSize: 9, color: '#AFAFAF', marginLeft: 'auto' }}>{bp.time}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#5A5F69', margin: 0, lineHeight: 1.4 }}>{bp.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 서브 모달 팝업들 */}
      {selectedMember && (
        <MemberDetail member={selectedMember} onClose={() => setSelectedMember(null)}/>
      )}
      {selectedBook && (
        <VillageBookDetail title={selectedBook} onClose={() => setSelectedBook(null)}/>
      )}
    </div>
  );
};

// ── 메인 독서모임 탭 뷰 ──────────────────────────────────────────────────────
const VillageView = ({ state, onStateChange }) => {
  const [activeSubTab, setActiveSubTab] = React.useState('mega'); // 'mega' | 'sub' | 'explore'
  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [isGroupMega, setIsGroupMega] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // 로컬 그룹 상태 동기화
  const [groups, setGroups] = React.useState(window.SEED_SUB_GROUPS);

  // 가입 및 신청 대기 상태
  const joinedIds = state.joinedGroupIds || ['sub1'];
  const pendingIds = state.pendingGroupIds || [];

  const handleCreateGroup = (newGroup) => {
    setGroups([newGroup, ...groups]);
    onStateChange(prev => ({
      ...prev,
      joinedGroupIds: [...(prev.joinedGroupIds || []), newGroup.id]
    }));
    setShowCreateModal(false);
    setSelectedGroup(newGroup);
    setIsGroupMega(false);
    window._showToast && window._showToast(`🎉 독서모임 '${newGroup.name}'이 생성되었습니다!`);
  };

  const handleJoinGroup = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (group.type === 'approve') {
      // 승인 대기 추가
      onStateChange(prev => ({
        ...prev,
        pendingGroupIds: [...(prev.pendingGroupIds || []), groupId]
      }));
      window._showToast && window._showToast('📝 가입을 신청했습니다. 승인을 기다려주세요!');
    } else {
      // 즉시 가입
      onStateChange(prev => ({
        ...prev,
        joinedGroupIds: [...(prev.joinedGroupIds || []), groupId]
      }));
      window._showToast && window._showToast('🏃 독서모임에 가입되었습니다!');
    }
  };

  const handleVerifyCode = (groupId, code) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (code.toUpperCase() === group.entryCode) {
      onStateChange(prev => ({
        ...prev,
        joinedGroupIds: [...(prev.joinedGroupIds || []), groupId]
      }));
      window._showToast && window._showToast('🔑 비밀코드가 확인되어 가입되었습니다!');
    } else {
      window._showToast && window._showToast('❌ 코드가 올바르지 않습니다.');
    }
  };

  // 모임장 즉시 승인 시뮬레이션
  const handleApproveSimulate = (groupId) => {
    onStateChange(prev => ({
      ...prev,
      pendingGroupIds: (prev.pendingGroupIds || []).filter(id => id !== groupId),
      joinedGroupIds: [...(prev.joinedGroupIds || []), groupId]
    }));
    // 가입 멤버에 '나' 추가
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          membersCount: g.membersCount + 1,
          members: [...g.members, { id: 'me', handle: 'me', name: '나', stage: 1, isLit: false, sentence: '' }]
        };
      }
      return g;
    }));
    window._showToast && window._showToast('👑 모임장 활자라쿤님이 가입을 승인하셨습니다!');
  };

  // 1. 상세 화면 렌더링
  if (selectedGroup) {
    const isJoined = isGroupMega || joinedIds.includes(selectedGroup.id);
    const isPending = pendingIds.includes(selectedGroup.id);
    return (
      <GroupDetailView
        group={selectedGroup}
        isMega={isGroupMega}
        joined={isJoined}
        pending={isPending}
        onBack={() => setSelectedGroup(null)}
        onJoin={() => handleJoinGroup(selectedGroup.id)}
        onVerifyCode={(code) => handleVerifyCode(selectedGroup.id, code)}
        onApproveSimulate={() => handleApproveSimulate(selectedGroup.id)}
        state={state}
        onStateChange={onStateChange}
      />
    );
  }

  // 필터링된 모임 목록
  const mySubGroups = groups.filter(g => joinedIds.includes(g.id));
  const exploreGroups = groups.filter(g => !joinedIds.includes(g.id));

  return (
    <div className="rg-screen">
      {/* 헤더 */}
      <div className="rg-tab-header" style={{ borderBottom: 'none', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>👥</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: '#1F1F1F' }}>독서모임</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-duo btn-green"
            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 10, boxShadow: '0 2.5px 0 #46A302' }}
          >
            ➕ 모임 만들기
          </button>
        </div>
      </div>

      {/* 내부 하브 필터 탭 */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '2px solid #E5E5E5', padding: '0 16px' }}>
        {[
          ['mega', '🏢 메가 스트림'],
          ['sub', '👥 내 모임'],
          ['explore', '🔍 탐색'],
        ].map(([k, v]) => (
          <button
            key={k}
            onClick={() => setActiveSubTab(k)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 900,
              color: activeSubTab === k ? '#58CC02' : '#AFAFAF',
              borderBottom: activeSubTab === k ? '4px solid #58CC02' : '4px solid transparent',
              marginBottom: -2, transition: 'all 0.2s',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="rg-scroll" style={{ background: '#F7F7F7' }}>
        
        {/* A. 메가 스트림 탭 */}
        {activeSubTab === 'mega' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#FFF9F0', border: '1.5px solid #ECE6DA', borderRadius: 16, padding: 12, fontSize: 12, color: '#8A6234', fontWeight: 600, lineHeight: 1.4 }}>
              📢 <b>메가 스트림이란?</b> 책을 서재에 등록하면 자동으로 활성화되는 광장형 모임입니다. 같은 책을 읽는 리더들과 실시간으로 소통할 수 있어요!
            </div>
            {window.SEED_MEGA_STREAMS.map(m => (
              <div
                key={m.id}
                className="rg-card"
                onClick={() => { setSelectedGroup(m); setIsGroupMega(true); }}
                style={{ background: '#fff', cursor: 'pointer', transition: 'transform 0.15s', padding: 14 }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 24, background: '#F7F7F7', padding: 8, borderRadius: 12 }}>{m.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 900, fontSize: 15, color: '#1F1F1F', margin: '0 0 3px' }}>
                      《{m.title}》 메가 스트림
                    </p>
                    <p style={{ fontSize: 11, color: '#AFAFAF', fontWeight: 700, margin: 0 }}>
                      👥 {m.membersCount}명 독주 중 · 📖 오늘 누적 {m.todayPages}p 읽음
                    </p>
                  </div>
                  <span style={{ fontSize: 14, color: '#C7CCD3' }}>▶</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* B. 내 모임 탭 */}
        {activeSubTab === 'sub' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mySubGroups.length > 0 ? (
              mySubGroups.map(g => (
                <div
                  key={g.id}
                  className="rg-card"
                  onClick={() => { setSelectedGroup(g); setIsGroupMega(false); }}
                  style={{ background: '#fff', cursor: 'pointer', padding: 14 }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <BookCover book={{ title: g.bookTitle }} size={48} radius={8}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 900, fontSize: 14, color: '#1F1F1F', margin: '0 0 4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {g.name}
                      </p>
                      <p style={{ fontSize: 11, color: '#5A5F69', fontWeight: 700, margin: '0 0 4px' }}>
                        📖 책: {g.bookTitle}
                      </p>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="rg-badge-green">👥 {g.membersCount}명</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#FF8A3D' }}>⏳ D-{Math.max(0, Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24)))}일</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#AFAFAF', fontWeight: 800 }}>
                <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>🪹</span>
                아직 가입한 서브 모임이 없습니다.<br/>
                <small style={{ fontWeight: 600, color: '#C7CCD3', marginTop: 4, display: 'block' }}>[탐색] 탭에서 원하는 모임을 찾아보세요!</small>
              </div>
            )}
          </div>
        )}

        {/* C. 탐색 탭 */}
        {activeSubTab === 'explore' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {exploreGroups.map(g => {
              const isPending = pendingIds.includes(g.id);
              return (
                <div
                  key={g.id}
                  className="rg-card"
                  onClick={() => { setSelectedGroup(g); setIsGroupMega(false); }}
                  style={{ background: '#fff', cursor: 'pointer', padding: 14 }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <BookCover book={{ title: g.bookTitle }} size={48} radius={8}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <p style={{ fontWeight: 900, fontSize: 14, color: '#1F1F1F', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                          {g.name}
                        </p>
                        {g.privacy === 'code' && <span style={{ fontSize: 11 }}>🔒</span>}
                        {g.privacy === 'approve' && <span style={{ fontSize: 10, background: '#EFF6FF', color: '#1CB0F6', padding: '1px 4px', borderRadius: 4, fontWeight: 800 }}>승인</span>}
                      </div>
                      <p style={{ fontSize: 11, color: '#5A5F69', fontWeight: 700, margin: '0 0 6px' }}>
                        📖 책: {g.bookTitle}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span className="rg-badge-green">👥 {g.membersCount}/{g.maxMembers}명</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#AFAFAF' }}>⏳ D-{Math.max(0, Math.ceil((new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24)))}일</span>
                        </div>
                        {isPending ? (
                          <span style={{ fontSize: 10, color: '#FF9600', fontWeight: 800 }}>대기 중</span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#58CC02', fontWeight: 850 }}>가입 신청 ▶</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 모임 생성 모달 */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  );
};

window.VillageView = VillageView;
