// social.js — 소셜 탭 (§5.6: 신규 시작러 Top3 + 모이 피드 + 짹 + 책갈피 + 모이 상세)
// 의존: data.js, components.js

const SEED_TOP3 = [
  { rank: 1, title: '사피엔스',   count: 23 },
  { rank: 2, title: '데미안',     count: 18 },
  { rank: 3, title: '어린 왕자', count: 15 },
];

// ── 모이 상세 페이지 ───────────────────────────────────────────────────────────
const MoiDetail = ({ item, isJaekd, isBookmarked, isWished, onBack, onJaek, onBookmark, onAddWish }) => {
  const [bookInfo, setBookInfo] = React.useState(null);

  React.useEffect(() => {
    loadBooks().then(books => {
      const found = item.isbn
        ? books.find(b => b.isbn === item.isbn)
        : books.find(b => b.title === item.book);
      setBookInfo(found || null);
    });
  }, [item.isbn, item.book]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '2px solid #E5E5E5', background: '#fff', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <BackIcon s={22} style={{ color: '#AFAFAF' }}/>
        </button>
        <span style={{ flex: 1, fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>모이</span>
        <button onClick={onBookmark} style={{
          background: isBookmarked ? '#F0FDF4' : '#F7F7F7',
          border: `1.5px solid ${isBookmarked ? '#D7F0BF' : '#E5E5E5'}`,
          borderRadius: 20, padding: '6px 12px', cursor: 'pointer',
          fontWeight: 800, fontSize: 12, fontFamily: 'inherit',
          color: isBookmarked ? '#58CC02' : '#AFAFAF',
        }}>
          🔖 {isBookmarked ? '저장됨' : '저장'}
        </button>
      </div>

      <div className="rg-scroll" style={{ padding: '20px 16px' }}>
        {/* 유저 정보 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F0FDF4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparrow size={34}/>
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: 0 }}>{item.name}</p>
            <p style={{ fontSize: 12, color: '#AFAFAF', margin: 0 }}>@{item.handle} · {item.time}</p>
          </div>
        </div>

        {/* 모이 텍스트 */}
        <div style={{ background: '#F0FDF4', borderLeft: '4px solid #3FD17F',
          borderRadius: '0 16px 16px 0', padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1F1F1F', lineHeight: 1.7,
            margin: 0, fontStyle: 'italic' }}>{item.sentence}</p>
        </div>

        {/* 책 상세 정보 + 관심 책 추가 */}
        <div className="rg-card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <BookCover book={bookInfo || { cover_url: '', title: item.book }} size={80} radius={12}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 900, fontSize: 15, color: '#1F1F1F', margin: '0 0 4px',
                lineHeight: 1.3 }}>{item.book}</p>
              {bookInfo ? (
                <>
                  <p style={{ fontSize: 13, color: '#5A5F69', fontWeight: 700, margin: '0 0 2px' }}>
                    {bookInfo.author}
                  </p>
                  <p style={{ fontSize: 12, color: '#AFAFAF', margin: '0 0 2px' }}>
                    {bookInfo.publisher}
                  </p>
                  <p style={{ fontSize: 12, color: '#AFAFAF', margin: 0 }}>
                    총 {bookInfo.total_pages}p
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 12, color: '#AFAFAF', margin: 0 }}>로딩 중...</p>
              )}
              {item.page && (
                <p style={{ fontSize: 12, color: '#3FD17F', fontWeight: 800, margin: '6px 0 0' }}>
                  인용 p.{item.page}
                </p>
              )}
            </div>
          </div>
          <button onClick={onAddWish} disabled={isWished} style={{
            width: '100%', padding: '10px 0', borderRadius: 12, cursor: isWished ? 'default' : 'pointer',
            fontWeight: 800, fontSize: 13, fontFamily: 'inherit',
            background: isWished ? '#F0FDF4' : '#3FD17F',
            color: isWished ? '#58CC02' : '#fff',
            border: isWished ? '1.5px solid #D7F0BF' : 'none',
          }}>
            {isWished ? '관심 책에 담음 ✓' : '+ 관심 책에 추가'}
          </button>
        </div>

        {/* 짹 */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => item.handle !== 'me' && onJaek()}
            disabled={item.handle === 'me'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 28px', borderRadius: 20,
              cursor: item.handle === 'me' ? 'default' : 'pointer',
              fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
              background: isJaekd ? '#FFF3E0' : '#F7F7F7',
              color: isJaekd ? '#FF9600' : '#AFAFAF',
              border: `1.5px solid ${isJaekd ? '#FFC800' : '#E5E5E5'}`,
              opacity: item.handle === 'me' ? 0.4 : 1,
            }}>
            🐦 짹 {item.jaeks}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── SocialView ─────────────────────────────────────────────────────────────────
