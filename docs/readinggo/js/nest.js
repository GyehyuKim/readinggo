/* =========================================================
   ReadingGo — nest.js
   둥지 탭: 책 카드, The Path, NestTheatre, 체크인 CTA,
            내 한 문장, 같은 책 피드, CheckinModal, Ceremony
   ========================================================= */
const { useState: _useState, useEffect: _useEffect, useRef: _useRef, useMemo: _useMemo } = React;

/* ── CheckinModal ─────────────────────────────────────── */
function CheckinModal({ book, onClose, onSubmit }) {
  const [page, setPage] = _useState(book.cur);
  const [sentence, setSentence] = _useState('');
  const [isSpoiler, setIsSpoiler] = _useState(false);

  const adjustPage = (delta) => {
    setPage(p => Math.max(0, Math.min(book.total, p + delta)));
  };
  const handleInput = (e) => {
    let v = parseInt(e.target.value, 10);
    if (isNaN(v)) v = 0;
    setPage(Math.max(0, Math.min(book.total, v)));
  };
  const handleSentence = (e) => {
    if (e.target.value.length <= 200) setSentence(e.target.value);
  };
  const handleSubmit = () => {
    if (page === book.cur && sentence.trim().length === 0) {
      showToast('한 쪽도 OK! +1만 눌러봐요 🐦');
      return;
    }
    onSubmit({ page, sentence: sentence.trim(), isSpoiler });
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
            <span className="page-totalmark">전체 {book.total}p</span>
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
          <div className="sentence-counter">{sentence.length} / 200</div>
        </div>

        <div className="sheet-section">
          <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', userSelect:'none'}}>
            <input
              type="checkbox"
              checked={isSpoiler}
              onChange={(e) => setIsSpoiler(e.target.checked)}
              style={{width:20, height:20, cursor:'pointer'}}
            />
            <span style={{fontSize:14, fontWeight:700, color:'var(--ink)'}}>
              🚨 스포일러 처리하기
            </span>
            <span style={{fontSize:12, fontWeight:600, color:'var(--ink-3)'}}>
              (다른 독자 보호)
            </span>
          </label>
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
function Ceremony({ data, onClose }) {
  if (!data) return null;
  const { xpGain, streak, sentence, nestUp, prevLv, newLv, pagesAdded, isNewDay, wasReset } = data;
  let leadText;
  if (!isNewDay && !wasReset) {
    leadText = `+${pagesAdded}쪽 추가 기록 · +14 둥지 체력 · 오늘은 이미 짹 완료 🐦`;
  } else if (wasReset) {
    leadText = `+${pagesAdded}쪽 · ${streak}일 — 다시 시작이에요!`;
  } else {
    leadText = `+${pagesAdded}쪽 읽었어요 · +14 둥지 체력 · ${streak}일 연속!`;
  }
  const prevLadder = nestUp ? NEST_LADDER[prevLv - 1] : null;
  const nowLadder  = nestUp ? NEST_LADDER[newLv  - 1] : null;
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

        {sentence && (
          <div className="saved-quote">
            <span className="label">오늘의 한 문장</span>
            "{sentence}"
          </div>
        )}

        {nestUp && prevLadder && nowLadder && (
          <div className="nest-up">
            <span className="em">{nowLadder.short}</span>
            <div className="text">
              둥지가 진화했어요!
              <small>{prevLadder.short} {prevLadder.name} → {nowLadder.short} {nowLadder.name}</small>
            </div>
          </div>
        )}

        <button className="next-btn" onClick={onClose}>내일도 짹 →</button>
      </div>
    </div>
  );
}

/* ── NestTheatre ──────────────────────────────────────── */
function NestTheatre({ nestLv, nestHealth, streak, prevTwigCount }) {
  const h = Math.max(0, Math.min(100, nestHealth));
  const decay = (1 - h / 100).toFixed(3);
  const hCls = healthClass(h);
  const { cur, next } = nestInfo(nestLv);
  const copy = healthCopy(h);
  const twigCount = twigCountFromState(nestLv, h);
  const nestSvg = _useMemo(
    () => drawNest(twigCount, nestLv, prevTwigCount),
    [twigCount, nestLv, prevTwigCount]
  );

  return (
    <div
      className={`nest-theatre ${hCls}`}
      style={{'--health': h, '--decay': decay}}
    >
      <div className="nest-stagebar">
        <span className="nest-stage-pill">
          <span className="lv">LV.{cur.lv}</span>
          <span>{cur.name}</span>
        </span>
        <span className="nest-day-chip">🔥 {streak}일</span>
      </div>

      <div className="nest-svg-wrap">
        <div className="fall-layer" aria-hidden="true">
          <span className="fall-twig">🍂</span>
          <span className="fall-twig">·</span>
          <span className="fall-twig">🍃</span>
          <span className="fall-twig">·</span>
          <span className="fall-twig">🍂</span>
        </div>
        <div dangerouslySetInnerHTML={{ __html: nestSvg }} />
        <svg className="crack-overlay" viewBox="0 0 230 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g stroke="rgba(60,40,20,.55)" strokeWidth="1.4" fill="none" strokeLinecap="round">
            <path d="M 60 70 L 78 88 L 70 102 L 92 116" />
            <path d="M 150 80 L 138 96 L 152 110 L 142 124" />
            <path d="M 110 90 L 108 110 L 118 122" />
            <path d="M 30 130 L 50 138" />
            <path d="M 180 132 L 200 142" />
          </g>
        </svg>
      </div>

      <div className="nest-meta">
        <div className="nest-name-row">
          <div className="nest-name">
            <span>{cur.name}</span>
            {next && next.lv > cur.lv && (
              <span className="next-arrow">→ {next.short} {next.name}</span>
            )}
          </div>
          <div className="nest-health-num">체력 <b>{h}</b>/100</div>
        </div>
        <div className="nest-health-bar">
          <div className="nest-health-fill" />
        </div>
        <div className={'nest-microcopy' + (copy.cls ? ' ' + copy.cls : '')}>
          {copy.text}
        </div>
      </div>
    </div>
  );
}

/* ── NestView ─────────────────────────────────────────── */
function NestView({ state, onCheckin, onSimSkip, onGoLibrary, onGoSocial }) {
  const [modalOpen, setModalOpen] = _useState(false);
  const [ceremony, setCeremony] = _useState(null);
  const [showConfetti, setShowConfetti] = _useState(false);
  const [revealedQuotes, setRevealedQuotes] = _useState({});
  const [nestState, setNestState] = _useState({
    nestLv: state.nest.lv,
    nestHealth: state.nestHealth,
    streak: state.streak,
    xp: state.xp,
    pathNodes: state.pathNodes,
    myQuotes: state.myQuotes,
    book: state.book,
    daysSinceRead: state.daysSinceRead,
  });
  const prevTwigCountRef = _useRef(
    twigCountFromState(state.nest.lv, state.nestHealth)
  );

  // sync from parent state on mount and when state changes
  _useEffect(() => {
    setNestState({
      nestLv: state.nest.lv,
      nestHealth: state.nestHealth,
      streak: state.streak,
      xp: state.xp,
      pathNodes: state.pathNodes,
      myQuotes: state.myQuotes,
      book: state.book,
      daysSinceRead: state.daysSinceRead,
    });
  }, [state.book.id]);

  const HEALTH_GAIN = 14;
  const HEALTH_LOSS = 15;

  const handleCheckin = ({ page, sentence, isSpoiler }) => {
    setModalOpen(false);
    const ns = { ...nestState };
    const delta = page - ns.book.cur;
    const pagesAdded = Math.max(0, delta);
    const xpGain = Math.max(15, Math.min(60, 15 + pagesAdded));
    const isNewDay = ns.daysSinceRead >= 1;
    const wasReset = ns.streak === 0;
    const prevLv = ns.nestLv;

    ns.book = { ...ns.book, cur: page };
    ns.xp += xpGain;
    if (wasReset) ns.streak = 1;
    else if (isNewDay) ns.streak += 1;
    ns.daysSinceRead = 0;

    const newHealth = Math.min(100, ns.nestHealth + HEALTH_GAIN);
    let nestUp = false;
    if (newHealth >= 100 && ns.nestLv < NEST_LADDER.length) {
      nestUp = true;
      ns.nestLv += 1;
      ns.nestHealth = 40;
    } else {
      ns.nestHealth = newHealth;
    }

    if (sentence) {
      ns.myQuotes = [{ text: sentence, bookId: ns.book.id, page, when: '방금', isSpoiler: isSpoiler || false }, ...ns.myQuotes];
    }

    // advance The Path: today → done, ghost → today
    const nodes = ns.pathNodes.map(n => ({ ...n }));
    const todayIdx = nodes.findIndex(n => n.type === 'today');
    if (todayIdx >= 0) { nodes[todayIdx].type = 'done'; nodes[todayIdx].label = '✓'; }
    const ghostIdx = nodes.findIndex(n => n.type === 'ghost');
    if (ghostIdx >= 0) { nodes[ghostIdx].type = 'today'; nodes[ghostIdx].label = '★'; }
    ns.pathNodes = nodes;

    prevTwigCountRef.current = twigCountFromState(prevLv, nestState.nestHealth);
    setNestState(ns);
    onCheckin(ns);

    setCeremony({ xpGain, streak: ns.streak, sentence, nestUp, prevLv, newLv: ns.nestLv, pagesAdded, isNewDay, wasReset });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  };

  const handleSimSkip = () => {
    const ns = { ...nestState };
    const prev = ns.nestHealth;
    ns.nestHealth = Math.max(0, ns.nestHealth - HEALTH_LOSS);
    ns.daysSinceRead += 1;
    const streakBroke = ns.daysSinceRead >= 2 && ns.streak > 0;
    if (ns.daysSinceRead >= 2) ns.streak = 0;

    if (ns.nestHealth <= 0 && ns.nestLv > 1) {
      ns.nestLv -= 1;
      ns.nestHealth = 60;
      showToast(`💔 둥지 한 단계 강등 → ${NEST_LADDER[ns.nestLv - 1].name}`);
    } else if (ns.nestHealth <= 0) {
      showToast('💔 둥지가 무너졌어요. 오늘 한 쪽이면 되살릴 수 있어요.');
    } else if (streakBroke) {
      showToast('💔 연속 출석이 끊겼어요. 다시 1일부터…');
    } else if (ns.daysSinceRead === 1) {
      showToast(`🛡️ 방패가 막았어요. 오늘 짹하면 ${ns.streak}일 유지!`);
    } else {
      showToast(`🍂 −${prev - ns.nestHealth} 체력. 둥지가 흔들려요.`);
    }
    setNestState(ns);
    onSimSkip(ns);
  };

  const toggleQuoteSpoiler = (quoteId) => {
    setRevealedQuotes(prev => ({
      ...prev,
      [quoteId]: !prev[quoteId],
    }));
  };

  const sameBookFeed = (NPC_QUOTES[nestState.book.id] || []).slice(0, 3);

  return (
    <section className="view active">
      {/* 활성 책 카드 */}
      <div className="card book-card-wrap">
        <button className="book-jump" onClick={onGoLibrary}>
          <span>📚</span><span>내 서재</span>
        </button>
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

        {/* The Path */}
        <div className="path-wrap">
          <div className="path-label">
            <span>🌿 The Path</span>
            <span style={{marginLeft:'auto', color:'var(--ink-3)', fontWeight:700, textTransform:'none'}}>최근 7일</span>
          </div>
          <div className="path">
            {nestState.pathNodes.map((n, i) => (
              <div key={i} className={`node ${n.type}`} title={n.title}>{n.label}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 둥지 시어터 */}
      <NestTheatre
        nestLv={nestState.nestLv}
        nestHealth={nestState.nestHealth}
        streak={nestState.streak}
        prevTwigCount={prevTwigCountRef.current}
      />

      {/* 데모 거르기 */}
      <div className="demo-decay">
        <button onClick={handleSimSkip}>⏩ 데모: 하루 거르기 (−15)</button>
      </div>

      {/* 체크인 CTA */}
      <button className="checkin-cta" onClick={() => setModalOpen(true)}>
        <span className="pulse" />
        오늘의 한 쪽, 짹 하기
      </button>
      <div className="nudge">
        한 쪽이라도 읽으면 <span className="em">🔥 {nestState.streak}일</span> 연속 유지! 작은 호흡도 충분해요.
      </div>

      {/* 내 한 문장 */}
      <div className="section-head">
        <h3>🔖 내 한 문장 <span className="my-q-count">{nestState.myQuotes.length}</span></h3>
        {nestState.myQuotes.length > 3 && (
          <button className="more" onClick={() => showToast(`📓 내 한 문장 ${nestState.myQuotes.length}개. 곧 보관함 화면이 열려요`)}>
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
        nestState.myQuotes.slice(0, 3).map((q, i) => {
          const bk = getBook(q.bookId);
          const quoteId = `my_${i}`;
          const isRevealed = revealedQuotes[quoteId] || !q.isSpoiler;
          return (
            <div key={i} className="my-q-card">
              <div className="meta">
                <span className="bk">{bk ? bk.title : '책'}</span>
                <span className="dot">·</span>
                <span>{q.page}p</span>
                <span className="dot">·</span>
                <span>{q.when}</span>
              </div>
              <div className={'quote' + (isRevealed ? '' : ' spoiler')} onClick={() => toggleQuoteSpoiler(quoteId)} title="클릭하여 스포일러 표시">
                "{q.text}"
              </div>
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

      {/* 체크인 모달 — portal로 document.body에 마운트 (overflow 클리핑 회피) */}
      {modalOpen && ReactDOM.createPortal(
        <CheckinModal
          book={nestState.book}
          onClose={() => setModalOpen(false)}
          onSubmit={handleCheckin}
        />,
        document.body
      )}

      {/* 세리머니 — portal */}
      {ceremony && ReactDOM.createPortal(
        <Ceremony
          data={ceremony}
          onClose={() => setCeremony(null)}
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
