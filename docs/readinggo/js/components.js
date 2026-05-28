// components.js — 공통 UI 컴포넌트
// 의존: data.js (getNestStage, NEST_STAGES)

const { useState, useEffect, useRef, useCallback } = React;

// ── Sparrow SVG (§11 디자인 토큰) ─────────────────────────────────────────────
const Sparrow = ({ size = 48, cls = '' }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" className={cls}>
    <ellipse cx="60" cy="72" rx="32" ry="28" fill="#C49A4A"/>
    <ellipse cx="55" cy="76" rx="24" ry="16" fill="#8B6234" transform="rotate(-10 55 76)"/>
    <ellipse cx="56" cy="74" rx="20" ry="12" fill="#A07840" transform="rotate(-10 56 74)"/>
    <ellipse cx="66" cy="80" rx="16" ry="14" fill="#E8D5A3"/>
    <circle cx="72" cy="44" r="22" fill="#C49A4A"/>
    <ellipse cx="72" cy="28" rx="14" ry="10" fill="#6B3F1A"/>
    <ellipse cx="68" cy="30" rx="10" ry="7" fill="#8B5E2A"/>
    <ellipse cx="84" cy="50" rx="10" ry="8" fill="#F5EDD0"/>
    <ellipse cx="80" cy="52" rx="5" ry="4" fill="#2A1A0A" transform="rotate(15 80 52)"/>
    <circle cx="76" cy="40" r="5" fill="#1A0A00"/>
    <circle cx="77" cy="39" r="1.5" fill="white"/>
    <path d="M88 46 L98 44 L88 50 Z" fill="#8B6234"/>
    <path d="M88 48 L96 46 L88 50 Z" fill="#6B4A1A"/>
    <line x1="55" y1="96" x2="50" y2="110" stroke="#8B6234" strokeWidth="3" strokeLinecap="round"/>
    <line x1="65" y1="96" x2="70" y2="110" stroke="#8B6234" strokeWidth="3" strokeLinecap="round"/>
    <line x1="50" y1="110" x2="44" y2="114" stroke="#8B6234" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="50" y1="110" x2="52" y2="115" stroke="#8B6234" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="70" y1="110" x2="64" y2="114" stroke="#8B6234" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="70" y1="110" x2="72" y2="115" stroke="#8B6234" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// ── 아이콘 ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, s = 22, c = '', fill = 'none', sw = 2 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={c}>{d}</svg>
);
const HomeIcon    = ({ s, c }) => <Icon s={s} c={c} d={<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}/>;
const MapIcon     = ({ s, c }) => <Icon s={s} c={c} d={<><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>}/>;
const UsersIcon   = ({ s, c }) => <Icon s={s} c={c} d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}/>;
const BookIcon    = ({ s, c }) => <Icon s={s} c={c} d={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>}/>;
const SearchIcon  = ({ s, c }) => <Icon s={s} c={c} d={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>}/>;
const XIcon       = ({ s = 22, c = '' }) => <Icon s={s} c={c} d={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}/>;
const BackIcon    = ({ s = 22, c = '' }) => <Icon s={s} c={c} d={<polyline points="15 18 9 12 15 6"/>}/>;
const RightIcon   = ({ s = 22, c = '' }) => <Icon s={s} c={c} d={<polyline points="9 18 15 12 9 6"/>}/>;
const SettingsIcon= ({ s = 22, c = '' }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={c}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ── NestIcon (마을 카드용) ─────────────────────────────────────────────────────
const NestIcon = ({ stage, size = 40, isLit = false }) => {
  const icons = ['🪵', '🪹', '🏠', '🏡', '🏰'];
  const emoji = icons[Math.min((stage || 1) - 1, 4)];
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <span style={{ fontSize: size * 0.68, filter: isLit ? 'none' : 'grayscale(70%)', opacity: isLit ? 1 : 0.55 }}>
        {emoji}
      </span>
      {isLit && (
        <span style={{ position: 'absolute', top: 0, right: 0 }}>
          <span style={{ position: 'relative', display: 'flex', width: 12, height: 12 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#FFC800', opacity: .75, animation: 'ping 1.2s ease-out infinite' }}/>
            <span style={{ position: 'relative', width: 12, height: 12, borderRadius: '50%', background: '#FFC800', display: 'block' }}/>
          </span>
        </span>
      )}
    </div>
  );
};

// ── AppHeader (§5.1 상단 바) ──────────────────────────────────────────────────
const AppHeader = ({ streak, xp, level, onStreakTap }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: '#fff', borderBottom: '2px solid #E5E5E5', flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Sparrow size={28}/>
      <span style={{ fontSize: 17, fontWeight: 900, color: '#1F1F1F', letterSpacing: '-0.5px' }}>
        reading<span style={{ color: '#58CC02' }}>Go</span>
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onStreakTap} style={{ display: 'flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
        borderRadius: 10, transition: 'background .15s' }}
        onMouseEnter={e => e.currentTarget.style.background='#FFF3E0'}
        onMouseLeave={e => e.currentTarget.style.background='none'}>
        <span style={{ fontSize: 20 }}>🔥</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#FF9600' }}>{streak}</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 18 }}>⚡</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1CB0F6' }}>{xp}</span>
      </div>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#CE82FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 11, color: '#fff' }}>Lv{level}</span>
      </div>
    </div>
  </div>
);

// ── 스트릭 마일스톤 카드 공유 모달 (Canvas 다운로드 지원) ──────────────────────
const StreakShareModal = ({ streak, onClose }) => {
  const [theme, setTheme] = React.useState('gold'); // gold | dark | neon | mint
  const canvasRef = React.useRef(null);

  const themeColors = {
    gold: { bg: '#FAF6F0', text: '#2A2D33', accent: '#FFC233', shadow: '#C8901C', border: '#ECE6DA' },
    dark: { bg: '#121212', text: '#FFFFFF', accent: '#FF9600', shadow: '#D8651F', border: '#2A2A2A' },
    neon: { bg: '#0A0015', text: '#CE82FF', accent: '#B690F0', shadow: '#8A3DFF', border: '#1A0033' },
    mint: { bg: '#EBFBF3', text: '#1E5E3A', accent: '#3FD17F', shadow: '#1F8E4D', border: '#D2F2E1' },
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = themeColors[theme];

    canvas.width = 1080;
    canvas.height = 1080;

    // 배경
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, 1080, 1080);

    // 테두리
    ctx.lineWidth = 20;
    ctx.strokeStyle = colors.border;
    ctx.strokeRect(40, 40, 1000, 1000);

    // 앱 이름
    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('🐦 ReadingGo', 100, 130);

    // 축하 텍스트
    ctx.fillStyle = colors.text;
    ctx.font = '900 68px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('독서 마일스톤 달성! 🎉', 540, 320);

    // 스트릭 원 & 불꽃 그리기
    const centerX = 540;
    const centerY = 580;
    const radius = 160;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = colors.bg;
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = colors.accent;
    ctx.stroke();

    // 불꽃 에모지
    ctx.font = '140px sans-serif';
    ctx.fillText('🔥', centerX, centerY - 20);

    // 연속 일수 텍스트
    ctx.fillStyle = colors.text;
    ctx.font = '900 72px sans-serif';
    ctx.fillText(`${streak}일 연속`, centerX, centerY + 80);

    // 격려 메시지
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.text;
    ctx.font = '800 36px sans-serif';
    ctx.fillText('하루 한 페이지, 참새의 성을 짓는 중 🏰', 540, 840);

    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('습관이 인성을 만들고, 독서가 사피엔스를 깨운다.', 540, 900);

    // 워터마크
    ctx.fillStyle = colors.text;
    ctx.font = '700 28px sans-serif';
    ctx.fillText('hb.link/readinggo', 540, 990);

    // 다운로드 실행
    const link = document.createElement('a');
    link.download = `ReadingGo_Streak_${streak}Days.png`;
    link.href = canvas.toDataURL();
    link.click();
    window._showToast && window._showToast('🎨 연속 독서 마일스톤 카드가 저장되었습니다!');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} className="fade-in">
      <div style={{ width: '100%', background: '#fff', borderRadius: 24, padding: 20, maxWidth: 360 }} className="pop-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: 0 }}>🔥 스트릭 마일스톤 카드</p>
          <button onClick={onClose} className="rg-btn-icon"><XIcon s={20}/></button>
        </div>

        {/* 프리뷰 카드 */}
        <div style={{
          width: '100%', aspectRatio: '1/1', borderRadius: 16, padding: 24,
          background: themeColors[theme].bg, color: themeColors[theme].text,
          border: `2px solid ${themeColors[theme].border}`, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden'
        }}>
          <span style={{ position: 'absolute', left: 20, top: 18, fontSize: 11, fontWeight: 900, color: themeColors[theme].accent }}>🐦 ReadingGo</span>
          
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px' }}>마일스톤 달성! 🎉</p>
            <p style={{ fontSize: 11, color: themeColors[theme].text, opacity: 0.6, margin: 0 }}>꾸준한 참새의 눈부신 결실</p>
          </div>

          <div style={{
            width: 140, height: 140, borderRadius: '50%', border: `4px solid ${themeColors[theme].accent}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2
          }}>
            <span style={{ fontSize: 44 }}>🔥</span>
            <span style={{ fontSize: 18, fontWeight: 900 }}>{streak}일 연속</span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, fontWeight: 800, margin: '0 0 4px' }}>하루 한 페이지 독서 습관 🏰</p>
            <p style={{ fontSize: 9, color: themeColors[theme].accent, fontWeight: 700, margin: 0 }}>hb.link/readinggo</p>
          </div>
        </div>

        {/* 테마 셀렉터 */}
        <div style={{ display: 'flex', gap: 6, margin: '14px 0' }}>
          {['gold', 'dark', 'neon', 'mint'].map(t => (
            <button key={t} onClick={() => setTheme(t)} style={{
              flex: 1, height: 26, borderRadius: 8, border: theme === t ? '2px solid #58CC02' : '1.5px solid #E5E5E5',
              background: themeColors[t].bg, cursor: 'pointer', outline: 'none'
            }}/>
          ))}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }}/>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-duo btn-white" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>취소</button>
          <button onClick={handleDownload} className="btn-duo btn-green" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>💾 카드 다운로드</button>
        </div>
      </div>
    </div>
  );
};

// ── StreakCalendar (이달 불꽃 달력) ───────────────────────────────────────────
const StreakCalendar = ({ userBooks, simDate, onClose }) => {
  const activeDate = simDate || todayISO();
  const [year, month] = activeDate.split('-').map(Number);
  const sessionDates = getSessionDates(userBooks);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const pad = n => String(n).padStart(2, '0');

  // 마일스톤 공유 상태
  const [showMilestoneShare, setShowMilestoneShare] = React.useState(false);
  const currentStreak = window.LS.get('rg_v42', {}).user?.streak || 21; // 데모 스트릭 디폴트 21

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px 36px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: 0 }}>
            🔥 {year}년 {month}월 독서 기록
          </p>
          <button onClick={onClose} className="rg-btn-icon"><XIcon s={20}/></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
          {['일','월','화','수','목','금','토'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#AFAFAF', padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 16 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`}/>;
            const iso = `${year}-${pad(month)}-${pad(day)}`;
            const hasSession = sessionDates.has(iso);
            const isToday = iso === activeDate;
            return (
              <div key={iso} style={{ textAlign: 'center', padding: '6px 0', borderRadius: 10,
                background: isToday ? '#FFF3E0' : 'transparent',
                border: isToday ? '2px solid #FF9600' : '2px solid transparent' }}>
                {hasSession
                  ? <div style={{ fontSize: 16 }}>🔥</div>
                  : <div style={{ fontSize: 12, fontWeight: 700, color: '#AFAFAF' }}>{day}</div>
                }
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: '#AFAFAF', textAlign: 'center', margin: '0 0 16px', fontWeight: 600 }}>
          이번 달 {Array.from(sessionDates).filter(d => d.startsWith(`${year}-${pad(month)}`)).length}일 독서
        </p>

        {/* 스트릭 마일스톤 카드 공유 버튼 */}
        <button
          onClick={() => setShowMilestoneShare(true)}
          className="btn-duo btn-green"
          style={{ width: '100%', padding: '12px 0', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}
        >
          <span>🔥</span> 연속 {currentStreak}일 마일스톤 공유 카드 만들기
        </button>
      </div>

      {showMilestoneShare && (
        <StreakShareModal
          streak={currentStreak}
          onClose={() => setShowMilestoneShare(false)}
        />
      )}
    </div>
  );
};

