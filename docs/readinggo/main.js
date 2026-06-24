// ReadingGo 진입 모듈 (#871 Vite 전환) — index.html 의 런타임 Babel `loadBabel` 루프를 대체.
// 기존 로드 순서를 그대로 ES import 로 옮긴다(순서 = 의존성, window.X 전역 공유 유지).
// 1) setup-globals 가 가장 먼저 — window.React 등 전역 보장.
import './setup-globals.js';

// 2) 백엔드 계층(순수 JS) — 기존 plain <script> 순서.
import './js/config.js';
import './js/supabase-client.js';
import './js/datastore-supabase.js';

// 3) 데모/컴포넌트 — 기존 loadBabel 순서 그대로(주석은 index.html 의존성 메모).
import './js/data.js';
import './js/datastore.js';
import './js/icons.js';
import './js/components.js';
import './js/sentence-card.js';
import './js/book-info-modal.js';
import './js/user-profile-modal.js';
import './js/sentence-collection-modal.js';
import './js/share-card.js';
import './js/search.js';
import './js/barcode-scan.js';
import './js/ocr-crop-overlay.js';
import './js/batch-quote-import.js';
import './js/ceremony.js';
import './js/milestone-recap.js';
import './js/nest.js';
import './js/companion.js';
import './js/social.js';
import './js/admin-dashboard.js';
import './js/book-detail-modal.js';
import './js/nest-theatre.js';
import './js/follow-list-modal.js';
import './js/library.js';
import './js/settings-modal.js';
import './js/shelf-import.js';

// 4) Supabase DataStore 스왑(로그인 시) → 그 다음 app 마운트.
//    기존 index.html IIFE 가 library.js 와 settings-modal.js 사이에서 await 하던 로직.
//    app.js 는 모듈 평가 시 createRoot().render(<App/>) 를 실행하므로, 스왑 후 동적 import 로 마지막 마운트.
async function boot() {
  try {
    if (window.RG_SB && window.RG_SB.isConfigured && window.RG_SB.isConfigured()) {
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
      }
    } catch (e) { console.warn('[OTA] notifyAppReady 실패', e); }
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
