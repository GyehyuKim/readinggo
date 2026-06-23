/* =========================================================
   ReadingGo — components.js
   공용 UI 컴포넌트: Toast, SentenceCard, Confetti
   ========================================================= */
const { useState, useEffect, useRef, useCallback } = React;

// 데모: 반응(짹) XP 일일 상한용 카운터(세션 단위). 운영 빌드는 일자 기준 서버 집계.
// #871 Vite 회귀 픽스 — sentence-card.js 가 cross-file 로 읽고 증가. 모듈 스코프 let 은 공유 안 되므로 전역 바인딩.
window._rgReactToday = 0;

/* ── 스포일러 블라인드 (페이지 기반, social.md §5.7.1 SSOT) ──
   전역 토글 컨텍스트: revealAll=true 면 모든 블라인드 해제. */
const SpoilerContext = React.createContext(false);

// 블라인드 여부: 내가 *읽고 있는* 책의 한 문장 중 내 현재 페이지보다
// 뒤 페이지면 가린다. 판정 데이터는 DataStore.spoiler.myCurrentPage(bookId).
// 내가 안 읽는 책(myPage 0) · 완독 책(current_page=total) · 현재 페이지 이하 → 노출.
function isSentenceBlinded(bookId, page) {
  // Phase 1: 렌더 시점엔 async DataStore 호출 금지(Promise→오작동 + b008 같은 데모 id 로
  // uuid 컬럼 쿼리 시 400 스팸). boot 에서 preload 한 동기 맵(window.RG_MY_PAGES:
  // bookId→내 현재 페이지)을 사용. 실 피드 배선(B) 전까진 맵이 비어 블라인드 비활성
  // (데모 피드엔 스포일러 리스크 없음).
  if (typeof page !== 'number') return false;
  const myPage = (window.RG_MY_PAGES && window.RG_MY_PAGES[bookId]) || 0;
  if (!myPage) return false;          // 안 읽는 책 / 미상 → 전체 공개
  return page > myPage;               // 내 현재 페이지보다 뒤 → 블라인드
}

/* ── Toast (전역 싱글턴) ──────────────────────────────── */
let _toastTimer = null;
let _setToastFn = null;

// showToast(msg, opts) — opts.sparrow=true 면 메시지 앞에 SparrowMark SVG(브랜드 마크) 표시.
// (토스트는 문자열이라 메시지에 SVG를 못 넣음 → 아이콘은 옵션 플래그로 Toast 컴포넌트가 렌더. 참새 머리 이모지 대체, #864.)
function showToast(msg, opts) {
  if (_setToastFn) {
    _setToastFn({ msg, sparrow: !!(opts && opts.sparrow) });
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => _setToastFn({ msg: '', sparrow: false }), 2200);
  }
}

function Toast() {
  const [t, setT] = useState({ msg: '', sparrow: false });
  _setToastFn = setT;
  return (
    <div className={'toast' + (t.msg ? ' show' : '')}>
      {t.sparrow && t.msg ? <><window.SparrowInline size={14} />{' '}</> : null}{t.msg}
    </div>
  );
}

// PostHog 커스텀 이벤트 (analytics.md §3.1). posthog 미로드/차단 시 안전 no-op.
function rgTrack(event, props) {
  try {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(event, props || {});
    }
  } catch (e) { /* analytics 실패는 무시 */ }
}

