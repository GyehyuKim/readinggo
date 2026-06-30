/* 인앱 브라우저 감지 + 외부 브라우저 열기 (#1096).
   카카오톡 등 인앱 WebView 는 (1) 외부 Chrome/Safari 와 세션 분리(항상 비로그인)
   (2) Google OAuth 차단(disallowed_useragent — Google 이 embedded WebView 거부, 2021-09-30~)
   (3) 링크 복사 막힘. → 기본 브라우저로 빼야 로그인·복사·공유가 풀린다.
   라이브러리 미도입(Stack Lock) — UA 체크 + 스킴 인라인. window.RG_inApp 으로 노출. */
(function () {
  function detect() {
    const ua = navigator.userAgent || '';
    const isKakao = /KAKAOTALK/i.test(ua);
    const isLine = /\bLine\//i.test(ua);
    const isInsta = /Instagram/i.test(ua);
    const isFb = /FBAN|FBAV|FB_IAB/i.test(ua);
    const isNaver = /NAVER\(inapp/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    // 카카오는 공식 외부열기 스킴 보유 → 원클릭 가능. 나머지는 안내만(canEscape=false).
    const isAny = isKakao || isLine || isInsta || isFb || isNaver;
    return { isKakao, isLine, isInsta, isFb, isNaver, isAndroid, isAny, canEscape: isKakao };
  }

  // 카카오 인앱 → 기본 브라우저로 같은 URL 열기. iOS/Android 스킴 분기.
  //   iOS:     kakaotalk://web/openExternal?url=<encoded>
  //   Android: intent://<host+path>#Intent;scheme=https;package=com.android.chrome;end
  // 반환: 시도 가능한 스킴이 있으면 true(인스타/페북 등은 false → 호출측이 안내 배너).
  function openExternal(url) {
    const target = url || location.href;
    const d = detect();
    if (!d.isKakao) return false;
    if (d.isAndroid) {
      location.href = 'intent://' + target.replace(/^https?:\/\//i, '')
        + '#Intent;scheme=https;package=com.android.chrome;end';
    } else {
      location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(target);
    }
    return true;
  }

  window.RG_inApp = { detect, openExternal };
})();
