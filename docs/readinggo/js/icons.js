/* =========================================================
   ReadingGo — icons.js  (#761 모듈화: components.js에서 추출)
   공용 SVG 아이콘 셋: RG_ICONS/rgIcon, NEST_ART/nestArt, SectionLabel/_RG_SEC_ICONS/RG_SECTION_CARD.
   index.html 에서 components.js **이전**에 로드(글로벌 정의 선행). 순수 이동 — 행동 변경 0.
   ========================================================= */

/* ── RG_ICONS (#710): 공용 모노라인 SVG 아이콘 셋. 기능 아이콘을 이모지에서 통일.
   currentColor → 버튼/텍스트 색 상속. config.js 질문 결 칩은 icon 키만 갖고 여기서 렌더(rgIcon). ── */
const RG_ICONS = {
  settings: <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><line x1="2.5" y1="4.5" x2="13.5" y2="4.5"/><circle cx="6" cy="4.5" r="1.7" fill="var(--card)"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><circle cx="10" cy="8" r="1.7" fill="var(--card)"/><line x1="2.5" y1="11.5" x2="13.5" y2="11.5"/><circle cx="5" cy="11.5" r="1.7" fill="var(--card)"/></g>,
  close: <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
  // 한 문장 배치 입력 (#1198) — 초안 행 추가(+). 모노라인 16x16, currentColor 상속.
  plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>,
  user: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="5.5" r="2.8"/><path d="M3 13.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" strokeLinecap="round"/></g>,
  devices: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"><rect x="2" y="3.5" width="8" height="6" rx="1"/><path d="M1 11.5h10" strokeLinecap="round"/><rect x="10.5" y="6.5" width="3.5" height="6" rx="1"/></g>,
  bookmark: <path d="M4 2.5h8v11l-4-2.8-4 2.8z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  mail: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="2"/><path d="M2.5 5L8 9l5.5-4" strokeLinecap="round" strokeLinejoin="round"/></g>,
  chat: <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6l-3 2.3V10.5h-.5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  balance: <g><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/></g>,
  deep: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><circle cx="7" cy="7" r="4"/><line x1="10" y1="10" x2="13.5" y2="13.5"/></g>,
  light: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"><path d="M13 3c0 5.5-4 9.5-9 10C3.5 7.5 7.5 3.5 13 3z"/><path d="M4 13c2.5-3 4.5-5 7.5-6.5" strokeLinecap="round"/></g>,
  heart: <path d="M8 13.5S2.5 9.7 2.5 6A2.8 2.8 0 0 1 8 4.7 2.8 2.8 0 0 1 13.5 6c0 3.7-5.5 7.5-5.5 7.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  critical: <g stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.5v11M4.5 13.5h7M3 5.5h10"/><path d="M3 5.5L1.3 9a1.8 1.8 0 0 0 3.4 0L3 5.5z"/><path d="M13 5.5L11.3 9a1.8 1.8 0 0 0 3.4 0L13 5.5z"/></g>,
  book: <path d="M8 4.4C6.7 3.6 5 3.1 3 3.1v8.4c2 0 3.7.5 5 1.3 1.3-.8 3-1.3 5-1.3V3.1c-2 0-3.7.5-5 1.3zm0 0v8.4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" strokeLinecap="round"/>,
  // '작가의 시선' 프리셋 (#935) — 만년필(작가 시점). 모노라인 16x16, currentColor 상속.
  pen: <g stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" strokeLinecap="round"><path d="M10.5 2.5l3 3-7.5 7.5H3v-3l7.5-7.5z"/><path d="M9 4l3 3"/></g>,
  pause: <g fill="currentColor"><rect x="4" y="3" width="2.6" height="10" rx="1.1"/><rect x="9.4" y="3" width="2.6" height="10" rx="1.1"/></g>,
  download: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.5v7.5"/><path d="M4.8 7l3.2 3.2L11.2 7"/><path d="M2.5 13h11"/></g>,
  // 파일 업로드(가져오기) — download 화살촉을 위(∧)로. 트레이는 바닥 유지 (#1091).
  upload: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.5v7.5"/><path d="M4.8 5.5l3.2-3 3.2 3"/><path d="M2.5 13h11"/></g>,
  // 서비스 외부 공유 (#650 B) — 노드 3개 + 연결선(표준 share 아이콘).
  share: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="3.5" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="12.5" r="2"/><path d="M5.8 7l4.4-2.4M5.8 9l4.4 2.4"/></g>,
  // 기능 이모지 대체(#1062) — Feather 모노라인 16x16, currentColor 상속·둥근 끝. 🔍🏠📷🗑📦 통일.
  search: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><circle cx="7" cy="7" r="4.3"/><line x1="10.2" y1="10.2" x2="13.6" y2="13.6"/></g>,
  home: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.8L8 3l5.5 4.8"/><path d="M3.9 8.1v5.4h8.2V8.1"/><path d="M6.6 13.5V9.6h2.8v3.9"/></g>,
  camera: <g stroke="currentColor" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5.4h2.3l1-1.6h5.4l1 1.6H14a.8.8 0 0 1 .8.8v6.2a.8.8 0 0 1-.8.8H2a.8.8 0 0 1-.8-.8V6.2A.8.8 0 0 1 2 5.4z"/><circle cx="8" cy="9" r="2.5"/></g>,
  trash: <g stroke="currentColor" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.3h11"/><path d="M4 4.3l.7 8.8a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.8"/><path d="M6 4.3V3.2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.1"/><path d="M6.7 6.6l.3 4.8M9.3 6.6l-.3 4.8"/></g>,
  box: <g stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 11V5a1 1 0 0 0-.5-.87l-4.5-2.6a1 1 0 0 0-1 0L3 4.13A1 1 0 0 0 2.5 5v6a1 1 0 0 0 .5.87l4.5 2.6a1 1 0 0 0 1 0l4.5-2.6A1 1 0 0 0 13.5 11z"/><path d="M2.7 4.9L8 7.9l5.3-3"/><path d="M8 14V7.9"/></g>,
  // 붙여넣기/파일 가져오기 진입점 (#1039) — 클립보드+텍스트 라인. 모노라인 16x16, currentColor 상속.
  paste: <g stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 4h2M10.5 4h2a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h0"/><rect x="5" y="2.5" width="6" height="2.8" rx="0.9"/><path d="M5.2 8.3h5.6M5.2 10.8h3.6"/></g>,
  // 같이읽기(숲) 방 UI 기능 이모지 대체(#1062) — Feather 모노라인 16x16, currentColor 상속·둥근 끝.
  // 🔢→hash · 🚪→logout · 👥→users · 🗓→calendar · 🔒/🔐→lock · 🌐→globe.
  hash: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M2.4 6h11.2M2.4 10h11.2"/><path d="M6.6 2.4 5.4 13.6M10.6 2.4 9.4 13.6"/></g>,
  logout: <g stroke="currentColor" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/><path d="M10.3 11l3-3-3-3"/><path d="M13.3 8H6"/></g>,
  users: <g stroke="currentColor" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 13.5v-1a2.5 2.5 0 0 0-2.5-2.5H4a2.5 2.5 0 0 0-2.5 2.5v1"/><circle cx="6" cy="5" r="2.5"/><path d="M14.5 13.5v-1a2.5 2.5 0 0 0-1.9-2.42"/><path d="M10.5 2.58a2.5 2.5 0 0 1 0 4.84"/></g>,
  calendar: <g stroke="currentColor" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="3" width="11" height="10.5" rx="1.5"/><path d="M10.5 1.8v2.4M5.5 1.8v2.4M2.5 6.5h11"/></g>,
  lock: <g stroke="currentColor" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2.8" y="7" width="10.4" height="7" rx="1.6"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></g>,
  globe: <g stroke="currentColor" strokeWidth="1.35" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6.3"/><path d="M1.7 8h12.6"/><path d="M8 1.7a9.7 9.7 0 0 1 2.6 6.3 9.7 9.7 0 0 1-2.6 6.3 9.7 9.7 0 0 1-2.6-6.3A9.7 9.7 0 0 1 8 1.7z"/></g>,
};
function rgIcon(name, size) {
  const s = size || 16;
  return <svg width={s} height={s} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{RG_ICONS[name] || null}</svg>;
}
window.RG_ICONS = RG_ICONS;
window.rgIcon = rgIcon;

