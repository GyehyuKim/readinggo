/* =========================================================
   ReadingGo — app.js
   App 최상위 컴포넌트 + ReactDOM 마운트
   ========================================================= */

// Phase 1: Supabase 실데이터 → appState 형태로 적재 (로그인 후 1회). 실패해도 앱은 뜬다.
async function buildStateFromSupabase() {
  const DS = window.SupabaseDataStore;
  if (!DS) return null;
  const [ub, st, xpv, mine, castles] = await Promise.all([
    DS.activeBook.get().catch(() => null),
    DS.streak.get().catch(() => null),
    DS.xp.get().catch(() => 0),
    DS.sentences.listMine().catch(() => []),
    DS.castles.list().catch(() => []),
  ]);
  const out = {
    streak: st ? (st.current || 0) : 0,
    xp: xpv || 0,
    castleCount: (castles || []).length,
  };
  if (ub && ub.book) {
    const total = ub.book.total_pages || 0; // 0 = 쪽수 미상 (#204) — 진척률 계산 시 가드
    out.book = {
      id: ub.book_id, title: ub.book.title,
      author: (ub.book.author || '') + (ub.book.publisher ? ' · ' + ub.book.publisher : ''),
      cur: ub.current_page || 0, total, days: 1,
      cover: ub.book.cover_url, fb: ['#9AA7B2', '#C7D0D8'], toc: [],
    };
    out.nest = { lv: getNestStageByXp(xpv).lv }; // 둥지 = 누적 XP (#313), 책 무관
  } else {
    // 활성 책 없음(Supabase 모드): 데모책(b008) 환영 방지 — 빈 sentinel 로 '책 등록' 유도.
    out.book = { id: '', title: '', author: '', cur: 0, total: 0, days: 1, cover: '', fb: ['#9AA7B2', '#C7D0D8'], toc: [], _empty: true };
    out.nest = { lv: getNestStageByXp(xpv).lv }; // 둥지는 책 없어도 XP로 유지 (#313)
  }
  // 항상 설정(없으면 []) — 로그인 시 데모 시드(INITIAL_STATE.myQuotes)가 '내 것'으로 남는 문제 방지 (#332).
  out.myQuotes = (Array.isArray(mine) ? mine : []).map(s => ({ id: s.id, text: s.text, bookId: (s.user_book && s.user_book.book_id) || s.book_id || '', bookTitle: (s.user_book && s.user_book.book && s.user_book.book.title) || '', page: s.page, when: '', createdAt: s.created_at || '', note: s.my_note || '', kind: s.kind || 'quote', visibility: s.visibility || 'public', isPrivate: s.visibility === 'private' || !!s.is_private, notePrivate: !!s.note_private }));
  // 소셜 isMine 판정 + 스포일러 동기맵: 현재 사용자 + 내 책별 현재 페이지 preload
  try {
    const me = await window.RG_SB.myProfile();
    if (me) window.RG_ME = { id: me.id, handle: me.handle, displayName: me.display_name, avatar: me.avatar_url, bio: me.bio || '', isAdmin: !!me.is_admin };
  } catch (e) {}
  try {
    const myb = await DS.myBooks.list();
    const pages = {};
    (myb || []).forEach(u => { if (u.book_id) pages[u.book_id] = u.current_page || 0; });
    window.RG_MY_PAGES = pages;
  } catch (e) {}
  return out;
}

// 게스트(로그아웃) 상태에서 남긴 책·문장·대화(my_note)를 로그인 직후 Supabase 로 흡수
// (backend.md §7.7). 데모 시드(_seed)는 제외 — 게스트가 직접 남긴 문장(_guest 태그, #370)을
// 가진 책만 백필한다. 해자("축적되는 대화 데이터")가 가입 시 유실되던 구조 수정.
async function syncPendingToSupabase() {
  const la = window.localStorageAdapter;
  const DS = window.SupabaseDataStore;
  if (!la || !DS) return;
  let local = {};
  try { local = la.read() || {}; } catch (e) { return; }
  const ubs = Array.isArray(local.user_books) ? local.user_books : [];
  const pend = local.pending || {};
  // 게스트가 직접 남긴 문장(_guest)을 가진 책 = 백필 대상(시드 제외).
  const guestBooks = ubs.filter(ub => (ub.sentences || []).some(se => se && se._guest));
  // pending.book: 문장 없이 등록만 한 활성 책(체크인 전 등록) — guestBooks 에 없으면 책만 이전.
  const pb = (pend.book && pend.book.title) ? pend.book : null;
  if (!guestBooks.length && !pb) return;
  try {
    let lastUbId = null, activeNewId = null;
    for (const ub of guestBooks) {
      const bk = ub.book || {};
      const newUb = await DS.myBooks.add({
        book: {
          isbn13: bk.isbn13 || '', title: bk.title || '', author: bk.author || '',
          publisher: bk.publisher || '', total_pages: bk.total_pages || bk.total || 0, cover_url: bk.cover_url || bk.cover || '',
        },
        current_page: ub.current_page || 0,
      });
      if (!newUb || !newUb.id) continue;
      lastUbId = newUb.id;
      if (ub.id && ub.id === local.active_user_book_id) activeNewId = newUb.id;
      try { await DS.sessions.addToday({ userBookId: newUb.id, page: ub.current_page || 0 }); } catch (e) {}
      // _guest 문장만 — my_note(대화)·kind 보존(모트 핵심). add 가 my_note 직접 수용.
      const gsents = (ub.sentences || []).filter(se => se && se._guest)
        .sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      for (const se of gsents) {
        try { await DS.sentences.add({ userBookId: newUb.id, page: se.page, text: se.text, my_note: se.my_note || null, kind: se.kind }); } catch (e) {}
      }
    }
    // 문장 없이 등록만 한 활성 책(레거시 pending) — 중복 아니면 책만 이전.
    if (pb && !guestBooks.some(ub => ub.book && ub.book.title === pb.title)) {
      try {
        const newUb = await DS.myBooks.add({
          book: { isbn13: pb.isbn13 || '', title: pb.title, author: pb.author || '', publisher: pb.publisher || '', total_pages: pb.total_pages || 0, cover_url: pb.cover_url || '' },
          current_page: pb.current_page || 0,
        });
        if (newUb && newUb.id) {
          lastUbId = activeNewId = newUb.id;
          try { await DS.sessions.addToday({ userBookId: newUb.id, page: pb.current_page || 0 }); } catch (e) {}
          if (pend.sentence && pend.sentence.text) { try { await DS.sentences.add({ userBookId: newUb.id, page: pend.sentence.page, text: pend.sentence.text }); } catch (e) {} }
        }
      } catch (e) {}
    }
    if (activeNewId || lastUbId) { try { await DS.activeBook.set(activeNewId || lastUbId); } catch (e) {} }
    // 재동기화 방지 — pending 비우고 _guest 플래그 제거(이전 끝난 문장 표식 해제).
    la.mutate(s => {
      s.pending = {};
      (s.user_books || []).forEach(ub => (ub.sentences || []).forEach(se => { if (se && se._guest) delete se._guest; }));
      return s;
    });
    console.log('[ReadingGo] ✅ 게스트 책·문장·대화(my_note) → Supabase 백필 완료 (#370)');
  } catch (e) { console.warn('[ReadingGo] 게스트 백필 실패:', e); }
}

