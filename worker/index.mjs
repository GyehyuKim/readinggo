/* =========================================================
   ReadingGo — Cloudflare Worker (Netlify 대체)
   하나의 Worker가:
     1) 정적 사이트(docs/readinggo) 서빙 — [assets] 바인딩
     2) /aladin (·/.netlify/functions/aladin 별칭) 알라딘 프록시
     3) scheduled() — 일일 인기도서 아카이브 (#239)

   env (wrangler secret put 또는 대시보드):
     ALADIN_TTB_KEY · SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY · ARCHIVE_DAILY_CAP(선택)
     KAKAO_REST_KEY(#1044 검색 프론트) · NLK_CERT_KEY(#1044 국중도 ISBN 백본)
     BOOKS_PROVIDER(선택 — 'aladin' 이면 신규 키가 있어도 레거시 알라딘 경로 강제)
   배포: npx wrangler deploy
   ========================================================= */

const ALADIN = 'http://www.aladin.co.kr/ttb/api/';

/* ── 도서 데이터 provider 스위치 (#1044, spec backend.md §7.2.1) ──────────
   알라딘 OpenAPI ToS(영리 이용 불가 + 저장·캐시 금지)가 canonical 캐시(books upsert)와 충돌 →
   상업 출시 전 소스 이전: canonical 백본 = 국중도 서지정보(쪽수 PAGE, 저장 제한 없음),
   검색 프론트 = 카카오 책검색(발견 전용 — 영구 적재는 ISBN 국중도 재조회분만).
   키 자동 감지: 해당 secret 이 있으면 신규 경로, 없으면 기존 알라딘 폴백(무중단 —
   배포 후 `wrangler secret put` 만으로 전환). BOOKS_PROVIDER='aladin' 은 명시 롤백 스위치. */
const legacyForced = (env) => env.BOOKS_PROVIDER === 'aladin';
const kakaoReady = (env) => !legacyForced(env) && !!env.KAKAO_REST_KEY;
const nlkReady = (env) => !legacyForced(env) && !!env.NLK_CERT_KEY;

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
      { const rl = await rateLimited(request, env, 'companion'); if (rl) return rl; }
      { const ts = await verifyTurnstile(request, env); if (ts) return ts; }
      return companionProxy(request, env);
    }
    // 독서 위키 Q&A — "내 문장에게 묻기" (#1007). 사용자가 모은 한 문장(+감상)에만 근거해 답.
    // companion 형제 — 같은 LLM 프록시(callLLM)·동일출처 가드·키 서버보관. 클라가 내 문장만 전송.
    if (p === '/api/wiki-ask') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      { const rl = await rateLimited(request, env, 'wiki-ask'); if (rl) return rl; }
      { const ts = await verifyTurnstile(request, env); if (ts) return ts; }
      return wikiAskProxy(request, env);
    }
    // 유연 도서기록 임포트 — 붙여넣기/파일 텍스트 → 책 목록 구조화 (#1039). wiki-ask 형제.
    // 같은 텍스트 LLM 프록시(callLLM)·동일출처 가드·키 서버보관. 클라가 붙여넣은 텍스트만 전송.
    if (p === '/api/parse-books') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      { const rl = await rateLimited(request, env, 'parse-books'); if (rl) return rl; }
      { const ts = await verifyTurnstile(request, env); if (ts) return ts; }
      return parseBooksProxy(request, env);
    }
    // 계정 삭제 (#875, Apple 심사 필수) — 호출자 토큰으로 본인 확인 후 service_role 로 admin 삭제.
    // public.users → auth.users(id) on delete cascade 라 전 데이터(서재·문장·둥지) 일괄 삭제. 동일출처만.
    if (p === '/api/delete-account') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return deleteAccountProxy(request, env);
    }
    // 읽기모드 OCR — 책 사진 → 한 문장 추출(#382). Upstage Document OCR + solar-pro3 보정.
    // 키는 서버에서만(클라 노출 금지). 동일출처만.
    if (p === '/api/ocr') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      { const rl = await rateLimited(request, env, 'ocr'); if (rl) return rl; }
      { const ts = await verifyTurnstile(request, env); if (ts) return ts; }
      return ocrProxy(request, env);
    }
    // 배치 OCR — 사진에서 강조(밑줄/형광펜) 문장 추출 (#844). Gemini Flash vision(이미지 이해). 키 서버만, 동일출처만.
    if (p === '/api/extract-highlights') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      { const rl = await rateLimited(request, env, 'extract-highlights'); if (rl) return rl; }
      { const ts = await verifyTurnstile(request, env); if (ts) return ts; }
      return extractHighlightsProxy(request, env);
    }
    // 통합 서가 ① 스샷 서가 복원 (#772·#1042) — 구매내역/서재 캡쳐 → 책 목록 구조화 추출.
    // 비전 1순위(#1042): Gemini Flash로 표지 그리드(왓챠·밀리·교보) 직접 인식 + 별점. 텍스트 OCR(Upstage+solar-pro3)은 폴백/병행.
    // 키는 서버에서만(클라 노출 금지). 동일출처만.
    if (p === '/api/shelf-import') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      { const rl = await rateLimited(request, env, 'shelf-import'); if (rl) return rl; }
      { const ts = await verifyTurnstile(request, env); if (ts) return ts; }
      return shelfImportProxy(request, env);
    }
    // 통합 서가 ② 마중물 시드 (#774) — 빈 책에 '남이 읽은 한 문장'. 네이버 블로그 검색(준공식·출처제공)
    // → solar-pro3 정제(한 문장·출처 보존). 저작권 가드: 인용 최소·출처 표기(integrated-shelf.md §5.2).
    if (p === '/api/seed') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      { const rl = await rateLimited(request, env, 'seed'); if (rl) return rl; }
      { const ts = await verifyTurnstile(request, env); if (ts) return ts; }
      return seedProxy(request, env);
    }
    // 관련 도서 추천 — 이 책과 함께 읽을 책 (#496). LLM은 제목·저자만 제시하고,
    // 환각 필터(실존 도서 매칭)는 클라에서 books DB로 수행. 키는 서버에서만(클라 노출 금지). 동일출처만.
    if (p === '/api/related') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      { const rl = await rateLimited(request, env, 'related'); if (rl) return rl; }
      { const ts = await verifyTurnstile(request, env); if (ts) return ts; }
      return relatedProxy(request, env);
    }
    // 책 캐노니컬 upsert (#1191) — 검색 raw id(b001/외서/aladin)를 books 캐노니컬 id 로 해소.
    // 예전엔 클라가 books RLS(auth.uid() is not null)로 직접 upsert → 로그인만 하면 아무나 카탈로그
    // 오염 가능. 이제 service_role 로만 쓰는 이 엔드포인트 경유(입력 검증·캡·레이트리밋). 동일출처만.
    if (p === '/api/book-upsert') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      { const rl = await rateLimited(request, env, 'book-upsert'); if (rl) return rl; }
      return bookUpsertProxy(request, env);
    }
    // 표지 이미지 프록시 (#676) — 알라딘 CDN은 CORS 헤더가 없어 클라가 캔버스로 그리면 tainted canvas.
    // 서버가 대신 받아 동일출처로 돌려주면 공유 카드가 표지를 taint 없이 인라인 가능. 알라딘 호스트만 허용(오픈 프록시 방지).
    if (p === '/api/img') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return imgProxy(url.searchParams);
    }
    // OTA Live Updates (#876) — 설치 앱(Capgo capacitor-updater)이 POST. 동일출처 게이트 없음
    // (네이티브 HTTP 클라이언트라 브라우저 Origin 없음). 채널 매니페스트(KV) 비교 → 업데이트/no-update.
    if (p === '/api/ota') return otaCheck(request, env);
    // 그 외는 정적 에셋(docs/readinggo). 매칭 없으면 ASSETS가 404.
    return env.ASSETS.fetch(request);
  },

  // ── Cron: 인기도서 사전 아카이브 (#239) ──────────────────
  async scheduled(event, env, ctx) {
    // 크론 분기 — */10 은 문의 동기화(빈번), 0 18 은 일일 아카이브+시드 선충전.
    if (event && event.cron === '*/10 * * * *') {
      ctx.waitUntil(syncInquiries(env, ctx));
      return;
    }
    ctx.waitUntil(archive(env));
    ctx.waitUntil(prewarmSeeds(env));   // #774 인기 우선 시드 선충전(sales_point 상위 N권, idempotent)
    ctx.waitUntil(backfillPages(env));  // #1117 쪽수 보강 — 검색(ItemSearch) 업서트는 itemPage 가 없어 null 로 남는다. 일일 ItemLookUp 보강(재발 방지)
  },
};

// 문의 → GitHub 이슈 동기화 (#701, inquiry-sync.md) — 크론 */10. GITHUB_TOKEN 없으면 no-op.
//   github_issue_number IS NULL 인 문의를 PII 마스킹해 GitHub 이슈로. 성공 시 번호 기록(멱등).
const GH_REPO = 'GyehyuKim/readinggo';
const INQ_EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

