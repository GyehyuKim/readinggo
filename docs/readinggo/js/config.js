/* =========================================================
   ReadingGo — config.js  (Phase 1)
   클라 공개 설정. publishable key 는 공개 안전(RLS 보호).
   index.html 에서 supabase-js CDN 다음, datastore/adapter 이전에 로드.
   ========================================================= */
window.RG_CONFIG = {
  SUPABASE_URL: 'https://cttllwwkaddghqttyhkg.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_R-f42NFOGq3dxqMlootNlQ_Us4AdUd-',
  ALADIN_PROXY: '/.netlify/functions/aladin',   // 서버리스 프록시 (TTBKey 서버에만)
  // 추천 피드 점수 (#787) — 신선도 반감기(일)·좋아요 가중·후보 풀 크기.
  // 데이터가 적으면 좋아요=0 → log항=0 → 신선도(최신순)로 수렴하므로 빈 단계에서도 안전.
  FEED_RECOMMEND: { halfLifeDays: 10, clapWeight: 1.2, poolSize: 120 },

  // 피처 플래그 / 킬 스위치 (#960, decisions.md §8.13 채택 2 · specs/ops.md §1).
  // 위험·신규 기능을 boolean 뒤에 둔다 → 카나리(#901)가 놓친 회귀가 100%까지 가도
  //   배포·롤백 없이 그 기능만 즉시 끈다(작은 config 배포로 토글; Phase 0 최소안).
  //   값은 클라 공개 안전(민감정보 아님). 조회는 window.RG_flag(name) — 없으면 false(안전 기본).
  // 끄면 그 기능의 UI/네트워크 호출이 노출 안 되도록 graceful-skip(빈 섹션·placeholder도 생략).
  // 저장 위치 fork(아래 'seedCollectorTrigger'를 worker [vars]/원격 설정에 둘지)는 검토 대상이나,
  //   3인·Phase 0 규모에선 config.js 단일이 최소·추적 용이 → 채택(대안은 ops.md §1.3 한 줄).
  FLAGS: {
    // 같은 책 타인 한 문장 — 콜드스타트 사회적 증거(nest.md §5, #926 in-flight).
    //   neighbor seed(/api/seed) 트리거를 동반하는 신규 기능 → 출시 시 이 플래그 뒤에 둔다(예시 주석).
    socialProofSentences: true,
    // 마중물 시드 트리거 (#774) — 빈 책에서 collector(맥미니) /api/seed 큐잉+폴링.
    //   백엔드(collector) 장애·과부하 시 클라발 호출을 즉시 끈다(킬 스위치 실배선처 = book-info-modal.js).
    seedCollectorTrigger: true,
  },
};

// 피처 플래그 조회 (#960) — 단순·안전. 미정의/오타/FLAGS 부재 → false(기능 미노출이 안전 기본).
// 사용: if (window.RG_flag('seedCollectorTrigger')) { …위험 호출… }  ·  off면 그 분기를 graceful-skip.
window.RG_flag = function (name) {
  try {
    var f = window.RG_CONFIG && window.RG_CONFIG.FLAGS;
    return !!(f && f[name] === true);
  } catch (e) { return false; }
};

// 재키 질문 방향성 프리셋 (#375, companion.md §4.4) — 사람마다 선호하는 질문 결이 달라
// 프로필/설정에서 고른 값을 companion 호출에 실어 worker 프롬프트에 주입. 자유서술 아님(허들·악용 회피).
// key 는 worker PRESET_TONE 과 1:1 일치해야 함(둘 다 바꿀 것). label=칩 표시.
// icon = components.js RG_ICONS 키(#710, 이모지 → 인라인 SVG 통일).
window.RG_COMPANION_PRESETS = [
  { key: 'balanced', icon: 'balance', label: '균형' },
  { key: 'deep', icon: 'deep', label: '깊이 파고들기' },
  { key: 'light', icon: 'light', label: '가볍게' },
  { key: 'emotional', icon: 'heart', label: '감정 중심' },
  { key: 'critical', icon: 'critical', label: '비판적' },
  { key: 'context', icon: 'book', label: '작가·맥락' },
  // '작가의 시선' (#935, #922 후속) — 작가 *시점* 추론. context(작가 *맥락* 연결)와 별개.
  // 자율(가끔 자동)이던 작가 시점(#934)을 사용자 선택으로 전환. worker PRESET_TONE['author'] 와 1:1.
  { key: 'author', icon: 'pen', label: '작가의 시선' },
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
