/* =========================================================
   ReadingGo — milestone-recap.js  (#938, A2 — nest.md §5.4)
   MilestoneRecap: 마일스톤(완독·연속 7/30일·둥지 성)에서 '그동안 내가 남긴 한 문장·순간'을 따뜻하게 돌아보는 회고 모달.
   숫자가 아니라 서사로 고양감(uplift)을 증폭한다. 점수·경쟁·미션을 새로 더하지 않고 기존 sentences·my_note 자산을 재사용.
   빈도 절제: DataStore.milestone 게이트(마일스톤별 1회 + 하루 1회)로 피로를 막는다. nest.js 가 RG_openMilestoneRecap 으로 호출.
   nest.js **이전** 로드(ceremony.js 처럼) — window.RG_openMilestoneRecap 전역 노출.
   ========================================================= */

const { useState: _mrUseState, useEffect: _mrUseEffect } = React;

// 작성일자 표기 — created_at 은 number(localStorage)·ISO(Supabase) 모두 처리(연·월·일).
function _mrFmtDate(t) {
  if (!t) return '';
  let v = t;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) v = Number(v.trim());
  if (typeof v === 'number') v = v > 1e13 ? v / 1000 : (v > 1e10 ? v : v * 1000); // µs→ms, ms, s→ms
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

// 마일스톤 → 헤더 카피. 숫자 자랑이 아니라 '돌아보기' 톤(서사 중심).
function _mrCopy(milestone) {
  const m = milestone || {};
  if (m.type === 'complete') {
    return { badge: '🏰', title: '한 권을 끝까지 읽었어요', lead: m.bookTitle ? `《${m.bookTitle}》를 덮으며, 그동안 이 책에 남긴 흔적을 돌아봐요.` : '책을 덮으며, 그동안 남긴 흔적을 돌아봐요.' };
  }
  if (m.type === 'streak') {
    return { badge: '🔥', title: `${m.value}일 연속, 매일 읽었어요`, lead: '하루하루 쌓인 날들. 그동안 마음에 담아둔 문장들을 다시 만나요.' };
  }
  if (m.type === 'castle') {
    return { badge: '🏰', title: '둥지가 성이 되었어요', lead: '한 주기를 완성하는 동안 당신이 남긴 순간들. 천천히 돌아봐요.' };
  }
  return { badge: '✨', title: '여기까지 왔어요', lead: '그동안 남긴 한 문장들을 돌아봐요.' };
}

/* ── MilestoneRecap ───────────────────────────────────────
   props: { milestone: { type:'complete'|'streak'|'castle', value?, bookId?, ubId?, bookTitle? }, onClose } */