// 문의 LLM 정리·분류 (#1105, inquiry-sync.md §4.5) — 원문을 한 줄 제목·요약·분류로 정돈해
//   이슈 가독성·트리아지를 높인다(예: #1104 앱 화면 복붙으로 의도 불명). callLLM(텍스트 프록시)
//   재사용·키 서버보관. 실패/미설정/JSON 깨짐 시 null → 호출부가 원문만으로 폴백(graceful).
//   환각 가드: 원문에 없는 사실 추가 금지. 원문(masked)은 호출부가 본문에 항상 별도 보존.
// 라벨은 레포에 실재하는 것만 — GitHub POST /issues 의 미존재 라벨은 기존 택소노미를 오염시킨다(#1112).
const INQUIRY_CATEGORY_LABELS = { 버그: 'type:bug', 기능요청: 'type:feat', UX: 'ux', 문의: 'question', 기타: 'type:feedback' };
const INQUIRY_TRIAGE_SYSTEM = '너는 오픈베타 앱의 사용자 문의를 운영자 트리아지용으로 정돈하는 분류기다. 입력은 사용자가 보낸 문의 원문(앱 화면 텍스트가 섞여 불명확할 수 있음)이다. 다음 형태의 JSON 객체 하나만 출력한다: {"title":"한 줄 제목","summary":"핵심 요약과 추정 의도","category":"버그"}. 규칙: (1) title 은 한국어 한 줄, 40자 이내, 무엇에 대한 문의인지 드러나게. 원문이 화면 텍스트 복붙이라 불명확하면 "[불명확]"로 시작. (2) summary 는 1~2문장으로 핵심과 사용자가 무엇을 원하는지(추정 의도)를 적되, 원문에 없는 사실을 지어내지 말 것. 불명확하면 "원문만으로는 의도 불명확"이라고 솔직히 적는다. (3) category 는 정확히 다음 중 하나: 버그, 기능요청, UX, 문의, 기타. (4) 개인정보(이름·전화번호·이메일)는 제목·요약에 옮기지 말 것. (5) 설명·코드펜스 없이 JSON 객체 하나만 출력.';

async function triageInquiry(masked, env) {
  try {
    const out = await callLLM({
      messages: [
        { role: 'system', content: INQUIRY_TRIAGE_SYSTEM },
        { role: 'user', content: '다음 문의를 정돈해 JSON 으로:\n' + masked },
      ], env, maxTokens: 400, temperature: 0.2,
    });
    let t = String(out || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    const o = JSON.parse(t.slice(a, b + 1));
    const title = stripMd(String(o.title || '')).replace(/\s+/g, ' ').trim().slice(0, 70);
    const summary = stripMd(String(o.summary || '')).trim().slice(0, 600);
    if (!title || !summary) return null;                 // 핵심 필드 비면 폴백
    const cat = String(o.category || '').trim();
    const category = INQUIRY_CATEGORY_LABELS[cat] ? cat : '기타';   // enum 밖이면 기타
    return { title, summary, category, label: INQUIRY_CATEGORY_LABELS[category] };
  } catch (e) {
    return null;   // env 미설정·HTTP 실패·JSON 파싱 실패 — 전부 원문 폴백
  }
}

async function syncInquiries(env, ctx) {
  if (!env.GITHUB_TOKEN || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return; // 미구성 → no-op
  const sb = (path, init) => fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, ...(init && init.headers) },
  });
  let rows = [];
  try {
    const r = await sb('inquiries?select=id,message,app_version,created_at&github_issue_number=is.null&order=created_at.asc&limit=20');
    if (!r.ok) return;
    rows = await r.json();
  } catch (e) { return; }
  const seen = new Set();
  for (const q of (rows || [])) {
    const raw = String(q.message || '').trim();
    if (raw.length < 5) continue;                 // 노이즈 스킵(게이트 유지 — 다음 런으로)
    const masked = raw.replace(INQ_EMAIL_RE, '[이메일 가림]');
    const key = masked.slice(0, 120);
    if (seen.has(key)) continue;                  // 배치 내 중복 — 하나만
    seen.add(key);
    // LLM 정리·분류(#1105). 실패/미설정 시 null → 원문만으로 폴백. 원문(masked)은 두 경로 모두 보존.
    const triage = await triageInquiry(masked, env);
    const fallbackTitle = (masked.length > 50 ? masked.slice(0, 50) + '…' : masked).replace(/\s+/g, ' ');
    const title = triage ? triage.title : fallbackTitle;
    const meta = `- app_version: \`${q.app_version || '-'}\`\n- 접수: \`${q.created_at}\`\n- inquiry: \`${q.id}\``;
    const body = triage
      ? `> 오픈베타 사용자 문의 자동 등록 (LLM 정리·분류 · 원문 보존 · PII 마스킹됨)\n\n**요약·추정 의도**\n${triage.summary}\n\n**분류**: ${triage.category}\n\n---\n**문의 원문 (마스킹됨)**\n${masked}\n\n---\n${meta}`
      : `> 오픈베타 사용자 문의 자동 등록 (PII 마스킹됨)\n\n**문의 내용**\n${masked}\n\n---\n${meta}`;
    const labels = ['source:beta-inquiry', triage ? triage.label : 'type:feedback'];
    try {
      const gh = await fetch(`https://api.github.com/repos/${GH_REPO}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json', 'User-Agent': 'readinggo-worker',
        },
        body: JSON.stringify({ title, body, labels }),
      });
      if (gh.status !== 201) continue;            // 실패 → 컬럼 유지, 다음 런 재시도
      const issue = await gh.json();
      const upd = () => sb(`inquiries?id=eq.${q.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ github_issue_number: issue.number }),
      });
      const ok = await upd().then((r) => r.ok).catch(() => false);
      if (!ok && ctx && ctx.waitUntil) ctx.waitUntil(upd().catch(() => {})); // §4.3 재시도 1회
    } catch (e) { /* 개별 실패 스킵 */ }
  }
}

/* ── LLM 독서 파트너 — 참새 질문 생성 (#287) ──────────────
   provider-agnostic: base_url/model/key 전부 env. OpenAI 호환 chat completions.
   키 없거나 실패 시 목 질문으로 graceful fallback (데모/피치 무중단). */
const COMPANION_SYSTEM = '당신은 사용자와 그 책을 *함께 읽은* 친구 재키입니다. 독서모임 진행자나 평가자, 선생님이 아니라 — 같은 책을 읽고 곁에서 담백하게 이야기 나누는 동료입니다. 사용자가 방금 남긴 한 문장을 보고, 훈수나 분석·평가 없이 사람처럼 짧게 반응하세요. 입력의 역할을 혼동하지 마세요(#359): "책에서 옮겨 적은 한 문장(인용)"은 작품 속 문장이고, "내 메모(감상)"는 사용자 자신의 생각입니다. 인용을 사용자의 감상으로 단정하지 마세요. 만약 한 문장이 책 속 인용으로 보기 어렵거나(예: "즐거웠다"처럼 짧은 감상형) 작품 속 맥락을 알 수 없다면, 함부로 해석하지 말고 — 그 문장이 책의 어떤 장면·맥락에서 나온 것인지, 혹은 본인의 생각을 적은 것인지를 먼저 가볍게 물어보세요. 사용자가 다른 작품이나 작가를 언급하거나 두 작품을 비교하면(예: "○○와 닮았다"), 그 연결 자체를 두고 물으세요. 다른 작품의 줄거리·인물을 현재 책의 인물·사건에 억지로 끼워 맞추거나 두 작품을 뒤섞지 마세요. 그 책·작가에 대해 확실히 아는 것만 자연스럽게 한 조각 곁들이고, 모르는 것은 지어내지 마세요. 톤 — 이게 가장 중요합니다: 따뜻하고 담백한 친구처럼. 분석을 늘어놓거나 가르치려 들지 말고, 칭찬으로 운을 뗀 뒤 캐묻는 방식("정말 좋은 문장이네요! 왜 그렇게 느꼈어요?")이나 취조하듯 몰아붙이는 되물음은 하지 마세요. 물을 때는 진짜 궁금해서 혼잣말하듯, 부담 없이 답할 수 있는 열린 질문 하나면 충분합니다. 때로는 질문을 억지로 붙이기보다 그 문장에 짧게 공감하며 여운을 남기는 편이 더 따뜻합니다. 2~3문장 이내로 짧고 자연스럽게. 마크다운 서식(별표 **, #, 목록 기호 등)을 절대 쓰지 말고 일반 문장으로만 쓰세요.';

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
  // '작가의 시선' (#935, #922 후속) — 자율(가끔 자동)이던 작가 시점을 사용자 선택으로 이동.
  // #934 가 COMPANION_SYSTEM 에 넣었던 작가 단락(작가 시점 + 가드 3종)을 이 프리셋 결로 옮겨,
  // author 선택 시에만 작가 시점이 되게 한다. context(작가 *맥락* 연결)와 다른, 작가 *시점* 추론.
  author: '"작가라면 이 장면을 왜 이렇게 썼을까" 같은 작가 시점에서 작품을 바라보게 하는 질문으로. 단 작가 사칭은 금지 — "나는 [작가]다"처럼 1인칭으로 작가인 척하지 말고, 어디까지나 "작가라면 이렇게 봤을 수도 있다"는 작품 근거 추론으로만. 작가가 실제로 한 적 없는 말이나 생애 사실을 사실인 양 단정하지 말고, 확실치 않으면 지어내지 말고 독자에게 어떻게 읽었는지 되물으세요(#359 가드와 동일).',
};

