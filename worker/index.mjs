/* =========================================================
   ReadingGo — Cloudflare Worker (Netlify 대체)
   하나의 Worker가:
     1) 정적 사이트(docs/readinggo) 서빙 — [assets] 바인딩
     2) /aladin (·/.netlify/functions/aladin 별칭) 알라딘 프록시
     3) scheduled() — 일일 인기도서 아카이브 (#239)

   env (wrangler secret put 또는 대시보드):
     ALADIN_TTB_KEY · SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY · ARCHIVE_DAILY_CAP(선택)
   배포: npx wrangler deploy
   ========================================================= */

const ALADIN = 'http://www.aladin.co.kr/ttb/api/';

export default {
  // ── HTTP: 정적 + 알라딘 프록시 ──────────────────────────
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p === '/aladin' || p === '/.netlify/functions/aladin') {
      // CORS 제한(#255): 타 사이트 브라우저 JS의 교차출처 호출 차단(TTBKey 쿼터 남용 방지).
      // 동일출처 GET은 Origin 헤더 미전송 → 통과. 다른 출처면 Origin이 우리 도메인과 달라 403.
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return aladinProxy(url.searchParams, env, ctx);
    }
    // LLM 독서 파트너 — 참새 질문 생성 (#287). 키는 서버에서만 사용(클라 노출 금지).
    if (p === '/api/companion') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return companionProxy(request, env);
    }
    // 읽기모드 OCR — 책 사진 → 한 문장 추출(#382). Upstage Document OCR + solar-pro3 보정.
    // 키는 서버에서만(클라 노출 금지). 동일출처만.
    if (p === '/api/ocr') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return ocrProxy(request, env);
    }
    // 통합 서가 ① 스샷 서가 복원 (#772) — 구매내역/서재 캡쳐 → 비전 OCR → 책 목록 구조화 추출.
    // OCR 스택 재사용(Upstage + solar-pro3). 키는 서버에서만(클라 노출 금지). 동일출처만.
    if (p === '/api/shelf-import') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return shelfImportProxy(request, env);
    }
    // 통합 서가 ② 마중물 시드 (#774) — 빈 책에 '남이 읽은 한 문장'. 네이버 블로그 검색(준공식·출처제공)
    // → solar-pro3 정제(한 문장·출처 보존). 저작권 가드: 인용 최소·출처 표기(integrated-shelf.md §5.2).
    if (p === '/api/seed') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return seedProxy(request, env);
    }
    // 관련 도서 추천 — 이 책과 함께 읽을 책 (#496). LLM은 제목·저자만 제시하고,
    // 환각 필터(실존 도서 매칭)는 클라에서 books DB로 수행. 키는 서버에서만(클라 노출 금지). 동일출처만.
    if (p === '/api/related') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return relatedProxy(request, env);
    }
    // 표지 이미지 프록시 (#676) — 알라딘 CDN은 CORS 헤더가 없어 클라가 캔버스로 그리면 tainted canvas.
    // 서버가 대신 받아 동일출처로 돌려주면 공유 카드가 표지를 taint 없이 인라인 가능. 알라딘 호스트만 허용(오픈 프록시 방지).
    if (p === '/api/img') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return imgProxy(url.searchParams);
    }
    // 그 외는 정적 에셋(docs/readinggo). 매칭 없으면 ASSETS가 404.
    return env.ASSETS.fetch(request);
  },

  // ── Cron: 인기도서 사전 아카이브 (#239) ──────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(archive(env));
    ctx.waitUntil(prewarmSeeds(env));   // #774 인기 우선 시드 선충전(sales_point 상위 N권, idempotent)
  },
};

/* ── LLM 독서 파트너 — 참새 질문 생성 (#287) ──────────────
   provider-agnostic: base_url/model/key 전부 env. OpenAI 호환 chat completions.
   키 없거나 실패 시 목 질문으로 graceful fallback (데모/피치 무중단). */
const COMPANION_SYSTEM = '당신은 사용자와 그 책을 *함께 읽은* 독서모임 진행자입니다. 그 책을 같이 읽은 동료처럼, 작품·작가를 이미 알고 있는 사람으로서 사용자가 방금 남긴 한 문장을 보고, 그 사람이 자기 생각을 더 깊이 펼치도록 대화하듯 이끄는 질문을 한국어로 하나 던지세요. 입력의 역할을 혼동하지 마세요(#359): "책에서 옮겨 적은 한 문장(인용)"은 작품 속 문장이고, "내 메모(감상)"는 사용자 자신의 생각입니다. 인용을 사용자의 감상으로 단정하지 마세요. 만약 한 문장이 책 속 인용으로 보기 어렵거나(예: "즐거웠다"처럼 짧은 감상형) 작품 속 맥락을 알 수 없다면, 함부로 해석하지 말고 — 그 문장이 책의 어떤 장면·맥락에서 나온 것인지, 혹은 본인의 생각을 적은 것인지를 먼저 물어보세요. 사용자가 다른 작품이나 작가를 언급하거나 두 작품을 비교하면(예: "○○와 닮았다"), 그 비교·연결 자체(왜 그렇게 느꼈는지, 어떤 점이 닮았는지)를 두고 물으세요. 다른 작품의 줄거리·인물을 현재 책의 인물·사건에 억지로 끼워 맞추거나 두 작품을 뒤섞지 마세요. 그 책과 작가에 대해 아는 바(작품 맥락·작가의 삶·시대)가 있으면 자연스럽게 한 조각 곁들여 질문을 풍부하게 하되, 핵심은 그 사람의 경험·감정·기억과 잇는 것입니다. 따뜻하고 호기심 어린 톤. 예/아니오로 닫히지 않는 열린 질문 하나만. 2~3문장 이내로 짧고 간결하게 — 작품 분석을 길게 늘어놓지 말 것. 마크다운 서식(별표 **, #, 목록 기호 등)을 절대 쓰지 말고 일반 문장으로만 쓰세요. 칭찬·요약·해설 나열은 금지하고 질문으로 끝맺으세요.';

// 마크다운 서식 제거 (#406) — UI가 md 렌더 안 해 별표(**)가 날것으로 보이는 문제 방지.
// 굵게/기울임/제목/목록/코드 기호만 제거(텍스트 보존).
function stripMd(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .trim();
}

function companionMock(sentence) {
  const qs = ['왜 이 문장이 마음에 걸렸어요?', '이 문장, 지금 내 상황이랑 연결되는 게 있어요?', '이 문장에서 어떤 장면이나 기억이 떠올랐어요?', '이 문장을 누군가에게 들려준다면 누구일까요?'];
  return qs[(sentence ? sentence.length : 0) % qs.length];
}