function MilestoneRecap({ milestone, onClose }) {
  const [items, setItems] = _mrUseState(undefined); // undefined=로딩, []=없음
  const copy = _mrCopy(milestone);

  _mrUseEffect(() => {
    let alive = true;
    const DS = window.DataStore || {};
    (async () => {
      try {
        let rows = [];
        // 완독: 그 책의 문장만(가장 맥락이 맞음). 그 외(연속·성): 전 책에서 내가 남긴 문장 최신순.
        if (milestone && milestone.type === 'complete' && milestone.ubId && DS.sentences && DS.sentences.listByBook) {
          rows = await Promise.resolve(DS.sentences.listByBook(milestone.ubId)).catch(() => []);
        } else if (DS.sentences && DS.sentences.listMine) {
          rows = await Promise.resolve(DS.sentences.listMine()).catch(() => []);
        }
        if (!alive) return;
        // 정규화 — listMine(임베드)·listByBook(평면) 양쪽 shape 흡수.
        const norm = (rows || []).map((s) => ({
          id: s.id,
          text: s.text || '',
          page: s.page,
          note: s.my_note || '',
          bookTitle: (s.user_book && s.user_book.book && s.user_book.book.title) || s.bookTitle || '',
          createdAt: s.created_at || s.createdAt || 0,
        })).filter((s) => s.text && s.text.trim());
        // 최신순. 너무 많으면 8개로 절제(피로 방지 — 회고는 압축된 하이라이트).
        norm.sort((a, b) => {
          const ta = typeof a.createdAt === 'number' ? a.createdAt : Date.parse(a.createdAt) || 0;
          const tb = typeof b.createdAt === 'number' ? b.createdAt : Date.parse(b.createdAt) || 0;
          return tb - ta;
        });
        setItems(norm.slice(0, 8));
      } catch (e) { if (alive) setItems([]); }
    })();
    return () => { alive = false; };
  }, []);

  const close = () => { if (onClose) onClose(); };

  return ReactDOM.createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', width: '100%', maxWidth: 430, borderRadius: '22px 22px 0 0', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 헤더 — 따뜻한 그라데이션, 서사 톤(숫자 자랑 아님) */}
        <div style={{ background: 'linear-gradient(160deg, var(--brand-tint), var(--card))', padding: '22px 20px 16px', position: 'relative' }}>
          <button onClick={close} aria-label="닫기"
            style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.rgIcon('close', 16)}</button>
          <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 8 }}>{copy.badge}</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--ink)', marginBottom: 6 }}>{copy.title}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{copy.lead}</div>
        </div>

        {/* 타임라인 — 그동안 남긴 한 문장·순간 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 4px' }}>
          {items === undefined ? (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>흔적을 모으는 중…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '24px 4px 28px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5, lineHeight: 1.6 }}>
              아직 남긴 문장이 없네요.<br />다음 마일스톤엔 당신의 한 줄이 여기 쌓여 있을 거예요.
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 18, margin: '6px 0 8px' }}>
              {/* 세로 타임라인 라인 */}
              <span style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 2, background: 'var(--brand-soft)' }} />
              {items.map((s, i) => (
                <div key={s.id || i} style={{ position: 'relative', marginBottom: 16 }}>
                  <span style={{ position: 'absolute', left: -18, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--card)' }} />
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', marginBottom: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {_mrFmtDate(s.createdAt) ? <span>{_mrFmtDate(s.createdAt)}</span> : null}
                    {s.bookTitle ? <span style={{ color: 'var(--brand-3)' }}>· {s.bookTitle}</span> : null}
                    {typeof s.page === 'number' ? <span>· {s.page}p</span> : null}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, fontStyle: 'italic' }}>"{s.text}"</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 1차 솔리드 버튼 1개(DESIGN.md 위계) — 닫기는 헤더 ✕(3차) */}
        <div style={{ padding: '10px 20px 20px', borderTop: '1px solid var(--line)' }}>
          <button className="checkin-cta" onClick={close} style={{ width: '100%' }}>
            계속 읽어가기 →
          </button>
        </div>
      </div>
    </div>, document.body);
}

window.MilestoneRecap = MilestoneRecap;

// 외부(nest.js) 진입점 — 빈도 게이트 통과 시에만 모달 마운트. 한 번에 하나만.
// nest.js 가 마일스톤 도달 시 호출: window.RG_openMilestoneRecap({ type, value, bookId, ubId, bookTitle }).
// 게이트(마일스톤별 1회 + 하루 1회)는 DataStore.milestone 이 강제 — 여기서는 마운트만 담당.
(function () {
  let _root = null;
  function ensureRoot() {
    if (_root) return _root;
    const el = document.createElement('div');
    el.id = 'rg-milestone-recap-root';
    document.body.appendChild(el);
    _root = ReactDOM.createRoot(el);
    return _root;
  }
  window.RG_openMilestoneRecap = function (milestone) {
    try {
      const root = ensureRoot();
      const close = () => { try { root.render(null); } catch (e) {} };
      root.render(React.createElement(MilestoneRecap, { milestone, onClose: close }));
    } catch (e) { /* 회고는 부가 연출 — 실패해도 본 흐름 무중단 */ }
  };
})();