// 계정 삭제 (#875) — 호출자 access token 으로 본인 uid 확인 → service_role 로 admin 삭제.
//   auth.users 삭제 → public.users(on delete cascade) → 서재·문장·둥지 등 전 데이터 일괄 삭제.
//   본인 토큰만 받으므로 타인 계정 삭제 불가(uid 는 토큰에서 도출).
async function deleteAccountProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'not configured' }, 500);
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return json({ error: 'unauthorized' }, 401);
  // 1) 토큰 → 본인 uid (GoTrue /user; apikey 는 아무 프로젝트 키나, Authorization 이 사용자 식별).
  let uid = '';
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return json({ error: 'invalid session' }, 401);
    const u = await r.json();
    uid = u && u.id;
  } catch (e) { return json({ error: 'auth check failed' }, 401); }
  if (!uid) return json({ error: 'no user' }, 401);
  // 2) admin 삭제(service_role) → cascade.
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
      method: 'DELETE',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!r.ok) { const t = await r.text(); return json({ error: 'delete failed', detail: String(t).slice(0, 200) }, 502); }
  } catch (e) { return json({ error: 'delete failed' }, 502); }
  return json({ ok: true }, 200, 0);
}

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
    ? '이 문장에 대해 담백하게 한국어로 반응하세요. 부담 없이 답할 수 있는 열린 질문 하나가 자연스러우면 하나만 던지고, 질문이 억지스러우면 짧게 공감하며 여운을 남겨도 됩니다. 작품 맥락을 한 조각만 가볍게 곁들이되 짧게(2~3문장).'
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

/* ── 배치 OCR — 사진에서 강조(밑줄/형광펜) 문장 추출 (#844) ──────────────
   Upstage Document OCR은 글자만 읽어 "밑줄 위치"를 모른다(Solar는 텍스트 전용).
   → Gemini Flash vision(이미지 이해)으로 강조 표시된 문장만 추출. 원문 충실(환각 가드는 클라 검토 큐).
   키/모델은 VISION_* env. OpenAI 호환 chat completions + image_url. 클라가 N장 순차 호출(rate limit). */
const HIGHLIGHT_SYSTEM = '너는 책 페이지 사진에서 독자가 밑줄·형광펜·괄호·별표 등으로 강조 표시한 문장만 골라내는 추출기다. 강조된 문장을 원문 그대로 JSON 문자열 배열로 출력한다. 형식: ["문장1","문장2"]. 규칙: (1) 강조 표시가 있는 문장만 — 강조 안 된 본문·머리말·쪽번호·각주는 모두 제외. (2) 원문 그대로 — 단어 변경·교정·요약·번역·합치기·새 문장 생성 절대 금지. (3) 강조 표시가 전혀 없으면 빈 배열 []. (4) 설명·코드펜스 없이 JSON 배열만 출력.';

// JSON 문자열 배열 견고 파싱 — 코드펜스·잡텍스트 제거, 공백·중복 제거, 200자 초과·상한 40 컷.
function parseHighlights(s) {
  if (!s) return [];
  let t = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  let arr;
  try { arr = JSON.parse(t); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const seen = new Set(), out = [];
  for (const it of arr) {
    const text = String(typeof it === 'string' ? it : (it && it.text) || '').trim();
    if (!text || text.length > 200) continue;
    const key = text.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= 40) break;
  }
  return out;
}

// ArrayBuffer → base64 (청크 — 큰 배열에서 String.fromCharCode 스택 오버플로 방지).
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Gemini Flash vision 호출 (OpenAI 호환). VISION_* env + GEMINI_API_KEY.
// 재시도(#1006): Gemini 무료 티어는 egress 지역에 따라 400 FAILED_PRECONDITION
// ("User location is not supported")을 간헐 반환한다(워커가 도는 Cloudflare PoP의
// 송출 지역에 좌우 — 실측 ~50% flap). 같은 요청을 재시도하면 다른 경로/PoP로 나가
// 성공률이 크게 오른다. 429/5xx(일시 과부하)도 함께 재시도. 본문 변경 없음(멱등).
// system/userText 인자(#1042 서가 비전 추출 재사용) — 기본값은 강조 추출(기존 #844 호출부 무변).
async function callVision({ env, dataUrl, maxTokens, system, userText }) {
  const base = (env.VISION_BASE_URL || '').replace(/\/$/, '');
  const model = env.VISION_MODEL, key = env.GEMINI_API_KEY;
  if (!base || !model || !key) throw new Error('VISION env 미설정');
  const payload = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: system || HIGHLIGHT_SYSTEM },
      { role: 'user', content: [
        { type: 'text', text: userText || '이 책 페이지에서 강조(밑줄/형광펜) 표시된 문장만 추출해.' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ] },
    ],
    temperature: 0.1,
    max_tokens: maxTokens || 800,
  });
  const MAX_TRIES = 3;
  let lastErr = '';
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    let r;
    try {
      r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: payload,
      });
    } catch (e) {                                   // 네트워크 실패 — 재시도 대상
      lastErr = 'fetch ' + String((e && e.message) || e);
      if (attempt < MAX_TRIES) { await sleep(350 * attempt); continue; }
      throw new Error('VISION ' + lastErr);
    }
    if (r.ok) {
      const d = await r.json();
      return ((d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '').trim();
    }
    const bodyText = await r.text().catch(() => '');
    lastErr = 'HTTP ' + r.status + (bodyText ? ' :: ' + bodyText.slice(0, 200) : '');
    // 재시도 가능 분류: 429/5xx(일시) + 400 FAILED_PRECONDITION(지역 flap). 그 외(401/403 등)는 즉시 중단.
    const retryable = r.status === 429 || r.status >= 500
      || (r.status === 400 && /FAILED_PRECONDITION|User location/i.test(bodyText));
    if (!retryable || attempt === MAX_TRIES) break;
    await sleep(350 * attempt);
  }
  throw new Error('VISION ' + lastErr);
}

// 배치 OCR (#844) — 사진 1장 → 강조 문장 배열 { sentences }. 클라가 N장 순차 호출.
async function extractHighlightsProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!env.GEMINI_API_KEY || !env.VISION_BASE_URL || !env.VISION_MODEL) return json({ error: 'vision 미설정', demo: true }, 503);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'invalid form' }, 400); }
  const file = form.get('document');
  if (!file || typeof file === 'string') return json({ error: 'document(이미지) 필요' }, 422);
  if (file.size && file.size > OCR_MAX_BYTES) return json({ error: '이미지가 너무 큽니다(최대 8MB)' }, 413);
  try {
    const buf = await file.arrayBuffer();
    const dataUrl = `data:${file.type || 'image/jpeg'};base64,${bufToBase64(buf)}`;
    const sentences = parseHighlights(await callVision({ env, dataUrl }));
    return json({ sentences }, 200);
  } catch (e) {
    return json({ error: 'vision 호출 실패: ' + String((e && e.message) || e) }, 502);
  }
}

// 통합 서가 ① (#772) — 구매내역/서재 캡쳐 OCR 텍스트에서 책 목록만 구조화 추출.
const SHELF_EXTRACT_SYSTEM = '너는 책 구매내역·서재 캡쳐의 OCR 텍스트에서 책 목록만 뽑는 추출기다. 각 책의 제목(title)과 저자(author)만 JSON 배열로 출력한다. 형식: [{"title":"제목","author":"저자"}]. 규칙: (1) UI 텍스트(가격·할인·배송·날짜·버튼·카테고리·별점·페이지수·"장바구니" 등)는 모두 제외. (2) 저자가 불분명하면 author는 빈 문자열. (3) 같은 책은 한 번만. (4) 확실한 책만, 애매하면 제외. (5) 설명·코드펜스 없이 JSON 배열만 출력.';

// 통합 서가 비전 추출 (#1042) — 표지 그리드(왓챠·밀리·교보 서재) 스샷에서 책을 직접 본다.
// 텍스트 OCR이 표지 아트·잘린 제목으로 0건 추락하는 케이스를 비전(Gemini Flash)이 표지로 인식.
// 별점(★)이 보이면 함께. 환각 가드: 확신 없으면 제외(지어내지 말 것) — 검수 큐가 2차 가드.
const SHELF_VISION_SYSTEM = '너는 사용자의 책장·평가 목록 스크린샷에서 책을 모두 찾아내는 추출기다. 보이는 책을 모두 추출한다 — 표지 이미지로 알아본 제목·저자도 포함. 각 책의 제목(title)·저자(author), 그리고 별점(★ 또는 숫자 평점)이 보이면 rating(0.5~5.0 숫자)도 함께 JSON 배열로 출력한다. 형식: [{"title":"제목","author":"저자","rating":4.5}]. 규칙: (1) UI·메뉴·탭·버튼·광고·배너·푸터·검색창·통계 숫자는 모두 제외 — 책만. (2) 저자가 불분명하면 author는 빈 문자열. rating이 안 보이면 rating 키는 생략(0 넣지 말 것). (3) 같은 책은 한 번만. (4) 확신 없는 책은 제외 — 절대 지어내지 말 것(흐릿하거나 표지 일부만 보여 제목을 모르면 버림). (5) 설명·코드펜스 없이 JSON 배열만 출력.';

