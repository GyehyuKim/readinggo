/* =========================================================
   ReadingGo — config.js  (Phase 1)
   클라 공개 설정. publishable key 는 공개 안전(RLS 보호).
   index.html 에서 supabase-js CDN 다음, datastore/adapter 이전에 로드.
   ========================================================= */
window.RG_CONFIG = {
  SUPABASE_URL: 'https://cttllwwkaddghqttyhkg.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_R-f42NFOGq3dxqMlootNlQ_Us4AdUd-',
  ALADIN_PROXY: '/.netlify/functions/aladin',   // 서버리스 프록시 (TTBKey 서버에만)
};
