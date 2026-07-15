/* =========================================================
   ReadingGo — app.js
   App 최상위 컴포넌트 + ReactDOM 마운트
   ========================================================= */

// Phase 1: Supabase 실데이터 → appState 형태로 적재 (로그인 후 1회). 실패해도 앱은 뜬다.
async function buildStateFromSupabase() {
  const DS = window.SupabaseDataStore;
  if (!DS) return null;
  const [ub, st, xpv, mine] = await Promise.all([
    DS.activeBook.get().catch(() => null),
    DS.streak.get().catch(() => null),
    DS.xp.get().catch(() => 0),
    DS.sentences.listMine().catch(() => []),
  ]);
  const out = {
    streak: st ? (st.current || 0) : 0,
    xp: xpv || 0,
    castleCount: 0, // 완독 권수(posthog books_count) — 아래 myBooks 파생으로 채움 (#513: castles.list 호출 제거)
  };
  if (ub && ub.book) {
    const total = ub.book.total_pages || 0; // 0 = 쪽수 미상 (#204) — 진척률 계산 시 가드
    out.book = {
      id: ub.book_id, ubId: ub.id, title: ub.book.title, author: ub.book.author || '', pub: ub.book.publisher || '',
      cur: ub.current_page || 0, total, days: 1,
      cover: ub.book.cover_url, fb: ['#9AA7B2', '#C7D0D8'], toc: [],
    };
    out.nest = { lv: getNestStageByXp(xpv).lv }; // 둥지 = 누적 XP (#313), 책 무관
  } else {
    // 활성 책 없음(Supabase 모드): 데모책(b008) 환영 방지 — 빈 sentinel 로 '책 등록' 유도.
    out.book = { id: '', title: '', author: '', pub: '', cur: 0, total: 0, days: 1, cover: '', fb: ['#9AA7B2', '#C7D0D8'], toc: [], _empty: true };
    out.nest = { lv: getNestStageByXp(xpv).lv }; // 둥지는 책 없어도 XP로 유지 (#313)
  }
  // 항상 설정(없으면 []) — 로그인 시 데모 시드(INITIAL_STATE.myQuotes)가 '내 것'으로 남는 문제 방지 (#332).
  out.myQuotes = (Array.isArray(mine) ? mine : []).map(s => ({ id: s.id, text: s.text, bookId: (s.user_book && s.user_book.book_id) || s.book_id || '', bookTitle: (s.user_book && s.user_book.book && s.user_book.book.title) || '', page: s.page, when: '', createdAt: s.created_at || '', note: s.my_note || '', kind: s.kind || 'quote', visibility: s.visibility || 'public', isPrivate: s.visibility === 'private' || !!s.is_private, notePrivate: !!s.note_private }));
  // 소셜 isMine 판정 + 스포일러 동기맵: 현재 사용자 + 내 책별 현재 페이지 preload
  try {
    const me = await window.RG_SB.myProfile();
    if (me) window.RG_ME = { id: me.id, handle: me.handle, displayName: me.display_name, avatar: me.avatar_url, bio: me.bio || '', isAdmin: !!me.is_admin, wishlist_public: !!me.wishlist_public };
  } catch (e) {}
  try {
    const myb = await DS.myBooks.list();
    const pages = {};
    let completed = 0;
    (myb || []).forEach(u => { if (u.book_id) pages[u.book_id] = u.current_page || 0; if (u.status === 'completed') completed++; });
    window.RG_MY_PAGES = pages;
    out.castleCount = completed; // 완독 권수 — castles.list 대신 myBooks 파생 (#513)
  } catch (e) {}
  return out;
}

// 게스트(localStorage)도 활성 책을 appState로 올려야 한다. DataStore는 영속되지만,
// appState를 INITIAL_STATE로만 시작하면 재방문 홈이 빈 상태로 보인다(#1221).
// Supabase 로그인 경로는 buildStateFromSupabase가 뒤이어 덮어쓰므로 여기서는 local adapter만 읽는다.
function buildStateFromGuest() {
  const DS = window.DataStore;
  if (!DS || DS === window.SupabaseDataStore) return null;
  try {
    const ub = DS.activeBook && DS.activeBook.get && DS.activeBook.get();
    const st = DS.streak && DS.streak.get && DS.streak.get();
    const xpv = (DS.xp && DS.xp.get && DS.xp.get()) || 0;
    const out = {
      streak: st ? (st.current || 0) : 0,
      xp: xpv,
      nest: { lv: getNestStageByXp(xpv).lv },
    };
    if (ub && ub.book) {
      const b = ub.book;
      out.book = {
        id: ub.book_id || b.id || '', ubId: ub.id, title: b.title || '', author: b.author || '', pub: b.publisher || '',
        cur: ub.current_page || 0, total: b.total_pages || 0, days: 1,
        cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], toc: [],
      };
    } else {
      out.book = { id: '', title: '', author: '', pub: '', cur: 0, total: 0, days: 1, cover: '', fb: ['#9AA7B2', '#C7D0D8'], toc: [], _empty: true };
    }
    return out;
  } catch (e) {
    console.warn('[ReadingGo] 게스트 상태 복원 실패:', e.message);
    return null;
  }
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

// #822: 쓰기 실패를 사용자에게 노출(silent 제거) + 세션 만료가 원인이면 복구.
// 증상: 로그인 상태(getSession 로컬판정)인데 토큰이 만료/무효 → 쓰기 401 → user_books 행 미생성 →
// 서재 빈 채 + 체크인 'user_book 미해소'. 그동안 console.warn 으로만 삼켜져 사용자 무피드백이었다.
// 처리: ① getUser(네트워크 검증) → 살아있으면 일시 오류 안내, ② 죽었으면 refreshSession 시도,
//       ③ 그래도 실패면 세션 만료 안내 + 재로그인 화면. 게스트/localStorage 모드는 일반 안내만.
async function surfaceWriteError(e, msg) {
  console.warn('[ReadingGo] 쓰기 실패:', e);
  const supa = !!(window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured());
  if (!(supa && window.DataStore === window.SupabaseDataStore)) {
    if (window.showToast) window.showToast(msg || '저장에 실패했어요 — 잠시 후 다시 시도해주세요');
    return;
  }
  let sessionOk = false;
  try {
    const c = window.RG_SB.client && window.RG_SB.client();
    if (c) {
      const { data: g, error: ge } = await c.auth.getUser();   // 네트워크 토큰 검증(에러 처리 경로라 허용)
      if (!ge && g && g.user) sessionOk = true;
      else { const { data: r } = await c.auth.refreshSession(); sessionOk = !!(r && r.session); }
    }
  } catch (_) { sessionOk = false; }
  if (sessionOk) {
    if (window.showToast) window.showToast(msg || '저장에 실패했어요 — 다시 시도해주세요');
  } else {
    if (window.showToast) window.showToast('세션이 만료됐어요 — 다시 로그인하면 저장돼요');
    if (window.RG_login) window.RG_login();   // 로그인 화면(app.js RG_login 등록)
  }
}

