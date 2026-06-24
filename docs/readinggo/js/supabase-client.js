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

  // 네이티브 OAuth 딥링크(#968). 네이티브 WebView 안에서 redirectTo=origin 은 https://localhost 라
  // 구글 콜백이 앱으로 못 돌아오고 외부 브라우저에 멈춘다. 네이티브일 때만 커스텀 스킴으로 복귀.
  const NATIVE_REDIRECT = 'com.readinggo.app://login-callback';
  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function client() {
    if (_client) return _client;
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      console.warn('[RG_SB] supabase-js 또는 RG_CONFIG 미로드');
      return null;
    }
    _client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      // flowType: 'pkce' — 네이티브 딥링크 복귀 시 ?code= 를 exchangeCodeForSession 으로 교환(#968).
      // 웹은 detectSessionInUrl 가 같은 ?code= 를 페이지 로드 때 자동 처리(기존 동작 유지).
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
    return _client;
  }

  // 지원 OAuth provider (#937 카카오·애플 추가). 네이버는 보류(Supabase 미지원 provider — 별도 처리 필요).
  const OAUTH_PROVIDERS = { google: 1, kakao: 1, apple: 1 };
  // prompt=select_account 는 Google 전용 queryParam (#721). 다른 provider 엔 안 보냄(무의미·일부는 거부).
  function oauthQueryParams(provider) {
    return provider === 'google' ? { prompt: 'select_account' } : undefined;
  }

  window.RG_SB = {
    client,
    isConfigured() { return !!client(); },

    // 소셜 로그인 (provider 일반화, #937) — OAuth 리디렉트. Supabase Auth→Providers→<provider> + URL Config 필요.
    // 네이티브(#968): 커스텀 스킴으로 복귀 + 인앱 브라우저(Custom Tab)로 열기. skipBrowserRedirect 로
    //   supabase-js 의 자동 location 이동을 막고, 받은 url 을 CapBrowser 가 연다. 복귀는 appUrlOpen 리스너.
    // 웹: redirectTo=origin, detectSessionInUrl 가 ?code= 자동 처리(기존 동작 유지).
    // Google: prompt=select_account (#721) — 미지정 시 브라우저 잔류 세션 자동 선택 → 로그아웃 후 계정 전환 불가.
    async signInWithOAuth(provider) {
      const c = client();
      if (!c) throw new Error('Supabase 미설정');
      if (!OAUTH_PROVIDERS[provider]) throw new Error('지원하지 않는 로그인 제공자: ' + provider);
      const qp = oauthQueryParams(provider);
      if (isNative()) {
        const { data, error } = await c.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: NATIVE_REDIRECT,
            skipBrowserRedirect: true,
            ...(qp ? { queryParams: qp } : {}),
          },
        });
        if (error) throw error;
        if (data && data.url && window.CapBrowser) await window.CapBrowser.open({ url: data.url });
        return data;
      }
      return c.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          ...(qp ? { queryParams: qp } : {}),
        },
      });
    },

    // provider별 얇은 래퍼 — 기존 호출부(signInWithGoogle) 회귀 방지 + 가독성.
    signInWithGoogle() { return this.signInWithOAuth('google'); },
    signInWithKakao() { return this.signInWithOAuth('kakao'); },
    signInWithApple() { return this.signInWithOAuth('apple'); },

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

    // 현재 세션 access token (#875 계정 삭제 — 워커에 본인 인증용). 미로그인이면 null.
    async accessToken() {
      const c = client();
      if (!c) return null;
      const { data, error } = await c.auth.getSession();
      if (error) return null;
      return (data && data.session && data.session.access_token) || null;
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

  // 네이티브 OAuth 복귀(#968): 인앱 브라우저가 com.readinggo.app://login-callback?code=... 로 돌아오면
  // appUrlOpen 이벤트로 받아 code 를 세션으로 교환하고 브라우저를 닫는다. 교환 성공 시 onAuthStateChange
  // 가 자동 발화 → 앱이 로그인 상태로 갱신(별도 네비게이션 불필요). 웹/비네이티브에선 no-op.
  function initNativeAuth() {
    if (!isNative() || !window.CapApp) return;
    window.CapApp.addListener('appUrlOpen', async (event) => {
      const url = (event && event.url) || '';
      if (url.indexOf('login-callback') === -1) return;
      const c = client();
      try {
        const m = url.match(/[?&]code=([^&]+)/);
        const code = m ? decodeURIComponent(m[1]) : null;
        if (code && c) {
          const { error } = await c.auth.exchangeCodeForSession(code);
          if (error) console.warn('[RG_SB] exchangeCodeForSession 실패:', error.message);
        } else {
          console.warn('[RG_SB] login-callback 에 code 없음:', url);
        }
      } catch (e) {
        console.warn('[RG_SB] 네이티브 OAuth 복귀 처리 실패:', e);
      } finally {
        try { if (window.CapBrowser) await window.CapBrowser.close(); } catch (e) {}
      }
    });
  }
  initNativeAuth();
})();