// OCR→LLM 출력(JSON 배열) 견고 파싱 — 코드펜스·잡텍스트 제거, 제목 기준 중복 제거, 상한 60.
// 관용 폴백(#1038 P2-4): 1차 JSON.parse 실패 시 trailing comma 제거 후 재시도, 그래도 실패면
// 단일 객체({...})를 배열로 감싸 수용(parseSeedJson 선례) → LLM 사소한 포맷 흠으로 전체 0건 추락 방지.
// rating(#1042): 비전 추출이 별점을 함께 주면 0.5~5.0 으로 클램프해 보존(텍스트 OCR 경로엔 미출현 → 무해).
// 유연 임포트(#1039) — LLM이 준 상태 라벨을 completed/reading/wish 로 정규화. 매핑 못 하면 ''(생략 → 검수 시 사용자 1회 선택, flexible-import.md §8).
// 순서 주의: 'reading' 을 먼저 봐 'read'(completed) 부분일치 오인식을 막는다.
function normImportStatus(s) {
  const t = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return '';
  if (/(읽는중|독서중|읽고있|reading)/.test(t)) return 'reading';
  if (/(읽고싶|보고싶|위시|관심|wish|want|toread|tbr)/.test(t)) return 'wish';
  if (/(완독|읽음|다읽|완료|read|done|finish|complete)/.test(t)) return 'completed';
  return '';
}

function parseShelfBooks(s) {
  if (!s) return [];
  let t = String(s).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  else { const oa = t.indexOf('{'), ob = t.lastIndexOf('}'); if (oa >= 0 && ob > oa) t = '[' + t.slice(oa, ob + 1) + ']'; }
  let arr;
  try { arr = JSON.parse(t); }
  catch {
    try { arr = JSON.parse(t.replace(/,\s*([\]}])/g, '$1')); } // trailing comma 제거 후 재시도
    catch { return []; }
  }
  if (!Array.isArray(arr)) arr = [arr];
  const seen = new Set(), out = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const title = String(it.title || '').trim();
    if (!title) continue;
    const author = String(it.author || '').trim();
    const key = title.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row = { title, author };
    // 별점 — 숫자만 채택, 0.5~5.0 클램프. 0/음수/비숫자는 미부착(rating 없음).
    const rn = Number(it.rating);
    if (Number.isFinite(rn) && rn > 0) row.rating = Math.min(5, Math.max(0.5, Math.round(rn * 2) / 2));
    // 상태·날짜(#1039 유연 임포트) — 텍스트에 있으면 보존. 비전/OCR 경로의 LLM 응답엔 키가 없어 무해(additive).
    const st = normImportStatus(it.status);
    if (st) row.status = st;
    const dt = String(it.date == null ? '' : it.date).trim().slice(0, 40);
    if (dt) row.date = dt;
    out.push(row);
    if (out.length >= 60) break;
  }
  return out;
}

async function shelfImportProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  // 비전(Gemini) 또는 텍스트 OCR(Upstage) 중 하나라도 설정돼 있어야 동작(#1042). 둘 다 없으면 데모.
  const visionOn = !!(env.GEMINI_API_KEY && env.VISION_BASE_URL && env.VISION_MODEL);
  if (!visionOn && !env.UPSTAGE_API_KEY) return json({ error: 'OCR 미설정', demo: true }, 503);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'invalid form' }, 400); }
  const file = form.get('document');
  if (!file || typeof file === 'string') return json({ error: 'document(이미지) 필요' }, 422);
  if (file.size && file.size > OCR_MAX_BYTES) return json({ error: '이미지가 너무 큽니다(최대 8MB)' }, 413);

  // 0) 비전 추출 1순위 (#1042) — 표지 그리드 스샷을 직접 인식(텍스트 OCR이 약한 케이스).
  //    Gemini가 책을 찾으면 그 결과를 그대로 반환(rating 포함). 큰/긴 스샷은 Gemini가 내부 타일링으로
  //    처리하므로 워커에서 별도 다운스케일 없이 8MB 가드만 둔다(이미지 라이브러리 미도입 — Stack Lock).
  //    실패(키 미설정·지역 flap 소진·0건)면 아래 Upstage 텍스트 OCR 경로로 폴백.
  if (visionOn) {
    try {
      const buf = await file.arrayBuffer();
      const dataUrl = `data:${file.type || 'image/jpeg'};base64,${bufToBase64(buf)}`;
      const vraw = await callVision({
        env, dataUrl, maxTokens: 2000,
        system: SHELF_VISION_SYSTEM,
        userText: '이 스크린샷에서 보이는 책을 모두 추출해(표지로 알아본 책 포함). 별점이 보이면 함께. JSON 배열만.',
      });
      const books = parseShelfBooks(vraw);
      if (books.length) return json({ books, source: 'vision' }, 200);
      // 비전이 0건 — 텍스트 OCR이 가능하면 폴백, 아니면 빈 결과(empty)로 종료.
      if (!env.UPSTAGE_API_KEY) return json({ books: [], source: 'vision', empty: true }, 200);
    } catch (e) {
      // 비전 호출 실패(지역 flap 소진 등) — 텍스트 OCR 폴백. 그것도 없으면 502.
      if (!env.UPSTAGE_API_KEY) return json({ error: 'vision 호출 실패: ' + String((e && e.message) || e) }, 502);
    }
  }

  // 1) Upstage Document OCR — raw 텍스트. (텍스트 리스트=구매내역 폴백·병행, #1042)
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


// ── [비활성 레거시] 네이버 블로그 시드 크롤(#819) ───────────────────────────────
// 시드 소스를 예스24 "책 속으로"(맥미니 collector, 멀티NPC)로 전환하며 이 경로는 비활성화됨
// (spec seed-collector.md 큐 방식). 함수는 잠재 폴백 대비 잔존 — 현재 호출 없음. 재활성화 시 seedProxy 에서 연결.
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

