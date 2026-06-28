// sheet-drag.js — 글로벌 바텀시트 drag-to-dismiss (이슈 #1046)
//
// 문제: 바텀시트(.modal-backdrop > .sheet) 상단의 '.sheet-grip'(슬라이드 핸들)을
//   잡고 아래로 끌어도 닫히지 않는다 — 시트 어디에도 드래그 핸들러가 없기 때문.
//
// 해결: 시트 React 컴포넌트(settings-modal·book-detail-modal·shelf-import·
//   sentence-collection-modal 등)는 건드리지 않고, document 위임(capture) 리스너
//   하나로 '모든 시트 공통' 드래그를 처리한다. 시트들은 구조가 동일하다:
//     <div class="modal-backdrop show" onClick={e => e.target===e.currentTarget && onClose()}>
//       <div class="sheet" role="dialog"> <div class="sheet-grip"/> ... ✕버튼 ... </div>
//     </div>
//
// 닫기: 부모 '.modal-backdrop' 에 합성 click 을 디스패치하면 React onClick 의
//   e.target===e.currentTarget(=backdrop) 가 참이 되어 onClose 가 발화한다.
//   이게 1순위(가장 신뢰). 혹시 backdrop self-click 이 안 먹으면 시트 내
//   닫기 버튼([aria-label="닫기"] 또는 [title="닫기"]) 을 클릭하는 폴백.
//   → 기존 ✕/배경탭 닫기 경로는 그대로 살아있다(이 모듈은 추가만 한다).
(function () {
  'use strict';

  // 드래그 시작 판정: grip 자체이거나, 시트 최상단(~44px) 영역을 잡았을 때.
  var GRAB_ZONE_PX = 44;   // grip 영역 높이(시트 상단)
  var CLOSE_PX = 120;      // 이만큼 이상 내리면 닫기
  var FLICK_VELOCITY = 0.6; // px/ms — 짧게 빠르게 튕기면(플릭) 거리 무관 닫기

  // 진행 중 드래그 상태(한 번에 하나만).
  var active = null; // { sheet, backdrop, startY, startScrollTop, lastY, lastT, dy, pointerId, usedPointer }

  function closestSheet(el) {
    return el && el.closest ? el.closest('.sheet') : null;
  }

  // 드래그를 시작해도 되는가? grip 위거나, (스크롤 최상단에서) 시트 상단 밴드를 잡았을 때만.
  // 시트 내용이 스크롤 중이면(scrollTop>0) 콘텐츠 스크롤을 방해하지 않도록 시작 안 함.
  function shouldStart(target, sheet, clientY) {
    if (!sheet) return false;
    // 입력 요소(스크롤/선택/타이핑) 위에서 시작하면 그쪽 동작을 살린다.
    if (target.closest && target.closest('input, textarea, select, button, a, [role="slider"], [contenteditable="true"]')) {
      // 단, grip 자체는 위 셀렉터에 안 걸리므로 통과. 버튼 등은 여기서 컷.
      if (!target.closest('.sheet-grip')) return false;
    }
    if (target.closest && target.closest('.sheet-grip')) return true;
    // grip 이 아니면: 시트가 최상단으로 스크롤돼 있고, 잡은 지점이 시트 상단 밴드 안일 때만.
    if (sheet.scrollTop > 0) return false;
    var rect = sheet.getBoundingClientRect();
    return (clientY - rect.top) <= GRAB_ZONE_PX;
  }

  function beginDrag(sheet, clientY, pointerId, usedPointer) {
    var backdrop = sheet.closest('.modal-backdrop');
    if (!backdrop) return false;
    active = {
      sheet: sheet,
      backdrop: backdrop,
      startY: clientY,
      lastY: clientY,
      lastT: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      dy: 0,
      pointerId: (pointerId == null ? null : pointerId),
      usedPointer: !!usedPointer
    };
    sheet.classList.add('dragging'); // transition 제거(끌리는 동안 즉시 추종)
    return true;
  }

  function moveDrag(clientY) {
    if (!active) return;
    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var dy = clientY - active.startY;
    if (dy < 0) dy = 0;          // 아래로만(위로는 클램프)
    active.dy = dy;
    active.lastVelocity = (clientY - active.lastY) / Math.max(1, now - active.lastT);
    active.lastY = clientY;
    active.lastT = now;
    active.sheet.style.transform = 'translateY(' + dy + 'px)';
    // 끌린 만큼 배경을 살짝 옅게(있으면) — 거리 피드백. 90vh 기준 대략치.
    var fade = Math.max(0, 1 - dy / 600);
    active.backdrop.style.opacity = String(0.55 + 0.45 * fade);
  }

  // 닫기: backdrop self-click 1순위, 실패 시 시트 내 닫기 버튼 폴백.
  function dismiss(sheet, backdrop) {
    // self-click: backdrop 자신을 target 으로 click → React onClick(e.target===e.currentTarget) → onClose
    try {
      if (backdrop && typeof backdrop.click === 'function') {
        backdrop.click();
        // click 이 onClose 를 부르면 React 가 backdrop 을 언마운트한다.
        // 다음 프레임에 아직 DOM 에 붙어있으면 self-click 이 안 먹은 것 → 버튼 폴백.
        requestAnimationFrame(function () {
          if (document.body.contains(sheet)) {
            var btn = sheet.querySelector('[aria-label="닫기"], [title="닫기"]');
            if (btn && typeof btn.click === 'function') btn.click();
            // 폴백까지 했는데도 남아있으면 시각 상태만 원복(닫기 실패 — 최소 깨지지 않게).
            requestAnimationFrame(function () {
              if (document.body.contains(sheet)) resetSheet(sheet, backdrop);
            });
          }
        });
      }
    } catch (e) {
      // 무슨 일이 있어도 시트 상태는 원복.
      resetSheet(sheet, backdrop);
    }
  }

  // 스냅백/원복: transform 제거 + transition 복원(.dragging 제거). 배경 opacity 도 초기화.
  function resetSheet(sheet, backdrop) {
    if (!sheet) return;
    sheet.classList.remove('dragging'); // transition 다시 살아남 → translateY(0) 로 부드럽게
    sheet.style.transform = '';
    if (backdrop) backdrop.style.opacity = '';
  }

  function endDrag() {
    if (!active) return;
    var a = active;
    active = null;
    var flick = (a.lastVelocity || 0) >= FLICK_VELOCITY && a.dy > 24;
    if (a.dy > CLOSE_PX || flick) {
      // 닫기로 결정 — 먼저 화면 밖으로 슬라이드(transition 살림) 후 onClose 트리거.
      a.sheet.classList.remove('dragging');
      a.sheet.style.transform = 'translateY(100%)';
      // 슬라이드아웃 잠깐 보여주고 실제 닫기. transition(.25s)보다 약간 짧게.
      setTimeout(function () { dismiss(a.sheet, a.backdrop); }, 180);
    } else {
      resetSheet(a.sheet, a.backdrop); // 스냅백
    }
  }

  // ---- Pointer Events (데스크탑 + 모던 모바일) ----
  function onPointerDown(e) {
    if (active) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return; // 좌클릭만
    var sheet = closestSheet(e.target);
    if (!shouldStart(e.target, sheet, e.clientY)) return;
    if (beginDrag(sheet, e.clientY, e.pointerId, true)) {
      // 포인터 캡처로 시트 밖으로 나가도 추적(요소 떼임 방지).
      try { if (sheet.setPointerCapture && e.pointerId != null) sheet.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }
  function onPointerMove(e) {
    if (!active || !active.usedPointer) return;
    if (active.pointerId != null && e.pointerId !== active.pointerId) return;
    moveDrag(e.clientY);
    if (active.dy > 0 && e.cancelable) e.preventDefault(); // 텍스트 선택/스크롤 억제
  }
  function onPointerUp(e) {
    if (!active || !active.usedPointer) return;
    if (active.pointerId != null && e.pointerId !== active.pointerId) return;
    try { if (active.sheet.releasePointerCapture && active.pointerId != null) active.sheet.releasePointerCapture(active.pointerId); } catch (_) {}
    endDrag();
  }

  // ---- Touch Events 폴백 (Pointer Events 미지원 구형 모바일) ----
  var supportsPointer = (typeof window !== 'undefined') && ('PointerEvent' in window);
  function onTouchStart(e) {
    if (active) return;
    if (!e.touches || e.touches.length !== 1) return; // 멀티터치(핀치 등) 무시
    var t = e.touches[0];
    var sheet = closestSheet(e.target);
    if (!shouldStart(e.target, sheet, t.clientY)) return;
    beginDrag(sheet, t.clientY, null, false);
  }
  function onTouchMove(e) {
    if (!active || active.usedPointer) return;
    if (!e.touches || !e.touches[0]) return;
    moveDrag(e.touches[0].clientY);
    if (active.dy > 0 && e.cancelable) e.preventDefault();
  }
  function onTouchEnd(e) {
    if (!active || active.usedPointer) return;
    endDrag();
  }

  if (typeof document !== 'undefined') {
    if (supportsPointer) {
      // capture: true — 시트 내부 핸들러보다 먼저 받되, 시작 안 하면 그냥 통과.
      document.addEventListener('pointerdown', onPointerDown, true);
      // move/up 은 capture 불필요(포인터 캡처가 타깃을 시트에 묶어줌). non-passive 로 preventDefault 가능.
      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerUp, true);
      document.addEventListener('pointercancel', onPointerUp, true);
    } else {
      document.addEventListener('touchstart', onTouchStart, true);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd, true);
      document.addEventListener('touchcancel', onTouchEnd, true);
    }
  }
})();
