/* ── share-card.js ───────────────────────────────────────────────────────────
   한 문장 외부 공유 (에픽 #650 A, spec: specs/share.md, 시안: prototypes/share-card.html)

   - 저장한 한 문장(인용/감상)을 앱 밖(인스타·카톡·X)으로 이미지 카드로 내보낸다.
   - 이미지 생성: html-to-image (CDN UMD, 전역 `htmlToImage`). 승인된 Stack Lock 예외.
   - 공유: Web Share API(files) 우선 → 다운로드 + 텍스트 폴백(§8) → 텍스트 복사.

   재사용: prototypes/share-card.html 의 1:1(.card.r11) DOM/CSS 구조를 오프스크린
   노드로 재현해 시안과 결과물을 일치시킨다. 이 PR 범위는 1:1 + 텍스트 폴백(§8).
   9:16 스토리는 후속(#650 B 동반).

   주의 — 책 표지 cross-origin(알라딘 CDN):
   알라딘 이미지에는 CORS 헤더가 없어 <img>를 그대로 캔버스에 그리면 tainted canvas →
   toPng 가 SecurityError 로 실패한다. 따라서 표지는 cacheBust 없이 crossOrigin='anonymous'
   로 **선검증 로드**를 시도하고, 실패(=CORS 미허용)하면 표지 없이 브랜드 틴트 + 제목
   이니셜 블록으로 GRACEFUL DEGRADE 한다(spec §2 "빈 표지 대응"). 깨진/taint 실패한
   이미지를 내보내느니 표지를 빼는 쪽이 안전하다. (worker 이미지 프록시는 과한 스코프 →
   후속 검토.) */

const RG_SHARE_LINK = 'readinggo.hyuniverse.workers.dev';
const RG_SHARE_HANDLE = '@readinggo.app';
const RG_SHARE_LINK_FULL = 'https://' + RG_SHARE_LINK;

// 브랜드 토큰 (index.html :root 발췌) — 오프스크린 노드는 :root 캐스케이드 밖일 수 있어 명시값 사용.
const _SC = {
  paper: '#FAF6F0', card: '#FFFFFF', ink: '#2A2D33', ink2: '#5A5F69', ink3: '#9097A0',
  line: '#ECE6DA', brand3: '#1F8E4D', brandSoft: '#DFF6EA', brandTint: '#F1FBF5',
  violet: '#6B46C1', violetSoft: '#ECE2FB',
  fontRound: "'Moneygraphy Rounded','Noto Sans KR',-apple-system,system-ui,sans-serif",
  fontPixel: "'Moneygraphy Pixel',monospace",
};

// 한 문장 → 카드/폴백에 필요한 정규화 필드. SentenceActions·SentenceCard 양쪽 모양을 흡수.
function _normalizeSentence(s) {
  const bk = (typeof getBook === 'function' && s.bookId) ? getBook(s.bookId) : null;
  const bookMatch = bk && bk.id === s.bookId;  // getBook 폴백 오표시 방지(#374 패턴)
  const text = (s.text || s.q || '').trim();
  const kind = s.kind === 'thought' ? 'thought' : 'quote';
  const title = (s.bookTitle || (bookMatch ? bk.title : '') || '').trim();
  const author = (s.author || (bookMatch ? bk.author : '') || '').trim();
  const cover = (bookMatch ? (bk.cover || bk.cover_url) : '') || '';
  return { text, kind, title, author, cover };
}

// 텍스트-only 폴백 포맷 (spec §8). 인용/감상 분기. 마지막 2줄(서비스+링크) 항상 포함.
function buildShareText(s) {
  const n = _normalizeSentence(s);
  const tail = '\n\n📖 ReadingGo에서 내 한 문장 남기기\n' + RG_SHARE_LINK_FULL;
  if (n.kind === 'thought') {
    const src = [n.author, n.title ? '《' + n.title + '》' : ''].filter(Boolean).join(' ');
    const head = '💭 ' + n.text + (src ? '\n(' + src + '을 읽고)' : '');
    return head + tail;
  }
  const src = [n.author, n.title ? '《' + n.title + '》' : ''].filter(Boolean).join(', ');
  const head = '"' + n.text + '"' + (src ? '\n— ' + src : '');
  return head + tail;
}

