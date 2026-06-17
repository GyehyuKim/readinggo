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
// 단계 구간 진척 안전 래퍼 (#682) — nestStageProgress 미준비/예외 시 폴백.
function _stageProg(xp) {
  try {
    const fn = (typeof nestStageProgress === 'function') ? nestStageProgress : (window.nestStageProgress || null);
    if (fn) return fn(xp);
  } catch (e) {}
  return { stage: { lv: 1, minXp: 0 }, next: null, intoXp: 0, spanXp: 0, pct: 0, isMax: false };
}

// 한 문장 종류 휴리스틱(estimateSentenceKind, #420) 제거 — '내 생각'(thought) 폐기 (#596). 호출부 없던 죽은 코드.

/* ── CheckinModal ─────────────────────────────────────── */
function CheckinModal({ book, onClose, onSubmit }) {
  const [page, setPage] = _useState(book.cur);
  // 직접입력 문자열 상태 (#686) — page(숫자)와 분리. 빈 문자열·편집 중 부분값 허용,
  // 매 키 입력마다 0으로 강제/클램프하지 않아 백스페이스·커서 편집이 정상 동작.
  const [pageStr, setPageStr] = _useState(String(book.cur));
  const [sentence, setSentence] = _useState('');

  const _maxPage = book.total > 0 ? book.total : 99999; // 쪽수 미상이면 상한 없음 (#204)
  const _clamp = (v) => Math.max(0, Math.min(_maxPage, v));
  const adjustPage = (delta) => {
    setPage(p => { const n = _clamp(p + delta); setPageStr(String(n)); return n; });
  };
  // 입력 중: 숫자만 허용하되 빈 문자열 보존(삭제 가능). page 는 파싱 가능할 때만 따라간다.
  const handleInput = (e) => {
    const raw = e.target.value;
    if (raw === '') { setPageStr(''); return; }      // 빈 값 허용 — 0으로 강제하지 않음
    if (!/^\d+$/.test(raw)) return;                  // 숫자 외 입력 무시(커서 보존)
    setPageStr(raw);
    setPage(_clamp(parseInt(raw, 10)));
  };
  // 포커스 아웃 시 클램프 확정 — 빈 값/범위 밖이면 page 기준으로 표시값 정규화.
  const handleInputBlur = () => {
    const v = pageStr === '' ? page : _clamp(parseInt(pageStr, 10) || 0);
    setPage(v);
    setPageStr(String(v));
  };
  const handleSentence = (e) => {
    if (e.target.value.length <= 1000) setSentence(e.target.value);
  };
  const handleSubmit = () => {
    // 제출 시 입력값 확정 클램프 (#686) — 빈 값/부분 입력은 page 기준 정규화.
    const finalPage = pageStr === '' ? page : _clamp(parseInt(pageStr, 10) || 0);
    if (finalPage === book.cur && sentence.trim().length === 0) {
      showToast('한 쪽도 OK! +1만 눌러봐요 🐦');
      return;
    }
    onSubmit({ page: finalPage, sentence: sentence.trim() });
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
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={pageStr} onChange={handleInput} onBlur={handleInputBlur} />
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
  const { xpGain, xpParts, sentence, bookQuoteCount, nestUp, castleGained, castleCount, prevLv, newLv, prevXp, newXp, pagesAdded, isNewDay, wasReset, isComplete } = data;
  // 이번 체크인에 실제로 한 문장을 등록했는가 (#685) — 페이지만 저장 시 false.
  const savedSentence = !!(sentence && String(sentence).trim());
  let leadText;
  if (savedSentence) {
    // 한 문장 등록: "1개 문장 등록 +N XP" (#685)
    leadText = `1개 문장 등록 +${xpGain} XP`;
  } else if (!isNewDay && !wasReset) {
    leadText = `+${pagesAdded}쪽 추가 기록 · 오늘은 이미 짹 완료 🐦`;
  } else {
    // 페이지만 저장: "책읽기 완료 +N XP" — 거짓 '문장 등록' 표기 금지 (#685)
    leadText = `책읽기 완료 +${xpGain} XP`;
  }
  // 진화 축하 화면(step 1) 트리거: 단계 상승(nestUp) 또는 성 획득(castleGained).
  // 성 획득 시엔 둥지가 Lv4(다정한 집) → Lv5(참새의 성 🏰) 으로 완성되는 연출.
  const evoUp = nestUp || castleGained;
  const prevStage = evoUp ? (castleGained ? NEST_STAGES[3] : NEST_STAGES[prevLv - 1]) : null;
  const nowStage  = evoUp ? (castleGained ? NEST_STAGES[4] : NEST_STAGES[newLv  - 1]) : null;

  // 진척 바는 "현재 단계 구간" 기준 (#685 — #682 헬퍼 재사용). 현재 단계 시작 XP=0, 다음 단계 임계값=분모.
  const startSP = _stageProg(prevXp != null ? prevXp : newXp);
  const endSP   = _stageProg(newXp != null ? newXp : prevXp);
  const startPct = startSP.pct;
  const endPct   = endSP.pct;
  const curStage = endSP.stage;

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
              <span className="em">{window.nestArt(prevStage.lv, 52)}</span>
              <div className="name">{prevStage.name}</div>
            </div>
            <div className="nest-evo-arrow">→</div>
            <div className="nest-evo-stage now">
              <img className="nest-evo-img" src={`assets/nest/lv${nowStage.lv}.png`} alt="" referrerPolicy="no-referrer" draggable="false" />
              <span className="em">{window.nestArt(nowStage.lv, 52)}</span>
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
          {/* 한 문장 카드 (#549) — 문장 입력 시 '저장됨', 미입력 시 거짓 표시 대신 이 책 누적 수/0건 독려 */}
          <div className="reward-card gold">
            <span className="ico">{sentence ? '🔖' : (bookQuoteCount > 0 ? '📖' : '✍️')}</span>
            <div className="val">{sentence ? '저장됨' : (bookQuoteCount > 0 ? `${bookQuoteCount}개` : '0개')}</div>
            <div className="lbl">{sentence ? '한 문장' : (bookQuoteCount > 0 ? '이 책 한 문장' : '한 문장 남겨봐요')}</div>
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
            <span className="em">{window.nestArt(curStage.lv, 48)}</span>
            <span className="name">{curStage.name}</span>
          </div>
          <div className="nest-progress-bar">
            <span className="nest-progress-fill" style={{ width: (barPct != null ? barPct : startPct) + '%' }} />
          </div>
          <div className="nest-progress-sub">
            {castleGained
              ? '🏰 1,600 XP 달성 — 성을 완성했어요!'
              : (endSP.isMax
                  ? '🏰 곧 1,600 XP — 성이 완성돼요!'
                  : (endPct >= 100
                      ? `${endSP.next ? endSP.next.short + ' ' + endSP.next.name : ''} 단계에 도달했어요!`
                      : `${endSP.next ? endSP.next.short + ' ' + endSP.next.name : '다음 단계'}까지 ${Math.max(0, endSP.spanXp - endSP.intoXp).toLocaleString()} XP`))}
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
  if (pct >= 100) return `${stage.name} — 둥지가 진화했어요!`;
  if (pct >= 81)  return `${stage.name} — 다음 둥지가 코앞이에요. 오늘도 한 쪽!`;
  if (pct >= 51)  return `${stage.name} — 둥지가 부쩍 자랐어요. 계속 쌓아봐요.`;
  if (pct >= 21)  return `${stage.name} — 둥지가 모양을 갖춰가요.`;
  return `${stage.name} — 가지를 하나 놓았어요. 활동이 둥지를 키워요.`;
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
  // 진척은 "현재 단계 구간" 기준 (#682) — 현재 단계 시작 XP=0, 다음 단계 임계값=분모.
  const sp = _stageProg(xp);
  const stage = sp.stage;                  // 둥지 단계 = 현재 주기 XP (#520)
  const next = sp.next;
  const pct = sp.pct;                      // 현재 단계 구간 진행 % (intoXp / spanXp)
  // 둥지 일러스트는 진척률(stage.lv)로 그린다. health 는 §6.2 시각 상태(흔들림/균열)용.
  const hp = Math.max(0, Math.min(100, Math.round(health)));
  const hstate = nestVisualState(hp);

  return (
    <div
      className={`nest-theatre nest-img-mode ${hstate.cls}`}
      style={{'--health': pct, '--decay': hstate.decay, '--stage-color': stage.color}}
    >
      <button onClick={() => setShowGuide(true)} aria-label="둥지 단계 안내"
        style={{position:'absolute', top:10, right:10, zIndex:2,
          display:'inline-flex', alignItems:'center', gap:4,
          background:'rgba(255,255,255,0.82)', backdropFilter:'blur(8px)',
          border:'1px solid rgba(255,255,255,0.9)',
          boxShadow:'0 1px 6px rgba(0,0,0,0.10)',
          borderRadius:999, padding:'5px 11px 5px 9px',
          fontSize:11, fontWeight:800, color:'var(--ink-2)',
          cursor:'pointer', letterSpacing:'-0.1px', lineHeight:1}}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 5.5C2.5 2 4 1 5.5 1s3 1 4.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M3 5.5C3.8 3.8 4.6 3 5.5 3s1.7.8 2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="5.5" cy="7.5" r="1" fill="currentColor"/>
        </svg>
        둥지가 자라는 법
      </button>
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
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}>{window.nestArt(stage.lv, 22)} {stage.name}</span>
            {next && (
              <span className="next-arrow" style={{display:'inline-flex', alignItems:'center', gap:4}}>→ {window.nestArt(next.lv, 16)} {next.name}</span>
            )}
          </div>
          <div className="nest-health-num">
            {sp.isMax
              ? <b>최고 단계</b>
              : <span><b>{sp.intoXp.toLocaleString()}</b> / {sp.spanXp.toLocaleString()} XP</span>}
          </div>
        </div>
        <div className="nest-health-bar">
          <div className="nest-health-fill" />
        </div>
        <div className="nest-microcopy" style={{display:'flex', alignItems:'center', gap:6}}>
          {window.nestArt(stage.lv, 18)}<span>{stageMicrocopy(pct, stage)}</span>
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
                  <span style={{display:'inline-flex'}}>{window.nestArt(s.lv, 28)}</span>
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
/* ── 재키(Jacky) 대화 헬퍼 (#184 읽기모드/타이머 폐기 #505 — 빠른입력·CompanionModal 공용) ── */
// 재키(Jacky) 대화 (companion.md §4) — Worker /api/companion(solar-pro3) 호출. 실패/키없음 시 목 폴백.
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
  const [quickSentPage, setQuickSentPage] = _useState('');
  const [sentFlip, setSentFlip] = _useState(false); // 문장 저장 시 일기장 넘기기 효과
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

    // 이 책에서 모은 한 문장 수 (#549) — 세리머니가 거짓 '저장됨' 대신 정직한 누적/독려 표시.
    const bookQuoteCount = (ns.myQuotes || []).filter(q => q.bookId === ns.book.id).length;
    setCeremony({ xpGain, xpParts: xpReward.parts, streak: ns.streak, sentence, bookQuoteCount, nestUp, castleGained, castleCount: newCastles, prevLv, newLv, prevXp, newXp: ns.xp, pagesAdded, isNewDay: true, wasReset, isComplete });
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

  // 입력 페이지 정규화 — 진도는 현재 이상으로만, total 있으면 상한 클램프.
  const _quickTargetPage = () => {
    const total = nestState.book.total || 0;
    const cur = nestState.book.cur || 0;
    const raw = quickPage === '' ? cur : (parseInt(quickPage, 10) || 0);
    return Math.max(cur, total ? Math.min(total, raw) : raw);
  };
  // 페이지 섹션 [업데이트] (#497) — 페이지만 독립 저장. 문장 입력(quickText)은 보존.
  const submitPage = () => {
    const cur = nestState.book.cur || 0;
    const p = _quickTargetPage();
    if (p <= cur) { showToast('현재 쪽보다 더 넘겨보세요'); return; }
    handleCheckin({ page: p, sentence: null, kind: 'quote' });
    setQuickPage(''); // quickText 보존 — 페이지만 업데이트해도 문장 입력창 유지
  };
  // 한 문장 섹션 [저장] (#497) — 문장(+현재 진도) 저장. 페이지 섹션과 독립 동작.
  const submitSentence = () => {
    const t = quickText.trim();
    if (!t) { showToast('한 문장을 입력해주세요'); return; }
    // #589: 한 문장 전용 페이지(quickSentPage) 사용. 비우면 현재 진도. 진도 역행 방지(_quickTargetPage 와 동일 규칙).
    const cur = nestState.book.cur || 0, total = nestState.book.total || 0;
    const raw = quickSentPage === '' ? cur : (parseInt(quickSentPage, 10) || cur);
    const page = Math.max(cur, total ? Math.min(total, raw) : raw);
    handleCheckin({ page, sentence: t, kind: 'quote' });
    setQuickText(''); setQuickSentPage('');
  };
  // 쪽수 stepper (#717) — 빈 값이면 현재 쪽 기준 ±delta, [0, total] 클램프.
  // type="number" 네이티브 스피너가 빈 값(=0)에서 증감해 0으로 점프하던 버그 대체.
  const _stepPage = (setter, delta) => {
    const cur = nestState.book.cur || 0, total = nestState.book.total || 0;
    setter(prev => {
      const base = prev === '' ? cur : (parseInt(prev, 10) || cur);
      let n = base + delta;
      if (n < 0) n = 0;
      if (total) n = Math.min(total, n);
      return String(n);
    });
  };
  const _stepBtn = { width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: '1.5px solid var(--line)', background: 'var(--paper)', color: 'var(--ink-2)', fontSize: 20, fontWeight: 800, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
  const _stepBtnSm = { width: 24, height: 24, flexShrink: 0, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink-2)', fontSize: 15, fontWeight: 800, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

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

  // 이 책 한 문장 (#499) — 현재 책의 전체 기간 최신순(오늘만 아님). 오늘 작성분은 '오늘' 라벨.
  const _todayStr = new Date().toDateString();
  const _isTodayQuote = (q) => {
    if (q.when === '방금') return true;
    if (!q.createdAt) return false;
    try { return new Date(q.createdAt).toDateString() === _todayStr; } catch (e) { return false; }
  };
  const bookQuotes = (nestState.myQuotes || [])
    .filter((q) => q.bookId === nestState.book.id)   // 현재 선택한 책만
    .slice()
    .sort((a, b) => {
      const rank = (q) => (q.when === '방금' ? 'ZZZZ-99' : String(q.createdAt || q.when || ''));
      return rank(b).localeCompare(rank(a));  // 최신순
    });
  // 좋아요(❤️ = claps) 상태 — claps.list 로 favIds 로드 (#499→#641: 자기 문장 좋아요=저장 단일화)
  const [favIds, setFavIds] = _useState(() => new Set());
  _useEffect(() => {
    let alive = true;
    Promise.resolve((DataStore.claps && DataStore.claps.list) ? DataStore.claps.list() : [])
      .then((rows) => { if (alive) setFavIds(new Set((rows || []).map((b) => b.sentence_id))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [nestState.book.id, (nestState.myQuotes || []).length]);
  // #610: 자체 좋아요/삭제 핸들러 폐기 → 공용 SentenceActions 가 담당(아래 '이 책 한 문장' 카드).
  //   favIds 는 SentenceActions fav 초기값 시드용으로만 유지(claps.list 로 로드).

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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
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

      {/* 진도 섹션 */}
      <div style={{ marginTop: 10, background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>오늘은 어디까지 읽으셨나요?</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => _stepPage(setQuickPage, -1)} aria-label="쪽수 1 줄이기" style={_stepBtn}>−</button>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={quickPage} placeholder={String(nestState.book.cur||0)}
              onChange={e => setQuickPage(e.target.value.replace(/[^0-9]/g, ''))}
              style={{ width: 60, textAlign: 'center', fontSize: 26, fontWeight: 900, color: 'var(--ink)', background: 'transparent', border: 'none', borderBottom: '2px solid var(--brand)', outline: 'none', padding: '0 4px 2px', fontFamily: 'inherit' }} />
            <button onClick={() => _stepPage(setQuickPage, 1)} aria-label="쪽수 1 늘리기" style={_stepBtn}>+</button>
          </span>
          {nestState.book.total > 0
            ? <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 700 }}>/ {nestState.book.total}p</span>
            : <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 700 }}>p</span>}
          {nestState.book.total > 0 && (
            <span style={{ fontSize: 12, color: 'var(--brand-3)', fontWeight: 800, background: 'var(--brand-tint)', borderRadius: 20, padding: '3px 10px' }}>
              {Math.min(100, Math.round((parseInt(quickPage,10)||nestState.book.cur||0) / nestState.book.total * 100))}%
            </span>
          )}
          <button onClick={submitPage}
            style={{ marginLeft: 'auto', padding: '7px 20px', borderRadius: 999, background: 'var(--brand)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', flexShrink: 0, letterSpacing: '-0.2px' }}>
            저장하기
          </button>
        </div>
      </div>

      {/* 한 문장 입력 */}
      <div style={{ marginTop: 8, background: 'var(--card)', border: '1.5px solid var(--brand-soft)', borderRadius: 'var(--r-md)', padding: '14px 14px 12px', position: 'relative', transition: 'opacity 0.2s, transform 0.3s', opacity: sentFlip ? 0 : 1, transform: sentFlip ? 'translateY(-10px) scale(0.97)' : 'none' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>마음에 남은 문장이 있나요?</div>
        {/* OCR(사진 입력)은 하단 툴바의 카메라 아이콘 버튼으로 이동 — '···' 메뉴 제거(2026 UI). */}
        <textarea value={quickText} onChange={(e) => { if (e.target.value.length > 1000) return; setQuickText(e.target.value); }}
          placeholder="오늘 읽은 문장을 남겨요…" rows={4}
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', resize: 'none', padding: 0, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          {/* 사진으로 입력(OCR) — SVG 카메라 아이콘 버튼 (2026 UI, '···' 메뉴 대체) */}
          <button onClick={() => { if (!quickOcrBusy && _quickOcrInputRef.current) _quickOcrInputRef.current.click(); }}
            disabled={quickOcrBusy} title="사진으로 입력 (OCR)" aria-label="사진으로 입력 (OCR)"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, flexShrink: 0, borderRadius: 10, border: 'none', background: 'var(--brand-tint)', color: 'var(--brand-3)', cursor: quickOcrBusy ? 'default' : 'pointer', opacity: quickOcrBusy ? 0.5 : 1, padding: 0 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>p</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => _stepPage(setQuickSentPage, -1)} aria-label="쪽수 1 줄이기" style={_stepBtnSm}>−</button>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={quickSentPage}
              placeholder={String(nestState.book.cur || 0)} onChange={(e) => setQuickSentPage(e.target.value.replace(/[^0-9]/g, ''))}
              style={{ width: 44, textAlign: 'center', padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, fontWeight: 700, background: 'var(--paper)' }} />
            <button onClick={() => _stepPage(setQuickSentPage, 1)} aria-label="쪽수 1 늘리기" style={_stepBtnSm}>+</button>
          </span>
          {nestState.book.total > 0 && <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>/ {nestState.book.total}</span>}
          <button onClick={() => { setSentFlip(true); setTimeout(() => { submitSentence(); setSentFlip(false); }, 280); }}
            style={{ marginLeft: 'auto', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 999, padding: '7px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.2px' }}>
            남기기
          </button>
        </div>
        <input ref={_quickOcrInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) setQuickOcrFile(f); e.target.value = ''; }} />
      </div>

      {/* 크롭 오버레이 */}
      {quickOcrFile && (
        <OcrCropOverlay file={quickOcrFile} onCancel={() => setQuickOcrFile(null)} onCrop={(blob) => { setQuickOcrFile(null); runOcrQuick(blob); }} />
      )}

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
              재키와 다시 대화하기
            </button>
            <button onClick={resurfaceLater}
              style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 이 책, 한 문장 (#499) — 현재 책 전체 기간 최신순 + 날짜·좋아요·삭제. */}
      <div className="section-head">
        <h3>내가 남긴 흔적 <span className="my-q-count">{bookQuotes.length}</span></h3>
        {nestState.myQuotes.length > 0 && (
          <button className="more" onClick={() => window.RG_openCollection && window.RG_openCollection()}>
            전체 문장 보기 →
          </button>
        )}
      </div>
      {bookQuotes.length === 0 ? (
        <div className="my-q-empty">
          <span className="ico">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="16" cy="20" rx="9" ry="7" fill="var(--brand-soft)"/>
              <circle cx="21" cy="11" r="5.5" fill="var(--brand-soft)"/>
              <circle cx="23" cy="9.5" r="1.4" fill="var(--ink-2)"/>
              <path d="M25.5 12l3 .8-2.5 1.8" stroke="var(--ink-2)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 22l-3 2.5" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M14 25l-1.5 3" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
          이 책에서 만난 한 줄을 짹 해보세요.<br />
          남긴 문장이 여기 쌓여요.
        </div>
      ) : (
        bookQuotes.slice(0, 10).map((q, i) => {
          // getBook 은 미스 시 RG_BOOKS[0](=사피엔스)로 폴백하므로, id가 실제 일치할 때만 그 제목을 씀(사피엔스버그).
          const _bk = getBook(q.bookId);
          const bkTitle = q.bookTitle || (_bk && _bk.id === q.bookId ? _bk.title : '') || '책';
          const dateText = _isTodayQuote(q) ? '오늘' : (q.createdAt ? (() => {
            const v = q.createdAt;
            let d;
            if (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(String(v).trim()))) {
              const n = typeof v === 'number' ? v : Number(v);
              const ms = n > 1e13 ? n / 1000 : n > 1e10 ? n : n * 1000; // µs→ms, ms, s→ms
              d = new Date(ms);
            } else {
              d = new Date(v);
            }
            if (isNaN(d.getTime())) return q.when || '';
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          })() : (q.when || ''));
          return (
            <div key={q.id || i} className="my-q-card">
              <div className="meta">
                <span className="bk">{bkTitle}</span>
                <span className="dot">·</span>
                <span>{q.page}p</span>
                {dateText ? <span className="dot">·</span> : null}
                {dateText ? <span>{dateText}</span> : null}
              </div>
              <div className="quote" style={q.kind === 'thought' ? { fontStyle: 'normal' } : null}>
                {q.kind === 'thought' ? (
                  <><span style={{display:'inline-flex',alignItems:'center',verticalAlign:'middle',marginRight:5}}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="6.5" cy="5.5" rx="5.5" ry="4" fill="none" stroke="var(--ink-2)" strokeWidth="1.2"/>
                      <circle cx="4" cy="10.5" r="1" fill="var(--ink-2)"/>
                      <circle cx="2" cy="12.5" r="0.6" fill="var(--ink-3)"/>
                    </svg>
                  </span>{q.text}</>
                ) : `"${q.text}"`}
              </div>
              {/* 한 문장 액션 계약 (#610) — 자체 렌더 대신 공용 SentenceActions(공개범위+좋아요+수정+삭제) 경유.
                  삭제는 rg:sentence-removed 이벤트로 myQuotes 자동 갱신(기존 리스너). */}
              {q.id && window.SentenceActions && (
                <SentenceActions sentence={{ id: q.id, text: q.text, bookId: q.bookId, bookTitle: bkTitle, page: q.page, note: q.note, kind: q.kind, visibility: q.visibility, isPrivate: q.isPrivate }} mine fav={favIds.has(q.id)} />
              )}
              {q.id && (() => {
                // 재키 대화 턴 수 (#654) — my_note의 Q. 블록 수. 책 상세(library.js)와 동일 계산·어휘.
                // 축적 신호이지 할당량이 아님 → 분수(3/3) 표기 안 함. 0이면 숨김.
                const turns = q.note ? q.note.split(/\n\n+/).filter((b) => /^Q\./.test(b.trim())).length : 0;
                return (
                  <button className="q-ai" onClick={() => window.RG_openCompanion && window.RG_openCompanion({ id: q.id, text: q.text, bookId: q.bookId, bookTitle: bkTitle, page: q.page, note: q.note, kind: q.kind })}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
                      <ellipse cx="7" cy="9" rx="5" ry="4" fill="currentColor" opacity="0.55"/>
                      <circle cx="9.5" cy="5" r="3" fill="currentColor" opacity="0.75"/>
                      <circle cx="11" cy="4" r="1" fill="currentColor"/>
                      <path d="M12.5 5.5l2 .4-1.5 1.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4.5 11.5l-2 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
                      <path d="M7 12.5l-1 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
                    </svg>
                    {turns ? `재키와 대화 (${turns})` : '재키와 대화하기'}
                  </button>
                );
              })()}
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
  const MAX = 5; // 멀티턴 무료 캡 (#655, 이전 3). 5턴 초과 무제한은 수익화 후속(워커 exchanges slice 상향).
  const consent = window.RG_consent ? window.RG_consent.get() : 'yes';
  const bt = sentence.bookTitle || '', au = sentence.author || '';
  const saveText = () => {
    const v = stext.trim();
    if (!v) { setEditing(false); return; }
    if (DataStore.sentences && DataStore.sentences.updateText) Promise.resolve(DataStore.sentences.updateText(sentence.id, v)).catch(() => {});
    // 종류 변경(#381) 제거 — '내 생각'(thought) 폐기 (#596). 텍스트만 수정.
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
    if (!a) return; // 빈 답은 no-op — '마치기' 제거(#655) 후 종료는 모달 이탈(✕/바깥)로만. 빈 전송으로 대화 끝내지 않음.
    const ex = [...exchanges, { q: question, a }];
    setExchanges(ex); setAnswer(''); persist(ex);
    rgTrack('answer_saved', { book_id: sentence.bookId || '', lens: 'why', answer_length: a.length });
    archiveCompanion(sentence.bookId, sentence.text, question, a); // 서버 아카이브 (#295)
    // 5턴 도달 또는 미동의(단발) → 따뜻한 마무리로 종료. 이 5턴 경계가 향후 '더 이야기하기 = 업그레이드' 수익화 훅(#655).
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
  const _JackAvatar = ({ size = 28 }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(63,209,127,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="10" cy="13" rx="7" ry="5.5" fill="var(--brand)" opacity="0.35"/>
        <circle cx="13" cy="8" r="4.5" fill="var(--brand)" opacity="0.55"/>
        <circle cx="15" cy="6.5" r="1.3" fill="var(--brand-3)"/>
        <path d="M17 9l2.5.6-2 1.6" stroke="var(--brand-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
  return ReactDOM.createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', width: '100%', maxWidth: 430, height: '90vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <_JackAvatar size={38} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>재키</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>독서 동반자</div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* ── 스크롤 영역 ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 8px' }}>

          {/* 문장 카드 */}
          {editing ? (
            <div style={{ marginBottom: 14 }}>
              {/* 인용↔내 생각 토글 (#381) 제거 — '내 생각'(thought) 폐기 (#596). 텍스트만 편집. */}
              <textarea value={stext} onChange={(e) => { if (e.target.value.length <= 1000) setStext(e.target.value); }} rows={3}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--brand)', borderRadius: 12, padding: 10, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => { setStext(sentence.text || ''); setSkind(sentence.kind === 'thought' ? 'thought' : 'quote'); setEditing(false); }}
                  style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, border: '1.5px solid var(--line)', background: 'transparent', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>취소</button>
                <button onClick={saveText}
                  style={{ flex: 1, padding: '7px 14px', borderRadius: 999, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>저장</button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', fontSize: 14, fontStyle: skind === 'thought' ? 'normal' : 'italic', color: 'var(--ink)', lineHeight: 1.55, padding: '10px 48px 10px 12px', background: 'var(--paper-2)', borderRadius: 12, marginBottom: 14 }}>
              {skind === 'thought' ? (
                <><span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginRight: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><ellipse cx="6.5" cy="5.5" rx="5.5" ry="4" fill="none" stroke="var(--ink-2)" strokeWidth="1.2"/><circle cx="4" cy="10.5" r="1" fill="var(--ink-2)"/><circle cx="2" cy="12.5" r="0.6" fill="var(--ink-3)"/></svg>
                </span>{sentence.text}</>
              ) : `"${sentence.text}"`}
              <span style={{ position: 'absolute', top: 6, right: 8, display: 'flex', gap: 4 }}>
                <button onClick={() => { setStext(sentence.text || ''); setEditing(true); }} title="문장 수정" aria-label="문장 수정"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.55, padding: 3, display: 'flex', alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2l2 2-7 7H2v-2L9 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button onClick={delQuote} title="이 한 문장 삭제" aria-label="삭제"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.55, padding: 3, display: 'flex', alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4h9M5 4V2.5h3V4M5.5 6v4M7.5 6v4M3 4l.7 7h5.6L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </span>
            </div>
          )}

          {/* 말풍선 채팅 UI (#435) — 좌=재키 질문(아바타), 우=내 답 */}
          {exchanges.map((e, ei) => (
            <div key={ei}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
                <_JackAvatar size={28} />
                <div style={{ maxWidth: '78%', background: 'rgba(63,209,127,0.12)', borderRadius: '16px 16px 16px 4px', padding: '9px 13px', fontSize: 13.5, fontWeight: 700, lineHeight: 1.55, color: 'var(--ink)' }}>{e.q}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <div style={{ maxWidth: '78%', background: 'var(--brand)', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 13px', fontSize: 13.5, lineHeight: 1.55 }}>{e.a}</div>
              </div>
            </div>
          ))}

          {/* 현재 상태 */}
          {done ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(63,209,127,0.08)', borderRadius: 14 }}>
              <_JackAvatar size={28} />
              <span style={{ fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic' }}>오늘 재키랑 깊이 이야기했네요</span>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
              <_JackAvatar size={28} />
              <div style={{ background: 'rgba(63,209,127,0.12)', borderRadius: '16px 16px 16px 4px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0.8, 0.5, 0.3].map((op, i) => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', opacity: op, display: 'block' }} />
                  ))}
                </div>
              </div>
            </div>
          ) : question ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
              <_JackAvatar size={28} />
              <div style={{ maxWidth: '78%', background: 'rgba(63,209,127,0.12)', borderRadius: '16px 16px 16px 4px', padding: '9px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.55 }}>{question}</div>
                  <div style={{ flex: '0 0 auto', display: 'flex', gap: 2 }}>
                    <button onClick={() => rate('up')} title="좋은 질문" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, opacity: rated === 'up' ? 1 : 0.4, display: 'flex', color: rated === 'up' ? 'var(--brand-3)' : 'currentColor' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 13V7h2L7 1.5v2.5h4a1 1 0 0 1 1 1l-1 4.5H7V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button onClick={() => rate('down')} title="별로예요" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, opacity: rated === 'down' ? 1 : 0.4, display: 'flex', color: rated === 'down' ? 'var(--ink-2)' : 'currentColor' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 1v6h-2L7 12.5V10H3a1 1 0 0 1-1-1l1-4.5H7V1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button onClick={regen} title="다른 질문" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, opacity: 0.5, display: 'flex' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7a5 5 0 1 1-1.5-3.5L12 2v3.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 말단 anchor (#407) */}
          <div ref={_compTailRef} />
        </div>

        {/* ── 입력바 (고정) ── */}
        {/* '마치기' 버튼 제거(#655) — 종료는 모달 이탈(✕/바깥)로만. */}
        {!done && !loading && question && (
          <div style={{ padding: '10px 16px 20px', borderTop: '1px solid var(--line)', flexShrink: 0, background: 'var(--card)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && answer.trim()) { e.preventDefault(); submit(); } }}
                placeholder="떠오르는 대로 답해보세요" rows={2}
                style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 14, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'none', background: 'var(--paper-2)', outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={submit} disabled={!answer.trim()} aria-label="전송"
                style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: answer.trim() ? 'var(--brand)' : 'var(--line)', color: '#fff', cursor: answer.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9l14-7-7 14V9H2z" fill="currentColor"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>, document.body);
}
window.CompanionModal = CompanionModal;
