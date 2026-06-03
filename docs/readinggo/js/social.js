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
  const [items, setItems] = useState(null); // null=로딩, []=빈

  useEffect(() => {
    let alive = true;
    // 전체 공개 피드 — 양 어댑터 정규화(동기 배열 / 비동기 Promise).
    Promise.resolve(DataStore.sentences.feed({ limit: 50 })).then(rows => {
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
  }, []);

  return (
    <section className="view active">
      <div className="section-head"><h3>📚 친구들의 한 문장</h3></div>
      {items === null ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', lineHeight: 1.7 }}>
          🐦 아직 공개된 한 문장이 없어요.<br />둥지에서 첫 문장을 남겨보세요!
        </div>
      ) : (
        <div>{items.map((it, i) => (<SentenceCard key={it.id || i} item={it} bookId={it.bookId} />))}</div>
      )}
    </section>
  );
}

window.SocialView = SocialView;
