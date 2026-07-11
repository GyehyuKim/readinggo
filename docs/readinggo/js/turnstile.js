/* =========================================================
   ReadingGo — turnstile.js  (#1158/#1159)
   Cloudflare Turnstile 봇 검증 클라이언트.

   설계(staged rollout·fail-open):
   - 부팅 시 Turnstile 스크립트를 async 로 주입하고 invisible 위젯 1개를 렌더한다.
   - RG_turnstileToken() 은 호출마다 execute 로 **새 토큰**을 얻는다(토큰은 1회용·~300s TTL).
   - 스크립트 미로드·Turnstile 불가·~6s 타임아웃이면 '' 로 **fail-open** 리졸브 —
     요청은 그대로 진행되고, (워커 secret 이 설정된 경우에만) 워커가 403 → 호출부가 토스트로 안내.
   - RG_apiFetch(path, opts): 고비용 8개 엔드포인트 호출 래퍼. 토큰을 cf-turnstile-token 헤더로
     실어 fetch. FormData/JSON 바디는 그대로 보존(헤더만 추가, content-type 강제 안 함).
   ========================================================= */
(function () {
  var SITE_KEY = (window.RG_CONFIG && window.RG_CONFIG.TURNSTILE_SITE_KEY) || '';
  var SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=RG_onTurnstileLoad';
  var TOKEN_TIMEOUT_MS = 6000;

  var widgetId = null;
  var pending = null;   // { resolve } — 진행 중인 execute 의 콜백 대기

  // 스크립트 onload 후 Turnstile 이 호출 — invisible 위젯 1개 렌더.
  window.RG_onTurnstileLoad = function () {
    try {
      if (!window.turnstile || !SITE_KEY) return;
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;bottom:0;left:0;width:0;height:0;overflow:hidden';
      document.body.appendChild(el);
      widgetId = window.turnstile.render(el, {
        sitekey: SITE_KEY,
        size: 'invisible',
        callback: function (token) { _settle(token || ''); },
        'error-callback': function () { _settle(''); },
        'timeout-callback': function () { _settle(''); },
      });
    } catch (e) { /* fail-open — widgetId 는 null 로 남아 토큰은 '' */ }
  };

  function _settle(v) {
    if (pending) { var p = pending; pending = null; p.resolve(v); }
  }

  // 호출마다 새 토큰. 준비 안 됐거나 실패·타임아웃이면 '' (fail-open — 요청은 진행).
  window.RG_turnstileToken = function () {
    return new Promise(function (resolve) {
      if (!window.turnstile || widgetId === null) { resolve(''); return; }
      var done = false;
      var finish = function (v) { if (!done) { done = true; resolve(v); } };
      // 이전 대기가 남아 있으면(동시 호출 등) fail-open 처리하고 이번 것으로 교체.
      if (pending) { var prev = pending; pending = null; prev.resolve(''); }
      pending = { resolve: finish };
      setTimeout(function () { if (!done) { pending = null; finish(''); } }, TOKEN_TIMEOUT_MS);
      try {
        window.turnstile.reset(widgetId);                 // 이전 토큰 무효화 → 새 토큰 강제
        window.turnstile.execute(widgetId, { action: 'api' });
      } catch (e) { pending = null; finish(''); }
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
      return fetch(path, init);
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

  // 스크립트 주입(중복 방지).
  try {
    if (SITE_KEY && !document.querySelector('script[data-rg-turnstile]')) {
      var s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.setAttribute('data-rg-turnstile', '1');
      document.head.appendChild(s);
    }
  } catch (e) { /* fail-open — 토큰은 '' */ }
})();
