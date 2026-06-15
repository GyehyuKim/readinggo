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

// 한 문장 종류(인용/내 생각) 휴리스틱 추정 (#420) — 기본 quote 오분류 완화.
// 따옴표로 시작/끝나면 인용으로 보고, "~같다/닮았다/생각한다/느꼈다" 등 메타·1인칭 서술이나
// 다른 작가·작품명 언급이면 내 생각(thought)로 제안. 토글 prefill용 — 사용자가 직접 고치면 덮어쓰지 않음.
function estimateSentenceKind(text) {
  const t = (text || '').trim();
  if (!t) return 'quote';
  // 따옴표로 감싸진 문장 — 인용 유지
  const quoteWrapped = /^["'“‘『「《].*["'”’』」》]$/.test(t);
  if (quoteWrapped) return 'quote';
  // 메타·1인칭·비교 서술 — 내 생각으로 제안
  const thoughtPattern = /(같다|닮았다|닮은|떠올랐다|떠오른다|생각이?\s*들었다|생각한다|느꼈다|느낀다|느껴졌다|싶다|것\s*같(아|네|다)|작가|작품|소설|이\s*책|이\s*문장|나는|내가|저는|제가)/;
  if (thoughtPattern.test(t)) return 'thought';
  return 'quote';
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
            placeholder="책에서 마음에 남은 한 문장을 옮겨 적어보세요."
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
  // nestUp(레벨업) 시 2-step: 0=일반 체크인 화면, 1=둥지 진화 축하 화면 (#426)
  const [step, setStep] = _useState(0);
  // 둥지 진척도 bar — 체크인 전(prevXp) → 후(newXp) 애니메이션. mount 후 다음 프레임에 목표값으로 전환.
  const [barPct, setBarPct] = _useState(null);
  if (!data) return null;
  const { xpGain, xpParts, sentence, nestUp, castleGained, castleCount, prevLv, newLv, prevXp, newXp, pagesAdded, isNewDay, wasReset, isComplete } = data;
  let leadText;
  if (!isNewDay && !wasReset) {
    leadText = `+${pagesAdded}쪽 추가 기록 · 오늘은 이미 짹 완료 🐦`;
  } else {
    leadText = `+${pagesAdded}쪽 읽었어요`;
  }
  // 진화 축하 화면(step 1) 트리거: 단계 상승(nestUp) 또는 성 획득(castleGained).
  // 성 획득 시엔 둥지가 Lv4(다정한 집) → Lv5(참새의 성 🏰) 으로 완성되는 연출.
  const evoUp = nestUp || castleGained;
  const prevStage = evoUp ? (castleGained ? NEST_STAGES[3] : NEST_STAGES[prevLv - 1]) : null;
  const nowStage  = evoUp ? (castleGained ? NEST_STAGES[4] : NEST_STAGES[newLv  - 1]) : null;

  const startPct = _xpProg(prevXp != null ? prevXp : newXp);
  const endPct   = _xpProg(newXp != null ? newXp : prevXp);
  const curStage = getNestStageByXp(newXp != null ? newXp : prevXp);

  _useEffect(() => {
    setBarPct(startPct);
    const t = setTimeout(() => setBarPct(endPct), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 진화 축하 화면 (step 1) — prevStage → nowStage 시각화 + [계속 →].
  // 성 획득(castleGained)이면 Lv4 → Lv5(🏰) 완성 연출, 아니면 단계 상승 연출.
  if (step === 1 && evoUp && prevStage && nowStage) {
    const evoCopy = castleGained ? getEvolutionCopy(4, 5) : getEvolutionCopy(prevLv, newLv);
    return (
      <div className="ceremony show">
        <div className="inner">
          <h2>{castleGained ? '🏰 성을 완성했어요!' : '✨ 둥지가 진화했어요!'}</h2>
          {castleGained && <div className="nest-evo-copy">{castleCount}번째 성 · 다음 둥지가 새로 시작돼요</div>}
          <div className="nest-evo">
            <div className="nest-evo-stage">
              <img className="nest-evo-img" src={`assets/nest/lv${prevStage.lv}.png`} alt="" referrerPolicy="no-referrer" draggable="false" />
              <span className="em">{prevStage.short}</span>
              <div className="name">{prevStage.name}</div>
            </div>
            <div className="nest-evo-arrow">→</div>
            <div className="nest-evo-stage now">
              <img className="nest-evo-img" src={`assets/nest/lv${nowStage.lv}.png`} alt="" referrerPolicy="no-referrer" draggable="false" />
              <span className="em">{nowStage.short}</span>
              <div className="name">{nowStage.name}</div>
            </div>
          </div>
          {evoCopy && <div className="nest-evo-copy">{evoCopy}</div>}
          <button
            className="next-btn"
            onClick={() => {
              if (isComplete && onComplete) {
                onComplete({ rating: rating || null, review_text: reviewText.trim() || null });
              }
              onClose();
            }}
          >
            계속 →
          </button>
        </div>
      </div>
    );
  }

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

        <div className="nest-progress">
          <img className="nest-progress-img" src={`assets/nest/lv${curStage.lv}.png`} alt="" referrerPolicy="no-referrer" draggable="false" />
          <div className="nest-progress-head">
            <span className="em">{curStage.short}</span>
            <span className="name">{curStage.name}</span>
          </div>
          <div className="nest-progress-bar">
            <span className="nest-progress-fill" style={{ width: (barPct != null ? barPct : startPct) + '%' }} />
          </div>
          <div className="nest-progress-sub">
            {castleGained ? '🏰 1,600 XP 달성 — 성을 완성했어요!' : (endPct >= 100 ? '곧 1,600 XP — 성이 완성돼요!' : `성까지 ${100 - endPct}% 남았어요`)}
          </div>
        </div>

        {isComplete && (
          <div className="complete-review">
            <div className="complete-head">🏰 완독을 축하해요! 이 책, 어땠나요?</div>
            {/* 반별점 0.5 (#153): 별 우측 절반 탭=정수, 좌측 절반 탭=0.5 */}
            <div className="rating-stars" role="radiogroup" aria-label="별점 (0.5 단위, 선택)">
              {[1, 2, 3, 4, 5].map(n => {
                const fillPct = Math.max(0, Math.min(1, rating - (n - 1))) * 100; // 이 별 채움 0/50/100%
                return (
                  <span key={n} className="rating-star" aria-label={`${n}점`}>
                    <span className="rating-star-empty">★</span>
                    <span className="rating-star-fill" style={{ width: fillPct + '%' }}>★</span>
                    <button type="button" className="rating-star-hit left" role="radio" aria-checked={rating === n - 0.5}
                      aria-label={`${n - 0.5}점`} onClick={() => setRating(rating === n - 0.5 ? 0 : n - 0.5)} />
                    <button type="button" className="rating-star-hit right" role="radio" aria-checked={rating === n}
                      aria-label={`${n}점`} onClick={() => setRating(rating === n ? 0 : n)} />
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
            if (evoUp && prevStage && nowStage) {
              setStep(1);
              return;
            }
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

function NestTheatre({ xp, health = 100 }) {
  // 둥지 = 누적 활동(XP). 책 진척률 아님 (#313). pct = 현재 레벨 내 진행도.
  const [showGuide, setShowGuide] = _useState(false); // 둥지 단계 안내 팝업 (#511)
  const pct = _xpProg(xp);                 // 현재 주기 진행 % (cycleXp / 1600)
  const stage = getNestStageByXp(xp);      // 둥지 단계 = 현재 주기 XP (#520)
  const { next } = nestInfo(stage.lv);
  // 둥지 라벨 — 상단바 레벨/스트릭은 헤더로 일원화(#425/#428). 둥지는 단계 + 현재 주기 XP 만.
  const cycleXp = nestCycleXp(xp);
  // 둥지 일러스트는 진척률(stage.lv)로 그린다. health 는 §6.2 시각 상태(흔들림/균열)용.
  const hp = Math.max(0, Math.min(100, Math.round(health)));
  const hstate = nestVisualState(hp);

  return (
    <div
      className={`nest-theatre nest-img-mode ${hstate.cls}`}
      style={{'--health': pct, '--decay': hstate.decay, '--stage-color': stage.color}}
    >
      {/* LV·🔥 배지 제거 (#428·#425) — 레벨/스트릭은 상단바·프로필 헤더로 일원화 */}

      {/* #471: XP 진척 정보·bar를 캐릭터 이미지 위로 */}
      <div className="nest-meta">
        <div className="nest-name-row">
          <div className="nest-name">
            <span>{stage.short} {stage.name}</span>
            {next && (
              <span className="next-arrow">→ {next.short} {next.name}</span>
            )}
            <button onClick={() => setShowGuide(true)} aria-label="둥지 단계 안내" title="둥지가 자라는 방법"
              style={{marginLeft:6, background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', fontSize:13, fontWeight:900, padding:'0 2px', lineHeight:1}}>?</button>
          </div>
          <div className="nest-health-num"><b>{cycleXp.toLocaleString()}</b> / {NEST_CYCLE_XP.toLocaleString()} XP</div>
        </div>
        <div className="nest-health-bar">
          <div className="nest-health-fill" />
        </div>
        <div className="nest-microcopy">
          {stageMicrocopy(pct, stage)}
        </div>
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

      {/* 둥지 단계 안내 팝업 (#511) — 5단계 XP 기준 + 성 획득 사이클. XP 기준은 NEST_STAGES SSOT(#520). */}
      {showGuide && ReactDOM.createPortal(
        <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) setShowGuide(false); }}>
          <div className="sheet" role="dialog" aria-label="둥지 단계 안내">
            <div className="sheet-grip" />
            <button onClick={() => setShowGuide(false)} aria-label="닫기" style={{position:'absolute', top:10, right:14, background:'rgba(0,0,0,0.06)', border:'none', borderRadius:'50%', width:30, height:30, fontSize:16, cursor:'pointer', color:'var(--ink-2)', lineHeight:1, zIndex:2}}>✕</button>
            <div style={{padding:'8px 20px 24px'}}>
              <div style={{textAlign:'center', fontSize:18, fontWeight:900, color:'var(--ink)', marginBottom:4}}>둥지가 자라는 방법</div>
              <div style={{textAlign:'center', fontSize:13, color:'var(--ink-2)', fontWeight:700, marginBottom:16}}>활동하면 XP가 쌓이고 둥지가 자라요!</div>
              {NEST_STAGES.map(s => (
                <div key={s.lv} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background: s.lv === stage.lv ? 'var(--brand-tint)' : 'transparent', marginBottom:4}}>
                  <span style={{fontSize:22, lineHeight:1}}>{s.short}</span>
                  <span style={{flex:1, fontSize:14, fontWeight:800, color:'var(--ink)'}}>{s.name}</span>
                  <span style={{fontSize:12, color:'var(--ink-3)', fontWeight:700}}>{s.maxXp == null ? `${s.minXp.toLocaleString()} XP` : `${s.minXp.toLocaleString()}–${s.maxXp.toLocaleString()} XP`}</span>
                </div>
              ))}
              <div style={{marginTop:14, padding:'12px 14px', background:'var(--brand-tint)', border:'1px solid var(--brand)', borderRadius:8, fontSize:13, color:'var(--brand-3)', fontWeight:800, lineHeight:1.6, textAlign:'center'}}>
                🏰 1,600 XP 달성 → 성 획득! 다시 나뭇가지 자리부터 새 둥지를 시작해요.
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── NestView ─────────────────────────────────────────── */
/* ── 짹(Jacky) 대화 헬퍼 (#184 읽기모드/타이머 폐기 #505 — 빠른입력·CompanionModal 공용) ── */
// 짹(Jacky) 대화 (companion.md §4) — Worker /api/companion(solar-pro3) 호출. 실패/키없음 시 목 폴백.
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
      body: JSON.stringify({ sentence, bookTitle: bookTitle || '', author: author || '', kind: kind || 'quote', avoid: avoid || '', preset: (window.RG_companionPreset ? window.RG_companionPreset.get() : '') }),
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
      body: JSON.stringify({ sentence, bookTitle: bookTitle || '', author: author || '', exchanges, kind: kind || 'quote', avoid: avoid || '', preset: (window.RG_companionPreset ? window.RG_companionPreset.get() : '') }),
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

// 책 사진 OCR — 드래그 영역 선택 v2 (#396). 사진에서 원하는 구절만 사각형으로 골라
// 그 영역만 잘라 OCR → 배경 잡음·두 페이지 인터리빙(벤치마크 #395) 근본 회피.
function OcrCropOverlay({ file, onCancel, onCrop }) {
  const { useState: uS, useRef: uR, useEffect: uE } = React;
  const [url, setUrl] = uS(null);          // EXIF 정규화한 정방향 이미지 URL
  const [imgGeo, setImgGeo] = uS(null);   // 박스 기준 이미지 렌더 위치 {left,top,width,height}
  const [sel, setSel] = uS(null);          // 선택 사각형(이미지 좌표 기준) {x,y,w,h}
  const imgRef = uR(null), boxRef = uR(null), dragRef = uR(null);
  // EXIF orientation 정규화(#421): <img>는 EXIF로 회전 표시되지만 naturalWidth/Height·canvas drawImage는
  // 원시 픽셀(미회전)이라 crop 좌표가 90도 어긋나 누운 이미지가 OCR로 전송됨 → 글자 순서 붕괴.
  // 진입 시 정방향 비트맵을 캔버스로 재인코딩해, 보이는 것=자르는 것=보내는 것을 일치시킨다.
  uE(() => {
    let u = null, alive = true;
    (async () => {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const cv = document.createElement('canvas');
        cv.width = bmp.width; cv.height = bmp.height;
        cv.getContext('2d').drawImage(bmp, 0, 0);
        if (bmp.close) bmp.close();
        const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.95));
        u = URL.createObjectURL(blob || file);
      } catch (e) {
        u = URL.createObjectURL(file);   // createImageBitmap 미지원/실패 — 원본 폴백(무중단)
      }
      if (alive) setUrl(u);
      else { try { URL.revokeObjectURL(u); } catch (e) {} }
    })();
    return () => { alive = false; try { if (u) URL.revokeObjectURL(u); } catch (e) {} };
  }, [file]);
  const measure = () => {
    if (!imgRef.current || !boxRef.current) return;
    const ir = imgRef.current.getBoundingClientRect(), br = boxRef.current.getBoundingClientRect();
    setImgGeo({ left: ir.left - br.left, top: ir.top - br.top, width: ir.width, height: ir.height });
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ptXY = (e) => {
    const ir = imgRef.current.getBoundingClientRect();
    return { x: clamp(e.clientX - ir.left, 0, ir.width), y: clamp(e.clientY - ir.top, 0, ir.height) };
  };
  const onDown = (e) => { if (!imgRef.current) return; const p = ptXY(e); dragRef.current = p; setSel({ x: p.x, y: p.y, w: 0, h: 0 }); };
  const onMove = (e) => { if (!dragRef.current) return; e.preventDefault(); const p = ptXY(e), s = dragRef.current; setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); };
  const onUp = () => { dragRef.current = null; };
  const doCrop = (whole) => {
    const img = imgRef.current; if (!img) return;
    const r = img.getBoundingClientRect();
    const sX = img.naturalWidth / r.width, sY = img.naturalHeight / r.height;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (!whole && sel && sel.w >= 8 && sel.h >= 8) { sx = sel.x * sX; sy = sel.y * sY; sw = sel.w * sX; sh = sel.h * sY; }
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(sw)); cv.height = Math.max(1, Math.round(sh));
    cv.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    cv.toBlob((blob) => { if (blob) onCrop(blob); }, 'image/jpeg', 0.92);
  };
  const hasSel = sel && sel.w >= 8 && sel.h >= 8;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.94)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 6px', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>가져올 글귀를 드래그로 선택</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>한 구절만 감싸면 배경·옆 페이지 없이 깔끔해요</div>
      </div>
      <div ref={boxRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none', margin: '8px 12px' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        {url
          ? <img ref={imgRef} src={url} alt="" onLoad={measure} draggable={false}
              style={{ position: 'absolute', inset: 0, margin: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }} />
          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>이미지 준비 중…</div>}
        {hasSel && imgGeo && (
          <div style={{ position: 'absolute', left: imgGeo.left + sel.x, top: imgGeo.top + sel.y, width: sel.w, height: sel.h, border: '2px solid var(--brand)', background: 'rgba(63,209,127,0.18)', borderRadius: 4, pointerEvents: 'none' }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px 18px' }}>
        <button onClick={onCancel} style={{ flex: '0 0 auto', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>취소</button>
        <button onClick={() => doCrop(true)} style={{ flex: '0 0 auto', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>전체</button>
        <button onClick={() => doCrop(false)} disabled={!hasSel} style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', background: hasSel ? 'var(--brand)' : 'rgba(255,255,255,0.15)', color: hasSel ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 900, fontSize: 14, cursor: hasSel ? 'pointer' : 'default' }}>{hasSel ? '✨ 선택 영역 추출' : '영역을 드래그하세요'}</button>
      </div>
    </div>
  );
}


// 책 정보 수정 모달 (#410) — 출판사·총 페이지수 편집. updateBook 후 onSaved(total)로 둥지 진척 즉시 반영.
function BookEditModal({ book, onClose, onSaved }) {
  const [pub, setPub] = _useState((book.pub || book.publisher || '').trim());
  const [total, setTotal] = _useState(String(book.total || 0));
  const save = () => {
    const tp = Math.max(0, parseInt(total, 10) || 0);
    const finish = (ubId) => {
      // 저장 완료 후 서재 목록 갱신 신호(#512) — 데이터층(override 병합)은 정상이나,
      // 다른 책장 변경(app.js)과 달리 이 모달만 'rg:wish-changed'를 안 쏴서 LibraryView 가
      // stale 상태로 남아 출판사·총 페이지 수정이 내 서재에 미반영되던 버그. 신호로 reload 트리거.
      if (ubId && DataStore.myBooks && DataStore.myBooks.updateBook) {
        Promise.resolve(DataStore.myBooks.updateBook(ubId, { publisher: pub.trim(), total_pages: tp }))
          .then(() => { window.dispatchEvent(new CustomEvent('rg:wish-changed')); })
          .catch(() => {});
      } else {
        window.dispatchEvent(new CustomEvent('rg:wish-changed'));
      }
      onSaved && onSaved({ pub: pub.trim(), total: tp });
      showToast('✏️ 책 정보 수정됨');
      onClose();
    };
    // 활성 책의 user_book id 확보 후 저장.
    Promise.resolve(DataStore.activeBook.get()).then((ub) => finish(ub && ub.id)).catch(() => finish(null));
  };
  return ReactDOM.createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', width: '100%', maxWidth: 430, borderRadius: '20px 20px 0 0', padding: '18px 18px 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>책 정보 수정</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>출판사</label>
        <input value={pub} onChange={(e) => setPub(e.target.value)} placeholder="출판사"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', margin: '6px 0 14px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, fontWeight: 700 }} />
        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>총 페이지수</label>
        <input value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="예: 341"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', margin: '6px 0 16px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: 14, fontWeight: 700 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: '0 0 auto', padding: '12px 18px', borderRadius: 12, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>취소</button>
          <button onClick={save} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>저장</button>
        </div>
      </div>
    </div>, document.body);
}

function NestView({ state, onCheckin, onSimSkip, onGoLibrary, onOpenSearch, onArchive }) {
  const [modalOpen, setModalOpen] = _useState(false);
  // 빠른 입력 (#462) — '읽기 시작' 버튼 없이 홈에서 페이지·한 문장 상시 입력. 타이머는 [⏱시작]으로 선택.
  const [quickPage, setQuickPage] = _useState('');
  const [quickText, setQuickText] = _useState('');
  // 빠른입력 OCR (#498) — 책 사진 → quickText 프리필
  const [quickOcrBusy, setQuickOcrBusy] = _useState(false);
  const [quickOcrFile, setQuickOcrFile] = _useState(null);
  const _quickOcrInputRef = _useRef(null);
  const [checkedToday, setCheckedToday] = _useState(false); // 오늘 짹 완료 — 읽기모드/체크인 후 중복 CTA 숨김 (#203)
  const [readingBooks, setReadingBooks] = _useState([]);  // 캐러셀용 읽는 중 책 (#185)
  const [bookEditOpen, setBookEditOpen] = _useState(false); // 책 정보 수정 모달 (#410)
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

  const handleCheckin = ({ page, sentence, kind }) => {
    setModalOpen(false);
    setCheckedToday(true); // 오늘의 짹 완료 (#203)
    const ns = { ...nestState };
    const pagesAdded = Math.max(0, page - ns.book.cur);
    const wasReset = ns.streak === 0;
    const prevPct = _pctOf(ns.book);            // 책 진척(완독 판정용)
    const prevXp = ns.xp;
    const prevLv = getNestStageByXp(prevXp).lv; // 둥지 단계 = 현재 주기 XP (#520)
    const prevCastles = nestCastleCount(prevXp); // 성 개수 = floor(totalXp/1600) (#520/#521)

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
    const newCastles = nestCastleCount(ns.xp);
    const castleGained = newCastles > prevCastles; // 1,600 XP 경계 통과 → 성 획득(#520/#521)

    if (sentence) {
      ns.myQuotes = [{ text: sentence, bookId: ns.book.id, page, when: '방금', kind: kind || 'quote' }, ...ns.myQuotes];
    }

    prevTwigsRef.current = twigsForProgress(_xpProg(prevXp));
    setNestState(ns);
    onCheckin(ns, newLv, xpGain, sentence, kind);

    // 성 획득(1,600 주기 완료)은 단계 toast보다 우선 — 경계 통과 시 둥지 단계는 Lv4→Lv1로
    // 리셋되어 nestUp=false 이므로, 성 획득은 별도로 안내한다 (#520/#521).
    if (castleGained) {
      showToast(`🏰 전설의 참새 성주! ${newCastles}번째 성을 완성했어요`);
    } else if (nestUp) {
      const copy = getEvolutionCopy(prevLv, newLv);
      if (copy) showToast(`${getNestStageByXp(ns.xp).short} ${copy}`);
    }

    setCeremony({ xpGain, xpParts: xpReward.parts, streak: ns.streak, sentence, nestUp, castleGained, castleCount: newCastles, prevLv, newLv, prevXp, newXp: ns.xp, pagesAdded, isNewDay: true, wasReset, isComplete });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  };

  // 빠른 기록 (#462) — 홈 상시 입력 폼에서 페이지/한 문장을 한 번에 체크인.
  // handleCheckin 단일 경로 재사용 → 스트릭·XP·세리머니·문장 영속(app onCheckin)·companion(#438) 보존.
  // 빠른입력 OCR (#498) — Upstage OCR + solar-pro3 → quickText 프리필(원하는 부분만 남기고 저장).
  const runOcrQuick = (file) => {
    if (!file || quickOcrBusy) return;
    if (file.size > 8 * 1024 * 1024) { showToast('이미지가 너무 커요(최대 8MB)'); return; }
    setQuickOcrBusy(true);
    showToast('📷 사진에서 글자를 읽는 중…');
    const fd = new FormData();
    fd.append('document', file, file.name || 'page.jpg');
    fetch('/api/ocr', { method: 'POST', body: fd })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.text) {
          setQuickText((cur) => (cur && cur.trim() ? cur.trim() + '\n' + d.text : d.text).slice(0, 1000));
          showToast('✨ 추출했어요 — 원하는 부분만 남기고 저장하세요');
          rgTrack('ocr_extracted', { book_id: nestState.book.id, chars: d.text.length });
        } else if (d && d.empty) {
          showToast('글자를 찾지 못했어요 — 더 또렷한 사진으로');
        } else {
          showToast('추출 실패 — 잠시 후 다시 시도해요');
        }
      })
      .catch(() => showToast('추출 실패 — 네트워크를 확인해요'))
      .finally(() => setQuickOcrBusy(false));
  };

  const submitQuick = () => {
    const t = quickText.trim();
    const total = nestState.book.total || 0;
    const cur = nestState.book.cur || 0;
    const raw = quickPage === '' ? cur : (parseInt(quickPage, 10) || 0);
    const p = Math.max(cur, total ? Math.min(total, raw) : raw); // 진도는 현재 이상으로만
    if (!t && p <= cur) { showToast('쪽수를 넘기거나 한 문장을 남겨보세요'); return; }
    handleCheckin({ page: p, sentence: t || null, kind: 'quote' });
    setQuickText(''); setQuickPage('');
  };

  // 데모 '하루 거르기' 핸들러 폐기 (#481) — onSimSkip prop은 하위호환 위해 시그니처에 유지(미사용).

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

  // 오늘의 한 문장 (#436·#480) — 현재 선택한 책 + 오늘 작성분만 최신순. 고양감: '이 책에 오늘 내가 남긴 것'.
  const _todayStr = new Date().toDateString();
  const todayQuotes = (nestState.myQuotes || []).filter((q) => {
    if (q.bookId !== nestState.book.id) return false;   // 현재 선택한 책만 (#480)
    if (q.when === '방금') return true;            // 이번 세션 방금 저장분
    if (!q.createdAt) return false;
    try { return new Date(q.createdAt).toDateString() === _todayStr; } catch (e) { return false; }
  });

  // 활성 책 없음(신규/미등록): 데모책 대신 '책 등록' 온보딩 — 유령 책 체크인(영속 실패) 방지.
  if (!nestState.book || !nestState.book.id) {
    return (
      <section className="view active">
        <div className="card book-card-wrap">
          {/* '내 서재' 버튼 제거 (#410) — 하단 탭바로 충분. 책 없으면 ⚙️도 없음. */}
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
        {readingBooks.length > 1 && (
          <>
            <button onClick={() => switchBook(-1)} aria-label="이전 책" style={{ position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer' }}>‹</button>
            <button onClick={() => switchBook(1)} aria-label="다음 책" style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer' }}>›</button>
            <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4, zIndex: 3 }}>
              {readingBooks.map((b, i) => <span key={b.id || i} style={{ width: 5, height: 5, borderRadius: '50%', background: b.id === nestState.book.id ? 'var(--brand)' : 'var(--line-2, #ccc)' }} />)}
            </div>
          </>
        )}
        {/* 책 정보 탭 → 책 상세 모달(BookInfoModal) 진입 (#495). ⚙️ 수정 버튼은 stopPropagation으로 격리. */}
        <div className="book-card" role="button" tabIndex={0} aria-label="책 상세 정보 보기"
          style={{ cursor: (nestState.book.id && window.RG_openBook) ? 'pointer' : 'default' }}
          onClick={() => { if (nestState.book.id && window.RG_openBook) window.RG_openBook(nestState.book.id); }}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && nestState.book.id && window.RG_openBook) { e.preventDefault(); window.RG_openBook(nestState.book.id); } }}>
          <BookCover className="book-cover" title={nestState.book.title} author={nestState.book.author} cover={nestState.book.cover} fb={nestState.book.fb} />
          <div className="book-meta">
            <div className="book-title-row">
              <p className="book-title">{nestState.book.title}</p>
              {/* 책 정보 수정 (#410) — 제목과 같은 행에서 현재 책 편집 맥락을 명확히 표시. */}
              <button className="book-jump" onClick={(e) => { e.stopPropagation(); setBookEditOpen(true); }} title="책 정보 수정" aria-label="책 정보 수정">
                <span>⚙️</span>
              </button>
            </div>
            <p className="book-author">{[nestState.book.author, nestState.book.pub].map(x => (x || '').trim()).filter(Boolean).join(' · ')}</p>
            <div className="book-progress-row">
              <div className="book-progress">
                <span style={{width: Math.min(100, Math.round(nestState.book.cur / nestState.book.total * 100)) + '%'}} />
              </div>
              <span className="book-progress-num">{nestState.book.cur} / {nestState.book.total}p</span>
            </div>
          </div>
        </div>
      </div>

      {/* 둥지 시어터(NestTheatre)는 프로필 상단으로 이동 (#428) — 홈은 책읽기 중심 */}

      {/* 데모 '하루 거르기' 제거 (#481) */}

      {/* 빠른 입력 (#462·#505) — 홈에서 페이지·한 문장·OCR 상시 입력. 읽기모드(타이머) 폐기. */}
      <div className="quick-log">
          {/* 페이지 진도 */}
          <div className="quick-sec">
            <div className="quick-sec-head">
              <span>📖 오늘의 독서</span>
            </div>
            <div className="quick-stepper">
              <button onClick={() => setQuickPage((s) => String(Math.max(0, (parseInt(s, 10) || nestState.book.cur || 0) - 1)))} aria-label="이전 쪽">−</button>
              <input type="number" inputMode="numeric" value={quickPage} placeholder={String(nestState.book.cur || 0)} onChange={(e) => setQuickPage(e.target.value)} />
              <button onClick={() => setQuickPage((s) => String((parseInt(s, 10) || nestState.book.cur || 0) + 1))} aria-label="다음 쪽">+</button>
              {nestState.book.total > 0 && <span className="quick-total">/ {nestState.book.total}p</span>}
            </div>
          </div>
          {/* 한 문장 */}
          <div className="quick-sec">
            <div className="quick-sec-head"><span>✏️ 한 문장 남기기 <small>(선택)</small></span></div>
            <textarea value={quickText} onChange={(e) => { if (e.target.value.length > 1000) return; setQuickText(e.target.value); }}
              placeholder="떠오른 한 문장을 옮겨 적어요…" rows={2} />
            {/* 책 사진 OCR (#498) — 사진 선택 → 크롭 영역만 OCR → quickText 프리필 */}
            <input ref={_quickOcrInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) setQuickOcrFile(f); e.target.value = ''; }} />
            <button className="quick-ocr" onClick={() => { if (!quickOcrBusy && _quickOcrInputRef.current) _quickOcrInputRef.current.click(); }} disabled={quickOcrBusy}>
              {quickOcrBusy ? '읽는 중…' : '📷 촬영해서 입력'}
            </button>
          </div>
          <button className="checkin-cta quick-submit" onClick={submitQuick}>✨ 오늘 기록하기</button>
          {/* 크롭 오버레이 — 사진에서 원하는 영역만 잘라 OCR (#396·#498) */}
          {quickOcrFile && (
            <OcrCropOverlay file={quickOcrFile} onCancel={() => setQuickOcrFile(null)} onCrop={(blob) => { setQuickOcrFile(null); runOcrQuick(blob); }} />
          )}
        </div>

      {/* '오늘 기록 완료 · N일 연속' nudge 제거 (#481) */}

      {/* 시간차 되감기 카드 (#346) */}
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
              짹과 다시 대화하기
            </button>
            <button onClick={resurfaceLater}
              style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 오늘의 한 문장 (#436) — 현재 책·오늘 작성분 최신순 → 고양감. */}
      <div className="section-head">
        <h3>🔖 이 책, 오늘의 한 문장 <span className="my-q-count">{todayQuotes.length}</span></h3>
        {nestState.myQuotes.length > 0 && (
          <button className="more" onClick={() => window.RG_openCollection && window.RG_openCollection()}>
            전체 문장 보기 →
          </button>
        )}
      </div>
      {todayQuotes.length === 0 ? (
        <div className="my-q-empty">
          <span className="ico">🐦</span>
          오늘 만난 한 줄을 짹 해보세요.<br />
          오늘 남긴 문장이 여기 쌓여요.
        </div>
      ) : (
        todayQuotes.slice(0, 10).map((q, i) => {
          // getBook 은 미스 시 RG_BOOKS[0](=사피엔스)로 폴백하므로, id가 실제 일치할 때만 그 제목을 씀(사피엔스버그).
          const _bk = getBook(q.bookId);
          const bkTitle = q.bookTitle || (_bk && _bk.id === q.bookId ? _bk.title : '') || '책';
          // 홈 문장 카드에서 AI 대화 진입 허용 (#469) — 체크인 직후·책 상세 경로(#438)에 더해 발견성 보강.
          return (
            <div key={i} className="my-q-card">
              <div className="meta">
                <span className="bk">{bkTitle}</span>
                <span className="dot">·</span>
                <span>{q.page}p</span>
                {q.when ? <span className="dot">·</span> : null}
                {q.when ? <span>{q.when}</span> : null}
              </div>
              <div className="quote" style={q.kind === 'thought' ? { fontStyle: 'normal' } : null}>{q.kind === 'thought' ? `💭 ${q.text}` : `"${q.text}"`}</div>
              {q.id && (
                <button className="q-ai" onClick={() => window.RG_openCompanion && window.RG_openCompanion({ id: q.id, text: q.text, bookId: q.bookId, bookTitle: bkTitle, page: q.page, note: q.note, kind: q.kind })}>🐦 짹과 대화하기</button>
              )}
            </div>
          );
        })
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
      {/* 책 정보 수정 (#410) — ⚙️ 진입. 저장 시 둥지 진척(total) 즉시 반영 */}
      {bookEditOpen && nestState.book && nestState.book.id && (
        <BookEditModal book={nestState.book} onClose={() => setBookEditOpen(false)}
          onSaved={({ pub, total }) => setNestState((ns) => ({ ...ns, book: { ...ns.book, pub: pub, total: total || ns.book.total } }))} />
      )}
    </section>
  );
}

window.NestView = NestView;
window.NestTheatre = NestTheatre;

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
  const _compTailRef = _useRef(null);                      // 대화 말단 anchor (#407 화면 점프 방지)
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
  // 새 질문·답변·로딩 변화 시 대화 말단을 view로 — 답변 생성에 의한 화면 점프·오탭 방지 (#407)
  _useEffect(() => {
    try { _compTailRef.current && _compTailRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {}
  }, [question, loading, done, exchanges.length]);
  const persist = (ex) => {
    if (!sentence.id || !(DataStore.sentences && DataStore.sentences.setNote)) return;
    if (!ex || !ex.length) return;   // 빈 대화로 기존 my_note 덮어쓰기 방지 (#404)
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
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--brand-3)' }}>🐦 짹과 대화하기</div>
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
          {/* 말풍선 채팅 UI (#435) — 좌=참새 질문, 우=내 답 */}
          {exchanges.map((e, ei) => (
            <div key={ei}>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 6 }}>
                <div style={{ maxWidth: '85%', background: 'rgba(123,224,168,0.16)', borderRadius: '14px 14px 14px 4px', padding: '8px 12px', fontSize: 13.5, fontWeight: 700, lineHeight: 1.5 }}>{e.q}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <div style={{ maxWidth: '85%', background: 'var(--brand)', color: '#fff', borderRadius: '14px 14px 4px 14px', padding: '8px 12px', fontSize: 13, lineHeight: 1.5 }}>{e.a}</div>
              </div>
            </div>
          ))}
          {done ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>🐦 대화 저장됨</div>
          ) : loading ? (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
              <div style={{ maxWidth: '85%', background: 'rgba(123,224,168,0.16)', borderRadius: '14px 14px 14px 4px', padding: '8px 12px', fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>참새가 곰곰이 생각 중…</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                <div style={{ maxWidth: '85%', background: 'rgba(123,224,168,0.16)', borderRadius: '14px 14px 14px 4px', padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.55 }}>{question}</div>
                    <div style={{ flex: '0 0 auto', display: 'flex', gap: 4, fontSize: 13 }}>
                      <button onClick={() => rate('up')} title="좋은 질문" aria-label="좋아요" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: rated === 'up' ? 1 : 0.45 }}>👍</button>
                      <button onClick={() => rate('down')} title="별로예요" aria-label="싫어요" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: rated === 'down' ? 1 : 0.45 }}>👎</button>
                      <button onClick={regen} title="다른 질문" aria-label="다른 질문" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.55 }}>🔄</button>
                    </div>
                  </div>
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
          {/* 말단 anchor (#407) — 새 질문/답변 추가 시 활성 영역을 view로 고정해 화면 점프·오탭 방지 */}
          <div ref={_compTailRef} />
        </div>
      </div>
    </div>, document.body);
}
window.CompanionModal = CompanionModal;
