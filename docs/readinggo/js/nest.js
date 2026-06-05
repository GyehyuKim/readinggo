/* =========================================================
   ReadingGo — nest.js
   둥지 탭: 책 카드, NestTheatre, 체크인 CTA,
            내 한 문장, 같은 책 피드, CheckinModal, Ceremony
   ========================================================= */
const { useState: _useState, useEffect: _useEffect, useRef: _useRef, useMemo: _useMemo } = React;

/* ── CheckinModal ─────────────────────────────────────── */
function CheckinModal({ book, onClose, onSubmit }) {
  const [page, setPage] = _useState(book.cur);
  const [sentence, setSentence] = _useState('');

  const _maxPage = book.total > 0 ? book.total : 99999; // 쪽수 미상이면 상한 없음 (#204)
  const adjustPage = (delta) => {
    setPage(p => Math.max(0, Math.min(_maxPage, p + delta)));
  };
  const handleInput = (e) => {
    let v = parseInt(e.target.value, 10);
    if (isNaN(v)) v = 0;
    setPage(Math.max(0, Math.min(_maxPage, v)));
  };
  const handleSentence = (e) => {
    if (e.target.value.length <= 1000) setSentence(e.target.value);
  };
  const handleSubmit = () => {
    if (page === book.cur && sentence.trim().length === 0) {
      showToast('한 쪽도 OK! +1만 눌러봐요 🐦');
      return;
    }
    onSubmit({ page, sentence: sentence.trim() });
  };

  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-label="오늘의 체크인">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>오늘의 짹 🐦</h2>
          <div className="sub">한 쪽도 충분해요. 어디까지 읽으셨어요?</div>
        </div>

        <div className="sheet-section">
          <div className="label">📖 어디까지 읽었어요?</div>
          <div className="page-input">
            <button className="page-btn" onClick={() => adjustPage(-1)}>−1</button>
            <div className="page-num">
              <span>{page}</span>
              <span style={{fontSize:13, color:'var(--ink-3)', fontWeight:800}}>p</span>
            </div>
            <button className="page-btn" onClick={() => adjustPage(1)}>+1</button>
            <button
              className="page-btn"
              style={{borderBottomColor:'var(--brand-shadow)', background:'var(--brand-tint)', color:'var(--brand-3)'}}
              onClick={() => adjustPage(10)}
            >+10</button>
          </div>
          <div className="page-direct">
            직접 입력{' '}
            <input type="number" min="0" max="9999" value={page} onChange={handleInput} />
            <span className="page-totalmark">{book.total > 0 ? '전체 ' + book.total + 'p' : '쪽수 미상'}</span>
          </div>
        </div>

        <div className="sheet-section">
          <div className="label">✏️ 오늘의 한 문장 <small style={{color:'var(--ink-3)', fontWeight:700}}>(선택)</small></div>
          <textarea
            className="sentence-area"
            placeholder="오늘 마음에 들어온 한 문장을 그대로 옮겨 적어보세요."
            value={sentence}
            onChange={handleSentence}
          />
          <div className="sentence-counter" style={{display:'flex', justifyContent:'space-between'}}>
            <span style={{color:'var(--ink-3)', fontWeight:700}}>📍 {page}p 의 문장으로 기록돼요</span>
            <span>{sentence.length} / 1000</span>
          </div>
        </div>

        <button className="submit-btn" onClick={handleSubmit}>✨ 짹 등록하기</button>
        <div className="helper" style={{textAlign:'center'}}>
          한 쪽만 읽어도 출석은 인정됩니다. 끊기는 게 더 어려워요!
        </div>
      </div>
    </div>
  );
}

