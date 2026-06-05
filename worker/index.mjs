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
    // 그 외는 정적 에셋(docs/readinggo). 매칭 없으면 ASSETS가 404.
    return env.ASSETS.fetch(request);
  },

  // ── Cron: 인기도서 사전 아카이브 (#239) ──────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(archive(env));
  },
};

/* ── 알라딘 프록시 (aladin.js 포팅) ─────────────────────── */
async function aladinProxy(q, env) {
  const key = env.ALADIN_TTB_KEY;
  if (!key) return json({ error: 'ALADIN_TTB_KEY 미설정' }, 500);
  const isbn = (q.get('isbn') || '').trim();
  const query = (q.get('query') || q.get('q') || '').trim().slice(0, 100);

  let apiUrl;
  if (isbn) {
    if (!/^\d{10,13}$/.test(isbn)) return json({ error: 'isbn 형식 오류' }, 400);
    apiUrl = `${ALADIN}ItemLookUp.aspx?ttbkey=${key}&itemIdType=ISBN13&ItemId=${encodeURIComponent(isbn)}`
      + `&output=js&Version=20131101&Cover=Big&OptResult=packing`;
  } else if (query) {
    const max = Math.min(parseInt(q.get('max'), 10) || 10, 20);
    apiUrl = `${ALADIN}ItemSearch.aspx?ttbkey=${key}&Query=${encodeURIComponent(query)}`
      + `&QueryType=Keyword&SearchTarget=Book&MaxResults=${max}&start=1`
      + `&output=js&Version=20131101&Cover=Big&OptResult=packing`;
  } else {
    return json({ error: 'query 또는 isbn 필요' }, 400);
  }

  try {
    const items = (await aladinFetch(apiUrl)).map(normalize);
    return json({ items }, 200, 86400);
  } catch (e) {
    return json({ error: '알라딘 호출 실패', detail: String((e && e.message) || e) }, 502);
  }
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
