/* =========================================================
   ReadingGo — sentence-card.js  (#761 모듈화: components.js에서 추출)
   SentenceCard + SentenceActions(한 문장 카드·액션 SSOT). components.js **이후** 로드
   (decodeEntities/SpoilerContext/isSentenceBlinded/showToast는 window 전역). 순수 이동.
   ========================================================= */

// loadBabel 파일별 eval 스코프 → 훅·공유유틸을 window에서 alias(옮긴 코드 무수정, #761).
const { useState, useEffect, useRef } = React;
const decodeEntities = window.decodeEntities, SpoilerContext = window.SpoilerContext, isSentenceBlinded = window.isSentenceBlinded, showToast = window.showToast;

/* ── SentenceCard ─────────────────────────────────────── */
function SentenceCard({ item, bookId, noBlind }) {
  // 실 피드(Supabase)면 item.id(UUID)·item.isMine·item.bookTitle 사용, 데모면 합성값 폴백.
  const sentenceId = item.id || `${bookId}:${item.page}:${item.nick}`;
  const isMine = (typeof item.isMine !== 'undefined') ? item.isMine : (item.nick === '@jerome' || item.nick === 'jerome');
  const canReact = !!item.id;  // 실 sentence(UUID)만 좋아요 가능 — 합성 id 는 uuid 컬럼 400 (architect L1)
  const [liked, setLiked] = useState(false);
  const initialLikedRef = React.useRef(false);
  // getBook 은 미스 시 RG_BOOKS[0](=사피엔스)로 폴백 → id 실제 일치 시에만 그 제목 사용(사피엔스 오표시 방지, #374 동일).
  const bk = getBook(bookId);
  const cardTitle = item.bookTitle || (bk && bk.id === bookId ? bk.title : '') || '';
  // optimistic likeCount: item.claps(피드 로드 시점) + 현재 상태 - 초기 상태 delta (#156)
  // #664: 하한 0 클램프 — item.claps(피드 카운트)가 기존 self-clap을 미반영할 때 해제 시 음수(-1) 표시되던 버그. SentenceActions(:633)와 동일 가드.
  const likeCount = Math.max(0, (item.claps || 0) + (liked ? 1 : 0) - (initialLikedRef.current ? 1 : 0));
  // #641: 자기 문장 좋아요 허용(저장 통일) — mine 도 liked 상태 로드.
  React.useEffect(() => {
    if (!canReact) return;
    Promise.resolve(DataStore.claps.isMine(sentenceId)).then(v => {
      setLiked(v);
      initialLikedRef.current = v;
    }).catch(() => {});
  }, [sentenceId]);
  const toggleLike = () => {
    if (!canReact) return;
    Promise.resolve(DataStore.claps.toggle(sentenceId)).then((isLiked) => {
      setLiked(isLiked);
      // 반응(engagement) XP — 새로 켤 때만, 일일 상한. 해제 시 차감 없음(v7).
      // #641: self-clap(자기 문장 저장)은 XP 비부여 — 타인 문장 좋아요만 engagement XP.
      if (isLiked && !isMine) {
        const xp = reactionXpFor(_rgReactToday);
        if (xp > 0) { _rgReactToday += 1; grantXp(xp, 'reaction'); }
      }
    }).catch(() => {});
  };
  const mineStyle = !canReact ? { opacity: 0.4, pointerEvents: 'none' } : undefined;
  // 스포일러 블라인드: 전역 토글(revealAll) 또는 카드별 탭 공개 시 해제 (§5.7.1).
  const revealAll = React.useContext(SpoilerContext);
  const [revealed, setRevealed] = useState(false);
  const blinded = !noBlind && !revealAll && !revealed && isSentenceBlinded(bookId, item.page);
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
        {/* #641: 좋아요(claps) 단일 — 구 저장 칩 제거, 자기 문장도 좋아요(저장) 가능 */}
        <span className={'chip' + (liked ? ' active' : '')} style={mineStyle} onClick={toggleLike}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 10.5C6 10.5 1 7.2 1 4a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1 5 0c0 3.2-5 6.5-5 6.5Z"
              fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
          {likeCount > 0 ? likeCount : '좋아요'}
        </span>
        {/* #650 A: 외부 공유 — 이미지 카드 + Web Share/텍스트 폴백 (share-card.js) */}
        {window.shareSentence ? (
          <span className="chip" onClick={() => window.shareSentence({ id: item.id, text: item.q, bookId: bookId, bookTitle: cardTitle, author: item.author, page: item.page, kind: item.kind })}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1.5l2.5 2.5L8 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 4H5C3.3 4 2 5.3 2 7v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            공유
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ── UserProfileModal: 타인 프로필 — 전체 페이지 (§5.8.2, #3/#4/#5) ──
   핸들 탭 → 풀스크린 프로필: 책장(6권+더보기+읽은/읽는중 필터) + 공개 한 문장.
   책 탭 → 그 사람의 그 책 평점·후기·한 문장 드릴다운. */

/* ── SentenceActions: 한 문장 액션 row (#610 계약 SSOT, #641 단일화) ──────────
   내 문장(mine): 공개범위 + 좋아요(=저장) + 수정 + 삭제 · 타인 문장: 좋아요.
   #641: 짹+저장(구 bookmark) → 단일 좋아요(claps). 자기 문장 좋아요 허용(저장 통일).
   표면별 버튼 드리프트 방지를 위한 공용 단일 출처. align_v7 invariant 로 락.
   props: sentence{id,text,bookId,bookTitle,author,page,note,visibility,isPrivate}, mine, fav(좋아요 초기상태), onRemoved */
const _SA_VIS = ['public', 'followers', 'private'];
const _SA_VIS_ICON = {
  public: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/><ellipse cx="6" cy="6" rx="2.5" ry="5" stroke="currentColor" strokeWidth="1.2"/><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2"/></svg>,
  followers: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M1 10c0-2 1.5-3 3.5-3s3.5 1 3.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="9" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/><path d="M8 10c0-1.5.8-2.5 2-2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>,
  private: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
};
const _SA_VIS_LABEL = { public: '전체공개', followers: '친구공개', private: '나만 보기' };
function SentenceActions({ sentence, mine, fav: favInit, onRemoved, onUpdated }) {
  const id = sentence && sentence.id;
  const [vis, setVis] = useState(sentence.visibility || (sentence.isPrivate ? 'private' : 'public'));
  const [liked, setLiked] = useState(!!favInit);
  const [likeN, setLikeN] = useState(sentence.claps || sentence.clapCount || 0);
  // #683: 수정 = 문장 본문 + 페이지 인라인 편집. (이전엔 잘못 동반자 대화 모달로 연결됨.)
  const [editing, setEditing] = useState(false);
  const [dText, setDText] = useState(sentence.text || '');
  const [dPage, setDPage] = useState(sentence.page == null ? '' : String(sentence.page));
  const [saving, setSaving] = useState(false);
  // #641: mine 포함 좋아요 초기 상태 로드(자기 문장도 좋아요=저장 가능).
  useEffect(() => {
    if (!id || !(DataStore.claps && DataStore.claps.isMine)) return;
    let alive = true;
    Promise.resolve(DataStore.claps.isMine(id)).then(v => { if (alive) setLiked(!!v); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  if (!id) return null;
  const stop = (e) => { if (e && e.stopPropagation) e.stopPropagation(); };
  const chip = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: 'var(--ink-2)', padding: '3px 9px', lineHeight: 1 };
  const chipOn = { ...chip, background: 'var(--brand-tint)', borderColor: 'var(--brand)', color: 'var(--brand-3)' };
  const _visChip = {
    public:    { ...chip, background: 'rgba(63,209,127,0.1)', borderColor: 'rgba(63,209,127,0.4)', color: '#1a9e5a' },
    followers: { ...chip, background: 'rgba(88,130,255,0.1)', borderColor: 'rgba(88,130,255,0.4)', color: '#3a5fcc' },
    private:   { ...chip, background: 'rgba(120,120,130,0.1)', borderColor: 'rgba(120,120,130,0.35)', color: 'var(--ink-3)' },
  };
  const cycleVis = (e) => { stop(e); if (!(DataStore.sentences && DataStore.sentences.setVisibility)) return; const next = _SA_VIS[(_SA_VIS.indexOf(vis) + 1) % _SA_VIS.length]; setVis(next); sentence.visibility = next; Promise.resolve(DataStore.sentences.setVisibility(id, { visibility: next })).catch(() => {}); window.dispatchEvent(new CustomEvent('rg:sentence-vis', { detail: { id, visibility: next } })); };
  // #683: 수정 = 인라인 편집 폼 열기 (동반자 대화 모달 X). 드래프트를 현재 값으로 리셋 후 진입.
  const edit = (e) => { stop(e); setDText(sentence.text || ''); setDPage(sentence.page == null ? '' : String(sentence.page)); setEditing(true); };
  const cancelEdit = (e) => { stop(e); setEditing(false); };
  const saveEdit = (e) => {
    stop(e);
    const text = (dText || '').trim();
    if (!text) { showToast('문장 내용을 입력해 주세요'); return; }
    const pageRaw = (dPage || '').trim();
    const page = pageRaw === '' ? null : parseInt(pageRaw, 10);
    if (pageRaw !== '' && (!isFinite(page) || page < 0)) { showToast('페이지 번호를 확인해 주세요'); return; }
    if (!(DataStore.sentences && DataStore.sentences.updateText)) { setEditing(false); return; }
    setSaving(true);
    const ops = [Promise.resolve(DataStore.sentences.updateText(id, text))];
    if (DataStore.sentences.setPage) ops.push(Promise.resolve(DataStore.sentences.setPage(id, page)));
    Promise.all(ops).then(() => {
      sentence.text = text; sentence.page = page;   // 카드 즉시 정합
      setEditing(false); setSaving(false);
      if (onUpdated) onUpdated({ id, text, page });
      window.dispatchEvent(new CustomEvent('rg:sentence-updated', { detail: { id, text, page } }));
      showToast('✏️ 한 문장을 수정했어요');
    }).catch(() => { setSaving(false); showToast('수정 실패 — 잠시 후 다시'); });
  };
  const del = (e) => { stop(e); if (!(DataStore.sentences && DataStore.sentences.remove)) return; if (!window.confirm('이 한 문장을 삭제할까요? 되돌릴 수 없어요.')) return; Promise.resolve(DataStore.sentences.remove(id)).then(() => { if (onRemoved) onRemoved(id); window.dispatchEvent(new CustomEvent('rg:sentence-removed', { detail: { id } })); showToast('🗑 한 문장을 삭제했어요'); }).catch(() => showToast('삭제 실패 — 잠시 후 다시')); };
  const toggleLike = (e) => { stop(e); if (!(DataStore.claps && DataStore.claps.toggle)) return; Promise.resolve(DataStore.claps.toggle(id)).then((on) => { setLiked(on); setLikeN(n => Math.max(0, n + (on ? 1 : -1))); }).catch(() => {}); };
  const likeBtn = <button onClick={toggleLike} title="좋아요" style={liked ? chipOn : chip}>
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 10.5C6 10.5 1 7.5 1 4.5a2.5 2.5 0 0 1 5-0.5 2.5 2.5 0 0 1 5 .5c0 3-5 6-5 6z" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    {likeN > 0 ? likeN : '좋아요'}
  </button>;
  // #650 A: 외부 공유 — 이미지 카드(html-to-image) + Web Share/텍스트 폴백. share-card.js.
  const share = (e) => { stop(e); if (window.shareSentence) window.shareSentence({ id, text: sentence.text, bookId: sentence.bookId, bookTitle: sentence.bookTitle, author: sentence.author, page: sentence.page, note: sentence.note, kind: sentence.kind }); };
  const shareBtn = window.shareSentence ? <button onClick={share} title="외부 공유 (이미지 카드)" style={chip}>
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 7.5v3H1.5v-7H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 1.5h3.5v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="10.5" y1="1.5" x2="5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
    공유
  </button> : null;
  // #683: 인라인 편집 폼 — 문장 본문(textarea) + 페이지(number). 저장은 DataStore 계약 경유.
  const inputBase = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--card)', color: 'var(--ink)', fontSize: 13, padding: '8px 10px', fontFamily: 'inherit' };
  const btnBase = { ...chip, padding: '6px 14px', fontSize: 12 };
  if (mine && editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }} onClick={stop}>
        <textarea value={dText} onChange={(e) => setDText(e.target.value)} rows={3} placeholder="문장 내용" style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>페이지</label>
          <input type="number" min="0" inputMode="numeric" value={dPage} onChange={(e) => setDPage(e.target.value)} placeholder="미상" style={{ ...inputBase, width: 110 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={cancelEdit} disabled={saving} style={btnBase}>취소</button>
          <button onClick={saveEdit} disabled={saving} style={{ ...btnBase, background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff', opacity: saving ? 0.6 : 1 }}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }} onClick={stop}>
      {mine ? (
        <>
          <button onClick={cycleVis} title="공개 범위 변경 (전체→친구→나만 보기)" style={_visChip[vis]}><span>{_SA_VIS_ICON[vis]}</span><span>{_SA_VIS_LABEL[vis]}</span></button>
          {likeBtn}
          {shareBtn}
          <button onClick={edit} title="수정 (문장·페이지)" style={chip}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 2l2 2-7 7H2v-2L9 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={del} title="삭제" style={chip}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4h9M5 4V2.5h3V4M5.5 6v4M7.5 6v4M3 4l.7 7h5.6L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </>
      ) : (
        <>
          {likeBtn}
          {shareBtn}
        </>
      )}
    </div>
  );
}

/* ── QuoteCard (통일): '내 한 문장' 카드 단일 렌더. 홈(nest)·책장(library) 공용 —
   생각(말풍선 SVG)·날짜('오늘'/YYYY-MM-DD)·메타·인용(이탤릭) 렌더를 한 곳으로(불일치 제거).
   variant 로 동작만 분기: 'home'=인라인 액션(SentenceActions)+전체 텍스트, 'library'=카드 탭→책상세+3줄 줄임. ── */
function _rgQuoteDate(q) {
  if (q && q.when === '방금') return '오늘';
  const v = (q && (q.createdAt || q.when)) || '';
  if (!v) return '';
  const s = String(v).trim();
  let d;
  if (/^\d+$/.test(s)) { const n = Number(s); d = new Date(n > 1e13 ? n / 1000 : n > 1e10 ? n : n * 1000); } // µs→ms·ms·s→ms
  else { d = new Date(s); }
  if (isNaN(d.getTime())) return (q && q.when) || '';
  const t = new Date();
  if (d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()) return '오늘';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const _RG_THOUGHT_ICO = (
  <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginRight: 5 }}>
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="6.5" cy="5.5" rx="5.5" ry="4" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" />
      <circle cx="4" cy="10.5" r="1" fill="var(--ink-2)" />
      <circle cx="2" cy="12.5" r="0.6" fill="var(--ink-3)" />
    </svg>
  </span>
);
function QuoteCard({ q, variant, onOpenBook, children }) {
  const isThought = q.kind === 'thought';
  const isLib = variant === 'library';
  const getB = window.getBook;
  const _bk = typeof getB === 'function' ? getB(q.bookId) : null;
  // getBook 은 미스 시 폴백 책을 주므로 id 가 실제 일치할 때만 그 제목 사용(사피엔스버그 가드).
  const bkTitle = q.bookTitle || (_bk && (_bk.id === q.bookId || _bk.book_id === q.bookId) ? _bk.title : '') || '책';
  const dateText = _rgQuoteDate(q);
  const hasPage = typeof q.page === 'number' && q.page > 0;
  const quoteStyle = {
    fontStyle: isThought ? 'normal' : 'italic',
    ...(isLib ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', maxHeight: '4.65em' } : null),
  };
  const clickable = isLib && typeof onOpenBook === 'function';
  return (
    <div className="my-q-card" onClick={clickable ? () => onOpenBook(q.bookId) : undefined} style={clickable ? { cursor: 'pointer' } : undefined}>
      <div className="meta">
        {isLib && (<><span className="kind">{isThought ? '💭내생각' : '📖책속'}</span><span className="dot">·</span></>)}
        <span className="bk" style={isLib ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 } : undefined}>{bkTitle}</span>
        {hasPage && (<><span className="dot">·</span><span>{q.page}p</span></>)}
        {dateText && (<><span className="dot">·</span><span>{dateText}</span></>)}
      </div>
      <div className="quote" style={quoteStyle}>
        {isThought ? <>{_RG_THOUGHT_ICO}{q.text}</> : `"${q.text}"`}
      </div>
      {children}
    </div>
  );
}

window.SentenceCard = SentenceCard;
window.SentenceActions = SentenceActions;
window.QuoteCard = QuoteCard;
