// collector 폴링 데몬 (spec seed-collector.md 큐 방식) — 맥미니 상시.
//   seed_queue 를 주기 폴링(아웃바운드만, 인바운드 0) → 예스24 크롤 → 멀티NPC sentences 적재 → status 전이.
//   브라우저 1개 순차, 책 사이 딜레이(예의). launchd 로 부팅 자동 실행 + 죽으면 재기동.
//
// 사용: node poller.mjs        (collector/.env 또는 repo 루트 .env 필요)
import { createBrowser } from './lib/browser.mjs';
import { crawlYes24 } from './lib/yes24.mjs';
import { writeSeedsAsNpc } from './lib/npc.mjs';
import { fetchPending, markDone, markFailed } from './lib/queue.mjs';
import { dbConfigured } from './lib/db.mjs';
import { env } from './lib/env.mjs';

const POLL_INTERVAL_MS = parseInt(env('POLL_INTERVAL_MS', '5000'), 10);   // 큐 폴링 간격
const BOOK_DELAY_MS = parseInt(env('COLLECTOR_DELAY_MS', '2500'), 10);    // 책 사이 딜레이(spec §7)
const BATCH = parseInt(env('POLL_BATCH', '3'), 10);                       // 한 폴에 처리할 책 수
const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!dbConfigured()) { console.error('✘ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요(collector/.env)'); process.exit(2); }

let managed = null;
let stopping = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 영구 실패(yes24 미커버) vs 일시 실패(차단·타임아웃) 구분.
const PERMANENT = new Set(['not-found', 'no-excerpt']);
const MAX_FORCE = 99; // markFailed 에 큰 attempts 를 넘겨 즉시 failed 처리(재시도 무의미한 영구 실패용).

async function processOne(job) {
  let res;
  try {
    res = await crawlYes24(managed, { title: job.title, author: job.author, isbn: job.isbn }, { log });
  } catch (e) {
    const st = await markFailed(job.id, job.attempts, e.message);
    log(`  crawl error → ${st} (attempt ${job.attempts + 1}): ${job.title}`);
    return;
  }
  if (res.status === 'ok' && res.seeds.length) {
    try {
      await writeSeedsAsNpc({ title: job.title, author: job.author, isbn: job.isbn }, res.seeds, { log });
      await markDone(job.id);
    } catch (e) {
      const st = await markFailed(job.id, job.attempts, 'npc write: ' + e.message);
      log(`  npc write 실패 → ${st}: ${job.title}`);
    }
    return;
  }
  // 크롤 결과 없음.
  if (PERMANENT.has(res.status)) {
    await markFailed(job.id, MAX_FORCE, res.status);  // 즉시 failed (재시도 무의미)
    log(`  ${res.status} → failed(영구): ${job.title}`);
  } else {
    const st = await markFailed(job.id, job.attempts, res.status); // blocked/timeout → 재시도
    log(`  ${res.status} → ${st}: ${job.title}`);
    if (res.status === 'blocked') await sleep(30000); // 차단 백오프
  }
}

async function loop() {
  managed = await createBrowser();
  log(`poller 시작 — interval ${POLL_INTERVAL_MS}ms, batch ${BATCH}, book delay ${BOOK_DELAY_MS}ms`);
  while (!stopping) {
    let jobs = [];
    try { jobs = await fetchPending(BATCH); } catch (e) { log('fetchPending 오류:', e.message); }
    if (!jobs.length) { await sleep(POLL_INTERVAL_MS); continue; }
    log(`pending ${jobs.length}건 처리`);
    for (const job of jobs) {
      if (stopping) break;
      await processOne(job);
      await sleep(BOOK_DELAY_MS);
    }
  }
}

async function shutdown() {
  log('shutting down…');
  stopping = true;
  if (managed) await managed.close().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

loop().catch((e) => { console.error('poller fatal:', e); process.exit(1); });
