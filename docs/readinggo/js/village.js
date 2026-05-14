// village.js — 마을 탭 (§5.5 리딩 빌리지)
// 의존: data.js, components.js

// ── 책 상세 시트 ───────────────────────────────────────────────────────────────
const VillageBookDetail = ({ title, onClose }) => {
  const [bookInfo, setBookInfo] = React.useState(null);

  React.useEffect(() => {
    loadBooks().then(books => {
      setBookInfo(books.find(b => b.title === title) || null);
    });
  }, [title]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '20px 20px 40px', maxHeight: '70%', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
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

// ── 친구 상세 시트 ─────────────────────────────────────────────────────────────
const FriendDetail = ({ friend, onClose }) => {
  const npcInfo = NPC_SEARCH_USERS.find(n => n.handle === friend.handle);
  const books = npcInfo?.books || [];
  const [selectedBook, setSelectedBook] = React.useState(null);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '20px 20px 40px', maxHeight: '75%', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NestIcon stage={friend.stage} size={44} isLit={friend.isLit}/>
            <div>
              <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: 0 }}>{friend.name}</p>
              <p style={{ fontSize: 12, color: '#AFAFAF', margin: 0 }}>@{friend.handle}
                {friend.isNpc && <span style={{ fontSize: 10, color: '#AFAFAF' }}> · NPC</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rg-btn-icon"><XIcon s={20}/></button>
        </div>
        {npcInfo?.bio && (
          <p style={{ fontSize: 13, color: '#5A5F69', marginBottom: 14, fontWeight: 600 }}>{npcInfo.bio}</p>
        )}
        {books.length > 0 && (
          <>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', marginBottom: 8 }}>읽고 있는 책</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {books.map(b => (
                <button key={b} onClick={() => setSelectedBook(b)} style={{
                  background: '#F0FDF4', border: '1.5px solid #D7F0BF',
                  borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 700,
                  color: '#1F8E4D', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {b}
                </button>
              ))}
            </div>
          </>
        )}
        {friend.sentence && (
          <>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#AFAFAF', marginBottom: 8 }}>오늘의 문장</p>
            <div style={{ background: '#FAF6F0', borderRadius: 14, padding: '12px 14px',
              borderLeft: '3px solid #3FD17F' }}>
              <p style={{ fontSize: 13, color: '#2A2D33', fontStyle: 'italic',
                lineHeight: 1.6, margin: 0 }}>{friend.sentence}</p>
            </div>
          </>
        )}
      </div>
      {selectedBook && (
        <VillageBookDetail title={selectedBook} onClose={() => setSelectedBook(null)}/>
      )}
    </div>
  );
};

const VillageView = ({ state, onStateChange }) => {
  const friends = state.friends || [];
  const pokes   = state.pokes  || {};
  const [detailFriend, setDetailFriend] = React.useState(null);

  const sendPoke = id => {
    onStateChange(prev => ({ ...prev, pokes: { ...prev.pokes, [id]: true } }));
    // 알림 시뮬레이션 토스트는 app.js에서 처리
    window._showToast && window._showToast('🪱 모이를 보냈어요!');
  };

  return (
    <div className="rg-screen">
      {/* 헤더 */}
      <div className="rg-tab-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🏘️</span>
          <span style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>리딩 빌리지</span>
        </div>
        <p style={{ fontSize: 12, color: '#AFAFAF', fontWeight: 600, margin: '4px 0 0' }}>
          💡 불빛 ON = 오늘 읽음 · 🪱 모이 = 독려 알림
        </p>
      </div>

      <div className="rg-scroll">
        {/* 친구 둥지 3열 그리드 (§5.5) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          {friends.map(f => (
            <div key={f.id} className="rg-card" onClick={() => setDetailFriend(f)} style={{
              padding: 10, cursor: 'pointer',
              borderColor: f.isLit ? '#D7F0BF' : '#E5E5E5',
              boxShadow: f.isLit ? '0 0 8px rgba(255,194,51,0.5)' : '0 2px 8px rgba(0,0,0,.04)',
            }}>
              {/* 둥지 아이콘 + 불빛 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <NestIcon stage={f.stage} size={36} isLit={f.isLit}/>
                {f.isLit && (
                  <span className="rg-badge-green" style={{ fontSize: 10 }}>읽는 중</span>
                )}
              </div>

              {/* 닉네임 (§5.5: @handle) */}
              <p style={{ fontWeight: 800, fontSize: 11, color: '#1F1F1F', margin: '0 0 3px' }}>
                @{f.handle}
              </p>

              {/* 오늘의 문장 1줄 (§5.5) */}
              {f.sentence ? (
                <p className="line-clamp-2" style={{ fontSize: 10, color: '#AFAFAF',
                  lineHeight: 1.4, margin: '0 0 8px', fontStyle: 'italic' }}>
                  {f.sentence}
                </p>
              ) : (
                <div style={{ marginBottom: 8 }}/>
              )}

              {/* 액션: 불빛 ON → "읽는 중" / 불빛 OFF → 🪱 모이 보내기 */}
              {!f.isLit && !f.isNpc && (
                <button
                  onClick={() => !pokes[f.id] && sendPoke(f.id)}
                  disabled={!!pokes[f.id]}
                  style={{
                    width: '100%', padding: '6px 0', borderRadius: 10, border: 'none',
                    cursor: pokes[f.id] ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 10,
                    background: pokes[f.id] ? '#E5E5E5' : '#58CC02',
                    color:      pokes[f.id] ? '#AFAFAF' : '#fff',
                    boxShadow:  pokes[f.id] ? 'none' : '0 3px 0 #46A302',
                    fontFamily: 'Nunito',
                  }}>
                  {pokes[f.id] ? '전송됨 ✓' : '🪱 모이 보내기'}
                </button>
              )}
              {f.isNpc && !f.isLit && (
                <span style={{ fontSize: 10, color: '#AFAFAF', fontWeight: 600 }}>오늘도 곧 읽을 거예요</span>
              )}
            </div>
          ))}
        </div>

        {/* 마을 게시판 */}
        <div className="rg-card" style={{ padding: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 12px' }}>
            📋 마을 게시판
          </p>
          {SEED_BOARD_POSTS.map(post => (
            <div key={post.id} style={{ marginBottom: 12, paddingBottom: 12,
              borderBottom: '1px solid #F7F7F7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 12, color: '#1F1F1F' }}>{post.name}</span>
                {post.isNpc && <span style={{ fontSize: 10, color: '#AFAFAF' }}>· NPC</span>}
                <span style={{ fontSize: 11, color: '#AFAFAF', marginLeft: 'auto' }}>{post.time}</span>
              </div>
              <p style={{ fontSize: 13, color: '#5A5F69', lineHeight: 1.55, margin: 0 }}>{post.text}</p>
            </div>
          ))}
          <button style={{ width: '100%', padding: '8px 0', borderRadius: 12, border: '1.5px dashed #E5E5E5',
            background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#AFAFAF',
            fontFamily: 'inherit' }}>
            ✍️ 글 남기기
          </button>
        </div>
      </div>

      {detailFriend && (
        <FriendDetail friend={detailFriend} onClose={() => setDetailFriend(null)}/>
      )}
    </div>
  );
};

window.VillageView = VillageView;
