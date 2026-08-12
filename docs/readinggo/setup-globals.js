// 전역 노출 (#871 Vite 전환) — 기존 CDN UMD 전역(React/ReactDOM/Fuse/htmlToImage/supabase)을
// npm 모듈로 대체하되 `window.X` 패턴을 유지(기존 js 파일 무수정).
// ⚠️ main.js 가 이 모듈을 *가장 먼저* import 한다 — ES import 는 호이스팅돼 다른 컴포넌트 파일
//    평가(예: `const {useState}=React`) 전에 window.React 등이 설정돼 있어야 한다.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import Fuse from 'fuse.js';
import * as htmlToImage from 'html-to-image';
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser as CapBrowser } from '@capacitor/browser';
import { StatusBar, Style } from '@capacitor/status-bar';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';

window.React = React;
window.ReactDOM = { createRoot, createPortal };
window.Fuse = Fuse;
window.htmlToImage = htmlToImage;        // htmlToImage.toBlob 사용
window.supabase = { createClient };      // supabase.createClient 사용
// Capacitor(네이티브 셸) — 웹에선 isNativePlatform()=false 라 분기만 무력화, 임포트는 안전.
// 네이티브 OAuth 딥링크(#968): CapBrowser=인앱 브라우저, CapApp=appUrlOpen 복귀 이벤트.
// ⚠️ #1009: 네이티브 런타임이 주입한 window.Capacitor(브리지)를 번들 인스턴스로 *덮어쓰지 않는다*.
//   덮어쓰면 브리지와 분리돼 isNativePlatform()=false → 네이티브 OAuth 분기가 안 돌고 웹으로 샌다.
//   네이티브엔 이미 window.Capacitor 가 있으니 보존, 웹에서만 번들 모듈로 폴백.
if (!window.Capacitor) window.Capacitor = Capacitor;
// 네이티브 여부를 로드 시점에 한 번 확정(이후 분기는 이 플래그를 신뢰). 번들 모듈 + 브리지 둘 다 확인.
window.RG_NATIVE = !!(
  (Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) ||
  (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
  (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web')
);
window.CapApp = CapApp;
window.CapBrowser = CapBrowser;
window.CapStatusBar = StatusBar;
window.CapBarcodeScanner = CapacitorBarcodeScanner;
window.CapBarcodeScannerOptions = {
  hint: CapacitorBarcodeScannerTypeHint.EAN_13,
  cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
  scanOrientation: CapacitorBarcodeScannerScanOrientation.PORTRAIT,
  scanInstructions: '책 뒤표지의 ISBN 바코드를 비춰주세요',
  scanButton: false,
  cancelButtonAccessibilityLabel: '바코드 스캔 닫기',
  torchButtonOnAccessibilityLabel: '플래시 끄기',
  torchButtonOffAccessibilityLabel: '플래시 켜기',
  android: { scanningLibrary: 'mlkit' },
};
// 스트릭 리마인더(#1033) — 매일 정해진 시각 *로컬* 알림(서버·FCM 불필요). 웹에선 권한/스케줄
//   호출이 no-op(플러그인이 web 스텁) → 설정 토글은 네이티브에서만 실효. 실제 분기는 RG_NATIVE.
window.CapLocalNotifications = LocalNotifications;

// 상태바 아이콘을 어두운색으로(#1016). 앱 배경이 밝은 크림(--paper)이라 시스템 기본 흰
// 아이콘/시계가 묻혀 안 보인다. Style.Light = "밝은 배경" 가정 → 어두운 글씨/아이콘.
// #1013(MainActivity.onCreate)이 스플래시 처리에 덮여 실패 → WebView 로드 후 JS 런타임에서
// 직접 호출(여기가 웹 번들의 첫 실행)이라 스플래시·onCreate 타이밍을 우회. resume 마다
// 재적용해 시스템/플러그인이 리셋해도 다시 어두운 아이콘으로 복구. 웹/비네이티브는 no-op.
if (window.RG_NATIVE) {
  const darkStatusIcons = () => { try { StatusBar.setStyle({ style: Style.Light }).catch(() => {}); } catch (e) {} };
  darkStatusIcons();
  try { CapApp.addListener('resume', darkStatusIcons); } catch (e) {}
}
