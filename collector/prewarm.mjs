// 주기 배치 (spec §3.2, #806) — launchd 가 매일 새벽 호출.
//   인기책 N권(books.sales_point desc) 선충전 + TTL 만료분 재크롤(트렌드 갱신).
//   idempotent: 이미 충전된 책은 stored hit 으로 크롤 0(쿼터·차단 안전).
//   느긋하게: 책 간 딜레이 + 일일 재크롤 캡(spec §7).
//
// 사용: node prewarm.mjs [limit]     예: node prewarm.mjs 150
import { createBrowser } from './lib/browser.mjs';
import { collectBook } from './lib/collect.mjs';
import { popularBooks, seedBookKey, seedLatestAt, ttlExpired, dbConfigured } from './lib/db.mjs';
import { env } from './lib/env.mjs';

const LIMIT = parseInt(process.argv[2] || env('PREWARM_LIMIT', '150'), 10);
const DELAY_MS = parseInt(env('PREWARM_DELAY_MS', '3000'), 10);   // 책 간 딜레이(새벽·소량)
const REFRESH_CAP = parseInt(env('PREWARM_REFRESH_CAP', '20'), 10); // #806 일일 재크롤 상한
const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!dbConfigured()) { console.error('✘ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요(collector/.env)'); process.exit(2); }

const books = await popularBooks(LIMIT);
log(`prewarm: ${books.length} books (limit ${LIMIT}), refresh cap ${REFRESH_CAP}`);
if (!books.length) { log('no books — books.sales_point 비었거나 DB 미구성'); process.exit(0); }

const mb = await createBrowser();
let filled = 0, refreshed = 0, skipped = 0, empty = 0, blocked = 0;
try {
  for (const b of books) {
    // TTL 만료 인기책만 재크롤(일일 캡 안에서). 캡 초과 시 일반 수집(stored hit 으로 스킵).
    let force = false;
    if (refreshed < REFRESH_CAP) {
      const latest = await seedLatestAt(seedBookKey(b.title, b.isbn13));
      if (latest && ttlExpired(latest)) force = true;
    }
    const r = await collectBook(mb, { title: b.title, author: b.author, isbn: b.isbn13, forceRefresh: force }, { log });
    if (r.status === 'stored') skipped++;
    else if (r.status === 'ok' && force) { refreshed++; }
    else if (r.status === 'ok') filled++;
    else if (r.status === 'blocked') { blocked++; log('  blocked — 백오프'); await new Promise((res) => setTimeout(res, 30000)); }
    else empty++;
    await new Promise((res) => setTimeout(res, DELAY_MS));
  }
} finally {
  await mb.close();
}
log(`done: filled=${filled} refreshed=${refreshed} skipped=${skipped} empty=${empty} blocked=${blocked}`);