// 공용 북커버 (#316 A) — 표지 없거나 로드 실패 시 제목·저자 타이포 placeholder.
// 기존 인라인 `<div className="book-cover" style={{background:grad}}><img/></div>` 드롭인 대체.
function BookCover({ title, author, cover, fb, className, style, radius }) {
  const [failed, setFailed] = useState(false);
  const c0 = (fb && fb[0]) || '#9AA7B2', c1 = (fb && fb[1]) || '#C7D0D8';
  const wrap = { background: `linear-gradient(135deg,${c0},${c1})`, position: 'relative', overflow: 'hidden', ...(radius != null ? { borderRadius: radius } : {}), ...(style || {}) };
  if (cover && !failed) {
    return (
      <div className={className || ''} style={wrap}>
        <img src={cover} alt={title || ''} loading="lazy" referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  return (
    <div className={className || ''} style={wrap}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '11%', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.28)' }}>
        <div style={{ fontWeight: 900, fontSize: 11, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title || '제목 미상'}</div>
        {author && <div style={{ fontWeight: 700, fontSize: 9, opacity: 0.9, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author}</div>}
      </div>
    </div>
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

function ConsentBanner({ onChoose }) {
  const [detail, setDetail] = useState(false);
  const [optional, setOptional] = useState(true); // 선택 기본 체크 → 전체 동의 유도
  const ghost = { flex: '0 0 auto', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' };
  const primary = { flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' };
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 60, background: 'var(--card)', borderTop: '1px solid var(--line)', boxShadow: '0 -4px 16px rgba(0,0,0,0.10)', padding: '14px 16px 16px' }}>
      <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>🍪 데이터 활용 동의</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>서비스 운영(필수)과 더 나은 독서 파트너를 위한 AI·분석 활용(선택)에 동의해 주세요. 언제든 설정에서 바꿀 수 있어요.</div>
      {detail && (
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: 'var(--paper-2)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>필수 — 서비스 운영 <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>(로그인·기록 저장)</span></span>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-3)' }}>항상 켜짐</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>선택 — 독서 대화 AI·분석 <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>(파트너 질문·익명 분석)</span></span>
            <button onClick={() => setOptional((o) => !o)} aria-label="선택 동의 토글" style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: optional ? 'var(--brand)' : 'var(--line)', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 3, left: optional ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {detail ? (
          <button onClick={() => onChoose(optional ? 'yes' : 'no')} style={primary}>저장</button>
        ) : (
          <>
            <button onClick={() => onChoose('no')} style={ghost}>필수만</button>
            <button onClick={() => setDetail(true)} style={ghost}>상세 설정</button>
            <button onClick={() => onChoose('yes')} style={primary}>전체 동의</button>
          </>
        )}
      </div>
    </div>
  );
}

window.showToast = showToast;
window.rgTrack = rgTrack;
window.BookCover = BookCover;
window.ConsentBanner = ConsentBanner;
// 데이터 수집·AI 활용 동의 (#294, analytics.md §5). DataStore.consent 어댑터 위임(직접 localStorage 금지).
window.RG_consent = {
  get() { return (window.DataStore && window.DataStore.consent) ? window.DataStore.consent.get() : null; },
  set(v) { if (window.DataStore && window.DataStore.consent) window.DataStore.consent.set(v); },
};
// 선택 동의 게이팅 (analytics.md §5.4, #752) — 'yes'면 세션 리플레이 시작, 그 외(거부·미질문·철회) 중단.
// 익명 이벤트·퍼널은 게이트 밖(필수·상시). identify는 로그인 컨텍스트가 필요해 app.js에서 별도 게이팅.
window.RG_applyConsent = function (v) {
  try {
    if (!window.posthog) return;
    if (v === 'yes') {
      if (window.posthog.startSessionRecording) window.posthog.startSessionRecording();
    } else {
      if (window.posthog.stopSessionRecording) window.posthog.stopSessionRecording();
    }
  } catch (e) { /* posthog 미로드/실패 무시 */ }
};
window.Toast = Toast;
window.Confetti = Confetti;


window.SpoilerContext = SpoilerContext;
window.isSentenceBlinded = isSentenceBlinded;

// HTML 엔티티 디코드 (#562/#578) — 외부 description 의 `&lt; &gt; &amp;` raw 노출 방지. library.js 와 동일 패턴(컴포넌트 파일 자립).
function decodeEntities(s) {
  const str = String(s == null ? '' : s);
  if (!str || str.indexOf('&') < 0) return str;
  if (typeof document !== 'undefined' && document.createElement) {
    try { const t = document.createElement('textarea'); t.innerHTML = str; return t.value; } catch (e) { /* fall through */ }
  }
  const named = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, ent) => {
    if (ent[0] === '#') {
      const code = (ent[1] === 'x' || ent[1] === 'X') ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return named[ent.toLowerCase()] || m;
  });
}
window.decodeEntities = decodeEntities; // sentence-card.js 등 추출 모듈이 사용 (#761)

/* ── ActivityHeatmap: 독서 활동 잔디 (#195) ──
   최근 N일(기본 182=26주) 일별 읽은 쪽수를 GitHub식 히트맵으로. DataStore.sessions.heatmap. */
function ActivityHeatmap({ days }) {
  const N = days || 182;
  const [map, setMap] = useState(null);
  useEffect(() => {
    const DS = window.DataStore || {};
    if (!(DS.sessions && DS.sessions.heatmap)) { setMap({}); return; }
    Promise.resolve(DS.sessions.heatmap(N)).then((rows) => {
      const m = {}; (rows || []).forEach((r) => { m[r.date] = r.pages; }); setMap(m);
    }).catch(() => setMap({}));
  }, []);
  if (map === null) return <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 8 }}>활동 불러오는 중…</div>;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (N - 1) * 86400000);
  start.setDate(start.getDate() - start.getDay());
  const cells = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    cells.push({ date: ds, pages: map[ds] || 0 });
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const maxP = Math.max(1, ...cells.map((c) => c.pages));
  const lvl = (p) => p <= 0 ? 0 : p >= maxP * 0.66 ? 3 : p >= maxP * 0.33 ? 2 : 1;
  const COLOR = ['var(--line, #ebedf0)', '#9be9a8', '#40c463', '#216e39'];
  const totalPages = cells.reduce((s, c) => s + c.pages, 0);
  const activeDays = cells.filter((c) => c.pages > 0).length;
  // 월 라벨 (#207) — 주 컬럼의 첫날 월이 직전 주와 바뀌면 그 컬럼 위에 'M월'
  const months = weeks.map((w, wi) => {
    const m = w[0] ? parseInt(w[0].date.slice(5, 7), 10) : null;
    const pm = (wi > 0 && weeks[wi - 1][0]) ? parseInt(weeks[wi - 1][0].date.slice(5, 7), 10) : null;
    return (m && (wi === 0 || m !== pm)) ? m + '월' : '';
  });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.3px' }}>독서 활동</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>{Math.round(N / 7)}주 · {activeDays}일 · {totalPages}쪽</div>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'inline-block' }}>
          {/* 월 라벨 행 (#207) — absolute로 레이아웃 영향 없이 텍스트 오버플로 (#11 스크롤 방지) */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 3, height: 11 }}>
            {months.map((m, wi) => (
              <div key={wi} style={{ width: 11, flexShrink: 0, position: 'relative', overflow: 'visible' }}>
                {m && <span style={{ position: 'absolute', left: 0, top: 0, fontSize: 9, lineHeight: '11px', color: 'var(--ink-3)', fontWeight: 800, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{m}</span>}
              </div>
            ))}
          </div>
          {/* 주 그리드 */}
          <div style={{ display: 'flex', gap: 2 }}>
            {weeks.map((w, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {w.map((c) => (
                  <div key={c.date} title={`${c.date} · ${c.pages}쪽`}
                    style={{ width: 11, height: 11, borderRadius: 2, background: COLOR[lvl(c.pages)], flexShrink: 0 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.ActivityHeatmap = ActivityHeatmap;
