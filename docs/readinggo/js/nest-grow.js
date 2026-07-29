/* =========================================================
   ReadingGo — nest-grow.js
   둥지 탭: 둥지 성장 시각화 + XP 기록
   ========================================================= */
const { useState: _useStateNG, useEffect: _useEffectNG } = React;

function NestGrowView({ state }) {
  const [activeTab, setActiveTab] = _useStateNG('log'); // 'log' | 'complete'
  const [myBooks, setMyBooks] = _useStateNG([]);
  const [myQuotes, setMyQuotes] = _useStateNG([]);
  const [myXpLog, setMyXpLog] = _useStateNG([]);
  const [loading, setLoading] = _useStateNG(true);

  const xp = (state && state.xp) || 0;
  const CYCLE = (window.NEST_CYCLE_XP) || 1600;
  const nestNum = Math.floor(xp / CYCLE) + 1;
  const castleCount = Math.floor(xp / CYCLE);
  const cycleXp = xp % CYCLE;

  _useEffectNG(() => {
    let alive = true;
    Promise.all([
      Promise.resolve(DataStore.myBooks.list()).catch(() => []),
      Promise.resolve(
        DataStore.sentences && DataStore.sentences.listMine
          ? DataStore.sentences.listMine()
          : []
      ).catch(() => []),
      Promise.resolve(
        DataStore.xp && DataStore.xp.getLog ? DataStore.xp.getLog() : []
      ).catch(() => []),
    ]).then(([books, quotes, xpLog]) => {
      if (!alive) return;
      setMyBooks(
        (books || [])
          .filter(b => b.status === 'completed' && (b.completed_at || b.completedAt))
          .map(b => ({
            id: b.id || b.ubId,
            title: (b.book && b.book.title) || b.title || '책',
            date: b.completed_at || b.completedAt,
          }))
      );
      setMyQuotes(quotes || []);
      setMyXpLog(xpLog || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const fmtDate = (raw) => {
    if (!raw) return '';
    try {
      const d = new Date(raw);
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch (e) { return ''; }
  };

  // 완독 + 한 문장 기록 이벤트 합산, 날짜 내림차순
  const buildEvents = () => {
    const events = [];
    const rules = window.XP_RULES || {};

    myBooks.forEach(b => {
      events.push({
        key: `complete-${b.id}`,
        ico: '🏰',
        label: `${b.title} 완독`,
        xp: rules.bookComplete || 200,
        date: b.date,
      });
    });

    const datesSeen = new Set();
    [...myQuotes]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .forEach(q => {
        const day = (q.created_at || '').slice(0, 10);
        if (!day || datesSeen.has(day)) return;
        datesSeen.add(day);
        events.push({
          key: `quote-${day}`,
          ico: '📖',
          label: '한 문장 기록',
          xp: rules.dailyMission || 20,
          date: q.created_at,
        });
      });

    myXpLog.forEach(entry => {
      if (entry.key === 'streak7' || entry.key === 'streak30') {
        events.push({
          key: `${entry.key}-${entry.date}`,
          ico: entry.ico || '🔥',
          label: entry.label || (entry.key === 'streak7' ? '7일 연속 독서' : '30일 연속 독서'),
          xp: entry.xp,
          date: entry.date,
        });
      }
    });

    return events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  };

  const events = buildEvents();

  const subTabBtn = (id, label) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1, padding: '11px 0',
        background: 'transparent', border: 'none',
        borderBottom: activeTab === id
          ? '2px solid var(--brand)'
          : '2px solid transparent',
        color: activeTab === id ? 'var(--ink)' : 'var(--ink-3)',
        fontWeight: 800, fontSize: 14,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'color .15s ease',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* 헤더 */}
      <div style={{ padding: '8px 0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.02em' }}>
          지금 짓고 있는 둥지
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.4px' }}>
          {nestNum}번째 둥지
        </div>
        {castleCount > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: 6, padding: '3px 10px', borderRadius: 999,
            background: 'var(--gold-soft)', border: '1px solid var(--gold-soft)',
            fontSize: 12, fontWeight: 700, color: 'var(--gold-shadow)',
          }}>
            🏰 완성된 둥지 {castleCount}개
          </div>
        )}
      </div>

      {/* NestTheatre */}
      <window.NestTheatre xp={xp} />

      {/* 서브탭 */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--line)',
        margin: '20px -16px 0',
        padding: '0 16px',
        background: 'var(--paper)',
        position: 'sticky', top: 0, zIndex: 2,
      }}>
        {subTabBtn('log', '둥지 기록')}
        {subTabBtn('complete', '둥지 완성')}
      </div>

      {/* ── 둥지 기록 탭 ── */}
      {activeTab === 'log' && (
        <div style={{ paddingTop: 14 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)', fontSize: 13 }}>
              불러오는 중…
            </div>
          ) : events.length === 0 ? (
            <div style={{
              background: 'var(--card)', border: '1.5px dashed var(--brand-soft)',
              borderRadius: 'var(--r-md)', padding: '32px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🪹</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                아직 기록이 없어요
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                홈에서 책을 읽고 한 줄을 남기면<br />여기에 기록이 쌓여요
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map(ev => (
                <div key={ev.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--card)', border: '1.5px solid var(--line)',
                  borderRadius: 'var(--r-md)', padding: '12px 14px',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{ev.ico}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 800, color: 'var(--ink)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {ev.label}
                    </div>
                    {ev.date && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        {fmtDate(ev.date)}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontFamily: "'Moneygraphy Pixel', monospace",
                    fontSize: 13, fontWeight: 400, letterSpacing: '0.5px',
                    color: 'var(--brand-3)', flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    +{ev.xp} XP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 둥지 완성 탭 ── */}
      {activeTab === 'complete' && (
        <div style={{ paddingTop: 14 }}>
          {castleCount === 0 ? (
            <div style={{
              background: 'var(--card)', border: '1.5px dashed var(--brand-soft)',
              borderRadius: 'var(--r-md)', padding: '28px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🏰</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                아직 완성된 둥지가 없어요
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 16 }}>
                1,600 XP를 모으면 첫 번째 둥지가 완성돼요
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6,
                }}>
                  <span>첫 번째 둥지까지</span>
                  <span style={{ color: 'var(--brand-3)', fontFamily: "'Moneygraphy Pixel', monospace", letterSpacing: '0.5px' }}>
                    {cycleXp} / 1,600 XP
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    background: 'linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%)',
                    width: `${Math.round(cycleXp / CYCLE * 100)}%`,
                    transition: 'width .6s cubic-bezier(.2,.8,.2,1)',
                  }} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: castleCount }, (_, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'linear-gradient(135deg, var(--brand-tint) 0%, var(--gold-soft) 100%)',
                  border: '1.5px solid var(--brand-soft)',
                  borderRadius: 'var(--r-md)', padding: '14px 16px',
                }}>
                  <span style={{ fontSize: 30, flexShrink: 0 }}>🏰</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)' }}>
                      {i + 1}번째 둥지 완성
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--brand-3)', fontWeight: 700, marginTop: 3 }}>
                      1,600 XP 달성
                    </div>
                  </div>
                </div>
              ))}

              {/* 다음 둥지 진행 중 */}
              <div style={{
                background: 'var(--card)', border: '1.5px dashed var(--line)',
                borderRadius: 'var(--r-md)', padding: '14px 16px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 10 }}>
                  {castleCount + 1}번째 둥지 짓는 중…
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6,
                }}>
                  <span>현재 진행</span>
                  <span style={{ color: 'var(--brand-3)', fontFamily: "'Moneygraphy Pixel', monospace", letterSpacing: '0.5px' }}>
                    {cycleXp} / 1,600 XP
                  </span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    background: 'linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%)',
                    width: `${Math.round(cycleXp / CYCLE * 100)}%`,
                    transition: 'width .6s cubic-bezier(.2,.8,.2,1)',
                  }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

window.NestGrowView = NestGrowView;
