/* =========================================================
   ReadingGo — supabase-client.js  (Phase 1, B5 인증)
   Supabase 클라이언트 + Google OAuth 인증 게이트웨이.
   전제: index.html 에서 supabase-js UMD CDN → config.js → 이 파일 순서로 로드.
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   가입 시 users/streak 행은 DB 트리거(handle_new_user)가 자동 생성(§schema.sql).
   ========================================================= */
(function () {
  const cfg = window.RG_CONFIG || {};
  let _client = null;

  function client() {
    if (_client) return _client;
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      console.warn('[RG_SB] supabase-js 또는 RG_CONFIG 미로드');
      return null;
    }
    _client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return _client;
  }

  window.RG_SB = {
    client,
    isConfigured() { return !!client(); },

    // 구글 로그인 — OAuth 리디렉트(같은 출처로 복귀). Supabase Auth→Providers→Google + URL Config 필요.
    // prompt=select_account (#721): 미지정 시 브라우저 잔류 Google 세션을 자동 선택 → 로그아웃 후
    // 다른 계정 재로그인 불가(signOut 은 Supabase 세션만 정리, accounts.google.com 쿠키 잔류).
    // 매번 계정 선택 화면을 띄워 계정 전환·추가를 보장.
    async signInWithGoogle() {
      const c = client();
      if (!c) throw new Error('Supabase 미설정');
      return c.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      });
    },

    // 이메일 매직링크 — 비밀번호 없이 메일 링크로 로그인. 메일 소유 검증이 곧 confirm
    // 이라 mailer_autoconfirm 무관하게 안전 (#159).
    async signInWithEmail(email) {
      const c = client();
      if (!c) throw new Error('Supabase 미설정');
      return c.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: window.location.origin },
      });
    },

    async signOut() {
      const c = client();
      return c ? c.auth.signOut() : null;
    },

    // 다른 기기 세션만 무효화 (현재 기기 유지) — 멀티 디바이스 관리용.
    // Supabase는 클라에 기기 목록 API가 없어 '다른 전부 로그아웃'까지 지원.
    async signOutOtherDevices() {
      const c = client();
      if (!c) return null;
      return c.auth.signOut({ scope: 'others' });
    },

    // 현재 로그인 유저(또는 null) — getSession()(로컬 스토리지, 무네트워크) 사용. (#646)
    // getUser()는 매 호출 토큰 서버 검증(네트워크)이라, 모바일 네트워크 불안정 시 부팅 때
    // null/에러로 떨어져 로그인 유저가 조용히 게스트(localStorage)로 고착 → PC에서 남긴
    // my_note(대화)가 안 보이던 버그. persistSession:true 로 저장된 세션을 읽어 안정 복원.
    async currentUser() {
      const c = client();
      if (!c) return null;
      const { data, error } = await c.auth.getSession();
      if (error) return null;
      return (data && data.session && data.session.user) || null;
    },

    // 내 공개 프로필(public.users 행). 트리거가 가입 시 생성.
    async myProfile() {
      const c = client();
      if (!c) return null;
      const u = await this.currentUser();
      if (!u) return null;
      const { data } = await c.from('users').select('*').eq('id', u.id).single();
      return data || null;
    },

    // 로그인/로그아웃 상태 변화 구독 → cb(user|null)
    onAuthChange(cb) {
      const c = client();
      if (!c) return () => {};
      const { data } = c.auth.onAuthStateChange((_evt, session) => cb(session ? session.user : null));
      return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
    },
  };
})();