function BootSplash({ text }) {
  return (
    <div className="stage"><div className="app">
      <div className="rg-boot" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <window.SparrowMark size={40} />
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><window.SparrowMark size={44} /></div>
          <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)', marginBottom: 6 }}>이 화면을 여는 데 문제가 생겼어요</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 20 }}>잠깐 길을 잃었네요. 다시 시도하거나 둥지로 돌아가요.</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => this.setState({ hasError: false })}
              style={{ padding: '12px 20px', borderRadius: 12, border: '1.5px solid var(--line)', background: '#fff', color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>다시 시도</button>
            <button onClick={() => { this.setState({ hasError: false }); if (this.props.onReset) this.props.onReset(); }}
              style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{window.rgIcon('home', 15)} 둥지로 가기</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 소셜 로그인 버튼 (#937) — provider 브랜드 가이드 색을 따른다(DESIGN.md 그린 위계의 예외:
// OAuth 버튼은 각 제공자 브랜드 규정 우선, 기존 Google 버튼과 동일한 형태·라운딩·폭으로 정렬).
const SOCIAL_BTN_BASE = {
  width: '100%', padding: '13px 18px', borderRadius: 12, fontSize: 15, fontWeight: 800,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
};
const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);
// 카카오 말풍선 심볼 (단색, 카카오 브랜드 검정 #191919).
const KakaoGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#191919" d="M12 3C6.477 3 2 6.463 2 10.733c0 2.74 1.85 5.146 4.633 6.508-.153.534-.985 3.4-1.018 3.625 0 0-.02.17.09.235.11.065.24.014.24.014.31-.043 3.59-2.345 4.16-2.74.61.086 1.24.131 1.895.131 5.523 0 10-3.463 10-7.733S17.523 3 12 3z"/>
  </svg>
);
// 애플 로고 (단색, 흰색 — 검정 버튼 위).
const AppleGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#fff" d="M17.05 12.04c-.03-2.74 2.24-4.06 2.34-4.12-1.28-1.87-3.27-2.13-3.98-2.16-1.69-.17-3.3.99-4.16.99-.85 0-2.18-.97-3.59-.94-1.85.03-3.55 1.07-4.5 2.72-1.92 3.33-.49 8.26 1.38 10.96.91 1.32 2 2.81 3.42 2.76 1.37-.06 1.89-.89 3.55-.89 1.65 0 2.12.89 3.57.86 1.47-.03 2.41-1.35 3.31-2.68 1.04-1.54 1.47-3.03 1.49-3.1-.03-.02-2.86-1.1-2.89-4.36zM14.4 4.07c.76-.92 1.27-2.2 1.13-3.47-1.09.04-2.41.73-3.19 1.64-.7.81-1.31 2.1-1.15 3.34 1.21.09 2.45-.62 3.21-1.51z"/>
  </svg>
);

function LoginScreen({ onLogin, onBack }) {
  const { useState } = React;
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // 애플 로그인 노출 게이팅 (#937 · #1054): iOS 네이티브에서만. 웹·Android 는 숨긴다 — 웹 Apple 은
  // $99 Apple Developer 미결제로 비기능(거슬리는 빈 버튼, #873 보류)이라 가린다. iOS App Store 4.8
  // (타사 소셜로그인 쓰면 Apple 동등 제공 필수)은 iOS 네이티브에서만 발효 → 거기서만 노출하면 충족.
  // Capacitor 미로드 시엔 웹으로 간주(=숨김). 완전 삭제 아님: iOS 트랙서 Apple Developer 설정 시 즉시 복원.
  const platform = (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || 'web';
  const showApple = platform === 'ios';
  const social = (provider) => { try { onLogin(provider); } catch (e) { alert('로그인 실패: ' + ((e && e.message) || e)); } };
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <window.SparrowMark size={50} spark />
          <div style={{ fontSize: 27, fontWeight: 900, color: 'var(--ink)' }}>Reading<span style={{ color: 'var(--brand)' }}>Go</span></div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5 }}>지금까지 남긴 기록을<br />계정에 안전하게 간직해요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300, marginTop: 8 }}>
          <button onClick={() => social('google')} aria-label="Google로 시작하기"
            style={{ ...SOCIAL_BTN_BASE, border: '1.5px solid var(--line)', background: '#fff', color: 'var(--ink)', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <GoogleGlyph /> Google로 시작하기
          </button>
          <button onClick={() => social('kakao')} aria-label="카카오로 시작하기"
            style={{ ...SOCIAL_BTN_BASE, border: 'none', background: '#FEE500', color: '#191919', cursor: 'pointer' }}>
            <KakaoGlyph /> 카카오로 시작하기
          </button>
          {showApple && (
            <button onClick={() => social('apple')} aria-label="Apple로 시작하기"
              style={{ ...SOCIAL_BTN_BASE, border: 'none', background: '#000', color: '#fff', cursor: 'pointer' }}>
              <AppleGlyph /> Apple로 시작하기
            </button>
          )}
        </div>
        {sent ? (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.6, background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: '12px 16px', maxWidth: 300, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{window.rgIcon('mail', 15)}</span>
            <span><b>{email.trim()}</b>로 로그인 링크를 보냈어요.<br />메일함에서 링크를 눌러 로그인하세요.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendLink(); }}
              placeholder="이메일 주소"
              style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 14, fontWeight: 600, outline: 'none' }}
            />
            <button onClick={sendLink} disabled={busy} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {busy ? '보내는 중…' : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M2.5 4.5L8 8.5l5.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  이메일로 시작하기
                </>
              )}
            </button>
          </div>
        )}
        {/* 공개 출시(#1126): 구 "클로즈베타 · 지인 초대" 카피 제거 → 처리방침 링크(privacy-policy.md §8 노출 위치). */}
        <a href="./privacy.html" target="_blank" rel="noopener" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, textDecoration: 'underline' }}>개인정보처리방침</a>
      </div>
    </div></div>
  );
}

let _rgVisitGranted = false;  // 데모: 방문 XP 세션 1회 적립 가드
/* 인앱 브라우저(카카오 등) 안내 배너 (#1096) — 외부 기본 브라우저로 빼야 로그인·복사·공유가 풀린다.
   카카오는 openExternal 스킴으로 원클릭, 그 외(인스타·페북)는 안내만. dismiss 가능. */