const SocialView = ({ state, onStateChange }) => {
  const feed      = state.feed      || [];
  const jaekFeed  = state.jaekFeed  || {};
  const bookmarks = state.bookmarks || [];
  const wishBooks = state.wishBooks || [];
  const friends   = state.friends   || [];

  const [selectedId, setSelectedId] = React.useState(null);
  const [searchQ,    setSearchQ]    = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);

  const bookmarkedIds = new Set(bookmarks.map(b => b.id));
  const wishedTitles  = new Set(wishBooks.map(w => w.bookTitle));
  const followedIds   = new Set(friends.map(f => f.id));

  const searchResults = searchQ.trim()
    ? NPC_SEARCH_USERS.filter(u =>
        u.handle.includes(searchQ.toLowerCase()) || u.name.includes(searchQ))
    : NPC_SEARCH_USERS;

  const doFollow = user => {
    if (followedIds.has(user.id)) return;
    onStateChange(prev => ({
      ...prev,
      friends: [...prev.friends, { ...user, sentence: user.sentence || '' }],
    }));
    window._showToast && window._showToast(`🐦 @${user.handle} 팔로우!`);
  };

  const doJaek = id => {
    const already = jaekFeed[id];
    onStateChange(prev => ({
      ...prev,
      jaekFeed: { ...prev.jaekFeed, [id]: !already },
      feed: prev.feed.map(item =>
        item.id === id ? { ...item, jaeks: item.jaeks + (already ? -1 : 1) } : item),
    }));
  };

  const doBookmark = feedItem => {
    const already = bookmarkedIds.has(feedItem.id);
    onStateChange(prev => ({
      ...prev,
      bookmarks: already
        ? prev.bookmarks.filter(b => b.id !== feedItem.id)
        : [...prev.bookmarks, { ...feedItem, bookmarkedAt: Date.now() }],
    }));
    if (!already) window._showToast && window._showToast('모이를 책갈피했어요 🔖');
  };

  const doWishBook = feedItem => {
    if (wishedTitles.has(feedItem.book)) return;
    onStateChange(prev => ({
      ...prev,
      wishBooks: [...prev.wishBooks, {
        bookTitle: feedItem.book,
        isbn: feedItem.isbn || '',
        addedAt: Date.now(),
      }],
    }));
    window._showToast && window._showToast('관심 책에 담았어요 📚');
  };

  // 모이 상세 페이지
  if (selectedId) {
    const item = feed.find(f => f.id === selectedId);
    if (item) return (
      <MoiDetail
        item={item}
        isJaekd={jaekFeed[item.id]}
        isBookmarked={bookmarkedIds.has(item.id)}
        isWished={wishedTitles.has(item.book)}
        onBack={() => setSelectedId(null)}
        onJaek={() => doJaek(item.id)}
        onBookmark={() => doBookmark(item)}
        onAddWish={() => doWishBook(item)}
      />
    );
  }

  return (
    <div className="rg-screen">
      {/* 헤더 */}
      <div className="rg-tab-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>👥</span>
            <span style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>소셜</span>
          </div>
          <button onClick={() => setSearchOpen(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: searchOpen ? '#F1FBF5' : '#F7F7F7',
            border: `1.5px solid ${searchOpen ? '#3FD17F' : '#E5E5E5'}`,
            borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
            fontWeight: 800, fontSize: 12, color: searchOpen ? '#1F8E4D' : '#5A5F69',
          }}>
            <SearchIcon s={14}/> 친구 찾기
          </button>
        </div>
      </div>

      <div className="rg-scroll" style={{ padding: '16px 16px 0' }}>
        {/* 친구 찾기 패널 */}
        {searchOpen && (
          <div className="rg-card" style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 10px' }}>🔍 친구 찾기</p>
            <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="@닉네임으로 검색" className="rg-input"
              style={{ marginBottom: 10, fontSize: 13, padding: '10px 14px' }}
              onFocus={e => e.target.style.borderColor = '#3FD17F'}
              onBlur={e => e.target.style.borderColor  = '#E5E5E5'}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searchResults.map(user => (
                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid #F7F7F7' }}>
                  <NestIcon stage={user.stage} size={36} isLit={user.isLit}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', margin: 0 }}>
                      {user.name} <span style={{ fontSize: 10, color: '#AFAFAF', fontWeight: 600 }}>· NPC</span>
                    </p>
                    <p style={{ fontSize: 11, color: '#AFAFAF', margin: 0 }}>@{user.handle}</p>
                  </div>
                  <button onClick={() => doFollow(user)} disabled={followedIds.has(user.id)} style={{
                    padding: '6px 14px', borderRadius: 14, border: 'none',
                    cursor: followedIds.has(user.id) ? 'default' : 'pointer',
                    fontWeight: 800, fontSize: 12, fontFamily: 'inherit',
                    background: followedIds.has(user.id) ? '#E5E5E5' : '#3FD17F',
                    color:      followedIds.has(user.id) ? '#AFAFAF' : '#fff',
                  }}>
                    {followedIds.has(user.id) ? '팔로잉 ✓' : '팔로우'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 이번 주 신규 독서 시작러 Top3 */}
        <div className="rg-card" style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 12px' }}>
            📚 이번 주 새로 시작한 책
          </p>
          {SEED_TOP3.map(item => (
            <div key={item.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 15, color: '#AFAFAF', width: 20, textAlign: 'center' }}>
                {item.rank}
              </span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#1F1F1F' }}>{item.title}</span>
              <span style={{ fontSize: 12, color: '#3FD17F', fontWeight: 800 }}>{item.count}명 시작</span>
            </div>
          ))}
        </div>

        {/* 모이 피드 */}
        {feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#AFAFAF' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🐦</div>
            <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
              아직 모이가 없어요. 오늘의 모이를 남겨보세요 🐦
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
            {feed.map(item => (
              <div key={item.id} className="rg-card" style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => setSelectedId(item.id)}>

                {/* 책갈피 버튼 (우측 상단, 카드 클릭과 분리) */}
                <button
                  onClick={e => { e.stopPropagation(); doBookmark(item); }}
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 18, opacity: bookmarkedIds.has(item.id) ? 1 : 0.25,
                    padding: 4, lineHeight: 1,
                  }}>🔖</button>

                {/* 유저 정보 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingRight: 36 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0FDF4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparrow size={28}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 13, color: '#1F1F1F', margin: 0 }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: '#AFAFAF', margin: 0 }}>
                      {item.book}{item.page ? ` · p.${item.page}` : ''} · {item.time}
                    </p>
                  </div>
                </div>

                {/* 모이 텍스트 */}
                <p style={{ fontSize: 13, color: '#4a4a4a', fontStyle: 'italic', lineHeight: 1.6,
                  margin: '0 0 10px', borderLeft: '3px solid #3FD17F', paddingLeft: 10 }}>
                  {item.sentence}
                </p>

                {/* 짹 (카드 클릭과 분리) */}
                <div onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => item.handle !== 'me' && doJaek(item.id)}
                    disabled={item.handle === 'me'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', borderRadius: 16,
                      cursor: item.handle === 'me' ? 'default' : 'pointer',
                      fontWeight: 800, fontSize: 11, fontFamily: 'inherit',
                      background: jaekFeed[item.id] ? '#FFF3E0' : '#F7F7F7',
                      color:      jaekFeed[item.id] ? '#FF9600' : '#AFAFAF',
                      border:    `1.5px solid ${jaekFeed[item.id] ? '#FFC800' : '#E5E5E5'}`,
                      opacity: item.handle === 'me' ? 0.4 : 1,
                    }}>
                    🐦 짹 {item.jaeks}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

window.SocialView = SocialView;