// my_note("Q. ...\nA. ...\n\n…") → [{q,a}] 파싱. companion_sessions backfill용 (#394). 관대하게.
function parseQAPairs(note) {
  const out = [];
  String(note || '').split(/\n\s*\n/).forEach((b) => {
    const m = b.match(/Q\.\s*([\s\S]*?)(?:\n+A\.\s*([\s\S]*))?$/);
    if (m && m[1] && m[1].trim()) out.push({ q: m[1].trim(), a: (m[2] || '').trim() });
  });
  return out;
}

// 동의 유저의 과거 대화(my_note)를 companion_sessions 로 1회 backfill (#394) — 해자 집계 채움.
// 가드: 동의(yes)만(PIPA) + 기존 세션 0건일 때만(라이브 답변 이력 있으면 스킵 = 중복 방지).
async function backfillCompanionSessions() {
  const DS = window.SupabaseDataStore;
  if (!DS || !(DS.companionSessions && DS.companionSessions.add)) return;
  if (!(window.RG_consent && window.RG_consent.get() === 'yes')) return;
  try {
    const existing = (DS.companionSessions.countMine) ? await DS.companionSessions.countMine() : 1;
    if (existing > 0) return; // 이미 세션 있음 → backfill 안 함
    const mine = await DS.sentences.listMine().catch(() => []);
    let n = 0;
    for (const s of (mine || [])) {
      if (!s || !s.my_note) continue;
      const bookId = (s.user_book && s.user_book.book_id) || s.book_id || null;
      for (const qa of parseQAPairs(s.my_note)) {
        if (!qa.a) continue; // 답 없는 질문만 있는 노트는 세션 아님
        try { await DS.companionSessions.add({ bookId, sentence: s.text, question: qa.q, answer: qa.a, lens: 'why' }); n++; } catch (e) {}
      }
    }
    if (n) console.log('[ReadingGo] ✅ my_note → companion_sessions backfill: ' + n + '턴 (#394)');
  } catch (e) { console.warn('[ReadingGo] companion_sessions backfill 실패:', e); }
}

function BootSplash({ text }) {
  return (
    <div className="stage"><div className="app">
      <div className="rg-boot" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ fontSize: 40 }}>🐦</span>
        <span style={{ fontWeight: 800, color: 'var(--ink-2)' }}>{text || '로딩 중...'}</span>
      </div>
    </div></div>
  );
}

