/* =========================================================
   ReadingGo — user-profile-modal.js  (#761 모듈화 2차: components.js에서 추출)
   UserProfileModal: 타인 프로필 보기(#510 등). app.js가 <UserProfileModal> 소비.
   components.js **이후** 로드(공유 컨텍스트·유틸은 window 전역). 순수 이동 — 훅만 재선언.
   ========================================================= */

const { useState, useEffect } = React;

function UserProfileModal({ handle, onClose }) {
  const [data, setData] = useState(undefined); // undefined=로딩, null=없음
  const [revealed, setRevealed] = useState({});
  const [following, setFollowing] = useState(null);
  const [shelfOpen, setShelfOpen] = useState(false);   // 더 보기 → 전체 책장
  const [shelfFilter, setShelfFilter] = useState('completed'); // completed|reading
  const [bookView, setBookView] = useState(null);      // {bookId, title, cover} 드릴다운
  const [contrib, setContrib] = useState(undefined);   // bookContrib 결과
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const DS = window.SupabaseDataStore;
        if (!DS || !DS.users || !DS.users.getByHandle) { if (alive) setData(null); return; }
        const u = await DS.users.getByHandle(handle);
        if (!u) { if (alive) setData(null); return; }
        const [shelf, sents, wishlist] = await Promise.all([
          DS.users.publicShelf ? DS.users.publicShelf(u.id).catch(() => []) : DS.users.publicBooks(u.id).catch(() => []),
          DS.users.publicSentences(u.id).catch(() => []),
          DS.users.publicWishlist ? DS.users.publicWishlist(u.id).catch(() => []) : Promise.resolve([]),
        ]);
        const all = shelf || [];
        const completed = all.filter((b) => b.status === 'completed');
        const reading = all.filter((b) => b.status === 'reading');
        if (alive) setData({ user: u, completed, reading, sents: sents || [], wishlist: wishlist || [] }); // 스트릭 미표시 (#557)
        const myId = window.RG_ME && window.RG_ME.id;
        if (myId && u.id !== myId && DS.friends && DS.friends.isFollowing) {
          const f = await DS.friends.isFollowing(u.id).catch(() => false);
          if (alive) setFollowing(!!f);
        }
      } catch (e) { if (alive) setData(null); }
    })();
    return () => { alive = false; };
  }, [handle]);
  // 책 드릴다운 — 그 사람의 그 책 평점·후기·한 문장 (#5)
  useEffect(() => {
    if (!bookView || !data) return;
    let alive = true;
    setContrib(undefined);
    const DS = window.SupabaseDataStore;
    if (!DS || !DS.users || !DS.users.bookContrib) { setContrib(null); return; }
    Promise.resolve(DS.users.bookContrib(data.user.id, bookView.bookId))
      .then((r) => { if (alive) setContrib(r); }).catch(() => { if (alive) setContrib(null); });
    return () => { alive = false; };
  }, [bookView]);
  const toggleFollow = () => {
    const DS = window.SupabaseDataStore;
    if (!data || !data.user || !(DS && DS.friends)) return;
    const target = data.user.id;
    const p = following ? DS.friends.unfollow(target) : DS.friends.follow(target);
    Promise.resolve(p).then(() => setFollowing(!following)).catch(() => {});
  };
  const pageStyle = { position: 'fixed', inset: 0, background: 'var(--bg, #fff)', zIndex: 1000, overflowY: 'auto', WebkitOverflowScrolling: 'touch' };
  const headStyle = { position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--bg, #fff)', borderBottom: '1px solid var(--line)' };
  const BookCard = ({ ub }) => (
    <div onClick={() => setBookView({ bookId: ub.book_id, title: ub.book && ub.book.title, cover: ub.book && ub.book.cover_url })}
      style={{ width: 84, cursor: 'pointer' }}>
      <div style={{ width: 84, height: 118, borderRadius: 12, overflow: 'hidden', background: 'var(--line)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ub.book && ub.book.cover_url
          ? <img src={ub.book.cover_url} alt={ub.book.title} loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ display: 'inline-flex', color: 'var(--ink-3)' }}>{window.rgIcon('book', 30)}</span>}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ub.book && ub.book.title}</div>
      {typeof ub.rating === 'number' && <div style={{ fontSize: 10, color: 'var(--brand-3)', fontWeight: 800 }}>★ {ub.rating}</div>}
    </div>
  );

  // 책 드릴다운 화면 (#5)
  if (bookView) {
    return (
      <div style={pageStyle} role="dialog" aria-label={bookView.title}>
        <div style={headStyle}>
          <button onClick={() => { setBookView(null); setContrib(undefined); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink)' }}>←</button>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookView.title}</div>
        </div>
        <div style={{ padding: '16px 20px 40px' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 12 }}>@{data && data.user.handle}님의 기록</div>
          {contrib === undefined ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 30 }}>불러오는 중…</div>
          ) : (
            <>
              {contrib && contrib.userBook && (typeof contrib.userBook.rating === 'number' || contrib.userBook.review_text) && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  {typeof contrib.userBook.rating === 'number' && <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--brand-3)', marginBottom: 4 }}>★ {contrib.userBook.rating} / 5</div>}
                  {contrib.userBook.review_text && <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{contrib.userBook.review_text}</div>}
                </div>
              )}
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>{window.rgIcon('book', 15)} 한 문장 {(contrib && contrib.sentences || []).length}개</div>
              {(!contrib || contrib.sentences.length === 0) ? (
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>공개된 한 문장이 없어요</div>
              ) : contrib.sentences.map((s) => {
                const blinded = !revealed[s.id] && isSentenceBlinded(bookView.bookId, s.page);
                return (
                  <div key={s.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4 }}>{s.page}p</div>
                    {blinded
                      ? <div className="spoiler-blind" onClick={() => setRevealed((r) => ({ ...r, [s.id]: true }))}>내가 아직 안 읽은 부분 · 탭하면 보기</div>
                      : <div style={{ fontFamily: 'var(--font-quote)', fontSize: 14, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>"{s.text}"</div>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle} role="dialog" aria-label={handle}>
      <div style={headStyle}>
        <button onClick={onClose} aria-label="뒤로" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink)' }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)' }}>{data && data.user ? ('@' + data.user.handle) : '프로필'}</div>
      </div>
      {data === undefined ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
      ) : data === null ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>프로필을 찾을 수 없어요</div>
      ) : (
        <div style={{ padding: '12px 20px 40px' }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><window.SparrowMark size={26} /> {data.user.display_name || data.user.handle}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--ink-2)', fontWeight: 800 }}>
              <span>완독 {data.completed.length}</span>
              <span>읽는 중 {data.reading.length}</span>
              <span>{data.user.xp || 0} XP</span>
            </div>
            {following !== null && (
              <button onClick={toggleFollow}
                style={{ marginTop: 12, padding: '8px 22px', borderRadius: 999, border: 'none', background: following ? 'var(--brand-soft)' : 'var(--brand)', color: following ? 'var(--brand-3)' : '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                {following ? '팔로잉 ✓' : '+ 팔로우'}
              </button>
            )}
            {data.user.bio && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 8 }}>{data.user.bio}</div>}
          </div>

          {/* 책장 — 기본 6권(완독 우선) + 더보기 → 필터 전체 (#4) */}
          {(() => {
            const top = data.completed.concat(data.reading).slice(0, 6);
            const filtered = shelfFilter === 'reading' ? data.reading : data.completed;
            const totalShelf = data.completed.length + data.reading.length;
            return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>{window.rgIcon('book', 16)} 책장</div>
                  {totalShelf > 6 && <button onClick={() => setShelfOpen((v) => !v)} style={{ background: 'none', border: 'none', color: 'var(--brand-3)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{shelfOpen ? '접기' : '더 보기 ›'}</button>}
                </div>
                {!shelfOpen ? (
                  top.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>아직 책이 없어요</div>
                    : <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>{top.map((ub) => <div key={ub.id} style={{ flex: '0 0 auto' }}><BookCard ub={ub} /></div>)}</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {[['completed', `완독 ${data.completed.length}`], ['reading', `읽는 중 ${data.reading.length}`]].map(([id, label]) => (
                        <button key={id} onClick={() => setShelfFilter(id)} style={{ padding: '6px 14px', borderRadius: 16, border: 'none', background: shelfFilter === id ? 'var(--brand)' : 'var(--brand-soft)', color: shelfFilter === id ? '#fff' : 'var(--brand-3)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
                      ))}
                    </div>
                    {filtered.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>없어요</div>
                      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 14 }}>{filtered.map((ub) => <BookCard key={ub.id} ub={ub} />)}</div>}
                    {(!data.wishlist || data.wishlist.length === 0) && (
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>※ '읽고 싶은 책'은 이 분이 비공개로 설정했어요</div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* 위시리스트 — wishlist_public=true 인 경우만 노출 (#558) */}
          {data.wishlist && data.wishlist.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>{window.rgIcon('bookmark', 15)} 읽고 싶어하는 책 {data.wishlist.length}</div>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
                {data.wishlist.map((wb) => {
                  const bk = wb.book || {};
                  return (
                    <div key={wb.id || wb.book_id} style={{ flex: '0 0 auto' }}
                      onClick={() => bk.id && setBookView({ bookId: bk.id, title: bk.title, cover: bk.cover_url })}>
                      <div style={{ width: 84, cursor: bk.id ? 'pointer' : 'default' }}>
                        <div style={{ width: 84, height: 118, borderRadius: 12, overflow: 'hidden', background: 'var(--line)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {bk.cover_url
                            ? <img src={bk.cover_url} alt={bk.title} loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ display: 'inline-flex', color: 'var(--ink-3)' }}>{window.rgIcon('heart', 30)}</span>}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{bk.title}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 공개 한 문장 */}
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>{window.rgIcon('pen', 15)} 공개 한 문장 {data.sents.length}</div>
          {data.sents.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '8px 0' }}>아직 공개된 한 문장이 없어요</div>
          ) : data.sents.map((s) => {
            const bt = s.user_book && s.user_book.book && s.user_book.book.title;
            const bid = s.user_book && s.user_book.book_id;
            const blinded = !revealed[s.id] && isSentenceBlinded(bid, s.page);
            return (
              <div key={s.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4 }}>{bt ? bt + ' · ' : ''}{s.page}p</div>
                {blinded ? (
                  <div className="spoiler-blind" onClick={() => setRevealed((r) => ({ ...r, [s.id]: true }))}>내가 아직 안 읽은 부분 · 탭하면 보기</div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-quote)', fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>"{s.text}"</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
window.UserProfileModal = UserProfileModal;
