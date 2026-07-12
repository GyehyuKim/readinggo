/* =========================================================
   ReadingGo — turnstile.js  (#1158/#1159)
   Cloudflare Turnstile 봇 검증 클라이언트.

   설계(staged rollout·fail-open):
   - **지연 로드**: 부팅 시 스크립트를 주입하지 않는다(외부 요청이 networkidle 을 막아 부팅/
     스모크가 느려지는 것 방지). 첫 RG_turnstileToken() 호출 때 스크립트를 async 주입하고
     위젯 1개(normal + interaction-only — 평소 비표시)를 렌더한다.
     (#1222: 구 size:'invisible' 은 유효값이 아니라 api.js 가 매 로드마다 TurnstileError 를 던졌다.)
   - RG_turnstileToken() 은 호출마다 execute 로 **새 토큰**을 얻는다(토큰은 1회용·~300s TTL).
     위젯이 아직 준비 전이면 로드·렌더를 기다렸다가 실행하고, ~6s 안에 안 되면 '' 로 **fail-open**.
   - 스크립트 미로드·Turnstile 불가·타임아웃이면 '' 리졸브 — 요청은 그대로 진행되고,
     (워커 secret 이 설정된 경우에만) 워커가 403 → 호출부가 토스트로 안내.
   - RG_apiFetch(path, opts): 고비용 8개 엔드포인트 호출 래퍼. 토큰을 cf-turnstile-token 헤더로
     실어 fetch. FormData/JSON 바디는 그대로 보존(헤더만 추가, content-type 강제 안 함).
   ========================================================= */
(function () {
  var SITE_KEY = (window.RG_CONFIG && window.RG_CONFIG.TURNSTILE_SITE_KEY) || '';
  var SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=RG_onTurnstileLoad';
  var TOKEN_TIMEOUT_MS = 6000;

  var widgetId = null;
  var scriptInjected = false;
  var pending = null;   // { resolve } — 진행 중인 execute 의 콜백 대기

  // 스크립트 지연 주입(첫 토큰 요청 시, 중복 방지). 부팅엔 주입 안 함 — networkidle 지연 방지.
  function _ensureScript() {
    if (scriptInjected || !SITE_KEY) return;
    scriptInjected = true;
    try {
      if (!document.querySelector('script[data-rg-turnstile]')) {
        var s = document.createElement('script');
        s.src = SCRIPT_SRC;
        s.async = true;
        s.defer = true;
        s.setAttribute('data-rg-turnstile', '1');
        document.head.appendChild(s);
      }
    } catch (e) { /* fail-open — 토큰은 '' */ }
  }

  // 스크립트 onload 후 Turnstile 이 호출 — 위젯 1개 렌더(평소 비표시). 대기 중 요청 있으면 실행.
  window.RG_onTurnstileLoad = function () {
    try {
      if (!window.turnstile || !SITE_KEY) return;
      // 컨테이너: 평소엔 빈 요소(0 크기 — 터치 가로채지 않음). CF 가 인터랙티브 챌린지를
      // 요구하면 이 자리(하단 중앙, 탭바 위)에 위젯이 보이게 떠서 사용자가 풀 수 있다 (#1222).
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;bottom:calc(var(--safe-bottom, 0px) + 76px);left:50%;transform:translateX(-50%);z-index:2000;';
      document.body.appendChild(el);
      widgetId = window.turnstile.render(el, {
        sitekey: SITE_KEY,
        // #1222: size 유효값은 compact/flexible/normal 뿐('invisible' 은 throw).
        // normal + appearance:'interaction-only' = 챌린지 필요할 때만 표시(인비저블 동작 유지).
        size: 'normal',
        appearance: 'interaction-only',
        callback: function (token) { _settle(token || ''); },
        'error-callback': function () { _settle(''); },
        'timeout-callback': function () { _settle(''); },
      });
      if (pending && widgetId !== null) _run();   // 로드 전 들어온 요청 처리
    } catch (e) { _settle(''); }
  };

  function _settle(v) {
    if (pending) { var p = pending; pending = null; p.resolve(v); }
  }

  function _run() {
    try {
      window.turnstile.reset(widgetId);                 // 이전 토큰 무효화 → 새 토큰 강제
      window.turnstile.execute(widgetId, { action: 'api' });
    } catch (e) { _settle(''); }
  }

  // 호출마다 새 토큰. 준비 안 됐으면 로드·렌더 대기, 실패·6s 타임아웃이면 '' (fail-open — 요청 진행).
  window.RG_turnstileToken = function () {
    _ensureScript();
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (v) { if (!done) { done = true; resolve(v); } };
      // 이전 대기가 남아 있으면(동시 호출 등) fail-open 처리하고 이번 것으로 교체.
      if (pending) { var prev = pending; pending = null; prev.resolve(''); }
      pending = { resolve: finish };
      setTimeout(function () { if (!done) { pending = null; finish(''); } }, TOKEN_TIMEOUT_MS);
      if (window.turnstile && widgetId !== null) _run();
      // 아직 로드/렌더 전이면 RG_onTurnstileLoad 가 렌더 후 pending 을 처리(6s 내).
    });
  };

  // 위젯 리셋(403 후 다음 호출용 새 토큰 확보).
  window.RG_turnstileReset = function () {
    try { if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId); } catch (e) {}
  };

  // 고비용 엔드포인트 호출 래퍼 — 토큰 헤더 주입 + 403(turnstile) 중앙 처리.
  // opts.rgQuiet=true 면 토스트 억제(백그라운드 seed 처럼 사용자에게 안 보여야 할 호출).
  window.RG_apiFetch = function (path, opts) {
    opts = opts || {};
    return window.RG_turnstileToken().then(function (token) {
      var headers = Object.assign({}, opts.headers, { 'cf-turnstile-token': token });
      var init = Object.assign({}, opts, { headers: headers });
      // #1230: 네이티브 앱·로컬에선 상대경로가 워커에 못 닿음 → API_ORIGIN prefix(웹은 '').
      var base = (window.RG_CONFIG && window.RG_CONFIG.API_ORIGIN) || '';
      return fetch(base + path, init);
    }).then(function (res) {
      if (res.status === 403) {
        return res.clone().json().then(function (d) {
          if (d && typeof d.error === 'string' && d.error.indexOf('turnstile') === 0) {
            window.RG_turnstileReset();
            if (!opts.rgQuiet && window.showToast) window.showToast('잠시 후 다시 시도해주세요');
          }
          return res;
        }).catch(function () { return res; });
      }
      return res;
    });
  };
})();
