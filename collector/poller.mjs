// collector 폴링 데몬 (spec seed-collector.md 큐 방식) — 맥미니 상시.
//   seed_queue 를 주기 폴링(아웃바운드만, 인바운드 0) → 예스24 크롤 → 멀티NPC sentences 적재 → status 전이.
//   브라우저 1개 순차, 책 사이 딜레이(예의). launchd 로 부팅 자동 실행 + 죽으면 재기동.
//
// 사용: node poller.mjs        (collector/.env 또는 repo 루트 .env 필요)
import { crawlYes24 } from './lib/yes24.mjs';
import { writeSeedsAsNpc } from './lib/npc.mjs';
import { fetchPending, markDone, markFailed } from './lib/queue.mjs';
import { dbConfigured } from './lib/db.mjs';
import { env } from './lib/env.mjs';
import { pathToFileURL } from 'node:url';

const POLL_INTERVAL_MS = parseInt(env('POLL_INTERVAL_MS', '5000'), 10);   // 큐 폴링 간격
const BATCH_DELAY_MS = parseInt(env('COLLECTOR_DELAY_MS', '1000'), 10);   // 배치 사이 딜레이
const BATCH = parseInt(env('POLL_BATCH', '1'), 10);                       // 동시 크롤 수(기본 1=순차, 브라우저 컨텍스트 경합·차단 방지 — spec §5/§7)
const log = (...a) => console.log(new Date().toISOString(), ...a);

let managed = null;
let stopping = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 영구 실패(yes24 미커버) vs 일시 실패(차단·타임아웃) 구분.
const PERMANENT = new Set(['not-found', 'no-excerpt', 'unverified-book', 'isbn-mismatch']);
const MAX_FORCE = 99; // markFailed 에 큰 attempts 를 넘겨 즉시 failed 처리(재시도 무의미한 영구 실패용).

export async function processOne(job, deps = {}) {
  const crawl = deps.crawlYes24 || crawlYes24;
  const write = deps.writeSeedsAsNpc || writeSeedsAsNpc;
  const done = deps.markDone || markDone;
  const failed = deps.markFailed || markFailed;
  const logger = deps.log || log;
  const browser = deps.managed || managed;
  let res;
  try {
    res = await crawl(browser, { title: job.title, author: job.author, isbn: job.isbn }, { log: logger });
  } catch (e) {
    const st = await failed(job.id, job.attempts, e.message);
    logger(`  crawl error → ${st} (attempt ${job.attempts + 1}): ${job.title}`);
    return;
  }
  if (res.status === 'ok' && res.seeds.length) {
    try {
      const persisted = await write({ title: job.title, author: job.author, isbn: job.isbn }, res.seeds, { log: logger });
      if (persisted.outcome === 'written' || persisted.outcome === 'already-exists') {
        await done(job.id);
      } else if (persisted.outcome === 'rejected') {
        await failed(job.id, MAX_FORCE, persisted.reason || 'persistence-rejected');
      } else {
        const st = await failed(job.id, job.attempts, `npc write: ${persisted.reason || 'zero-persisted'}`);
        logger(`  npc write 0건 → ${st}: ${job.title}`);
      }
    } catch (e) {
      const st = await failed(job.id, job.attempts, 'npc write: ' + e.message);
      logger(`  npc write 실패 → ${st}: ${job.title}`);
    }
    return;
  }
  // 크롤 결과 없음.
  if (PERMANENT.has(res.status)) {
    await failed(job.id, MAX_FORCE, res.status);  // 즉시 failed (재시도 무의미)
    logger(`  ${res.status} → failed(영구): ${job.title}`);
  } else {
    const st = await failed(job.id, job.attempts, res.status); // blocked/timeout → 재시도
    logger(`  ${res.status} → ${st}: ${job.title}`);
    if (res.status === 'blocked') await sleep(30000); // 차단 백오프
  }
}

async function loop() {
  if (!dbConfigured()) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요(collector/.env)');
  const { createBrowser } = await import('./lib/browser.mjs');
  managed = await createBrowser();
  log(`poller 시작 — interval ${POLL_INTERVAL_MS}ms, 동시성 ${BATCH}, batch delay ${BATCH_DELAY_MS}ms`);
  while (!stopping) {
    let jobs = [];
    try { jobs = await fetchPending(BATCH); } catch (e) { log('fetchPending 오류:', e.message); await sleep(POLL_INTERVAL_MS); continue; }
    if (!jobs.length) { await sleep(POLL_INTERVAL_MS); continue; }
    log(`pending ${jobs.length}건 병렬 처리(동시성 ${BATCH})`);
    await Promise.all(jobs.map((job) => processOne(job).catch((e) => log('processOne 오류:', e.message))));
    if (!stopping) await sleep(BATCH_DELAY_MS);
  }
}

async function shutdown() {
  log('shutting down…');
  stopping = true;
  if (managed) await managed.close().catch(() => {});
  process.exit(0);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  loop().catch((e) => { console.error('poller fatal:', e); process.exit(1); });
}
