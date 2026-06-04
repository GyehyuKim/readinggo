/* =========================================================
   ReadingGo — components.js
   공용 UI 컴포넌트: Toast, SentenceCard, Confetti
   ========================================================= */
const { useState, useEffect, useRef, useCallback } = React;

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
  const [bookmarked, setBookmarked] = useState(false);
  const bk = getBook(bookId);
  const cardTitle = item.bookTitle || (bk && bk.title) || '';
  const likeCount = (item.claps || 0) + (liked ? 1 : 0);
  // 짹/책갈피 토글 — 양 어댑터(동기 boolean / 비동기 Promise<boolean>) 정규화.
  // 토글이 곧 취소(다시 누르면 해제) — claps.toggle 이 존재 시 delete (#156).
  const toggleLike = () => {
    if (isMine || !canReact) return;
    Promise.resolve(DataStore.claps.toggle(sentenceId)).then(setLiked).catch(() => {});
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
        <div className="meta">{cardTitle ? cardTitle + ' · ' : ''}{item.page}p · {item.time}</div>
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

/* ── UserProfileModal: 타인 프로필 (전체 공개, §5.8.2) ──
   핸들 탭 → 해당 사용자 공개 완독 책장 + 공개 한 문장. RLS select using(true). */
function UserProfileModal({ handle, onClose }) {
  const [data, setData] = useState(undefined); // undefined=로딩, null=없음
  const [revealed, setRevealed] = useState({}); // 스포일러 카드별 탭 공개 (§5.7.1)
  const [following, setFollowing] = useState(null); // null=자기자신/미상, true/false=팔로우 상태 (#7)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const DS = window.SupabaseDataStore;
        if (!DS || !DS.users || !DS.users.getByHandle) { if (alive) setData(null); return; }
        const u = await DS.users.getByHandle(handle);
        if (!u) { if (alive) setData(null); return; }
        const [books, sents] = await Promise.all([
          DS.users.publicBooks(u.id).catch(() => []),
          DS.users.publicSentences(u.id).catch(() => []),
        ]);
        if (alive) setData({ user: u, books: books || [], sents: sents || [] });
        const myId = window.RG_ME && window.RG_ME.id;
        if (myId && u.id !== myId && DS.friends && DS.friends.isFollowing) {
          const f = await DS.friends.isFollowing(u.id).catch(() => false);
          if (alive) setFollowing(!!f);
        }
      } catch (e) { if (alive) setData(null); }
    })();
    return () => { alive = false; };
  }, [handle]);
  const toggleFollow = () => {
    const DS = window.SupabaseDataStore;
    if (!data || !data.user || !(DS && DS.friends)) return;
    const target = data.user.id;
    const p = following ? DS.friends.unfollow(target) : DS.friends.follow(target);
    Promise.resolve(p).then(() => setFollowing(!following)).catch(() => {});
  };

  return (
    <div className="modal-backdrop show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label={handle}>
        <div className="sheet-grip" />
        {data === undefined ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>불러오는 중…</div>
        ) : data === null ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>프로필을 찾을 수 없어요</div>
        ) : (
          <div style={{ padding: '8px 20px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)' }}>🐦 {data.user.display_name || data.user.handle}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 700 }}>@{data.user.handle} · 완독 {data.books.length}권</div>
              {following !== null && (
                <button onClick={toggleFollow}
                  style={{ marginTop: 10, padding: '8px 22px', borderRadius: 20, border: following ? '1.5px solid var(--line)' : 'none', background: following ? 'transparent' : 'var(--brand)', color: following ? 'var(--ink-2)' : '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                  {following ? '팔로잉 ✓' : '+ 팔로우'}
                </button>
              )}
              {data.user.bio && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{data.user.bio}</div>}
            </div>
            {data.books.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>🏰 완독 책장</div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                  {data.books.map((ub) => (
                    <div key={ub.id} style={{ flex: '0 0 auto', width: 80 }}>
                      <div style={{ width: 80, height: 112, borderRadius: 6, overflow: 'hidden', background: 'var(--line)', marginBottom: 4 }}>
                        {ub.book && ub.book.cover_url && <img src={ub.book.cover_url} alt={ub.book.title} loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ub.book && ub.book.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>📖 공개 한 문장 {data.sents.length}개</div>
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
    </div>
  );
}

/* ── SettingsModal: 설정 (프로필 ⚙️ 진입, §5.8) ──
   스포일러 전역 토글(여기로 이전) + 닉네임 변경 + 로그아웃. */
function SettingsModal({ onClose, spoilerReveal, setSpoilerReveal }) {
  const me = window.RG_ME || {};
  const V = window.RG_VALIDATE || {};
  const [nick, setNick] = useState(me.displayName || me.handle || '');
  const [busy, setBusy] = useState(false);
  const [nmsg, setNmsg] = useState('');
  const [hdl, setHdl] = useState(me.handle || '');
  const [hbusy, setHbusy] = useState(false);
  const [hmsg, setHmsg] = useState('');
  const saveNick = () => {
    if (busy) return;
    const r = V.displayName ? V.displayName(nick) : { ok: true, value: (nick || '').trim() };
    if (!r.ok) { setNmsg(r.msg); return; }
    setBusy(true); setNmsg('');
    Promise.resolve((DataStore.profile && DataStore.profile.update) ? DataStore.profile.update({ display_name: r.value }) : null)
      .then(() => { if (window.RG_ME) window.RG_ME.displayName = r.value; setNmsg('✓ 저장됨'); showToast('표시 이름 저장됨'); })
      .catch(() => setNmsg('저장 실패'))
      .finally(() => setBusy(false));
  };
  const saveHandle = async () => {
    if (hbusy) return;
    const r = V.handle ? V.handle(hdl) : { ok: true, value: (hdl || '').replace(/^@/, '').trim() };
    if (!r.ok) { setHmsg(r.msg); return; }
    if (r.value === (me.handle || '')) { setHmsg('현재 아이디예요'); return; }
    setHbusy(true); setHmsg('확인 중…');
    try {
      const ok = (DataStore.users && DataStore.users.isHandleAvailable)
        ? await Promise.resolve(DataStore.users.isHandleAvailable(r.value)) : true;
      if (!ok) { setHmsg('이미 사용 중인 아이디예요'); return; }
      if (DataStore.profile && DataStore.profile.update) await Promise.resolve(DataStore.profile.update({ handle: r.value }));
      if (window.RG_ME) window.RG_ME.handle = r.value;
      setHmsg('✓ 저장됨'); showToast('아이디 저장됨 — 새로고침하면 피드에 반영돼요');
    } catch (e) { setHmsg('이미 사용 중이거나 저장 실패'); }
    finally { setHbusy(false); }
  };
  const logout = () => {
    if (window.RG_SB && window.RG_SB.signOut) {
      Promise.resolve(window.RG_SB.signOut()).finally(() => window.location.reload());
    }
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
          {/* 표시 이름(display_name) — 프로필에 크게 보이는 이름(중복 허용) */}
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>표시 이름</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>프로필 상단에 크게 보이는 이름이에요.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nick} maxLength={40} onChange={e => { setNick(e.target.value); setNmsg(''); }} placeholder="표시 이름 (최대 40자)"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, outline: 'none' }} />
              <button onClick={saveNick} disabled={busy} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>저장</button>
            </div>
            {nmsg && <div style={{ fontSize: 12, color: nmsg.indexOf('✓') === 0 ? 'var(--brand)' : '#d33', marginTop: 6 }}>{nmsg}</div>}
          </div>
          {/* 아이디(@handle) — 피드·프로필에 표시되는 고유 닉네임, 중복 불가 */}
          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>아이디 (@)</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>피드·프로필에 <b>@아이디</b>로 표시돼요. 다른 사람과 겹칠 수 없어요.</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 800 }}>@</span>
              <input value={hdl} maxLength={20} onChange={e => { setHdl(e.target.value); setHmsg(''); }} placeholder="myname"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, outline: 'none' }} />
              <button onClick={saveHandle} disabled={hbusy} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: hbusy ? 'default' : 'pointer', opacity: hbusy ? 0.6 : 1 }}>저장</button>
            </div>
            {hmsg && <div style={{ fontSize: 12, color: hmsg.indexOf('✓') === 0 ? 'var(--brand)' : '#d33', marginTop: 6 }}>{hmsg}</div>}
          </div>
          {/* 로그아웃 */}
          <button onClick={logout} style={{ marginTop: 18, width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}

window.showToast = showToast;
window.Toast = Toast;
window.Confetti = Confetti;
window.SentenceCard = SentenceCard;
window.SpoilerContext = SpoilerContext;
window.isSentenceBlinded = isSentenceBlinded;
window.UserProfileModal = UserProfileModal;
window.SettingsModal = SettingsModal;
