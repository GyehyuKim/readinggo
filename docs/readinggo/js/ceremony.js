/* =========================================================
   ReadingGo — ceremony.js  (#761 모듈화: nest.js에서 추출)
   Ceremony: 완독·진화 세리머니(별점·소감·🏰 성 완성 연출). NestView가 <Ceremony> 소비.
   nest.js **이전** 로드. 순수 이동 — _stageProg(nest.js 전역)·nestArt(icons)는 render-time 해소, lexical 훅만 재선언.
   ========================================================= */

const { useState: _useState, useEffect: _useEffect } = React;

/* ── Ceremony ─────────────────────────────────────────── */
function Ceremony({ data, onClose, onComplete }) {
  const [rating, setRating] = _useState(0);
  const [reviewText, setReviewText] = _useState('');
  // nestUp(레벨업) 시 2-step: 0=일반 체크인 화면, 1=둥지 진화 축하 화면 (#426)
  const [step, setStep] = _useState(0);
  // 둥지 진척도 bar — 체크인 전(prevXp) → 후(newXp) 애니메이션. mount 후 다음 프레임에 목표값으로 전환.
  const [barPct, setBarPct] = _useState(null);
  // 게스트 여부(#1134) — 세리머니가 가입 유도 접점(onboarding.md §D·E: 세리머니 CTA가 가입 트리거).
  // currentUser()는 async(getSession, 무네트워크)라 mount 시 1회 해소. Supabase 미설정(로컬 모드)이면 false.
  const [isGuest, setIsGuest] = _useState(false);
  _useEffect(() => {
    let alive = true;
    if (window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured()) {
      window.RG_SB.currentUser().then((u) => { if (alive) setIsGuest(!u); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  if (!data) return null;
  const { xpGain, xpParts, sentence, sentenceCount, bookQuoteCount, nestUp, castleGained, castleCount, prevLv, newLv, prevXp, newXp, pagesAdded, isNewDay, wasReset, isComplete } = data;
  // 이번 체크인에 등록한 한 문장 수 — 배치(#1198)면 sentenceCount, 단일이면 sentence 유무.
  const savedCount = (typeof sentenceCount === 'number' && sentenceCount > 0) ? sentenceCount : (sentence && String(sentence).trim() ? 1 : 0);
  const savedSentence = savedCount > 0;
  let leadText;
  if (savedCount > 1) {
    // 배치 요약(#1198): "N개의 한 문장 기록 · +N쪽" — N번의 세리머니 대신 1회 요약.
    leadText = `${savedCount}개의 한 문장 기록${pagesAdded > 0 ? ` · +${pagesAdded}쪽` : ''}`;
  } else if (savedSentence) {
    // 한 문장 등록: "1개 문장 등록 +N XP" (#685)
    leadText = `1개 문장 등록 +${xpGain} XP`;
  } else if (!isNewDay && !wasReset) {
    leadText = `+${pagesAdded}쪽 추가 기록 · 오늘은 이미 짹 완료`;
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
  const startXp = prevXp != null ? prevXp : newXp;
  const endXp   = newXp != null ? newXp : prevXp;
  const startSP = _stageProg(startXp);
  const endSP   = _stageProg(endXp);
  const startPct = _absPct(startXp, startSP); // 절대 기준(cycleXp/next.minXp) — NestTheatre 바와 일치 #743
  const endPct   = _absPct(endXp, endSP);
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
              {/* #754: 3D PNG 캐릭터만 — nestArt SVG 중첩 제거(테마 충돌). 로드 실패 시 단계명만. */}
              <img className="nest-evo-img" src={`assets/nest/lv${prevStage.lv}.png`} alt={prevStage.name} referrerPolicy="no-referrer" draggable="false" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div className="name">{prevStage.name}</div>
            </div>
            <div className="nest-evo-arrow">→</div>
            <div className="nest-evo-stage now">
              <img className="nest-evo-img" src={`assets/nest/lv${nowStage.lv}.png`} alt={nowStage.name} referrerPolicy="no-referrer" draggable="false" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
        <h2>오늘도 짹! <window.SparrowInline size={20} /></h2>
        <div className="lead">{leadText}</div>
        <div className="reward-grid">
          <div className="reward-card brand">
            <span className="ico">★</span>
            <div className="val">+{xpGain}</div>
            <div className="lbl">XP</div>
          </div>
          {/* 한 문장 카드 (#549) — 문장 입력 시 '저장됨', 미입력 시 거짓 표시 대신 이 책 누적 수/0건 독려 */}
          <div className="reward-card gold">
            <span className="ico">{savedSentence ? window.rgIcon('bookmark', 22) : (bookQuoteCount > 0 ? window.rgIcon('book', 22) : window.rgIcon('pen', 22))}</span>
            <div className="val">{savedCount > 1 ? `${savedCount}개` : (savedSentence ? '저장됨' : (bookQuoteCount > 0 ? `${bookQuoteCount}개` : '0개'))}</div>
            <div className="lbl">{savedSentence ? '한 문장' : (bookQuoteCount > 0 ? '이 책 한 문장' : '한 문장 남겨봐요')}</div>
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
          {/* #754: 풀스크린 세리머니는 3D PNG만 — nestArt SVG 중첩 제거. 로드 실패 시 단계명만. */}
          <img className="nest-progress-img" src={`assets/nest/lv${curStage.lv}.png`} alt={curStage.name} referrerPolicy="no-referrer" draggable="false" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="nest-progress-head">
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
                      : `${endSP.next && endSP.next.name === '빈 둥지' ? '둥지가 모양을 갖추기' : (endSP.next ? endSP.next.short + ' ' + endSP.next.name : '다음 단계')}까지 ${Math.max(0, endSP.spanXp - endSP.intoXp).toLocaleString()} XP`))}
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
        {/* 게스트 가입 유도(#1134) — 첫 성공(aha) 직후가 저장 동기가 가장 높은 시점(§D).
            3차 텍스트 위계(DESIGN 버튼 위계) — 세리머니 주인공은 보상, 로그인은 조용한 한 줄. */}
        {isGuest && (
          <button type="button" onClick={() => { onClose(); if (window.RG_login) window.RG_login(); }}
            style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--brand-3)', textDecoration: 'underline', padding: 6 }}>
            이 기록, 계정에 저장하기
          </button>
        )}
      </div>
    </div>
  );
}
window.Ceremony = Ceremony;