async function callLLM({ messages, env, maxTokens, temperature }) {
  const base = (env.LLM_BASE_URL || '').replace(/\/$/, '');
  const model = env.LLM_MODEL, key = env.UPSTAGE_API_KEY;
  if (!base || !model || !key) throw new Error('LLM env 미설정');
  const payload = {
    model,
    messages,
    temperature: (typeof temperature === 'number') ? temperature : 0.8,
    max_tokens: maxTokens || 220,
  };
  // reasoning 토글 — LLM_REASONING_EFFORT 미설정/빈 값이면 필드 생략(추론 최소). low|medium|high면 전달.
  const eff = (env.LLM_REASONING_EFFORT || '').trim().toLowerCase();
  if (eff === 'low' || eff === 'medium' || eff === 'high') payload.reasoning_effort = eff;
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('LLM HTTP ' + r.status);
  const d = await r.json();
  return ((d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '').trim();
}

/* ── 책 문학 브리프 — "같이 읽은 진행자" (#656) ───────────
   알라딘 소개(뒷표지 마케팅 카피)를 그라운딩으로 넣어, LLM이 주제·작가·시대·톤을
   담은 짧은 브리프로 압축한다. 마케팅 카피 자체를 질문에 주입하지 않는다.
   환각 방지: 그라운딩이 비거나 확신이 없으면 빈 문자열만(추측 금지). */
const BRIEF_SYSTEM = '당신은 독서모임 진행자를 위해 책 한 권의 핵심을 정리하는 사람입니다. 주어진 책 정보(제목·저자, 그리고 출판사 소개가 있으면 그것)를 바탕으로, 진행자가 그 책을 "같이 읽은 사람"처럼 대화하는 데 도움이 될 짧은 브리프를 한국어로 쓰세요. 담을 것: 책의 핵심 주제·정서, 작가(누구인지·결), 시대·배경, 전체적인 톤. 출판사 소개의 광고성 문구·과장은 걷어내고 사실·맥락만 압축하세요. 확실히 모르는 책이고 소개도 빈약하면 추측해서 지어내지 말고 빈 문자열만 출력하세요. 2~3문장, 마크다운·머리말 없이 일반 문장으로만.';

// 책별 브리프 캐시 (#656) — 같은 책의 후속 호출에서 재생성·재조회하지 않음(비용·지연↓).
// 모듈 레벨 in-memory Map (best-effort): Worker 인스턴스가 살아있는 동안만 유지되고
// 콜드스타트·인스턴스 분산 시 비워질 수 있다. 데모엔 충분 — 영속 캐시가 필요하면
// 후속에 Cloudflare KV(키=책 키)로 격상 검토(Stack Lock: 지금은 새 바인딩 도입 안 함).
const BOOK_BRIEF_CACHE = new Map();
const BRIEF_CACHE_MAX = 200;   // 무한 증식 방지 — 넘으면 가장 오래된 항목부터 비움

// 책 키 정규화 (#656) — 제목(+저자) 기준. 공백 접기·소문자.
function bookBriefKey(title, author) {
  const t = String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const a = String(author || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return a ? `${t}::${a}` : t;
}

// 책 문학 브리프 생성+캐시 (#656) — 모든 턴에서 호출하되 캐시 히트면 LLM 재호출 없음.
// 알라딘 소개를 그라운딩으로 LLM 압축. 키/조회/생성 실패 시 빈 문자열(무중단).
async function getBookBrief(title, author, env) {
  if (!title) return '';
  const key = bookBriefKey(title, author);
  if (BOOK_BRIEF_CACHE.has(key)) return BOOK_BRIEF_CACHE.get(key);
  let brief = '';
  try {
    // 1) 알라딘 소개(뒷표지 카피)를 그라운딩으로 조회 — best-effort.
    let grounding = '';
    try { grounding = await fetchBookBrief(title, env); } catch (e) { /* 무시 */ }
    // 2) LLM 문학 브리프로 압축(주제·작가·시대·톤). 키 있을 때만.
    if (env.UPSTAGE_API_KEY && env.LLM_BASE_URL && env.LLM_MODEL) {
      const messages = [
        { role: 'system', content: BRIEF_SYSTEM },
        { role: 'user', content: `제목: ${title}${author ? ` / 저자: ${author}` : ''}`
          + (grounding ? `\n출판사 소개(그라운딩 — 광고 문구는 걷어내고 사실만 참고):\n${grounding}` : '\n(출판사 소개 없음)') },
      ];
      const raw = await callLLM({ messages, env, maxTokens: 180, temperature: 0.4 });
      const d = stripMd(raw).trim();
      // 약한 환각 가드 — 너무 짧거나 "모름" 류면 버림(추측 주입 방지).
      if (d && d.length >= 20 && !/^(모르|알 수 없|정보가 없|해당 책)/.test(d)) brief = d.slice(0, 600);
    }
  } catch (e) { /* 생성 실패 → 빈 브리프(무중단) */ }
  // 캐시 적재(빈 문자열도 캐시 — 같은 책 반복 미스 방지). 상한 초과 시 오래된 것부터 제거.
  if (BOOK_BRIEF_CACHE.size >= BRIEF_CACHE_MAX) {
    const oldest = BOOK_BRIEF_CACHE.keys().next().value;
    if (oldest !== undefined) BOOK_BRIEF_CACHE.delete(oldest);
  }
  BOOK_BRIEF_CACHE.set(key, brief);
  return brief;
}

// 질문 방향성 프리셋 → 결 지시문 (#375). key 는 config.js RG_COMPANION_PRESETS 와 1:1 일치.
// balanced 는 키 없음(기본 톤 유지). 자유서술 아님 — 정해진 결만.
const PRESET_TONE = {
  deep: '한 가지를 끝까지 파고드는, 본질을 캐묻는 깊은 질문으로.',
  light: '부담 없이 가볍게 답할 수 있는, 편안하고 일상적인 질문으로.',
  emotional: '그때의 감정·기분·마음의 움직임에 초점을 둔 질문으로.',
  critical: '문장에 동의하거나 반박해 보게 하는, 다른 관점에서 따져보는 비판적 질문으로.',
  context: '작가의 삶·시대·작품 맥락과 연결 짓는 질문으로.',
};

async function companionProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  // 완독 회고 모드 (#259) — 내가 남긴 한 문장들을 참새가 엮어 따뜻한 회고 한 단락.
  if (body && body.mode === 'recap') return companionRecap(body, env);
  const sentence = String((body && body.sentence) || '').slice(0, 1000).trim();
  const bookTitle = String((body && body.bookTitle) || '').slice(0, 200).trim();
  const author = String((body && body.author) || '').slice(0, 120).trim();
  const comment = String((body && body.comment) || '').slice(0, 500).trim();
  // 인용 vs 내 의견 (#360) — thought면 작품 인용이 아니라 독자의 생각으로 대한다.
  const kind = (body && body.kind === 'thought') ? 'thought' : 'quote';
  // 재생성(#372) — 피할 직전 질문. 반복방지(#373)와 합류.
  const avoid = String((body && body.avoid) || '').slice(0, 500).trim();
  // 질문 방향성 프리셋 (#375) — 사용자가 고른 질문 결. key 는 config.js RG_COMPANION_PRESETS 와 1:1.
  const preset = String((body && body.preset) || '').slice(0, 20).trim();
  const presetTone = PRESET_TONE[preset] || '';
  // 멀티턴 — 이전 대화(질문/답변). 후속 질문 생성용 (#327).
  const exchanges = Array.isArray(body && body.exchanges) ? body.exchanges.slice(0, 6) : [];
  if (!sentence) return json({ error: 'sentence 필요' }, 422);
  // 키/설정 없으면 목 질문 폴백 (데모 안전 — companion.md §4)
  if (!env.UPSTAGE_API_KEY || !env.LLM_BASE_URL || !env.LLM_MODEL) {
    return json({ question: companionMock(sentence), demo: true }, 200);
  }
  // 책 문학 브리프 (#656) — "같이 읽은 진행자"용 작품 맥락. 모든 턴에 주입(첫 턴 한정 제거 —
  // 2턴부터 책 잊던 문제 해소). 책별 캐시라 첫 생성 후 후속 턴은 LLM 재호출 없음. best-effort.
  let brief = '';
  if (bookTitle) { try { brief = await getBookBrief(bookTitle, author, env); } catch (e) { /* 무시 */ } }
  const messages = [{ role: 'system', content: COMPANION_SYSTEM }];
  messages.push({ role: 'user', content: `책: ${bookTitle || '(제목 미상)'}${author ? ` — ${author}` : ''}`
    + (brief ? `\n이 책에 대해 당신(진행자)이 같이 읽으며 아는 것(주제·작가·시대·톤 — 단정 말고 자연스럽게 한 조각만 녹이세요): ${brief}` : '')
    + `\n${kind === 'thought' ? `읽다가 든 내 생각(감상): "${sentence}" — 이것은 책의 인용이 아니라 독자 본인의 생각입니다. 작품 맥락을 단정하지 말고 이 생각 자체를 더 깊이 여는 질문을 하세요.` : `책에서 옮겨 적은 한 문장(인용): "${sentence}"`}${comment ? `\n내 메모(감상): ${comment}` : ''}` });
  for (const e of exchanges) {
    if (e && e.q) messages.push({ role: 'assistant', content: String(e.q).slice(0, 500) });
    if (e && e.a) messages.push({ role: 'user', content: String(e.a).slice(0, 1000) });
  }
  let instr = exchanges.length === 0
    ? '이 문장을 두고 그 사람의 생각을 끌어내는 질문 하나를 한국어로. 작품 맥락을 한 조각만 가볍게 곁들이되 짧게(2~3문장).'
    : '사용자가 방금 한 답변에 먼저 한 문장으로 짧게 공감·반응한 뒤, 그 답을 실마리로 한 걸음 더 들어가는 질문 하나만 한국어로. 사용자의 답이 짧거나 가벼워도(예: 농담) 그 답을 무시하지 말고 거기서 자연스럽게 이어가세요. 새 작품 분석을 길게 늘어놓지 말 것. 전체 2~3문장, 질문 하나.';
  if (avoid) instr += ` 다음 질문은 이미 했으니 반드시 피하고 다르게 물으세요: "${avoid}"`;
  if (presetTone) instr += ` 질문의 결(사용자 선호): ${presetTone}`;
  messages.push({ role: 'user', content: instr });
  try {
    const q = await callLLM({ messages, env });
    return json({ question: stripMd(q) || companionMock(sentence) }, 200);
  } catch (e) {
    // 호출 실패 → 목 질문 폴백 (무중단)
    return json({ question: companionMock(sentence), demo: true, error: String((e && e.message) || e) }, 200);
  }
}

/* ── 관련 도서 추천 — 이 책과 함께 읽을 책 (#496) ──────────────
   LLM은 각 후보의 ISBN-13 + 제목 + 저자를 제시한다. 단, LLM이 준 ISBN은 신뢰하지 않는다.
   실존 여부 판정(ISBN 환각 필터)은 클라가 books DB의 ISBN과 정확 일치로 수행한다.
   여기서는 형식이 유효한(ISBN-13 13자리) 후보만 추려 돌려준다. 키/설정 없으면 빈 목록(데모 무중단).
   Phase 0은 LLM 추천 기반. Supabase 함께읽기(공동독서) 집계는 Phase 1 (#496 결정). */
const RELATED_SYSTEM = '당신은 한국 독자에게 책을 추천하는 사서입니다. 사용자가 좋아한 책 한 권을 주면, 그 책을 좋아한 독자가 함께 읽으면 좋을 다른 책을 추천하세요. 반드시 실존하는, 한국에서 정식 출간된 책만 고르세요(존재하지 않는 책·지어낸 제목·가짜 ISBN 절대 금지). 입력한 책 자신은 제외하세요. 각 책마다 정확한 ISBN-13(하이픈 없이 13자리 숫자)을 함께 제시하세요. 형식은 오직 JSON 배열 하나로만 답하세요: [{"isbn":"9788937460000","title":"책 제목","author":"저자"}]. 설명·머리말·코드펜스·그 외 텍스트를 일절 붙이지 말고 JSON 배열만 출력하세요. 최대 8권.';

// ISBN-13 정규화 — 숫자만 남겨 정확히 13자리일 때만 반환, 아니면 '' (형식 오류).
function normIsbn13(s) {
  const d = String(s == null ? '' : s).replace(/[^0-9]/g, '');
  return d.length === 13 ? d : '';
}

function parseRelated(raw) {
  // LLM 응답에서 JSON 배열만 추출 (코드펜스·잡텍스트 방어).
  const s = String(raw || '');
  const m = s.match(/\[[\s\S]*\]/);
  if (!m) return [];
  let arr;
  try { arr = JSON.parse(m[0]); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const isbn = normIsbn13(it.isbn);                       // 형식 오류·누락 → '' → 버림
    const title = String(it.title || '').trim().slice(0, 200);
    const author = String(it.author || '').trim().slice(0, 120);
    if (!isbn || !title) continue;                          // 최종 환각 필터(DB 매칭)는 클라가 수행
    if (seen.has(isbn)) continue;                           // ISBN 기준 중복 제거
    seen.add(isbn);
    out.push({ isbn, title, author });
    if (out.length >= 8) break;
  }
  return out;
}

async function relatedProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const title = String((body && body.title) || '').slice(0, 200).trim();
  const author = String((body && body.author) || '').slice(0, 120).trim();
  const isbn = normIsbn13(body && body.isbn);               // 현재 책 ISBN — LLM이 같은 책을 추천하지 않도록 전달
  if (!title) return json({ error: 'title 필요' }, 422);
  // 키/설정 없으면 빈 목록 (데모 안전 — 클라는 빈 결과를 조용히 숨김)
  if (!env.UPSTAGE_API_KEY || !env.LLM_BASE_URL || !env.LLM_MODEL) {
    return json({ books: [], demo: true }, 200);
  }
  const messages = [
    { role: 'system', content: RELATED_SYSTEM },
    { role: 'user', content: `좋아한 책: ${title}${author ? ` — ${author}` : ''}${isbn ? ` (ISBN ${isbn})` : ''}\n이 책을 좋아한 독자가 함께 읽으면 좋을 책을, 각 책의 ISBN-13과 함께 JSON 배열로 추천해줘. 위 책 자신은 제외.` },
  ];
  try {
    const raw = await callLLM({ messages, env, maxTokens: 600 });
    return json({ books: parseRelated(raw) }, 200);
  } catch (e) {
    // 호출 실패 → 빈 목록 폴백 (무중단)
    return json({ books: [], demo: true, error: String((e && e.message) || e) }, 200);
  }
}

