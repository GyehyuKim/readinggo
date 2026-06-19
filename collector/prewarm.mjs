// 배치 prewarm (spec 큐 방식, 1번 요구) — 인기 카탈로그책을 seed_queue 에 low 우선순위로 큐잉.
//   실제 크롤은 poller 가 한가할 때(high=온디맨드 처리 후) 소진 → 인기책은 유저 도착 전 미리 채워짐.
//   크롤 안 함(브라우저 불필요) — 큐잉만. 재실행 안전(book_key unique, ignore-duplicates).
//
// 사용: node prewarm.mjs [limit]     예: node prewarm.mjs 150
import { popularBooks, seedBookKey, dbConfigured } from './lib/db.mjs';
import { enqueue } from './lib/queue.mjs';
import { env } from './lib/env.mjs';

const LIMIT = parseInt(process.argv[2] || env('PREWARM_LIMIT', '150'), 10);
const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!dbConfigured()) { console.error('✘ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요(collector/.env)'); process.exit(2); }

const books = await popularBooks(LIMIT);
log(`prewarm: 인기책 ${books.length}권 큐잉(low)`);
let queued = 0;
for (const b of books) {
  const ok = await enqueue({
    bookKey: seedBookKey(b.title, b.isbn13), title: b.title, author: b.author, isbn: b.isbn13, priority: 'low',
  });
  if (ok) queued++;
}
log(`done: ${queued}건 큐잉 시도(이미 큐/완료분은 무시됨)`);
