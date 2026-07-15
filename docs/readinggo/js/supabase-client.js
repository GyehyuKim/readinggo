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
    // #1009: setup-globals 가 로드 시점에 확정한 RG_NATIVE 플래그를 1순위로 신뢰
    //   (window.Capacitor 가 번들 인스턴스로 덮여 isNativePlatform()=false 가 되는 케이스 차단).
    if (typeof window.RG_NATIVE === 'boolean') return window.RG_NATIVE;
    const cap = window.Capacitor;
    return !!(cap && (
      (cap.isNativePlatform && cap.isNativePlatform()) ||
      (cap.getPlatform && cap.getPlatform() !== 'web')
    ));
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
    // 네이티브(#1035 P1): OAuth(signInWithOAuth) 와 동일하게, 네이티브에선 emailRedirectTo 를
    //   커스텀 스킴(NATIVE_REDIRECT)으로 보낸다. web-origin(`https://localhost`) 복귀는 외부
    //   브라우저에 멈춰 앱이 로그인 화면에 갇히던 버그(소셜 #968 과 동일류). 복귀는 appUrlOpen
    //   핸들러가 PKCE `?code=`(exchangeCodeForSession) 또는 `token_hash`+`type`(verifyOtp)로 교환.
    //   전제: Supabase 대시보드 Auth→URL Configuration→Redirect URLs 에 그 스킴 등록(#968 과 공유).
    async signInWithEmail(email) {
      const c = client();
      if (!c) throw new Error('Supabase 미설정');
      return c.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: isNative() ? NATIVE_REDIRECT : window.location.origin },
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

  // 네이티브 인증 복귀(#968 OAuth · #1035 이메일 매직링크): 인앱 브라우저가
  // com.readinggo.app://login-callback?... 로 돌아오면 appUrlOpen 이벤트로 받아 세션을 교환하고
  // 브라우저를 닫는다. 교환 성공 시 onAuthStateChange 가 자동 발화 → 앱이 로그인 상태로 갱신
  // (별도 네비게이션 불필요). 웹/비네이티브에선 no-op.
  //   - 소셜 OAuth + PKCE 이메일 매직링크(기본): `?code=` → exchangeCodeForSession.
  //   - 이메일 OTP(템플릿이 {{ .TokenHash }} 인 경우): `token_hash`+`type` → verifyOtp.
  // 두 모양 모두 처리해 이메일 링크가 어느 Supabase 설정에서도 앱으로 복귀하게 한다(#1035 P1).
  function initNativeAuth() {
    if (!isNative() || !window.CapApp) return;
    const param = (url, key) => { const m = url.match(new RegExp('[?&#]' + key + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : null; };
    window.CapApp.addListener('appUrlOpen', async (event) => {
      const url = (event && event.url) || '';
      if (url.indexOf('login-callback') === -1) return;
      const c = client();
      try {
        const code = param(url, 'code');
        const tokenHash = param(url, 'token_hash');
        const otpType = param(url, 'type');
        if (code && c) {
          // PKCE(소셜 + 기본 이메일 매직링크) — 인가 코드를 세션으로 교환.
          const { error } = await c.auth.exchangeCodeForSession(code);
          if (error) console.warn('[RG_SB] exchangeCodeForSession 실패:', error.message);
        } else if (tokenHash && c) {
          // 이메일 OTP 매직링크(token_hash 모양) — verifyOtp 로 검증·세션화. type 기본 'magiclink'.
          const { error } = await c.auth.verifyOtp({ token_hash: tokenHash, type: otpType || 'magiclink' });
          if (error) console.warn('[RG_SB] verifyOtp 실패:', error.message);
        } else {
          console.warn('[RG_SB] login-callback 에 code/token_hash 없음:', url);
        }
      } catch (e) {
        console.warn('[RG_SB] 네이티브 인증 복귀 처리 실패:', e);
      } finally {
        try { if (window.CapBrowser) await window.CapBrowser.close(); } catch (e) {}
      }
    });
  }
  initNativeAuth();
})();

/* ── 독서 위키 Q&A 클라 래퍼 — "내 문장에게 묻기" (#1007, profile §5.8.8) ──
   내 한 문장(listMine 결과)을 payload 로 구성해 worker /api/wiki-ask 로 전송.
   companion(/api/companion) 과 동일한 동일출처 프록시 패턴 — 키는 서버 보관(클라 노출 0).
   서버가 그 문장들에만 근거해 답(환각 가드는 워커 프롬프트). 호출부(SentenceCollectionModal)가
   로딩·에러·빈 상태를 처리한다. payload: text·note(my_note)·book(제목)·author·page. */
// #1283: Worker 보안 정책은 그대로 두고, 호출부가 403/502/네트워크 실패를 구분할 수 있게 한다.
window.RG_wikiAskErrorMessage = function RG_wikiAskErrorMessage(error) {
  if (error && error.code === 'TURNSTILE') {
    return '보안 확인 토큰이 없거나 만료됐어요. 보안 확인을 완료한 뒤 다시 묻기를 눌러주세요.';
  }
  if (error && error.code === 'SERVICE') {
    return '답변 서비스가 잠시 불안정해요. 잠시 후 다시 시도해주세요.';
  }
  if (error && error.code === 'NETWORK') {
    return '네트워크 연결을 확인하고 다시 시도해주세요.';
  }
  return '답변 요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.';
};

window.RG_wikiAsk = async function RG_wikiAsk(question, mine) {
  const items = (mine || [])
    .map((s) => ({
      text: s.text || '',
      note: s.note || s.my_note || '',
      book: s.bookTitle || '',
      author: s.author || '',
      page: (s.page != null) ? s.page : '',
    }))
    .filter((it) => it.text);
  let r;
  try {
    r = await window.RG_apiFetch('/api/wiki-ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: String(question || '').trim(), items }),
    });
  } catch (cause) {
    const error = new Error('wiki-ask network failure', { cause });
    error.code = 'NETWORK';
    throw error;
  }
  let d = null;
  try { d = await r.json(); } catch (e) { d = null; }
  if (!r.ok) {
    const error = new Error((d && (d.error || d.detail)) || ('HTTP ' + r.status));
    error.status = r.status;
    if (r.status === 403 && d && typeof d.error === 'string' && d.error.indexOf('turnstile') === 0) {
      error.code = 'TURNSTILE';
    } else if (r.status >= 500) {
      error.code = 'SERVICE';
    }
    throw error;
  }
  return (d && d.answer) || '';
};
