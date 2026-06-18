// collector 데몬 (spec §5) — Node 내장 http + Playwright.
//   POST /collect  { title, author, isbn }   헤더 Authorization: Bearer <COLLECTOR_TOKEN>
//     → 토큰 검증 → 큐(직렬, 동시 크롤 금지) → 예스24 크롤 → seed_sentences 적재 → { seeds, status }
//   GET  /health   → { ok, queued, configured }  (터널/모니터링용, 토큰 불필요)
//
// 직렬화: 브라우저 1개를 단일 큐로 순차 처리(spec §5·§7 동시성 1). 요청 간 딜레이로 예의.
import { createServer } from 'node:http';
import { createBrowser } from './lib/browser.mjs';
import { collectBook } from './lib/collect.mjs';
import { dbConfigured } from './lib/db.mjs';
import { env, requireEnv } from './lib/env.mjs';

const PORT = parseInt(env('COLLECTOR_PORT', '8787'), 10);
const TOKEN = requireEnv('COLLECTOR_TOKEN');
const REQUEST_DELAY_MS = parseInt(env('COLLECTOR_DELAY_MS', '2500'), 10); // spec §7: 요청 간 2~3초
const PER_BOOK_TIMEOUT_MS = parseInt(env('COLLECTOR_TIMEOUT_MS', '45000'), 10);

const log = (...a) => console.log(new Date().toISOString(), ...a);

let managed = null;          // ManagedBrowser (lazy 시작)
const queue = [];            // 직렬 작업 큐
let draining = false;

async function ensureBrowser() {
  if (!managed) { log('launching headless chromium…'); managed = await createBrowser(); }
  return managed;
}

function withTimeout(promise, ms, onTimeout) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(onTimeout()), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(onTimeout()); });
  });
}

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      const mb = await ensureBrowser();
      const result = await withTimeout(
        collectBook(mb, job.body, { log }),
        PER_BOOK_TIMEOUT_MS,
        () => ({ seeds: [], status: 'timeout', stored: false }),
      );
      job.resolve(result);
    } catch (e) {
      log('collect error:', e.message);
      job.resolve({ seeds: [], status: 'error', stored: false });
    }
    if (queue.length) await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS)); // 예의 딜레이
  }
  draining = false;
}

function enqueue(body) {
  return new Promise((resolve) => { queue.push({ body, resolve }); drain(); });
}

function send(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
}

function readJson(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => { buf += c; if (buf.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, queued: queue.length, configured: dbConfigured() });
  }
  if (url.pathname !== '/collect') return send(res, 404, { error: 'not found' });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  // 토큰 검증 — 워커만 호출 허용(spec §6).
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });

  const body = await readJson(req);
  if (!body || !String(body.title || '').trim()) return send(res, 400, { error: 'title required' });

  log(`/collect ${body.title} (${body.author || '?'}) isbn=${body.isbn || '-'} queued=${queue.length}`);
  const result = await enqueue({ title: body.title, author: body.author, isbn: body.isbn, forceRefresh: !!body.forceRefresh });
  return send(res, 200, { seeds: result.seeds, status: result.status });
});

server.listen(PORT, '127.0.0.1', () => log(`collector listening on http://127.0.0.1:${PORT} (db=${dbConfigured() ? 'on' : 'OFF'})`));

async function shutdown() {
  log('shutting down…');
  server.close();
  if (managed) await managed.close().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
