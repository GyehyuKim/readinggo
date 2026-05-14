// nest.js — 둥지 탭: The Path + ActiveBookSheet + 일일 미션 모달
// 의존: data.js, components.js

// ── The Path 지그재그 좌표 (§5.1) ─────────────────────────────────────────────
const ZIGZAG = ['22%', '50%', '72%', '50%'];
const getXpct = i => ZIGZAG[i % 4];

// SVG 커넥터용 숫자 변환
const xNum = i => parseFloat(ZIGZAG[i % 4]);

const DynamicPath = ({ sessions, todayDone, onRecord }) => {
  const scrollRef = React.useRef(null);
  const N = sessions.length;
  const totalRows = N + 2; // 완료 노드 + 현재 + ghost
  const HEIGHT = totalRows * 96 + 80;

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [N]);

  return (
    <div style={{ position: 'relative', minHeight: HEIGHT, paddingBottom: 40 }}>
      {/* SVG 점선 커넥터 (§5.1: stroke #D7F0BF, width 5, dasharray "10 6") */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: HEIGHT, pointerEvents: 'none' }}>
        {Array.from({ length: N }, (_, i) => (
          <line key={i}
            x1={`${xNum(i) + 4.5}%`} y1={i * 96 + 52}
            x2={`${xNum(i + 1) + 4.5}%`} y2={(i + 1) * 96 + 52}
            stroke="#D7F0BF" strokeWidth="5" strokeDasharray="10 6" strokeLinecap="round"
          />
        ))}
        {/* 현재 노드 → ghost 커넥터 */}
        <line
          x1={`${xNum(N) + 4.5}%`} y1={N * 96 + 52}
          x2={`${xNum(N + 1) + 4.5}%`} y2={(N + 1) * 96 + 52}
          stroke="#D7F0BF" strokeWidth="5" strokeDasharray="10 6" strokeLinecap="round" opacity="0.4"
        />
      </svg>

      {/* 완료 노드들 (세션 1건 = 노드 1개) */}
      {sessions.map((s, i) => (
        <div key={s.id} className="group" style={{
          position: 'absolute', left: getXpct(i), top: i * 96 + 8,
          transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          {/* 호버 툴팁 (§5.1) */}
          <div className="tooltip" style={{
            position: 'absolute', bottom: '100%', marginBottom: 8, left: '50%',
            transform: 'translateX(-50%)', width: 190, zIndex: 20, pointerEvents: 'none'
          }}>
            <div style={{ background: '#1F1F1F', color: '#fff', borderRadius: 14,
              padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
              <p style={{ fontWeight: 700, margin: '0 0 4px' }}>
                {s.date} · p.{s.currentPage}
              </p>
              <p className="line-clamp-2" style={{ margin: 0, opacity: .85, lineHeight: 1.4 }}>
                {s.sentence}
              </p>
            </div>
          </div>
          {/* 완료 원 (§5.1: 배경 #58CC02, 보더 #46A302, 그림자 0 4px 0 #46A302) */}
          <div className="node-done" style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: 22, color: '#fff' }}>✓</span>
          </div>
          <span style={{ fontSize: 10, color: '#AFAFAF', fontWeight: 700, marginTop: 4 }}>{s.date}</span>
        </div>
      ))}

      {/* 현재 노드 (참새 + CTA) */}
      <div ref={scrollRef} style={{
        position: 'absolute', left: getXpct(N), top: N * 96,
        transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        {/* 참새: 현재 노드 위 (§5.1) */}
        <div className="sparrow-bounce" style={{ marginBottom: 6 }}>
          <Sparrow size={52}/>
        </div>
        {/* 현재 노드 원 */}
        {todayDone ? (
          <div className="node-done" style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: 20 }}>🔥</span>
          </div>
        ) : (
          <button onClick={onRecord} className="node-current" style={{
            width: 56, height: 56, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff', border: '4px solid #58CC02',
          }}>
            <span style={{ fontSize: 22 }}>📝</span>
          </button>
        )}
        {/* CTA 레이블 */}
        <button onClick={!todayDone ? onRecord : undefined} style={{
          marginTop: 8, padding: '6px 16px', borderRadius: 20, border: 'none', cursor: todayDone ? 'default' : 'pointer',
          background: todayDone ? '#E5E5E5' : '#58CC02',
          boxShadow: todayDone ? 'none' : '0 3px 0 #46A302',
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: todayDone ? '#AFAFAF' : '#fff' }}>
            {todayDone ? '오늘 완료! 🎉' : '오늘 기록하기'}
          </span>
        </button>
      </div>

      {/* Ghost 다음 노드 (§5.1: opacity 0.2, ?) */}
      <div style={{
        position: 'absolute', left: getXpct(N + 1), top: (N + 1) * 96 + 8,
        transform: 'translateX(-50%)', opacity: .2
      }}>
        <div className="node-ghost" style={{
          width: 56, height: 56, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontSize: 22, color: '#AFAFAF' }}>?</span>
        </div>
      </div>
    </div>
  );
};