// 전역 에러 바운더리 (#310) — 탭 뷰 한 곳이 크래시해도 앱 셸(상단바·탭바)은 유지.
// <main> 안에서 key={activeTab}로 감싸 탭 전환 시 자동 리셋.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) {
    try { if (window.rgTrack) window.rgTrack('app_error', { message: String((error && error.message) || error).slice(0, 200), tab: this.props.label || '' }); } catch (e) {}
    console.error('[ReadingGo] ErrorBoundary 포착:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🐦</div>
          <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', marginBottom: 6 }}>이 화면을 여는 데 문제가 생겼어요</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 20 }}>잠깐 길을 잃었네요. 다시 시도하거나 둥지로 돌아가요.</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => this.setState({ hasError: false })}
              style={{ padding: '12px 20px', borderRadius: 12, border: '1.5px solid var(--line)', background: '#fff', color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>다시 시도</button>
            <button onClick={() => { this.setState({ hasError: false }); if (this.props.onReset) this.props.onReset(); }}
              style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>🏠 둥지로 가기</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoginScreen({ onLogin, onBack }) {
  const { useState } = React;
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const sendLink = async () => {
    const addr = email.trim();
    if (!addr || busy) return;
    setBusy(true);
    try { await window.RG_SB.signInWithEmail(addr); setSent(true); }
    catch (e) { alert('메일 전송 실패: ' + ((e && e.message) || e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="stage"><div className="app" style={{ position: 'relative' }}>
      {onBack && (
        <button onClick={onBack} aria-label="뒤로"
          style={{ position: 'absolute', top: 16, left: 14, zIndex: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-3)', padding: 6 }}>
          ←
        </button>
      )}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 54 }}>🐦</span>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>reading<span style={{ color: 'var(--brand)' }}>GO</span></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5 }}>지금까지 남긴 기록을<br />계정에 안전하게 간직해요.</div>
        <button onClick={onLogin} style={{ marginTop: 8, padding: '14px 22px', borderRadius: 14, border: '1.5px solid var(--line)', background: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: 18 }}>🟢</span> Google로 시작하기
        </button>
        {sent ? (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.6, background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: '12px 16px', maxWidth: 300 }}>
            📬 <b>{email.trim()}</b>로 로그인 링크를 보냈어요.<br />메일함에서 링크를 눌러 로그인하세요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendLink(); }}
              placeholder="이메일 주소"
              style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 14, fontWeight: 600, outline: 'none' }}
            />
            <button onClick={sendLink} disabled={busy} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? '보내는 중…' : '✉️ 이메일로 시작하기'}
            </button>
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>클로즈베타 · 지인 초대</div>
      </div>
    </div></div>
  );
}

