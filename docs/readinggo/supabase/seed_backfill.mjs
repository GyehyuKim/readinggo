/* =====================================================================
   ReadingGo — 마중물 시드 전 책 백필 (#774)

   Supabase `books` 카탈로그를 순회하며 각 책에 /api/seed 를 호출해
   seed_sentences 를 채워둔다(책당 최대 10개). 한 번 채우면 영속 →
   유저가 책을 열 때 즉시 표시(lazy 지연 제거). 재실행 idempotent
   (이미 10개면 /api/seed 가 네이버·LLM 재호출 없이 저장분만 반환).

   .env 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   사용법:
     node docs/readinggo/supabase/seed_backfill.mjs                # prod 대상
     node docs/readinggo/supabase/seed_backfill.mjs <baseUrl>      # 프리뷰 등
     node docs/readinggo/supabase/seed_backfill.mjs <baseUrl> 50   # 앞 50권만(테스트)
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(here, '../../../.env');
function loadEnv(p) {
  const out = {};
  let txt = '';
  try { txt = readFileSync(p, 'utf8'); } catch { return out; }
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}
const env = loadEnv(ENV_PATH);
const SB = process.env.SUPABASE_URL || env.SUPABASE_URL || '';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
const BASE = (process.argv[2] || 'https://readinggo.hyuniverse.workers.dev').replace(/\/$/, '');
const LIMIT = parseInt(process.argv[3], 10) || 0;   // 0 = 전체
const CONCURRENCY = 4;

if (!SB || !SRK) { console.error('✘ .env 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(2); }

async function fetchBooks() {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(`${SB}/rest/v1/books?select=isbn13,title,author&order=title&limit=${PAGE}&offset=${from}`, {
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
    });
    if (!r.ok) throw new Error('books 조회 실패 HTTP ' + r.status);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function seedOne(b) {
  try {
    const r = await fetch(`${BASE}/api/seed`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: b.title, author: b.author || '', isbn: b.isbn13 || '', have: 0 }),
    });
    const d = await r.json().catch(() => ({}));
    return (d && Array.isArray(d.seeds)) ? d.seeds.length : 0;
  } catch (e) { return -1; }
}

(async () => {
  let books = await fetchBooks();
  if (LIMIT) books = books.slice(0, LIMIT);
  console.log(`[backfill] 대상 ${books.length}권 · base ${BASE} · 동시성 ${CONCURRENCY}`);
  let done = 0, withSeeds = 0, totalSeeds = 0, fails = 0;
  // 단순 동시성 풀.
  let idx = 0;
  async function worker() {
    while (idx < books.length) {
      const b = books[idx++];
      const n = await seedOne(b);
      done++;
      if (n > 0) { withSeeds++; totalSeeds += n; }
      if (n < 0) fails++;
      if (done % 20 === 0 || done === books.length) {
        console.log(`  ${done}/${books.length} · 시드보유 ${withSeeds}권 · 누적 ${totalSeeds}개 · 실패 ${fails}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[backfill] 완료 — ${withSeeds}/${books.length}권에 시드(${totalSeeds}개), 실패 ${fails}`);
})();