// ── 활성 책 전환 시트 (§5.3) ─────────────────────────────────────────────────
const ActiveBookSheet = ({ userBooks, activeId, onSelect, onClose }) => {
  const reading = userBooks.filter(ub => ub.status !== 'archived');
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* 딤 배경 */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }}/>
      {/* 시트 */}
      <div className="slide-up" style={{ position: 'relative', background: '#fff',
        borderRadius: '24px 24px 0 0', padding: '8px 0 0', maxHeight: '75%', overflowY: 'auto' }}>
        {/* 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E5E5' }}/>
        </div>
        <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', padding: '0 20px 12px',
          borderBottom: '2px solid #E5E5E5', margin: 0 }}>
          읽는 중인 책
        </p>
        {reading.length === 0 && (
          <p style={{ textAlign: 'center', color: '#AFAFAF', padding: '24px 0', fontWeight: 700 }}>
            책장이 비어 있어요 📚
          </p>
        )}
        {reading.map(ub => {
          const pct = Math.min(100, Math.round((ub.currentPage / ub.book.total_pages) * 100));
          const st  = getNestStage(pct);
          const isActive = ub.id === activeId;
          return (
            <button key={ub.id} onClick={() => { onSelect(ub.id); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                padding: '14px 20px', background: isActive ? '#F0FDF4' : 'none',
                border: 'none', cursor: 'pointer', borderBottom: '1px solid #F7F7F7' }}>
              <BookCover book={ub.book} size={52} radius={10}/>
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 4px',
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {ub.book.title}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E5E5E5', overflow: 'hidden' }}>
                    <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, background: st.color }}/>
                  </div>
                  <span style={{ fontSize: 11, color: '#AFAFAF', fontWeight: 700 }}>
                    {ub.currentPage}/{ub.book.total_pages}p
                  </span>
                </div>
              </div>
              {isActive && (
                <span className="rg-badge-green">읽는 중</span>
              )}
            </button>
          );
        })}
        <div style={{ padding: '12px 20px 32px' }}>
          <button onClick={onClose} className="btn-duo btn-white" style={{ width: '100%' }}>닫기</button>
        </div>
      </div>
    </div>
  );
};

// ── 일일 미션 모달 (D-1 → D-2 통합, addOnly=true 면 문장만) ────────────────
const MissionModal = ({ userBook, onClose, onSubmit, addOnly = false }) => {
  const [step, setStep] = React.useState(addOnly ? 'sentence' : 'page');
  const [page, setPage] = React.useState(userBook.currentPage);
  const [sentencePage, setSentencePage] = React.useState(userBook.currentPage);
  const [text, setText] = React.useState('');

  // sentencePage defaults to page value when entering sentence step
  const goToSentence = () => { setSentencePage(page); setStep('sentence'); };

  const bump = d => setPage(p => Math.max(0, Math.min(p + d, userBook.book.total_pages)));
  const textValid = text.trim().length > 0;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex',
      flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }}>
      <div className="slide-up" style={{ background: '#fff', borderRadius: '24px 24px 0 0',
        paddingBottom: 32, maxHeight: '85%', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E5E5' }}/>
        </div>
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>
              {step === 'page' ? '오늘의 독서 기록' : addOnly ? '문장 추가' : '오늘의 문장'}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <XIcon s={20} style={{ color: '#AFAFAF' }}/>
            </button>
          </div>

          {/* 책 칩 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4',
            border: '2px solid #D7F0BF', borderRadius: 14, padding: '10px 14px', marginBottom: 18 }}>
            <BookCover book={userBook.book} size={40} radius={8}/>
            <div>
              <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', margin: 0 }}>{userBook.book.title}</p>
              <p style={{ fontSize: 11, color: '#AFAFAF', margin: 0 }}>{userBook.book.author} · 전 {userBook.book.total_pages}p</p>
            </div>
          </div>

          {step === 'page' ? (
            <>
              <p style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>오늘 읽은 마지막 페이지</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 900, fontSize: 52, color: '#1F1F1F' }}>{page}</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#AFAFAF', marginLeft: 4 }}>/ {userBook.book.total_pages}p</span>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
                <button onClick={() => bump(-1)} className="btn-duo btn-white" style={{ width: 60, height: 60, padding: 0, fontSize: 18, borderRadius: 16 }}>−1</button>
                <button onClick={() => bump(1)}  className="btn-duo btn-green" style={{ width: 60, height: 60, padding: 0, fontSize: 18, borderRadius: 16 }}>+1</button>
                <button onClick={() => bump(10)} className="btn-duo btn-yellow" style={{ width: 68, height: 60, padding: 0, fontSize: 15, borderRadius: 16 }}>+10</button>
              </div>
              <button onClick={goToSentence} className="btn-duo btn-green" style={{ width: '100%' }}>다음</button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>어느 페이지에서?</p>
                  <input
                    type="number" value={sentencePage}
                    onChange={e => setSentencePage(e.target.value)}
                    className="rg-input"
                    style={{ padding: '8px 12px', fontSize: 14 }}
                    onFocus={e => e.target.style.borderColor = '#58CC02'}
                    onBlur={e => e.target.style.borderColor  = '#E5E5E5'}
                  />
                </div>
              </div>
              <p style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>기억하고 싶은 한 문장</p>
              <textarea value={text} onChange={e => { if (e.target.value.length <= 200) setText(e.target.value); }}
                placeholder="마음에 든 한 줄을 적어주세요 (최대 200자)"
                rows={4} autoFocus
                style={{ width: '100%', border: '2px solid #E5E5E5', borderRadius: 14,
                  padding: '12px 14px', fontSize: 14, fontWeight: 600, outline: 'none',
                  resize: 'none', fontFamily: 'Nunito', marginBottom: 6 }}
                onFocus={e => e.target.style.borderColor = '#58CC02'}
                onBlur={e => e.target.style.borderColor  = '#E5E5E5'}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                {!addOnly
                  ? <button onClick={() => setStep('page')} style={{ background:'none',border:'none',cursor:'pointer',
                      color:'#AFAFAF',fontWeight:700,fontSize:13 }}>← 이전</button>
                  : <div/>
                }
                <span style={{ fontSize: 11, color: '#AFAFAF', fontWeight: 700 }}>{text.length}/200</span>
              </div>
              <button onClick={() => textValid && onSubmit(page, text.trim(), parseInt(sentencePage) || page)}
                className={`btn-duo ${textValid ? 'btn-green' : 'btn-off'}`}
                style={{ width: '100%' }} disabled={!textValid}>
                기록 완료 🔥
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── 보상 모달 (D-3 세리머니, 홈 진입 후) ─────────────────────────────────────
const RewardModal = ({ sessionNum, xpGained, isComplete, bookTitle, onClose }) => {
  const colors = ['#3FD17F','#FFC233','#FF8A3D','#5AB5F0','#F08A9A','#B690F0','#2EB867','#FFD66B'];
  if (isComplete) return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)' }}>
      <div className="pop-in" style={{ background: '#fff', borderRadius: 28, padding: 32, margin: '0 20px',
        textAlign: 'center', position: 'relative', overflow: 'hidden', maxWidth: 320, width: '100%' }}>
        {Array.from({ length: 18 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${4 + i * 5.5}%`, top: -16, width: 9, height: 9,
            borderRadius: 3, background: colors[i % 8],
            animation: `confetti 2.4s ${i * 0.014}s cubic-bezier(.25,.5,.5,1) forwards`
          }}/>
        ))}
        <div style={{ fontSize: 72, marginBottom: 8 }}>🏰</div>
        <h2 style={{ fontWeight: 900, fontSize: 24, color: '#1F1F1F', margin: '0 0 4px' }}>완독 대성공!</h2>
        <p style={{ fontSize: 13, color: '#AFAFAF', margin: '0 0 4px' }}>{bookTitle}</p>
        <p style={{ fontWeight: 800, fontSize: 14, color: '#CE82FF', margin: '0 0 20px' }}>리딩 팰리스 달성 🎉</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {['🔥 스트릭', '⭐ +200 XP', '🏅 완독 배지'].map(t => (
            <div key={t} style={{ flex: 1, background: '#F0FDF4', borderRadius: 12, padding: '10px 4px' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#58CC02' }}>{t}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="btn-duo btn-green" style={{ width: '100%' }}>계속 읽기 🐦</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)' }}>
      <div className="pop-in" style={{ background: '#fff', borderRadius: 28, padding: 32, margin: '0 20px',
        textAlign: 'center', maxWidth: 300, width: '100%' }}>
        <div className="sparrow-bounce" style={{ marginBottom: 12 }}>
          <Sparrow size={80}/>
        </div>
        <h2 style={{ fontWeight: 900, fontSize: 24, color: '#1F1F1F', margin: '0 0 4px' }}>훌륭해요!</h2>
        <p style={{ fontSize: 13, color: '#AFAFAF', margin: '0 0 24px' }}>
          로드맵 {sessionNum}번째 노드 획득!
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[['🔥', '스트릭 +1', '#FFF3E0', '#FF9600'], ['⚡', `+${xpGained} XP`, '#E0F4FF', '#1CB0F6'], ['⬆️', 'hop!', '#F0FDF4', '#58CC02']]
            .map(([e, l, bg, cl]) => (
              <div key={l} style={{ flex: 1, background: bg, borderRadius: 14, padding: '12px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 22 }}>{e}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: cl, marginTop: 4 }}>{l}</div>
              </div>
          ))}
        </div>
        <button onClick={onClose} className="btn-duo btn-green" style={{ width: '100%' }}>내일도 짹 →</button>
      </div>
    </div>
  );
};

// ── NestView (둥지 탭 전체) ───────────────────────────────────────────────────
const NestView = ({ state, onStateChange }) => {
  const [showSheet,    setSheet]    = React.useState(false);
  const [showMission,  setMission]  = React.useState(false);
  const [showAddSent,  setAddSent]  = React.useState(false);
  const [showCal,      setCal]      = React.useState(false);
  const [reward,       setReward]   = React.useState(null);

  const activeDate = state.simDate || todayISO();
  const activeBook = getActiveBook(state);
  const todayDone  = hasDoneToday(activeBook, activeDate);

  const handleRecord = (page, text, sentencePage) => {
    const xpGained = 10;
    const isComplete = page >= (activeBook?.book.total_pages || Infinity);
    const sessionId  = genId();
    const d = new Date(activeDate);
    const dateLabel = `${d.getMonth()+1}/${d.getDate()}`;

    onStateChange(prev => {
      const updatedBooks = prev.userBooks.map(ub => {
        if (ub.id !== prev.activeUserBookId) return ub;
        const newSession = {
          id: sessionId, sessionDate: activeDate, currentPage: page,
          xpEarned: xpGained, createdAt: new Date().toISOString(), date: dateLabel, sentence: text,
        };
        const newSentence = {
          id: genId(), text, page: sentencePage != null ? sentencePage : page,
          sessionId, createdAt: new Date().toISOString(),
        };
        return {
          ...ub, currentPage: page,
          status: isComplete ? 'completed' : 'reading',
          sessions: [...(ub.sessions || []), newSession],
          sentences: [...(ub.sentences || []), newSentence],
        };
      });

      const newXP = prev.user.xp + xpGained;
      const sessionDates = getSessionDates(prev.userBooks);
      const prevDay = new Date(activeDate);
      prevDay.setDate(prevDay.getDate() - 1);
      const yesterday = prevDay.toISOString().slice(0, 10);
      const newStreak = sessionDates.has(yesterday) ? prev.user.streak + 1 : 1;
      const newFeed   = [
        { id: genId(), handle: 'me', name: prev.user.displayName || '나',
          book: activeBook.book.title, sentence: text, time: '방금', claps: 0, sympathy: 0, saves: 0 },
        ...prev.feed,
      ];
      return { ...prev, userBooks: updatedBooks,
        user: { ...prev.user, xp: newXP, level: calcLevel(newXP), streak: newStreak },
        feed: newFeed };
    });

    setMission(false);
    const finalNum = (activeBook?.sessions?.length || 0) + 1;
    setReward({ sessionNum: finalNum, xpGained, isComplete, bookTitle: activeBook?.book.title });
  };

  const handleAddSentence = (_, text, sentencePage) => {
    onStateChange(prev => {
      const todaySession = (prev.userBooks.find(u=>u.id===prev.activeUserBookId)?.sessions||[])
        .find(s => s.sessionDate === activeDate);
      const updatedBooks = prev.userBooks.map(ub => {
        if (ub.id !== prev.activeUserBookId) return ub;
        const newSentence = {
          id: genId(), text, page: sentencePage || ub.currentPage,
          sessionId: todaySession?.id || '', createdAt: new Date().toISOString(),
        };
        return { ...ub, sentences: [...(ub.sentences || []), newSentence] };
      });
      return { ...prev, userBooks: updatedBooks };
    });
    setAddSent(false);
    window._showToast && window._showToast('✍️ 문장이 추가됐어요!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <AppHeader streak={state.user.streak} xp={state.user.xp} level={state.user.level}
        onStreakTap={() => setCal(true)}/>

      <div style={{ flex: 1, overflowY: 'auto', background: '#F7F7F7' }}>
        <NestBanner userBook={activeBook} onTap={() => setSheet(true)}/>

        {/* 문장 추가 버튼 (오늘 이미 기록한 경우) */}
        {activeBook && todayDone && (
          <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8 }}>
            <button onClick={() => setAddSent(true)}
              className="btn-duo btn-white"
              style={{ flex: 1, fontSize: 13, padding: '10px 0' }}>
              ✍️ 문장 추가
            </button>
          </div>
        )}

        {/* 로드맵 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 20px 8px' }}>
          <div style={{ flex: 1, height: 1, background: '#E5E5E5' }}/>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#AFAFAF', letterSpacing: 1 }}>나의 독서 로드맵</span>
          <div style={{ flex: 1, height: 1, background: '#E5E5E5' }}/>
        </div>

        {activeBook ? (
          <DynamicPath
            sessions={activeBook.sessions || []}
            todayDone={todayDone}
            onRecord={() => todayDone ? null : setMission(true)}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 32px', color: '#AFAFAF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>책을 등록하면 로드맵이 시작돼요!</p>
          </div>
        )}
      </div>

      {/* 활성 책 전환 시트 */}
      {showSheet && (
        <ActiveBookSheet
          userBooks={state.userBooks}
          activeId={state.activeUserBookId}
          onSelect={id => onStateChange(prev => ({ ...prev, activeUserBookId: id }))}
          onClose={() => setSheet(false)}
        />
      )}

      {/* 일일 미션 모달 */}
      {showMission && activeBook && (
        <MissionModal userBook={activeBook} onClose={() => setMission(false)} onSubmit={handleRecord}/>
      )}

      {/* 문장만 추가 모달 */}
      {showAddSent && activeBook && (
        <MissionModal userBook={activeBook} onClose={() => setAddSent(false)}
          onSubmit={handleAddSentence} addOnly={true}/>
      )}

      {/* 스트릭 달력 */}
      {showCal && (
        <StreakCalendar userBooks={state.userBooks} simDate={state.simDate}
          onClose={() => setCal(false)}/>
      )}

      {/* 보상 모달 */}
      {reward && <RewardModal {...reward} onClose={() => setReward(null)}/>}
    </div>
  );
};

// ── window exports ─────────────────────────────────────────────────────────────
window.DynamicPath     = DynamicPath;
window.ActiveBookSheet = ActiveBookSheet;
window.MissionModal    = MissionModal;
window.RewardModal     = RewardModal;
window.NestView        = NestView;
