/* =========================================================
   ReadingGo — Netlify Scheduled Function: 인기도서 사전 아카이브 (#239)
   일 1회: 알라딘 베스트셀러 → ItemLookUp(쪽수 포함) → Supabase books upsert.
   목적: 등록 시 지연 0 + 알라딘 의존 감소(자체 books DB 축적).

   env (Netlify, 서버 전용 — 클라 노출 금지):
     ALADIN_TTB_KEY              (기존)
     SUPABASE_URL                (예: https://<ref>.supabase.co)
     SUPABASE_SERVICE_ROLE_KEY   (service_role — RLS 우회 upsert)
     ARCHIVE_DAILY_CAP           (선택, 기본 3000)
   미설정 시 no-op(skip).

   ⚠️ 미검증: 키·네트워크가 있어야 동작. 첫 배포 후 `netlify functions:invoke archive-books`
      또는 스케줄 1회로 결과(JSON: collected/candidates/archived) 확인 권장.
   ⚠️ Netlify 스케줄 함수 실행시간 제한 → TIME_BUDGET_MS 내에서만 처리하고 매일 누적
      (이미 있는 isbn 은 건너뛰므로 며칠에 걸쳐 인기권이 채워진다).
   ========================================================= */

const ALADIN = 'http://www.aladin.co.kr/ttb/api/';
// CategoryId: 0 전체 · 1 소설/시 · 798 경제경영 · 336 자기계발 · 656 인문학 · 987 과학 · 55889 에세이 · 74 역사
const CATEGORIES = [0, 1, 798, 336, 656, 987, 55889, 74];
const CONCURRENCY = 8;
const TIME_BUDGET_MS = 24000;

export const config = { schedule: '@daily' };

export default async () => {
  const KEY = process.env.ALADIN_TTB_KEY;
  const SB = process.env.SUPABASE_URL;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY || !SB || !SRK) {
    return json({ skipped: 'env 미설정 (ALADIN_TTB_KEY/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)' });
  }
  const cap = parseInt(process.env.ARCHIVE_DAILY_CAP || '3000', 10);
  const start = Date.now();

  // 1) 베스트셀러에서 ISBN 수집 (카테고리 × 페이지)
  const isbns = new Set();
  for (const cat of CATEGORIES) {
    for (let s = 1; s <= 4; s++) {
      try {
        const items = await aladin(`${ALADIN}ItemList.aspx?ttbkey=${KEY}&QueryType=Bestseller&SearchTarget=Book&MaxResults=50&start=${s}&CategoryId=${cat}&output=js&Version=20131101`);
        for (const it of items) { const i = it.isbn13 || it.isbn; if (i && /^\d{13}$/.test(i)) isbns.add(i); }
      } catch (e) { /* 개별 리스트 실패 무시 */ }
      if (isbns.size >= cap * 2) break;
    }
    if (isbns.size >= cap * 2) break;
  }

  // 2) 이미 아카이브된 isbn 제외 (쿼터 절약)
  const have = await existingIsbns(SB, SRK, [...isbns]);
  const todo = [...isbns].filter((i) => !have.has(i)).slice(0, cap);

  // 3) 시간예산 내에서 ItemLookUp → upsert (동시성 풀)
  let archived = 0, idx = 0;
  const worker = async () => {
    while (idx < todo.length && Date.now() - start < TIME_BUDGET_MS) {
      const isbn = todo[idx++];
      try {
        const lk = await aladin(`${ALADIN}ItemLookUp.aspx?ttbkey=${KEY}&itemIdType=ISBN13&ItemId=${isbn}&output=js&Version=20131101&Cover=Big&OptResult=packing`);
        const it = lk[0];
        if (it) { await upsert(SB, SRK, normalize(it)); archived++; }
      } catch (e) { /* 개별 실패 무시 */ }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return json({ collected: isbns.size, candidates: todo.length, archived, ms: Date.now() - start });
};

// output=js 는 JSON 이지만 앞뒤 콜백/BOM 가능 → 첫 '{'~마지막 '}' 파싱 (aladin.js 와 동일)
async function aladin(url) {
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

// Supabase PostgREST 로 기존 isbn 조회 (service_role, 200개씩 청크)
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
    } catch (e) { /* 조회 실패 시 중복 허용(merge-duplicates 라 안전) */ }
  }
  return have;
}

// books upsert (isbn13 충돌 시 병합). service_role 라 RLS 우회.
async function upsert(SB, SRK, book) {
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

function json(obj) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
}
