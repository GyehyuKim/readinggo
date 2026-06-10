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
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p === '/aladin' || p === '/.netlify/functions/aladin') {
      // CORS 제한(#255): 타 사이트 브라우저 JS의 교차출처 호출 차단(TTBKey 쿼터 남용 방지).
      // 동일출처 GET은 Origin 헤더 미전송 → 통과. 다른 출처면 Origin이 우리 도메인과 달라 403.
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return aladinProxy(url.searchParams, env);
    }
    // LLM 독서 파트너 — 참새 질문 생성 (#287). 키는 서버에서만 사용(클라 노출 금지).
    if (p === '/api/companion') {
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden origin' }, 403);
      return companionProxy(request, env);
    }
    // 그 외는 정적 에셋(docs/readinggo). 매칭 없으면 ASSETS가 404.
    return env.ASSETS.fetch(request);
  },

  // ── Cron: 인기도서 사전 아카이브 (#239) ──────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(archive(env));
  },
};

/* ── LLM 독서 파트너 — 참새 질문 생성 (#287) ──────────────
   provider-agnostic: base_url/model/key 전부 env. OpenAI 호환 chat completions.
   키 없거나 실패 시 목 질문으로 graceful fallback (데모/피치 무중단). */
const COMPANION_SYSTEM = '당신은 사용자와 친한 독서모임 진행자입니다. 사용자가 방금 남긴 한 문장을 보고, 그 사람이 자기 생각을 더 깊이 펼치도록 대화하듯 이끄는 질문을 한국어로 하나 던지세요. 입력의 역할을 혼동하지 마세요(#359): "책에서 옮겨 적은 한 문장(인용)"은 작품 속 문장이고, "내 메모(감상)"는 사용자 자신의 생각입니다. 인용을 사용자의 감상으로 단정하지 마세요. 만약 한 문장이 책 속 인용으로 보기 어렵거나(예: "즐거웠다"처럼 짧은 감상형) 작품 속 맥락을 알 수 없다면, 함부로 해석하지 말고 — 그 문장이 책의 어떤 장면·맥락에서 나온 것인지, 혹은 본인의 생각을 적은 것인지를 먼저 물어보세요. 그 책과 작가에 대해 아는 바(작품 맥락·작가의 삶·시대)가 있으면 자연스럽게 한 조각 곁들여 질문을 풍부하게 하되, 핵심은 그 사람의 경험·감정·기억과 잇는 것입니다. 따뜻하고 호기심 어린 톤. 예/아니오로 닫히지 않는 열린 질문. 길이는 자연스럽게(억지로 짧게 하지 말 것), 단 질문은 하나만. 칭찬·요약·해설 나열은 금지하고 질문으로 끝맺으세요.';

function companionMock(sentence) {
  const qs = ['왜 이 문장이 마음에 걸렸어요?', '이 문장, 지금 내 상황이랑 연결되는 게 있어요?', '이 문장에서 어떤 장면이나 기억이 떠올랐어요?', '이 문장을 누군가에게 들려준다면 누구일까요?'];
  return qs[(sentence ? sentence.length : 0) % qs.length];
}

