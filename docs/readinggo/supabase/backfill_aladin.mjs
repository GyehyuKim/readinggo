/* =====================================================================
   ReadingGo — backfill_aladin.mjs (#528)
   기존 books 중 cover_url/description 이 빈 행을, 배포된 워커 /aladin?isbn=
   프록시(ItemLookUp, TTB키는 워커 보관)로 재조회해 **비파괴 보강**한다.
   빈 필드만 채우고 기존 값은 덮지 않는다. service_role 로 PATCH.

   .env 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   사용:
     node backfill_aladin.mjs --dry            # 무변경, 무엇이 바뀔지 출력
     node backfill_aladin.mjs --limit=5        # 5건만 실제 적용
     node backfill_aladin.mjs                  # 전체 적용
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
function loadEnv(p) { const out = {}; let t = ''; try { t = readFileSync(p, 'utf8'); } catch { return out; } for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i < 0) continue; out[l.slice(0, i).trim()] = l.slice(i + 1).trim(); } return out; }
const env = loadEnv(resolve(here, '../../../.env'));
const SB = process.env.SUPABASE_URL || env.SUPABASE_URL || '';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
const PROXY = 'https://readinggo.hyuniverse.workers.dev/aladin';
const DRY = process.argv.includes('--dry');
const limArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limArg ? parseInt(limArg.split('=')[1], 10) : Infinity;
const headers = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTargets() {
  const u = `${SB}/rest/v1/books?select=id,title,isbn13,cover_url,description,author,publisher,total_pages&isbn13=not.is.null&order=id`;
  const r = await fetch(u, { headers });
  if (!r.ok) throw new Error(`targets ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const rows = await r.json();
  return rows.filter((b) => b.isbn13 && (!b.cover_url || !b.description));
}
async function lookup(isbn) {
  try { const r = await fetch(`${PROXY}?isbn=${encodeURIComponent(isbn)}`); if (!r.ok) return null; const d = await r.json(); return (d.items && d.items[0]) || null; } catch { return null; }
}
async function patchBook(id, body) {
  const r = await fetch(`${SB}/rest/v1/books?id=eq.${id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  return r.ok;
}

(async () => {
  if (!SB || !SRK) { console.error('❌ SUPABASE_URL / SERVICE_ROLE_KEY 누락(.env)'); process.exit(1); }
  const all = await fetchTargets();
  const targets = Number.isFinite(LIMIT) ? all.slice(0, LIMIT) : all;
  console.log(`대상 ${all.length}건 중 ${targets.length}건 처리 ${DRY ? '(DRY — 무변경)' : ''}`);
  let updated = 0, skipped = 0, err = 0, n = 0;
  for (const b of targets) {
    n++;
    const it = await lookup(b.isbn13);
    await sleep(300); // 알라딘 쿼터 배려
    if (!it) { skipped++; continue; }
    const patch = {};
    if (!b.cover_url && it.cover_url) patch.cover_url = it.cover_url;
    if (!b.description && it.description) patch.description = it.description;
    if (!b.author && it.author) patch.author = it.author;
    if (!b.publisher && it.publisher) patch.publisher = it.publisher;
    if ((!b.total_pages || b.total_pages === 0) && it.total_pages) patch.total_pages = it.total_pages;
    if (Object.keys(patch).length === 0) { skipped++; continue; }
    if (DRY) { console.log(`[DRY] ${b.title || b.isbn13} ← ${Object.keys(patch).join(', ')}`); updated++; continue; }
    const ok = await patchBook(b.id, patch);
    if (ok) updated++; else { err++; console.warn(`  ✗ ${b.title || b.isbn13}`); }
    if (n % 25 === 0) console.log(`  ...${n}/${targets.length} (updated ${updated}, skip ${skipped}, err ${err})`);
  }
  console.log(`✅ 완료: updated ${updated}, skipped ${skipped}, err ${err}`);
})().catch((e) => { console.error('실패:', e.message || e); process.exit(1); });