// ── NestBanner (§5.2 둥지 진화 + 탭으로 활성 책 전환) ───────────────────────
const NestBanner = ({ userBook, onTap }) => {
  if (!userBook) return (
    <div style={{ margin: '16px 16px 0', borderRadius: 16, padding: 16, textAlign: 'center',
      background: '#f3f4f6', border: '2px solid #E5E5E5' }}>
      <p style={{ fontSize: 13, color: '#AFAFAF', fontWeight: 700, margin: 0 }}>첫 책을 등록해보세요 📚</p>
    </div>
  );
  const pct = Math.min(100, Math.round((userBook.currentPage / userBook.book.total_pages) * 100));
  const st  = getNestStage(pct);
  return (
    <button onClick={onTap} style={{ display: 'block', width: 'calc(100% - 32px)', margin: '16px 16px 0',
      background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ borderRadius: 16, overflow: 'hidden', background: st.bg, border: `2px solid ${st.color}44` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
          {userBook.book.cover_url
            ? <img src={userBook.book.cover_url} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}/>
            : <div style={{ width: 56, height: 56, borderRadius: 12, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{st.emoji}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: st.color }}>{st.emoji} {st.name}</span>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#AFAFAF' }}>{pct}%</span>
              <RightIcon s={14} c="text-gray-400" style={{ marginLeft: 'auto' }}/>
            </div>
            <div style={{ width: '100%', borderRadius: 999, height: 10, background: '#E5E5E5', overflow: 'hidden' }}>
              <div style={{ height: 10, borderRadius: 999, width: `${pct}%`, background: st.color, transition: 'width .7s' }}/>
            </div>
            <p style={{ fontSize: 11, color: '#AFAFAF', marginTop: 4, margin: '4px 0 0', overflow: 'hidden',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {userBook.book.title} · {userBook.currentPage}/{userBook.book.total_pages}p
            </p>
          </div>
        </div>
      </div>
    </button>
  );
};

// ── BottomNav (하단 4탭) ──────────────────────────────────────────────────────
const BottomNav = ({ active, onChange }) => {
  const tabs = [
    { id: 'nest',    label: '둥지',     IC: HomeIcon  },
    { id: 'social',  label: '소셜',     IC: UsersIcon },
    { id: 'village', label: '독서모임', IC: MapIcon   },
    { id: 'library', label: '내서재',   IC: BookIcon  },
  ];
  return (
    <div style={{ display: 'flex', background: '#fff', borderTop: '2px solid #E5E5E5',
      flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(({ id, label, IC }) => {
        const on = active === id;
        return (
          <button key={id} onClick={() => onChange(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
            <IC s={22} c={on ? '' : ''} style={{ color: on ? '#58CC02' : '#AFAFAF' }}/>
            <span style={{ fontSize: 11, fontWeight: 800, color: on ? '#58CC02' : '#AFAFAF' }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ── Toast (알림 시뮬레이션) ───────────────────────────────────────────────────
const Toast = ({ msg, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, pointerEvents: 'none' }} className="pop-in">
      <div style={{ background: '#1F1F1F', color: '#fff', borderRadius: 20, padding: '12px 20px',
        fontSize: 14, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,.3)', whiteSpace: 'nowrap' }}>
        {msg}
      </div>
    </div>
  );
};

// ── BookCover (공통 표지 컴포넌트) ────────────────────────────────────────────
const BookCover = ({ book, size = 56, radius = 12 }) => {
  if (book && book.cover_url) {
    return <img src={book.cover_url} alt={book.title} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }}/>;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: '#F0FDF4',
      border: '2px solid #D7F0BF', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, flexShrink: 0 }}>📖</div>
  );
};

// ── window exports ─────────────────────────────────────────────────────────────
window.Sparrow      = Sparrow;
window.HomeIcon     = HomeIcon;
window.MapIcon      = MapIcon;
window.UsersIcon    = UsersIcon;
window.BookIcon     = BookIcon;
window.SearchIcon   = SearchIcon;
window.XIcon        = XIcon;
window.BackIcon     = BackIcon;
window.RightIcon    = RightIcon;
window.SettingsIcon = SettingsIcon;
window.NestIcon     = NestIcon;
window.AppHeader       = AppHeader;
window.NestBanner      = NestBanner;
window.BottomNav       = BottomNav;
window.Toast           = Toast;
window.BookCover       = BookCover;
window.StreakCalendar  = StreakCalendar;
