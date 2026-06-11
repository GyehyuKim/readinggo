/* =========================================================
   ReadingGo — components.js
   공용 UI 컴포넌트: Toast, SentenceCard, Confetti
   ========================================================= */
const { useState, useEffect, useRef, useCallback } = React;

// 데모: 반응(짹) XP 일일 상한용 카운터(세션 단위). 운영 빌드는 일자 기준 서버 집계.
let _rgReactToday = 0;

/* ── 스포일러 블라인드 (페이지 기반, social.md §5.7.1 SSOT) ──
   전역 토글 컨텍스트: revealAll=true 면 모든 블라인드 해제. */
const SpoilerContext = React.createContext(false);

// 블라인드 여부: 내가 *읽고 있는* 책의 한 문장 중 내 현재 페이지보다
// 뒤 페이지면 가린다. 판정 데이터는 DataStore.spoiler.myCurrentPage(bookId).
// 내가 안 읽는 책(myPage 0) · 완독 책(current_page=total) · 현재 페이지 이하 → 노출.
function isSentenceBlinded(bookId, page) {
  // Phase 1: 렌더 시점엔 async DataStore 호출 금지(Promise→오작동 + b008 같은 데모 id 로
  // uuid 컬럼 쿼리 시 400 스팸). boot 에서 preload 한 동기 맵(window.RG_MY_PAGES:
  // bookId→내 현재 페이지)을 사용. 실 피드 배선(B) 전까진 맵이 비어 블라인드 비활성
  // (데모 피드엔 스포일러 리스크 없음).
  if (typeof page !== 'number') return false;
  const myPage = (window.RG_MY_PAGES && window.RG_MY_PAGES[bookId]) || 0;
  if (!myPage) return false;          // 안 읽는 책 / 미상 → 전체 공개
  return page > myPage;               // 내 현재 페이지보다 뒤 → 블라인드
}

/* ── Toast (전역 싱글턴) ──────────────────────────────── */
let _toastTimer = null;
let _setToastFn = null;

function showToast(msg) {
  if (_setToastFn) {
    _setToastFn(msg);
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => _setToastFn(''), 2200);
  }
}

function Toast() {
  const [msg, setMsg] = useState('');
  _setToastFn = setMsg;
  return (
    <div className={'toast' + (msg ? ' show' : '')}>{msg}</div>
  );
}

// PostHog 커스텀 이벤트 (analytics.md §3.1). posthog 미로드/차단 시 안전 no-op.
function rgTrack(event, props) {
  try {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(event, props || {});
    }
  } catch (e) { /* analytics 실패는 무시 */ }
}

// 공용 북커버 (#316 A) — 표지 없거나 로드 실패 시 제목·저자 타이포 placeholder.
// 기존 인라인 `<div className="book-cover" style={{background:grad}}><img/></div>` 드롭인 대체.
function BookCover({ title, author, cover, fb, className, style, radius }) {
  const [failed, setFailed] = useState(false);
  const c0 = (fb && fb[0]) || '#9AA7B2', c1 = (fb && fb[1]) || '#C7D0D8';
  const wrap = { background: `linear-gradient(135deg,${c0},${c1})`, position: 'relative', overflow: 'hidden', ...(radius != null ? { borderRadius: radius } : {}), ...(style || {}) };
  if (cover && !failed) {
    return (
      <div className={className || ''} style={wrap}>
        <img src={cover} alt={title || ''} loading="lazy" referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  return (
    <div className={className || ''} style={wrap}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '11%', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.28)' }}>
        <div style={{ fontWeight: 900, fontSize: 11, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title || '제목 미상'}</div>
        {author && <div style={{ fontWeight: 700, fontSize: 9, opacity: 0.9, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author}</div>}
      </div>
    </div>
  );
}

/* ── Confetti ─────────────────────────────────────────── */
function Confetti({ active, nestUp }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (!active || !boxRef.current) return;
    const box = boxRef.current;
    box.innerHTML = '';
    const colors = ['#3FD17F','#FFC233','#FF8A3D','#5AB5F0','#F08A9A','#B690F0','#2EB867','#FFD66B'];
    const n = nestUp ? 36 : 18;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      el.style.left = (Math.random() * 100) + '%';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      el.style.animationDelay = (Math.random() * 0.25) + 's';
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.style.width = (6 + Math.random() * 8) + 'px';
      el.style.height = (10 + Math.random() * 10) + 'px';
      box.appendChild(el);
    }
    const t = setTimeout(() => { if (box) box.innerHTML = ''; }, 3200);
    return () => clearTimeout(t);
  }, [active]);
  return <div className="confetti" ref={boxRef} />;
}

