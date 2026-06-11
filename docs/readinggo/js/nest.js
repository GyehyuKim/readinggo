/* =========================================================
   ReadingGo — nest.js
   둥지 탭: 책 카드, NestTheatre, 체크인 CTA,
            내 한 문장, 같은 책 피드, CheckinModal, Ceremony
   ========================================================= */
const { useState: _useState, useEffect: _useEffect, useRef: _useRef, useMemo: _useMemo } = React;

// 안전 래퍼 — data.js 전역(nestXpProgress) 미준비/캐시 스큐 시에도 nest 탭 전체 크래시 방지.
// 정상 시 동일 동작, 미정의·예외 시 0(=진행 0%). 근본 원인은 _RG_V 캐시버전으로 차단.
function _xpProg(xp) {
  try { return (typeof nestXpProgress === 'function') ? nestXpProgress(xp) : (window.nestXpProgress ? window.nestXpProgress(xp) : 0); }
  catch (e) { return 0; }
}

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

/* ── NestTheatre — 누적 XP 5단계 (§5.2, #313) ──────────── */
// XP 단계 진행 카피 (QA ISSUE-001): pct = 다음 단계까지 진행률(책 진도 아님).
// 구버전은 pct 구간별 이모지 하드코딩 + '곧 완독' 책 기준 문구 → 단계명과 어긋났음.
function stageMicrocopy(pct, stage) {
  const em = stage.short || '🪹';
  if (pct >= 100) return `${em} ${stage.name} — 둥지가 진화했어요!`;
  if (pct >= 81)  return `${em} ${stage.name} — 다음 둥지가 코앞이에요. 오늘도 한 쪽!`;
  if (pct >= 51)  return `${em} ${stage.name} — 둥지가 부쩍 자랐어요. 계속 쌓아봐요.`;
  if (pct >= 21)  return `${em} ${stage.name} — 둥지가 모양을 갖춰가요.`;
  return `${em} ${stage.name} — 가지를 하나 놓았어요. 활동이 둥지를 키워요.`;
}

// health(0~100) → 4단계 시각 상태 클래스 + 탈색량(--decay). (§6.2)
// 데모 기본 health=100 → h-strong(decay 0): 균열·낙엽 비활성, 풀컬러.
function nestVisualState(h) {
  if (h >= 70) return { cls: 'h-strong',  decay: 0    };
  if (h >= 40) return { cls: 'h-shaky',   decay: 0.28 };
  if (h >= 20) return { cls: 'h-cracked', decay: 0.58 };
  return            { cls: 'h-ruin',    decay: 0.86 };
}

// 균열 SVG (h-cracked/h-ruin 에서 CSS opacity 로 페이드 인). 이미지 둥지 위 오버레이.
const NEST_CRACK_SVG = (
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <g fill="none" stroke="#3a2c1a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.72">
      <path d="M100 62 L93 96 L104 120 L97 152" />
      <path d="M93 96 L72 110" />
      <path d="M104 120 L126 132" />
      <path d="M97 152 L80 170" />
      <path d="M97 152 L114 168" />
    </g>
    <g fill="none" stroke="#6b513099" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
      <path d="M93 96 L100 78" />
      <path d="M126 132 L138 124" />
    </g>
  </svg>
);

function NestTheatre({ xp, streak, prevTwigs, health = 100 }) {
  // 둥지 = 누적 활동(XP). 책 진척률 아님 (#313). pct = 현재 레벨 내 진행도.
  const pct = _xpProg(xp);
  const stage = getNestStageByXp(xp);
  const { cur, next } = nestInfo(stage.lv);
  // 둥지 일러스트는 진척률(stage.lv)로 그린다. health 는 §6.2 시각 상태(흔들림/균열)용.
  const hp = Math.max(0, Math.min(100, Math.round(health)));
  const hstate = nestVisualState(hp);

  return (
    <div
      className={`nest-theatre nest-img-mode ${hstate.cls}`}
      style={{'--health': pct, '--decay': hstate.decay, '--stage-color': stage.color}}
    >
      <div className="nest-stagebar">
        <span className="nest-stage-pill">
          <span className="lv">LV.{cur.lv}</span>
          <span>{cur.short} {cur.name}</span>
        </span>
        <span className="nest-day-chip">🔥 {streak}일</span>
      </div>

      <div className="nest-svg-wrap nest-img-stack">
        {[1, 2, 3, 4, 5].map(lv => (
          <img
            key={lv}
            className={'nest-img' + (lv === stage.lv ? ' on' : '')}
            src={`assets/nest/lv${lv}.png`}
            alt=""
            referrerPolicy="no-referrer"
            draggable="false"
          />
        ))}
        <div className="crack-overlay">{NEST_CRACK_SVG}</div>
        <div className="fall-layer" aria-hidden="true">
          <span className="fall-twig">🍂</span>
          <span className="fall-twig">🪶</span>
          <span className="fall-twig">🍂</span>
          <span className="fall-twig">🌿</span>
          <span className="fall-twig">🍂</span>
        </div>
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
// 혼자만의 독서모임 (companion.md §4) — Worker /api/companion(solar-pro3) 호출. 실패/키없음 시 목 폴백.
const COMPANION_QS = [
  '왜 이 문장이 마음에 걸렸어요?',
  '이 문장, 지금 내 상황이랑 연결되는 게 있어요?',
  '이 문장에 동의해요, 아니면 고개를 갸웃했어요?',
  '이 문장을 누군가에게 들려준다면 누구일까요?',
  '이 문장에서 어떤 장면이나 기억이 떠올랐어요?',
];
function pickCompanionQ(text) {
  const i = (text ? text.length : 0) % COMPANION_QS.length;
  return COMPANION_QS[i];
}
// 실 LLM 호출 (solar-pro3, 서버 프록시). 네트워크/프록시 실패 시 목 질문 폴백 — 데모 무중단.
async function genCompanionQuestion(sentence, bookTitle, author, kind, avoid) {
  try {
    const r = await fetch('/api/companion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, bookTitle: bookTitle || '', author: author || '', kind: kind || 'quote', avoid: avoid || '' }),
    });
    if (r.ok) { const d = await r.json(); if (d && d.question) return d.question; }
  } catch (e) { /* 폴백 */ }
  return pickCompanionQ(sentence);
}
// 멀티턴 후속 질문 (#327) — 이전 대화(exchanges) 전달 → 한 걸음 더 깊은 되물음. 실패 시 목 폴백. avoid(#372) 재생성용.
async function genCompanionFollowup(sentence, exchanges, bookTitle, author, kind, avoid) {
  try {
    const r = await fetch('/api/companion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, bookTitle: bookTitle || '', author: author || '', exchanges, kind: kind || 'quote', avoid: avoid || '' }),
    });
    if (r.ok) { const d = await r.json(); if (d && d.question) return d.question; }
  } catch (e) { /* 폴백 */ }
  return '그 답에서 한 걸음 더 들어가면, 무엇이 떠오르나요?';
}
// 대화 1턴(Q/A)을 서버 아카이브 (#295) — 동의 유저만. 로컬/게스트는 어댑터가 no-op.
function archiveCompanion(bookId, sentenceText, q, a) {
  try {
    if (window.RG_consent && window.RG_consent.get() === 'yes' && DataStore.companionSessions && DataStore.companionSessions.add) {
      Promise.resolve(DataStore.companionSessions.add({ bookId, sentence: sentenceText, question: q, answer: a, lens: 'why' })).catch(() => {});
    }
  } catch (e) {}
}