// 마중물 시드 큐잉 (spec seed-collector.md 큐 방식) — 워커는 seed_queue 에 책을 넣기만 한다.
// 맥미니 collector(poller)가 큐를 폴링해 예스24 크롤 → 멀티NPC sentences 적재(byBook 노출).
// 인바운드·Tunnel·토큰 불필요(collector 는 Supabase 로 아웃바운드 폴링만).
//   book_key UNIQUE + ignore-duplicates → 중복 큐잉/이미 done 인 책은 재처리 안 됨(멱등).
async function seedEnqueue(env, { title, author, isbn, priority = 'high' }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const t = String(title || '').trim();
  if (!t) return;
  const bookKey = seedBookKey(t, isbn);
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/seed_queue?on_conflict=book_key`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({ book_key: bookKey, title: t, author: String(author || '').trim() || null, isbn: isbn || null, priority }),
    });
  } catch (e) { /* best-effort — 큐잉 실패해도 다음 진입 때 재시도 */ }
}

// /api/seed — 큐 기반 비동기 온디맨드(spec §3.1). 동기 대기 안 함.
//   빈 책(공개 문장<목표)일 때만 high 우선순위로 큐잉 + 빈 배열 반환.
//   시드 표시는 클라가 byBook(sentences) 을 직접 조회 — collector 가 NPC 명의로 채우면 폴링으로 노출.
async function seedProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const have = parseInt((body && body.have), 10) || 0;
  if (have < SEED_TARGET) {
    await seedEnqueue(env, { title: body && body.title, author: body && body.author, isbn: body && body.isbn, priority: 'high' });
  }
  return json({ seeds: [], status: 'queued' }, 200, 0);
}

// 인기 우선 선충전 (#774, spec §3.2) — 일일 cron. 인기 카탈로그책을 seed_queue 에 low 우선순위로 큐잉.
// 실제 크롤은 맥미니 collector(poller)가 한가할 때(high=온디맨드 처리 후) 소진. 워커는 큐잉만(브라우저 없음).
// #1133 Part 1: 알라딘 베스트셀러(sales_point) 의존 재설계 — 카카오/국중도엔 베스트셀러 API 가 없어
//   archive cron 이 중지되면 sales_point 가 freeze 된다. 대신 내부 유기적 신호(우리 유저의 책 채택 수
//   = user_books 수) 를 1순위, 남은 sales_point 를 부트스트랩 tiebreak 로 book_prewarm_rank 뷰에서 뽑는다.
async function prewarmSeeds(env, limit = 150) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  let books = [];
  try {
    const u = `${env.SUPABASE_URL}/rest/v1/book_prewarm_rank?select=isbn13,title,author&order=adoption.desc,sales_point.desc.nullslast&limit=${limit}`;
    const r = await fetch(u, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (r.ok) books = await r.json();
  } catch (e) { return; }
  for (const b of (books || [])) {
    try { await seedEnqueue(env, { title: b.title, author: b.author, isbn: b.isbn13, priority: 'low' }); }
    catch (e) { /* 개별 실패 스킵 */ }
  }
}

// 책 맥락 한 조각 (#373) — 참새 질문에 작품 소개를 녹이기 위한 서버측 조회.
// 제목검색 첫 결과의 소개문. best-effort, 400자 컷. 실시간 프롬프트 재료(저장 없음).
// #1044: 카카오 키 설치 시 카카오 contents 사용, 없으면 레거시 알라딘 description 폴백.
async function fetchBookBrief(title, env) {
  if (!title) return '';
  if (kakaoReady(env)) {
    try {
      const items = await kakaoBookSearch(title, 1, env);
      const desc = items && items[0] && String(items[0].description || '').trim();
      return desc ? desc.slice(0, 400) : '';
    } catch (e) { return ''; }
  }
  const key = env.ALADIN_TTB_KEY;
  if (!key) return '';
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

/* ── 독서 위키 Q&A — "내 문장에게 묻기" (#1007) ─────────────
   사용자가 책에서 모은 한 문장(+감상)에 *근거해서만* LLM이 답한다. 예: "내가 외로움에
   대해 모은 문장?", "이 문장들 관통하는 주제?", "다른 책에서 비슷한 생각 한 부분?"(#919).
   규모(유저당 ≤약 100문장 ≈ 2-3K 토큰)상 RAG/임베딩 불필요 — 내 문장 전체를 한 프롬프트에
   통째로 넣어 1콜(Gemini Flash 텍스트 = CLAUDE.md Stack Lock '텍스트 자유 사용' 안).
   환각 가드: 제공 문장에만 근거·인용·없으면 "못 찾음" 폴백(지어내지 말 것 — 프롬프트로 강제).
   프라이버시: 내 문장만 전송(타인·전체 X)이라 #1008 저작권 위험 낮음(companion 선례와 동일 경로). */
const WIKI_ASK_SYSTEM = '당신은 사용자의 "독서 위키" 사서입니다. 사용자가 여러 책에서 직접 모아 둔 문장들(과 본인이 남긴 감상)이 아래에 번호로 주어집니다. 사용자의 질문에 대해 **오직 이 모아 둔 문장들에만 근거**해 한국어로 답하세요. 규칙: (1) 답의 근거가 된 문장과 그 책 제목을 반드시 함께 밝히세요(예: 《책제목》 "…"). (2) 모아 둔 문장들에서 근거를 찾을 수 없으면, 추측하거나 지어내지 말고 정확히 "모은 문장에서는 못 찾았어요"라고만 답하세요. (3) 문장에 없는 사실·해석·다른 책 내용을 새로 만들어 내지 마세요. (4) "다른 책에서 비슷한 생각" 같은 질문이면, 모아 둔 문장들 사이에서 주제·정서가 통하는 짝을 책을 가로질러 찾아 연결하되, 어디까지나 주어진 문장 범위 안에서만. (5) 따뜻하고 담백한 톤, 마크다운 서식(별표·머리말·목록 기호)을 쓰지 말고 일반 문장으로. 3~6문장 이내로 핵심만.';

async function wikiAskProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const question = String((body && body.question) || '').slice(0, 500).trim();
  // 내 문장 payload — 클라가 listMine() 결과를 보냄. 토큰 안전: 최대 120문장, 각 필드 길이 컷.
  const items = (Array.isArray(body && body.items) ? body.items : [])
    .slice(0, 120)
    .map((it) => ({
      text: String((it && it.text) || '').slice(0, 400).trim(),
      note: String((it && it.note) || '').slice(0, 300).trim(),
      book: String((it && it.book) || '').slice(0, 200).trim(),
      author: String((it && it.author) || '').slice(0, 120).trim(),
      page: (it && (typeof it.page === 'number' || typeof it.page === 'string')) ? String(it.page).slice(0, 12) : '',
    }))
    .filter((it) => it.text);
  if (!question) return json({ error: 'question 필요' }, 422);
  if (!items.length) return json({ error: '모은 문장이 없어요', empty: true }, 422);
  // 키/설정 없으면 데모 폴백(무중단) — 위키 Q&A는 실 LLM이 핵심이라 목 답 대신 안내 문구.
  if (!env.UPSTAGE_API_KEY || !env.LLM_BASE_URL || !env.LLM_MODEL) {
    return json({ answer: '지금은 답하기 기능을 쓸 수 없어요(데모). 키워드 검색으로 찾아보세요.', demo: true }, 200);
  }
  // 그라운딩 — 모은 문장 전체를 번호로 한 프롬프트에. 책·페이지·감상을 함께 줘 근거 인용을 돕는다.
  const corpus = items.map((it, i) => {
    const where = `${it.book ? `《${it.book}》` : '(책 미상)'}${it.author ? ` — ${it.author}` : ''}${it.page ? ` ${it.page}p` : ''}`;
    return `${i + 1}. ${where}\n   문장: "${it.text}"${it.note ? `\n   내 감상: ${it.note}` : ''}`;
  }).join('\n');
  const messages = [
    { role: 'system', content: WIKI_ASK_SYSTEM },
    { role: 'user', content: `[내가 모아 둔 문장 ${items.length}개]\n${corpus}\n\n[질문]\n${question}\n\n위 문장들에만 근거해 한국어로 답해 주세요. 근거 문장·책을 밝히고, 없으면 "모은 문장에서는 못 찾았어요".` },
  ];
  try {
    const ans = await callLLM({ messages, env, maxTokens: 600, temperature: 0.5 });
    const out = stripMd(ans).trim();
    return json({ answer: out || '모은 문장에서는 못 찾았어요' }, 200);
  } catch (e) {
    return json({ error: '답하기 실패', detail: String((e && e.message) || e) }, 502);
  }
}

/* ── 유연 도서기록 임포트 — 붙여넣기/파일 텍스트 → 책 목록 (#1039) ──────────
   shelf-import(#772)의 텍스트 형제. 임의 포맷(노션·엑셀 셀 복붙·서점 구매내역 표·메모)을 받아
   책 항목만 구조화한다. callLLM(solar-pro3) 재사용 · 키 서버보관(Stack Lock). 저작권 가드:
   서지 메타 + 본인 상태/별점/날짜만, 타인 서평·책 원문은 옮기지 않는다(flexible-import.md §2·§4.1). */
const FLEXIBLE_PARSE_SYSTEM = '너는 임의 포맷의 도서 목록 텍스트(노션·엑셀 셀 복붙·서점 구매내역·메모 등)에서 책 항목만 구조화하는 추출기다. 각 책의 제목(title, 필수)과 저자(author)를, 그리고 텍스트에 분명히 드러나 있으면 상태(status: 읽음/읽는 중/읽고 싶음 중 하나)·별점(rating: 0.5~5.0 숫자)·날짜(date: 보이는 그대로의 문자열)를 함께 뽑는다. 형식은 오직 JSON 배열: [{"title":"제목","author":"저자","status":"읽음","rating":4.5,"date":"2024-01"}]. 규칙: (1) 책이 아닌 줄(머리말·합계·페이지수·가격·배송·UI·메뉴·카테고리·통계·서평 본문)은 모두 무시. (2) 불확실하면 제외 — 지어내지 말 것(제목이 분명한 책만). (3) status·rating·date 는 텍스트에 없으면 그 키를 생략(0 이나 빈 값을 넣지 말 것). (4) 타인의 서평·감상·책 속 문장 원문은 절대 옮기지 말 것 — 서지 메타데이터(제목·저자)와 본인 상태/별점/날짜만. (5) 같은 책은 한 번만. (6) 설명·코드펜스 없이 JSON 배열만 출력.';

async function parseBooksProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  // 붙여넣은 원문 — 상한 가드 32KB(클라도 동일 컷). 텍스트만 받는다(파일은 클라가 텍스트로 평탄화).
  const text = String((body && body.text) || '').slice(0, 32 * 1024).trim();
  if (!text) return json({ error: 'text 필요', empty: true }, 422);
  // 키/설정 없으면 503 데모(무중단) — 클라가 비활성 안내 + 수동 추가 폴백.
  if (!env.UPSTAGE_API_KEY || !env.LLM_BASE_URL || !env.LLM_MODEL) {
    return json({ demo: true }, 503);
  }
  try {
    const out = await callLLM({
      messages: [
        { role: 'system', content: FLEXIBLE_PARSE_SYSTEM },
        { role: 'user', content: '다음 텍스트에서 책 목록을 JSON 배열로 추출:\n' + text },
      ], env, maxTokens: 4000, temperature: 0.1,
    });
    const books = parseShelfBooks(out);   // 제목·저자·별점 + status·date 정규화(#1039 확장)
    return json({ books, partial: books.length === 0 }, 200);
  } catch (e) {
    // LLM 실패 — 빈 목록 + partial(무중단). 클라가 "수동 추가" 폴백 안내.
    return json({ books: [], partial: true, error: 'LLM 실패' }, 200);
  }
}

/* ── 표지 이미지 프록시 (#676) ───────────────────────────
   표지를 동일출처로 중계해 공유 카드의 tainted canvas 회피.
   보안: 표지 호스트 화이트리스트만 허용(오픈 프록시 악용 방지), image/* 만 통과.
   #1044 소스 이전: 카카오 책검색 thumbnail(*.kakaocdn.net)·국중도 TITLE_URL(*.nl.go.kr) 추가
   — 실제 표지 호스트는 출시 전 실계정 확인 후 확정(spec backend.md §7.2.1 게이트). */
async function imgProxy(searchParams) {
  const raw = searchParams.get('url') || '';
  let u;
  try { u = new URL(raw); } catch { return json({ error: 'bad url' }, 400); }
  const host = u.hostname.toLowerCase();
  const allowed = (u.protocol === 'https:' || u.protocol === 'http:')
    && (host === 'aladin.co.kr' || host.endsWith('.aladin.co.kr')
      || host === 'kakaocdn.net' || host.endsWith('.kakaocdn.net')
      || host === 'nl.go.kr' || host.endsWith('.nl.go.kr'));
  if (!allowed) return json({ error: 'host not allowed' }, 403);
  let r;
  // redirect: 'manual' — allowlist 호스트의 오픈 리다이렉트를 타고 비-allowlist 타깃을 fetch 하는
  //   SSRF/오픈프록시를 차단(#1160). 3xx 는 따르지 않고 거부.
  try { r = await fetch(u.toString(), { redirect: 'manual', cf: { cacheTtl: 86400, cacheEverything: true } }); }
  catch (e) { return json({ error: 'upstream fetch failed' }, 502); }
  if (r.status >= 300 && r.status < 400) return json({ error: 'redirect not allowed' }, 502);
  if (!r.ok) return new Response(null, { status: r.status });
  const ct = (r.headers.get('content-type') || 'image/jpeg').toLowerCase();
  // 실제 래스터 이미지만 — svg 는 스크립트 캐리어라 배제(#1160).
  if (!ct.startsWith('image/') || ct.includes('svg')) return json({ error: 'not an image' }, 415);
  return new Response(r.body, {
    status: 200,
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',   // 콘텐츠 스니핑 차단
    },
  });
}

/* ── 도서 프록시 디스패처 (#1044 소스 이전) ──────────────────
   라우트 `/aladin` 은 클라 회귀 방지 위해 과도기 유지(§7.2.1). 키 존재에 따라
   ISBN 단건 → 국중도(nlkIsbnLookup), 키워드 검색 → 카카오(kakaoSearchProxy),
   둘 다 없으면 기존 알라딘 경로(aladinLegacyProxy) — 현 배포 상태와 동일 동작. */
async function aladinProxy(q, env, ctx) {
  const isbn = (q.get('isbn') || '').trim();
  const query = (q.get('query') || q.get('q') || '').trim().slice(0, 100);
  const max = Math.min(parseInt(q.get('max'), 10) || 10, 20);
  if (isbn && !/^\d{10,13}$/.test(isbn)) return json({ error: 'isbn 형식 오류' }, 400);
  if (!isbn && !query) return json({ error: 'query 또는 isbn 필요' }, 400);
  if (isbn && nlkReady(env)) return nlkIsbnLookup(isbn, env, ctx);
  if (!isbn && kakaoReady(env)) return kakaoSearchProxy(query, max, env, ctx);
  return aladinLegacyProxy(isbn, query, max, env, ctx);
}

/* ── 국중도 서지정보 — ISBN 단건 백본 (#1044) ─────────────────
   canonical 영구 적재는 저장 제한 없는 소스만: 국중도 → (미보유 외서) OpenLibrary.
   Google Books 는 응답 표시 보강에만 쓰고 영구 upsert 에서 제외(ToS §5.e 영구 캐시 금지). */
async function nlkIsbnLookup(isbn, env, ctx) {
  let canonical = null;
  try { canonical = await nlkByIsbn(isbn, env); } catch (e) { /* 방어 — 폴백 진행 */ }
  if (!canonical || !canonical.title) {
    // 국중도 미보유(외서 등) — 영구 폴백은 OpenLibrary(무키·저장 제약 없음)만.
    const ol = await openLibraryByIsbn(isbn);
    if (ol && ol.title) canonical = { isbn13: isbn, ...ol };
  }
  // 영구 적재: canonical(국중도/OpenLibrary) 행만 — upsertBook 이 ISBN-13 게이트(#1117) 적용.
  if (ctx && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && canonical && canonical.title) {
    ctx.waitUntil(upsertBook(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, canonical).catch(() => {}));
  }
  // 표시용 실시간 보강(#529 계승) — 빈 필드를 Google→OpenLibrary→LLM 으로 채우되 저장과 분리.
  let display = canonical ? { ...canonical } : { isbn13: isbn, title: '', author: '', publisher: '', total_pages: null, cover_url: '', description: '', source: '' };
  try { display = await enrichForeignMeta(display, env); } catch (e) { /* skip */ }
  return json({ items: display.title ? [display] : [] }, 200, 86400);
}

// 국중도 서지정보 API 호출 (#1044) — cert_key 서버 보관(클라 노출 금지). 응답 방어적 파싱.
async function nlkByIsbn(isbn, env) {
  if (!env.NLK_CERT_KEY || !/^\d{10,13}$/.test(isbn)) return null;
  const url = `https://www.nl.go.kr/seoji/SearchApi.do?cert_key=${encodeURIComponent(env.NLK_CERT_KEY)}`
    + `&result_style=json&page_no=1&page_size=10&isbn=${encodeURIComponent(isbn)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  let d;
  try { d = await r.json(); } catch (e) { return null; }
  const docs = (d && (d.docs || d.doc)) || [];
  const doc = Array.isArray(docs) ? docs[0] : docs;
  if (!doc) return null;
  return normalizeNLK(doc, isbn);
}

// 국중도 응답 → books 컬럼 (#1044) — 쪽수 = PAGE(알라딘 itemPage 대체), 표지 = TITLE_URL.
// 빈 필드 키 생략(normalize 와 동일 비파괴 규약) — merge upsert 가 기존 풍부한 행을 덮지 않게.
function normalizeNLK(doc, isbn) {
  const s = (v) => String(v == null ? '' : v).trim();
  const n = { isbn13: s(doc.EA_ISBN) || s(doc.SET_ISBN) || s(isbn), title: s(doc.TITLE), source: 'nlk' };
  const set = (k, v) => { const t = s(v); if (t) n[k] = t; };
  set('author', doc.AUTHOR);
  set('publisher', doc.PUBLISHER);
  const pg = (s(doc.PAGE).match(/\d+/) || [])[0];       // "376 p." 류 표기 방어
  if (pg && Number(pg) > 1) n.total_pages = Number(pg);
  set('cover_url', s(doc.TITLE_URL).replace(/^http:/, 'https:'));
  const pre = s(doc.PUBLISH_PREDATE || doc.REAL_PUBLISH_DATE);
  if (/^\d{8}$/.test(pre)) n.pub_date = `${pre.slice(0, 4)}-${pre.slice(4, 6)}-${pre.slice(6, 8)}`;
  return n;
}

/* ── 카카오 책검색 — 검색 프론트 (#1044) ─────────────────────
   발견 전용. 영구 적재는 카카오 응답 직접 upsert 대신 발견 ISBN 을 국중도로 재조회한 행만
   (카카오 운영정책 캐시 조항 회피 — 리서치 #1044). 국중도 키 없으면 저장 생략(응답만). */
async function kakaoSearchProxy(query, max, env, ctx) {
  try {
    let items = await kakaoBookSearch(query, max, env);
    // 외서 균형 보강(#302 유지): 국내(카카오) 최대 5 + 외서(Google) 최대 5 = 총 ≤10.
    // Google 결과는 실시간 응답만 — 영구 upsert 없음(ToS §5.e).
    items = items.slice(0, 5);
    try {
      const gb = await googleBooksSearch(query, 10 - items.length, env);
      const seen = new Set(items.map((it) => it.isbn13 || it.title));
      for (const g of gb) {
        if (items.length >= 10) break;
        const k = g.isbn13 || g.title;
        if (k && !seen.has(k)) { seen.add(k); items.push(g); }
      }
    } catch (e) { /* 보강 실패 무시 */ }
    // 검색 도서 자동 저장(#489 계승): 카카오 발견 ISBN → 국중도 재조회 후 canonical 적재.
    if (ctx && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && nlkReady(env)) {
      const isbns = items.filter((b) => b.source === 'kakao' && b.isbn13).map((b) => b.isbn13);
      ctx.waitUntil((async () => {
        for (const i of isbns) {
          try {
            const n = await nlkByIsbn(i, env);
            if (n && n.title) await upsertBook(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, n);
          } catch (e) { /* skip */ }
        }
      })());
    }
    return json({ items }, 200, 86400);
  } catch (e) {
    // 카카오 자체 실패 → Google 실시간 폴백(저장 없음) — 레거시 경로와 동일 무중단 규약.
    try { const gb = await googleBooksSearch(query, max, env); if (gb.length) return json({ items: gb }, 200, 3600); } catch (e2) {}
    return json({ error: '카카오 호출 실패', detail: String((e && e.message) || e) }, 502);
  }
}

// 카카오 책검색 API 호출 (#1044) — KakaoAK 헤더, REST 키 서버 보관(클라 노출 금지).
async function kakaoBookSearch(query, max, env) {
  const r = await fetch(`https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query)}&size=${Math.min(max || 10, 50)}`, {
    headers: { Authorization: `KakaoAK ${env.KAKAO_REST_KEY}` },
  });
  if (!r.ok) throw new Error(`kakao ${r.status}`);
  const d = await r.json();
  return (Array.isArray(d.documents) ? d.documents : []).map(normalizeKakao).filter((b) => b.title);
}

// 카카오 응답 → books 컬럼 (#1044) — 쪽수 미제공(total_pages 키 생략, 국중도 PAGE 로 보강).
// isbn 필드는 "ISBN10 ISBN13" 공백 구분 — 13자리 토큰만 채택. 빈 필드 키 생략(비파괴).
function normalizeKakao(doc) {
  const s = (v) => String(v == null ? '' : v).trim();
  const isbn13 = s(doc.isbn).split(/\s+/).find((t) => /^\d{13}$/.test(t)) || '';
  const n = { isbn13, title: s(doc.title), source: 'kakao' };
  const set = (k, v) => { const t = s(v); if (t) n[k] = t; };
  set('author', (Array.isArray(doc.authors) ? doc.authors : []).join(', '));
  set('publisher', doc.publisher);
  set('cover_url', s(doc.thumbnail).replace(/^http:/, 'https:'));
  set('description', doc.contents);
  const dt = s(doc.datetime);                            // ISO 8601 (예: 2014-11-17T00:00:00.000+09:00)
  if (/^\d{4}-\d{2}-\d{2}/.test(dt)) n.pub_date = dt.slice(0, 10);
  return n;
}

/* ── 알라딘 프록시 (aladin.js 포팅) — 레거시 폴백 (#1044 과도기) ── */
async function aladinLegacyProxy(isbn, query, max, env, ctx) {
  const key = env.ALADIN_TTB_KEY;
  if (!key) return json({ error: 'ALADIN_TTB_KEY 미설정' }, 500);

  let apiUrl;
  if (isbn) {
    apiUrl = `${ALADIN}ItemLookUp.aspx?ttbkey=${key}&itemIdType=ISBN13&ItemId=${encodeURIComponent(isbn)}`
      + `&output=js&Version=20131101&Cover=Big&OptResult=packing,Toc,Story,fulldescription,categoryIdList`;
  } else {
    apiUrl = `${ALADIN}ItemSearch.aspx?ttbkey=${key}&Query=${encodeURIComponent(query)}`
      + `&QueryType=Keyword&SearchTarget=Book&MaxResults=${max}&start=1`
      + `&output=js&Version=20131101&Cover=Big&OptResult=packing,Toc,Story,fulldescription,categoryIdList`;
  }

  try {
    // normalize()가 풀 메타(description 등) 매핑 (#489).
    let items = (await aladinFetch(apiUrl)).map(normalize);
    // #529: ISBN 단건 등록 경로 — 알라딘 빈필드를 OpenLibrary→LLM 으로 비파괴 보강(외서 대응).
    // #1133/#1044 §5.e: 영속 행(persistItems)은 Google 제외(Google Books ToS 가 영구 DB 캐시 금지),
    // 표시 행(items)만 Google 로 보강해 클라 응답에만 사용(저장 안 함). 저장·표시 분리.
    let persistItems = null;   // ISBN 경로 전용 — Google 미포함 영속 행(비어 있으면 저장 없음)
    if (isbn) {
      const seed = items.length ? items[0] : { isbn13: isbn, title: '', author: '', publisher: '', total_pages: null, cover_url: '', description: '', source: '' };
      // 영속용 — Google 제외(OpenLibrary/LLM 만). books 테이블 영구 적재 대상.
      const persist = await enrichForeignMeta(seed, env, { allowGoogle: false });
      persistItems = persist.title ? [persist] : [];
      // 표시용 — persist 를 재사용해 남은 빈 필드만 Google 로 보강(클라 응답 전용, 저장 안 함).
      const display = await enrichForeignMeta(persist, env);
      if (display.title) items = [display];
    }
    // 검색 도서 자동 저장 (#489) — 알라딘 결과를 백그라운드 비파괴 upsert.
    // normalize가 빈 필드 키를 생략하므로 검색(쪽수 등 누락)이 기존 풍부한 행을 덮지 않음.
    // #1133: ISBN 경로는 Google 제외 persistItems 를 저장(표시행 items 아님), 검색 경로는 items(알라딘).
    if (ctx && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const SB = env.SUPABASE_URL, SRK = env.SUPABASE_SERVICE_ROLE_KEY;
      const toPersist = persistItems || items;
      ctx.waitUntil(Promise.all(toPersist.filter((b) => b.isbn13).map((b) => upsertBook(SB, SRK, b).catch(() => {}))));
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
      // (#1044) 구 #529 의 Google 결과 upsert 는 제거 — Google ToS §5.e 가 영구 DB 캐시를
      // 금지하므로 Google 은 실시간 응답 표시만. 외서 영구 저장 폴백은 OpenLibrary(ISBN 등록 경로).
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
// #1133/#1044 §5.e: opts.allowGoogle=false 면 Google 단계 생략 — Google Books ToS 가 영구 DB 캐시를
// 금지하므로 books 영속 대상 행은 반드시 allowGoogle:false 로 호출(표시 전용 행만 Google 허용).
async function enrichForeignMeta(book, env, opts = {}) {
  const allowGoogle = opts.allowGoogle !== false;
  let b = { ...book };
  const isbn = b.isbn13 || '';
  const needs = () => !b.title || !b.author || !b.publisher || !b.total_pages || !b.cover_url || !b.description;
  if (allowGoogle && isbn && needs()) {
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

// ⚠️ 알라딘 베스트셀러 시드 활성 조건 (#1044) — 국중도·카카오엔 베스트셀러 API 가 없어 이 cron 만
// 알라딘에 남는다(인기 시드 소스 재설계 = P2 별도 이슈). 신규 provider 키가 하나라도 설치되면
// 이전 개시로 간주하고 자동 중지 — 알라딘 데이터의 신규 영구 적재를 멈춘다(ToS 저장 금지).
// BOOKS_PROVIDER='aladin' 명시 시에만 재개(레거시 강제 롤백과 동일 스위치).
const aladinSeedActive = (env) => !!env.ALADIN_TTB_KEY
  && (legacyForced(env) || (!env.KAKAO_REST_KEY && !env.NLK_CERT_KEY));

async function archive(env) {
  if (!aladinSeedActive(env)) return;
  const KEY = env.ALADIN_TTB_KEY, SB = env.SUPABASE_URL, SRK = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB || !SRK) return;
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

/* 쪽수 백필 (#1117·#1044) — total_pages 가 null 인 책을 일일 cron 으로 채운다.
   사용자 검색 경로는 쪽수를 안 주므로(카카오 미제공 · Aladin ItemSearch 는 itemPage 없음) null 로
   남아 화면에서 "/ 1p" 로 보였다 → 유효 isbn13 인 null 책을 보강해 재발 방지. 소스 우선순위(#1044):
   1순위 국중도 PAGE(키 있으면) → 과도기 알라딘 itemPage(레거시 키) → OpenLibrary number_of_pages.
   ⚠️ 구 Google pageCount 영구 PATCH 는 제거 — Google ToS §5.e 영구 캐시 금지(실시간 표시만 허용).
   비-ISBN id 행은 조회 불가라 건너뛴다. */
async function backfillPages(env) {
  const SB = env.SUPABASE_URL, SRK = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB || !SRK) return;
  const cap = parseInt(env.BACKFILL_DAILY_CAP || '300', 10);
  const start = Date.now();
  const sbAuth = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  let rows = [];
  try {
    // null + 신규 우선(created_at desc). cap*2 가져와 13자리 isbn13 만 추림.
    const r = await fetch(`${SB}/rest/v1/books?select=id,isbn13&total_pages=is.null&order=created_at.desc&limit=${cap * 2}`, { headers: sbAuth });
    rows = (await r.json()) || [];
  } catch (e) { return; }
  const todo = rows.filter((b) => /^\d{13}$/.test(b.isbn13 || '')).slice(0, cap);
  let idx = 0;
  const worker = async () => {
    while (idx < todo.length && Date.now() - start < TIME_BUDGET_MS) {
      const b = todo[idx++];
      try {
        // 국중도 PAGE → (과도기) Aladin itemPage → OpenLibrary. Google 은 영구 경로에서 제외(#1044).
        let pages = null;
        if (nlkReady(env)) {
          try {
            const n = await nlkByIsbn(b.isbn13, env);
            if (n && n.total_pages > 1) pages = Number(n.total_pages);
          } catch (e) { /* skip */ }
        }
        if (!pages && !nlkReady(env) && env.ALADIN_TTB_KEY) {
          // 레거시 모드 전용 — 국중도 키 설치(이전 개시) 후엔 알라딘을 더 안 부른다(체인 = 국중도→OpenLibrary).
          const lk = await aladinFetch(`${ALADIN}ItemLookUp.aspx?ttbkey=${env.ALADIN_TTB_KEY}&itemIdType=ISBN13&ItemId=${b.isbn13}&output=js&Version=20131101&OptResult=packing`);
          const ap = lk[0] && lk[0].subInfo && lk[0].subInfo.itemPage;
          if (ap && Number(ap) > 1) pages = Number(ap);
        }
        if (!pages) {
          const ol = await openLibraryByIsbn(b.isbn13);
          const op = ol && ol.total_pages;
          if (op && Number(op) > 1) pages = Number(op);
        }
        if (pages) {
          // total_pages=is.null 가드 — 그 사이 다른 경로가 채웠으면 덮지 않음(멱등).
          await fetch(`${SB}/rest/v1/books?id=eq.${b.id}&total_pages=is.null`, {
            method: 'PATCH',
            headers: { ...sbAuth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ total_pages: pages }),
          });
        }
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
  // #1117: 진짜 ISBN-13(978/979)인 책만 카탈로그에 적재 — Aladin 묶음상품 K-id·ISBN-10·잡 id 차단.
  // 세트("[세트] … 전2권")는 단일 쪽수가 없어 영구 total_pages=null + 검색 노이즈였다. 단일 chokepoint
  // 라 검색·archive·seed 전 경로에 일괄 적용(개별 호출부의 truthy 체크보다 강함).
  if (!/^97[89]\d{10}$/.test(book.isbn13 || '')) return;
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

// ── 책 캐노니컬 upsert (#1191) ─────────────────────────────
// 클라의 옛 books.upsert(직접 RLS write)를 대체 — service_role 로만 쓰는 controlled write.
// 클라의 두-갈래 로직을 그대로 보존해 반환 shape(캐노니컬 books 행 전체 + id)이 동일:
//   ① 유효 ISBN-13(978/979) → 기존 upsertBook(#1117 게이트 + merge-duplicates) 후 행 재조회.
//   ② ISBN-13 없음/무효 → 제목 매칭(있으면 반환), 없으면 삽입(client parity: null isbn 은 충돌 없음).
// 입력 검증·길이 캡으로 오염을 원천 제한(열린 RLS 와 달리 통제된 쓰기).
async function bookUpsertProxy(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const SB = env.SUPABASE_URL, SRK = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB || !SRK) return json({ error: 'supabase unconfigured' }, 503);
  let b = {};
  try { b = await request.json(); } catch (e) {}
  const cap = (v, n) => { const s = (v == null ? '' : String(v)).trim(); return s ? s.slice(0, n) : ''; };
  const title = cap(b.title, 300);
  if (!title) return json({ error: 'title required' }, 400);
  const isbn13 = cap(b.isbn13, 13);
  let total_pages = Number(b.total_pages);
  if (!Number.isFinite(total_pages) || total_pages <= 0 || total_pages > 100000) total_pages = null;
  const book = {
    isbn13: isbn13 || null, title,
    author: cap(b.author, 300) || null,
    publisher: cap(b.publisher, 200) || null,
    total_pages,
    cover_url: cap(b.cover_url, 1000) || null,
  };
  const H = { apikey: SRK, Authorization: `Bearer ${SRK}` };

  // ① 유효 ISBN-13 → 기존 헬퍼로 merge-upsert(#1117 게이트) 후 캐노니컬 행 재조회
  if (/^97[89]\d{10}$/.test(isbn13)) {
    await upsertBook(SB, SRK, book);
    const r = await fetch(`${SB}/rest/v1/books?isbn13=eq.${isbn13}&select=*&limit=1`, { headers: H });
    const rows = await r.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) return json(rows[0]);
    // 게이트에 걸려 미적재된 경우만 아래 삽입 폴백으로
  }

  // ② ISBN-13 없음/무효 → 제목 매칭(client parity)
  {
    const r = await fetch(`${SB}/rest/v1/books?title=eq.${encodeURIComponent(title)}&select=*&limit=1`, { headers: H });
    const rows = await r.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]) return json(rows[0]);
  }
  // 없으면 삽입 — isbn 있으면 merge-duplicates(중복 충돌 무해화), 없으면 순삽입
  const path = book.isbn13 ? '/rest/v1/books?on_conflict=isbn13' : '/rest/v1/books';
  const prefer = book.isbn13 ? 'resolution=merge-duplicates,return=representation' : 'return=representation';
  const ins = await fetch(`${SB}${path}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: prefer },
    body: JSON.stringify(book),
  });
  const created = await ins.json().catch(() => null);
  const row = Array.isArray(created) ? created[0] : created;
  if (!row || !row.id) return json({ error: 'upsert failed' }, 500);
  return json(row);
}

