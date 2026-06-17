/* =========================================================
   ReadingGo — admin-dashboard.js  (#761 모듈화: components.js에서 추출)
   AdminDashboardModal — 운영자 풀페이지 대시보드(is_admin 전용). components.js **이후**,
   library.js(소비자) **이전**에 로드. showToast/SupabaseDataStore 등은 window 전역. 순수 이동.
   ========================================================= */

// loadBabel은 파일별 eval 스코프 → 훅은 이 파일에서 다시 구조분해(전역 공유 X, #761 추출 시 필수).
const { useState, useEffect } = React;

/* ── AdminDashboardModal: 운영 대시보드 — is_admin=true 전용 (#161) ── */
function AdminDashboardModal({ onClose }) {
  const [stats, setStats] = useState(null);
  const [inqs, setInqs] = useState(undefined); // 문의 목록
  const [popular, setPopular] = useState(null); // 인기책 TOP (#190)
  const [active, setActive] = useState(null);   // 활성 사용자 7/30일 (#190)
  const [completion, setCompletion] = useState(null); // 완독률 (#744 ③)
  const [cohort, setCohort] = useState(null);         // 가입 코호트 리텐션 (#744 ③)
  const [resonance, setResonance] = useState(null);   // 콘텐츠 공명 (#744 ③)
  useEffect(() => {
    const DS = window.SupabaseDataStore;
    if (!DS || !DS.admin || !DS.admin.stats) { setStats({}); setInqs([]); return; }
    Promise.resolve(DS.admin.stats()).then(setStats).catch(() => setStats({}));
    if (DS.admin.inquiries) Promise.resolve(DS.admin.inquiries()).then((r) => setInqs(r || [])).catch(() => setInqs([]));
    else setInqs([]);
    if (DS.admin.popularBooks) Promise.resolve(DS.admin.popularBooks(5)).then((r) => setPopular(r || [])).catch(() => setPopular([]));
    if (DS.admin.activeUsers) Promise.resolve(DS.admin.activeUsers()).then(setActive).catch(() => setActive(null));
    // 고도화 (#744 ③) — 완독률·코호트 리텐션·콘텐츠 공명 (29_admin_insights_v2.sql)
    if (DS.admin.completionStats) Promise.resolve(DS.admin.completionStats()).then(setCompletion).catch(() => setCompletion(null));
    if (DS.admin.cohortRetention) Promise.resolve(DS.admin.cohortRetention(8)).then((r) => setCohort(r || [])).catch(() => setCohort([]));
    if (DS.admin.contentResonance) Promise.resolve(DS.admin.contentResonance(10)).then((r) => setResonance(r || [])).catch(() => setResonance([]));
  }, []);
  // 문의 상태 순환 (open→answered→closed→open)
  const cycleStatus = (q) => {
    const DS = window.SupabaseDataStore;
    if (!DS || !DS.admin || !DS.admin.inquirySetStatus) return;
    const next = q.status === 'open' ? 'answered' : q.status === 'answered' ? 'closed' : 'open';
    setInqs((list) => (list || []).map((x) => x.id === q.id ? { ...x, status: next } : x));
    Promise.resolve(DS.admin.inquirySetStatus(q.id, next)).catch(() => {});
  };
  const _stColor = { open: '#E5484D', answered: '#F59E0B', closed: '#9097A0' };
  const rows = [
    ['👤 가입자', stats && stats.users],
    ['🙋 실사용자', stats && stats.realUsers],   // NPC 제외 (#190 A)
    ['📝 한 문장', stats && stats.sentences],
    ['🏰 완독', stats && stats.completed],
    ['⚡ 오늘 체크인', stats && stats.todaySessions],
  ];
  const trend = (stats && stats.trend) || [];
  return (
    // ph-no-capture: 운영자 세션 리플레이에서도 타 유저 이메일·문장 노출 마스킹 (analytics.md §5.4, #752)
    <div className="ph-no-capture" style={{position:'fixed',inset:0,background:'var(--paper)',overflowY:'auto',zIndex:60}} role="dialog" aria-label="운영 대시보드">
      <div style={{maxWidth:600,margin:'0 auto',minHeight:'100%'}}>
        <div style={{padding:'16px 20px 48px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
            <div style={{fontSize:20,fontWeight:900,color:'var(--ink)'}}>운영 대시보드</div>
            <button onClick={onClose} aria-label="닫기" style={{background:'var(--card)',border:'1.5px solid var(--line)',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:800,color:'var(--ink-2)',cursor:'pointer'}}>닫기</button>
          </div>
          {!stats ? (
            <div style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>불러오는 중…</div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {rows.map(([label, val]) => (
                <div key={label} style={{background:'var(--card)',border:'1px solid var(--line)',borderRadius:10,padding:'16px 12px',textAlign:'center'}}>
                  <div style={{fontSize:24,fontWeight:900,color:'var(--brand)'}}>{val ?? '—'}</div>
                  <div style={{fontSize:11,color:'var(--ink-3)',fontWeight:700,marginTop:6}}>{label}</div>
                </div>
              ))}
            </div>
          )}
          {/* 최근 7일 추세 (#206) — 체크인=막대(하단 숫자) + 가입=선그래프(포인트 숫자). 가입은 NPC 제외 */}
          {trend.length > 0 && (() => {
            const n = trend.length;
            const H = 96;
            const sessMax = Math.max(1, ...trend.map((t) => t.sessions));
            const signMax = Math.max(1, ...trend.map((t) => t.signups));
            const pts = trend.map((t, i) => ({
              x: ((i + 0.5) / n) * 100,
              y: H - (t.signups / signMax) * (H - 20) - 6, // 위쪽 숫자 여백
              signups: t.signups,
            }));
            const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 2 }}>📈 최근 7일</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
                  <span style={{ color: 'var(--brand)' }}>■ 체크인(막대)</span> · <span style={{ color: '#E2553B' }}>● 가입(선, NPC 제외)</span>
                </div>
                <div style={{ position: 'relative', height: H }}>
                  {/* 체크인 막대 */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                    {trend.map((t) => (
                      <div key={t.date} title={`${t.date} · 체크인 ${t.sessions} · 가입 ${t.signups}`}
                        style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                        <div style={{ width: '60%', height: Math.round((t.sessions / sessMax) * (H - 16)) + 2, background: 'var(--brand)', borderRadius: 3, opacity: 0.88 }} />
                      </div>
                    ))}
                  </div>
                  {/* 가입 선그래프 (SVG 오버레이) */}
                  <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                    <polyline points={poly} fill="none" stroke="#E2553B" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    {pts.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#E2553B" vectorEffect="non-scaling-stroke" />))}
                  </svg>
                  {/* 가입 포인트 숫자 */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                    {pts.map((p, i) => (
                      <div key={i} style={{ flex: 1, position: 'relative' }}>
                        {p.signups > 0 && (
                          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: (p.y / H * 100) + '%', marginTop: -15, fontSize: 9, fontWeight: 800, color: '#E2553B' }}>{p.signups}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* 체크인 수(막대 하단 숫자) + 날짜 */}
                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                  {trend.map((t) => (
                    <div key={t.date} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)' }}>{t.sessions}</div>
                      <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 700 }}>{t.date.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* 활성 사용자 — 리텐션 프록시 (#190 C) */}
          {active && (
            <div style={{ marginTop: 22, display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)' }}>{active.d7}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>최근 7일 활성</div>
              </div>
              <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand)' }}>{active.d30}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>최근 30일 활성</div>
              </div>
            </div>
          )}
          {/* 인기책 TOP (#190 C) */}
          {popular && popular.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>🔥 인기책 TOP {popular.length}</div>
              {popular.map((b, i) => (
                <div key={b.bookId || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: i < popular.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                  <div style={{ width: 20, fontWeight: 900, color: 'var(--ink-3)', textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>등록 {b.registered} · 완독 {b.completed}</div>
                </div>
              ))}
            </div>
          )}
          {/* 완독률 (#744 ③) */}
          {completion && (
            <div style={{ marginTop: 22, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>완독률</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--brand)' }}>{completion.rate != null ? completion.rate + '%' : '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>완독 {completion.completed} / 등록 {completion.total}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginTop: 4 }}>읽는 중 {completion.reading} · 중단 {completion.aborted}</div>
            </div>
          )}
          {/* 가입 코호트 리텐션 (#744 ③) — 가입 주차 × N주 후 체크인 잔존 % */}
          {cohort && cohort.length > 0 && (() => {
            const byCohort = {};
            let maxW = 0;
            cohort.forEach((r) => { const c = (byCohort[r.cohort] = byCohort[r.cohort] || { size: r.size, weeks: {} }); c.weeks[r.week] = r.retained; if (r.week > maxW) maxW = r.week; });
            const cols = Array.from({ length: Math.min(maxW, 7) + 1 }, (_, i) => i);
            const cwList = Object.keys(byCohort).sort();
            return (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>가입 코호트 리텐션</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                    <thead><tr>
                      <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--ink-3)', fontWeight: 700 }}>가입주차</th>
                      <th style={{ padding: '4px 6px', color: 'var(--ink-3)', fontWeight: 700 }}>n</th>
                      {cols.map((w) => <th key={w} style={{ padding: '4px 6px', color: 'var(--ink-3)', fontWeight: 700 }}>W{w}</th>)}
                    </tr></thead>
                    <tbody>
                      {cwList.map((cw) => {
                        const row = byCohort[cw];
                        return (
                          <tr key={cw}>
                            <td style={{ padding: '4px 6px', fontWeight: 700, whiteSpace: 'nowrap' }}>{String(cw).slice(5)}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center', color: 'var(--ink-3)' }}>{row.size}</td>
                            {cols.map((w) => {
                              const ret = row.weeks[w];
                              const pct = (ret != null && row.size) ? Math.round(100 * ret / row.size) : null;
                              const bg = pct == null ? 'transparent' : 'rgba(63,209,127,' + (0.1 + 0.0075 * pct).toFixed(3) + ')';
                              return <td key={w} style={{ padding: '4px 6px', textAlign: 'center', background: bg, fontWeight: 700, color: pct == null ? 'var(--ink-4)' : 'var(--ink)' }}>{pct == null ? '·' : pct + '%'}</td>;
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
          {/* 콘텐츠 공명 — 짹 많은 한 문장 (#744 ③) */}
          {resonance && resonance.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>콘텐츠 공명 — 짹 많은 한 문장</div>
              {resonance.map((s, i) => (
                <div key={s.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 4px', borderBottom: i < resonance.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                  <div style={{ width: 20, fontWeight: 900, color: 'var(--ink-3)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>"{s.text}"</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginTop: 2 }}>{s.bookTitle}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--brand-3)', fontWeight: 800, flexShrink: 0 }}>🐦 {s.claps}</div>
                </div>
              ))}
            </div>
          )}
          {/* 행동 분석 — PostHog 링크아웃 (#744 ③) */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>행동 분석 (PostHog)</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 10 }}>퍼널·리텐션·세션 리플레이는 PostHog 콘솔에서</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['독서 루프 퍼널', 'https://us.posthog.com/project/458802/insights'], ['세션 리플레이', 'https://us.posthog.com/project/458802/replay'], ['프로젝트', 'https://us.posthog.com/project/458802']].map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-3)', background: 'var(--brand-tint)', border: '1px solid var(--brand-soft)', borderRadius: 999, padding: '6px 12px', textDecoration: 'none' }}>{label} ↗</a>
              ))}
            </div>
          </div>
          {/* 문의 목록 */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>✉️ 문의 {inqs && inqs.length ? '(' + inqs.length + ')' : ''}</div>
            {inqs === undefined ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>불러오는 중…</div>
            ) : inqs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>접수된 문의가 없어요</div>
            ) : inqs.map((q) => (
              <div key={q.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>@{(q.user && q.user.handle) || '익명'} · {String(q.created_at).slice(0, 10)}</div>
                  <button onClick={() => cycleStatus(q)} title="상태 변경" style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: _stColor[q.status] || '#9097A0', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer' }}>{q.status}</button>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{q.message}</div>
                {q.app_version && <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, marginRight: 8 }}>v{q.app_version}</span>}
                {q.email && <a href={`mailto:${q.email}?subject=${encodeURIComponent('[ReadingGo] 문의 답변')}`} style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--brand-3)', fontWeight: 800 }}>✉️ {q.email} 로 답장</a>}
                {/* AI 자동 답변 (#208) — 스캐폴드: LLM 연동 전까지 자리만 */}
                {q.response ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-2)', background: 'var(--brand-tint)', borderRadius: 6, padding: '6px 8px', whiteSpace: 'pre-wrap' }}>🤖 {q.response}</div>
                ) : (
                  <button onClick={() => (window.showToast ? window.showToast('AI 자동 답변은 LLM 연동 후 활성화돼요 (#208)') : null)}
                    style={{ display: 'inline-block', marginTop: 6, marginLeft: 8, fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', background: 'transparent', border: '1px dashed var(--line)', borderRadius: 10, padding: '3px 8px', cursor: 'pointer' }}>🤖 AI 답변 생성 (준비중)</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.AdminDashboardModal = AdminDashboardModal;