/* ── Ceremony ─────────────────────────────────────────── */
function Ceremony({ data, onClose, onComplete }) {
  const [rating, setRating] = _useState(0);
  const [reviewText, setReviewText] = _useState('');
  if (!data) return null;
  const { xpGain, xpParts, streak, sentence, nestUp, prevLv, newLv, pagesAdded, isNewDay, wasReset, isComplete } = data;
  let leadText;
  if (!isNewDay && !wasReset) {
    leadText = `+${pagesAdded}쪽 추가 기록 · 오늘은 이미 짹 완료 🐦`;
  } else if (wasReset) {
    leadText = `+${pagesAdded}쪽 · ${streak}일 — 다시 시작이에요!`;
  } else {
    leadText = `+${pagesAdded}쪽 읽었어요 · ${streak}일 연속!`;
  }
  const prevStage = nestUp ? NEST_STAGES[prevLv - 1] : null;
  const nowStage  = nestUp ? NEST_STAGES[newLv  - 1] : null;
  return (
    <div className="ceremony show">
      <div className="inner">
        <h2>오늘도 짹! 🐦</h2>
        <div className="lead">{leadText}</div>
        <div className="reward-grid">
          <div className="reward-card brand">
            <span className="ico">⭐</span>
            <div className="val">+{xpGain}</div>
            <div className="lbl">XP</div>
          </div>
          <div className="reward-card fire">
            <span className="ico">🔥</span>
            <div className="val">{streak}일</div>
            <div className="lbl">STREAK</div>
          </div>
          <div className="reward-card gold">
            <span className="ico">🔖</span>
            <div className="val">저장됨</div>
            <div className="lbl">한 문장</div>
          </div>
        </div>

        {xpParts && xpParts.length > 1 && (
          <div className="xp-breakdown">
            {xpParts.map(p => (
              <span key={p.key} className="xp-part">
                <span className="ico">{p.ico}</span>
                {p.label} <b>+{p.xp}</b>
              </span>
            ))}
          </div>
        )}

        {sentence && (
          <div className="saved-quote">
            <span className="label">오늘의 한 문장</span>
            "{sentence}"
          </div>
        )}

        {nestUp && prevStage && nowStage && (
          <div className="nest-up">
            <span className="em">{nowStage.short}</span>
            <div className="text">
              둥지가 진화했어요!
              <small>{prevStage.short} {prevStage.name} → {nowStage.short} {nowStage.name}</small>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="complete-review">
            <div className="complete-head">🏰 완독을 축하해요! 이 책, 어땠나요?</div>
            {/* 반별점 0.5 (#153): 별 우측 절반 탭=정수, 좌측 절반 탭=0.5 */}
            <div className="rating-stars" role="radiogroup" aria-label="별점 (0.5 단위, 선택)" style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map(n => {
                const fillPct = Math.max(0, Math.min(1, rating - (n - 1))) * 100; // 이 별 채움 0/50/100%
                return (
                  <span key={n} style={{ position: 'relative', display: 'inline-block', width: 30, height: 30, fontSize: 28, lineHeight: '30px' }} aria-label={`${n}점`}>
                    <span style={{ color: 'var(--line-2, #d0d4da)' }}>★</span>
                    <span style={{ position: 'absolute', left: 0, top: 0, width: fillPct + '%', overflow: 'hidden', color: '#FFC233' }}>★</span>
                    <button type="button" aria-label={`${n - 0.5}점`} onClick={() => setRating(rating === n - 0.5 ? 0 : n - 0.5)}
                      style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} />
                    <button type="button" aria-label={`${n}점`} onClick={() => setRating(rating === n ? 0 : n)}
                      style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} />
                  </span>
                );
              })}
              <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 800, color: 'var(--ink-2)', alignSelf: 'center' }}>{rating > 0 ? rating.toFixed(1) : ''}</span>
            </div>
            <textarea
              className="review-area"
              placeholder="완독 소감을 한 줄 남겨보세요. (선택)"
              value={reviewText}
              maxLength={300}
              onChange={e => setReviewText(e.target.value)}
            />
          </div>
        )}

        <button
          className="next-btn"
          onClick={() => {
            if (isComplete && onComplete) {
              onComplete({ rating: rating || null, review_text: reviewText.trim() || null });
            }
            onClose();
          }}
        >
          {isComplete ? '성에 기록 남기기 →' : '내일도 짹 →'}
        </button>
      </div>
    </div>
  );
}