/* ── NEST_ART (#716): 둥지 진화 5단계 커스텀 일러스트(이모지 🪵🪹🏠🏡🏰 대체).
   단계별 컬러·그래디언트로 게임 시그니처 유지. viewBox 0 0 40 40. nestArt(lv,size)로 렌더. ── */
const NEST_ART = {
  1: <g>
    <defs><linearGradient id="rgNest1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C8A06F"/><stop offset="1" stopColor="#8E6A45"/></linearGradient></defs>
    <path d="M6 21c2.5 7 7 10.5 14 10.5S31.5 28 34 21c-3.2 3.2-8.6 4.8-14 4.8S9.2 24.2 6 21z" fill="none" stroke="url(#rgNest1)" strokeWidth="3" strokeLinecap="round"/>
    <path d="M9.5 18.5c2.2 5 6 7.5 10.5 7.5s8.3-2.5 10.5-7.5" fill="none" stroke="#B0875A" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
    <line x1="10" y1="20.5" x2="5" y2="16.5" stroke="url(#rgNest1)" strokeWidth="2.4" strokeLinecap="round"/>
    <line x1="30" y1="20.5" x2="35" y2="16.5" stroke="url(#rgNest1)" strokeWidth="2.4" strokeLinecap="round"/>
    <line x1="20" y1="22" x2="20" y2="13.5" stroke="#6FA32E" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M20 15.5c.3-3 2.5-4.9 5.4-4.7-.5 3-2.7 4.8-5.4 4.7z" fill="#8BC34A"/>
    <path d="M20 17.5c-.3-2.4-2.1-3.9-4.4-3.8.4 2.4 2.1 3.8 4.4 3.8z" fill="#A5D66B"/>
  </g>,
  2: <g>
    <defs><linearGradient id="rgNest2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F7CD82"/><stop offset="1" stopColor="#D9942B"/></linearGradient></defs>
    <g transform="rotate(20 21 14)"><path d="M21 5c3.4 2.6 4 9 1 15-3-6-3.4-12.4-1-15z" fill="#FFFBF2" stroke="#B0701E" strokeWidth="1.3"/><line x1="21" y1="6.5" x2="21.5" y2="19.5" stroke="#B0701E" strokeWidth="1.1"/><path d="M21 9.5l-3-1.4M21.2 12l3.2-1.4M21 14.5l-3.4-1.2M21.3 17l3-1.2" stroke="#CF9B49" strokeWidth="1"/></g>
    <path d="M5 21c1.6 9 7.7 13 15 13s13.4-4 15-13c-3 3-8.6 4.6-15 4.6S8 24 5 21z" fill="url(#rgNest2)" stroke="#B0701E" strokeWidth="1.6"/>
    <g stroke="#9A6418" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" fill="none"><path d="M9 25l6-1.6M17 27l8-2M27 25l5-1.6"/></g>
  </g>,
  3: <g>
    <defs><linearGradient id="rgNest3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#AEE571"/><stop offset="1" stopColor="#46A302"/></linearGradient><linearGradient id="rgEgg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#E9F6DA"/></linearGradient></defs>
    <ellipse cx="15.5" cy="18.5" rx="3.6" ry="4.5" fill="url(#rgEgg3)" stroke="#46A302" strokeWidth="1.1"/>
    <ellipse cx="24.5" cy="18.5" rx="3.6" ry="4.5" fill="url(#rgEgg3)" stroke="#46A302" strokeWidth="1.1"/>
    <ellipse cx="20" cy="16" rx="3.6" ry="4.5" fill="url(#rgEgg3)" stroke="#46A302" strokeWidth="1.1"/>
    <path d="M5 20.5c1.6 9 7.7 13 15 13s13.4-4 15-13c-3 3-8.6 4.6-15 4.6S8 23.5 5 20.5z" fill="url(#rgNest3)" stroke="#3C8A02" strokeWidth="1.6"/>
  </g>,
  4: <g>
    {/* #756: 집 → 부화 새끼(🐣) 둥지 테마. 알이 있던 lv3 다음 단계로 새끼가 깨어남. */}
    <defs>
      <linearGradient id="rgNest4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F7CD82"/><stop offset="1" stopColor="#D9942B"/></linearGradient>
      <linearGradient id="rgChick4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE27A"/><stop offset="1" stopColor="#FBC02D"/></linearGradient>
    </defs>
    <ellipse cx="20" cy="17.5" rx="7" ry="7.5" fill="url(#rgChick4)" stroke="#E0A21A" strokeWidth="1.2"/>
    <path d="M13.4 18c-1.6.2-2.6 1.1-2.9 2.6 1.5-.1 2.6-.9 2.9-2.6z" fill="#FBD24E"/>
    <path d="M26.6 18c1.6.2 2.6 1.1 2.9 2.6-1.5-.1-2.6-.9-2.9-2.6z" fill="#FBD24E"/>
    <circle cx="17.7" cy="16.2" r="1" fill="#3A2A12"/>
    <circle cx="22.3" cy="16.2" r="1" fill="#3A2A12"/>
    <path d="M18.8 18.2h2.4l-1.2 1.8z" fill="#FF9F1C" stroke="#E07B00" strokeWidth="0.6" strokeLinejoin="round"/>
    <path d="M14.5 12.9l1.8 1.4 1.9-1.2 1.8 1.2 1.9-1.2 1.6 1.3" fill="none" stroke="#F1E7CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 21.5c1.6 9 7.7 13 15 13s13.4-4 15-13c-3 3-8.6 4.6-15 4.6S8 24.5 5 21.5z" fill="url(#rgNest4)" stroke="#B0701E" strokeWidth="1.6"/>
    <g stroke="#9A6418" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" fill="none"><path d="M9 25.5l6-1.6M17 27.5l8-2M27 25.5l5-1.6"/></g>
  </g>,
  5: <g>
    <defs><linearGradient id="rgCastle5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EAD7FC"/><stop offset="1" stopColor="#BE8DEC"/></linearGradient></defs>
    <line x1="20" y1="9" x2="20" y2="2" stroke="#A95EE6" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M20 2.5l6.5 2L20 6.5z" fill="#FF7BAC"/>
    <path d="M3 37V14h2.4v-3h2.6v3h2.6V9.5h3V14h2V8h3.6v6h2V9.5h3v4.5h2.6v-3h2.6v3H37v23z" fill="url(#rgCastle5)" stroke="#9A55D6" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M15 37v-7a5 5 0 0 1 10 0v7z" fill="#A968E0" stroke="#9A55D6" strokeWidth="1.2"/>
    <rect x="6.5" y="20" width="2.8" height="4.6" rx="1.2" fill="#7B45B8"/>
    <rect x="30.7" y="20" width="2.8" height="4.6" rx="1.2" fill="#7B45B8"/>
    <circle cx="20" cy="16.5" r="1.8" fill="#FFD24D"/>
  </g>,
};
function nestArt(lv, size) {
  const s = size || 28;
  return <svg width={s} height={s} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>{NEST_ART[lv] || NEST_ART[1]}</svg>;
}
window.NEST_ART = NEST_ART;
window.nestArt = nestArt;

