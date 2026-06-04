/* =========================================================
   ReadingGo — social.js
   소셜 탭: 전체 공개 한 문장 피드 (Supabase 실데이터, §5.7)
   ========================================================= */

function rgRelTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const sec = Math.max(0, (now - d) / 1000);
  if (sec < 60) return '방금';
  if (sec < 3600) return Math.floor(sec / 60) + '분 전';
  if (sec < 86400) return Math.floor(sec / 3600) + '시간 전';
  return Math.floor(sec / 86400) + '일 전';
}

function SocialView({ state }) {
  const { useState, useEffect } = React;
  const [tab, setTab] = useState('recent');  // 'following' | 'recent' | 'recommend' (#8)
  const [items, setItems] = useState(null);  // null=로딩, []=빈
  const [cardMode, setCardMode] = useState(false); // 틴더 카드 리뷰 (#186)

  useEffect(() => {
    let alive = true;
    setItems(null);
    // 팔로우 / 최근(전체 공개) / 추천(같은 책) — 양 어댑터 정규화.
    const SS = DataStore.sentences || {};
    const src = (tab === 'following' && SS.feedFollowing) ? SS.feedFollowing({ limit: 50 })
      : (tab === 'recommend' && SS.feedRecommended) ? SS.feedRecommended({ limit: 50 })
      : SS.feed({ limit: 50 });
    Promise.resolve(src).then(rows => {
      if (!alive) return;
      const myId = window.RG_ME && window.RG_ME.id;
      setItems((rows || []).map(s => {
        const u = s.user || {};
        const bk = (s.user_book && s.user_book.book) || {};
        return {
          id: s.id,
          page: s.page,
          q: s.text,
          nick: u.handle ? ('@' + u.handle) : '@익명',
          avatar: (u.display_name && u.display_name[0]) || '🐦',
          claps: 0,
          time: rgRelTime(s.created_at),
          bookTitle: bk.title || '',
          bookId: bk.id || '',
          isMine: !!(myId && s.user_id === myId),
        };
      }));
    }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [tab]);

  return (
    <section className="view active">
      <div className="section-head"><h3>📚 한 문장 피드</h3></div>
      {/* 전체 / 팔로우 탭 (#7) */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px' }}>
        {[['following', '팔로우'], ['recent', '최근'], ['recommend', '추천']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '6px 14px', borderRadius: 16, border: tab === id ? 'none' : '1px solid var(--line)', background: tab === id ? 'var(--brand)' : 'transparent', color: tab === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      {items && items.length > 0 && (
        <div style={{ padding: '0 16px 10px' }}>
          <button onClick={() => setCardMode(true)}
            style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            🃏 카드로 넘겨보기 — 좋아요/넘기기로 한 문장 리뷰
          </button>
        </div>
      )}
      {cardMode && items && ReactDOM.createPortal(
        <TinderCards items={items} title={tab === 'recommend' ? '추천 한 문장' : tab === 'following' ? '팔로우 한 문장' : '최근 한 문장'} onClose={() => setCardMode(false)} />,
        document.body
      )}
      {items === null ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', lineHeight: 1.7 }}>
          {tab === 'following'
            ? (<>🐦 팔로우한 사람의 한 문장이 아직 없어요.<br />다른 독자 프로필에서 팔로우해보세요!</>)
            : tab === 'recommend'
            ? (<>🐦 추천할 한 문장이 아직 없어요.<br />책을 등록하면 같은 책 독자의 문장을 추천해드려요.</>)
            : (<>🐦 아직 공개된 한 문장이 없어요.<br />둥지에서 첫 문장을 남겨보세요!</>)}
        </div>
      ) : (
        <div>{items.map((it, i) => (<SentenceCard key={it.id || i} item={it} bookId={it.bookId} />))}</div>
      )}
    </section>
  );
}

window.SocialView = SocialView;