/* ── 읽기모드 OCR — 책 사진 → 한 문장 (#382) ──────────────
   Upstage Document OCR(저렴·한글 우수) → solar-pro3 보정(컬럼 끊김·띄어쓰기만).
   키는 서버 보관(클라 노출 금지). 보정은 원문 변형 금지(인용 충실도). */
const OCR_URL = 'https://api.upstage.ai/v1/document-digitization';
const OCR_MAX_BYTES = 8 * 1024 * 1024;   // 8MB
const OCR_CORRECT_SYSTEM = '너는 책 사진 OCR 결과를 다듬는 교정기다. 책의 좌우 단·줄바꿈 때문에 생긴 불필요한 줄바꿈과 띄어쓰기 오류만 자연스럽게 이어 붙여라. 절대 원문 단어를 바꾸거나 추가·삭제·요약·번역하지 마라. 맞춤법 교정도 하지 마라. 오직 줄바꿈·띄어쓰기 정리만. 결과 텍스트만 출력(설명·따옴표 금지).';

async function ocrProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!env.UPSTAGE_API_KEY) return json({ error: 'OCR 미설정', demo: true }, 503);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'invalid form' }, 400); }
  const file = form.get('document');
  if (!file || typeof file === 'string') return json({ error: 'document(이미지) 필요' }, 422);
  if (file.size && file.size > OCR_MAX_BYTES) return json({ error: '이미지가 너무 큽니다(최대 8MB)' }, 413);
  const doCorrect = String(form.get('correct') || 'true') !== 'false';   // 기본 LLM 보정 on
  // 1) Upstage Document OCR (model=ocr) — { text, confidence, pages }.
  let raw = '';
  try {
    const up = new FormData();
    up.append('document', file, (file.name || 'page.jpg'));
    up.append('model', 'ocr');
    const r = await fetch(OCR_URL, { method: 'POST', headers: { Authorization: `Bearer ${env.UPSTAGE_API_KEY}` }, body: up });
    if (!r.ok) return json({ error: 'OCR HTTP ' + r.status }, 502);
    const d = await r.json();
    raw = String((d && d.text) || '').trim();
  } catch (e) {
    return json({ error: 'OCR 호출 실패: ' + String((e && e.message) || e) }, 502);
  }
  if (!raw) return json({ text: '', raw: '', empty: true }, 200);
  // 2) solar-pro3 보정 — 컬럼 끊김·띄어쓰기만(temperature 0.1, 원문 충실). 실패 시 raw 폴백(무중단).
  let text = raw;
  if (doCorrect && env.LLM_BASE_URL && env.LLM_MODEL) {
    try {
      const corrected = await callLLM({
        messages: [
          { role: 'system', content: OCR_CORRECT_SYSTEM },
          { role: 'user', content: '다음 OCR 텍스트의 줄바꿈·띄어쓰기만 정리:\n' + raw.slice(0, 2000) },
        ], env, maxTokens: 600, temperature: 0.1,
      });
      if (corrected) text = corrected.trim();
    } catch (e) { /* raw 폴백 */ }
  }
  return json({ text, raw }, 200);
}

