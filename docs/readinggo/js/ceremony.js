/* =========================================================
   ReadingGo — ceremony.js  (#761 모듈화: home.js에서 추출)
   Ceremony: 저장 결과와 완독 회고를 짧게 확인한다.
   ========================================================= */

const { useState: _useState, useEffect: _useEffect } = React;

function finishCeremony(options) {
  const { isComplete, onComplete, onClose, rating, reviewText } = options;
  if (isComplete && onComplete) {
    onComplete({ rating: rating || null, review_text: String(reviewText || '').trim() || null });
  }
  onClose();
}

/* ── Ceremony ─────────────────────────────────────────── */
function Ceremony({ data, onClose, onComplete, onContinue, onViewSaved, onGoHome, onSaveReflection, onTalkToJacky }) {
  const [rating, setRating] = _useState(0);
  const [reviewText, setReviewText] = _useState('');
  const [reflectionDraft, setReflectionDraft] = _useState('');
  const [reflectionStatus, setReflectionStatus] = _useState('idle');
  // 게스트 여부(#1134) — 성공적으로 기록한 뒤 계정 저장을 조용히 제안한다.
  const [isGuest, setIsGuest] = _useState(false);
  _useEffect(() => {
    let alive = true;
    if (window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured()) {
      window.RG_SB.currentUser().then((u) => { if (alive) setIsGuest(!u); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  const reflectionId = data && data.reflectionSentence && data.reflectionSentence.id;
  _useEffect(() => {
    const note = data && data.reflectionSentence && data.reflectionSentence.note;
    setReflectionDraft(note && window.rgSplitNote ? window.rgSplitNote(note).free : '');
    setReflectionStatus('idle');
  }, [reflectionId]);

  if (!data) return null;
  const { sentence, sentenceCount, pagesAdded, isComplete } = data;
  const savedCount = (typeof sentenceCount === 'number' && sentenceCount > 0)
    ? sentenceCount
    : (sentence && String(sentence).trim() ? 1 : 0);
  const savedSentence = savedCount > 0;
  const reflectionReady = !isComplete && savedCount === 1 && !!reflectionId;
  const reflectionSaved = reflectionReady && reflectionStatus === 'saved';
  const sentenceNeedsScrollHint = Array.from(String(sentence || '')).length > 140;
  let leadText;
  if (savedCount > 1) {
    leadText = `문장 ${savedCount}개를 저장했어요${pagesAdded > 0 ? ` · ${pagesAdded}쪽 기록` : ''}`;
  } else if (savedSentence) {
    leadText = '문장 1개를 저장했어요';
  } else if (pagesAdded > 0) {
    leadText = `${pagesAdded}쪽까지 읽은 기록을 저장했어요`;
  } else {
    leadText = '읽은 기록을 저장했어요';
  }

  // 기존 순서 보존: 완독 별점·소감 저장 진입을 먼저 호출한 뒤 세리머니를 닫는다.
  const finish = () => finishCeremony({ isComplete, onComplete, onClose, rating, reviewText });
  const saveReflection = async () => {
    if (!reflectionReady || !onSaveReflection || reflectionStatus === 'saving') return;
    setReflectionStatus('saving');
    try {
      await onSaveReflection(reflectionDraft);
      setReflectionStatus('saved');
    } catch (error) {
      setReflectionStatus('error');
    }
  };

  return (
    <div className="ceremony show">
      <div className="inner">
        <button type="button" className="ceremony-dismiss" aria-label="완료 화면 닫기" onClick={onClose}>
          {window.rgIcon('close', 18)}
        </button>
        <h2>{isComplete ? '완독을 축하해요!' : reflectionSaved ? '내 생각을 저장했어요' : '기록을 남겼어요'}</h2>
        <div className="lead">{reflectionSaved ? '저장한 내용을 확인하고 다음을 선택하세요' : leadText}</div>

        {sentence && (
          <div className="saved-quote" role="region" aria-label="저장한 문장 전체 내용" tabIndex={0}>
            <div className="saved-quote-head">
              <span className="label">저장한 문장</span>
              {sentenceNeedsScrollHint && <span className="saved-quote-hint">스크롤해서 전체 보기</span>}
            </div>
            "{sentence}"
          </div>
        )}

        {isComplete && (
          <div className="complete-review">
            <div className="complete-head">이 책, 어땠나요?</div>
            <div className="rating-stars" role="radiogroup" aria-label="별점 (0.5 단위, 선택)">
              {[1, 2, 3, 4, 5].map(n => {
                const fillPct = Math.max(0, Math.min(1, rating - (n - 1))) * 100;
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

        {isComplete && (
          <button className="next-btn" onClick={finish}>완독 기록 남기기 →</button>
        )}
        {!isComplete && data.reflectionPending && (
          <div className="ceremony-reflection-pending" role="status" aria-live="polite">저장한 문장을 연결하고 있어요…</div>
        )}
        {reflectionReady && !reflectionSaved && (
          <section className="ceremony-reflection" aria-labelledby="ceremony-reflection-label">
            <label id="ceremony-reflection-label" htmlFor="ceremony-reflection-input">이 문장이 나에게 남긴 생각</label>
            <textarea id="ceremony-reflection-input" placeholder="이 문장이 나에게 남긴 생각"
              value={reflectionDraft} maxLength={1000}
              disabled={reflectionStatus === 'saving'} aria-busy={reflectionStatus === 'saving'}
              onChange={(event) => { setReflectionDraft(event.target.value); if (reflectionStatus !== 'saving') setReflectionStatus('idle'); }} />
            <div className="ceremony-reflection-meta">
              <span role="status" aria-live="polite">
                {reflectionStatus === 'error' ? '저장하지 못했어요. 내용은 그대로 두었어요.' : ''}
              </span>
              <span>{Array.from(reflectionDraft).length}/1,000</span>
            </div>
            <button type="button" className="ceremony-reflection-save" onClick={saveReflection}
              disabled={!reflectionDraft.trim() || reflectionStatus === 'saving'}>
              {reflectionStatus === 'saving' ? '저장 중…' : '내 생각 저장하기'}
            </button>
            <button type="button" className="ceremony-reflection-jacky" onClick={onTalkToJacky}>
              {window.rgIcon('chat', 16)} 재키와 대화하기
            </button>
          </section>
        )}
        {reflectionSaved && (
          <section className="ceremony-reflection-saved" role="status" aria-live="polite" aria-labelledby="ceremony-reflection-saved-label">
            <div className="ceremony-reflection-saved-head" id="ceremony-reflection-saved-label">
              <span className="ceremony-reflection-saved-icon" aria-hidden="true">✓</span>
              내가 남긴 생각
            </div>
            <div className="ceremony-reflection-saved-text" tabIndex={0}>{reflectionDraft.trim()}</div>
          </section>
        )}
        {!isComplete && (
          <div className={`ceremony-actions${reflectionSaved ? ' is-saved' : ''}`}>
            {reflectionSaved && <div className="ceremony-actions-label">이제 무엇을 할까요?</div>}
            <button type="button" className="ceremony-action-next" onClick={onContinue}>
              다음 문장 기록하기
            </button>
            <button type="button" className="ceremony-action-home" onClick={onGoHome}>
              홈으로 돌아가기
            </button>
            <div className="ceremony-action-secondary">
              {reflectionSaved && (
                <button type="button" onClick={onTalkToJacky}>{window.rgIcon('chat', 15)} 재키와 대화하기</button>
              )}
              <button type="button" onClick={onViewSaved}>저장한 문장 보기</button>
            </div>
          </div>
        )}
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