/* ── SentenceCard ─────────────────────────────────────── */
function SentenceCard({ item, bookId }) {
  // 실 피드(Supabase)면 item.id(UUID)·item.isMine·item.bookTitle 사용, 데모면 합성값 폴백.
  const sentenceId = item.id || `${bookId}:${item.page}:${item.nick}`;
  const isMine = (typeof item.isMine !== 'undefined') ? item.isMine : (item.nick === '@jerome' || item.nick === 'jerome');
  const canReact = !!item.id;  // 실 sentence(UUID)만 짹·책갈피 가능 — 합성 id 는 uuid 컬럼 400 (architect L1)
  const [liked, setLiked] = useState(false);
  const initialLikedRef = React.useRef(false);
  const [bookmarked, setBookmarked] = useState(false);
  // getBook 은 미스 시 RG_BOOKS[0](=사피엔스)로 폴백 → id 실제 일치 시에만 그 제목 사용(사피엔스 오표시 방지, #374 동일).
  const bk = getBook(bookId);
  const cardTitle = item.bookTitle || (bk && bk.id === bookId ? bk.title : '') || '';
  // optimistic likeCount: item.claps(피드 로드 시점) + 현재 상태 - 초기 상태 delta (#156)
  const likeCount = (item.claps || 0) + (liked ? 1 : 0) - (initialLikedRef.current ? 1 : 0);
  React.useEffect(() => {
    if (!canReact || isMine) return;
    Promise.resolve(DataStore.claps.isMine(sentenceId)).then(v => {
      setLiked(v);
      initialLikedRef.current = v;
    }).catch(() => {});
  }, [sentenceId]);
  const toggleLike = () => {
    if (isMine || !canReact) return;
    Promise.resolve(DataStore.claps.toggle(sentenceId)).then((isLiked) => {
      setLiked(isLiked);
      // 반응(engagement) XP — 짹을 *새로 켤 때만*, 일일 상한 적용. 해제 시 차감 없음(v7).
      if (isLiked) {
        const xp = reactionXpFor(_rgReactToday);
        if (xp > 0) { _rgReactToday += 1; grantXp(xp, 'reaction'); }
      }
    }).catch(() => {});
  };
  const toggleBookmark = () => {
    if (isMine || !canReact) return;
    Promise.resolve(DataStore.bookmarks.toggle(sentenceId)).then(setBookmarked).catch(() => {});
  };
  const mineStyle = (isMine || !canReact) ? { opacity: 0.4, pointerEvents: 'none' } : undefined;
  // 스포일러 블라인드: 전역 토글(revealAll) 또는 카드별 탭 공개 시 해제 (§5.7.1).
  const revealAll = React.useContext(SpoilerContext);
  const [revealed, setRevealed] = useState(false);
  const blinded = !revealAll && !revealed && isSentenceBlinded(bookId, item.page);
  return (
    <div className="sentence-card">
      <div className="who">
        <div className="avatar">{item.avatar}</div>
        <div className="nick"
          onClick={() => { if (!isMine && item.nick && window.RG_openProfile) window.RG_openProfile(item.nick); }}
          style={{ cursor: (!isMine && window.RG_openProfile) ? 'pointer' : 'default' }}>{item.nick}</div>
        <div className="meta">
          {cardTitle ? (
            <span onClick={() => { if (item.bookId && window.RG_openBook) window.RG_openBook(item.bookId); }}
              style={{ cursor: (item.bookId && window.RG_openBook) ? 'pointer' : 'default', textDecoration: (item.bookId && window.RG_openBook) ? 'underline' : 'none' }}>{cardTitle}</span>
          ) : null}{cardTitle ? ' · ' : ''}{item.page}p · {item.time}
        </div>
      </div>
      {blinded ? (
        <div className="spoiler-blind" onClick={() => setRevealed(true)}>
          ⚠️ 내가 아직 안 읽은 부분 · 탭하면 보기
        </div>
      ) : (
        <div className="quote">"{item.q}"</div>
      )}
      <div className="react">
        <span className={'chip' + (liked ? ' active' : '')} style={mineStyle} onClick={toggleLike}>
          짹 {likeCount}
        </span>
        <span className={'chip' + (bookmarked ? ' active' : '')} style={mineStyle} onClick={toggleBookmark}>
          🔖
        </span>
      </div>
    </div>
  );
}

