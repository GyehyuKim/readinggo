/* =========================================================
   ReadingGo — components.js
   공용 UI 컴포넌트: Toast, SentenceCard, Confetti
   ========================================================= */
const { useState, useEffect, useRef, useCallback } = React;

/* ── Toast (전역 싱글턴) ──────────────────────────────── */
let _toastTimer = null;
let _setToastFn = null;

function showToast(msg) {
  if (_setToastFn) {
    _setToastFn(msg);
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => _setToastFn(''), 2200);
  }
}

function Toast() {
  const [msg, setMsg] = useState('');
  _setToastFn = setMsg;
  return (
    <div className={'toast' + (msg ? ' show' : '')}>{msg}</div>
  );
}

/* ── Confetti ─────────────────────────────────────────── */
function Confetti({ active, nestUp }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (!active || !boxRef.current) return;
    const box = boxRef.current;
    box.innerHTML = '';
    const colors = ['#3FD17F','#FFC233','#FF8A3D','#5AB5F0','#F08A9A','#B690F0','#2EB867','#FFD66B'];
    const n = nestUp ? 36 : 18;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      el.style.left = (Math.random() * 100) + '%';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      el.style.animationDelay = (Math.random() * 0.25) + 's';
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.style.width = (6 + Math.random() * 8) + 'px';
      el.style.height = (10 + Math.random() * 10) + 'px';
      box.appendChild(el);
    }
    const t = setTimeout(() => { if (box) box.innerHTML = ''; }, 3200);
    return () => clearTimeout(t);
  }, [active]);
  return <div className="confetti" ref={boxRef} />;
}

/* ── SentenceCard ─────────────────────────────────────── */
function SentenceCard({ item, bookId }) {
  const [reactions, setReactions] = useState({
    claps: item.claps, tears: item.tears, marks: item.marks,
    clapActive: false, tearActive: false, markActive: false,
  });
  const [revealed, setRevealed] = useState(false);
  const bk = getBook(bookId);
  const toggle = (key, activeKey) => {
    setReactions(r => ({
      ...r,
      [key]: r[activeKey] ? r[key] - 1 : r[key] + 1,
      [activeKey]: !r[activeKey],
    }));
  };
  return (
    <div className="sentence-card">
      <div className="who">
        <div className="avatar">{item.avatar}</div>
        <div className="nick">{item.nick}</div>
        <div className="meta">{bk ? bk.title + ' · ' : ''}{item.page}p · {item.time}</div>
      </div>
      <div className={'quote' + (revealed ? '' : ' spoiler')} onClick={() => setRevealed(!revealed)} title="클릭하여 스포일러 표시">
        "{item.q}"
      </div>
      <div className="react">
        <span className={'chip' + (reactions.clapActive ? ' active' : '')} onClick={() => toggle('claps','clapActive')}>
          👏 {reactions.claps}
        </span>
        <span className={'chip' + (reactions.tearActive ? ' active' : '')} onClick={() => toggle('tears','tearActive')}>
          🥹 {reactions.tears}
        </span>
        <span className={'chip' + (reactions.markActive ? ' active' : '')} onClick={() => toggle('marks','markActive')}>
          🔖 {reactions.marks}
        </span>
      </div>
    </div>
  );
}

window.showToast = showToast;
window.Toast = Toast;
window.Confetti = Confetti;
window.SentenceCard = SentenceCard;