// ── OTA Live Updates (#876) ───────────────────────────────
// 설치 앱(Capgo @capgo/capacitor-updater)이 POST 로 현재 상태를 보내면 채널 매니페스트(KV)와 비교해
// 업데이트면 {version,url,checksum}, 없으면 {} 반환(Capgo 규약: url 생략 = no update).
// custom_id 로 채널(beta|production) 선택. version_code(셸 versionCode)로 minNative 게이트 —
// 구 셸에 새 네이티브 API 쓰는 번들이 내려가 크래시하는 것 방지(spec ota.md §1·§5).
// 번들 바이너리 호스팅은 매니페스트 url 에 위임(R2/GitHub Releases, 페이즈 C). 워커는 매니페스트만 본다.
async function otaCheck(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b = {};
  try { b = await request.json(); } catch (e) {}
  const platform = (b.platform === 'ios' || b.platform === 'electron') ? b.platform : 'android';
  const channel = b.custom_id === 'beta' ? 'beta' : 'production';
  const cur = b.version_name || 'builtin';                       // 현재 깔린 번들 버전
  const nativeCode = parseInt(b.version_code || b.version_build || '0', 10) || 0; // 네이티브 versionCode
  if (!env.OTA_KV) return json({});                              // KV 미바인딩 → no update
  const raw = await env.OTA_KV.get(`ota:${platform}:${channel}`);
  if (!raw) return json({});                                     // 채널 비어있음 → no update
  let m; try { m = JSON.parse(raw); } catch (e) { return json({}); }
  if (!m || !m.version || !m.url) return json({});
  if (m.version === cur) return json({});                        // 이미 최신
  if ((m.minNative || 0) > nativeCode) return json({ message: `min native ${m.minNative} > ${nativeCode}` }); // 구 셸 → 스킵(스토어 업데이트 유도)
  return json({ version: m.version, url: m.url, checksum: m.checksum || '' });
}

