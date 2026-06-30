/* =========================================================
   ReadingGo — social.js
   '함께' 탭 (내부 키 social — 코드 호환 유지, co-reading.md §2.1):
     ① 발견 = 인기 책 + 전체 공개 한 문장 피드 + 유저 찾기 (§5.7 / feed.md)  ← 입구
     ② 숲   = 같이읽기 룸 (RoomsView, co-reading.js)                        ← 목적지
   상단 세그먼트로 두 레이어 전환. 기본 = 발견(신규/게스트는 입구가 먼저).
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

// '함께' 탭 셸 — ① 발견 / ② 숲 세그먼트 (co-reading.md §4.1). 기본=발견.
function SocialView({ state }) {
  const { useState } = React;
  const [layer, setLayer] = useState('discover'); // 'discover' | 'rooms'
  return (
    <section className="view active">
      <div className="rg-together-seg" style={{ display: 'flex', gap: 6, padding: '12px 16px 10px' }}>
        {[['discover', '발견'], ['rooms', '숲']].map(([id, label]) => (
          <button key={id} onClick={() => setLayer(id)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 999, border: layer === id ? 'none' : '1px solid var(--line)',
              background: layer === id ? 'var(--ink)' : 'transparent', color: layer === id ? '#fff' : 'var(--ink-2)',
              fontSize: 13.5, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.2px' }}>
            {label}
          </button>
        ))}
      </div>
      {layer === 'rooms'
        ? (window.RoomsView ? <window.RoomsView /> : null)
        : <DiscoverLayer state={state} />}
    </section>
  );
}

// ① 발견 레이어 = 기존 피드 화면 그대로 (인기 책·한 문장 피드·유저 찾기, feed.md §5.7 보존).
function DiscoverLayer({ state }) {
  const { useState, useEffect } = React;
  const [tab, setTab] = useState('recommend');  // 'following' | 'recommend' (#789: '최근' 탭 제거, 추천 메인화)
  const [items, setItems] = useState(null);  // null=로딩, []=빈
  const [findOpen, setFindOpen] = useState(false); // 친구 찾기 패널 (#250)
  const [fq, setFq] = useState('');
  const [fres, setFres] = useState([]);
  const [followed, setFollowed] = useState({});    // userId -> true
  const [top3, setTop3] = useState([]);            // 지금 인기 있는 책 Top5 (§5.7, #525, #578)
  const [myStatus, setMyStatus] = useState({});    // bookId -> 'wish'|'reading'|'completed' — 랭킹 현재상태 강조 (#525)

  // 지금 인기 있는 책 Top5 — 공개 집계 RPC (§5.7). 마운트 1회 로드.
  useEffect(() => {
    let alive = true;
    if (!(DataStore.books && DataStore.books.startedThisWeek)) return;
    Promise.resolve(DataStore.books.startedThisWeek(5))
      .then(rows => { if (alive) setTop3(rows || []); })
      .catch(() => { if (alive) setTop3([]); });
    return () => { alive = false; };
  }, []);

  // 내 책장 상태 맵 (#525) — 랭킹 책이 이미 내 책장에 있으면 상태 강조.
  useEffect(() => {
    let alive = true;
    Promise.all([
      Promise.resolve((DataStore.myBooks && DataStore.myBooks.list) ? DataStore.myBooks.list() : []).catch(() => []),
      Promise.resolve((DataStore.wishBooks && DataStore.wishBooks.list) ? DataStore.wishBooks.list() : []).catch(() => []),
    ]).then(([mine, wishes]) => {
      if (!alive) return;
      const m = {};
      (mine || []).forEach(ub => { if (ub.book_id) m[ub.book_id] = ub.status; });
      (wishes || []).forEach(w => { const id = (w && w.book && w.book.id) || (w && w.book_id); if (id && !m[id]) m[id] = 'wish'; });
      setMyStatus(m);
    }).catch(() => {});
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
    Promise.resolve(DataStore.friends.follow(u.id)).then(() => showToast('팔로우했어요', { sparrow: true })).catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    setItems(null);
    // 팔로우 / 추천(같은 책) — 양 어댑터 정규화. feed()는 메서드 부재 시 충전 폴백(#789 — '최근' 탭 제거됐으나 함수는 유지).
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
          // NPC 더미(#854)는 이모지 아바타·박수수·상대시간 문자열을 row 에 직접 싣는다 → 우선 사용, 실데이터는 폴백.
          avatar: s.avatar || (u.display_name && u.display_name[0]) || <window.SparrowMark size={18} />,
          claps: s.claps || 0,
          time: s.time || rgRelTime(s.created_at),
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

  const IcoFlame = () => (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 1C6.5 1 9.5 4 9.5 7a3 3 0 0 1-6 0c0-1.2.6-2.2 1.2-3C5.2 3.4 5.5 2.2 6.5 1Z" fill="var(--fire)" opacity=".9"/>
      <path d="M6.5 6c0 0 1.5 1.2 1.5 2.5a1.5 1.5 0 0 1-3 0C5 7.2 6.5 6 6.5 6Z" fill="var(--gold)"/>
    </svg>
  );
  const IcoUsers = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1 11c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="10.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M12.5 10.5c0-1.5-1-2.5-2-2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
  const IcoBook = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="var(--ink-3)" strokeWidth="1.3"/>
      <path d="M11 2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-1" stroke="var(--ink-3)" strokeWidth="1.3"/>
      <path d="M5 5.5h5M5 8h3" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );

  return (
    <React.Fragment>
      {/* ① 지금 인기 있는 책 Top5 (§5.7, #525, #578) — 상단 배치. 탭 → 책 상세(BookInfoModal). 비어있으면 미표시 */}
      {top3.length > 0 && (
        <div style={{ padding: '0 16px 4px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 8 }}>
              <IcoFlame />지금 인기 있는 책
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {top3.slice(0, 5).map((b, i) => {
                const st = b.bookId && myStatus[b.bookId];
                // starters 카운트: 2명 이상일 때만 'N명 시작' 표시 (#578)
                const starterLabel = st
                  ? (st === 'wish' ? '찜' : st === 'completed' ? '완독' : '읽는 중')
                  : (b.starters >= 2 ? `${b.starters}명 시작` : '');
                return (
                  <button key={b.bookId || i}
                    onClick={() => { if (b.bookId && window.RG_openBook) window.RG_openBook(b.bookId); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--line-2, #f2ede2)', cursor: 'pointer', padding: '9px 2px', textAlign: 'left', width: '100%' }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: i < 3 ? 'var(--brand-3)' : 'var(--ink-3)', minWidth: 18, textAlign: 'center' }}>{i + 1}</span>
                    {b.cover_url
                      ? <img src={b.cover_url} alt="" style={{ width: 30, height: 43, objectFit: 'cover', borderRadius: 4, flex: '0 0 auto' }} />
                      : <span style={{ width: 30, height: 43, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--line)', borderRadius: 4, flex: '0 0 auto' }}><IcoBook /></span>}
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</span>
                      {b.author ? <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.author}</span> : null}
                    </span>
                    {starterLabel ? (
                      <span style={{ fontSize: 11, color: st ? 'var(--brand-3)' : 'var(--ink-3)', fontWeight: 800, flex: '0 0 auto', whiteSpace: 'nowrap',
                        background: st ? 'var(--brand-tint)' : 'var(--paper-2)', borderRadius: 999, padding: '2px 7px' }}>
                        {starterLabel}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* ② 한 문장 피드 헤더 + 유저 찾기 — 랭킹 아래 (#578) */}
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>한 문장 피드</h3>
        <button onClick={() => setFindOpen(v => !v)} title="유저 찾기" aria-label="유저 찾기"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--brand-tint)', border: '1px solid var(--brand-soft)', color: 'var(--brand-3)', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: '5px 11px' }}>
          <IcoUsers />유저 찾기
        </button>
      </div>
      {findOpen && (
        <div style={{ padding: '0 16px 12px' }}>
          <input value={fq} onChange={e => setFq(e.target.value)} placeholder="@닉네임으로 친구 찾기" autoFocus
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          {fres.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--line-2)' }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{(u.display_name && u.display_name[0]) || <window.SparrowMark size={18} />}</span>
              <button onClick={() => window.RG_openProfile && window.RG_openProfile(u.handle)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', fontSize: 14, fontWeight: 700, color: 'var(--brand-3)', cursor: 'pointer' }}>@{u.handle}</button>
              <button onClick={() => doFollow(u)} disabled={!!followed[u.id]}
                style={{ padding: '5px 14px', borderRadius: 999, border: 'none', background: followed[u.id] ? 'var(--line-2)' : 'var(--brand)', color: followed[u.id] ? 'var(--ink-3)' : '#fff', fontSize: 12, fontWeight: 800, cursor: followed[u.id] ? 'default' : 'pointer' }}>
                {followed[u.id] ? '팔로잉' : '팔로우'}
              </button>
            </div>
          ))}
          {fq.trim() && fres.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>검색 결과 없음</div>}
        </div>
      )}
      {/* ③ 팔로우/추천 탭 (#789: '최근' 제거, 추천 메인) */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px' }}>
        {[['following', '팔로우'], ['recommend', '추천']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '6px 16px', borderRadius: 999, border: tab === id ? 'none' : '1px solid var(--line)', background: tab === id ? 'var(--ink)' : 'transparent', color: tab === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.2px' }}>
            {label}
          </button>
        ))}
      </div>
      {/* 카드 리뷰(#186)는 제품 범위 제외 확정 — CTA·TinderCards 컴포넌트 모두 삭제 (#540→#641, decisions §8.10/§8.11, #782). */}
      {items === null ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', lineHeight: 1.8, fontSize: 14 }}>
          {tab === 'following'
            ? (<>팔로우한 사람의 한 문장이 아직 없어요.<br />다른 독자 프로필에서 팔로우해보세요!</>)
            : (<>추천할 한 문장이 아직 없어요.<br />책을 등록하면 같은 책 독자의 문장을 추천해드려요.</>)}
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>{items.map((it, i) => (<SentenceCard key={it.id || i} item={it} bookId={it.bookId} />))}</div>
      )}
    </React.Fragment>
  );
}

window.SocialView = SocialView;
