/* =========================================================
   ReadingGo — ceremony.js  (#761 모듈화: nest.js에서 추출)
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
function Ceremony({ data, onClose, onComplete, onContinue, onViewSaved, onGoLibrary }) {
  const [rating, setRating] = _useState(0);
  const [reviewText, setReviewText] = _useState('');
  // 게스트 여부(#1134) — 성공적으로 기록한 뒤 계정 저장을 조용히 제안한다.
  const [isGuest, setIsGuest] = _useState(false);
  _useEffect(() => {
    let alive = true;
    if (window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured()) {
      window.RG_SB.currentUser().then((u) => { if (alive) setIsGuest(!u); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  if (!data) return null;
  const { sentence, sentenceCount, pagesAdded, isComplete } = data;
  const savedCount = (typeof sentenceCount === 'number' && sentenceCount > 0)
    ? sentenceCount
    : (sentence && String(sentence).trim() ? 1 : 0);
  const savedSentence = savedCount > 0;
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

  return (
    <div className="ceremony show">
      <div className="inner">
        <button type="button" className="ceremony-dismiss" aria-label="완료 화면 닫기" onClick={onClose}>
          {window.rgIcon('close', 18)}
        </button>
        <h2>{isComplete ? '완독을 축하해요!' : '기록을 남겼어요'}</h2>
        <div className="lead">{leadText}</div>

        {sentence && (
          <div className="saved-quote">
            <span className="label">저장한 문장</span>
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
        {!isComplete && (
          <div className="ceremony-actions">
            <button type="button" className="ceremony-action-primary" onClick={onContinue}>
              이 책에서 계속 기록하기
            </button>
            <div className="ceremony-action-secondary">
              <button type="button" onClick={onViewSaved}>저장한 문장 보기</button>
              <button type="button" onClick={onGoLibrary}>내 서재로 가기</button>
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