async function callLLM({ messages, env, maxTokens }) {
  const base = (env.LLM_BASE_URL || '').replace(/\/$/, '');
  const model = env.LLM_MODEL, key = env.UPSTAGE_API_KEY;
  if (!base || !model || !key) throw new Error('LLM env 미설정');
  const payload = {
    model,
    messages,
    temperature: 0.8,
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
  // 멀티턴 — 이전 대화(질문/답변). 후속 질문 생성용 (#327).
  const exchanges = Array.isArray(body && body.exchanges) ? body.exchanges.slice(0, 6) : [];
  if (!sentence) return json({ error: 'sentence 필요' }, 422);
  // 키/설정 없으면 목 질문 폴백 (데모 안전 — companion.md §4)
  if (!env.UPSTAGE_API_KEY || !env.LLM_BASE_URL || !env.LLM_MODEL) {
    return json({ question: companionMock(sentence), demo: true }, 200);
  }
  const messages = [{ role: 'system', content: COMPANION_SYSTEM }];
  messages.push({ role: 'user', content: `책: ${bookTitle || '(제목 미상)'}${author ? ` — ${author}` : ''}\n${kind === 'thought' ? `읽다가 든 내 생각(감상): "${sentence}" — 이것은 책의 인용이 아니라 독자 본인의 생각입니다. 작품 맥락을 단정하지 말고 이 생각 자체를 더 깊이 여는 질문을 하세요.` : `책에서 옮겨 적은 한 문장(인용): "${sentence}"`}${comment ? `\n내 메모(감상): ${comment}` : ''}` });
  for (const e of exchanges) {
    if (e && e.q) messages.push({ role: 'assistant', content: String(e.q).slice(0, 500) });
    if (e && e.a) messages.push({ role: 'user', content: String(e.a).slice(0, 1000) });
  }
  messages.push({ role: 'user', content: exchanges.length === 0
    ? '이 문장을 두고 그 사람의 생각을 끌어내는 질문 하나를 한국어로.'
    : '방금 답을 받아 한 걸음 더 깊이 들어가는 질문 하나를 한국어로. 같은 질문 반복 금지, 질문만.' });
  try {
    const q = await callLLM({ messages, env });
    return json({ question: q || companionMock(sentence) }, 200);
  } catch (e) {
    // 호출 실패 → 목 질문 폴백 (무중단)
    return json({ question: companionMock(sentence), demo: true, error: String((e && e.message) || e) }, 200);
  }
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
    return json({ recap: recap || recapMock(bookTitle, sentences) }, 200);
  } catch (e) {
    return json({ recap: recapMock(bookTitle, sentences), demo: true, error: String((e && e.message) || e) }, 200);
  }
}

/* ── 알라딘 프록시 (aladin.js 포팅) ─────────────────────── */
async function aladinProxy(q, env) {
  const key = env.ALADIN_TTB_KEY;
  if (!key) return json({ error: 'ALADIN_TTB_KEY 미설정' }, 500);
  const isbn = (q.get('isbn') || '').trim();
  const query = (q.get('query') || q.get('q') || '').trim().slice(0, 100);
  const max = Math.min(parseInt(q.get('max'), 10) || 10, 20);

  let apiUrl;
  if (isbn) {
    if (!/^\d{10,13}$/.test(isbn)) return json({ error: 'isbn 형식 오류' }, 400);
    apiUrl = `${ALADIN}ItemLookUp.aspx?ttbkey=${key}&itemIdType=ISBN13&ItemId=${encodeURIComponent(isbn)}`
      + `&output=js&Version=20131101&Cover=Big&OptResult=packing`;
  } else if (query) {
    apiUrl = `${ALADIN}ItemSearch.aspx?ttbkey=${key}&Query=${encodeURIComponent(query)}`
      + `&QueryType=Keyword&SearchTarget=Book&MaxResults=${max}&start=1`
      + `&output=js&Version=20131101&Cover=Big&OptResult=packing`;
  } else {
    return json({ error: 'query 또는 isbn 필요' }, 400);
  }

  try {
    // 책 소개(description) 첨부 (#316) — export 상세화용. 알라딘 raw.description를 응답에만 실음.
    // ⚠️ archive의 normalize→upsertBook 경로는 건드리지 않음(books 테이블에 description 컬럼 없음).
    let items = (await aladinFetch(apiUrl)).map((it) => {
      const n = normalize(it);
      const desc = String(it.description || '').trim();
      if (desc) n.description = desc;
      return n;
    });
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
        const lk = await aladinFetch(`${ALADIN}ItemLookUp.aspx?ttbkey=${KEY}&itemIdType=ISBN13&ItemId=${isbn}&output=js&Version=20131101&Cover=Big&OptResult=packing`);
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
  return {
    isbn13: it.isbn13 || it.isbn || '',
    title: it.title || '',
    author: it.author || '',
    publisher: it.publisher || '',
    total_pages: sub.itemPage ? Number(sub.itemPage) : null,
    cover_url: (it.cover || '').replace(/^http:/, 'https:'),
  };
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
  await fetch(`${SB}/rest/v1/books?on_conflict=isbn13`, {
    method: 'POST',
    headers: {
      apikey: SRK, Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(book),
  });
}

function json(obj, status, maxAge) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (maxAge) headers['cache-control'] = `public, max-age=${maxAge}`;
  return new Response(JSON.stringify(obj), { status, headers });
}