function InAppBanner() {
  const { useState } = React;
  const [info] = useState(() => (window.RG_inApp ? window.RG_inApp.detect() : { isAny: false, canEscape: false }));
  const [hidden, setHidden] = useState(false);
  if (!info.isAny || hidden) return null;
  return (
    <div className="rg-inapp-banner" role="alert">
      <span className="rg-inapp-msg">로그인·링크 복사가 막히는 인앱 브라우저예요. 기본 브라우저로 열면 정상 작동해요.</span>
      {info.canEscape
        ? <button className="rg-inapp-open" onClick={() => window.RG_inApp.openExternal()}>브라우저로 열기</button>
        : <span className="rg-inapp-tip">우측 상단 ⋯ → "다른 브라우저로 열기"</span>}
      <button className="rg-inapp-x" onClick={() => setHidden(true)} aria-label="배너 닫기">×</button>
    </div>
  );
}

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // 스포일러 전역 토글 (§5.7.1): true 면 모든 페이지 블라인드 해제.
  const [spoilerReveal, setSpoilerReveal] = useState(false);
  // 저장된 동의 적용 (analytics.md §5.4, #752) — 복귀 'yes' 유저면 세션 리플레이 시작(init은 기본 off).
  // 거부·미질문이면 no-op(이미 off). 식별은 로그인 흐름에서 별도 게이팅.
  useEffect(() => { if (window.RG_applyConsent) window.RG_applyConsent(window.RG_consent && window.RG_consent.get()); }, []);
  // 타인 프로필 모달(§5.8.2) — @핸들 탭으로 열림. SentenceCard 가 window.RG_openProfile 호출.
  const [profileHandle, setProfileHandle] = useState(null);
  useEffect(() => { window.RG_openProfile = (h) => setProfileHandle(h); return () => { window.RG_openProfile = null; }; }, []);
  // 설정 모달(§5.8) — 프로필 ⚙️ 로 열림.
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => { window.RG_openSettings = () => setSettingsOpen(true); return () => { window.RG_openSettings = null; }; }, []);
  // 같이읽기 방 모달(co-reading.md §5.3) — 방 카드·badge·미리보기에서 window.RG_openRoom(roomId) 로 열림.
  const [roomOpenId, setRoomOpenId] = useState(null);
  useEffect(() => { window.RG_openRoom = (id) => setRoomOpenId(id); return () => { window.RG_openRoom = null; }; }, []);
  // #1094: 초대 딥링크 — ?r=<token> 으로 진입하면 토큰으로 숲을 찾아 미리보기를 띄운다(참여 전).
  //   쿼리(루트 /)라 base './'(Capacitor) 자산이 정상 로드된다(/r/ 경로는 상대자산이 /r/assets 로 깨짐).
  //   게스트도 공개 숲은 anon read 로 조회되도록 SupabaseDataStore.findByToken 우선(게스트 기본 DataStore 는
  //   로컬이라 남의 숲을 모름). 토큰은 즉시 정리 — 새로고침·공유 시 재처리/노출 방지.
  const [invitePreview, setInvitePreview] = useState(null);
  useEffect(() => {
    const token = new URLSearchParams(location.search).get('r');
    if (!token || !/^[A-Za-z0-9]+$/.test(token)) return;
    history.replaceState(null, '', location.pathname);
    (async () => {
      try {
        const ds = (window.SupabaseDataStore && window.SupabaseDataStore.rooms && window.SupabaseDataStore.rooms.findByToken)
          ? window.SupabaseDataStore : DataStore;
        const room = (ds.rooms && ds.rooms.findByToken) ? await ds.rooms.findByToken(token) : null;
        if (room) setInvitePreview(room);
        else if (window.showToast) window.showToast('초대받은 숲을 찾을 수 없어요');
      } catch (e) {
        if (window.showToast) window.showToast('초대 링크를 여는 데 실패했어요');
      }
    })();
  }, []);
  // 로그인 화면 열기(저장 시점 트리거) — 설정/프로필/배너에서 호출.
  useEffect(() => { window.RG_login = () => setShowLogin(true); return () => { window.RG_login = null; }; }, []);
  // 책 상세 통일(#11, 통일성) — 어디서 누르든 같은 책=같은 화면. 탭이 아니라 '소유'로 라우팅:
  // 소유 책이면 풀 BookDetailModal(진척·별점·내문장·관련·export, 책장과 동일), 미소유면 BookInfoModal(정보+등록).
  const [bookDetailId, setBookDetailId] = useState(null);        // 미소유 책 → BookInfoModal(canonical book id)
  const [bookDetailItem, setBookDetailItem] = useState(null);    // 소유 책 → BookDetailModal(리치 user_book 아이템)
  useEffect(() => {
    window.RG_openBook = (id) => {
      const DS = window.DataStore || {};
      // 소유 여부를 먼저 확인한 뒤 알맞은 모달을 연다(정보→상세 깜빡임 방지). 실패 시 정보 모달 폴백.
      Promise.resolve((DS.myBooks && DS.myBooks.list) ? DS.myBooks.list() : [])
        .then((rows) => {
          const ub = (Array.isArray(rows) ? rows : []).find((u) => u.book_id === id || (u.book && u.book.id === id));
          if (ub) {
            const b = ub.book || {};
            // library.js allItems 와 동일한 리치 아이템 매핑(단일 소스 일치 — BookDetailModal 계약).
            setBookDetailItem({ ubId: ub.id, id: ub.book_id || id, title: b.title || '제목 없음', author: b.author || '', pub: b.publisher || '', cover: b.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], total: b.total_pages || 0, isbn: b.isbn13 || '', cur: ub.current_page || 0, status: ub.status, rating: ub.rating, comment: ub.review_text, completedAt: ub.completed_at, recap: ub.companion_recap || '', description: (b.description || '').trim(), source: b.source || '' });
            setBookDetailId(null);
          } else {
            setBookDetailId(id); setBookDetailItem(null);
          }
        })
        .catch(() => { setBookDetailId(id); setBookDetailItem(null); });
    };
    return () => { window.RG_openBook = null; };
  }, []);
  // 검색 모달 전역 오픈 (#403) — 서재 위시리스트 '+찜하기' 등에서 호출.
  useEffect(() => { window.RG_openSearch = () => setIsSearchOpen(true); return () => { window.RG_openSearch = null; }; }, []);
  // 검색 프리필 오픈 (#943) — 바코드 스캔이 책을 못 찾았을 때 ISBN 을 검색창에 채워 수동 확인.
  const [searchPrefill, setSearchPrefill] = useState('');
  useEffect(() => { window.RG_openSearchWith = (q) => { setSearchPrefill(q || ''); setIsSearchOpen(true); }; return () => { window.RG_openSearchWith = null; }; }, []);
  // 한 문장 대화 모달 (#326) — 내 한 문장 탭으로 열림.
  const [companionSentence, setCompanionSentence] = useState(null);
  // #1070: 두 번째 인자로 진입 모드 지정 — { mode: 'note'|'jacky' }. 카드 버튼이 문장별 선택을 전달(없으면 모달이 자체 추정).
  useEffect(() => { window.RG_openCompanion = (s, opts) => setCompanionSentence((opts && opts.mode) ? { ...s, _openMode: opts.mode } : s); return () => { window.RG_openCompanion = null; }; }, []);
  // 한 문장 모아보기(#171) — 둥지 '전체 보기'로 열림.
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState(null); // 저장(❤️) 진입 시 'fav' (#510)
  const [collectionMode, setCollectionMode] = useState(null); // 책장 상시 진입점은 묻기 모드로 바로 열기 (#1274)
  useEffect(() => { window.RG_openCollection = (opts) => { setCollectionFilter(opts && opts.filter); setCollectionMode(opts && opts.mode); setCollectionOpen(true); }; return () => { window.RG_openCollection = null; }; }, []);
  // 스샷 서가 복원(#772) — 빈 서재 CTA로 열림.
  const [shelfImportOpen, setShelfImportOpen] = useState(false);
  // 유연 임포트(#1039) — 붙여넣기/파일 텍스트로 가져오기. 스샷과 형제 진입점(텍스트/파일이 1순위).
  const [textImportOpen, setTextImportOpen] = useState(false);
  // 게스트 게이트(#1048): 미로그인(게스트)은 모달 대신 로그인 유도(+토스트). 이유: 비전 LLM 코스트 +
  // 임포트는 실계정에 영속(검토함). 로그인 사용자만 모달 진입. authUser 변화 시 재등록(최신 게스트 판정).
  useEffect(() => {
    window.RG_openShelfImport = () => {
      if (_supa && authUser === null) {
        if (window.showToast) window.showToast('로그인하면 책을 가져올 수 있어요');
        if (window.RG_login) window.RG_login();
        return;
      }
      setShelfImportOpen(true);
    };
    // 유연 임포트(#1039) — 스샷과 동일한 로그인 게이트(검토함 영속·일관성, flexible-import.md §3).
    window.RG_openTextImport = () => {
      if (_supa && authUser === null) {
        if (window.showToast) window.showToast('로그인하면 책을 가져올 수 있어요');
        if (window.RG_login) window.RG_login();
        return;
      }
      setTextImportOpen(true);
    };
    return () => { window.RG_openShelfImport = null; window.RG_openTextImport = null; };
  }, [authUser]);
  const [appState, setAppState] = useState(() => ({ ...INITIAL_STATE, ...(buildStateFromGuest() || {}) }));
  const [popularBooks, setPopularBooks] = useState(null);  // #835: 검색 추천 인기 도서(우리 사이트) — startedThisWeek + ALL_BOOKS 폴백

  // 검색 추천 '인기 도서' (#835) — 우리 사이트 인기(최근 등록 상위, social과 동일 RPC) 우선, 부족분은 카탈로그 폴백.
  useEffect(() => {
    let alive = true;
    const fb = (typeof ALL_BOOKS !== 'undefined' ? ALL_BOOKS : (window.ALL_BOOKS || [])).slice(0, 8);
    const DS = window.DataStore;
    if (!(DS && DS.books && DS.books.startedThisWeek)) { setPopularBooks(fb); return; }
    Promise.resolve(DS.books.startedThisWeek(8)).then((rows) => {
      if (!alive) return;
      const popular = (rows || []).filter(x => x && x.bookId).map(x => ({ book_id: x.bookId, title: x.title, author: x.author, cover_url: x.cover_url }));
      // 중복 제거는 제목 정규화 기준(#835 후속, #970) — startedThisWeek(isbn13 book_id)와 ALL_BOOKS(RG_BOOKS id)
      // 체계가 달라 book_id로는 같은 책을 못 거른다(데미안 중복). 부제(' - …수상작')·괄호를 절단해 정규화하고,
      // RPC 결과 *내부* 중복까지 통합 dedup(이전엔 fb만 비교) — 같은 책의 부제본+깔끔본이 둘 다 노출되던 문제.
      const _nt = (t) => String(t || '').split(/\s[-–—]\s/)[0].replace(/\([^)]*\)/g, '').replace(/\s+/g, '').toLowerCase();
      const merged = new Map();
      for (const b of [...popular, ...fb]) {
        const k = _nt(b.title);
        if (!k) continue;
        const cur = merged.get(k);
        if (!cur) { merged.set(k, b); continue; }
        // 같은 책: 짧은(=부제 없는 깔끔한) 제목 + 있는 표지/메타 채택
        merged.set(k, {
          ...cur,
          title: String(b.title).length < String(cur.title).length ? b.title : cur.title,
          cover_url: cur.cover_url || b.cover_url,
          total_pages: cur.total_pages || b.total_pages,
          publisher: cur.publisher || b.publisher,
        });
      }
      const deduped = [...merged.values()].slice(0, 8);
      setPopularBooks(deduped.length ? deduped : fb);
    }).catch(() => { if (alive) setPopularBooks(fb); });
    return () => { alive = false; };
  }, []);

  // XP 적립 이벤트 버스 — 방문·반응 XP(grantXp → 'rg:xp')를 상단바 appState.xp 에 반영.
  useEffect(() => {
    const onXp = (e) => {
      const amt = e && e.detail ? e.detail.amount : 0;
      if (amt) setAppState(s => ({ ...s, xp: (s.xp || 0) + amt }));
    };
    window.addEventListener('rg:xp', onXp);
    return () => window.removeEventListener('rg:xp', onXp);
  }, []);

  // 스트릭 '하루 만회'(#938, A1) — nest 복구 카드가 streak 을 되살리면 상단 표시·state.streak 정합.
  useEffect(() => {
    const onRepair = (e) => {
      const v = e && e.detail ? e.detail.streak : null;
      if (typeof v === 'number') setAppState(s => ({ ...s, streak: v }));
    };
    window.addEventListener('rg:streak-repaired', onRepair);
    return () => window.removeEventListener('rg:streak-repaired', onRepair);
  }, []);

  // 한 문장 삭제(#1)·종류변경(#381) — CompanionModal 등에서 변경 시 appState.myQuotes 즉시 반영.
  useEffect(() => {
    const onRm = (e) => { const id = e && e.detail && e.detail.id; if (!id) return; setAppState(s => ({ ...s, myQuotes: (s.myQuotes || []).filter(q => q.id !== id) })); };
    const onKind = (e) => { const d = e && e.detail; if (!d || !d.id) return; setAppState(s => ({ ...s, myQuotes: (s.myQuotes || []).map(q => q.id === d.id ? { ...q, kind: d.kind } : q) })); };
    const onNote = (e) => { const d = e && e.detail; if (!d || !d.id) return; setAppState(s => ({ ...s, myQuotes: (s.myQuotes || []).map(q => q.id === d.id ? { ...q, note: d.note } : q) })); };
    // 한 문장 본문·페이지 수정 (#683/#731) — SentenceActions.saveEdit 의 rg:sentence-updated 반영.
    const onUpd = (e) => { const d = e && e.detail; if (!d || !d.id) return; setAppState(s => ({ ...s, myQuotes: (s.myQuotes || []).map(q => q.id === d.id ? { ...q, text: d.text, page: d.page } : q) })); };
    // 책 상세에서 한 문장 추가 (#584) — 새 문장을 myQuotes 최상단에 반영(중복 가드).
    const onAdd = (e) => { const q = e && e.detail && e.detail.quote; if (!q || !q.id) return; setAppState(s => ({ ...s, myQuotes: (s.myQuotes || []).some(x => x.id === q.id) ? s.myQuotes : [q, ...(s.myQuotes || [])] })); };
    window.addEventListener('rg:sentence-removed', onRm);
    window.addEventListener('rg:sentence-kind', onKind);
    window.addEventListener('rg:sentence-note', onNote);
    window.addEventListener('rg:sentence-updated', onUpd);
    window.addEventListener('rg:sentence-added', onAdd);
    return () => { window.removeEventListener('rg:sentence-removed', onRm); window.removeEventListener('rg:sentence-kind', onKind); window.removeEventListener('rg:sentence-note', onNote); window.removeEventListener('rg:sentence-updated', onUpd); window.removeEventListener('rg:sentence-added', onAdd); };
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
  // + 활성 책·스트릭·XP hydration (#1221) — #1136 빈 시작 이후 게스트 부팅은 appState.book 이
  //   항상 빈 센티널이라, 책을 등록해도 리로드하면 홈이 '읽을 책 등록' hero 로 떨어졌다
  //   (데이터는 rg_v41 에 멀쩡 — 기록이 사라진 걸로 오인, 게스트 리텐션 킬러). 로그인 경로
  //   (buildStateFromSupabase)와 대칭으로 localStorage 활성 책을 끌어온다.
  //   진짜 신규(활성 책 없음, ub=null)는 setAppState 를 건너뛰어 hero 유지(#1136 보존).
  useEffect(() => {
    if (_supa && authUser && authUser !== 'local') return; // 로그인 경로는 buildStateFromSupabase 담당
    if (window.SupabaseDataStore && window.DataStore === window.SupabaseDataStore) return;
    let alive = true;
    Promise.all([
      Promise.resolve(DataStore.activeBook && DataStore.activeBook.get ? DataStore.activeBook.get() : null).catch(() => null),
      Promise.resolve(DataStore.streak && DataStore.streak.get ? DataStore.streak.get() : null).catch(() => null),
      Promise.resolve(DataStore.xp && DataStore.xp.get ? DataStore.xp.get() : null).catch(() => null),
    ]).then(([ub, st, xp]) => {
      if (!alive || !ub || !ub.book) return;   // 활성 책 없으면 빈 시작 유지
      const total = ub.book.total_pages || 0;  // 0 = 쪽수 미상 (#204)
      setAppState(s => ({
        ...s,
        book: {
          id: ub.book_id, ubId: ub.id, title: ub.book.title, author: ub.book.author || '', pub: ub.book.publisher || '',
          cur: ub.current_page || 0, total, days: 1,
          cover: ub.book.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], toc: [],
        },
        streak: (st && typeof st.current === 'number') ? st.current : s.streak,
        xp: (typeof xp === 'number') ? xp : s.xp,
      }));
    }).catch(() => {});
    Promise.resolve((DataStore.sentences && DataStore.sentences.listMine) ? DataStore.sentences.listMine() : [])
      .then(rows => {
        if (!alive || !Array.isArray(rows) || !rows.length) return;
        const getT = window.getBook;
        setAppState(s => ({
          ...s,
          myQuotes: rows.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).map(r => {
            // #1224: 게스트 등록 책(book_id='bk_…')은 카탈로그 밖 → listMine 이 실어 준 book_title 1순위.
            // getBook 은 미스 시 RG_BOOKS[0] 폴백이라 id 일치 가드 필수(엉뚱한 제목 귀속 방지).
            const bk = getT ? getT(r.book_id) : null;
            return {
              id: r.id, text: r.text, bookId: r.book_id || '',
              bookTitle: r.book_title || (bk && bk.id === r.book_id ? bk.title : ''),
              page: r.page, when: '', createdAt: r.created_at || '',
              note: r.my_note || '', kind: r.kind || 'quote',
              visibility: 'public', isPrivate: false, notePrivate: false,
            };
          }),
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

  // 로그인 성공 시 로그인 화면 자동 닫기(#1011). 웹은 OAuth 리디렉트가 페이지를 리로드해
  // showLogin 이 초기화되지만, 네이티브(#968 딥링크 복귀)는 리로드가 없어 인증돼도 로그인
  // 화면이 그대로 남는다. authUser 가 채워지면(로그인·세션복원) 로그인 화면을 닫는다.
  useEffect(() => { if (authUser) setShowLogin(false); }, [authUser]);

  // #490: 부팅 시 books 카탈로그 적재 — getBook 동기 캐시 워밍(게스트도 anon RLS read, 실패 시 TSV 폴백).
  useEffect(() => { if (window.loadBooks) Promise.resolve(window.loadBooks()).catch(() => {}); }, []);

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
        // PostHog 유저 식별 (analytics.md §3.2·§5.4) — 선택 동의('yes')한 로그인 유저만 person profile 연결.
        // 거부·미질문이면 식별 생략(익명 분석은 유지) — PIPA 비필수 분리(#752).
        try {
          if (window.posthog && authUser && authUser.id && window.RG_consent && window.RG_consent.get() === 'yes') {
            window.posthog.identify(authUser.id, { email: authUser.email || undefined, books_count: (next && next.castleCount) || 0 });
          }
        } catch (e) {}
        if (alive && next) {
          setAppState(s => ({ ...s, ...next }));
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
      try { const next = await buildStateFromSupabase(); if (next) { setAppState(s => ({ ...s, ...next })); } }
      catch (e) {} finally { busy = false; }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [_supa]);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    // 스크롤 맨위로
    const main = document.querySelector('.main');
    if (main) main.scrollTop = 0;
  }, []);

  // NestView가 체크인/simskip 후 자체 업데이트하고 콜백으로 상위 동기화.
  // 둥지 단계(nest.lv)는 누적 XP에서 파생 (#313) → NestView가 계산해 넘긴다(§5.2).
  const handleCheckin = useCallback((ns, nestLv, xpGain, sentence, kind, sentPage, sentences) => {
    // #1202: 문장 고유 페이지(sentPage)를 영속 — 진도(cur)와 분리. 없으면 현재 진도로 폴백(레거시 호출).
    const qPage = (typeof sentPage === 'number') ? sentPage : ((ns.book && ns.book.cur) || 0);
    // 배치 초안(#1198) — 여러 문장이면 N개 모두 영속(공유 페이지). null 이면 단일 경로.
    const batch = Array.isArray(sentences) ? sentences.filter(s => s && s.text && String(s.text).trim()) : null;
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
    // 배치(#1198)는 pending 단일 캡처 대신 localStorage user_book.sentences 의 _guest 마킹으로 로그인 시 일괄 이전됨(syncPendingToSupabase §7.7). 단일만 레거시 pending 캡처.
    if (_supa && window.SupabaseDataStore && window.DataStore !== window.SupabaseDataStore && sentence && !batch) {
      try {
        const b = ns.book || {};
        window.localStorageAdapter.mutate(s => {
          s.pending = s.pending || {};
          s.pending.book = { isbn13: b.isbn13 || '', title: b.title || '', author: b.author || '', total_pages: b.total || 0, current_page: b.cur || 0, cover_url: b.cover || '' };
          s.pending.sentence = { text: sentence, page: qPage };
          return s;
        });
      } catch (e) {}
    }
    // Phase 1: 백엔드 영속(로그인 시). 낙관적 UI 유지 + 백그라운드 persist.
    // sessions.addToday 가 스트릭 bump 까지 연동(양 어댑터). 활성 책 없으면 no-op.
    (async () => {
      try {
        // #565: 화면 책(ns.book)에 정확히 귀속 — 전역 activeBook 타이밍(리볼빙 전환 race)에 의존하지 않는다.
        // 1순위 ns.book.ubId(readingBooks·buildState 에서 동결한 user_book id). 없으면 ns.book.id 로 내 책을 해소
        // (active 폴백 아님 — 화면 책 기준). 둘 다 실패하면 잘못 저장하지 말고 중단.
        let ubId = ns.book && ns.book.ubId;
        if (!ubId && ns.book && ns.book.id) {
          const myb = await Promise.resolve(DataStore.myBooks.list()).catch(() => []);
          const found = (myb || []).find(u => (u.book_id === ns.book.id) || (u.book && u.book.id === ns.book.id));
          ubId = found && found.id;
        }
        if (!ubId) { console.warn('[ReadingGo] 체크인: 화면 책의 user_book 미해소 — 잘못된 귀속 방지 위해 저장 건너뜀'); surfaceWriteError(new Error('user_book 미해소'), '기록을 저장하지 못했어요 — 다시 시도해주세요'); return; }
        await Promise.resolve(DataStore.sessions.addToday({ userBookId: ubId, page: ns.book.cur }));
        if (batch && batch.length) {
          // 배치: N개 문장을 개별 add(공유 페이지). 진도·세션·XP·스트릭은 위/아래에서 1회만(#1198).
          for (const s of batch) {
            try { await Promise.resolve(DataStore.sentences.add({ userBookId: ubId, page: (typeof s.page === 'number') ? s.page : qPage, text: String(s.text).trim(), kind: kind || 'quote' })); } catch (e) { console.warn('[ReadingGo] 배치 문장 저장 실패(1건 스킵):', (e && e.message) || e); }
          }
        } else if (sentence) {
          await Promise.resolve(DataStore.sentences.add({ userBookId: ubId, page: qPage, text: sentence, kind: kind || 'quote' }));
        }
        if (xpGain) await Promise.resolve(DataStore.xp.add(xpGain, 'checkin'));
        console.log('[ReadingGo] ✅ 체크인 저장 완료 (ub=' + ubId + ')');
        // 오늘 기록 완료 → 리마인더 재무장(오늘치 취소, 내일로). '읽었는데 알림 발화' 방지(#1163). 웹/비네이티브 no-op.
        try { if (window.RG_streakReminder) window.RG_streakReminder.reschedule(); } catch (e) {}
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
      } catch (e) { surfaceWriteError(e, '기록을 저장하지 못했어요 — 다시 시도해주세요'); }
    })();
  }, []);

  // 읽기모드 한 문장 저장 → appState.myQuotes 즉시 반영 (#358).
  // 검색 책 선택 → 책장 분기 (#409): 'wish'(찜) | 'reading'(읽는중, 기본) | 'completed'(완독).
  const handleSearchSelectBook = useCallback((book, shelf) => {
    shelf = shelf || 'reading';
    setIsSearchOpen(false);
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
        // 찜(읽고 싶어요, #409) — user_book 없이 wish_books 에만. 책 id 확보 후 add.
        if (shelf === 'wish') {
          let bookId = book.book_id || book.id || '';
          // Supabase 모드: 항상 books.upsert 로 캐노니컬 id 확보(#552) — 검색 raw id(b001/외서)는 books 행이
          // 없어 wish_books FK 위반으로 저장 실패하던 버그. localStorage 모드는 upsert 부재 → 기존 book_id 유지.
          if (DataStore.books && DataStore.books.upsert) {
            const up = await Promise.resolve(DataStore.books.upsert({ isbn13, title: book.title, author: book.author, publisher: book.publisher, total_pages: totalPages, cover_url: book.cover_url }));
            if (up && up.id) bookId = up.id;
          }
          if (bookId && DataStore.wishBooks && DataStore.wishBooks.add) {
            await Promise.resolve(DataStore.wishBooks.add(bookId));
            window.dispatchEvent(new CustomEvent('rg:wish-changed'));
            showToast(`'${book.title}' 읽고 싶은 책에 담았어요`);
          } else { showToast('이 책은 찜할 수 없어요 — 잠시 후 다시'); }
          return;
        }
        // 읽는중 / 완독 — user_book 확보(중복 시 재사용).
        const mine = await Promise.resolve(DataStore.myBooks.list());
        let ub = (mine || []).find(u => u.book && ((isbn13 && u.book.isbn13 === isbn13) || u.book.title === book.title));
        if (!ub) {
          ub = await Promise.resolve(DataStore.myBooks.add({
            book: { isbn13: isbn13, title: book.title, author: book.author, publisher: book.publisher, total_pages: totalPages, cover_url: book.cover_url },
            current_page: shelf === 'completed' ? totalPages : 0,
            status: shelf,   // 'reading'|'completed' — 완독 담기는 active 자동전환 제외(#1196)
          }));
        }
        if (!ub || !ub.id) return;
        // 완독(다 읽었어요, #409) — status=completed. 별점·소감은 서재 책상세에서.
        if (shelf === 'completed') {
          if (DataStore.books && DataStore.books.complete) await Promise.resolve(DataStore.books.complete(ub.id, {}));
          window.dispatchEvent(new CustomEvent('rg:wish-changed')); // 서재 목록 갱신 신호 재사용
          showToast(`🏰 '${book.title}' 완독 책장에 — 서재에서 별점·소감을 남겨보세요`);
          return;
        }
        // 읽는중(기존) — 활성 책 + 둥지 반영. 원본 검색 row가 아니라 저장된 user_book을
        // 다시 매핑해 canonical 첫 결과·로컬 생성 ID도 화면 상태와 같은 데이터 계약을 쓰게 한다(#1221).
        switchTab('nest');
        await Promise.resolve(DataStore.activeBook.set(ub.id));
        const savedBook = ub.book || {};
        if (window.rgTrack) window.rgTrack('book_opened', { book_id: ub.book_id || ub.id || '', entry_point: 'register' }); // 퍼널 시작 (#736)
        setAppState(s => ({
          ...s,
          book: {
            id: ub.book_id || savedBook.id || '', ubId: ub.id, title: savedBook.title || book.title || '', author: savedBook.author || book.author || '', pub: savedBook.publisher || book.publisher || '',
            cur: ub.current_page || 0, total: savedBook.total_pages || totalPages || 0, days: 1,
            cover: savedBook.cover_url || book.cover_url || '', fb: ['#9AA7B2', '#C7D0D8'], toc: [],
          },
        }));
        window.dispatchEvent(new CustomEvent('rg:wish-changed')); // #822: 서재 '읽고 있는 책' 즉시 갱신
        showToast(`${book.title} 등록 완료`);
        // P2(co-reading.md §7.5): 같이읽기 기본 = 같이+공개(opt-out). together 모드면 이 책의
        // 공개 숲에 자동 합류(없으면 새로 만들어 합류) = "공개로 열면 알아서 붙어서 읽는다".
        // solo 모드·게스트/로컬 표면은 헬퍼가 알아서 no-op/로컬 처리. 등록을 막지 않게 fire-and-forget.
        // #1035 P2: **로그인 유저만** 자동합류. 게스트(미로그인)는 로컬 전용 1인 숲이 만들어지고
        //   "함께했어요" 토스트가 떠 아무도 없는데 모임에 든 듯한 오해를 준다. 세션을 call-time 에
        //   확인(콜백 stale-closure 회피) — currentUser()는 게스트·로컬 모드 모두 null. 등록은 안 막음.
        let _loggedIn = false;
        try { _loggedIn = !!(window.RG_SB && window.RG_SB.currentUser && (await window.RG_SB.currentUser())); } catch (e) { _loggedIn = false; }
        if (_loggedIn && window.RG_autoJoinPublicRoom && (!window.RG_coReadMode || window.RG_coReadMode() !== 'solo')) {
          Promise.resolve(window.RG_autoJoinPublicRoom({
            id: ub.book_id || book.book_id || book.id || '', title: book.title, author: book.author,
          })).then(room => {
            if (room && room.name) showToast(`🌳 '${book.title}' 같이 읽는 숲에 함께했어요`);
          }).catch(() => {});
        }
      } catch (e) { surfaceWriteError(e, '책을 저장하지 못했어요 — 다시 시도해주세요'); }
    })();
  }, [switchTab]);

  // 책 정보 모달 '이 책 읽기' → 검색-등록 경로 재사용 (#11)
  useEffect(() => {
    window.RG_registerBook = (b) => handleSearchSelectBook({ isbn13: b.isbn13 || b.isbn, title: b.title, author: b.author, publisher: b.publisher, total_pages: b.total_pages, cover_url: b.cover_url });
    return () => { window.RG_registerBook = null; };
  }, [handleSearchSelectBook]);

  // 소셜 랭킹 등 책 카드 → 책장 선택(찜/읽는중/완독) 추가 경로 재사용 (#525). shelf 분기·토스트·둥지반영은 handleSearchSelectBook 이 처리.
  useEffect(() => {
    window.RG_addBookToShelf = (b, shelf) => handleSearchSelectBook({ book_id: b.bookId || b.book_id || b.id, isbn13: b.isbn13 || b.isbn, title: b.title, author: b.author, publisher: b.publisher, total_pages: b.total_pages, cover_url: b.cover_url }, shelf);
    return () => { window.RG_addBookToShelf = null; };
  }, [handleSearchSelectBook]);

  // 이미 등록된 user_book 으로 활성 전환 (서재에서 — 재등록 없이 activeBook.set).
  const handleActivateUserBook = useCallback((item) => {
    if (!item || !item.id) return;
    // #822: user_book 미존재(위시리스트·검색 등 ubId 없음) 책을 '활성'으로 바꾸면 등록 경로로 위임해
    // '읽는 중' user_books 행을 실제로 생성한다. (종전: 로컬 화면만 바뀌고 DB 행 미생성 →
    //  myBooks reading 캐러셀에 없어 다른 책으로 넘기면 그대로 사라짐.)
    if (!item.ubId) {
      handleSearchSelectBook({ isbn13: item.isbn, title: item.title, author: item.author, publisher: item.pub, total_pages: item.total, cover_url: item.cover }, 'reading');
      return;
    }
    setAppState(s => ({
      ...s,
      book: {
        id: item.id, ubId: item.ubId, title: item.title, author: item.author || '', pub: item.pub || '',
        cur: item.cur || 0, total: item.total || 0, days: 1,
        cover: item.cover, fb: item.fb || ['#9AA7B2', '#C7D0D8'], toc: [],
      },
      // 둥지는 책과 무관 — 유지 (#313). ubId(#822): 체크인 저장 귀속 직결.
    }));
    showToast(`${item.title} — 활성 책으로 변경`);
    switchTab('nest');
    if (item.ubId && DataStore.activeBook && DataStore.activeBook.set) {
      Promise.resolve(DataStore.activeBook.set(item.ubId)).catch(e => console.warn('[ReadingGo] 활성 전환 실패:', e));
    }
    if (window.rgTrack) window.rgTrack('book_opened', { book_id: item.id || '', entry_point: 'switch' }); // 퍼널 시작 — 서재 활성전환 (#736)
  }, [switchTab, handleSearchSelectBook]);
  // 활성 책 전환을 전역 노출 — 둥지 캐러셀(#185)이 호출
  useEffect(() => { window.RG_activateBook = handleActivateUserBook; return () => { window.RG_activateBook = null; }; }, [handleActivateUserBook]);

  // 뒤로가기로 최상위 오버레이 닫기 (#1199, nav.js). 각 오버레이 상태가 열리면 합성 history
  // 엔트리를 push하고, 브라우저/OS 뒤로가기(모바일 Safari 엣지 스와이프)가 오면 최상위 하나만
  // 닫는다 — 실제 앱 히스토리/로그인 상태로 튕기지 않도록. 훅은 매 렌더 같은 순서로 호출.
  const _overlayBack = window.useOverlayBack || (() => {});
  _overlayBack(showLogin, () => setShowLogin(false));
  _overlayBack(isSearchOpen, () => { setIsSearchOpen(false); setSearchPrefill(''); });
  _overlayBack(!!profileHandle, () => setProfileHandle(null));
  _overlayBack(settingsOpen, () => setSettingsOpen(false));
  _overlayBack(!!companionSentence, () => setCompanionSentence(null));
  _overlayBack(!!bookDetailItem, () => setBookDetailItem(null));
  _overlayBack(!!bookDetailId, () => setBookDetailId(null));
  _overlayBack(collectionOpen, () => setCollectionOpen(false));
  _overlayBack(shelfImportOpen, () => setShelfImportOpen(false));
  _overlayBack(textImportOpen, () => setTextImportOpen(false));
  _overlayBack(!!roomOpenId, () => setRoomOpenId(null));
  _overlayBack(!!invitePreview, () => setInvitePreview(null));

  // Phase 1 인증 — 게스트 우선(onboarding.md §4). 로그인은 '저장' 시점에만 요구.
  if (_supa && authUser === undefined) return (<BootSplash text="확인 중..." />);
  if (showLogin) return (<LoginScreen onLogin={(provider) => window.RG_SB.signInWithOAuth(provider || 'google')} onBack={() => setShowLogin(false)} />);
  // 로그인 사용자만 Supabase 데이터 로드 대기. 게스트(authUser===null)는 localStorage 로 즉시 진입.
  if (_supa && authUser && authUser !== 'local' && !dataReady) return (<BootSplash text="불러오는 중..." />);

  const isGuest = _supa && authUser === null;

  return (
    <div className="stage">
      <div className="app">

        <InAppBanner />

        {/* 상단 바 */}
        <header className="topbar">
          <div className="topbar-row">
            <div className="brand-mark" role="button" tabIndex={0} title="둥지로 (홈)"
              onClick={() => switchTab('nest')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') switchTab('nest'); }}>
              <span className="sparrow" aria-hidden="true"><window.SparrowMark size={24} /></span>
              <span>Reading<span className="go">Go</span></span>
            </div>
            <div className="topbar-stats">
              {/* 상단바 XP 수치 표시 (#493) — Lv 왼쪽에 현재 보유 XP. appState.xp 라 변경 시 즉시 반영. */}
              <span className="stat xp" title="현재 XP (systems.md §6.3)">
                <span>XP {(appState.xp || 0).toLocaleString()}</span>
              </span>
              <span className="stat lv" title="레벨 (systems.md §6.3)">
                <span>Lv.{calcLevel(appState.xp)}</span>
              </span>
              {/* 스포일러 토글은 설정(프로필 ⚙️)으로 이전 (#3) */}
              {/* #790: 돋보기 아이콘만으론 '책 추가' 동선 발견성이 낮음 → '도서 찾기' 라벨 + 틴트 배경칩으로 강조. */}
              <button
                onClick={() => setIsSearchOpen(true)}
                style={{ background:'var(--brand-tint)', border:'1px solid var(--brand-soft)', cursor:'pointer', padding:'5px 10px', marginLeft:4, color:'var(--brand-3)', display:'inline-flex', alignItems:'center', gap:4, borderRadius:999, fontSize:12, fontWeight:800, whiteSpace:'nowrap' }}
                title="도서 검색"
                aria-label="도서 찾기"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                도서 찾기
              </button>
            </div>
          </div>
        </header>

        {/* 게스트 안내 배너 — 로그인 없이 둘러보는 중. 로그인=저장 (onboarding.md §4 E). */}
        {isGuest && !guestBannerOff && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: 'var(--brand-tint)', borderBottom: '1px solid var(--brand-soft)', fontSize: 12.5, fontWeight: 700, color: 'var(--brand-3)' }}>
            <window.SparrowMark size={18} />
            <span style={{ flex: 1, lineHeight: 1.35 }}>게스트로 둘러보는 중<br />로그인하면 내 기록이 저장돼요</span>
            {/* #1233: 라벨 '저장하기'는 진도 카드의 저장하기와 동일 라벨·다른 의미(로그인 유도 vs 진도 저장)로
                오독 경로였고, solid 는 첫 화면 1차 버튼 경쟁(hero CTA·전체 동의와 3개)을 만들었다 → '로그인' + 2차 위계. */}
            <button onClick={() => setShowLogin(true)}
              style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--brand-soft)', background: '#fff', color: 'var(--brand-3)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
              로그인
            </button>
            <button onClick={() => setGuestBannerOff(true)} aria-label="배너 닫기"
              style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', padding: '13px 14px', margin: '-13px -14px' }}>
              {window.rgIcon('close', 16)}
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
              onOpenSearch={() => setIsSearchOpen(true)}
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
              onActivateUserBook={handleActivateUserBook}
            />
          )}
          </SpoilerContext.Provider>
          </ErrorBoundary>
        </main>

        {/* 하단 탭바 */}
        <nav className="tabbar">
          {[
            { id: 'nest', label: '홈', svg: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
                <path d="M9 21V12h6v9"/>
              </svg>
            )},
            { id: 'social', label: '함께', svg: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )},
            { id: 'profile', label: '책장', svg: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            )},
            { id: 'settings', label: '설정', svg: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            )},
          ].map(t => (
            <button
              key={t.id}
              className={'tab' + (t.id !== 'settings' && activeTab === t.id ? ' active' : '')}
              style={t.id === 'settings' && settingsOpen ? { opacity: 0.7 } : undefined}
              onClick={() => { if (t.id === 'settings') setSettingsOpen(true); else switchTab(t.id); }}
            >
              <span className="ico">{t.svg}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* 진입 동의 배너 (#331) — 비차단 하단. 첫 방문(consent===null) 시 1회. */}
        {showConsent && (
          <ConsentBanner onChoose={(v) => { if (window.RG_consent) window.RG_consent.set(v); if (window.RG_applyConsent) window.RG_applyConsent(v); if (window.rgTrack) window.rgTrack('data_consent', { value: v, source: 'banner' }); setShowConsent(false); }} />
        )}

        {/* 전역 Toast */}
        <Toast />

        {/* 도서 검색 모달 */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => { setIsSearchOpen(false); setSearchPrefill(''); }}
          books={ALL_BOOKS}
          onSelectBook={handleSearchSelectBook}
          topRecommendations={popularBooks || ALL_BOOKS.slice(0, 8)}
          initialQuery={searchPrefill}
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

        {bookDetailItem && ReactDOM.createPortal(
          <window.BookDetailModal book={bookDetailItem} allQuotes={appState.myQuotes}
            onClose={() => setBookDetailItem(null)} onActivate={handleActivateUserBook} />,
          document.body
        )}
        {bookDetailId && !bookDetailItem && ReactDOM.createPortal(
          <BookInfoModal bookId={bookDetailId} onClose={() => setBookDetailId(null)} />,
          document.body
        )}

        {/* 한 문장 모아보기 (#171) */}
        {collectionOpen && ReactDOM.createPortal(
          <SentenceCollectionModal initialFilter={collectionFilter} initialMode={collectionMode} onClose={() => setCollectionOpen(false)} />,
          document.body
        )}
        {/* 스샷 서가 복원 (#772) */}
        {shelfImportOpen && ReactDOM.createPortal(
          <ShelfImportModal onClose={() => setShelfImportOpen(false)} />,
          document.body
        )}
        {/* 유연 도서기록 임포트 — 붙여넣기/파일 (#1039) */}
        {textImportOpen && window.TextImportModal && ReactDOM.createPortal(
          <window.TextImportModal onClose={() => setTextImportOpen(false)} />,
          document.body
        )}

        {/* 같이읽기 방 내부 (co-reading.md §5.3) — 방 카드·badge 진입 */}
        {roomOpenId && window.RoomModal && (
          <window.RoomModal roomId={roomOpenId} onClose={() => setRoomOpenId(null)} />
        )}

        {/* #1094: 초대 딥링크 미리보기 — /r/<token> 진입 시 참여 전 미리보기. 참여하면 그 숲을 연다. */}
        {invitePreview && window.RoomPreviewSheet && (
          <window.RoomPreviewSheet
            room={invitePreview}
            onClose={() => setInvitePreview(null)}
            onJoined={(room) => { setInvitePreview(null); if (window.RG_openRoom) window.RG_openRoom(room.id); }}
          />
        )}

      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