function ReadingMode({ book: bookProp, onClose, onArchive, onCheckin }) {
  // book 스냅샷 — 세션 중 부모가 appState.book 을 빈 값으로 갱신(탭 복귀 시 transient 새로고침,
  // 만료 세션 등)해도 읽기 세션이 비워지거나 깨지지 않도록 진입 시점 book 을 고정한다.
  const [book] = _useState(() => bookProp);
  const [secs, setSecs] = _useState(0);
  const [running, setRunning] = _useState(true);
  const [page, setPage] = _useState(String(book.cur || 0)); // 문자열 — 빈칸 허용(페이지 미상)
  const [text, setText] = _useState('');
  const [kind, setKind] = _useState('quote'); // 'quote'=책 속 인용 | 'thought'=내 의견 (#360)
  const [saved, setSaved] = _useState([]);
  const [closing, setClosing] = _useState(false);            // 종료 확인 단계
  const [finalPage, setFinalPage] = _useState(String(book.cur || 0));
  const [companion, setCompanion] = _useState(null);         // 혼자만의 독서모임 질문 (#305) — 인라인('지금 대화') 또는 종료 화면(atEnd, #347)
  const [endStage, setEndStage] = _useState(null);           // 읽기 종료 참새(#347): null | 'companion'
  const endCtxRef = _useRef({ exit: true, finalP: 0 });       // 종료 맥락 — exit(✕,체크인X) | finish(독서 종료,체크인)
  const ubRef = _useRef(null);
  const total = book.total || 0;
  // 벽시계 타이머 — setInterval 틱 누적은 백그라운드 스로틀/절전 시 시간이 손실됨.
  // 누적초(accum) + 현재 러닝 세그먼트 시작 ts(segStart)로 실제 경과를 계산 → 스로틀돼도 값 정확.
  const accumRef = _useRef(0);
  const segStartRef = _useRef(Date.now());
  const autoPausedRef = _useRef(false);
  const computeSecs = () => accumRef.current + (segStartRef.current != null ? Math.floor((Date.now() - segStartRef.current) / 1000) : 0);
  _useEffect(() => {
    Promise.resolve(DataStore.activeBook.get()).then((ub) => { if (ub) ubRef.current = ub.id; }).catch(() => {});
  }, []);
  // 읽기 세션 중 플래그 — app.js 탭 복귀 재로드(#191)가 이걸 보고 보류. 빈 상태 덮어쓰기로
  // NestView가 빈 둥지 UI로 바뀌며 portal(ReadingMode) 언마운트되던 세션 파괴 방지(1h QA 재현).
  _useEffect(() => {
    window.RG_READING_OPEN = true;
    return () => { window.RG_READING_OPEN = false; };
  }, []);
  // 러닝/정지 전환 시 진행분을 누적에 반영
  _useEffect(() => {
    if (running && !closing) {
      if (segStartRef.current == null) segStartRef.current = Date.now();
    } else if (segStartRef.current != null) {
      accumRef.current += Math.floor((Date.now() - segStartRef.current) / 1000);
      segStartRef.current = null;
    }
    setSecs(computeSecs());
  }, [running, closing]);
  // 디스플레이 틱 — 벽시계 기반이라 스로틀돼도 표시값은 정확
  _useEffect(() => {
    if (!running || closing) return;
    const t = setInterval(() => setSecs(computeSecs()), 1000);
    return () => clearInterval(t);
  }, [running, closing]);
  // 가시성 — 숨기면 자동 일시정지, 복귀 시 자동 재개(수동 정지는 존중). 복귀 후 타이머가 죽던 버그 수정.
  _useEffect(() => {
    const onVis = () => {
      if (document.hidden) { if (running && !closing) { autoPausedRef.current = true; setRunning(false); } }
      else if (autoPausedRef.current) { autoPausedRef.current = false; setRunning(true); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [running, closing]);
  const fmt = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h > 0 ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  };
  const pageNum = (s) => { const n = parseInt(s, 10); return isNaN(n) ? null : Math.max(0, total ? Math.min(total, n) : n); };
  const bump = (d) => setPage((s) => String(Math.max(0, (parseInt(s, 10) || 0) + d)));
  // 한 문장 저장. chat=true('지금 대화')면 저장 후 즉시 참새(인라인). 기본은 저장만 —
  // 읽는 중엔 흐름 유지, 참새는 읽기 종료 시 한 번(#347, companion-reading-end.md).
  const save = (chat) => {
    const t = text.trim();
    if (!t) { showToast(kind === 'thought' ? '내 생각을 적어주세요' : '한 문장을 적어주세요'); return; }
    const p = pageNum(page); // 비어있으면 null(페이지 없이 저장)
    const ubId = ubRef.current;
    const k = kind; // 저장 시점 kind 고정 (#360)
    Promise.resolve(DataStore.sentences.add({ userBookId: ubId, page: p, text: t, kind: k })).then((row) => {
      const sid = row && row.id;
      setSaved((list) => [{ id: sid, text: t, page: p, kind: k }, ...list]);
      setText('');
      showToast(chat ? '🐦 참새와 대화해요' : (k === 'thought' ? '💭 내 생각 저장됨 💬' : (p != null ? ('📍 ' + p + 'p 저장됨 💬') : '저장됨 💬')));
      // id+bookTitle 전달 (#358·사피엔스버그) — bookTitle 누락 시 둥지 카드가 getBook 폴백(RG_BOOKS[0]=사피엔스)으로 오표시.
      if (onArchive) onArchive({ id: sid, text: t, bookId: book.id, bookTitle: book.title || '', page: p, when: '방금', kind: k });
      rgTrack('highlight_selected', { book_id: book.id, page: p, sentence_length: t.length, kind: k });
      // '지금 대화'(부수 옵션, #347)에서만 즉시 참새. 첫 사용 시 데이터 활용 동의 먼저(#294).
      if (chat) {
        const consent = window.RG_consent ? window.RG_consent.get() : 'yes';
        if (consent === null) setCompanion({ sentenceId: sid, text: t, kind: k, needsConsent: true, answer: '', exchanges: [], atEnd: false });
        else startCompanion(sid, t, k, false);
      }
    }).catch(() => showToast('저장 실패 — 다시 시도'));
  };
  // 동의 상태에 맞춰 질문 시작 — 'yes'면 solar-pro3, 그 외(거부)면 로컬 목 (외부 전송 없음). (#294/§4)
  // atEnd(#347): true면 읽기 종료 화면(세션 1질문), false면 '지금 대화'(읽는 중 인라인).
  const startCompanion = (sid, t, k, atEnd) => {
    const consent = window.RG_consent ? window.RG_consent.get() : 'yes';
    setCompanion({ sentenceId: sid, text: t, kind: k || 'quote', question: null, loading: true, answer: '', exchanges: [], atEnd: !!atEnd });
    const gen = (consent === 'yes') ? genCompanionQuestion(t, book.title, book.author, k) : Promise.resolve(pickCompanionQ(t));
    gen.then((q) => setCompanion((c) => (c && c.sentenceId === sid) ? { ...c, question: q, loading: false } : c));
  };
  const decideConsent = (v) => {
    if (window.RG_consent) window.RG_consent.set(v);
    rgTrack('data_consent', { value: v });
    if (companion) startCompanion(companion.sentenceId, companion.text, companion.kind, companion.atEnd);
  };
  // 대화 전체(Q/A)를 해당 문장 감상(my_note)으로 영속 (양 어댑터 setNote)
  const persistCompanionNote = (sid, exchanges) => {
    if (!sid || !(DataStore.sentences && DataStore.sentences.setNote)) return;
    const note = (exchanges || []).map((e) => `Q. ${e.q}\nA. ${e.a}`).join('\n\n');
    Promise.resolve(DataStore.sentences.setNote(sid, note)).catch(() => {});
    // 같은 세션 정합 — appState/nestState myQuotes의 note 갱신 → 재오픈 시 대화 이어보기(처음부터 X).
    window.dispatchEvent(new CustomEvent('rg:sentence-note', { detail: { id: sid, note } }));
  };
  // 답 남기기 — 멀티턴(#327). 최대 3턴, 그 후/비동의 시 마무리. 매 답마다 대화 저장.
  const MAX_TURNS = 3;
  const answerCompanion = () => {
    if (!companion) return;
    const a = (companion.answer || '').trim();
    if (!a) { setCompanion((c) => c ? { ...c, done: true } : c); return; }
    const ex = [...(companion.exchanges || []), { q: companion.question, a }];
    rgTrack('answer_saved', { book_id: book.id, lens: 'why', answer_length: a.length });
    persistCompanionNote(companion.sentenceId, ex);
    archiveCompanion(book.id, companion.text, companion.question, a); // 서버 아카이브 (#295)
    const consent = window.RG_consent ? window.RG_consent.get() : 'yes';
    if (ex.length >= MAX_TURNS || consent !== 'yes') {
      setCompanion((c) => (c && c.sentenceId === companion.sentenceId) ? { ...c, exchanges: ex, question: null, answer: '', loading: false, done: true } : c);
      showToast('🐦 좋은 대화였어요');
      return;
    }
    setCompanion((c) => (c && c.sentenceId === companion.sentenceId) ? { ...c, exchanges: ex, question: null, answer: '', loading: true } : c);
    genCompanionFollowup(companion.text, ex, book.title, book.author, companion.kind).then((q) =>
      setCompanion((c) => (c && c.sentenceId === companion.sentenceId) ? { ...c, question: q, loading: false } : c));
  };
  // 질문 재생성 (#372) — 현재 질문을 avoid로 넘겨 다른 질문 받기.
  const regenCompanion = () => {
    if (!companion || companion.loading || !companion.question) return;
    const cur = companion.question, ex = companion.exchanges || [], sid = companion.sentenceId;
    rgTrack('companion_q_regen', { book_id: book.id });
    setCompanion((c) => (c && c.sentenceId === sid) ? { ...c, question: null, loading: true, rated: null } : c);
    const gen = ex.length ? genCompanionFollowup(companion.text, ex, book.title, book.author, companion.kind, cur)
      : genCompanionQuestion(companion.text, book.title, book.author, companion.kind, cur);
    gen.then((q) => setCompanion((c) => (c && c.sentenceId === sid) ? { ...c, question: q, loading: false } : c));
  };
  // 질문 평가 (#371) — 👍/👎 (사유는 후속). engagement 신호 → PostHog.
  const rateCompanion = (val) => {
    if (!companion) return;
    rgTrack('companion_q_rated', { book_id: book.id, value: val });
    setCompanion((c) => c ? { ...c, rated: val } : c);
  };
  // 읽기 종료 시 참새 1회(#347, companion-reading-end.md) — 읽기(몰입)와 성찰(대화) 분리.
  // ✕ 나가기·독서 종료·완독 모두에서, 세션에 모은 문장 중 하나로 질문 1개. 0문장이면 미등장.
  // 문장 선택: 코멘트(note) 달린 것 우선 → 없으면 마지막 저장(saved[0]=최신).
  const beginEnd = (exit, finalP) => {
    endCtxRef.current = { exit: exit, finalP: finalP };
    setClosing(false);
    const sess = saved;
    if (!sess.length) { commitEnd(); return; }   // 모은 문장 0개 → 참새 없이 바로 종료
    const target = sess.find((s) => s.note) || sess[0];
    setEndStage('companion');
    const consent = window.RG_consent ? window.RG_consent.get() : 'yes';
    if (consent === null) setCompanion({ sentenceId: target.id, text: target.text, kind: target.kind, needsConsent: true, answer: '', exchanges: [], atEnd: true });
    else startCompanion(target.id, target.text, target.kind, true);
  };
  // 실제 종료 위임 — exit(✕): 체크인 없이 닫기 / finish(독서 종료): 부모 체크인 파이프라인(#300)
  // → 진도/스트릭/XP 갱신 + 둥지 갱신(onCheckin) + 완독 시 세리머니까지 단일 경로. 문장은 이미 저장됨(sentence=null).
  const commitEnd = () => {
    const { exit, finalP } = endCtxRef.current;
    if (!exit) {
      rgTrack('reading_session_end', { book_id: book.id, duration_sec: secs, pages_logged: Math.max(0, (finalP || 0) - (book.cur || 0)) });
      if (onCheckin) onCheckin({ page: finalP, sentence: null });
    }
    onClose();
  };
  // 독서 종료 확인(완료) → 최종 쪽 확정 후 참새 종료 화면으로.
  const finish = () => {
    const fp = pageNum(finalPage);
    const finalP = fp != null ? fp : (book.cur || 0);
    beginEnd(false, finalP);
  };
  // 참새 대화 본문 — 인라인('지금 대화')·읽기 종료 화면 공용(#347). companion 상태에서 렌더.
  const renderCompanionBody = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#7BE0A8', marginBottom: 8 }}>
        <span>🐦</span><span>혼자만의 독서모임</span>
      </div>
      {(companion.exchanges || []).map((e, ei) => (
        <div key={ei} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.5 }}>{e.q}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4, paddingLeft: 8, borderLeft: '2px solid rgba(255,255,255,0.18)', lineHeight: 1.5 }}>{e.a}</div>
        </div>
      ))}
      {companion.needsConsent ? (
        <>
          <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 10, opacity: 0.9 }}>남긴 문장을 AI가 읽고 질문을 만들고, 익명으로 분석에 활용해도 될까요? 끄면 로컬 질문만 드려요. (설정에서 언제든 변경)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => decideConsent('no')} style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>아니요</button>
            <button onClick={() => decideConsent('yes')} style={{ flex: 1, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>좋아요</button>
          </div>
        </>
      ) : companion.done ? (
        <div style={{ fontSize: 12, opacity: 0.6, fontStyle: 'italic', paddingTop: 2 }}>🐦 대화 저장됨 · 다음에 또 이어가요</div>
      ) : companion.loading ? (
        <div style={{ fontSize: 13, opacity: 0.7, fontStyle: 'italic' }}>참새가 곰곰이 생각 중…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700, lineHeight: 1.55 }}>{companion.question}</div>
            <div style={{ flex: '0 0 auto', display: 'flex', gap: 4, fontSize: 13 }}>
              <button onClick={() => rateCompanion('up')} title="좋은 질문" aria-label="좋아요" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: companion.rated === 'up' ? 1 : 0.45 }}>👍</button>
              <button onClick={() => rateCompanion('down')} title="별로예요" aria-label="싫어요" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: companion.rated === 'down' ? 1 : 0.45 }}>👎</button>
              <button onClick={regenCompanion} title="다른 질문" aria-label="다른 질문" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.55 }}>🔄</button>
            </div>
          </div>
          <textarea value={companion.answer} onChange={(e) => setCompanion((c) => ({ ...c, answer: e.target.value }))}
            placeholder="떠오르는 대로 답해보세요" rows={2}
            style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#F4F2EC', fontSize: 14, lineHeight: 1.5, padding: 10, resize: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { persistCompanionNote(companion.sentenceId, companion.exchanges); setCompanion((c) => c ? { ...c, done: true } : c); }} style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{companion.atEnd ? '건너뛰기' : '마치기'}</button>
            <button onClick={answerCompanion} style={{ flex: 1, padding: '7px 14px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{(companion.exchanges || []).length >= MAX_TURNS - 1 ? '답 남기고 마치기' : '답하고 이어가기'}</button>
          </div>
        </>
      )}
    </>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1A1C20', color: '#F4F2EC', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* #4 나가기 — 체크인 없이 종료. 모은 문장 있으면 참새 1회 후 닫힘(#347). */}
          <button onClick={() => beginEnd(true, book.cur || 0)} aria-label="나가기" title="나가기 (기록 없이)" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#F4F2EC', borderRadius: 16, padding: '6px 12px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✕</button>
          <button onClick={() => setRunning((r) => !r)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#F4F2EC', borderRadius: 16, padding: '6px 12px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{running ? '⏸' : '▶'}</button>
        </div>
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
        {/* 인용 ↔ 내 생각 토글 (#360) — 의견도 한 문장처럼 가볍게 남긴다 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, justifyContent: 'center' }}>
          {[['quote', '📖 책 속 문장'], ['thought', '💭 내 생각']].map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)}
              style={{ padding: '6px 14px', borderRadius: 14, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                background: kind === k ? 'var(--brand)' : 'rgba(255,255,255,0.1)', color: kind === k ? '#fff' : 'rgba(244,242,236,0.7)' }}>
              {label}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => { if (e.target.value.length <= 1000) setText(e.target.value); }}
          placeholder={kind === 'thought' ? '지금 드는 내 생각·의견을 가볍게 적어요…' : '떠오른 한 문장을 바로 옮겨 적어요…'} rows={3}
          style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#F4F2EC', fontSize: 15, lineHeight: 1.6, padding: 12, resize: 'none', boxSizing: 'border-box' }} />
        {/* 저장(기본) + 지금 대화(부수 옵션) — 읽는 중엔 저장만, 참새는 읽기 종료 시(#347). */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => save(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>{kind === 'thought' ? '💭 내 생각 저장' : '✨ 한 문장 저장'}{text.length > 800 ? ' (' + text.length + '/1000)' : ''}</button>
          <button onClick={() => save(true)} title="지금 이 문장으로 참새와 대화" style={{ flex: '0 0 auto', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'rgba(244,242,236,0.9)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>💬 지금 대화</button>
        </div>
      </div>
      {/* 이번 세션 아카이브 — 각 문장 하단에 혼자만의 독서모임 대화 (#327) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 24px' }}>
        {saved.length > 0 && <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800, margin: '8px 0' }}>이번 독서에서 모은 {saved.length}문장</div>}
        {saved.map((s, i) => (
          <div key={s.id || i} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{s.page != null ? s.page + 'p' : '페이지 미상'}{s.kind === 'thought' ? ' · 💭 내 생각' : ''}</div>
            {s.kind === 'thought'
              ? <div style={{ fontSize: 14, lineHeight: 1.5 }}>💭 {s.text}</div>
              : <div style={{ fontSize: 14, lineHeight: 1.5, fontStyle: 'italic' }}>"{s.text}"</div>}
            {/* '지금 대화'(부수 옵션)로 시작한 인라인 대화 — 읽기 종료 대화(atEnd)는 종료 화면에서 (#347) */}
            {companion && !companion.atEnd && companion.sentenceId === s.id && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {renderCompanionBody()}
              </div>
            )}
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
      {/* 읽기 종료 시 참새 — 읽기(몰입)·성찰(대화) 분리(#347). 세션 1문장 1질문 + 오늘 요약. */}
      {endStage === 'companion' && companion && (
        <div style={{ position: 'absolute', inset: 0, background: '#1A1C20', zIndex: 30, display: 'flex', flexDirection: 'column', padding: '24px 18px', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>오늘 {Math.max(0, (endCtxRef.current.finalP || 0) - (book.cur || 0))}쪽 읽었어요 ✨</div>
            <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 4 }}>이번 독서에서 {saved.length}문장을 모았어요</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
            {/* 참새가 고른 한 문장 */}
            <div style={{ fontSize: 13.5, lineHeight: 1.55, opacity: 0.9, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', fontStyle: companion.kind === 'thought' ? 'normal' : 'italic' }}>
              {companion.kind === 'thought' ? ('💭 ' + companion.text) : ('"' + companion.text + '"')}
            </div>
            {renderCompanionBody()}
          </div>
          <button onClick={commitEnd} style={{ marginTop: 16, width: '100%', padding: 13, borderRadius: 12, border: 'none', background: companion.done ? 'var(--brand)' : 'transparent', color: companion.done ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            {companion.done ? '🪹 둥지로' : '건너뛰고 둥지로'}
          </button>
        </div>
      )}
    </div>
  );
}

function NestView({ state, onCheckin, onSimSkip, onGoLibrary, onGoSocial, onOpenSearch, onArchive }) {
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
  const prevTwigsRef = _useRef(twigsForProgress(_xpProg(state.xp)));
  // 한 문장 삭제(#1)·종류변경(#381) 이벤트 → 둥지 '내 한 문장' 목록 즉시 반영.
  _useEffect(() => {
    const onRm = (e) => { const id = e && e.detail && e.detail.id; if (!id) return; setNestState((ns) => ({ ...ns, myQuotes: (ns.myQuotes || []).filter((q) => q.id !== id) })); };
    const onKind = (e) => { const d = e && e.detail; if (!d || !d.id) return; setNestState((ns) => ({ ...ns, myQuotes: (ns.myQuotes || []).map((q) => q.id === d.id ? { ...q, kind: d.kind } : q) })); };
    const onNote = (e) => { const d = e && e.detail; if (!d || !d.id) return; setNestState((ns) => ({ ...ns, myQuotes: (ns.myQuotes || []).map((q) => q.id === d.id ? { ...q, note: d.note } : q) })); };
    window.addEventListener('rg:sentence-removed', onRm);
    window.addEventListener('rg:sentence-kind', onKind);
    window.addEventListener('rg:sentence-note', onNote);
    return () => { window.removeEventListener('rg:sentence-removed', onRm); window.removeEventListener('rg:sentence-kind', onKind); window.removeEventListener('rg:sentence-note', onNote); };
  }, []);

  // 활성 책이 바뀌면(또는 마운트) 부모 상태에서 재시드. 둥지(XP 기반)는 유지 — 책과 무관(#313).
  _useEffect(() => {
    prevTwigsRef.current = twigsForProgress(_xpProg(state.xp));
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
  // 시간차 되감기 (#346, resurface.md) — 둥지 진입 시 백그라운드 체크, 1일 1회, 비침습 카드.
  const [resurfaceCard, setResurfaceCard] = _useState(null);
  _useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!(DataStore.resurface && DataStore.sentences && DataStore.sentences.resurfaceCandidate)) return;
        if (DataStore.resurface.shownToday()) return;
        const cand = await Promise.resolve(DataStore.sentences.resurfaceCandidate());
        if (!alive || !cand) return;
        setResurfaceCard(cand);
        DataStore.resurface.markToday(); // 노출 시점에 1일 1회 마킹 (§2.1)
        rgTrack('resurface_shown', { sentence_id: cand.id, days: cand.daysAgo });
      } catch (e) { /* 넛지 실패는 조용히 */ }
    })();
    return () => { alive = false; };
  }, []);
  const resurfaceTalk = () => {
    if (!resurfaceCard) return;
    rgTrack('resurface_answered', { sentence_id: resurfaceCard.id, days: resurfaceCard.daysAgo });
    try { Promise.resolve(DataStore.sentences.markResurfaced(resurfaceCard.id)).catch(() => {}); } catch (e) {}
    if (window.RG_openCompanion) window.RG_openCompanion({ id: resurfaceCard.id, text: resurfaceCard.text, bookId: resurfaceCard.bookId, bookTitle: resurfaceCard.bookTitle, page: resurfaceCard.page, note: resurfaceCard.note, kind: resurfaceCard.kind });
    setResurfaceCard(null);
  };
  const resurfaceLater = () => {
    if (!resurfaceCard) return;
    rgTrack('resurface_skipped', { sentence_id: resurfaceCard.id });
    setResurfaceCard(null); // 오늘 하루 숨김 — markToday 는 노출 시 이미 기록
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
    const prevPct = _pctOf(ns.book);            // 책 진척(완독 판정용)
    const prevXp = ns.xp;
    const prevLv = getNestStageByXp(prevXp).lv; // 둥지 단계 = 누적 XP (#313)

    ns.book = { ...ns.book, cur: page };
    if (wasReset) ns.streak = 1;
    else ns.streak += 1;
    ns.skipStreakRisk = false;

    const newPct = _pctOf(ns.book);
    // 완독: 마지막 장 도달 (이번 체크인에 100% 처음 도달).
    const isComplete = newPct >= 100 && prevPct < 100;

    // XP — systems.md §6.3 SSOT. 둥지 단계도 이 XP 누적에 연동(#313). 차감 없음.
    const xpReward = computeCheckinXp({ isNewDay: true, isComplete, newStreak: ns.streak });
    const xpGain = xpReward.total;
    ns.xp += xpGain;

    const newLv = getNestStageByXp(ns.xp).lv;   // XP 증가 후 둥지 단계
    const nestUp = newLv > prevLv;

    if (sentence) {
      ns.myQuotes = [{ text: sentence, bookId: ns.book.id, page, when: '방금' }, ...ns.myQuotes];
    }

    prevTwigsRef.current = twigsForProgress(_xpProg(prevXp));
    setNestState(ns);
    onCheckin(ns, newLv, xpGain, sentence);

    // 단계 상승 시 진화 마이크로카피 toast (§5.2)
    if (nestUp) {
      const copy = getEvolutionCopy(prevLv, newLv);
      if (copy) showToast(`${getNestStageByXp(ns.xp).short} ${copy}`);
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
          <BookCover className="book-cover" title={nestState.book.title} author={nestState.book.author} cover={nestState.book.cover} fb={nestState.book.fb} />
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

      {/* 둥지 시어터 — 누적 활동(XP) 5단계, 책과 무관 (#313) */}
      <NestTheatre
        xp={nestState.xp}
        streak={nestState.streak}
        prevTwigs={prevTwigsRef.current}
      />

      {/* 데모 거르기 */}
      <div className="demo-decay">
        <button onClick={handleSimSkip}>⏩ 데모: 하루 거르기 (스트릭 위기)</button>
      </div>

      {/* 읽기 모드 진입 (#184·#203) — 2줄 가운데 정렬, 주 CTA */}
      <button className="checkin-cta" onClick={() => { rgTrack('book_opened', { book_id: nestState.book.id, entry_point: 'reading_mode' }); setReadingOpen(true); }}
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

      {/* 시간차 되감기 카드 (#346, resurface.md §3.1) — 비침습, 스크롤로 지나칠 수 있음 */}
      {resurfaceCard && (
        <div style={{ background: 'var(--brand-tint)', border: '1px solid var(--brand)', borderRadius: 12, padding: '14px 16px', margin: '10px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-3)', marginBottom: 6 }}>💬 참새</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>
            {resurfaceCard.daysAgo}일 전, 이 문장을 남겼어요{resurfaceCard.bookTitle ? ` — 《${resurfaceCard.bookTitle}》` : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, fontStyle: resurfaceCard.kind === 'thought' ? 'normal' : 'italic', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '8px 2px', marginBottom: 8 }}>
            {resurfaceCard.kind === 'thought' ? `💭 ${resurfaceCard.text}` : `"${resurfaceCard.text}"`}
          </div>
          {resurfaceCard.lastAnswer && (
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 8 }}>
              내가 썼던 것: "{resurfaceCard.lastAnswer.length > 80 ? resurfaceCard.lastAnswer.slice(0, 80) + '…' : resurfaceCard.lastAnswer}"
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>지금은 어때요?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resurfaceTalk}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              다시 대화하기
            </button>
            <button onClick={resurfaceLater}
              style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              나중에
            </button>
          </div>
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
          // getBook 은 미스 시 RG_BOOKS[0](=사피엔스)로 폴백하므로, id가 실제 일치할 때만 그 제목을 씀(사피엔스버그).
          const _bk = getBook(q.bookId);
          const bkTitle = q.bookTitle || (_bk && _bk.id === q.bookId ? _bk.title : '') || '책';
          return (
            <div key={i} className="my-q-card" style={{ cursor: 'pointer' }}
              onClick={() => window.RG_openCompanion && window.RG_openCompanion({ id: q.id, text: q.text, bookId: q.bookId, bookTitle: bkTitle, page: q.page, note: q.note, kind: q.kind })}>
              <div className="meta">
                <span className="bk">{bkTitle}</span>
                <span className="dot">·</span>
                <span>{q.page}p</span>
                {q.when ? <span className="dot">·</span> : null}
                {q.when ? <span>{q.when}</span> : null}
              </div>
              <div className="quote" style={q.kind === 'thought' ? { fontStyle: 'normal' } : null}>{q.kind === 'thought' ? `💭 ${q.text}` : `"${q.text}"`}</div>
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
          onArchive={(q) => { setNestState((ns) => ({ ...ns, myQuotes: [q, ...ns.myQuotes] })); if (onArchive) onArchive(q); }}
          onCheckin={handleCheckin}
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

/* ── CompanionModal (#326): 한 문장 대화 — 읽기 모드 밖에서 열람·이어가기 ──
   저장된 대화(my_note의 Q/A)를 보여주고, 동의 시 한 걸음 더 이어감(멀티턴). */
function parseNoteToExchanges(note) {
  if (!note) return [];
  const out = [];
  String(note).split(/\n\n+/).forEach((b) => {
    const m = b.match(/^Q\.\s*([\s\S]*?)\nA\.\s*([\s\S]*)$/);
    if (m) out.push({ q: m[1].trim(), a: m[2].trim() });
  });
  return out;
}
function CompanionModal({ sentence, onClose }) {
  const [exchanges, setExchanges] = _useState(() => parseNoteToExchanges(sentence.note));
  const [question, setQuestion] = _useState(null);
  const [loading, setLoading] = _useState(true);
  const [answer, setAnswer] = _useState('');
  const [done, setDone] = _useState(false);
  const [rated, setRated] = _useState(null);               // 질문 평가 👍/👎 (#371)
  const [editing, setEditing] = _useState(false);          // 한 문장 본문 편집 (#325)
  const [stext, setStext] = _useState(sentence.text || '');
  const [skind, setSkind] = _useState(sentence.kind === 'thought' ? 'thought' : 'quote'); // 인용↔내 의견 (#381)
  const MAX = 3;
  const consent = window.RG_consent ? window.RG_consent.get() : 'yes';
  const bt = sentence.bookTitle || '', au = sentence.author || '';
  const saveText = () => {
    const v = stext.trim();
    if (!v) { setEditing(false); return; }
    if (DataStore.sentences && DataStore.sentences.updateText) Promise.resolve(DataStore.sentences.updateText(sentence.id, v)).catch(() => {});
    // 종류 변경(#381) — 바뀐 경우에만 setKind.
    if (skind !== (sentence.kind || 'quote') && DataStore.sentences && DataStore.sentences.setKind) {
      Promise.resolve(DataStore.sentences.setKind(sentence.id, skind)).catch(() => {});
      sentence.kind = skind;
      window.dispatchEvent(new CustomEvent('rg:sentence-kind', { detail: { id: sentence.id, kind: skind } }));
    }
    sentence.text = v; setEditing(false); showToast('✏️ 문장 수정됨');
  };
  _useEffect(() => {
    const past = parseNoteToExchanges(sentence.note);
    const gen = (consent !== 'yes')
      ? Promise.resolve(pickCompanionQ(sentence.text))
      : (past.length ? genCompanionFollowup(sentence.text, past, bt, au, sentence.kind) : genCompanionQuestion(sentence.text, bt, au, sentence.kind));
    gen.then((q) => { setQuestion(q); setLoading(false); });
  }, []);
  const persist = (ex) => {
    if (!sentence.id || !(DataStore.sentences && DataStore.sentences.setNote)) return;
    const note = ex.map((e) => `Q. ${e.q}\nA. ${e.a}`).join('\n\n');
    Promise.resolve(DataStore.sentences.setNote(sentence.id, note)).catch(() => {});
    sentence.note = note; // 모달 내 즉시 정합
    window.dispatchEvent(new CustomEvent('rg:sentence-note', { detail: { id: sentence.id, note } }));
  };
  // 한 문장 삭제 (#1) — 둥지 한 문장 상세에도 삭제. 이벤트로 둥지·서재 목록 즉시 반영.
  const delQuote = () => {
    if (!sentence.id || !(DataStore.sentences && DataStore.sentences.remove)) { onClose(); return; }
    if (!window.confirm('이 한 문장을 삭제할까요? 되돌릴 수 없어요.')) return;
    Promise.resolve(DataStore.sentences.remove(sentence.id)).then(() => {
      if (window.rgTrack) window.rgTrack('sentence_deleted', { book_id: sentence.bookId || '' });
      window.dispatchEvent(new CustomEvent('rg:sentence-removed', { detail: { id: sentence.id } }));
      showToast('🗑 한 문장을 삭제했어요');
      onClose();
    }).catch(() => showToast('삭제 실패 — 잠시 후 다시'));
  };
  const submit = () => {
    const a = answer.trim();
    if (!a) { persist(exchanges); setDone(true); return; }
    const ex = [...exchanges, { q: question, a }];
    setExchanges(ex); setAnswer(''); persist(ex);
    rgTrack('answer_saved', { book_id: sentence.bookId || '', lens: 'why', answer_length: a.length });
    archiveCompanion(sentence.bookId, sentence.text, question, a); // 서버 아카이브 (#295)
    if (ex.length >= MAX || consent !== 'yes') { setQuestion(null); setDone(true); return; }
    setLoading(true); setQuestion(null); setRated(null);
    genCompanionFollowup(sentence.text, ex, bt, au, sentence.kind).then((q) => { setQuestion(q); setLoading(false); });
  };
  // 질문 재생성 (#372) / 평가 (#371)
  const regen = () => {
    if (loading || !question) return;
    const cur = question;
    rgTrack('companion_q_regen', { book_id: sentence.bookId || '' });
    setLoading(true); setQuestion(null); setRated(null);
    const gen = exchanges.length ? genCompanionFollowup(sentence.text, exchanges, bt, au, sentence.kind, cur)
      : genCompanionQuestion(sentence.text, bt, au, sentence.kind, cur);
    gen.then((q) => { setQuestion(q); setLoading(false); });
  };
  const rate = (val) => { rgTrack('companion_q_rated', { book_id: sentence.bookId || '', value: val }); setRated(val); };
  return ReactDOM.createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', width: '100%', maxWidth: 430, maxHeight: '85vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 8px' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--brand-3)' }}>🐦 혼자만의 독서모임</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-3)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 18px' }}>
          {editing ? (
            <div style={{ marginBottom: 12 }}>
              {/* 인용↔내 의견 토글 (#381) — 편집 시 종류 변경 */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {[['quote', '📖 책 속 문장'], ['thought', '💭 내 생각']].map(([k, label]) => (
                  <button key={k} onClick={() => setSkind(k)}
                    style={{ padding: '5px 12px', borderRadius: 12, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                      background: skind === k ? 'var(--brand)' : 'var(--paper-2)', color: skind === k ? '#fff' : 'var(--ink-3)' }}>{label}</button>
                ))}
              </div>
              <textarea value={stext} onChange={(e) => { if (e.target.value.length <= 1000) setStext(e.target.value); }} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--brand)', borderRadius: 10, padding: 10, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => { setStext(sentence.text || ''); setSkind(sentence.kind === 'thought' ? 'thought' : 'quote'); setEditing(false); }} style={{ flex: '0 0 auto', padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--line)', background: 'transparent', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>취소</button>
                <button onClick={saveText} style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>저장</button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', fontSize: 14, fontStyle: skind === 'thought' ? 'normal' : 'italic', color: 'var(--ink)', lineHeight: 1.5, padding: '10px 52px 10px 12px', background: 'var(--paper-2)', borderRadius: 10, marginBottom: 12 }}>
              {skind === 'thought' ? `💭 ${sentence.text}` : `"${sentence.text}"`}
              <span style={{ position: 'absolute', top: 6, right: 8, display: 'flex', gap: 6 }}>
                <button onClick={() => { setStext(sentence.text || ''); setEditing(true); }} title="문장 수정" aria-label="문장 수정"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.6, padding: 0 }}>✏️</button>
                <button onClick={delQuote} title="이 한 문장 삭제" aria-label="삭제"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.6, padding: 0 }}>🗑</button>
              </span>
            </div>
          )}
          {exchanges.map((e, ei) => (
            <div key={ei} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.5 }}>{e.q}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--line)', lineHeight: 1.5 }}>{e.a}</div>
            </div>
          ))}
          {done ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>🐦 대화 저장됨</div>
          ) : loading ? (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>참새가 곰곰이 생각 중…</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.55 }}>{question}</div>
                <div style={{ flex: '0 0 auto', display: 'flex', gap: 4, fontSize: 13 }}>
                  <button onClick={() => rate('up')} title="좋은 질문" aria-label="좋아요" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: rated === 'up' ? 1 : 0.45 }}>👍</button>
                  <button onClick={() => rate('down')} title="별로예요" aria-label="싫어요" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: rated === 'down' ? 1 : 0.45 }}>👎</button>
                  <button onClick={regen} title="다른 질문" aria-label="다른 질문" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.55 }}>🔄</button>
                </div>
              </div>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="떠오르는 대로 답해보세요" rows={2}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--line)', borderRadius: 10, padding: 10, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => { persist(exchanges); setDone(true); }} style={{ flex: '0 0 auto', padding: '9px 14px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>마치기</button>
                <button onClick={submit} style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{exchanges.length >= MAX - 1 ? '답 남기고 마치기' : '답하고 이어가기'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>, document.body);
}
window.CompanionModal = CompanionModal;