/* ── UserProfileModal: 타인 프로필 — 전체 페이지 (§5.8.2, #3/#4/#5) ──
   핸들 탭 → 풀스크린 프로필: 책장(6권+더보기+읽은/읽는중 필터) + 공개 한 문장.
   책 탭 → 그 사람의 그 책 평점·후기·한 문장 드릴다운. */
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
        const [shelf, sents, streak] = await Promise.all([
          DS.users.publicShelf ? DS.users.publicShelf(u.id).catch(() => []) : DS.users.publicBooks(u.id).catch(() => []),
          DS.users.publicSentences(u.id).catch(() => []),
          DS.users.publicStreak ? DS.users.publicStreak(u.id).catch(() => 0) : 0,
        ]);
        const all = shelf || [];
        const completed = all.filter((b) => b.status === 'completed');
        const reading = all.filter((b) => b.status === 'reading');
        if (alive) setData({ user: u, completed, reading, sents: sents || [], streak: streak || 0 });
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
      <div style={{ width: 84, height: 118, borderRadius: 6, overflow: 'hidden', background: 'var(--line)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ub.book && ub.book.cover_url
          ? <img src={ub.book.cover_url} alt={ub.book.title} loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 28 }}>📖</span>}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ub.book && ub.book.title}</div>
      {typeof ub.rating === 'number' && <div style={{ fontSize: 10, color: 'var(--brand-3)', fontWeight: 800 }}>⭐ {ub.rating}</div>}
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
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  {typeof contrib.userBook.rating === 'number' && <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--brand-3)', marginBottom: 4 }}>⭐ {contrib.userBook.rating} / 5</div>}
                  {contrib.userBook.review_text && <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{contrib.userBook.review_text}</div>}
                </div>
              )}
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>📖 한 문장 {(contrib && contrib.sentences || []).length}개</div>
              {(!contrib || contrib.sentences.length === 0) ? (
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>공개된 한 문장이 없어요</div>
              ) : contrib.sentences.map((s) => {
                const blinded = !revealed[s.id] && isSentenceBlinded(bookView.bookId, s.page);
                return (
                  <div key={s.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4 }}>{s.page}p</div>
                    {blinded
                      ? <div className="spoiler-blind" onClick={() => setRevealed((r) => ({ ...r, [s.id]: true }))}>⚠️ 내가 아직 안 읽은 부분 · 탭하면 보기</div>
                      : <div style={{ fontSize: 14, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>"{s.text}"</div>}
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
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)' }}>🐦 {data.user.display_name || data.user.handle}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--ink-2)', fontWeight: 800 }}>
              <span>🏰 완독 {data.completed.length}</span>
              <span>📖 읽는 중 {data.reading.length}</span>
              <span>🔥 {data.streak}일</span>
              <span>✨ {data.user.xp || 0}</span>
            </div>
            {following !== null && (
              <button onClick={toggleFollow}
                style={{ marginTop: 12, padding: '8px 22px', borderRadius: 20, border: following ? '1.5px solid var(--line)' : 'none', background: following ? 'transparent' : 'var(--brand)', color: following ? 'var(--ink-2)' : '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
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
                  <div style={{ fontSize: 15, fontWeight: 900 }}>📚 책장 {totalShelf}</div>
                  {totalShelf > 6 && <button onClick={() => setShelfOpen((v) => !v)} style={{ background: 'none', border: 'none', color: 'var(--brand-3)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{shelfOpen ? '접기' : '더 보기 ›'}</button>}
                </div>
                {!shelfOpen ? (
                  top.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>아직 책이 없어요</div>
                    : <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>{top.map((ub) => <div key={ub.id} style={{ flex: '0 0 auto' }}><BookCard ub={ub} /></div>)}</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {[['completed', `완독 ${data.completed.length}`], ['reading', `읽는 중 ${data.reading.length}`]].map(([id, label]) => (
                        <button key={id} onClick={() => setShelfFilter(id)} style={{ padding: '6px 14px', borderRadius: 16, border: shelfFilter === id ? 'none' : '1px solid var(--line)', background: shelfFilter === id ? 'var(--brand)' : 'transparent', color: shelfFilter === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
                      ))}
                    </div>
                    {filtered.length === 0 ? <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>없어요</div>
                      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 14 }}>{filtered.map((ub) => <BookCard key={ub.id} ub={ub} />)}</div>}
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>※ '보고 싶은 책'은 비공개라 본인만 볼 수 있어요</div>
                  </>
                )}
              </div>
            );
          })()}

          {/* 공개 한 문장 */}
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>✏️ 공개 한 문장 {data.sents.length}</div>
          {data.sents.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '8px 0' }}>아직 공개된 한 문장이 없어요</div>
          ) : data.sents.map((s) => {
            const bt = s.user_book && s.user_book.book && s.user_book.book.title;
            const bid = s.user_book && s.user_book.book_id;
            const blinded = !revealed[s.id] && isSentenceBlinded(bid, s.page);
            return (
              <div key={s.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4 }}>{bt ? bt + ' · ' : ''}{s.page}p</div>
                {blinded ? (
                  <div className="spoiler-blind" onClick={() => setRevealed((r) => ({ ...r, [s.id]: true }))}>⚠️ 내가 아직 안 읽은 부분 · 탭하면 보기</div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>"{s.text}"</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── SettingsModal: 설정 (프로필 ⚙️ 진입, §5.8) ──
   스포일러 전역 토글(여기로 이전) + 닉네임 변경 + 로그아웃. */
function SettingsModal({ onClose, spoilerReveal, setSpoilerReveal }) {
  const me = window.RG_ME || {};
  const V = window.RG_VALIDATE || {};
  const [hdl, setHdl] = useState(me.handle || '');
  const [hbusy, setHbusy] = useState(false);
  const [hmsg, setHmsg] = useState('');
  const [consentOn, setConsentOn] = useState(window.RG_consent && window.RG_consent.get() === 'yes'); // 데이터 활용 동의 (#294)
  const [qPreset, setQPreset] = useState(window.RG_companionPreset ? window.RG_companionPreset.get() : 'balanced'); // 참새 질문 결 (#375)
  const [bio, setBio] = useState(me.bio || '');
  const [bmsg, setBmsg] = useState('');
  const saveBio = async () => {
    const v = bio.trim().slice(0, 100);
    if (!(DataStore.profile && DataStore.profile.update)) return;
    try {
      await Promise.resolve(DataStore.profile.update({ bio: v || null }));
      if (window.RG_ME) window.RG_ME.bio = v;
      setBmsg('✓ 저장됨'); showToast('소개 저장됨');
    } catch (e) { setBmsg('저장 실패'); }
  };
  // 닉네임 1개 통합(Model A): 화면 표시·고유성은 handle 로, 저장 시 display_name 도 동기화.
  // 내부 식별은 불변 UUID — 닉네임을 바꿔도 기록은 갈리지 않는다.
  const saveHandle = async () => {
    if (hbusy) return;
    const r = V.handle ? V.handle(hdl) : { ok: true, value: (hdl || '').replace(/^@/, '').trim() };
    if (!r.ok) { setHmsg(r.msg); return; }
    if (r.value === (me.handle || '')) { setHmsg('현재 닉네임이에요'); return; }
    setHbusy(true); setHmsg('확인 중…');
    try {
      const ok = (DataStore.users && DataStore.users.isHandleAvailable)
        ? await Promise.resolve(DataStore.users.isHandleAvailable(r.value)) : true;
      if (!ok) { setHmsg('이미 사용 중인 닉네임이에요'); return; }
      if (DataStore.profile && DataStore.profile.update) await Promise.resolve(DataStore.profile.update({ handle: r.value, display_name: r.value }));
      if (window.RG_ME) { window.RG_ME.handle = r.value; window.RG_ME.displayName = r.value; }
      setHmsg('✓ 저장됨'); showToast('닉네임 저장됨 — 새로고침하면 피드에 반영돼요');
    } catch (e) { setHmsg('이미 사용 중이거나 저장 실패'); }
    finally { setHbusy(false); }
  };
  const logout = () => {
    if (window.RG_SB && window.RG_SB.signOut) {
      Promise.resolve(window.RG_SB.signOut()).finally(() => window.location.reload());
    }
  };
  // 운영자 문의 (DB 저장 → admin 대시보드)
  const [inqMsg, setInqMsg] = useState('');
  const [inqBusy, setInqBusy] = useState(false);
  const [inqDone, setInqDone] = useState(false);
  const sendInquiry = () => {
    const m = inqMsg.trim();
    if (!m) { showToast('문의 내용을 적어주세요'); return; }
    if (!(DataStore.inquiries && DataStore.inquiries.create)) { showToast('로그인 후 이용해주세요'); return; }
    setInqBusy(true);
    Promise.resolve(DataStore.inquiries.create({ message: m }))
      .then(() => { setInqDone(true); setInqMsg(''); showToast('문의가 전송됐어요 — 운영자가 확인합니다'); })
      .catch(() => showToast('전송 실패 — 잠시 후 다시'))
      .finally(() => setInqBusy(false));
  };
  // 데이터 내보내기(#172) — 데이터 주권: 내 프로필·책·한 문장을 JSON 으로.
  const exportData = async () => {
    try {
      const [meRow, books, sents] = await Promise.all([
        Promise.resolve((DataStore.profile && DataStore.profile.get) ? DataStore.profile.get() : null).catch(() => null),
        Promise.resolve((DataStore.myBooks && DataStore.myBooks.list) ? DataStore.myBooks.list() : []).catch(() => []),
        Promise.resolve((DataStore.sentences && DataStore.sentences.listMine) ? DataStore.sentences.listMine() : []).catch(() => []),
      ]);
      const payload = { app: 'ReadingGo', exported_at: new Date().toISOString(), profile: meRow, books, sentences: sents };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `readinggo-export-${(meRow && meRow.handle) || 'me'}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('데이터를 내보냈어요 (JSON)');
    } catch (e) { showToast('내보내기 실패'); }
  };
  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="설정">
        <div className="sheet-grip" />
        <div style={{ padding: '8px 20px 24px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚙️ 설정</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-3)' }} title="닫기">✕</button>
          </div>
          {/* 스포일러 토글 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>스포일러 모두 보기</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>안 읽은 페이지의 한 문장도 표시</div>
            </div>
            <button onClick={() => setSpoilerReveal(v => !v)} aria-pressed={spoilerReveal} title="스포일러 토글"
              style={{ width: 52, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer', background: spoilerReveal ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 3, left: spoilerReveal ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          {/* 닉네임 — 피드·프로필에 표시되는 고유 이름(중복 불가, 언제든 변경). 내부 UUID 는 불변. */}
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>닉네임</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>피드·프로필에 <b>@닉네임</b>으로 표시돼요. 다른 사람과 겹칠 수 없고, 언제든 바꿀 수 있어요.</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 800 }}>@</span>
              <input value={hdl} maxLength={20} onChange={e => { setHdl(e.target.value); setHmsg(''); }} placeholder="myname"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, outline: 'none' }} />
              <button onClick={saveHandle} disabled={hbusy} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: hbusy ? 'default' : 'pointer', opacity: hbusy ? 0.6 : 1 }}>저장</button>
            </div>
            {hmsg && <div style={{ fontSize: 12, color: hmsg.indexOf('✓') === 0 ? 'var(--brand)' : '#d33', marginTop: 6 }}>{hmsg}</div>}
          </div>
          {/* 한 줄 소개 (#10) */}
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>한 줄 소개</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={bio} maxLength={100} onChange={e => { setBio(e.target.value); setBmsg(''); }} placeholder="책 속에서 길을 찾는 중…"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, outline: 'none' }} />
              <button onClick={saveBio} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>저장</button>
            </div>
            {bmsg && <div style={{ fontSize: 12, color: bmsg.indexOf('✓') === 0 ? 'var(--brand)' : '#d33', marginTop: 6 }}>{bmsg}</div>}
          </div>
          {/* 데이터 내보내기 (#172) — 데이터 주권: 내 기록은 내 것 */}
          <button onClick={exportData} style={{ marginTop: 18, width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>📦 내 데이터 내보내기 (JSON)</button>

          {/* 운영자 문의 — DB 저장 → admin 대시보드 */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-2)', marginBottom: 8 }}>✉️ 운영자에게 문의</div>
            {inqDone ? (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', background: 'var(--card)', borderRadius: 10, padding: 12 }}>전송됐어요. 운영자가 확인 후 답변드립니다 🐦 <button onClick={() => setInqDone(false)} style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--brand-3)', fontWeight: 800, cursor: 'pointer' }}>다시 쓰기</button></div>
            ) : (
              <>
                <textarea value={inqMsg} onChange={(e) => { if (e.target.value.length <= 2000) setInqMsg(e.target.value); }} placeholder="버그·불편·제안 무엇이든 적어주세요 (최대 2000자)" rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1.5px solid var(--line)', padding: 10, fontSize: 14, lineHeight: 1.5, resize: 'none' }} />
                <button onClick={sendInquiry} disabled={inqBusy} style={{ marginTop: 8, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: inqBusy ? 'default' : 'pointer', opacity: inqBusy ? 0.6 : 1 }}>{inqBusy ? '보내는 중…' : '문의 보내기'}</button>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>또는 readinggo.admin@gmail.com</div>
              </>
            )}
          </div>

          {/* 게스트: 로그인=저장 / 로그인 사용자: 로그아웃 (onboarding.md §4 E) */}
          {(window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured() && window.DataStore !== window.SupabaseDataStore) ? (
            <button onClick={() => { onClose && onClose(); if (window.RG_login) window.RG_login(); }}
              style={{ marginTop: 14, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              🐦 로그인하고 내 기록 저장하기
            </button>
          ) : (
            <>
              {/* 다른 기기 로그아웃 (멀티 디바이스 관리) */}
              <button onClick={() => {
                if (!window.confirm('이 기기만 남기고 다른 모든 기기에서 로그아웃할까요?')) return;
                if (window.RG_SB && window.RG_SB.signOutOtherDevices) {
                  Promise.resolve(window.RG_SB.signOutOtherDevices()).then(() => showToast('다른 기기에서 로그아웃했어요')).catch(() => showToast('실패 — 잠시 후 다시'));
                }
              }} style={{ marginTop: 14, width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>📱 다른 기기에서 로그아웃</button>
              {/* 로그아웃 */}
              <button onClick={logout} style={{ marginTop: 10, width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>로그아웃</button>
            </>
          )}

          {/* 데이터 수집·AI 활용 동의 (#294, analytics.md §5) */}
          <div style={{ marginTop: 14, padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>독서 대화 AI·분석 활용</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>한 문장·대화를 AI가 읽고 질문을 만들고, 익명으로 분석에 활용해요. 끄면 로컬 질문만(외부 전송·수집 없음).</div>
            </div>
            <button onClick={() => { const nv = consentOn ? 'no' : 'yes'; if (window.RG_consent) window.RG_consent.set(nv); setConsentOn(nv === 'yes'); showToast(nv === 'yes' ? '🐦 고마워요! 더 나은 질문을 드릴게요' : '로컬 모드로 전환됐어요'); }}
              aria-label="데이터 활용 동의 토글"
              style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: consentOn ? 'var(--brand)' : 'var(--line)', position: 'relative', transition: 'background .2s' }}>
              <span style={{ position: 'absolute', top: 3, left: consentOn ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
            </button>
          </div>

          {/* 참새 질문 결 프리셋 (#375, companion.md §4.4) — 고른 결이 다음 질문부터 반영. */}
          <div style={{ marginTop: 14, padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>🐦 참새 질문 결</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, marginBottom: 10, lineHeight: 1.4 }}>참새가 던지는 질문의 방향을 골라요. 다음 질문부터 반영돼요.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(window.RG_COMPANION_PRESETS || []).map((p) => {
                const on = qPreset === p.key;
                return (
                  <button key={p.key} onClick={() => { setQPreset(p.key); if (window.RG_companionPreset) window.RG_companionPreset.set(p.key); }}
                    aria-pressed={on}
                    style={{ padding: '6px 12px', borderRadius: 16, border: on ? 'none' : '1px solid var(--line)', background: on ? 'var(--brand)' : 'transparent', color: on ? '#fff' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
                    {p.emoji} {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 앱 버전 (베타) */}
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>ReadingGo v{(window.RG_VERSION || '0.000')} · beta</div>
        </div>
      </div>
    </div>
  );
}

// 진입 동의 배너 (#331) — 비차단 하단 바. 필수(서비스 운영) + 선택(AI·분석). opt-in 허들↓.
function ConsentBanner({ onChoose }) {
  const [detail, setDetail] = useState(false);
  const [optional, setOptional] = useState(true); // 선택 기본 체크 → 전체 동의 유도
  const ghost = { flex: '0 0 auto', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' };
  const primary = { flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' };
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 60, background: 'var(--card)', borderTop: '1px solid var(--line)', boxShadow: '0 -4px 16px rgba(0,0,0,0.10)', padding: '14px 16px 16px' }}>
      <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>🍪 데이터 활용 동의</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>서비스 운영(필수)과 더 나은 독서 파트너를 위한 AI·분석 활용(선택)에 동의해 주세요. 언제든 설정에서 바꿀 수 있어요.</div>
      {detail && (
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'var(--paper-2)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>필수 — 서비스 운영 <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>(로그인·기록 저장)</span></span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-3)' }}>항상 켜짐</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>선택 — 독서 대화 AI·분석 <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>(파트너 질문·익명 분석)</span></span>
            <button onClick={() => setOptional((o) => !o)} aria-label="선택 동의 토글" style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: optional ? 'var(--brand)' : 'var(--line)', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 3, left: optional ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {detail ? (
          <button onClick={() => onChoose(optional ? 'yes' : 'no')} style={primary}>저장</button>
        ) : (
          <>
            <button onClick={() => onChoose('no')} style={ghost}>필수만</button>
            <button onClick={() => setDetail(true)} style={ghost}>상세 설정</button>
            <button onClick={() => onChoose('yes')} style={primary}>전체 동의</button>
          </>
        )}
      </div>
    </div>
  );
}

window.showToast = showToast;
window.rgTrack = rgTrack;
window.BookCover = BookCover;
window.ConsentBanner = ConsentBanner;
// 데이터 수집·AI 활용 동의 (#294, analytics.md §5). DataStore.consent 어댑터 위임(직접 localStorage 금지).
window.RG_consent = {
  get() { return (window.DataStore && window.DataStore.consent) ? window.DataStore.consent.get() : null; },
  set(v) { if (window.DataStore && window.DataStore.consent) window.DataStore.consent.set(v); },
};
window.Toast = Toast;
window.Confetti = Confetti;
window.SentenceCard = SentenceCard;
window.SpoilerContext = SpoilerContext;
window.isSentenceBlinded = isSentenceBlinded;
window.UserProfileModal = UserProfileModal;
window.SettingsModal = SettingsModal;

/* ── BookInfoModal: 한 문장의 책 제목 탭 → 책 정보(#11). books.getById 로 단건 조회. ── */
function BookInfoModal({ bookId, onClose }) {
  const [bk, setBk] = useState(undefined); // undefined=로딩, null=없음
  const [manualPages, setManualPages] = useState(''); // 쪽수 메타 누락 시 수동 입력 (#204)
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {}; // 활성 어댑터 — 게스트가 Supabase로 새던 400 수정 (QA ISSUE-004)
    Promise.resolve((DS.books && DS.books.getById) ? DS.books.getById(bookId) : null)
      .then(b => { if (alive) setBk(b || null); }).catch(() => { if (alive) setBk(null); });
    return () => { alive = false; };
  }, [bookId]);
  const kyoboUrl = bk ? `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(bk.isbn13 || bk.title)}` : '#';
  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="책 정보">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{position:'absolute', top:10, right:14, background:'rgba(0,0,0,0.06)', border:'none', borderRadius:'50%', width:30, height:30, fontSize:16, cursor:'pointer', color:'var(--ink-2)', lineHeight:1, zIndex:2}}>✕</button>
        {bk === undefined ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
        ) : bk === null ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>책 정보를 찾을 수 없어요</div>
        ) : (
          <div style={{ padding: '8px 20px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ width: 100, height: 140, margin: '0 auto 12px', borderRadius: 8, overflow: 'hidden', background: 'var(--line)' }}>
                {bk.cover_url && <img src={bk.cover_url} alt={bk.title} referrerPolicy="no-referrer" onError={e => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px', color: 'var(--ink)' }}>{bk.title}</h2>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 700, margin: 0 }}>{bk.author}{bk.publisher ? ' · ' + bk.publisher : ''}{bk.total_pages ? ' · ' + bk.total_pages + 'p' : ''}</p>
            </div>
            <a href={kyoboUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'var(--brand-tint)', border: '1.5px solid var(--brand)', borderRadius: 8, color: 'var(--brand-3)', fontSize: 13, fontWeight: 800, textDecoration: 'none', marginBottom: 10 }}>교보문고에서 보기 →</a>
            {/* 쪽수 메타 누락 시 수동 입력 — 진척률·읽기모드용 (#204) */}
            {!bk.total_pages && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: 'var(--ink-2)', fontWeight: 700 }}>
                <span>총 쪽수 <small style={{ color: 'var(--ink-3)' }}>(선택 — 모르면 비워둬요)</small></span>
                <input type="number" inputMode="numeric" min="0" max="99999" value={manualPages} placeholder="예: 320"
                  onChange={e => setManualPages(e.target.value)}
                  style={{ width: 80, textAlign: 'center', padding: '6px 4px', border: '1.5px solid var(--line)', borderRadius: 8, fontSize: 14, fontWeight: 800 }} />
                <span>p</span>
              </div>
            )}
            <button className="submit-btn" style={{ margin: '4px 0 0' }} onClick={() => { if (window.RG_registerBook) { const tp = bk.total_pages || (parseInt(manualPages, 10) || 0); window.RG_registerBook({ ...bk, total_pages: tp }); } onClose(); }}>📖 이 책 읽기</button>
          </div>
        )}
      </div>
    </div>
  );
}
window.BookInfoModal = BookInfoModal;

/* ── StreakCalendarModal: 🔥 탭 → 최근 5주 스트릭 캘린더(#173). 읽은 날 🔥 · 방패 지킨 날 🔵 ── */
function StreakCalendarModal({ streak, onClose }) {
  const [cal, setCal] = useState(undefined);
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {}; // 활성 어댑터 — 게스트가 Supabase로 새던 400 수정 (QA ISSUE-004)
    Promise.resolve((DS.sessions && DS.sessions.calendar) ? DS.sessions.calendar(35) : { readDates: [], shieldDates: [] })
      .then(c => { if (alive) setCal(c || { readDates: [], shieldDates: [] }); })
      .catch(() => { if (alive) setCal({ readDates: [], shieldDates: [] }); });
    return () => { alive = false; };
  }, []);
  const days = [];
  const now = new Date();
  for (let i = 34; i >= 0; i--) days.push(new Date(now.getTime() - i * 86400 * 1000).toISOString().slice(0, 10));
  const readSet = new Set((cal && cal.readDates) || []);
  const shieldSet = new Set((cal && cal.shieldDates) || []);
  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="스트릭 캘린더">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', top: 10, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', lineHeight: 1, zIndex: 2 }}>✕</button>
        <div style={{ padding: '8px 20px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)' }}>🔥 {streak}일 연속</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>최근 5주 · 🔥 읽은 날 · 🔵 방패로 지킨 날</div>
          </div>
          {cal === undefined ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20 }}>불러오는 중…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {days.map(ds => {
                const read = readSet.has(ds), shielded = shieldSet.has(ds);
                return (
                  <div key={ds} title={ds} style={{ aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: read ? '#FFF7EE' : (shielded ? '#E8F0FE' : 'var(--card)'), border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                    <span style={{ fontSize: 13 }}>{read ? '🔥' : (shielded ? '🔵' : '·')}</span>
                    <span>{ds.slice(8, 10)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
window.StreakCalendarModal = StreakCalendarModal;

/* ── SentenceCollectionModal: 내 한 문장 모아보기(전체/책별/좋아요) + 읽었음 카운터(#171) ── */
function SentenceCollectionModal({ onClose }) {
  const [mine, setMine] = useState(undefined);
  const [favIds, setFavIds] = useState(new Set());
  const [filter, setFilter] = useState('all'); // all | book | fav
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {}; // 활성 어댑터 — 게스트가 Supabase로 새던 400 수정 (QA ISSUE-004)
    Promise.all([
      Promise.resolve((DS.sentences && DS.sentences.listMine) ? DS.sentences.listMine() : []).catch(() => []),
      Promise.resolve((DS.bookmarks && DS.bookmarks.list) ? DS.bookmarks.list() : []).catch(() => []),
    ]).then(([sents, bms]) => {
      if (!alive) return;
      setMine((sents || []).map(s => ({
        id: s.id, text: s.text, page: s.page,
        bookTitle: (s.user_book && s.user_book.book && s.user_book.book.title) || '',
        bookId: (s.user_book && s.user_book.book_id) || '',
        isPrivate: !!s.is_private,
      })));
      setFavIds(new Set((bms || []).map(b => b.sentence_id)));
    }).catch(() => { if (alive) setMine([]); });
    return () => { alive = false; };
  }, []);
  const list = mine || [];
  const favCount = list.filter(s => favIds.has(s.id)).length;
  const filtered = filter === 'fav' ? list.filter(s => favIds.has(s.id)) : list;
  const byBook = {};
  if (filter === 'book') filtered.forEach(s => { const k = s.bookTitle || '기타'; (byBook[k] = byBook[k] || []).push(s); });
  const renderLine = (s) => (
    <div key={s.id} onClick={() => { if (window.RG_openCompanion) window.RG_openCompanion({ id: s.id, text: s.text, bookId: s.bookId, bookTitle: s.bookTitle, page: s.page, note: s.note || s.my_note || '', kind: s.kind }); }}
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4 }}>
        {s.bookTitle ? s.bookTitle + ' · ' : ''}{s.page}p{s.isPrivate ? ' · 🔒' : ''}{favIds.has(s.id) ? ' · ❤️' : ''}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>"{s.text}"</div>
    </div>
  );
  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="내 한 문장 모아보기">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', top: 10, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', lineHeight: 1, zIndex: 2 }}>✕</button>
        <div style={{ padding: '8px 20px 20px', maxHeight: '74vh', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>📓 내 한 문장</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>읽었음 {list.length}개 · ❤️ 좋아요 {favCount}개</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
            {[['all', '전체'], ['book', '책별'], ['fav', '좋아요']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ padding: '6px 14px', borderRadius: 16, border: filter === id ? 'none' : '1px solid var(--line)', background: filter === id ? 'var(--brand)' : 'transparent', color: filter === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          {mine === undefined ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20 }}>불러오는 중…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20 }}>{filter === 'fav' ? '좋아요한 문장이 없어요' : '아직 한 문장이 없어요'}</div>
          ) : filter === 'book' ? (
            Object.keys(byBook).map(title => (
              <div key={title} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink)', marginBottom: 6 }}>{title} <span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>({byBook[title].length})</span></div>
                {byBook[title].map(renderLine)}
              </div>
            ))
          ) : (
            filtered.map(renderLine)
          )}
        </div>
      </div>
    </div>
  );
}
window.SentenceCollectionModal = SentenceCollectionModal;

/* ── AdminDashboardModal: 운영 대시보드 — is_admin=true 전용 (#161) ── */
function AdminDashboardModal({ onClose }) {
  const [stats, setStats] = useState(null);
  const [inqs, setInqs] = useState(undefined); // 문의 목록
  const [popular, setPopular] = useState(null); // 인기책 TOP (#190)
  const [active, setActive] = useState(null);   // 활성 사용자 7/30일 (#190)
  useEffect(() => {
    const DS = window.SupabaseDataStore;
    if (!DS || !DS.admin || !DS.admin.stats) { setStats({}); setInqs([]); return; }
    Promise.resolve(DS.admin.stats()).then(setStats).catch(() => setStats({}));
    if (DS.admin.inquiries) Promise.resolve(DS.admin.inquiries()).then((r) => setInqs(r || [])).catch(() => setInqs([]));
    else setInqs([]);
    if (DS.admin.popularBooks) Promise.resolve(DS.admin.popularBooks(5)).then((r) => setPopular(r || [])).catch(() => setPopular([]));
    if (DS.admin.activeUsers) Promise.resolve(DS.admin.activeUsers()).then(setActive).catch(() => setActive(null));
  }, []);
  // 문의 상태 순환 (open→answered→closed→open)
  const cycleStatus = (q) => {
    const DS = window.SupabaseDataStore;
    if (!DS || !DS.admin || !DS.admin.inquirySetStatus) return;
    const next = q.status === 'open' ? 'answered' : q.status === 'answered' ? 'closed' : 'open';
    setInqs((list) => (list || []).map((x) => x.id === q.id ? { ...x, status: next } : x));
    Promise.resolve(DS.admin.inquirySetStatus(q.id, next)).catch(() => {});
  };
  const _stColor = { open: '#E5484D', answered: '#F59E0B', closed: '#9097A0' };
  const rows = [
    ['👤 가입자', stats && stats.users],
    ['🙋 실사용자', stats && stats.realUsers],   // NPC 제외 (#190 A)
    ['📝 한 문장', stats && stats.sentences],
    ['🏰 완독', stats && stats.completed],
    ['⚡ 오늘 체크인', stats && stats.todaySessions],
  ];
  const trend = (stats && stats.trend) || [];
  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="운영 대시보드">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{position:'absolute',top:10,right:14,background:'rgba(0,0,0,0.06)',border:'none',borderRadius:'50%',width:30,height:30,fontSize:16,cursor:'pointer',color:'var(--ink-2)',lineHeight:1,zIndex:2}}>✕</button>
        <div style={{padding:'16px 20px 28px'}}>
          <div style={{fontSize:18,fontWeight:900,marginBottom:20,textAlign:'center'}}>⚙️ 운영 대시보드</div>
          {!stats ? (
            <div style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>불러오는 중…</div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {rows.map(([label, val]) => (
                <div key={label} style={{background:'var(--card)',border:'1px solid var(--line)',borderRadius:10,padding:'16px 12px',textAlign:'center'}}>
                  <div style={{fontSize:24,fontWeight:900,color:'var(--brand)'}}>{val ?? '—'}</div>
                  <div style={{fontSize:11,color:'var(--ink-3)',fontWeight:700,marginTop:6}}>{label}</div>
                </div>
              ))}
            </div>
          )}
          {/* 최근 7일 추세 (#206) — 체크인=막대(하단 숫자) + 가입=선그래프(포인트 숫자). 가입은 NPC 제외 */}
          {trend.length > 0 && (() => {
            const n = trend.length;
            const H = 96;
            const sessMax = Math.max(1, ...trend.map((t) => t.sessions));
            const signMax = Math.max(1, ...trend.map((t) => t.signups));
            const pts = trend.map((t, i) => ({
              x: ((i + 0.5) / n) * 100,
              y: H - (t.signups / signMax) * (H - 20) - 6, // 위쪽 숫자 여백
              signups: t.signups,
            }));
            const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 2 }}>📈 최근 7일</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
                  <span style={{ color: 'var(--brand)' }}>■ 체크인(막대)</span> · <span style={{ color: '#E2553B' }}>● 가입(선, NPC 제외)</span>
                </div>
                <div style={{ position: 'relative', height: H }}>
                  {/* 체크인 막대 */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                    {trend.map((t) => (
                      <div key={t.date} title={`${t.date} · 체크인 ${t.sessions} · 가입 ${t.signups}`}
                        style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                        <div style={{ width: '60%', height: Math.round((t.sessions / sessMax) * (H - 16)) + 2, background: 'var(--brand)', borderRadius: 3, opacity: 0.88 }} />
                      </div>
                    ))}
                  </div>
                  {/* 가입 선그래프 (SVG 오버레이) */}
                  <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                    <polyline points={poly} fill="none" stroke="#E2553B" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    {pts.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#E2553B" vectorEffect="non-scaling-stroke" />))}
                  </svg>
                  {/* 가입 포인트 숫자 */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                    {pts.map((p, i) => (
                      <div key={i} style={{ flex: 1, position: 'relative' }}>
                        {p.signups > 0 && (
                          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: (p.y / H * 100) + '%', marginTop: -15, fontSize: 9, fontWeight: 800, color: '#E2553B' }}>{p.signups}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* 체크인 수(막대 하단 숫자) + 날짜 */}
                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                  {trend.map((t) => (
                    <div key={t.date} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)' }}>{t.sessions}</div>
                      <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 700 }}>{t.date.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* 활성 사용자 — 리텐션 프록시 (#190 C) */}
          {active && (
            <div style={{ marginTop: 22, display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)' }}>{active.d7}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>최근 7일 활성</div>
              </div>
              <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)' }}>{active.d30}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>최근 30일 활성</div>
              </div>
            </div>
          )}
          {/* 인기책 TOP (#190 C) */}
          {popular && popular.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>🔥 인기책 TOP {popular.length}</div>
              {popular.map((b, i) => (
                <div key={b.bookId || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: i < popular.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                  <div style={{ width: 20, fontWeight: 900, color: 'var(--ink-3)', textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>등록 {b.registered} · 완독 {b.completed}</div>
                </div>
              ))}
            </div>
          )}
          {/* 문의 목록 */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>✉️ 문의 {inqs && inqs.length ? '(' + inqs.length + ')' : ''}</div>
            {inqs === undefined ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>불러오는 중…</div>
            ) : inqs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>접수된 문의가 없어요</div>
            ) : inqs.map((q) => (
              <div key={q.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>@{(q.user && q.user.handle) || '익명'} · {String(q.created_at).slice(0, 10)}</div>
                  <button onClick={() => cycleStatus(q)} title="상태 변경" style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: _stColor[q.status] || '#9097A0', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer' }}>{q.status}</button>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{q.message}</div>
                {q.app_version && <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, marginRight: 8 }}>v{q.app_version}</span>}
                {q.email && <a href={`mailto:${q.email}?subject=${encodeURIComponent('[ReadingGo] 문의 답변')}`} style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--brand-3)', fontWeight: 800 }}>✉️ {q.email} 로 답장</a>}
                {/* AI 자동 답변 (#208) — 스캐폴드: LLM 연동 전까지 자리만 */}
                {q.response ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-2)', background: 'var(--brand-tint)', borderRadius: 6, padding: '6px 8px', whiteSpace: 'pre-wrap' }}>🤖 {q.response}</div>
                ) : (
                  <button onClick={() => (window.showToast ? window.showToast('AI 자동 답변은 LLM 연동 후 활성화돼요 (#208)') : null)}
                    style={{ display: 'inline-block', marginTop: 6, marginLeft: 8, fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', background: 'transparent', border: '1px dashed var(--line)', borderRadius: 10, padding: '3px 8px', cursor: 'pointer' }}>🤖 AI 답변 생성 (준비중)</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.AdminDashboardModal = AdminDashboardModal;

/* ── TinderCards: 한 문장 스와이프 리뷰 (#186) ──
   책의 한 문장들을 카드로. 우=좋아요(짹+책갈피)/좌=싫어요(넘김)/아래=유예(뒤로).
   Stack Lock 준수 — 라이브러리 없이 Pointer Events + transform 직접 구현. */
function TinderCards({ items, title, onClose }) {
  const [queue, setQueue] = useState(items || []);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const [liked, setLiked] = useState(0);
  const startRef = useRef(null);
  const top = queue[0];

  const act = (dir) => {
    const card = queue[0];
    if (!card) return;
    if (dir === 'like') {
      setLiked((n) => n + 1);
      if (card.id && DataStore.claps && DataStore.claps.toggle) Promise.resolve(DataStore.claps.toggle(card.id)).catch(() => {});
      if (card.id && DataStore.bookmarks && DataStore.bookmarks.toggle) Promise.resolve(DataStore.bookmarks.toggle(card.id)).catch(() => {});
    }
    setDrag({ dx: 0, dy: 0, active: false });
    setQueue((q) => dir === 'defer' ? q.slice(1).concat(q[0]) : q.slice(1));
  };
  const onDown = (e) => { startRef.current = { x: e.clientX, y: e.clientY }; setDrag((d) => ({ ...d, active: true })); e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); };
  const onMove = (e) => { if (!startRef.current) return; setDrag({ dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y, active: true }); };
  const onUp = () => {
    if (!startRef.current) return;
    const { dx, dy } = drag;
    startRef.current = null;
    if (dx > 90) return act('like');
    if (dx < -90) return act('dislike');
    if (dy > 110) return act('defer');
    setDrag({ dx: 0, dy: 0, active: false });
  };

  const hint = drag.dx > 40 ? { t: '좋아요 ❤️', c: '#3FD17F' } : drag.dx < -40 ? { t: '넘기기 ✕', c: '#E5484D' } : drag.dy > 60 ? { t: '나중에 ↓', c: '#9097A0' } : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#15171B', zIndex: 1100, display: 'flex', flexDirection: 'column', color: '#F4F2EC' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#F4F2EC', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{title || '한 문장 카드'}</div>
        <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 800 }}>❤️ {liked}</div>
      </div>
      {/* 현재 카드 책 표지·저자 — 중앙 상단 (카드 본문과 분리) */}
      {top && (top.bookCover || top.bookTitle) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 18px 0' }}>
          <div style={{ width: 56, height: 78, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {top.bookCover
              ? <img src={top.bookCover} alt={top.bookTitle} loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 22 }}>📖</span>}
          </div>
          {top.bookTitle && <div style={{ fontSize: 13, fontWeight: 800, textAlign: 'center', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.bookTitle}</div>}
          {top.bookAuthor && <div style={{ fontSize: 11, opacity: 0.6 }}>{top.bookAuthor}</div>}
        </div>
      )}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {!top ? (
          <div style={{ textAlign: 'center', opacity: 0.8 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🃏</div>
            <div style={{ fontWeight: 800 }}>카드를 다 봤어요</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>❤️ {liked}개에 좋아요를 남겼어요</div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 20, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>닫기</button>
          </div>
        ) : (
          <>
            {queue[1] && (
              <div style={{ position: 'absolute', width: 'min(86vw, 360px)', height: 360, background: 'rgba(255,255,255,0.06)', borderRadius: 18, transform: 'scale(0.94) translateY(12px)' }} />
            )}
            <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{
                position: 'relative', width: 'min(86vw, 360px)', minHeight: 360, background: '#22252B', borderRadius: 18, padding: 24,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)', cursor: 'grab', touchAction: 'none', userSelect: 'none',
                transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 22}deg)`,
                transition: drag.active ? 'none' : 'transform 0.25s ease', display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
              {hint && <div style={{ position: 'absolute', top: 18, left: 18, fontSize: 16, fontWeight: 900, color: hint.c, border: `2px solid ${hint.c}`, borderRadius: 8, padding: '2px 10px' }}>{hint.t}</div>}
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 700, marginBottom: 12 }}>{top.bookTitle ? top.bookTitle + ' · ' : ''}{top.page}p {top.nick ? '· ' + top.nick : ''}</div>
              <div style={{ fontSize: 19, lineHeight: 1.7, fontWeight: 600 }}>"{top.text || top.q}"</div>
            </div>
          </>
        )}
      </div>
      {top && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 22, padding: '12px 0 28px' }}>
          <button onClick={() => act('dislike')} style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#2A2D33', color: '#E5484D', fontSize: 22, cursor: 'pointer' }}>✕</button>
          <button onClick={() => act('defer')} style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#2A2D33', color: '#9097A0', fontSize: 18, cursor: 'pointer', alignSelf: 'center' }}>↓</button>
          <button onClick={() => act('like')} style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#2A2D33', color: '#3FD17F', fontSize: 22, cursor: 'pointer' }}>❤️</button>
        </div>
      )}
    </div>
  );
}
window.TinderCards = TinderCards;

