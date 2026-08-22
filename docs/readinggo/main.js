// ReadingGo 진입 모듈 (#871 Vite 전환) — index.html 의 런타임 Babel `loadBabel` 루프를 대체.
// 기존 로드 순서를 그대로 ES import 로 옮긴다(순서 = 의존성, window.X 전역 공유 유지).
// 1) setup-globals 가 가장 먼저 — window.React 등 전역 보장.
import './setup-globals.js';
import './js/analytics.js'; // #1306 중앙 이벤트 메타데이터·PII 게이트

// 2) 백엔드 계층(순수 JS) — 기존 plain <script> 순서.
import './js/config.js';
import './js/turnstile.js';   // #1158/#1159 Turnstile 봇 검증 — RG_apiFetch/RG_turnstileToken (config 다음, app 이전)

// 3) 데모/컴포넌트 — 기존 loadBabel 순서 그대로(주석은 index.html 의존성 메모).
import './js/data.js';
import './js/datastore.js';
import './js/book-tree-selector.js'; // #1453 읽기 전용 책=가지·문장=잎 projection + 호환 shim
import './js/book-tree-home-ui.js'; // #1453 Phase 2 책나무 요약·가지 목록·선택 상세
import './js/icons.js';
import './js/components.js';
import './js/moderation.js'; // #1392 UGC 약관·신고·차단 공용 UI
import './js/sentence-card.js';
import './js/book-info-modal.js';
import './js/user-profile-modal.js';
import './js/sentence-collection-modal.js';
import './js/share-card.js';
import './js/search.js';
import './js/barcode-scan.js';
import './js/ocr-crop-overlay.js';
import './js/batch-quote-import.js';
import './js/data-import.js';
import './js/ceremony.js';
import './js/milestone-recap.js';
import './js/nest.js';
import './js/companion.js';
import './js/co-reading.js';
import './js/social.js';
import './js/admin-dashboard.js';
import './js/book-detail-modal.js';
import './js/follow-list-modal.js';
import './js/library.js';
import './js/settings-modal.js';
import './js/shelf-import.js';
import './js/streak-reminder.js';   // #1033 스트릭 리마인더 로컬 알림 (window.RG_streakReminder)
import './js/sheet-drag.js';        // #1046 바텀시트 글로벌 drag-to-dismiss (grip 끌어 닫기)
import './js/nav.js';               // #1199 뒤로가기로 모달 닫기 (window.RG_nav / useOverlayBack)
import './js/inapp.js';             // #1096 인앱 브라우저(카카오 등) 감지 + 외부 브라우저 열기 (window.RG_inApp)

// 4) Supabase DataStore 스왑(로그인 시) → 그 다음 app 마운트.
//    기존 index.html IIFE 가 library.js 와 settings-modal.js 사이에서 await 하던 로직.
//    app.js 는 모듈 평가 시 createRoot().render(<App/>) 를 실행하므로, 스왑 후 동적 import 로 마지막 마운트.
async function boot() {
  let devReviewRestored = false;
  if (import.meta.env.VITE_READINGGO_ENV === 'development') {
    try {
      // Prompt Lab 코드와 endpoint 문자열은 production module graph에 넣지 않는다(#1372).
      await import('./js/prompt-lab.js');
      const { devReviewPersonas } = await import('./js/dev-review-personas.js');
      window.RG_DEV_REVIEW = devReviewPersonas;
      devReviewRestored = !!(await devReviewPersonas.restore());
    } catch (e) {
      console.warn('[ReadingGo] DEV 검수 페르소나 복원 스킵:', e.message);
    }
  }
  try {
    // 검수 세션 복원을 Supabase 모듈 평가보다 먼저 확정한다. 활성 검수 세션에서는
    // auth listener/client 자체를 만들지 않아 세션 복원·token refresh·DB 요청을 원천 차단한다.
    if (!devReviewRestored) {
      await import('./js/supabase-client.js');
      await import('./js/datastore-supabase.js');
    }
    if (!devReviewRestored && window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured()) {
      const u = await window.RG_SB.currentUser();
      if (u && window.SupabaseDataStore) {
        window.DataStore = window.SupabaseDataStore;
        console.log('[ReadingGo] Supabase DataStore 활성 (로그인됨)');
      }
    }
  } catch (e) {
    console.warn('[ReadingGo] Supabase 스왑 스킵:', e.message);
  }
  try {
    await import('./js/app.js');   // 최상위 App + createRoot 마운트

    // OTA (#876): 부팅 성공 알림 — 미호출 시 Capgo 가 번들을 깨진 걸로 보고 자동 롤백. 네이티브에서만.
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor?.isNativePlatform?.()) {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        await CapacitorUpdater.notifyAppReady();

        // OTA QA 진단 (#1489): 활성/빌트인/다운로드 번들의 id·버전만 노출.
        // 토큰·유저·문장 데이터는 절대 다루지 않음 — 기기 콘솔에서 수동 호출용.
        window.RG_otaDiagnostics = async () => {
          const [cur, list] = await Promise.all([CapacitorUpdater.current(), CapacitorUpdater.list()]);
          const bundles = (list.bundles || []).map((b) => ({ id: b.id, version: b.version }));
          return {
            active: { id: cur.bundle.id, version: cur.bundle.version },
            builtin: bundles.find((b) => b.id === 'builtin') || null,
            downloaded: bundles.filter((b) => b.id !== 'builtin'),
          };
        };
      }
    } catch (e) { console.warn('[OTA] notifyAppReady 실패', e); }

    // 스트릭 리마인더(#1033) — 부팅 시 1회 재무장(오늘 읽음 상태 반영), 이후 resume 마다 갱신.
    //   네이티브 아니면 reschedule()은 즉시 no-op. 웹/데모엔 영향 없음.
    try {
      if (window.RG_streakReminder) {
        window.RG_streakReminder.reschedule();
        if (window.CapApp && window.CapApp.addListener) {
          window.CapApp.addListener('resume', () => { try { window.RG_streakReminder.reschedule(); } catch (e) {} });
        }
      }
    } catch (e) { console.warn('[reminder] 재무장 실패', e); }
  } catch (err) {
    console.error('[ReadingGo] 로드 실패:', err);
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = '<div class="rg-boot" style="gap:8px">'
        + '<p style="margin:0;font-weight:900;color:#2A2D33">앱을 불러오지 못했어요</p>'
        + '<p style="margin:0;font-size:12px;color:#9097A0">' + (err && err.message) + '</p>'
        + '<button onclick="location.reload()" style="margin-top:8px;padding:10px 20px;border:none;border-radius:12px;background:#3FD17F;color:#fff;font-weight:900;font-size:14px">다시 시도</button>'
        + '</div>';
    }
  }
}
boot();
