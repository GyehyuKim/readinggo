/* =========================================================
   ReadingGo — nest-theatre.js  (#761 모듈화: nest.js에서 추출)
   NestTheatre(둥지 5단계 XP 비주얼) + 헬퍼(stageMicrocopy·nestVisualState·NEST_CRACK_SVG).
   LibraryView가 <NestTheatre> 소비(library.js 이전 로드). 순수 이동 —
   _stageProg(nest.js 전역)·nestArt(icons)는 render-time 해소, lexical 훅만 재선언.
   ========================================================= */

const { useState: _useState } = React;

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
  const cycleXp = _cycleXp(xp);            // 현재 주기 누적 XP (절대, 0~1599) #743
  const pct = _absPct(xp, sp);             // 진행% = cycleXp / next.minXp (숫자와 동일 절대 기준) #743
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
              <span className="next-arrow" style={{display:'inline-flex', alignItems:'center', gap:4}}>다음 성장 · {window.nestArt(next.lv, 16)} {next.name}</span>
            )}
          </div>
          <div className="nest-health-num">
            {sp.isMax
              ? <b>최고 단계</b>
              : <span><b>{cycleXp.toLocaleString()}</b> / {next.minXp.toLocaleString()} XP</span>}
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
            <button onClick={() => setShowGuide(false)} aria-label="닫기" style={{position:'absolute', top:10, right:14, background:'rgba(0,0,0,0.06)', border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', color:'var(--ink-2)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center'}}>{window.rgIcon('close', 16)}</button>
            <div style={{padding:'8px 20px 24px'}}>
              <div style={{textAlign:'center', fontSize:18, fontWeight:900, color:'var(--ink)', marginBottom:4}}>둥지가 자라는 방법</div>
              <div style={{textAlign:'center', fontSize:13, color:'var(--ink-2)', fontWeight:700, marginBottom:16}}>활동하면 XP가 쌓이고 둥지가 자라요!</div>
              {NEST_STAGES.map(s => (
                <div key={s.lv} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:12, background: s.lv === stage.lv ? 'var(--brand-tint)' : 'transparent', marginBottom:4}}>
                  <span style={{display:'inline-flex'}}>{window.nestArt(s.lv, 28)}</span>
                  <span style={{flex:1, fontSize:14, fontWeight:800, color:'var(--ink)'}}>{s.name}</span>
                  <span style={{fontSize:12, color:'var(--ink-3)', fontWeight:700}}>{s.maxXp == null ? `${s.minXp.toLocaleString()} XP` : `${s.minXp.toLocaleString()}–${s.maxXp.toLocaleString()} XP`}</span>
                </div>
              ))}
              <div style={{marginTop:14, padding:'12px 14px', background:'var(--brand-tint)', border:'1px solid var(--brand)', borderRadius:12, fontSize:13, color:'var(--brand-3)', fontWeight:800, lineHeight:1.6, textAlign:'center'}}>
                <span style={{display:'inline-block', verticalAlign:'-4px', marginRight:4}}>{window.nestArt(5, 18)}</span>1,600 XP 달성 → 성 획득! 다시 나뭇가지 자리부터 새 둥지를 시작해요.
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
window.NestTheatre = NestTheatre;