// 통합 서가 ① (#772) — 구매내역/서재 캡쳐 OCR 텍스트에서 책 목록만 구조화 추출.
const SHELF_EXTRACT_SYSTEM = '너는 책 구매내역·서재 캡쳐의 OCR 텍스트에서 책 목록만 뽑는 추출기다. 각 책의 제목(title)과 저자(author)만 JSON 배열로 출력한다. 형식: [{"title":"제목","author":"저자"}]. 규칙: (1) UI 텍스트(가격·할인·배송·날짜·버튼·카테고리·별점·페이지수·"장바구니" 등)는 모두 제외. (2) 저자가 불분명하면 author는 빈 문자열. (3) 같은 책은 한 번만. (4) 확실한 책만, 애매하면 제외. (5) 설명·코드펜스 없이 JSON 배열만 출력.';

// OCR→LLM 출력(JSON 배열) 견고 파싱 — 코드펜스·잡텍스트 제거, 제목 기준 중복 제거, 상한 60.
function parseShelfBooks(s) {
  if (!s) return [];
  let t = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  let arr;
  try { arr = JSON.parse(t); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const seen = new Set(), out = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const title = String(it.title || '').trim();
    if (!title) continue;
    const author = String(it.author || '').trim();
    const key = title.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, author });
    if (out.length >= 60) break;
  }
  return out;
}

async function shelfImportProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!env.UPSTAGE_API_KEY) return json({ error: 'OCR 미설정', demo: true }, 503);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'invalid form' }, 400); }
  const file = form.get('document');
  if (!file || typeof file === 'string') return json({ error: 'document(이미지) 필요' }, 422);
  if (file.size && file.size > OCR_MAX_BYTES) return json({ error: '이미지가 너무 큽니다(최대 8MB)' }, 413);
  // 1) Upstage Document OCR — raw 텍스트.
  let raw = '';
  try {
    const up = new FormData();
    up.append('document', file, (file.name || 'shelf.jpg'));
    up.append('model', 'ocr');
    const r = await fetch(OCR_URL, { method: 'POST', headers: { Authorization: `Bearer ${env.UPSTAGE_API_KEY}` }, body: up });
    if (!r.ok) return json({ error: 'OCR HTTP ' + r.status }, 502);
    const d = await r.json();
    raw = String((d && d.text) || '').trim();
  } catch (e) {
    return json({ error: 'OCR 호출 실패: ' + String((e && e.message) || e) }, 502);
  }
  if (!raw) return json({ books: [], raw: '', empty: true }, 200);
  // 2) solar-pro3 구조화 추출 — 책 목록 JSON. LLM 미설정/실패 시 partial(클라가 raw로 수동 폴백).
  if (!env.LLM_BASE_URL || !env.LLM_MODEL) return json({ books: [], raw, partial: true }, 200);
  try {
    const out = await callLLM({
      messages: [
        { role: 'system', content: SHELF_EXTRACT_SYSTEM },
        { role: 'user', content: '다음 캡쳐 OCR에서 책 목록을 JSON으로:\n' + raw.slice(0, 4000) },
      ], env, maxTokens: 1200, temperature: 0.1,
    });
    const books = parseShelfBooks(out);
    return json({ books, raw, partial: books.length === 0 }, 200);
  } catch (e) {
    return json({ books: [], raw, partial: true, error: 'LLM 실패' }, 200);
  }
}

// 통합 서가 ② 마중물 시드 (#774) — 네이버 블로그 검색 → solar-pro3 정제.
// HTML 태그·엔티티 제거(네이버 description 은 <b>매치</b> 강조 포함).
function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const SEED_EXTRACT_SYSTEM = '입력은 한 책의 블로그 글에서 추출한 "인용 후보"들이다. 이 중 그 책의 본문을 그대로 옮긴 "책 원문 인용"만 골라라. [고른다] 책 본문 문장(작가가 책에 쓴 문장). [버린다] 소제목·목차 라벨("~에 대하여","탄생 배경","책 속의 한 문장"), 블로거의 감상·해설·생각, 책 소개·줄거리·작가 소개, "명언/명대사/배경화면" 같은 꼬리표나 메타 문구, 출처 표기 단독. [원문 그대로] 글자 수정·재작성 금지. 인용 뒤에 출처 꼬리표(예: "\'데미안\' 110p 헤르만 헤세 문학동네")가 붙어 있으면 그 꼬리표만 떼고 책 문장만 남겨라. 확신이 없으면(글쓴이 생각인지 책 원문인지 모호하면) 버려라. [출력] JSON 배열만: [{"i":원본인덱스,"text":"책 원문 인용"}]. 결과가 하나여도 배열로 감싼다. 없으면 []. 설명·코드펜스 없이 JSON만.';

function parseSeedJson(s) {
  if (!s) return [];
  let t = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  // 배열 우선, 없으면 단일 객체({...})도 수용(LLM이 결과 1개일 때 배열로 안 감싸는 경우).
  const la = t.indexOf('['), lb = t.lastIndexOf(']');
  if (la >= 0 && lb > la) t = t.slice(la, lb + 1);
  else { const oa = t.indexOf('{'), ob = t.lastIndexOf('}'); if (oa >= 0 && ob > oa) t = '[' + t.slice(oa, ob + 1) + ']'; }
  let arr;
  try { arr = JSON.parse(t); } catch { return []; }
  if (!Array.isArray(arr)) arr = [arr];
  const out = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const i = Number(it.i);
    const text = String(it.text || '').trim();
    if (!Number.isInteger(i) || i < 0 || !text) continue;
    out.push({ i, text });
  }
  return out;
}


