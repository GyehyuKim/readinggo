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
  const [tab, setTab] = useState('all');     // 'all' | 'following' (#7)
  const [items, setItems] = useState(null);  // null=로딩, []=빈
  const hasFollow = !!(DataStore.sentences && DataStore.sentences.feedFollowing);

  useEffect(() => {
    let alive = true;
    setItems(null);
    // 전체 공개 피드 또는 팔로우 피드 — 양 어댑터 정규화.
    const src = (tab === 'following' && hasFollow)
      ? DataStore.sentences.feedFollowing({ limit: 50 })
      : DataStore.sentences.feed({ limit: 50 });
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
        {[['all', '전체'], ['following', '팔로우']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '6px 14px', borderRadius: 16, border: tab === id ? 'none' : '1px solid var(--line)', background: tab === id ? 'var(--brand)' : 'transparent', color: tab === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      {items === null ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', lineHeight: 1.7 }}>
          {tab === 'following'
            ? (<>🐦 팔로우한 사람의 한 문장이 아직 없어요.<br />다른 독자 프로필에서 팔로우해보세요!</>)
            : (<>🐦 아직 공개된 한 문장이 없어요.<br />둥지에서 첫 문장을 남겨보세요!</>)}
        </div>
      ) : (
        <div>{items.map((it, i) => (<SentenceCard key={it.id || i} item={it} bookId={it.bookId} />))}</div>
      )}
    </section>
  );
}

window.SocialView = SocialView;
