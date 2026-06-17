/* =========================================================
   ReadingGo — tinder-cards.js  (#761 모듈화 2차: components.js에서 추출)
   TinderCards: 한 문장 스와이프 리뷰(#186, 보류·보존). 현재 호출부 없음(재도입 대비 보존). DataStore(bare).
   components.js **이후** 로드(공유 컨텍스트·유틸은 window 전역). 순수 이동 — 훅만 재선언.
   ========================================================= */

const { useState, useRef } = React;

/* ── TinderCards: 한 문장 스와이프 리뷰 (#186) ──
   책의 한 문장들을 카드로. 우=좋아요(claps 단일, #641)/좌=싫어요(넘김)/아래=유예(뒤로).
   Stack Lock 준수 — 라이브러리 없이 Pointer Events + transform 직접 구현. */
function TinderCards({ items, title, onClose }) {
  const [queue, setQueue] = useState(items || []);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const [liked, setLiked] = useState(0);
  const startRef = useRef(null);
  const top = queue[0];

  const act = (dir) => {
    const card = queue[0];
    if (!card) return;
    if (dir === 'like') {
      setLiked((n) => n + 1);
      if (card.id && DataStore.claps && DataStore.claps.toggle) Promise.resolve(DataStore.claps.toggle(card.id)).catch(() => {});  // #641: 우스와이프 = 단일 좋아요(claps)
    }
    setDrag({ dx: 0, dy: 0, active: false });
    setQueue((q) => dir === 'defer' ? q.slice(1).concat(q[0]) : q.slice(1));
  };
  const onDown = (e) => { startRef.current = { x: e.clientX, y: e.clientY }; setDrag((d) => ({ ...d, active: true })); e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); };
  const onMove = (e) => { if (!startRef.current) return; setDrag({ dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y, active: true }); };
  const onUp = () => {
    if (!startRef.current) return;
    const { dx, dy } = drag;
    startRef.current = null;
    if (dx > 90) return act('like');
    if (dx < -90) return act('dislike');
    if (dy > 110) return act('defer');
    setDrag({ dx: 0, dy: 0, active: false });
  };

  const hint = drag.dx > 40 ? { t: '좋아요 ❤️', c: '#3FD17F' } : drag.dx < -40 ? { t: '넘기기 ✕', c: '#E5484D' } : drag.dy > 60 ? { t: '나중에 ↓', c: '#9097A0' } : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#15171B', zIndex: 1100, display: 'flex', flexDirection: 'column', color: '#F4F2EC' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#F4F2EC', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{title || '한 문장 카드'}</div>
        <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 800 }}>❤️ {liked}</div>
      </div>
      {/* 현재 카드 책 표지·저자 — 중앙 상단 (카드 본문과 분리) */}
      {top && (top.bookCover || top.bookTitle) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 18px 0' }}>
          <div style={{ width: 56, height: 78, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {top.bookCover
              ? <img src={top.bookCover} alt={top.bookTitle} loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.target.style.display = 'none')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 22 }}>📖</span>}
          </div>
          {top.bookTitle && <div style={{ fontSize: 13, fontWeight: 800, textAlign: 'center', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.bookTitle}</div>}
          {top.bookAuthor && <div style={{ fontSize: 11, opacity: 0.6 }}>{top.bookAuthor}</div>}
        </div>
      )}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {!top ? (
          <div style={{ textAlign: 'center', opacity: 0.8 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🃏</div>
            <div style={{ fontWeight: 800 }}>카드를 다 봤어요</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>❤️ {liked}개에 좋아요를 남겼어요</div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 20, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>닫기</button>
          </div>
        ) : (
          <>
            {queue[1] && (
              <div style={{ position: 'absolute', width: 'min(86vw, 360px)', height: 360, background: 'rgba(255,255,255,0.06)', borderRadius: 18, transform: 'scale(0.94) translateY(12px)' }} />
            )}
            <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{
                position: 'relative', width: 'min(86vw, 360px)', minHeight: 360, background: '#22252B', borderRadius: 18, padding: 24,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)', cursor: 'grab', touchAction: 'none', userSelect: 'none',
                transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 22}deg)`,
                transition: drag.active ? 'none' : 'transform 0.25s ease', display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
              {hint && <div style={{ position: 'absolute', top: 18, left: 18, fontSize: 16, fontWeight: 900, color: hint.c, border: `2px solid ${hint.c}`, borderRadius: 8, padding: '2px 10px' }}>{hint.t}</div>}
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 700, marginBottom: 12 }}>{top.bookTitle ? top.bookTitle + ' · ' : ''}{top.page}p {top.nick ? '· ' + top.nick : ''}</div>
              <div style={{ fontSize: 19, lineHeight: 1.7, fontWeight: 600 }}>"{top.text || top.q}"</div>
            </div>
          </>
        )}
      </div>
      {top && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 22, padding: '12px 0 28px' }}>
          <button onClick={() => act('dislike')} style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#2A2D33', color: '#E5484D', fontSize: 22, cursor: 'pointer' }}>✕</button>
          <button onClick={() => act('defer')} style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#2A2D33', color: '#9097A0', fontSize: 18, cursor: 'pointer', alignSelf: 'center' }}>↓</button>
          <button onClick={() => act('like')} style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#2A2D33', color: '#3FD17F', fontSize: 22, cursor: 'pointer' }}>❤️</button>
        </div>
      )}
    </div>
  );
}
window.TinderCards = TinderCards;