// 네이버 블로그 검색 1회 — items[] 반환(실패·비ok → []).
async function naverBlogSearch(query, env) {
  try {
    const r = await fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=10&sort=sim`, {
      headers: { 'X-Naver-Client-Id': env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d && d.items) || [];
  } catch (e) { return []; }
}

const SEED_TARGET = 10;   // 책당 목표 문장 수(실 유저 + 시드)
const SEED_TTL_DAYS = 30;          // #806: 시드 신선도 — 가장 최신 시드가 이 일수 경과면 cron 재크롤(트렌드 갱신)
const SEED_REFRESH_DAILY_CAP = 20; // #806: 일일 재크롤 상한 — 네이버·LLM 쿼터·비용 안전(만료 책이 한꺼번에 몰려도 분산)

// 책 키 — isbn13 우선, 없으면 정규화 제목(소문자·공백 접기). Phase 0/1·데모 공통.
function seedBookKey(title, isbn) {
  const i = String(isbn || '').replace(/[^0-9Xx]/g, '');
  if (i.length >= 10) return i;
  return String(title || '').replace(/\s+/g, ' ').trim().toLowerCase();
}
// seed_sentences read — 책 키로 저장된 시드(최대 SEED_TARGET).
async function seedRead(env, bookKey) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const u = `${env.SUPABASE_URL}/rest/v1/seed_sentences?book_key=eq.${encodeURIComponent(bookKey)}&select=text,source_name,source_url&limit=${SEED_TARGET}`;
    const r = await fetch(u, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!r.ok) return [];
    const rows = await r.json();
    return (rows || []).map((x) => ({ text: x.text, sourceName: x.source_name || '블로그', sourceUrl: x.source_url || '' }));
  } catch (e) { return []; }
}
// seed_sentences write — 신규 시드 insert(중복 url은 유니크 인덱스가 무시: Prefer ignore-duplicates).
async function seedWrite(env, bookKey, seeds) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !seeds.length) return;
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/seed_sentences`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(seeds.map((s) => ({ book_key: bookKey, text: s.text, source_name: s.sourceName || null, source_url: s.sourceUrl || null }))),
    });
  } catch (e) { /* best-effort */ }
}
// 가장 최신 시드의 created_at (#806 TTL 판정용). 없으면 null. 경량 쿼리(limit 1).
async function seedLatestAt(env, bookKey) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const u = `${env.SUPABASE_URL}/rest/v1/seed_sentences?book_key=eq.${encodeURIComponent(bookKey)}&select=created_at&order=created_at.desc&limit=1`;
    const r = await fetch(u, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows && rows[0] && rows[0].created_at) || null;
  } catch (e) { return null; }
}
// ISO 시각이 days 일 이상 지났나 (#806). 파싱 실패·없음이면 false(보수적 — 재크롤 안 함).
function ttlExpired(iso, days) {
  const t = Date.parse(iso);
  if (isNaN(t)) return false;
  return (Date.now() - t) > days * 86400000;
}
// 트렌드 갱신(#806) — 기존 시드 삭제 후 새 시드로 교체. fresh 있을 때만 호출(빈 결과로 비우지 않음).
async function seedRefresh(env, bookKey, seeds) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !seeds.length) return;
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/seed_sentences?book_key=eq.${encodeURIComponent(bookKey)}`, {
      method: 'DELETE',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
  } catch (e) { /* best-effort — 삭제 실패해도 아래 write 로 신규 append */ }
  await seedWrite(env, bookKey, seeds);
}
// 검색용 제목 정규화 (#805) — 부제·시리즈 권차·개정판 표기 제거로 베스트셀러 커버리지 회복.
// DB 제목 전체("사피엔스 - 유인원에서…")가 네이버 AND 매칭에서 0건을 유발 → 앞 핵심 제목만 남긴다.
// book_key(영속 키)는 정규화하지 않음 — 검색 쿼리 빌드에만 사용.
function seedSearchTitle(title) {
  let t = String(title || '').trim();
  // ' - '/':'/'('/'[' 등 부제·메타 구분자 이후 컷(핵심 제목 = 앞부분).
  t = t.split(/\s+[-–—]\s+|[:(\[【「《]/)[0];
  return t.replace(/\s{2,}/g, ' ').trim();
}
// HTML 엔티티 디코드(#774) — 블로그 인용문 내 &#x27;·&quot; 등 복원.
function decodeSeedEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
// 네이버 모바일 블로그 본문에서 책 인용 후보 추출(#774) — blockquote·스마트에디터 인용 블록.
// 책 인용은 글쓴이 감상과 달리 인용 블록으로 표시되는 경우가 많음 → 블록만 골라 '글쓴이 생각' 혼입을 줄인다.
const SEED_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
async function seedBlogQuotes(post) {
  const m = String(post.link || '').match(/blog\.naver\.com\/([^/?]+)\/(\d+)/);
  if (!m) return [];
  let html;
  try {
    const r = await fetch(`https://m.blog.naver.com/${m[1]}/${m[2]}`, { headers: { 'User-Agent': SEED_MOBILE_UA } });
    if (!r.ok) return [];
    html = await r.text();
  } catch (e) { return []; }
  const clean = (s) => decodeSeedEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const out = [];
  for (const mm of html.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)) {
    const t = clean(mm[1]); if (t.length >= 10 && t.length <= 300) out.push({ snippet: t, url: post.link, blog: post.blog });
  }
  for (const mm of html.matchAll(/<div class="se-quote[^"]*"[\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>/g)) {
    const t = clean(mm[1]); if (t.length >= 10 && t.length <= 300) out.push({ snippet: t, url: post.link, blog: post.blog });
  }
  return out.slice(0, 8);
}

// 블로그 글 속 '책 원문 인용'을 그대로 발췌(#774 컨셉). LLM은 인용 선별·노이즈 필터만, 재작성 금지.
// 소스: 네이버 블로그 본문 인용 블록. (감상 추출·알라딘 리뷰는 폐기 — 글쓴이 생각/소개문 혼입·API 미제공.)
async function seedFetchFresh(title, author, isbn, want, env) {
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) return [];
  const st = seedSearchTitle(title);
  const baseTitles = (st && st !== title) ? [st, title] : [title];
  // 책 인용이 담긴 글 유도 — '책속 문장/밑줄/인상깊은 구절'.
  const queries = baseTitles.flatMap((t) => [t + ' 책속 문장', t + ' 밑줄', t + ' 인상깊은 구절']);
  let posts = [];
  for (const q of queries) {
    const items = await naverBlogSearch(q, env);
    posts = posts.concat((items || []).map((it) => ({ link: it.link, blog: stripHtml(it.bloggername) })));
    if (posts.length >= 6) break;
  }
  posts = posts.slice(0, 6);
  if (!posts.length) return [];
  // 각 블로그 본문에서 인용 후보 추출(병렬).
  const cands = (await Promise.all(posts.map((p) => seedBlogQuotes(p).catch(() => [])))).flat().slice(0, 24);
  if (!cands.length) return [];
  // LLM 없으면 빈 배열 — 인용 선별 없이 raw 블록 저장 금지(소제목·감상 혼입 방지).
  if (!env.LLM_BASE_URL || !env.LLM_MODEL) return [];
  let parsed = [];
  try {
    const listText = cands.map((c, i) => `[${i}] ${c.snippet.slice(0, 240)}`).join('\n');
    const out = await callLLM({
      messages: [
        { role: 'system', content: SEED_EXTRACT_SYSTEM },
        { role: 'user', content: `책: ${title}${author ? ' (저자: ' + author + ')' : ''}\n인용 후보:\n${listText}` },
      ], env, maxTokens: 900, temperature: 0.1,
    });
    parsed = parseSeedJson(out);
  } catch (e) { return []; }
  // 원문 발췌 검증(#774) — LLM이 재작성하지 않고 후보 원문에서 그대로 뽑았는지. 공백 제거 후 앞부분 포함 확인.
  const norm = (s) => String(s || '').replace(/\s+/g, '');
  return parsed.map((p) => {
    const c = cands[p.i];
    if (!c || !p.text) return null;
    const t = norm(p.text), src = norm(c.snippet);
    if (t.length < 8) return null;
    // 후보 원문에 text 앞부분(8~12자)이 실제로 존재해야 발췌로 인정 — 없으면 재작성 의심 → 버림.
    if (!src.includes(t.slice(0, 12)) && !src.includes(t.slice(0, 8))) return null;
    return { text: p.text, sourceName: c.blog || '블로그', sourceUrl: c.url };
  }).filter(Boolean).slice(0, want);
}

// 맥미니 collector 호출(spec: seed-collector.md §3.1·§9) — 예스24 "책 속으로" 우선 소스.
// 워커는 브라우저를 못 돌리므로 헤드리스 크롤은 collector(맥미니)로 이관. collector 가 seed_sentences 적재까지 수행.
//   반환: 시드 배열(성공) | null(미구성·타임아웃·실패·미커버 → 호출부가 블로그 폴백).
const COLLECTOR_TIMEOUT_MS = 12000;  // spec §3.1: 동기 대기 상한(앱 로딩 흡수). 초과 시 폴백.
async function seedCollectorFetch(title, author, isbn, env, forceRefresh) {
  if (!env.COLLECTOR_URL || !env.COLLECTOR_TOKEN) return null;  // 미구성 → 폴백
  try {
    const base = String(env.COLLECTOR_URL).replace(/\/$/, '');
    const r = await fetch(`${base}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.COLLECTOR_TOKEN}` },
      body: JSON.stringify({ title, author, isbn, forceRefresh: !!forceRefresh }),
      signal: AbortSignal.timeout(COLLECTOR_TIMEOUT_MS),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const seeds = (d && Array.isArray(d.seeds)) ? d.seeds : [];
    // 빈 결과(예스24 미커버)도 null 로 — 호출부가 블로그(#819) 폴백 시도.
    if (!seeds.length) return null;
    return seeds.map((s) => ({ text: s.text, sourceName: s.sourceName || '예스24 책속으로', sourceUrl: s.sourceUrl || '' }));
  } catch (e) { return null; }  // 타임아웃·네트워크 실패 → 폴백
}