let _rgVisitGranted = false;  // 데모: 방문 XP 세션 1회 적립 가드
function App() {
  const { useState, useCallback, useMemo, useEffect } = React;
  // Phase 1: Supabase 설정 시 로그인 게이트 + 실데이터. 미설정/미로그인은 localStorage 폴백.
  const _supa = !!(window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured());
  const [authUser, setAuthUser] = useState(_supa ? undefined : 'local'); // undefined=확인중, null=로그아웃(게스트), 그외=OK
  const [dataReady, setDataReady] = useState(!_supa);
  const [showLogin, setShowLogin] = useState(false);        // 로그인 화면 온디맨드(벽 아님)
  const [guestBannerOff, setGuestBannerOff] = useState(false); // 게스트 안내 배너 세션 닫기
  const [showConsent, setShowConsent] = useState(() => !!(window.RG_consent && window.RG_consent.get() === null)); // 진입 동의 배너 (#331)
  const [activeTab, setActiveTab] = useState('nest');
  const [selectedTownId, setSelectedTownId] = useState(null);

  // 마을 패치 — DataStore 어댑터 경유 (localStorage 직접 호출 금지)
  const _loadPatches = () => DataStore.villages.patches.load();
  const _savePatches = (p) => DataStore.villages.patches.save(p);

  const [villageTowns, setVillageTowns] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // 스포일러 전역 토글 (§5.7.1): true 면 모든 페이지 블라인드 해제.
  const [spoilerReveal, setSpoilerReveal] = useState(false);
  // 타인 프로필 모달(§5.8.2) — @핸들 탭으로 열림. SentenceCard 가 window.RG_openProfile 호출.
  const [profileHandle, setProfileHandle] = useState(null);
  useEffect(() => { window.RG_openProfile = (h) => setProfileHandle(h); return () => { window.RG_openProfile = null; }; }, []);
  // 설정 모달(§5.8) — 프로필 ⚙️ 로 열림.
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => { window.RG_openSettings = () => setSettingsOpen(true); return () => { window.RG_openSettings = null; }; }, []);
  // 로그인 화면 열기(저장 시점 트리거) — 설정/프로필/배너에서 호출.
  useEffect(() => { window.RG_login = () => setShowLogin(true); return () => { window.RG_login = null; }; }, []);
  // 책 정보 모달(#11) — 한 문장의 책 제목 탭으로 열림.
  const [bookDetailId, setBookDetailId] = useState(null);
  useEffect(() => { window.RG_openBook = (id) => setBookDetailId(id); return () => { window.RG_openBook = null; }; }, []);
  // 한 문장 대화 모달 (#326) — 내 한 문장 탭으로 열림.
  const [companionSentence, setCompanionSentence] = useState(null);
  useEffect(() => { window.RG_openCompanion = (s) => setCompanionSentence(s); return () => { window.RG_openCompanion = null; }; }, []);
  // 스트릭 캘린더(#173) — 🔥 탭으로 열림.
  const [streakOpen, setStreakOpen] = useState(false);
  // 한 문장 모아보기(#171) — 둥지 '전체 보기'로 열림.
  const [collectionOpen, setCollectionOpen] = useState(false);
  useEffect(() => { window.RG_openCollection = () => setCollectionOpen(true); return () => { window.RG_openCollection = null; }; }, []);
  const [appState, setAppState] = useState(() => ({
    ...INITIAL_STATE,
    // village sent 상태는 로컬 복사
    village: INITIAL_STATE.village.map(v => ({ ...v })),
  }));

  // 성(🏰) 개수 — 로컬: 동기 파생 / Supabase: 데이터 로드 시 주입 (§5.2.1).
  const [castleCount, setCastleCount] = useState(() => {
    try { return _supa ? 0 : DataStore.castles.list().length; } catch { return 0; }
  });

  // XP 적립 이벤트 버스 — 방문·반응 XP(grantXp → 'rg:xp')를 상단바 appState.xp 에 반영.
  useEffect(() => {
    const onXp = (e) => {
      const amt = e && e.detail ? e.detail.amount : 0;
      if (amt) setAppState(s => ({ ...s, xp: (s.xp || 0) + amt }));
    };
    window.addEventListener('rg:xp', onXp);
    return () => window.removeEventListener('rg:xp', onXp);
  }, []);

  // 한 문장 삭제(#1)·종류변경(#381) — CompanionModal 등에서 변경 시 appState.myQuotes 즉시 반영.
  useEffect(() => {
    const onRm = (e) => { const id = e && e.detail && e.detail.id; if (!id) return; setAppState(s => ({ ...s, myQuotes: (s.myQuotes || []).filter(q => q.id !== id) })); };
    const onKind = (e) => { const d = e && e.detail; if (!d || !d.id) return; setAppState(s => ({ ...s, myQuotes: (s.myQuotes || []).map(q => q.id === d.id ? { ...q, kind: d.kind } : q) })); };
    const onNote = (e) => { const d = e && e.detail; if (!d || !d.id) return; setAppState(s => ({ ...s, myQuotes: (s.myQuotes || []).map(q => q.id === d.id ? { ...q, note: d.note } : q) })); };
    window.addEventListener('rg:sentence-removed', onRm);
    window.addEventListener('rg:sentence-kind', onKind);
    window.addEventListener('rg:sentence-note', onNote);
    return () => { window.removeEventListener('rg:sentence-removed', onRm); window.removeEventListener('rg:sentence-kind', onKind); window.removeEventListener('rg:sentence-note', onNote); };
  }, []);

  // 단순 방문 보상 — 하루 첫 열람(데모: 세션 1회). 3단계 위계 중 가장 낮은 티어.
  useEffect(() => {
    if (_rgVisitGranted) return;
    _rgVisitGranted = true;
    grantXp(XP_RULES.visit, 'visit');
  }, []);

  // 게스트 myQuotes hydration (#367) — INITIAL_STATE.myQuotes 시드엔 id가 없어
  // 책상세·컬렉션의 공개/좋아요/감상/삭제 버튼(q.id 가드)이 안 떴음. 로컬 어댑터의
  // 시드 문장(id 보유, #366)을 appState 로 끌어와 첫인상부터 기능 노출.
  useEffect(() => {
    if (_supa && authUser && authUser !== 'local') return; // 로그인 경로는 buildStateFromSupabase 담당
    if (window.SupabaseDataStore && window.DataStore === window.SupabaseDataStore) return;
    let alive = true;
    Promise.resolve((DataStore.sentences && DataStore.sentences.listMine) ? DataStore.sentences.listMine() : [])
      .then(rows => {
        if (!alive || !Array.isArray(rows) || !rows.length) return;
        const getT = window.getBook;
        setAppState(s => ({
          ...s,
          myQuotes: rows.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).map(r => ({
            id: r.id, text: r.text, bookId: r.book_id || '',
            bookTitle: (getT && getT(r.book_id) || {}).title || '',
            page: r.page, when: '', createdAt: r.created_at || '',
            note: r.my_note || '', kind: r.kind || 'quote',
            visibility: 'public', isPrivate: false, notePrivate: false,
          })),
        }));
      }).catch(() => {});
    return () => { alive = false; };
  }, [authUser]);

  // 인증 상태 구독 (Supabase 모드)
  useEffect(() => {
    if (!_supa) return;
    window.RG_SB.currentUser().then(u => setAuthUser(u || null)).catch(() => setAuthUser(null));
    return window.RG_SB.onAuthChange(u => setAuthUser(u || null));
  }, []);

  // 로그인 후 Supabase 실데이터 → appState (1회)
  useEffect(() => {
    if (!_supa || !authUser || authUser === 'local') return;
    // 쓰기 경로 보장: index.html S2 스왑이 OAuth 복귀 직후엔 세션 hydration 타이밍상
    // 누락될 수 있어 → 쓰기가 localStorage 로 새고 Supabase 엔 안 저장됨. 로그인 확정
    // 시점에 여기서 DataStore 를 Supabase 로 확실히 교체(쓰기 경로 활성화).
    if (window.SupabaseDataStore && window.DataStore !== window.SupabaseDataStore) {
      window.DataStore = window.SupabaseDataStore;
      console.log('[ReadingGo] DataStore → Supabase (쓰기 경로 활성)');
    }
    let alive = true;
    (async () => {
      try {
        await syncPendingToSupabase();   // 게스트 → 로그인: pending 책·문장 흡수(§7.7)
        backfillCompanionSessions();     // 과거 my_note → companion_sessions 1회 채움(#394, 비차단)
        const next = await buildStateFromSupabase();
        // PostHog 유저 식별 (analytics.md §3.2) — 로그인 유저에 person profile 연결
        try {
          if (window.posthog && authUser && authUser.id) {
            window.posthog.identify(authUser.id, { email: authUser.email || undefined, books_count: (next && next.castleCount) || 0 });
          }
        } catch (e) {}
        if (alive && next) {
          setAppState(s => ({ ...s, ...next }));
          if (typeof next.castleCount === 'number') setCastleCount(next.castleCount);
        }
      } catch (e) { console.error('[ReadingGo] 데이터 로드 실패:', e); }
      finally { if (alive) setDataReady(true); }
    })();
    return () => { alive = false; };
  }, [authUser]);

  // 멀티 디바이스 정합(#191) — 탭이 다시 보일 때 Supabase 상태 재로드(다른 기기 변경 반영, stale view 방지)
  // ⚠️ 가드(장시간 세션 버그 — 1h QA 재현): 게스트/세션만료 상태에서 재로드하면 모든 fetch가
  // 401→catch 폴백 → "빈 상태"가 기존 상태를 덮어 둥지가 빈 화면이 되고, NestView가
  // 빈 둥지 UI로 갈아끼워지며 portal(ReadingMode)이 언마운트 → 타이머·세션 소멸 + 콘솔 400 에러.
  useEffect(() => {
    if (!_supa) return;
    let busy = false;
    const onVis = async () => {
      if (document.hidden || busy || !window.SupabaseDataStore) return;
      // 읽기 세션 중엔 보류 — 백그라운드 갱신이 둥지/읽기모드를 교체하지 않도록.
      if (window.RG_READING_OPEN) return;
      // 인증 세션 없으면(게스트·만료 직후) 재로드 금지 — 빈 상태 덮어쓰기 사고 방지.
      try {
        const c = window.RG_SB && window.RG_SB.client && window.RG_SB.client();
        if (!c) return;
        const { data } = await c.auth.getSession();
        if (!data || !data.session) return;
      } catch (e) { return; }
      busy = true;
      try { const next = await buildStateFromSupabase(); if (next) { setAppState(s => ({ ...s, ...next })); if (typeof next.castleCount === 'number') setCastleCount(next.castleCount); } }
      catch (e) {} finally { busy = false; }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [_supa]);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedTownId(null);
    // 스크롤 맨위로
    const main = document.querySelector('.main');
    if (main) main.scrollTop = 0;
  }, []);

  const handleSelectTown = useCallback((townId) => {
    setSelectedTownId(townId);
  }, []);

  const handleBackToVillage = useCallback(() => {
    setSelectedTownId(null);
  }, []);

  const handleTownUpdate = useCallback((updatedFields) => {
    const { id, ...rest } = updatedFields;
    setVillageTowns(prev => prev.map(t => t.id === id ? { ...t, ...rest } : t));
    // 멤버·게시판·마일스톤 변경 → localStorage 패치에 저장
    const PERSIST = ['members', '_topics', 'milestones', 'name', 'description', 'visibility'];
    const patches = _loadPatches();
    if (!patches[id]) patches[id] = {};
    PERSIST.forEach(k => { if (rest[k] !== undefined) patches[id][k] = rest[k]; });
    _savePatches(patches);
  }, []);

  // VillageView가 towns 목록을 넘길 때 localStorage 패치를 merge하여 변경사항 복원
  const handleTownsChange = useCallback((towns) => {
    const patches = _loadPatches();
    setVillageTowns(towns.map(t => patches[t.id] ? { ...t, ...patches[t.id] } : t));
  }, []);

  // NestView가 체크인/simskip 후 자체 업데이트하고 콜백으로 상위 동기화.
  // 둥지 단계(nest.lv)는 누적 XP에서 파생 (#313) → NestView가 계산해 넘긴다(§5.2).
  const handleCheckin = useCallback((ns, nestLv, xpGain, sentence) => {
    setAppState(s => ({
      ...s,
      book: ns.book,
      streak: ns.streak,
      xp: ns.xp,
      nest: { ...s.nest, lv: nestLv },
      myQuotes: ns.myQuotes,
    }));
    window.dispatchEvent(new CustomEvent('rg:today-checked'));
    // 게스트(로그아웃 + Supabase 모드): 저장-worthy 한 책·문장을 pending 에 포착 →
    // 로그인 시 syncPendingToSupabase 가 흡수(§7.7). DataStore 가 아직 localStorage 인 동안만.
    if (_supa && window.SupabaseDataStore && window.DataStore !== window.SupabaseDataStore && sentence) {
      try {
        const b = ns.book || {};
        window.localStorageAdapter.mutate(s => {
          s.pending = s.pending || {};
          s.pending.book = { isbn13: b.isbn13 || '', title: b.title || '', author: b.author || '', total_pages: b.total || 0, current_page: b.cur || 0, cover_url: b.cover || '' };
          s.pending.sentence = { text: sentence, page: b.cur || 0 };
          return s;
        });
      } catch (e) {}
    }
    // Phase 1: 백엔드 영속(로그인 시). 낙관적 UI 유지 + 백그라운드 persist.
    // sessions.addToday 가 스트릭 bump 까지 연동(양 어댑터). 활성 책 없으면 no-op.
    (async () => {
      try {
        const ub = await Promise.resolve(DataStore.activeBook.get());
        if (!ub || !ub.id) { console.warn('[ReadingGo] 체크인: 활성 책 없음 — 등록 먼저 필요'); return; }
        await Promise.resolve(DataStore.sessions.addToday({ userBookId: ub.id, page: ns.book.cur }));
        if (sentence) await Promise.resolve(DataStore.sentences.add({ userBookId: ub.id, page: ns.book.cur, text: sentence }));
        if (xpGain) await Promise.resolve(DataStore.xp.add(xpGain, 'checkin'));
        console.log('[ReadingGo] ✅ 체크인 저장 완료 (ub=' + ub.id + ')');
        // DB 권위값으로 스트릭·XP·내 한 문장 정합 (낙관 표시 어긋남 + 새 문장 id 부재 → 감상 버튼 지연 방지, H2/§5.8.4)
        const [stDb, xpDb, mineDb] = await Promise.all([
          Promise.resolve(DataStore.streak.get()).catch(() => null),
          Promise.resolve(DataStore.xp.get()).catch(() => null),
          Promise.resolve(DataStore.sentences.listMine()).catch(() => null),
        ]);
        setAppState(s => ({
          ...s,
          streak: (stDb && typeof stDb.current === 'number') ? stDb.current : s.streak,
          xp: (typeof xpDb === 'number') ? xpDb : s.xp,
          myQuotes: Array.isArray(mineDb)
            ? mineDb.map(x => ({ id: x.id, text: x.text, bookId: (x.user_book && x.user_book.book_id) || x.book_id || '', bookTitle: (x.user_book && x.user_book.book && x.user_book.book.title) || '', page: x.page, when: '', createdAt: x.created_at || '', note: x.my_note || '', kind: x.kind || 'quote', isPrivate: !!x.is_private, notePrivate: !!x.note_private }))
            : s.myQuotes,
        }));
      } catch (e) { console.warn('[ReadingGo] 체크인 영속 실패:', e); }
    })();
  }, []);

  // 읽기모드 한 문장 저장 → appState.myQuotes 즉시 반영 (#358).
  // 종전엔 NestView 내부 상태만 갱신 → ✕ 나가기(체크인 미경유) 시 책상세·프로필에서 문장 누락.
  const handleArchive = useCallback((q) => {
    setAppState(s => ({ ...s, myQuotes: [q, ...s.myQuotes] }));
  }, []);

  // 하루 거르기: 둥지·XP·성은 존속, 스트릭만 영향 (§5.4).
  const handleSimSkip = useCallback((ns) => {
    setAppState(s => ({
      ...s,
      streak: ns.streak,
    }));
  }, []);

  const handleSendSeed = useCallback((idx) => {
    setAppState(s => {
      const village = s.village.map((v, i) => i === idx ? { ...v } : v);
      if (village[idx].sent) {
        showToast('오늘은 이미 보냈어요 🌱');
        return s;
      }
      village[idx].sent = true;
      showToast(`@${village[idx].name}에게 🪱 콕찌르기를 보냈어요!`);
      return { ...s, village };
    });
  }, []);

  const handleSetActiveBook = useCallback((bookId) => {
    const bk = getBook(bookId);
    if (!bk) return;
    setAppState(s => {
      // 현재 책 진도 저장
      INITIAL_PROGRESS[s.book.id] = { cur: s.book.cur, days: s.book.days };
      const prog = INITIAL_PROGRESS[bookId] || { cur: 1, days: 1 };
      // 둥지는 책과 무관 — 책 전환 시 유지 (#313). nest 재계산 안 함.
      return {
        ...s,
        book: {
          id: bk.id, title: bk.title,
          author: bk.author + ' · ' + bk.pub,
          cur: prog.cur, total: bk.total, days: prog.days,
          cover: bk.cover, fb: bk.fb, toc: bk.toc,
        },
      };
    });
    showToast(`📖 ${bk.title} — 활성 책으로 설정`);
    switchTab('nest');
    // Phase 1: 로그인(Supabase 모드)이면 책을 백엔드에 등록 + 활성화. myBooks 없는
    // localStorage 폴백에선 skip(데모 시드 사용) — 양 어댑터 안전.
    if (DataStore.myBooks && DataStore.myBooks.add) {
      (async () => {
        try {
          const mine = await Promise.resolve(DataStore.myBooks.list());
          let ub = (mine || []).find(u => u.book && (u.book.isbn13 === bk.isbn || u.book.title === bk.title));
          if (!ub) {
            ub = await Promise.resolve(DataStore.myBooks.add({
              book: { isbn13: bk.isbn, title: bk.title, author: bk.author, publisher: bk.pub, total_pages: bk.total, cover_url: bk.cover },
              current_page: (window.INITIAL_PROGRESS && window.INITIAL_PROGRESS[bookId] && window.INITIAL_PROGRESS[bookId].cur) || 0,
            }));
          }
          if (ub && ub.id) { await Promise.resolve(DataStore.activeBook.set(ub.id)); console.log('[ReadingGo] ✅ 책 등록 완료:', bk.title, '(ub=' + ub.id + ')'); }
        } catch (e) { console.warn('[ReadingGo] 활성책 등록 실패:', e); }
      })();
    }
  }, [switchTab]);

  const handleSearchSelectBook = useCallback((book) => {
    setIsSearchOpen(false);
    switchTab('nest');
    // 검색 결과(데모 or 알라딘 = 전체 책 정보) → Supabase 등록 + 활성화. 데모 getBook 비의존.
    if (!(DataStore.myBooks && DataStore.myBooks.add)) return;
    const isbn13 = book.isbn13 || book.isbn || '';
    (async () => {
      try {
        // 알라딘 검색(ItemSearch)은 쪽수를 주지 않음 → 쪽수 없으면 isbn 개별 조회(ItemLookUp)로 1회 보강 (QA7 #1)
        let totalPages = book.total_pages || 0;
        if (!totalPages && isbn13) {
          const proxy = (window.RG_CONFIG && window.RG_CONFIG.ALADIN_PROXY) || '';
          if (proxy) {
            try {
              const r = await fetch(`${proxy}?isbn=${encodeURIComponent(isbn13)}`);
              if (r.ok) { const d = await r.json(); const it = d && d.items && d.items[0]; if (it && it.total_pages) totalPages = Number(it.total_pages) || 0; }
            } catch (e) { /* 프록시 실패 시 쪽수 미상으로 진행(#204 수동 폴백) */ }
          }
        }
        const mine = await Promise.resolve(DataStore.myBooks.list());
        let ub = (mine || []).find(u => u.book && ((isbn13 && u.book.isbn13 === isbn13) || u.book.title === book.title));
        if (!ub) {
          ub = await Promise.resolve(DataStore.myBooks.add({
            book: { isbn13: isbn13, title: book.title, author: book.author, publisher: book.publisher, total_pages: totalPages, cover_url: book.cover_url },
            current_page: 0,
          }));
        }
        if (ub && ub.id) {
          await Promise.resolve(DataStore.activeBook.set(ub.id));
          setAppState(s => ({
            ...s,
            book: {
              id: ub.book_id, title: book.title,
              author: (book.author || '') + (book.publisher ? ' · ' + book.publisher : ''),
              cur: ub.current_page || 0, total: totalPages, days: 1,
              cover: book.cover_url, fb: ['#9AA7B2', '#C7D0D8'], toc: [],
            },
            // 둥지는 책과 무관 — 유지 (#313)
          }));
          showToast(`📖 ${book.title} 등록 완료`);
        }
      } catch (e) { console.warn('[ReadingGo] 검색 책 등록 실패:', e); }
    })();
  }, [switchTab]);

  // 책 정보 모달 '이 책 읽기' → 검색-등록 경로 재사용 (#11)
  useEffect(() => {
    window.RG_registerBook = (b) => handleSearchSelectBook({ isbn13: b.isbn13 || b.isbn, title: b.title, author: b.author, publisher: b.publisher, total_pages: b.total_pages, cover_url: b.cover_url });
    return () => { window.RG_registerBook = null; };
  }, [handleSearchSelectBook]);

  // 이미 등록된 user_book 으로 활성 전환 (서재에서 — 재등록 없이 activeBook.set).
  const handleActivateUserBook = useCallback((item) => {
    if (!item || !item.id) return;
    setAppState(s => ({
      ...s,
      book: {
        id: item.id, title: item.title,
        author: (item.author || '') + (item.pub ? ' · ' + item.pub : ''),
        cur: item.cur || 0, total: item.total || 0, days: 1,
        cover: item.cover, fb: item.fb || ['#9AA7B2', '#C7D0D8'], toc: [],
      },
      // 둥지는 책과 무관 — 유지 (#313)
    }));
    showToast(`📖 ${item.title} — 활성 책으로 변경`);
    switchTab('nest');
    if (item.ubId && DataStore.activeBook && DataStore.activeBook.set) {
      Promise.resolve(DataStore.activeBook.set(item.ubId)).catch(e => console.warn('[ReadingGo] 활성 전환 실패:', e));
    }
  }, [switchTab]);
  // 활성 책 전환을 전역 노출 — 둥지 캐러셀(#185)이 호출
  useEffect(() => { window.RG_activateBook = handleActivateUserBook; return () => { window.RG_activateBook = null; }; }, [handleActivateUserBook]);

  // Phase 1 인증 — 게스트 우선(onboarding.md §4). 로그인은 '저장' 시점에만 요구.
  if (_supa && authUser === undefined) return (<BootSplash text="확인 중..." />);
  if (showLogin) return (<LoginScreen onLogin={() => window.RG_SB.signInWithGoogle()} onBack={() => setShowLogin(false)} />);
  // 로그인 사용자만 Supabase 데이터 로드 대기. 게스트(authUser===null)는 localStorage 로 즉시 진입.
  if (_supa && authUser && authUser !== 'local' && !dataReady) return (<BootSplash text="불러오는 중..." />);

  const isGuest = _supa && authUser === null;

  return (
    <div className="stage">
      <div className="app">

        {/* 상단 바 */}
        <header className="topbar">
          <div className="topbar-row">
            <div className="brand-mark" role="button" tabIndex={0} title="둥지로 (홈)"
              onClick={() => switchTab('nest')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') switchTab('nest'); }}>
              <span className="sparrow" aria-hidden="true">🐦</span>
              <span>reading<span className="go">GO</span></span>
            </div>
            <div className="topbar-stats">
              <button
                onClick={() => switchTab('profile')}
                className="stat"
                title="성 컬렉션 (완독 권수)"
                style={{
                  background:'transparent',
                  border:'none',
                  cursor:'pointer',
                  padding:0,
                  font:'inherit',
                }}
              >
                <span className="ico">🏰</span>
                <span>×{castleCount}</span>
              </button>
              <button className="stat fire" title="스트릭 캘린더 — 탭" onClick={() => setStreakOpen(true)} style={{ cursor: 'pointer', font: 'inherit' }}>
                <span className="ico">🔥</span>
                <span>{appState.streak}</span>
              </button>
              <span className="stat gold" title="누적 XP">
                <span className="ico">⚡</span>
                <span>{appState.xp}</span>
              </span>
              <span className="stat lv" title="레벨 (systems.md §6.3)">
                <span>Lv.{calcLevel(appState.xp)}</span>
              </span>
              <span className="stat shield" title="방패 개수">
                <span className="ico">🪶</span>
                <span>{appState.shield}</span>
              </span>
              {/* 스포일러 토글은 설정(프로필 ⚙️)으로 이전 (#3) */}
              <button
                onClick={() => setIsSearchOpen(true)}
                style={{
                  background:'transparent',
                  border:'none',
                  fontSize:20,
                  cursor:'pointer',
                  padding:'4px 8px',
                  marginLeft:8,
                }}
                title="도서 검색"
              >
                🔍
              </button>
            </div>
          </div>
        </header>

        {/* 게스트 안내 배너 — 로그인 없이 둘러보는 중. 로그인=저장 (onboarding.md §4 E). */}
        {isGuest && !guestBannerOff && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: 'var(--brand-tint)', borderBottom: '1px solid var(--brand-soft)', fontSize: 12.5, fontWeight: 700, color: 'var(--brand-3)' }}>
            <span style={{ fontSize: 15 }}>🐦</span>
            <span style={{ flex: 1, lineHeight: 1.35 }}>게스트로 둘러보는 중 — 로그인하면 내 기록이 저장돼요</span>
            <button onClick={() => setShowLogin(true)}
              style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 999, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
              저장하기
            </button>
            <button onClick={() => setGuestBannerOff(true)} aria-label="배너 닫기"
              style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, padding: '0 2px' }}>
              ×
            </button>
          </div>
        )}

        {/* 메인 스크롤 영역 — 스포일러 전역 토글을 4영역 공통 제공 (§5.7.1) */}
        <main className="main">
          <ErrorBoundary key={activeTab} label={activeTab} onReset={() => switchTab('nest')}>
          <SpoilerContext.Provider value={spoilerReveal}>
          {activeTab === 'nest' && (
            <NestView
              key="nest"
              state={appState}
              onCheckin={handleCheckin}
              onSimSkip={handleSimSkip}
              onGoLibrary={() => switchTab('profile')}
              onGoSocial={() => switchTab('social')}
              onOpenSearch={() => setIsSearchOpen(true)}
              onArchive={handleArchive}
            />
          )}
          {activeTab === 'village' && !selectedTownId && (
            <VillageView
              key="village"
              state={appState}
              onSelectTown={handleSelectTown}
              onTownsChange={handleTownsChange}
            />
          )}
          {activeTab === 'village' && selectedTownId && (
            <TownDetailView
              key={`town_${selectedTownId}`}
              state={villageTowns.length > 0 ? { ...appState, towns: villageTowns } : appState}
              townId={selectedTownId}
              onBack={handleBackToVillage}
              onTownUpdate={handleTownUpdate}
            />
          )}
          {activeTab === 'social' && (
            <SocialView
              key="social"
              state={appState}
            />
          )}
          {activeTab === 'profile' && (
            <LibraryView
              key="library"
              state={appState}
              onSetActiveBook={handleSetActiveBook}
              onActivateUserBook={handleActivateUserBook}
            />
          )}
          </SpoilerContext.Provider>
          </ErrorBoundary>
        </main>

        {/* 하단 탭바 */}
        <nav className="tabbar">
          {[
            { id: 'nest',    ico: '🏠', label: '둥지'   },
            { id: 'village', ico: '🌳', label: '마을'   },
            { id: 'social',  ico: '🏆', label: '소셜'   },
            { id: 'profile', ico: '👤', label: '프로필' },
          ].map(t => (
            <button
              key={t.id}
              className={'tab' + (activeTab === t.id ? ' active' : '')}
              onClick={() => switchTab(t.id)}
            >
              <span className="ico">{t.ico}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* 진입 동의 배너 (#331) — 비차단 하단. 첫 방문(consent===null) 시 1회. */}
        {showConsent && (
          <ConsentBanner onChoose={(v) => { if (window.RG_consent) window.RG_consent.set(v); if (window.rgTrack) window.rgTrack('data_consent', { value: v, source: 'banner' }); setShowConsent(false); }} />
        )}

        {/* 전역 Toast */}
        <Toast />

        {/* 도서 검색 모달 */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          books={ALL_BOOKS}
          onSelectBook={handleSearchSelectBook}
          topRecommendations={ALL_BOOKS.slice(0, 8)}
        />

        {/* 타인 프로필 모달 (§5.8.2) — @핸들 탭으로 열림 */}
        {profileHandle && ReactDOM.createPortal(
          <UserProfileModal handle={profileHandle} onClose={() => setProfileHandle(null)} />,
          document.body
        )}

        {/* 설정 모달 (§5.8) — 프로필 ⚙️ */}
        {settingsOpen && ReactDOM.createPortal(
          <SettingsModal onClose={() => setSettingsOpen(false)} spoilerReveal={spoilerReveal} setSpoilerReveal={setSpoilerReveal} />,
          document.body
        )}

        {/* 책 정보 모달 (#11) — 한 문장 책 제목 탭 */}
        {companionSentence && (
          <CompanionModal sentence={companionSentence} onClose={() => setCompanionSentence(null)} />
        )}

        {bookDetailId && ReactDOM.createPortal(
          <BookInfoModal bookId={bookDetailId} onClose={() => setBookDetailId(null)} />,
          document.body
        )}

        {/* 스트릭 캘린더 (#173) — 🔥 탭 */}
        {streakOpen && ReactDOM.createPortal(
          <StreakCalendarModal streak={appState.streak} onClose={() => setStreakOpen(false)} />,
          document.body
        )}

        {/* 한 문장 모아보기 (#171) */}
        {collectionOpen && ReactDOM.createPortal(
          <SentenceCollectionModal onClose={() => setCollectionOpen(false)} />,
          document.body
        )}

      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