// 표지 CORS 선검증 — 성공 시 data-URL(taint-free) 반환, 실패 시 null(→ 이니셜 폴백).
function _loadCoverSafe(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // 알라딘 표지는 CORS 헤더가 없어 직접 로드 시 tainted canvas → 동일출처 프록시(/api/img) 경유 (#676).
    // 프록시 미배포(정적 호스팅)·실패 시 onerror → 이니셜 폴백이라 무중단. data:/상대경로는 그대로.
    const src = /^https?:\/\//i.test(url) ? (((window.RG_CONFIG && window.RG_CONFIG.API_ORIGIN) || '') + '/api/img?url=' + encodeURIComponent(url)) : url;  // #1230 네이티브 절대경로
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 200; c.height = img.naturalHeight || 280;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        finish(c.toDataURL('image/png'));  // taint 시 여기서 throw → 폴백
      } catch (e) { finish(null); }
    };
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), 4000);  // 느린/실패 로드 안전망
    img.src = src;
  });
}

// 오프스크린 1:1 카드 노드 생성 (시안 .card.r11 구조 재현). coverDataUrl=null 이면 이니셜 블록.
function _buildCardNode(n, coverDataUrl) {
  const W = 1080, PAD = Math.round(W * 0.08);
  const root = document.createElement('div');
  Object.assign(root.style, {
    // QA(#673, 실브라우저 확정): 오프스크린(left:-99999px)이면 html-to-image 가 foreignObject
    // 자식을 그리지 못해 카드가 빈 배경으로 나옴. 온스크린(left:0)에서 렌더해야 내용이 들어간다.
    // 사용자에게는 z-index 음수 + 불투명 paper 배경으로 가린다(렌더 ~0.35s 후 노드 제거).
    position: 'fixed', left: '0', top: '0', zIndex: '-9999', pointerEvents: 'none',
    width: W + 'px', height: W + 'px', padding: PAD + 'px',
    boxSizing: 'border-box', background: _SC.paper, color: _SC.ink,
    fontFamily: _SC.fontRound, letterSpacing: '-0.2px',
    display: 'flex', flexDirection: 'column',
  });

  const isThought = n.kind === 'thought';
  const accent = isThought ? _SC.violet : _SC.brand3;
  const chipBg = isThought ? _SC.violetSoft : _SC.brandSoft;

  // ① 종류 칩
  const chip = document.createElement('span');
  Object.assign(chip.style, {
    alignSelf: 'flex-start', fontFamily: _SC.fontPixel, fontSize: '34px',
    letterSpacing: '1.5px', padding: '14px 30px', borderRadius: '999px',
    color: accent, background: chipBg, lineHeight: '1', whiteSpace: 'nowrap',  // QA(#673): 알약 내 2줄 줄바꿈 방지
  });
  chip.textContent = isThought ? '💭 감상' : '❝ 인용';
  root.appendChild(chip);

  // ② 문장 (주역) — 글자 수 반응형 폰트(§6 clamp 근사)
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' });
  // 글자 수 반응형 폰트(§6 clamp 근사) — 시안(share-card.html r11=27px@340≈86px@1080) 기준 상향(#651 디자인 정합).
  const len = n.text.length;
  let fs = 88;
  if (len > 18) fs = 74;
  if (len > 32) fs = 60;
  if (len > 52) fs = 50;
  if (len > 80) fs = 40;
  const sentence = document.createElement('div');
  Object.assign(sentence.style, {
    textAlign: 'center', fontSize: fs + 'px', lineHeight: '1.45',
    letterSpacing: '-0.3px', color: _SC.ink, position: 'relative', zIndex: '1',
    maxWidth: '100%', wordBreak: 'keep-all', overflowWrap: 'break-word',
  });
  if (isThought) {
    const tm = document.createElement('span');
    tm.textContent = '💭 '; sentence.appendChild(tm);
    sentence.appendChild(document.createTextNode(n.text));
  } else {
    // 인용 장식 따옴표(옅게)
    const qm = document.createElement('span');
    Object.assign(qm.style, {
      // #650: 좌상단 '❝ 인용' 칩과 겹치지 않게 크기 축소(210→150) + 칩 아래로 내림(top -54→0).
      position: 'absolute', top: '0px', left: '0', fontSize: '150px', lineHeight: '1',
      color: _SC.brandSoft, zIndex: '0', fontFamily: 'Georgia,serif', userSelect: 'none',
    });
    qm.textContent = '“';
    wrap.appendChild(qm);
    sentence.appendChild(document.createTextNode(n.text));
  }
  wrap.appendChild(sentence);
  root.appendChild(wrap);

  // ③ 출처
  const source = document.createElement('div');
  Object.assign(source.style, { display: 'flex', alignItems: 'center', gap: '34px', marginTop: '12px' });
  const cover = document.createElement('div');
  Object.assign(cover.style, {
    width: '116px', height: '162px', borderRadius: '14px', flex: 'none',
    overflow: 'hidden', boxShadow: '0 3px 10px rgba(20,20,30,.12)',
    background: _SC.brandTint, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '54px', color: _SC.brand3, fontFamily: _SC.fontRound,
  });
  if (coverDataUrl) {
    const ci = document.createElement('img');
    Object.assign(ci.style, { width: '100%', height: '100%', objectFit: 'cover' });
    ci.src = coverDataUrl;
    cover.appendChild(ci);
  } else {
    cover.textContent = (n.title || '책').slice(0, 1);  // 빈 표지 폴백(이니셜)
  }
  source.appendChild(cover);
  const meta = document.createElement('div');
  Object.assign(meta.style, { display: 'flex', flexDirection: 'column', gap: '6px', flex: '1', minWidth: '0' });
  // QA(#673): 제목·저자 음절 중간 줄바꿈 방지 — nowrap + 긴 제목만 말줄임(컬럼은 flex:1 로 폭 확보).
  const ellip = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const t = document.createElement('span');
  Object.assign(t.style, { fontSize: '42px', color: _SC.ink, ...ellip });
  t.textContent = n.title || '';
  const a = document.createElement('span');
  Object.assign(a.style, { fontSize: '34px', color: _SC.ink2, ...ellip });
  // 감상은 "~을 읽고" 뉘앙스(spec §5)
  a.textContent = n.author ? (isThought ? n.author + '를 읽고' : n.author) : '';
  meta.appendChild(t); meta.appendChild(a);
  source.appendChild(meta);
  root.appendChild(source);

  // ④ 워터마크 (항상 노출)
  const divider = document.createElement('div');
  Object.assign(divider.style, { height: '2px', background: _SC.line, margin: '36px 0 30px' });
  root.appendChild(divider);
  const wm = document.createElement('div');
  Object.assign(wm.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' });
  const brand = document.createElement('span');
  Object.assign(brand.style, { display: 'flex', alignItems: 'center', gap: '14px', fontSize: '38px', color: _SC.ink });
  // 참새 마크는 인라인 SVG(#823) — 이모지 대신 SparrowMark 실루엣을 래스터에 박는다(아이콘 리디자인·세이지 팔레트, SparrowMark 동일 path).
  brand.innerHTML = '<svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0"><path d="M66 50 L95 40 L79 65 Z" fill="#2EA86A"/><ellipse cx="56" cy="62" rx="28" ry="24" fill="#2EA86A"/><circle cx="40" cy="40" r="19" fill="#2EA86A"/><path d="M46 23 Q51 12 55 24 Q50 26 46 23 Z" fill="#2EA86A"/><path d="M44 50 Q70 47 80 66 Q60 73 46 65 Q39 57 44 50 Z" fill="#228A57"/><path d="M23 36 L13 39.5 L24 45 Z" fill="#E8962F"/><circle cx="35" cy="38" r="3.4" fill="#2A2D33"/><circle cx="36.3" cy="36.7" r="1.15" fill="#FFFFFF"/></svg>ReadingGo';
  const handle = document.createElement('span');
  Object.assign(handle.style, { fontFamily: _SC.fontPixel, fontSize: '30px', letterSpacing: '1.2px', color: _SC.ink3 });
  handle.textContent = RG_SHARE_HANDLE;
  wm.appendChild(brand); wm.appendChild(handle);
  root.appendChild(wm);

  // #921: 실제 도달 가능한 사이트 링크를 카드에도 박는다 — 이미지만 받은 사람도 ReadingGo 로 유입(spec §2 워터마크=바이럴 진입점).
  // 핸들(@readinggo.app)은 브랜드 표기, 이 줄은 지금 열리는 데모 URL. Pixel·--ink-3 으로 절제(DESIGN: 메타/라벨 = Pixel).
  const link = document.createElement('div');
  Object.assign(link.style, { fontFamily: _SC.fontPixel, fontSize: '26px', letterSpacing: '0.8px', color: _SC.ink3, marginTop: '14px', textAlign: 'center' });
  link.textContent = RG_SHARE_LINK;
  root.appendChild(link);

  return root;
}

// Moneygraphy 폰트 임베드 CSS (#676) — 동일 오리진 otf 를 base64 @font-face 로. 1회 빌드 후 캐시.
// 이유: skipFonts 면 빠르지만 브랜드 폰트가 빠져 시스템 폰트로 렌더돼 시안과 어긋남(디자인 저하).
// fontEmbedCSS 를 주면 html-to-image 가 문서 스타일시트(크로스오리진 Google Fonts) 스캔을 건너뛰어
// SecurityError·~5s 지연 없이 Moneygraphy 로 래스터(~0.4s).
let _fontCssCache = null;
async function _fontEmbedCSS() {
  if (_fontCssCache !== null) return _fontCssCache;
  const toDataUrl = async (url) => {
    const r = await fetch(url); if (!r.ok) throw new Error('font ' + r.status);
    const b = await r.blob();
    return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
  };
  try {
    const [rnd, pix] = await Promise.all([
      toDataUrl('fonts/Moneygraphy-Rounded.otf'),
      toDataUrl('fonts/Moneygraphy-Pixel.otf'),
    ]);
    _fontCssCache =
      "@font-face{font-family:'Moneygraphy Rounded';src:url(" + rnd + ") format('opentype');}" +
      "@font-face{font-family:'Moneygraphy Pixel';src:url(" + pix + ") format('opentype');}";
  } catch (e) {
    _fontCssCache = '';  // 폰트 로드 실패 → '' (호출부에서 skipFonts 폴백)
  }
  return _fontCssCache;
}

// 카드 PNG Blob 생성. html-to-image(toBlob) 사용. 폰트 로드 완료 후 래스터.
async function renderSentenceCardBlob(s) {
  if (!(window.htmlToImage && window.htmlToImage.toBlob)) {
    throw new Error('html-to-image 미로드');
  }
  const n = _normalizeSentence(s);
  const coverDataUrl = await _loadCoverSafe(n.cover);
  const node = _buildCardNode(n, coverDataUrl);
  document.body.appendChild(node);
  try {
    // 커스텀 폰트(Moneygraphy) 글리프 누락 방지 (spec §9).
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    const fontCss = await _fontEmbedCSS();   // #676: Moneygraphy 임베드(브랜드 폰트). 실패 시 ''.
    const blob = await window.htmlToImage.toBlob(node, {
      width: 1080, height: 1080, pixelRatio: 1, backgroundColor: _SC.paper,
      cacheBust: false,  // 알라딘 표지는 위에서 data-URL 로 인라인 처리됨 → cacheBust 불필요
      // 폰트(#673·#676): fontEmbedCSS(Moneygraphy)를 주면 문서 스타일시트(크로스오리진 Google Fonts)
      // 스캔을 건너뛰어 SecurityError·~5s 지연 없이 브랜드 폰트로 래스터(~0.4s). 폰트 로드 실패 시에만
      // skipFonts 폴백(빠르되 시스템 폰트).
      ...(fontCss ? { fontEmbedCSS: fontCss } : { skipFonts: true }),
    });
    if (!blob) throw new Error('toBlob 결과 없음');
    return blob;
  } finally {
    document.body.removeChild(node);
  }
}

function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function _copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}