// 시드 채움 코어 — seedProxy(요청)·prewarmSeeds(cron) 공용. seed_sentences read/write.
// forceRefresh(#806): 이미 충전된 책이라도 재크롤해 트렌드 갱신(cron이 TTL 만료 시에만 true 전달).
async function seedFill(env, { title, author, isbn, have, forceRefresh }) {
  const t = String(title || '').trim();
  if (!t) return [];
  const targetSeeds = Math.max(0, SEED_TARGET - Math.max(0, have || 0));
  if (!targetSeeds) return [];
  const bookKey = seedBookKey(t, isbn);
  // 1) 저장분 먼저(영속). 한 번 충전된 책은 네이버·LLM 재호출 0.
  const stored = await seedRead(env, bookKey);
  if (stored.length > 0 && !forceRefresh) return stored.slice(0, targetSeeds);
  // 1-b) TTL 만료 재크롤(#806) — 예스24 collector 우선(자체 교체 적재), 실패 시 블로그 폴백, 그래도 없으면 기존 유지.
  if (stored.length > 0 && forceRefresh) {
    const viaCollector = await seedCollectorFetch(t, String(author || '').trim(), isbn, env, true);
    if (viaCollector) return viaCollector.slice(0, targetSeeds);  // collector 가 seed_sentences 교체 완료
    const refreshed = await seedFetchFresh(t, String(author || '').trim(), isbn, SEED_TARGET, env);
    if (refreshed.length) { await seedRefresh(env, bookKey, refreshed); return refreshed.slice(0, targetSeeds); }
    return stored.slice(0, targetSeeds);
  }
  // 2) 미충전 책 — 예스24 collector 우선(브라우저 필요분 이관, 자체 적재). 실패·미커버 시 블로그(#819) 폴백.
  const viaCollector = await seedCollectorFetch(t, String(author || '').trim(), isbn, env, false);
  if (viaCollector) return viaCollector.slice(0, targetSeeds);  // collector 가 seed_sentences 적재 완료
  const fresh = await seedFetchFresh(t, String(author || '').trim(), isbn, targetSeeds, env);
  if (fresh.length) await seedWrite(env, bookKey, fresh);
  return fresh.slice(0, targetSeeds);
}

async function seedProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const seeds = await seedFill(env, {
    title: body && body.title, author: body && body.author,
    isbn: body && body.isbn, have: parseInt((body && body.have), 10) || 0,
  });
  return json({ seeds }, 200, 3600);
}

// 인기 우선 선충전 (#774) — 일일 cron. books 를 sales_point desc 로 상위 N권 미리 채워둔다.
// idempotent(이미 채워진 책은 DB read만) → 사실상 신규·미충전 인기 책만 일함(쿼터·비용 안전).
async function prewarmSeeds(env, limit = 150) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  let books = [];
  try {
    const u = `${env.SUPABASE_URL}/rest/v1/books?select=isbn13,title,author&sales_point=not.is.null&order=sales_point.desc.nullslast&limit=${limit}`;
    const r = await fetch(u, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (r.ok) books = await r.json();
  } catch (e) { return; }
  // #806: 만료(TTL 경과) 인기책은 재크롤로 트렌드 갱신. 일일 캡으로 쿼터·비용 안전.
  let refreshedCount = 0;
  for (const b of (books || [])) {
    try {
      let force = false;
      if (refreshedCount < SEED_REFRESH_DAILY_CAP) {
        const latest = await seedLatestAt(env, seedBookKey(b.title, b.isbn13));
        if (latest && ttlExpired(latest, SEED_TTL_DAYS)) { force = true; refreshedCount++; }
      }
      await seedFill(env, { title: b.title, author: b.author, isbn: b.isbn13, have: 0, forceRefresh: force });
    } catch (e) { /* 개별 실패 스킵 */ }
  }
}

// 책 맥락 한 조각 (#373) — 참새 질문에 작품 소개를 녹이기 위한 서버측 조회.
// 알라딘 제목검색 첫 결과의 description(출판사 책 소개). best-effort, 400자 컷.
async function fetchBookBrief(title, env) {
  const key = env.ALADIN_TTB_KEY;
  if (!key || !title) return '';
  const url = `${ALADIN}ItemSearch.aspx?ttbkey=${key}&Query=${encodeURIComponent(title)}`
    + `&QueryType=Title&SearchTarget=Book&MaxResults=1&start=1&output=js&Version=20131101&OptResult=packing`;
  const items = await aladinFetch(url);
  const desc = items && items[0] && String(items[0].description || '').trim();
  return desc ? desc.slice(0, 400) : '';
}

/* ── 완독 회고 — 참새가 내 한 문장들을 엮음 (#259) ─────────
   reflective(고양감 코어): 나열·요약 금지, 무엇에 끌렸는지 되짚고 응원 한 줄로 마무리. */
const RECAP_SYSTEM = '당신은 사용자와 친한 독서모임 진행자 "참새"입니다. 사용자가 한 권을 완독하고, 읽는 동안 마음에 남겨 둔 문장들을 모았습니다. 그 문장들을 단순히 나열하거나 요약하지 말고, 그 사람이 이 책에서 무엇에 끌렸는지를 읽어내어 따뜻하게 되짚어 주세요. 끌어올려지는 느낌(고양감)이 남도록 쓰되, 마지막 한 줄은 앞으로의 독서를 응원하거나 가볍게 생각을 열어 주는 한 문장으로 끝맺으세요. 한국어, 한 단락(3~5문장)에 마지막 응원 한 줄. 과장된 칭찬·해설 나열·이모지 남발 금지.';

function recapMock(bookTitle, sentences) {
  const n = sentences.length;
  const first = (sentences[0] || '').slice(0, 40);
  return `${bookTitle ? `《${bookTitle}》` : '이 책'}을(를) 끝까지 읽으며 ${n}개의 문장을 마음에 남기셨네요.`
    + (first ? ` "${first}…" 같은 문장에 멈춰 섰던 건, 분명 그 순간 무언가가 당신을 끌어당겼기 때문일 거예요.` : '')
    + ' 그 끌림이 곧 당신만의 독서 결입니다. 다음 책에서도 그런 문장을 만나길 응원할게요. 🐦';
}

async function companionRecap(body, env) {
  const bookTitle = String((body && body.bookTitle) || '').slice(0, 200).trim();
  const author = String((body && body.author) || '').slice(0, 120).trim();
  const review = String((body && body.review) || '').slice(0, 500).trim();
  const rating = (typeof (body && body.rating) === 'number') ? body.rating : null;
  const sentences = (Array.isArray(body && body.sentences) ? body.sentences : [])
    .slice(0, 20)
    .map((s) => String((s && s.text) || s || '').slice(0, 300).trim())
    .filter(Boolean);
  if (!sentences.length) return json({ error: 'sentences 필요' }, 422);
  if (!env.UPSTAGE_API_KEY || !env.LLM_BASE_URL || !env.LLM_MODEL) {
    return json({ recap: recapMock(bookTitle, sentences), demo: true }, 200);
  }
  const ctx = `책: ${bookTitle || '(제목 미상)'}${author ? ` — ${author}` : ''}`
    + (rating != null ? `\n내 별점: ${rating}/5` : '')
    + (review ? `\n완독 소감: ${review}` : '')
    + `\n내가 남긴 한 문장(${sentences.length}):\n` + sentences.map((s, i) => `${i + 1}. "${s}"`).join('\n');
  const messages = [
    { role: 'system', content: RECAP_SYSTEM },
    { role: 'user', content: ctx + '\n\n이 문장들을 엮어 완독 회고 한 단락을 한국어로 써 주세요.' },
  ];
  try {
    const recap = await callLLM({ messages, env, maxTokens: 450 });
    return json({ recap: stripMd(recap) || recapMock(bookTitle, sentences) }, 200);
  } catch (e) {
    return json({ recap: recapMock(bookTitle, sentences), demo: true, error: String((e && e.message) || e) }, 200);
  }
}

/* ── 표지 이미지 프록시 (#676) ───────────────────────────
   알라딘 표지를 동일출처로 중계해 공유 카드의 tainted canvas 회피.
   보안: 알라딘 이미지 호스트만 허용(오픈 프록시 악용 방지), image/* 만 통과. */
