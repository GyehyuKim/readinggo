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

window.React = React;
window.ReactDOM = { createRoot, createPortal };
window.Fuse = Fuse;
window.htmlToImage = htmlToImage;        // htmlToImage.toBlob 사용
window.supabase = { createClient };      // supabase.createClient 사용
// Capacitor(네이티브 셸) — 웹에선 isNativePlatform()=false 라 분기만 무력화, 임포트는 안전.
// 네이티브 OAuth 딥링크(#968): CapBrowser=인앱 브라우저, CapApp=appUrlOpen 복귀 이벤트.
window.Capacitor = Capacitor;
window.CapApp = CapApp;
window.CapBrowser = CapBrowser;