/* 외부 공유 진입점. 이미지 카드 생성 → Web Share(files) 우선 → 다운로드+텍스트 폴백. */
async function shareSentence(s) {
  const text = buildShareText(s);
  const toast = (typeof showToast === 'function') ? showToast : ((m) => {});
  if (window.rgTrack) { try { window.rgTrack('sentence_shared', { id: s && s.id, kind: s && s.kind === 'thought' ? 'thought' : 'quote' }); } catch (e) {} }

  let blob = null;
  try {
    blob = await renderSentenceCardBlob(s);
  } catch (e) {
    console.warn('[ReadingGo] 공유 카드 생성 실패 → 텍스트 폴백:', e && e.message);
  }

  // 1) Web Share API + files (이미지) 우선
  if (blob && navigator.canShare && navigator.share) {
    const file = new File([blob], 'readinggo-sentence.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        // #650: url 동반 — 이미지와 함께 서비스 링크 전달(플랫폼이 files+url 동시 지원 시).
        await navigator.share({ files: [file], text, url: RG_SHARE_LINK_FULL });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;  // 사용자가 취소 — 폴백 안 함
        console.warn('[ReadingGo] navigator.share 실패 → 폴백:', e && e.message);
      }
    }
  }

  // 2) 텍스트만이라도 공유 가능하면 (이미지 미지원 환경)
  if (!blob && navigator.share) {
    // #921: url 동반 — 텍스트 본문에도 링크가 있지만, url 분리로 플랫폼 링크 프리뷰/유입을 살린다(이미지 경로·shareService 와 동일).
    try { await navigator.share({ text, url: RG_SHARE_LINK_FULL }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }

  // 3) 폴백: 이미지 다운로드 + 텍스트 클립보드 복사
  if (blob) {
    _downloadBlob(blob, 'readinggo-sentence.png');
    const copied = await _copyText(text);
    // #921: 텍스트 복사 실패 시에도 최소한 사이트 링크만이라도 복사 — 이미지만 받은 사람도 ReadingGo 로 유입.
    const linkCopied = copied || await _copyText(RG_SHARE_LINK_FULL);
    toast(copied ? '🖼 이미지 저장 · 텍스트 복사됨' : (linkCopied ? '🖼 이미지 저장 · 링크 복사됨' : '🖼 이미지를 저장했어요'));
    return;
  }
  // 4) 최후: 텍스트만 복사
  const copied = await _copyText(text);
  toast(copied ? '📋 공유 텍스트를 복사했어요' : '공유를 지원하지 않는 환경이에요');
}

/* ── 서비스 외부 공유 (에픽 #650 B, spec: specs/referral.md) ──────────────────
   서비스(앱) 자체를 앱 밖으로 권유하는 공유. #650-A(한 문장 카드)와 달리 *전환*이 목적.
   Phase 0/보상 미확정: referral 코드·귀속·랜딩·보상은 제외(referral.md §4.1 graceful
   degrade) — 대표 한 문장(있으면) + 서비스 소개 + 서비스 링크만. navigator.share 우선,
   미지원 시 클립보드 폴백. 프레임워크 추가 없음(A와 동일 스택, Stack Lock 준수). */
// 서비스(앱) 권유 문구 = 우리 철학 한 줄(책을 더 쉽게·더 깊게). 특정 책 인용은 넣지 않는다 —
// 앱 초대의 목적은 책 한 권 공유가 아니라 '이 습관을 같이' 이기 때문(#1092). index.html 의 OG
// description 과 같은 문장이라, 링크 미리보기 카드와 공유 텍스트가 한목소리로 들린다.
const RG_SERVICE_TAGLINE = '책을 더 쉽게, 더 깊게 읽도록. 하루 한 문장으로 독서 습관을 만드는 ReadingGo.';

// 링크 제외 본문. navigator.share 는 url 을 따로 받으므로 본문엔 링크 미포함.
function buildServiceShareBody() {
  return RG_SERVICE_TAGLINE;
}

// 클립보드 폴백용 — 본문 + 링크.
function buildServiceShareText() {
  return buildServiceShareBody() + '\n\n' + RG_SHARE_LINK_FULL;
}

/* 서비스 공유 진입점. opts: { source('library'|...) } (추적용). 본문은 철학 한 줄 고정(#1092).
   navigator.share({text,url}) 우선 → 클립보드 복사 폴백. 미리보기 카드는 링크 OG 가 담당. */
async function shareService(opts) {
  opts = opts || {};
  const toast = (typeof showToast === 'function') ? showToast : (function () {});
  const track = (ev, p) => { if (window.rgTrack) { try { window.rgTrack(ev, p); } catch (e) {} } };
  track('service_share_open', { source: opts.source || '' });

  // 1) Web Share API — 본문(링크 제외) + url 분리(링크 프리뷰 향상).
  if (navigator.share) {
    try {
      await navigator.share({ text: buildServiceShareBody(), url: RG_SHARE_LINK_FULL });
      track('service_share_sent', { source: opts.source || '', method: 'web_share' });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;  // 사용자 취소 — 폴백 안 함
    }
  }
  // 2) 폴백: 본문+링크 클립보드 복사.
  const copied = await _copyText(buildServiceShareText());
  if (copied) track('service_share_sent', { source: opts.source || '', method: 'clipboard' });
  toast(copied ? '📋 초대 메시지를 복사했어요 — 친구에게 붙여넣어 보세요' : '공유를 지원하지 않는 환경이에요');
}

window.shareSentence = shareSentence;
window.buildShareText = buildShareText;
window.renderSentenceCardBlob = renderSentenceCardBlob;
window.shareService = shareService;
window.buildServiceShareText = buildServiceShareText;