/* ── SparrowMark (#785 · #924 · 아이콘 리디자인): ReadingGo 참새 브랜드 마크 — 부트·로딩·에러·아바타 공용 인라인 SVG.
   앱아이콘(assets/icon.png)·favicon(assets/sparrow.svg)과 동일 참새 캐릭터(배지·그라데이션만 제외한 새 본체).
   세이지 팔레트(DESIGN.md 2026-06-19 리프레시): 몸통 #2EA86A / 날개 #228A57 / 부리 #E8962F / 눈 #2A2D33.
   고개 든 통통 참새 + 짧은 부리 + 작은 깃(crest). viewBox 0 0 100 100.
   spark=true 면 골드 스파크(짹!/한 문장) 추가 — 로그인·브랜드 모먼트 전용(아바타엔 미사용, 군더더기 회피).
   size=픽셀(기본 40). 빌드 도구 없음 → 인라인 SVG(Stack Lock). ── */
function SparrowMark({ size = 40, style, spark }) {
  const s = size || 40;
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="ReadingGo 참새" style={{ display: 'block', flexShrink: 0, ...(style || {}) }}>
      <path d="M66 50 L95 40 L79 65 Z" fill="#2EA86A" />
      <ellipse cx="56" cy="62" rx="28" ry="24" fill="#2EA86A" />
      <circle cx="40" cy="40" r="19" fill="#2EA86A" />
      <path d="M46 23 Q51 12 55 24 Q50 26 46 23 Z" fill="#2EA86A" />
      <path d="M44 50 Q70 47 80 66 Q60 73 46 65 Q39 57 44 50 Z" fill="#228A57" />
      <path d="M23 36 L13 39.5 L24 45 Z" fill="#E8962F" />
      <circle cx="35" cy="38" r="3.4" fill="#2A2D33" />
      <circle cx="36.3" cy="36.7" r="1.15" fill="#FFFFFF" />
      {spark && (
        <g fill="#D9A52E">
          <path d="M62 12.5 Q63.7 19.3 70.5 21 Q63.7 22.7 62 29.5 Q60.3 22.7 53.5 21 Q60.3 19.3 62 12.5 Z" />
          <path d="M76 27 Q77.7 30.3 81 32 Q77.7 33.7 76 37 Q74.3 33.7 71 32 Q74.3 30.3 76 27 Z" />
        </g>
      )}
    </svg>
  );
}
window.SparrowMark = SparrowMark;

