#!/usr/bin/env node
/* 일회성 백필 (#1117) — books.total_pages 가 null 인 책을 Aladin ItemLookUp(subInfo.itemPage)으로 채운다.
 * 원인: 사용자 검색은 Aladin ItemSearch 로 들어와 itemPage 가 없어 null. ItemLookUp(단건)만 쪽수를 준다.
 * 멱등: total_pages=is.null 인 행만 조회·PATCH. 재실행 안전. 유효 isbn13(13자리)만 조회.
 * env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALADIN_TTB_KEY  (collector/.env)
 * 옵션 env: BACKFILL_LIMIT(테스트용 상한), BACKFILL_CONC(동시성, 기본 3), BACKFILL_DELAY(ms, 기본 150)
 */
const SB = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KEY = process.env.ALADIN_TTB_KEY;
if (!SB || !SRK || !KEY) { console.error('env 누락 (SUPABASE_URL / SERVICE_ROLE_KEY / ALADIN_TTB_KEY)'); process.exit(1); }

const LIMIT = parseInt(process.env.BACKFILL_LIMIT || '0', 10) || 0;   // 0 = 전체
const CONC = parseInt(process.env.BACKFILL_CONC || '3', 10);
const DELAY = parseInt(process.env.BACKFILL_DELAY || '150', 10);
const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchNullBooks() {
  const out = [];
  let from = 0; const page = 1000;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/books?select=id,isbn13&total_pages=is.null&order=created_at.asc&limit=${page}&offset=${from}`, { headers: H });
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) break;
    out.push(...rows);
    if (rows.length < page) break;
    from += page;
  }
  return out;
}

async function aladinPage(isbn) {
  const url = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${KEY}&itemIdType=ISBN13&ItemId=${isbn}&output=js&Version=20131101&OptResult=packing`;
  const r = await fetch(url);
  const t = (await r.text()).trim().replace(/;\s*$/, '');
  let d;
  try { d = JSON.parse(t); }
  catch { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return null; d = JSON.parse(t.slice(a, b + 1)); }
  const it = (d.item || [])[0];
  const p = it && it.subInfo && it.subInfo.itemPage;
  return p ? Number(p) : null;
}

async function patchPages(id, pages) {
  // total_pages=is.null 가드 — 그 사이 다른 경로가 채웠으면 덮지 않음(멱등).
  const r = await fetch(`${SB}/rest/v1/books?id=eq.${id}&total_pages=is.null`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ total_pages: pages }),
  });
  return r.ok;
}

(async () => {
  const all = await fetchNullBooks();
  let valid = all.filter((b) => /^\d{13}$/.test(b.isbn13 || ''));
  if (LIMIT) valid = valid.slice(0, LIMIT);
  console.log(`[backfill] null total_pages: ${all.length}, 유효 isbn13: ${valid.length}${LIMIT ? ` (LIMIT ${LIMIT})` : ''}, conc ${CONC}, delay ${DELAY}ms`);
  let filled = 0, nopage = 0, err = 0, done = 0;
  let idx = 0;
  async function worker() {
    while (idx < valid.length) {
      const b = valid[idx++];
      try {
        const p = await aladinPage(b.isbn13);
        if (p && p > 1) { if (await patchPages(b.id, p)) filled++; else err++; }
        else nopage++;
      } catch (e) { err++; }
      done++;
      if (done % 50 === 0) console.log(`  진행 ${done}/${valid.length} — 채움 ${filled}, 쪽수없음 ${nopage}, 오류 ${err}`);
      await sleep(DELAY);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log(`[backfill] 완료 — 채움 ${filled}, 쪽수없음 ${nopage}, 오류 ${err} / 유효 ${valid.length} (전체 null ${all.length})`);
})();