function json(obj, status, maxAge) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (maxAge) headers['cache-control'] = `public, max-age=${maxAge}`;
  return new Response(JSON.stringify(obj), { status, headers });
}

// ── per-IP 레이트리밋 (#1158/#1159) — 고비용 LLM/OCR 엔드포인트 남용·키드레인 규모 차단.
//   Origin 체크는 non-브라우저(curl)가 헤더 생략/위조로 우회 가능 → 실비용 상한을 IP·분 단위로 건다.
//   OTA_KV 재사용(새 바인딩 없음, Stack Lock). Turnstile(봇 차단) 게이트는 후속 — 이건 상한선.
//   ponytail: KV 최종일관성이라 창 경계에서 약간 초과 가능·per-key 쓰기비용이 한계.
//     지속 남용 시 Durable Object/네이티브 rate-limit 바인딩으로 격상. 지금은 KV 최소안.
//   fail-open: KV 미바인딩/오류 시 통과(가용성 우선 — 정상 사용자를 막지 않는다).
const RL_LIMITS = {
  seed: 20, ocr: 30, 'extract-highlights': 20, 'shelf-import': 12,
  companion: 40, 'wiki-ask': 40, 'parse-books': 20, related: 40,
  'book-upsert': 30,
};
async function rateLimited(request, env, name) {
  try {
    if (!env.OTA_KV) return null;
    const ip = request.headers.get('CF-Connecting-IP') || 'noip';
    const limit = RL_LIMITS[name] || 30;
    const bucket = Math.floor(Date.now() / 60000);            // 1분 창
    const key = `rl:${name}:${ip}:${bucket}`;
    const cur = parseInt((await env.OTA_KV.get(key)) || '0', 10) || 0;
    if (cur >= limit) return json({ error: 'rate limited', retryAfter: 60 }, 429);
    await env.OTA_KV.put(key, String(cur + 1), { expirationTtl: 120 });
    return null;
  } catch (e) { return null; }   // fail-open
}

/* ── Turnstile 봇 검증 (#1158/#1159) — 레이트리밋 다음 2번째 계층 ─────────────
   staged rollout·fail-open: env.TURNSTILE_SECRET 이 없으면 코드가 있어도 무동작(null 반환)이라
   배포해도 inert. ops 가 secret 을 넣는 순간부터 강제(클라가 토큰 보내는 걸 확인한 뒤). rateLimited 형제.
   siteverify 자체가 죽으면(Cloudflare outage) fail-open 으로 앱을 안 죽인다. */
async function verifyTurnstile(request, env) {
  if (!env.TURNSTILE_SECRET) return null;   // 시크릿 미설정 → fail-open(무동작)
  const token = request.headers.get('cf-turnstile-token') || request.headers.get('x-turnstile-token') || '';
  if (!token) return json({ error: 'turnstile required' }, 403);
  try {
    const body = new URLSearchParams();
    body.set('secret', env.TURNSTILE_SECRET);
    body.set('response', token);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body,
    });
    const d = await r.json();
    if (d.success !== true) return json({ error: 'turnstile failed' }, 403);
    return null;
  } catch (e) { return null; }   // siteverify 네트워크 실패 → fail-open
}
