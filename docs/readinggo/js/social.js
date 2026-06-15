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
  const [findOpen, setFindOpen] = useState(false); // 친구 찾기 패널 (#250)
  const [fq, setFq] = useState('');
  const [fres, setFres] = useState([]);
  const [followed, setFollowed] = useState({});    // userId -> true
  const [top3, setTop3] = useState([]);            // 이번 주 신규 시작러 Top3 (§5.7)

  // 이번 주 새로 시작한 책 Top3 — 공개 집계 RPC (§5.7). 마운트 1회 로드.
  useEffect(() => {
    let alive = true;
    if (!(DataStore.books && DataStore.books.startedThisWeek)) return;
    Promise.resolve(DataStore.books.startedThisWeek(3))
      .then(rows => { if (alive) setTop3(rows || []); })
      .catch(() => { if (alive) setTop3([]); });
    return () => { alive = false; };
  }, []);

  // 친구 찾기: @닉 검색(users.search) → 팔로우 (#250)
  useEffect(() => {
    if (!findOpen) return;
    const q = fq.trim();
    if (!q || !(DataStore.users && DataStore.users.search)) { setFres([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      Promise.resolve(DataStore.users.search(q)).then(rows => {
        if (!alive) return;
        const myId = window.RG_ME && window.RG_ME.id;
        setFres((rows || []).filter(u => u.id !== myId));
      }).catch(() => { if (alive) setFres([]); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [fq, findOpen]);
  const doFollow = (u) => {
    if (!(DataStore.friends && DataStore.friends.follow)) return;
    setFollowed(m => ({ ...m, [u.id]: true }));
    Promise.resolve(DataStore.friends.follow(u.id)).then(() => showToast('팔로우했어요 🐦')).catch(() => {});
  };

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
          bookId: bk.id || s.book_id || '',   // 로컬 문장은 user_book embed 없음 → s.book_id 폴백(사피엔스 오표시 방지)
          bookCover: bk.cover_url || '',
          bookAuthor: bk.author || '',
          isMine: !!(myId && s.user_id === myId),
        };
      }));
    }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [tab]);

  return (
    <section className="view active">
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>📚 한 문장 피드</h3>
        <button onClick={() => setFindOpen(v => !v)} title="유저 찾기" aria-label="유저 찾기" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--brand-tint)', border: '1px solid var(--brand-soft)', color: 'var(--brand-3)', borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: '5px 12px' }}><span style={{ fontSize: 15 }}>👥</span> 유저 찾기</button>
      </div>
      {findOpen && (
        <div style={{ padding: '0 16px 12px' }}>
          <input value={fq} onChange={e => setFq(e.target.value)} placeholder="@닉네임으로 친구 찾기" autoFocus
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          {fres.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--line-2)' }}>
              <span style={{ fontSize: 20 }}>{(u.display_name && u.display_name[0]) || '🐦'}</span>
              <button onClick={() => window.RG_openProfile && window.RG_openProfile(u.handle)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', fontSize: 14, fontWeight: 700, color: 'var(--brand-3)', cursor: 'pointer' }}>@{u.handle}</button>
              <button onClick={() => doFollow(u)} disabled={!!followed[u.id]}
                style={{ padding: '5px 12px', borderRadius: 14, border: 'none', background: followed[u.id] ? 'var(--line-2)' : 'var(--brand)', color: followed[u.id] ? 'var(--ink-3)' : '#fff', fontSize: 12, fontWeight: 800, cursor: followed[u.id] ? 'default' : 'pointer' }}>
                {followed[u.id] ? '팔로잉 ✓' : '팔로우'}
              </button>
            </div>
          ))}
          {fq.trim() && fres.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>검색 결과 없음</div>}
        </div>
      )}
      {/* 이번 주 신규 시작러 Top3 (§5.7) — 비어있으면 미표시 */}
      {top3.length > 0 && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 8 }}>📚 이번 주 새로 시작한 책</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
              {top3.map((b, i) => (
                <button key={b.bookId || i} onClick={() => { if (b.bookId && window.RG_openBook) window.RG_openBook(b.bookId); }}
                  style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: (b.bookId && window.RG_openBook) ? 'pointer' : 'default', padding: 0, maxWidth: 200 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--brand-3)', minWidth: 18 }}>{i + 1}위</span>
                  {b.cover_url
                    ? <img src={b.cover_url} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flex: '0 0 auto' }} />
                    : null}
                  <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>{b.starters}명 시작</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* 전체 / 팔로우 탭 (#7) */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px' }}>
        {[['following', '팔로우'], ['recent', '최근'], ['recommend', '추천']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '6px 14px', borderRadius: 16, border: tab === id ? 'none' : '1px solid var(--line)', background: tab === id ? 'var(--brand)' : 'transparent', color: tab === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      {/* 카드 리뷰(#186) 보류 — '🃏 카드로 넘겨보기' CTA·TinderCards 진입 연결 제거 (#540, decisions §8.10).
          우=좋아요(짹+책갈피 동시)가 짹(공개 반응)·책갈피(비공개 저장) 의미를 섞어 현재 범위 제외.
          TinderCards 컴포넌트(components.js)는 보존 — 재도입 시 두 행동 분리 전제. */}
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