async function imgProxy(searchParams) {
  const raw = searchParams.get('url') || '';
  let u;
  try { u = new URL(raw); } catch { return json({ error: 'bad url' }, 400); }
  const host = u.hostname.toLowerCase();
  const allowed = (u.protocol === 'https:' || u.protocol === 'http:')
    && (host === 'aladin.co.kr' || host.endsWith('.aladin.co.kr'));
  if (!allowed) return json({ error: 'host not allowed' }, 403);
  let r;
  try { r = await fetch(u.toString(), { cf: { cacheTtl: 86400, cacheEverything: true } }); }
  catch (e) { return json({ error: 'upstream fetch failed' }, 502); }
  if (!r.ok) return new Response(null, { status: r.status });
  const ct = r.headers.get('content-type') || 'image/jpeg';
  if (!ct.toLowerCase().startsWith('image/')) return json({ error: 'not an image' }, 415);
  return new Response(r.body, {
    status: 200,
    headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' },
  });
}

/* ── 알라딘 프록시 (aladin.js 포팅) ─────────────────────── */
async function aladinProxy(q, env, ctx) {
  const key = env.ALADIN_TTB_KEY;
  if (!key) return json({ error: 'ALADIN_TTB_KEY 미설정' }, 500);
  const isbn = (q.get('isbn') || '').trim();
  const query = (q.get('query') || q.get('q') || '').trim().slice(0, 100);
  const max = Math.min(parseInt(q.get('max'), 10) || 10, 20);

  let apiUrl;
  if (isbn) {
    if (!/^\d{10,13}$/.test(isbn)) return json({ error: 'isbn 형식 오류' }, 400);
    apiUrl = `${ALADIN}ItemLookUp.aspx?ttbkey=${key}&itemIdType=ISBN13&ItemId=${encodeURIComponent(isbn)}`
      + `&output=js&Version=20131101&Cover=Big&OptResult=packing,Toc,Story,fulldescription,categoryIdList`;
  } else if (query) {
    apiUrl = `${ALADIN}ItemSearch.aspx?ttbkey=${key}&Query=${encodeURIComponent(query)}`
      + `&QueryType=Keyword&SearchTarget=Book&MaxResults=${max}&start=1`
      + `&output=js&Version=20131101&Cover=Big&OptResult=packing,Toc,Story,fulldescription,categoryIdList`;
  } else {
    return json({ error: 'query 또는 isbn 필요' }, 400);
  }

  try {
    // normalize()가 풀 메타(description 등) 매핑 (#489).
    let items = (await aladinFetch(apiUrl)).map(normalize);
    // #529: ISBN 단건 등록 경로 — 알라딘 빈필드를 Google→OpenLibrary→LLM 으로 비파괴 보강(외서 대응).
    if (isbn) {
      if (items.length) {
        items[0] = await enrichForeignMeta(items[0], env);
      } else {
        // 알라딘 미보유 외서 — Google→OpenLibrary 로 신규 생성
        const made = await enrichForeignMeta({ isbn13: isbn, title: '', author: '', publisher: '', total_pages: null, cover_url: '', description: '', source: '' }, env);
        if (made.title) items = [made];
      }
    }
    // 검색 도서 자동 저장 (#489) — 알라딘 결과를 백그라운드 비파괴 upsert.
    // normalize가 빈 필드 키를 생략하므로 검색(쪽수 등 누락)이 기존 풍부한 행을 덮지 않음.
    if (ctx && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const SB = env.SUPABASE_URL, SRK = env.SUPABASE_SERVICE_ROLE_KEY;
      ctx.waitUntil(Promise.all(items.filter((b) => b.isbn13).map((b) => upsertBook(SB, SRK, b).catch(() => {}))));
    }
    // 외서 균형 보강 (#302) — 검색이면 국내(알라딘) 최대 5 + 외서(Google) 최대 5 = 총 ≤10.
    // 결과 홍수 방지: 알라딘 5칸으로 자르고, 외서 5칸을 항상 채워 균형. ISBN 단건 조회엔 미적용.
    // 빈자리 이월(#350): 알라딘이 5칸을 못 채우면(외서 등) 남은 자리를 Google로 채워 총 10건 보장.
    if (query) {
      items = items.slice(0, 5);
      try {
        const gb = await googleBooksSearch(query, 10 - items.length, env);
        const seen = new Set(items.map((it) => it.isbn13 || it.title));
        for (const g of gb) {
          if (items.length >= 10) break;
          const k = g.isbn13 || g.title;
          if (k && !seen.has(k)) { seen.add(k); items.push(g); }
        }
      } catch (e) { /* 폴백 실패 무시 */ }
      // #529: 검색 보강 Google 결과도 저장(이전엔 응답만 — source='google' 행 upsert)
      if (ctx && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        const gItems = items.filter((b) => b.isbn13 && b.source === 'google');
        if (gItems.length) ctx.waitUntil(Promise.all(gItems.map((b) => upsertBook(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, b).catch(() => {}))));
      }
    }
    return json({ items }, 200, 86400);
  } catch (e) {
    // 알라딘 자체 실패 시 검색은 Google Books로 한 번 더 (외서 가용성↑).
    if (query) {
      try { const gb = await googleBooksSearch(query, max, env); if (gb.length) return json({ items: gb }, 200, 3600); } catch (e2) {}
    }
    return json({ error: '알라딘 호출 실패', detail: String((e && e.message) || e) }, 502);
  }
}

