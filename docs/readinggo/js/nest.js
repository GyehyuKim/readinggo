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

        <button className="next-btn" onClick={onClose}>내일도 짹 →</button>
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
function NestView({ state, onCheckin, onSimSkip, onGoLibrary, onGoSocial }) {
  const [modalOpen, setModalOpen] = _useState(false);
  const [ceremony, setCeremony] = _useState(null);
  const [showConfetti, setShowConfetti] = _useState(false);
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

  const handleCheckin = ({ page, sentence }) => {
    setModalOpen(false);
    const ns = { ...nestState };
    const pagesAdded = Math.max(0, page - ns.book.cur);
    const xpGain = Math.max(15, Math.min(60, 15 + pagesAdded));
    const wasReset = ns.streak === 0;
    const prevPct = _pctOf(ns.book);
    const prevLv = getNestStage(prevPct).lv;

    ns.book = { ...ns.book, cur: page };
    ns.xp += xpGain;
    if (wasReset) ns.streak = 1;
    else ns.streak += 1;
    ns.skipStreakRisk = false;

    const newPct = _pctOf(ns.book);
    const newLv = getNestStage(newPct).lv;
    const nestUp = newLv > prevLv;

    if (sentence) {
      ns.myQuotes = [{ text: sentence, bookId: ns.book.id, page, when: '방금' }, ...ns.myQuotes];
    }

    prevTwigsRef.current = twigsForProgress(prevPct);
    setNestState(ns);
    onCheckin(ns, newLv);

    // 단계 상승 시 진화 마이크로카피 toast (§5.2)
    if (nestUp) {
      const copy = getEvolutionCopy(prevLv, newLv);
      if (copy) showToast(`${getNestStage(newPct).short} ${copy}`);
    }

    setCeremony({ xpGain, streak: ns.streak, sentence, nestUp, prevLv, newLv, pagesAdded, isNewDay: true, wasReset });
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
          return (
            <div key={i} className="my-q-card">
              <div className="meta">
                <span className="bk">{bk ? bk.title : '책'}</span>
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