/* ── NestTheatre — 활성 책 진척률 5단계 (§5.2) ──────────── */
// 진척률 단계별 격려 카피 (health 무관, 이 책 진도만 반영).
function stageMicrocopy(pct, stage) {
  if (pct >= 100) return `🏰 ${stage.name} — 완독! 성이 컬렉션에 남았어요.`;
  if (pct >= 81)  return `🏡 ${stage.name} — 곧 완독이에요. 마지막 장까지 함께해요.`;
  if (pct >= 51)  return `🏠 ${stage.name} — 둥지가 따뜻해졌어요. 오늘도 한 쪽 더!`;
  if (pct >= 21)  return `🪹 ${stage.name} — 둥지가 모양을 갖춰가요. 계속 쌓아봐요.`;
  return `🪵 ${stage.name} — 첫 가지를 놓았어요. 한 쪽이면 둥지가 자라요.`;
}

function NestTheatre({ progressPct, streak, prevTwigs }) {
  const pct = Math.max(0, Math.min(100, Math.round(progressPct)));
  const stage = getNestStage(pct);
  const { cur, next } = nestInfo(stage.lv);
  const twigs = twigsForProgress(pct);
  const nestSvg = _useMemo(
    () => drawNest(twigs, stage.lv, prevTwigs),
    [twigs, stage.lv, prevTwigs]
  );

  return (
    <div
      className="nest-theatre h-strong"
      style={{'--health': pct, '--decay': 0, '--stage-color': stage.color, background: stage.bg}}
    >
      <div className="nest-stagebar">
        <span className="nest-stage-pill">
          <span className="lv">LV.{cur.lv}</span>
          <span>{cur.short} {cur.name}</span>
        </span>
        <span className="nest-day-chip">🔥 {streak}일</span>
      </div>

      <div className="nest-svg-wrap">
        <div dangerouslySetInnerHTML={{ __html: nestSvg }} />
      </div>

      <div className="nest-meta">
        <div className="nest-name-row">
          <div className="nest-name">
            <span>{cur.short} {cur.name}</span>
            {next && (
              <span className="next-arrow">→ {next.short} {next.name}</span>
            )}
          </div>
          <div className="nest-health-num">진척 <b>{pct}</b>%</div>
        </div>
        <div className="nest-health-bar">
          <div className="nest-health-fill" />
        </div>
        <div className="nest-microcopy">
          {stageMicrocopy(pct, stage)}
        </div>
      </div>
    </div>
  );
}

/* ── NestView ─────────────────────────────────────────── */
/* ── ReadingMode: 읽기 모드 (#184) — 독서 타이머 + 상시 한 문장 입력 ──
   둥지에서 활성 책으로 진입. 북모리식 몰입 캡처: 타이머가 도는 동안
   입력칸이 항상 열려 있어 떠오른 한 문장을 즉시 아카이브한다. */