/* ── SparrowInline (#823): 텍스트 흐름 안에 들어가는 작은 참새 마크. 라벨·버튼 prefix·문구 끝의
   참새 머리 이모지 대체(#864). baseline 정렬(verticalAlign)만 SparrowMark 위에 얹은 래퍼. ── */
function SparrowInline({ size = 14 }) {
  return <SparrowMark size={size} style={{ display: 'inline-block', verticalAlign: '-0.15em' }} />;
}
window.SparrowInline = SparrowInline;

/* ── SectionLabel (#696): 책 상세 섹션 헤더. 이모지 prefix(📚/🔖/✍️) 폐기 → currentColor 모노라인
   SVG 아이콘 배지 + 라벨. library.js BookDetailModal 과 공유(window 노출). 본문이 텍스트인 섹션은
   RG_SECTION_CARD 로 감싸 surface 위계를 준다. 빌드 도구 없음 → 인라인 SVG(Stack Lock). ── */
const _RG_SEC_ICONS = {
  intro:    <path d="M8 4.4C6.7 3.6 5 3.1 3 3.1v8.4c2 0 3.7.5 5 1.3 1.3-.8 3-1.3 5-1.3V3.1c-2 0-3.7.5-5 1.3zm0 0v8.4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>,
  sentence: <path d="M3 3.6h10a1 1 0 0 1 1 1v4.8a1 1 0 0 1-1 1H7l-3 2.4v-2.4H3a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>,
  mine:     <path d="M10.6 2.6l2.8 2.8M3 11.4l7.2-7.2 2.6 2.6L5.6 14H3v-2.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>,
  related:  <g stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"><rect x="2.6" y="3.2" width="3.1" height="9.6" rx="0.7"/><path d="M6.9 12.8V4.6l3-.9 2 9.1-3.2.9"/></g>,
};
const RG_SECTION_CARD = { background: 'var(--card-soft)', border: '1.5px solid var(--line)', borderRadius: 12, padding: '12px 14px' };
function SectionLabel({ icon, children, trailing, mb = 9 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: mb }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-3)', flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">{_RG_SEC_ICONS[icon] || _RG_SEC_ICONS.intro}</svg>
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: 0.2, color: 'var(--ink)' }}>{children}</span>
      {trailing}
    </div>
  );
}
window.SectionLabel = SectionLabel;
window.RG_SECTION_CARD = RG_SECTION_CARD;