/* ── ActivityHeatmap: 독서 활동 잔디 (#195) ──
   최근 N일(기본 182=26주) 일별 읽은 쪽수를 GitHub식 히트맵으로. DataStore.sessions.heatmap. */
function ActivityHeatmap({ days }) {
  const N = days || 182;
  const [map, setMap] = useState(null);
  useEffect(() => {
    const DS = window.DataStore || {};
    if (!(DS.sessions && DS.sessions.heatmap)) { setMap({}); return; }
    Promise.resolve(DS.sessions.heatmap(N)).then((rows) => {
      const m = {}; (rows || []).forEach((r) => { m[r.date] = r.pages; }); setMap(m);
    }).catch(() => setMap({}));
  }, []);
  if (map === null) return <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 8 }}>활동 불러오는 중…</div>;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (N - 1) * 86400000);
  start.setDate(start.getDate() - start.getDay());
  const cells = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    cells.push({ date: ds, pages: map[ds] || 0 });
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const maxP = Math.max(1, ...cells.map((c) => c.pages));
  const lvl = (p) => p <= 0 ? 0 : p >= maxP * 0.66 ? 3 : p >= maxP * 0.33 ? 2 : 1;
  const COLOR = ['var(--line, #ebedf0)', '#9be9a8', '#40c463', '#216e39'];
  const totalPages = cells.reduce((s, c) => s + c.pages, 0);
  const activeDays = cells.filter((c) => c.pages > 0).length;
  // 월 라벨 (#207) — 주 컬럼의 첫날 월이 직전 주와 바뀌면 그 컬럼 위에 'M월'
  const months = weeks.map((w, wi) => {
    const m = w[0] ? parseInt(w[0].date.slice(5, 7), 10) : null;
    const pm = (wi > 0 && weeks[wi - 1][0]) ? parseInt(weeks[wi - 1][0].date.slice(5, 7), 10) : null;
    return (m && (wi === 0 || m !== pm)) ? m + '월' : '';
  });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>🌱 독서 활동</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>{Math.round(N / 7)}주 · {activeDays}일 · {totalPages}쪽</div>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'inline-block' }}>
          {/* 월 라벨 행 (#207) — absolute로 레이아웃 영향 없이 텍스트 오버플로 (#11 스크롤 방지) */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 3, height: 11 }}>
            {months.map((m, wi) => (
              <div key={wi} style={{ width: 11, flexShrink: 0, position: 'relative', overflow: 'visible' }}>
                {m && <span style={{ position: 'absolute', left: 0, top: 0, fontSize: 9, lineHeight: '11px', color: 'var(--ink-3)', fontWeight: 800, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{m}</span>}
              </div>
            ))}
          </div>
          {/* 주 그리드 */}
          <div style={{ display: 'flex', gap: 2 }}>
            {weeks.map((w, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {w.map((c) => (
                  <div key={c.date} title={`${c.date} · ${c.pages}쪽`}
                    style={{ width: 11, height: 11, borderRadius: 2, background: COLOR[lvl(c.pages)], flexShrink: 0 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.ActivityHeatmap = ActivityHeatmap;
