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
              <span>✅ 완독 {data.completed.length}</span>
              <span>📖 읽는 중 {data.reading.length}</span>
              <span>✨ {data.user.xp || 0} XP</span>
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
                  <div style={{ fontSize: 15, fontWeight: 900 }}>📚 책장</div>
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
              <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>🔖 읽고 싶어하는 책 {data.wishlist.length}</div>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
                {data.wishlist.map((wb) => {
                  const bk = wb.book || {};
                  return (
                    <div key={wb.id || wb.book_id} style={{ flex: '0 0 auto' }}
                      onClick={() => bk.id && setBookView({ bookId: bk.id, title: bk.title, cover: bk.cover_url })}>
                      <div style={{ width: 84, cursor: bk.id ? 'pointer' : 'default' }}>
                        <div style={{ width: 84, height: 118, borderRadius: 6, overflow: 'hidden', background: 'var(--line)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {bk.cover_url
                            ? <img src={bk.cover_url} alt={bk.title} loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 28 }}>❤️</span>}
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


window.SpoilerContext = SpoilerContext;
window.isSentenceBlinded = isSentenceBlinded;
window.UserProfileModal = UserProfileModal;

/* ── BookInfoModal: 한 문장의 책 제목 탭 → 책 정보(#11). books.getById 로 단건 조회. ── */
// HTML 엔티티 디코드 (#562/#578) — 외부 description 의 `&lt; &gt; &amp;` raw 노출 방지. library.js 와 동일 패턴(컴포넌트 파일 자립).
function decodeEntities(s) {
  const str = String(s == null ? '' : s);
  if (!str || str.indexOf('&') < 0) return str;
  if (typeof document !== 'undefined' && document.createElement) {
    try { const t = document.createElement('textarea'); t.innerHTML = str; return t.value; } catch (e) { /* fall through */ }
  }
  const named = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, ent) => {
    if (ent[0] === '#') {
      const code = (ent[1] === 'x' || ent[1] === 'X') ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return named[ent.toLowerCase()] || m;
  });
}
window.decodeEntities = decodeEntities; // sentence-card.js 등 추출 모듈이 사용 (#761)


function BookInfoModal({ bookId, onClose }) {
  // sentence-card.js(이후 로드)에서 추출 — render 시 window 전역에서 alias (#761).
  const SentenceCard = window.SentenceCard, SentenceActions = window.SentenceActions;
  const [bk, setBk] = useState(undefined); // undefined=로딩, null=없음
  const [manualPages, setManualPages] = useState(''); // 쪽수 메타 누락 시 수동 입력 (#204)
  const [desc, setDesc] = useState(''); // 책 소개 (#578) — DB description 우선, 없으면 알라딘 폴백
  const [descSource, setDescSource] = useState(''); // 소개 출처 (#642) — 'llm'이면 AI 작성 칩
  const [popular, setPopular] = useState([]); // 인기 한 문장 Top5 (#594) — 짹 많은 순, 게스트/빈 → []
  const [mySents, setMySents] = useState([]); // 내 한 문장 (#610) — 이 책에 내가 남긴 것 (읽은 책)
  const [shelf, setShelf] = useState(null); // 서재 상태 (#644) — null=미상, 'reading'|'completed'|'aborted'|'wish'|'none'
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {}; // 활성 어댑터 — 게스트가 Supabase로 새던 400 수정 (QA ISSUE-004)
    Promise.resolve((DS.books && DS.books.getById) ? DS.books.getById(bookId) : null)
      .then(b => { if (alive) setBk(b || null); }).catch(() => { if (alive) setBk(null); });
    return () => { alive = false; };
  }, [bookId]);
  // 서재 상태 판정 (#644) — 이미 내 책(읽는중/완독/중단)이면 발견용 찜·읽기 버튼을 숨겨
  // 홈/책장 동선을 통일한다. 찜만 한 상태면 '읽고 싶어요'만 숨기고 '이 책 읽기'는 유지.
  useEffect(() => {
    if (!bk) { setShelf(null); return; }
    let alive = true;
    const DS = window.DataStore || {};
    const isbn = bk.isbn13 || bk.isbn || '';
    const match = (b) => b && (b.id === bk.id || (isbn && b.isbn13 === isbn));
    Promise.resolve((DS.myBooks && DS.myBooks.list) ? DS.myBooks.list() : [])
      .then(rows => {
        if (!alive) return null;
        const ub = (Array.isArray(rows) ? rows : []).find(u => u.book_id === bk.id || match(u.book));
        if (ub) { setShelf(ub.status || 'reading'); return null; } // 내 책이면 위시 조회 생략
        return Promise.resolve((DS.wishBooks && DS.wishBooks.list) ? DS.wishBooks.list() : []);
      })
      .then(wishes => {
        if (!alive || wishes === null) return;
        const wished = (Array.isArray(wishes) ? wishes : []).some(w => w.book_id === bk.id || match(w.book));
        setShelf(wished ? 'wish' : 'none');
      })
      .catch(() => { if (alive) setShelf('none'); });
    return () => { alive = false; };
  }, [bk]);
  // 인기 한 문장 Top5 (#594) — 그 책 공개 문장 중 짹 많은 순. 게스트·비UUID·빈 결과 → 섹션 생략.
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {};
    Promise.resolve((DS.sentences && DS.sentences.byBook) ? DS.sentences.byBook(bookId, { limit: 5, sort: 'likes' }) : [])
      .then(rows => { if (alive) setPopular(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setPopular([]); });
    return () => { alive = false; };
  }, [bookId]);
  // 내 한 문장 (#610) — 이 책에 내가 남긴 문장(byBook은 타인 전용이라 listMine 필터). 읽은 책이면 노출.
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {};
    Promise.resolve((DS.sentences && DS.sentences.listMine) ? DS.sentences.listMine() : [])
      .then(rows => {
        if (!alive) return;
        const mine = (Array.isArray(rows) ? rows : []).filter(r => ((r.user_book && r.user_book.book_id) || r.book_id) === bookId);
        setMySents(mine.map(r => ({ id: r.id, text: r.text || '', page: r.page, bookId, bookTitle: (r.user_book && r.user_book.book && r.user_book.book.title) || '', visibility: r.visibility, isPrivate: r.is_private, note: r.my_note || '', kind: r.kind })));
      })
      .catch(() => { if (alive) setMySents([]); });
    return () => { alive = false; };
  }, [bookId]);
  // 책 소개 — DB books.description 우선, 비면 알라딘 프록시 폴백 (#578, library.js BookDetailModal §5.8 패턴)
  useEffect(() => {
    if (!bk) { setDesc(''); setDescSource(''); return; }
    const dbDesc = (bk.description || '').trim();
    if (dbDesc) { setDesc(dbDesc); setDescSource(bk.source || ''); return; } // #642: DB 소개의 출처 표기
    let alive = true;
    const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
    const isbn = bk.isbn13 || bk.isbn || '';
    if (!proxy || !isbn) { setDesc(''); setDescSource(''); return; }
    fetch(`${proxy}?isbn=${encodeURIComponent(isbn)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!alive) return; const it = d && Array.isArray(d.items) && d.items[0]; setDesc((it && it.description) ? String(it.description).trim() : ''); setDescSource((it && it.source) || ''); }) // #642: 폴백 응답 source 동반
      .catch(() => { if (alive) { setDesc(''); setDescSource(''); } });
    return () => { alive = false; };
  }, [bk]);
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
            {/* 책 소개 (#578) — 왜 읽는지 보여 읽고 싶게. DB description 우선·알라딘 폴백, 없으면 섹션 생략. */}
            {desc && (
              <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <SectionLabel icon="intro"
                  trailing={descSource === 'llm' && <span title="AI가 작성한 소개예요 · 부정확할 수 있어요" style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ink-3)', background: 'var(--line)', borderRadius: 5, padding: '1px 6px', letterSpacing: 0.3 }}>AI</span>}>
                  책 소개
                </SectionLabel>
                <div style={{ ...RG_SECTION_CARD, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{decodeEntities(desc)}</div>
              </div>
            )}
            {/* 내 한 문장 (#610) — 읽은 책: 내가 남긴 문장 + 공용 SentenceActions(공개범위·좋아요·수정·삭제) */}
            {mySents.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <SectionLabel icon="mine">내 한 문장</SectionLabel>
                {mySents.map(s => (
                  <div key={s.id} style={{ background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }}>"{decodeEntities(s.text)}"</div>
                    {typeof s.page === 'number' && s.page > 0 ? <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>{s.page}p</div> : null}
                    <SentenceActions sentence={s} mine onRemoved={(rid) => setMySents(m => (m || []).filter(x => x.id !== rid))} />
                  </div>
                ))}
              </div>
            )}
            {/* 이 책의 인기 한 문장 Top5 (#594) — 짹 많은 순, 타인 공개 문장. 읽기 전용(짹 토글·대화 없음).
                게스트·비UUID·빈 결과면 섹션 생략. "왜 읽는지"의 사회적 맥락. */}
            {popular.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <SectionLabel icon="sentence">이 책의 한 문장</SectionLabel>
                {/* 한 문장 액션 계약 (#610·#641) — 타인 문장은 공용 SentenceCard 로 통일(좋아요 보장). 발견 맥락이라 noBlind. */}
                {popular.map(s => {
                  const u = s.user || {};
                  return (
                    <SentenceCard key={s.id} bookId={bk.id} noBlind
                      item={{ id: s.id, q: decodeEntities(s.text || ''), nick: u.handle ? '@' + u.handle : (u.display_name || '익명'), avatar: '🐦',
                              page: s.page, time: '', claps: s.clapCount || 0, bookId: bk.id, bookTitle: '', isMine: false }} />
                  );
                })}
              </div>
            )}
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
            {/* 찜 + 읽기 동선 (#578, #644) — 발견용 액션. 이미 내 책(읽는중/완독/중단)이면 숨겨
                홈/책장 상세 동선을 통일. 찜만 한 상태면 '읽고 싶어요'는 생략하고 '이 책 읽기'만 노출.
                서재 상태 조회 전(shelf===null)에는 깜빡임 방지를 위해 버튼을 그리지 않는다. */}
            {(shelf === 'none' || shelf === 'wish') && (
              <div style={{ display: 'flex', gap: 8, margin: '4px 0 0' }}>
                {shelf === 'none' && (
                  <button onClick={() => { if (window.RG_addBookToShelf) window.RG_addBookToShelf(bk, 'wish'); onClose(); }}
                    style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1.5px solid var(--brand)', background: 'var(--brand-tint)', color: 'var(--brand-3)', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{rgIcon('bookmark', 15)} 읽고 싶어요</button>
                )}
                <button className="submit-btn" style={{ flex: 1, margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => { if (window.RG_registerBook) { const tp = bk.total_pages || (parseInt(manualPages, 10) || 0); window.RG_registerBook({ ...bk, total_pages: tp }); } onClose(); }}>{rgIcon('book', 15)} 이 책 읽기</button>
              </div>
            )}
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
function SentenceCollectionModal({ onClose, initialFilter }) {
  const SentenceActions = window.SentenceActions; // sentence-card.js(이후 로드)에서 추출 (#761)
  const [mine, setMine] = useState(undefined);
  const [saved, setSaved] = useState([]);   // #608/#641: 좋아요한 타인 문장 — '좋아요' 필터 전용(전체/책별엔 미혼입)
  const [favIds, setFavIds] = useState(new Set());
  const [filter, setFilter] = useState(initialFilter || 'all'); // all | book | fav — 좋아요한 문장 진입 시 'fav' (#510)
  // 작성일자 표기 (#608) — created_at 은 number(localStorage)·ISO(Supabase) 모두 new Date 로 처리. 월/일만.
  const fmtWhen = (t) => { if (!t) return ''; const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); };
  useEffect(() => {
    let alive = true;
    const DS = window.DataStore || {}; // 활성 어댑터 — 게스트가 Supabase로 새던 400 수정 (QA ISSUE-004)
    Promise.all([
      Promise.resolve((DS.sentences && DS.sentences.listMine) ? DS.sentences.listMine() : []).catch(() => []),
      Promise.resolve((DS.claps && DS.claps.list) ? DS.claps.list() : []).catch(() => []),  // #641: 좋아요한 문장(구 bookmarks.list)
    ]).then(([sents, bms]) => {
      if (!alive) return;
      const mineList = (sents || []).map(s => ({
        id: s.id, text: s.text, page: s.page,
        bookTitle: (s.user_book && s.user_book.book && s.user_book.book.title) || '',
        bookId: (s.user_book && s.user_book.book_id) || s.book_id || '',
        author: (s.user_book && s.user_book.book && s.user_book.book.author) || '',
        note: s.my_note || '',   // 저장된 참새 대화 — 재오픈 시 이어보기(#418)
        kind: s.kind || 'quote',
        isPrivate: !!s.is_private,
        when: fmtWhen(s.created_at),   // #608: 작성일자
      }));
      // 좋아요(❤️)한 타인 문장 — claps 임베드 중 내 문장 목록에 없는 것. (#510→#641)
      // #608: '전체'·'책별'엔 내 문장만 보이도록 별도 보관 → '좋아요' 필터에서만 합친다.
      const mineIds = new Set(mineList.map(s => s.id));
      const savedExtra = (bms || []).filter(b => b && b.sentence && !mineIds.has(b.sentence_id)).map(b => {
        const se = b.sentence || {};
        const ub = se.user_book || {};
        return {
          id: b.sentence_id, text: se.text || '', page: se.page,
          bookTitle: (ub.book && ub.book.title) || se.bookTitle || '',
          bookId: ub.book_id || se.book_id || '',
          author: (ub.book && ub.book.author) || se.author || '',
          note: '', kind: se.kind || 'quote', isPrivate: false, saved: true,
          when: fmtWhen(se.created_at),   // #608: 작성일자
        };
      });
      setMine(mineList);
      setSaved(savedExtra);
      setFavIds(new Set((bms || []).map(b => b.sentence_id)));
    }).catch(() => { if (alive) { setMine([]); setSaved([]); } });
    return () => { alive = false; };
  }, []);
  const list = mine || [];
  // #608/#641: 좋아요 필터 풀 = 내 문장 + 좋아요한 타인 문장. 전체/책별은 내 문장(list)만.
  const favPool = list.concat(saved);
  const favCount = favPool.filter(s => favIds.has(s.id)).length;
  const filtered = filter === 'fav' ? favPool.filter(s => favIds.has(s.id)) : list;
  const byBook = {};
  if (filter === 'book') filtered.forEach(s => { const k = s.bookTitle || '기타'; (byBook[k] = byBook[k] || []).push(s); });
  const renderLine = (s) => (
    <div key={s.id} onClick={() => { if (window.RG_openCompanion) window.RG_openCompanion({ id: s.id, text: s.text, bookId: s.bookId, bookTitle: s.bookTitle, author: s.author, page: s.page, note: s.note || s.my_note || '', kind: s.kind }); }}
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 4 }}>
        {s.bookTitle ? s.bookTitle + ' · ' : ''}{s.page != null ? s.page + 'p' : ''}{s.when ? ' · ' + s.when : ''}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.5 }}>"{s.text}"</div>
      {/* 한 문장 액션 계약 (#610·#641) — 공용 SentenceActions: 내 문장=공개범위+좋아요+수정/삭제, 타인=좋아요 */}
      <SentenceActions sentence={s} mine={!s.saved} fav={favIds.has(s.id)}
        onRemoved={(rid) => { setMine(m => (m || []).filter(x => x.id !== rid)); setSaved(v => (v || []).filter(x => x.id !== rid)); }} />
    </div>
  );
  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="내 한 문장 모아보기">
        <div className="sheet-grip" />
        <button onClick={onClose} aria-label="닫기" style={{ position: 'absolute', top: 10, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', lineHeight: 1, zIndex: 2 }}>✕</button>
        <div style={{ padding: '8px 20px 20px', maxHeight: '74vh', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>내 한 문장</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              읽었음 {list.length}개 ·
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 10.5C6 10.5 1 7.5 1 4.5a2.5 2.5 0 0 1 5-0.5 2.5 2.5 0 0 1 5 .5c0 3-5 6-5 6z" fill="var(--brand)" stroke="var(--brand)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              좋아요 {favCount}개
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
            {[['all', '전체'], ['book', '책별'], ['fav', '좋아요']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ padding: '6px 14px', borderRadius: 999, border: filter === id ? 'none' : '1px solid var(--line)', background: filter === id ? 'var(--ink)' : 'transparent', color: filter === id ? '#fff' : 'var(--ink-2)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
          {mine === undefined ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20 }}>불러오는 중…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 20, lineHeight: 1.6 }}>
              {filter === 'fav' ? (
                <>아직 저장한 문장이 없어요 · 소셜 탭에서 마음에 드는 문장에 <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:'inline',verticalAlign:'middle'}}><path d="M6 10.5C6 10.5 1 7.5 1 4.5a2.5 2.5 0 0 1 5-0.5 2.5 2.5 0 0 1 5 .5c0 3-5 6-5 6z" fill="var(--brand)" stroke="var(--brand)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>를 눌러보세요</>
              ) : '아직 한 문장이 없어요'}
            </div>
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


/* ── TinderCards: 한 문장 스와이프 리뷰 (#186) ──
   책의 한 문장들을 카드로. 우=좋아요(claps 단일, #641)/좌=싫어요(넘김)/아래=유예(뒤로).
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
      if (card.id && DataStore.claps && DataStore.claps.toggle) Promise.resolve(DataStore.claps.toggle(card.id)).catch(() => {});  // #641: 우스와이프 = 단일 좋아요(claps)
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
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.3px' }}>독서 활동</div>
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