function ReadingMode({ book, onClose, onArchive, onChecked }) {
  const [secs, setSecs] = _useState(0);
  const [running, setRunning] = _useState(true);
  const [page, setPage] = _useState(String(book.cur || 0)); // 문자열 — 빈칸 허용(페이지 미상)
  const [text, setText] = _useState('');
  const [saved, setSaved] = _useState([]);
  const [closing, setClosing] = _useState(false);            // 종료 확인 단계
  const [finalPage, setFinalPage] = _useState(String(book.cur || 0));
  const ubRef = _useRef(null);
  const total = book.total || 0;
  _useEffect(() => {
    Promise.resolve(DataStore.activeBook.get()).then((ub) => { if (ub) ubRef.current = ub.id; }).catch(() => {});
  }, []);
  _useEffect(() => {
    if (!running || closing) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    const onVis = () => { if (document.hidden) setRunning(false); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [running, closing]);
  const fmt = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h > 0 ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  };
  const pageNum = (s) => { const n = parseInt(s, 10); return isNaN(n) ? null : Math.max(0, total ? Math.min(total, n) : n); };
  const bump = (d) => setPage((s) => String(Math.max(0, (parseInt(s, 10) || 0) + d)));
  const save = () => {
    const t = text.trim();
    if (!t) { showToast('한 문장을 적어주세요'); return; }
    const p = pageNum(page); // 비어있으면 null(페이지 없이 저장)
    const ubId = ubRef.current;
    Promise.resolve(DataStore.sentences.add({ userBookId: ubId, page: p, text: t })).then(() => {
      setSaved((list) => [{ text: t, page: p }, ...list]);
      setText('');
      showToast(p != null ? ('📍 ' + p + 'p 한 문장 저장됨') : '한 문장 저장됨');
      if (onArchive) onArchive({ text: t, bookId: book.id, page: p, when: '방금' });
    }).catch(() => showToast('저장 실패 — 다시 시도'));
  };
  // 독서 종료: 최종 읽은 쪽 확인 → 진도/스트릭 반영(체크인) → 닫기. 미입력 시 마지막 페이지 유지.
  const finish = () => {
    const fp = pageNum(finalPage);
    const ubId = ubRef.current;
    const done = () => { showToast('📖 ' + fmt(secs) + ' 독서 완료' + (fp != null ? ' · ' + fp + 'p' : '')); if (onChecked) onChecked(); onClose(); };
    if (DataStore.sessions && DataStore.sessions.addToday) {
      Promise.resolve(DataStore.sessions.addToday({ userBookId: ubId, page: fp != null ? fp : (book.cur || 0) })).then(done).catch(done);
    } else done();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1A1C20', color: '#F4F2EC', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => setRunning((r) => !r)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#F4F2EC', borderRadius: 16, padding: '6px 12px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{running ? '⏸' : '▶'}</button>
        <div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>⏱ {fmt(secs)}</div>
        <button onClick={() => { setFinalPage(page); setClosing(true); }} style={{ background: 'var(--brand)', border: 'none', color: '#fff', borderRadius: 16, padding: '6px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>독서 종료</button>
      </div>
      <div style={{ padding: '20px 18px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 900 }}>{book.title}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{book.author}</div>
      </div>
      {/* 상시 입력칸 */}
      <div style={{ padding: '8px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, justifyContent: 'center' }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>📍 이 문장 페이지</span>
          <button onClick={() => bump(-1)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#F4F2EC', fontSize: 18, cursor: 'pointer' }}>−</button>
          <input type="number" inputMode="numeric" value={page} placeholder="—" onChange={(e) => setPage(e.target.value)} onBlur={() => setPage((s) => s === '' ? '' : String(pageNum(s) ?? ''))} style={{ width: 60, textAlign: 'center', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#F4F2EC', fontSize: 15, fontWeight: 800, padding: '6px 0' }} />
          <button onClick={() => bump(1)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#F4F2EC', fontSize: 18, cursor: 'pointer' }}>+</button>
          {total > 0 && <span style={{ fontSize: 11, opacity: 0.5 }}>/ {total}p</span>}
        </div>
        <textarea value={text} onChange={(e) => { if (e.target.value.length <= 1000) setText(e.target.value); }} placeholder="떠오른 한 문장을 바로 옮겨 적어요…" rows={3}
          style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#F4F2EC', fontSize: 15, lineHeight: 1.6, padding: 12, resize: 'none', boxSizing: 'border-box' }} />
        <button onClick={save} style={{ width: '100%', marginTop: 8, padding: 14, borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>✨ 한 문장 저장{text.length > 800 ? ' (' + text.length + '/1000)' : ''}</button>
      </div>
      {/* 이번 세션 아카이브 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 24px' }}>
        {saved.length > 0 && <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800, margin: '8px 0' }}>이번 독서에서 모은 {saved.length}문장</div>}
        {saved.map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{s.page != null ? s.page + 'p' : '페이지 미상'}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, fontStyle: 'italic' }}>"{s.text}"</div>
          </div>
        ))}
      </div>
      {/* 종료 확인 — 최종 읽은 쪽 */}
      {closing && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={(e) => { if (e.target === e.currentTarget) setClosing(false); }}>
          <div style={{ background: '#22252B', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>📖 어디까지 읽으셨어요?</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>오늘 {fmt(secs)} 읽음 · {saved.length}문장 기록</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              <button onClick={() => setFinalPage((s) => String(Math.max(0, (parseInt(s, 10) || 0) - 1)))} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#F4F2EC', fontSize: 18, cursor: 'pointer' }}>−</button>
              <input type="number" inputMode="numeric" value={finalPage} onChange={(e) => setFinalPage(e.target.value)} style={{ width: 80, textAlign: 'center', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#F4F2EC', fontSize: 18, fontWeight: 900, padding: '8px 0' }} />
              <button onClick={() => setFinalPage((s) => String((parseInt(s, 10) || 0) + 1))} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#F4F2EC', fontSize: 18, cursor: 'pointer' }}>+</button>
              {total > 0 && <span style={{ fontSize: 12, opacity: 0.5 }}>/ {total}p</span>}
            </div>
            <button onClick={finish} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>완료</button>
            <button onClick={() => setClosing(false)} style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 12, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>계속 읽기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NestView({ state, onCheckin, onSimSkip, onGoLibrary, onGoSocial, onOpenSearch }) {
  const [modalOpen, setModalOpen] = _useState(false);
  const [readingOpen, setReadingOpen] = _useState(false); // 읽기 모드 (#184)
  const [checkedToday, setCheckedToday] = _useState(false); // 오늘 짹 완료 — 읽기모드/체크인 후 중복 CTA 숨김 (#203)
  const [readingBooks, setReadingBooks] = _useState([]);  // 캐러셀용 읽는 중 책 (#185)
  const [ceremony, setCeremony] = _useState(null);
  const [showConfetti, setShowConfetti] = _useState(false);
  const [sameBookFeed, setSameBookFeed] = _useState([]); // 같은 책 다른 사용자 한 문장 (#1)
  // 둥지 단계 = 활성 책 진척률(book.cur/book.total). 체력/days 추적 없음.
  const _pctOf = (bk) => bk && bk.total ? Math.round(bk.cur / bk.total * 100) : 0;
  const [nestState, setNestState] = _useState({
    streak: state.streak,
    xp: state.xp,
    myQuotes: state.myQuotes,
    book: state.book,
    skipStreakRisk: false,   // 데모 '하루 거르기' — 방패 1회 흡수 후 다음 거르기에 스트릭 리셋
  });
  // 직전 진척률 가지 수 — 새 가지 stack 애니메이션 기준.
  const prevTwigsRef = _useRef(twigsForProgress(_pctOf(state.book)));

  // 활성 책이 바뀌면(또는 마운트) 부모 상태에서 재시드 → 둥지는 새 책 진척률로 재계산.
  _useEffect(() => {
    prevTwigsRef.current = twigsForProgress(_pctOf(state.book));
    setNestState({
      streak: state.streak,
      xp: state.xp,
      myQuotes: state.myQuotes,
      book: state.book,
      skipStreakRisk: false,
    });
  }, [state.book.id]);

  // 읽는 중 책 목록 — 활성 책 좌우 리볼빙 전환용 (#185)
  _useEffect(() => {
    if (!(DataStore.myBooks && DataStore.myBooks.list)) return;
    Promise.resolve(DataStore.myBooks.list()).then((rows) => {
      setReadingBooks((rows || []).filter((r) => (r.status || 'reading') === 'reading').map((r) => ({
        id: r.book_id || (r.book && r.book.id) || r.id, ubId: r.id,
        title: (r.book && r.book.title) || r.title || '', author: (r.book && r.book.author) || r.author || '',
        pub: (r.book && r.book.publisher) || '', cur: r.current_page || r.cur || 0,
        total: (r.book && r.book.total_pages) || r.total || 1,
        cover: (r.book && r.book.cover_url) || r.cover || '', fb: ['#9AA7B2', '#C7D0D8'],
      })));
    }).catch(() => {});
  }, [state.book.id]);
  const switchBook = (dir) => {
    if (!readingBooks || readingBooks.length < 2) { showToast('읽는 중인 책이 하나예요 📖'); return; }
    const idx = readingBooks.findIndex((b) => b.id === nestState.book.id);
    const ni = ((idx < 0 ? 0 : idx) + dir + readingBooks.length) % readingBooks.length;
    if (window.RG_activateBook) window.RG_activateBook(readingBooks[ni]);
  };

  // 같은 책 읽는 사람들 — 실 sentences(타 사용자, NPC 포함). 활성 책 변경 시 재로드. (#1)
  _useEffect(() => {
    let alive = true;
    const bid = nestState.book.id;
    const _isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bid || '');
    Promise.resolve((_isUuid && DataStore.sentences && DataStore.sentences.byBook) ? DataStore.sentences.byBook(bid, { limit: 5 }) : [])
      .then(rows => {
        if (!alive) return;
        setSameBookFeed((rows || []).map(s => {
          const u = s.user || {};
          const bk = (s.user_book && s.user_book.book) || {};
          const days = s.created_at ? Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400000) : 0;
          return { id: s.id, page: s.page, q: s.text, nick: u.handle ? ('@' + u.handle) : '@익명',
            avatar: (u.display_name && u.display_name[0]) || '🐦', claps: 0,
            time: days < 1 ? '오늘' : (days + '일 전'),
            bookTitle: bk.title || '', bookId: bk.id || bid, isMine: false };
        }));
      }).catch(() => { if (alive) setSameBookFeed([]); });
    return () => { alive = false; };
  }, [nestState.book.id]);

  const handleCheckin = ({ page, sentence }) => {
    setModalOpen(false);
    setCheckedToday(true); // 오늘의 짹 완료 (#203)
    const ns = { ...nestState };
    const pagesAdded = Math.max(0, page - ns.book.cur);
    const wasReset = ns.streak === 0;
    const prevPct = _pctOf(ns.book);
    const prevLv = getNestStage(prevPct).lv;

    ns.book = { ...ns.book, cur: page };
    if (wasReset) ns.streak = 1;
    else ns.streak += 1;
    ns.skipStreakRisk = false;

    const newPct = _pctOf(ns.book);
    const newLv = getNestStage(newPct).lv;
    const nestUp = newLv > prevLv;
    // 완독: 마지막 장 도달 (이번 체크인에 100% 처음 도달).
    const isComplete = newPct >= 100 && prevPct < 100;

    // XP — systems.md §6.3 SSOT. 페이지 수와 무관(일일미션 고정 +20). 차감 없음.
    const xpReward = computeCheckinXp({ isNewDay: true, isComplete, newStreak: ns.streak });
    const xpGain = xpReward.total;
    ns.xp += xpGain;

    if (sentence) {
      ns.myQuotes = [{ text: sentence, bookId: ns.book.id, page, when: '방금' }, ...ns.myQuotes];
    }

    prevTwigsRef.current = twigsForProgress(prevPct);
    setNestState(ns);
    onCheckin(ns, newLv, xpGain, sentence);

    // 단계 상승 시 진화 마이크로카피 toast (§5.2)
    if (nestUp) {
      const copy = getEvolutionCopy(prevLv, newLv);
      if (copy) showToast(`${getNestStage(newPct).short} ${copy}`);
    }

    setCeremony({ xpGain, xpParts: xpReward.parts, streak: ns.streak, sentence, nestUp, prevLv, newLv, pagesAdded, isNewDay: true, wasReset, isComplete });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  };

  // 데모: 하루 거르기 — 둥지·XP·성은 존속, 스트릭만 위기 (§5.4)
  const handleSimSkip = () => {
    const ns = { ...nestState };
    if (!ns.skipStreakRisk && ns.streak > 0) {
      ns.skipStreakRisk = true;
      showToast(`🛡️ 방패가 막았어요. 오늘 짹하면 ${ns.streak}일 유지!`);
    } else if (ns.streak > 0) {
      ns.streak = 0;
      ns.skipStreakRisk = false;
      showToast('💔 연속 출석이 끊겼어요. 다시 1일부터…');
    } else {
      showToast('🐦 오늘 한 쪽이면 다시 시작이에요.');
    }
    setNestState(ns);
    onSimSkip(ns);
  };

  // 완독 세리머니에서 받은 별점/소감을 영속 (§5.8.3).
  // 활성 책의 user_book 을 status='completed' + rating/review_text 로 마감.
  const handleComplete = ({ rating, review_text }) => {
    // 양 어댑터 정규화(activeBook.get/books.complete 동기/비동기 공통).
    (async () => {
      try {
        const ub = await Promise.resolve(DataStore.activeBook.get());
        if (ub && ub.id) await Promise.resolve(DataStore.books.complete(ub.id, { rating, review_text }));
      } catch (e) {
        console.warn('[nest] 완독 기록 저장 실패:', (e && e.message) || e);
      }
    })();
    showToast('🏰 성 컬렉션에 기록이 남았어요!');
  };

  // sameBookFeed 는 위 effect 에서 실 byBook 으로 로드됨 (#1). 데모 NPC_QUOTES 미사용.

  // 활성 책 없음(신규/미등록): 데모책 대신 '책 등록' 온보딩 — 유령 책 체크인(영속 실패) 방지.
  if (!nestState.book || !nestState.book.id) {
    return (
      <section className="view active">
        <div className="card book-card-wrap">
          <button className="book-jump" onClick={onGoLibrary}><span>📚</span><span>내 서재</span></button>
          <div style={{ padding: '38px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 46, marginBottom: 12 }}>🐦</div>
            <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>아직 읽는 책이 없어요</div>
            <div style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 20 }}>책을 등록하면 둥지가 자라기 시작해요.<br />하루 한 쪽, 한 문장부터.</div>
            <button className="checkin-cta" onClick={onOpenSearch} style={{ display: 'inline-flex', width: 'auto', padding: '14px 28px' }}>
              📖 읽을 책 등록하기
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="view active">
      {/* 활성 책 카드 — 좌우 리볼빙으로 활성 책 전환 (#185) */}
      <div className="card book-card-wrap" style={{ position: 'relative' }}>
        <button className="book-jump" onClick={onGoLibrary}>
          <span>📚</span><span>내 서재</span>
        </button>
        {readingBooks.length > 1 && (
          <>
            <button onClick={() => switchBook(-1)} aria-label="이전 책" style={{ position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer' }}>‹</button>
            <button onClick={() => switchBook(1)} aria-label="다음 책" style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer' }}>›</button>
            <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4, zIndex: 3 }}>
              {readingBooks.map((b, i) => <span key={b.id || i} style={{ width: 5, height: 5, borderRadius: '50%', background: b.id === nestState.book.id ? 'var(--brand)' : 'var(--line-2, #ccc)' }} />)}
            </div>
          </>
        )}
        <div className="book-card">
          <div className="book-cover" style={{background:`linear-gradient(135deg,${nestState.book.fb[0]},${nestState.book.fb[1]})`}}>
            <img
              src={nestState.book.cover}
              alt={nestState.book.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={e => e.target.style.display = 'none'}
            />
          </div>
          <div className="book-meta">
            <p className="book-title">{nestState.book.title}</p>
            <p className="book-author">{nestState.book.author}</p>
            <div className="book-progress-row">
              <div className="book-progress">
                <span style={{width: Math.min(100, Math.round(nestState.book.cur / nestState.book.total * 100)) + '%'}} />
              </div>
              <span className="book-progress-num">{nestState.book.cur} / {nestState.book.total}p</span>
            </div>
          </div>
        </div>
      </div>

      {/* 둥지 시어터 — 활성 책 진척률 5단계 */}
      <NestTheatre
        progressPct={nestState.book.total ? (nestState.book.cur / nestState.book.total * 100) : 0}
        streak={nestState.streak}
        prevTwigs={prevTwigsRef.current}
      />

      {/* 데모 거르기 */}
      <div className="demo-decay">
        <button onClick={handleSimSkip}>⏩ 데모: 하루 거르기 (스트릭 위기)</button>
      </div>

      {/* 읽기 모드 진입 (#184·#203) — 2줄 가운데 정렬, 주 CTA */}
      <button className="checkin-cta" onClick={() => setReadingOpen(true)}
        style={{ background: 'var(--brand)', marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, lineHeight: 1.3 }}>
        <span style={{ fontSize: 16, fontWeight: 900 }}>📖 읽기 모드</span>
        <span style={{ fontSize: 12, opacity: 0.72, fontWeight: 700 }}>타이머 + 한 문장 모으기</span>
      </button>

      {/* 체크인 = 읽기 모드 종료로 자동 처리 (#1) */}
      {checkedToday && (
        <div className="nudge" style={{ textAlign: 'center', fontWeight: 800 }}>
          🐦 오늘 기록 완료! <span className="em">🔥 {nestState.streak}일</span> 연속
        </div>
      )}

      {/* 내 한 문장 */}
      <div className="section-head">
        <h3>🔖 내 한 문장 <span className="my-q-count">{nestState.myQuotes.length}</span></h3>
        {nestState.myQuotes.length > 0 && (
          <button className="more" onClick={() => window.RG_openCollection && window.RG_openCollection()}>
            전체 {nestState.myQuotes.length}개 보기 →
          </button>
        )}
      </div>
      {nestState.myQuotes.length === 0 ? (
        <div className="my-q-empty">
          <span className="ico">🐦</span>
          오늘 만난 한 줄을 짹 해보세요.<br />
          등록한 문장이 여기 차곡차곡 쌓여요.
        </div>
      ) : (
        nestState.myQuotes.slice(0, 10).map((q, i) => {
          const _bk = getBook(q.bookId);
          const bkTitle = q.bookTitle || (_bk && _bk.title) || '책';
          return (
            <div key={i} className="my-q-card">
              <div className="meta">
                <span className="bk">{bkTitle}</span>
                <span className="dot">·</span>
                <span>{q.page}p</span>
                <span className="dot">·</span>
                <span>{q.when}</span>
              </div>
              <div className="quote">"{q.text}"</div>
            </div>
          );
        })
      )}

      {/* 같은 책 피드 */}
      <div className="section-head">
        <h3>📖 같은 책을 읽는 사람들</h3>
        <button className="more" onClick={onGoSocial}>더보기 →</button>
      </div>
      {sameBookFeed.length === 0 ? (
        <div className="empty">
          <span className="ico">🐦</span>
          이 책은 아직 첫 독자예요. 첫 한 문장의 주인공이 되어보세요.
        </div>
      ) : (
        sameBookFeed.map((it, i) => (
          <SentenceCard key={i} item={it} bookId={nestState.book.id} />
        ))
      )}

      {/* 읽기 모드 — portal (#184) */}
      {readingOpen && ReactDOM.createPortal(
        <ReadingMode
          book={nestState.book}
          onClose={() => setReadingOpen(false)}
          onArchive={(q) => setNestState((ns) => ({ ...ns, myQuotes: [q, ...ns.myQuotes] }))}
          onChecked={() => setCheckedToday(true)}
        />,
        document.body
      )}

      {/* 세리머니 — portal */}
      {ceremony && ReactDOM.createPortal(
        <Ceremony
          data={ceremony}
          onClose={() => setCeremony(null)}
          onComplete={handleComplete}
        />,
        document.body
      )}

      {/* 컨페티 — portal */}
      {showConfetti && ReactDOM.createPortal(
        <Confetti active={showConfetti} nestUp={ceremony ? ceremony.nestUp : false} />,
        document.body
      )}
    </section>
  );
}

window.NestView = NestView;