// Google Books 검색 (#302) — 알라딘 미검색 외서 보강용.
// ⚠️ 무키 엔드포인트는 레이트리밋(429/403)이 잦음 → GOOGLE_BOOKS_API_KEY(무료) 권장.
async function googleBooksSearch(query, max, env) {
  const key = env && env.GOOGLE_BOOKS_API_KEY ? `&key=${env.GOOGLE_BOOKS_API_KEY}` : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${Math.min(max || 10, 20)}&printType=books&country=KR${key}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  return (d.items || []).map((it) => {
    const v = it.volumeInfo || {};
    const ids = v.industryIdentifiers || [];
    const isbn = (ids.find((x) => x.type === 'ISBN_13') || {}).identifier || (ids.find((x) => x.type === 'ISBN_10') || {}).identifier || '';
    const cover = ((v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || '').replace(/^http:/, 'https:');
    return {
      isbn13: /^\d{13}$/.test(isbn) ? isbn : '',
      title: v.title || '',
      author: (v.authors && v.authors.join(', ')) || '',
      publisher: v.publisher || '',
      total_pages: v.pageCount ? Number(v.pageCount) : null,
      cover_url: cover,
      source: 'google',
    };
  }).filter((b) => b.title);
}

// OpenLibrary ISBN 조회 (#529) — 무키. 외서 빈필드·표지 폴백.
async function openLibraryByIsbn(isbn) {
  if (!/^\d{10,13}$/.test(isbn)) return null;
  try {
    const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`);
    if (!r.ok) return null;
    const d = await r.json();
    const v = d[`ISBN:${isbn}`];
    if (!v) return null;
    const cover = (v.cover && (v.cover.large || v.cover.medium || v.cover.small)) || '';
    const desc = typeof v.description === 'string' ? v.description : (v.description && v.description.value) || '';
    return {
      title: v.title || '',
      author: (v.authors && v.authors.map((a) => a.name).filter(Boolean).join(', ')) || '',
      publisher: (v.publishers && v.publishers.map((p) => p.name).filter(Boolean).join(', ')) || '',
      total_pages: v.number_of_pages ? Number(v.number_of_pages) : null,
      cover_url: cover.replace(/^http:/, 'https:'),
      description: String(desc || '').trim(),
      source: 'openlibrary',
    };
  } catch (e) { return null; }
}

// 빈 필드만 비파괴 merge (#529) — 기존(알라딘) 값 보존, 빈 칸만 외서 메타로 채움.
function mergeBookMeta(base, extra) {
  if (!extra) return base;
  const out = { ...base };
  let filledCore = false;
  for (const k of ['title', 'author', 'publisher', 'total_pages', 'cover_url', 'description']) {
    const cur = out[k];
    const empty = cur == null || cur === '';
    if (empty && extra[k] != null && extra[k] !== '') { out[k] = extra[k]; if (k === 'title') filledCore = true; }
  }
  // 알라딘이 못 잡은 외서(제목까지 외부가 채움)면 출처 승계 — 폴백 추적(#489 source)
  if (filledCore && (!base.source || base.source === 'aladin')) out.source = extra.source || out.source;
  return out;
}

// 빈 description LLM 보강 (#529) — 제목·저자 기반 사실 소개. 키 있을 때만 best-effort.
async function llmDescribe(book, env) {
  const messages = [
    { role: 'system', content: '책 제목과 저자를 보고 그 책의 소개를 한국어 3~4문장으로 사실에 근거해 작성하세요. 확실히 모르는 책이면 빈 문자열만 출력하세요. 줄거리 스포일러·과장·허구·추측 금지. 마크다운 없이 일반 문장.' },
    { role: 'user', content: `제목: ${book.title}${book.author ? ` / 저자: ${book.author}` : ''}${book.isbn13 ? ` / ISBN ${book.isbn13}` : ''}` },
  ];
  const raw = await callLLM({ messages, env, maxTokens: 400 });
  const d = stripMd(raw).trim();
  // 약한 환각 가드 — 너무 짧거나 "모름" 류 거부 응답이면 버림
  if (!d || d.length < 20 || /^(모르|알 수 없|정보가 없|해당 책)/.test(d)) return '';
  return d.slice(0, 800);
}

// 외서·빈필드 보강 체인 (#529) — 알라딘 → Google → OpenLibrary 빈필드 비파괴 merge,
// 끝내 빈 description 은 LLM best-effort. 단건(ISBN) 등록 경로에서만 호출(검색 결과 일괄엔 미적용 — 비용).
async function enrichForeignMeta(book, env) {
  let b = { ...book };
  const isbn = b.isbn13 || '';
  const needs = () => !b.title || !b.author || !b.publisher || !b.total_pages || !b.cover_url || !b.description;
  if (isbn && needs()) {
    try { const gb = await googleBooksSearch(`isbn:${isbn}`, 1, env); if (gb && gb[0]) b = mergeBookMeta(b, gb[0]); } catch (e) { /* skip */ }
  }
  if (isbn && needs()) {
    try { const ol = await openLibraryByIsbn(isbn); if (ol) b = mergeBookMeta(b, ol); } catch (e) { /* skip */ }
  }
  // 표지 최종 폴백 — OpenLibrary covers URL (#529)
  if (isbn && !b.cover_url) b.cover_url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  // 끝내 빈 description → LLM 보강(키 있을 때만, source='llm' 추적)
  if (!b.description && b.title && env && env.UPSTAGE_API_KEY && env.LLM_BASE_URL && env.LLM_MODEL) {
    try { const d = await llmDescribe(b, env); if (d) { b.description = d; if (!b.source || b.source === 'aladin') b.source = 'llm'; } } catch (e) { /* skip */ }
  }
  return b;
}

/* ── 인기도서 아카이브 (archive-books.mjs 포팅) ─────────── */
const CATEGORIES = [0, 1, 798, 336, 656, 987, 55889, 74];
const CONCURRENCY = 8;
const TIME_BUDGET_MS = 25000;

async function archive(env) {
  const KEY = env.ALADIN_TTB_KEY, SB = env.SUPABASE_URL, SRK = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY || !SB || !SRK) return;
  const cap = parseInt(env.ARCHIVE_DAILY_CAP || '3000', 10);
  const start = Date.now();

  const isbns = new Set();
  for (const cat of CATEGORIES) {
    for (let s = 1; s <= 4; s++) {
      try {
        const items = await aladinFetch(`${ALADIN}ItemList.aspx?ttbkey=${KEY}&QueryType=Bestseller&SearchTarget=Book&MaxResults=50&start=${s}&CategoryId=${cat}&output=js&Version=20131101`);
        for (const it of items) { const i = it.isbn13 || it.isbn; if (i && /^\d{13}$/.test(i)) isbns.add(i); }
      } catch (e) { /* skip */ }
      if (isbns.size >= cap * 2) break;
    }
    if (isbns.size >= cap * 2) break;
  }

  const have = await existingIsbns(SB, SRK, [...isbns]);
  const todo = [...isbns].filter((i) => !have.has(i)).slice(0, cap);

  let idx = 0;
  const worker = async () => {
    while (idx < todo.length && Date.now() - start < TIME_BUDGET_MS) {
      const isbn = todo[idx++];
      try {
        const lk = await aladinFetch(`${ALADIN}ItemLookUp.aspx?ttbkey=${KEY}&itemIdType=ISBN13&ItemId=${isbn}&output=js&Version=20131101&Cover=Big&OptResult=packing,Toc,Story,fulldescription,categoryIdList`);
        if (lk[0]) await upsertBook(SB, SRK, normalize(lk[0]));
      } catch (e) { /* skip */ }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/* ── 공용 헬퍼 ──────────────────────────────────────────── */
async function aladinFetch(url) {
  const r = await fetch(url);
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); }
  catch (e) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return []; d = JSON.parse(t.slice(a, b + 1)); }
  return d.item || [];
}

function normalize(it) {
  const sub = it.subInfo || {};
  const n = {
    isbn13: it.isbn13 || it.isbn || '',
    title: it.title || '',
    author: it.author || '',
    publisher: it.publisher || '',
    total_pages: sub.itemPage ? Number(sub.itemPage) : null,
    cover_url: (it.cover || '').replace(/^http:/, 'https:'),
    source: 'aladin',
  };
  // 알라딘 풀 메타 (#489) — 있으면 채움(graceful). 빈 값은 키 생략 → upsert 비파괴(기존값 보존).
  const s = (v) => { const t = String(v == null ? '' : v).trim(); return t || undefined; };
  const num = (v) => { if (v == null || v === '') return undefined; const x = Number(v); return Number.isFinite(x) ? x : undefined; };
  const set = (k, v) => { if (v !== undefined) n[k] = v; };
  set('description', s(it.description));
  set('full_description', s(sub.fullDescription || sub.fullDescription2));
  set('subtitle', s(sub.subTitle));
  set('original_title', s(sub.originalTitle));
  set('pub_date', s(it.pubDate));
  set('category_id', num(it.categoryId));
  set('category_name', s(it.categoryName));
  set('toc', s(sub.toc));
  set('story', s(sub.story));
  set('price_standard', num(it.priceStandard));
  set('price_sales', num(it.priceSales));
  set('customer_review_rank', num(it.customerReviewRank));
  set('sales_point', num(it.salesPoint));
  set('aladin_link', s(it.link != null ? String(it.link).replace(/&amp;/g, '&') : it.link)); // #529: HTML 엔티티 디코드(링크 깨짐 방지)
  if (typeof it.adult === 'boolean') n.adult = it.adult;
  return n;
}

async function existingIsbns(SB, SRK, list) {
  const have = new Set();
  for (let k = 0; k < list.length; k += 200) {
    const chunk = list.slice(k, k + 200);
    try {
      const r = await fetch(`${SB}/rest/v1/books?select=isbn13&isbn13=in.(${chunk.join(',')})`, {
        headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
      });
      const rows = await r.json();
      (rows || []).forEach((x) => { if (x.isbn13) have.add(x.isbn13); });
    } catch (e) { /* merge-duplicates 라 중복 허용 */ }
  }
  return have;
}

async function upsertBook(SB, SRK, book) {
  if (!book.isbn13) return;
  const row = { ...book, enriched_at: new Date().toISOString() };  // #489: 메타 보강 시각
  await fetch(`${SB}/rest/v1/books?on_conflict=isbn13`, {
    method: 'POST',
    headers: {
      apikey: SRK, Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
}

function json(obj, status, maxAge) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (maxAge) headers['cache-control'] = `public, max-age=${maxAge}`;
  return new Response(JSON.stringify(obj), { status, headers });
}
