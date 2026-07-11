// nav.js — 브라우저/OS 뒤로가기로 최상위 오버레이(모달·시트·풀스크린) 닫기 (#1199)
//
// 문제(모바일 Safari): SPA가 인앱 내비게이션(모달 열기 등)에 history 엔트리를 push하지
//   않아, 사용자가 브라우저 뒤로 제스처(엣지 스와이프 = 브라우저 히스토리 back)를 쓰면
//   앱의 단일 히스토리 엔트리가 pop돼 초기/로그인 화면으로 튕겼다. 모달만 닫히길 기대했는데.
//
// 해결: 오버레이가 열릴 때 합성 history 엔트리를 하나 push하고, popstate가 오면 최상위
//   오버레이 하나만 닫는다(실제 앱 히스토리·로그인 상태는 건드리지 않음). 오버레이가
//   X버튼·배경탭 등 UI로 닫히면 push했던 합성 엔트리를 되돌려(history.back) 히스토리와
//   스택을 동기화한다 — 죽은 엔트리가 쌓여 "뒤로가기가 안 먹는" 느낌을 방지.
//
// 스택 하나 + 전역 popstate 리스너 하나. React 오버레이는 useOverlayBack(open, close) 훅으로
//   app.js에서 한 줄 등록(참조: app.js 오버레이 상태). 비-React/포털 오버레이는
//   window.RG_nav.push(close) → 핸들, window.RG_nav.drop(핸들) 로 직접 등록 가능.

(function () {
  'use strict';

  var stack = [];      // [{ id, close, viaPop }] — 최상위 = 마지막
  var seq = 0;
  var ignorePops = 0;  // 우리가 self-호출한 history.back()이 유발할 popstate 무시 카운트

  function push(close) {
    var entry = { id: ++seq, close: close, viaPop: false };
    stack.push(entry);
    try { history.pushState({ rgOverlay: entry.id }, ''); } catch (e) {}
    return entry;
  }

  // 오버레이가 UI(닫기 버튼·배경탭)로 닫혔을 때 — push했던 합성 엔트리를 소비.
  function drop(entry) {
    var idx = stack.indexOf(entry);
    if (idx === -1) return;   // 이미 popstate(뒤로가기)로 제거됨 → 아무것도 안 함
    stack.splice(idx, 1);
    if (!entry.viaPop) {
      ignorePops++;
      try { history.back(); } catch (e) {}
    }
  }

  window.addEventListener('popstate', function () {
    if (ignorePops > 0) { ignorePops--; return; }  // 우리가 부른 back — 이미 반영됨
    var top = stack.pop();
    if (top) { top.viaPop = true; try { top.close(); } catch (e) {} }
    // 스택이 비면 아무것도 안 한다(기본 동작) — 로그인/초기화면으로 튕기지 않는다.
  });

  window.RG_nav = { push: push, drop: drop, _stack: stack };

  // React 훅 — open이 true인 동안만 등록. 뒤로가기 시 close 호출.
  window.useOverlayBack = function (open, close) {
    var R = window.React;
    var closeRef = R.useRef(close);
    closeRef.current = close;   // 최신 close 유지(stale-closure 방지)
    R.useEffect(function () {
      if (!open) return undefined;
      var entry = push(function () { closeRef.current(); });
      return function () { drop(entry); };
    }, [open]);
  };
})();
