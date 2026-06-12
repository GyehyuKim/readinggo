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

// 앱 버전 — 베타 0.XXX. **publish(배포) 1회마다 +0.001 수동 증가** (≈머지 PR 수).
// 설정 표시 + 문의 작성 시 첨부 → 운영자가 "어느 버전 문제/해결인지" 추적.
window.RG_VERSION = '0.198';

// 참새 질문 방향성 프리셋 (#375, companion.md §4.4) — 사람마다 선호하는 질문 결이 달라
// 프로필/설정에서 고른 값을 companion 호출에 실어 worker 프롬프트에 주입. 자유서술 아님(허들·악용 회피).
// key 는 worker PRESET_TONE 과 1:1 일치해야 함(둘 다 바꿀 것). label=칩 표시.
window.RG_COMPANION_PRESETS = [
  { key: 'balanced', emoji: '🐦', label: '균형' },
  { key: 'deep', emoji: '🔍', label: '깊이 파고들기' },
  { key: 'light', emoji: '🍃', label: '가볍게' },
  { key: 'emotional', emoji: '💗', label: '감정 중심' },
  { key: 'critical', emoji: '⚖️', label: '비판적' },
  { key: 'context', emoji: '📚', label: '작가·맥락' },
];
// 디바이스 선호(테마류) — 사용자 콘텐츠 아니라 localStorage 직접. 기본값=balanced(균형).
window.RG_companionPreset = {
  get() { try { return localStorage.getItem('rg_companion_preset') || 'balanced'; } catch (e) { return 'balanced'; } },
  set(v) { try { localStorage.setItem('rg_companion_preset', v || 'balanced'); } catch (e) {} },
};

// 입력 검증 — 클라 1차 방어 + "값 생성 규칙" 안내. 서버(DB CHECK, supabase/04_constraints.sql)와 동일 규칙 공유.
window.RG_VALIDATE = (function () {
  var HANDLE_RE = /^[A-Za-z0-9_가-힣]{2,20}$/;
  function t(s) { return (s == null ? '' : String(s)).trim(); }
  return {
    HANDLE_RE: HANDLE_RE,
    handle: function (v) {
      var s = t(v).replace(/^@/, '');
      return HANDLE_RE.test(s) ? { ok: true, value: s } : { ok: false, value: s, msg: '아이디는 2~20자, 한글·영문·숫자·_ 만 쓸 수 있어요.' };
    },
    displayName: function (v) {
      var s = t(v);
      if (s.length < 1) return { ok: false, value: s, msg: '표시 이름을 입력해주세요.' };
      if (s.length > 40) return { ok: false, value: s, msg: '표시 이름은 40자 이내로 해주세요.' };
      return { ok: true, value: s };
    },
    sentence: function (v) {
      var s = t(v);
      return s.length > 1000 ? { ok: false, value: s.slice(0, 1000), msg: '한 문장은 1000자 이내로 적어주세요.' } : { ok: true, value: s };
    },
    note: function (v) {
      var s = t(v);
      return s.length > 1000 ? { ok: false, value: s.slice(0, 1000), msg: '감상은 1000자 이내로 해주세요.' } : { ok: true, value: s };
    },
    rating: function (n) {
      if (n == null || n === 0) return { ok: true, value: null };
      return [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].indexOf(Number(n)) >= 0 ? { ok: true, value: Number(n) } : { ok: false, value: n, msg: '별점은 0.5~5점이어야 해요.' };
    }
  };
})();
