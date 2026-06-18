// 수집 오케스트레이션 — server(/collect)·prewarm 공용.
// stored 선조회(레이스 가드) → 예스24 크롤 → seed_sentences 적재 → 시드 반환.
import { crawlYes24 } from './yes24.mjs';
import { seedBookKey, seedRead, seedWrite, seedRefresh, dbConfigured } from './db.mjs';

// 한 권 수집. forceRefresh(#806): 저장분 있어도 재크롤해 교체.
export async function collectBook(managed, { title, author, isbn, forceRefresh = false }, opts = {}) {
  const log = opts.log || (() => {});
  const t = String(title || '').trim();
  if (!t) return { seeds: [], status: 'bad-input', stored: false };
  const bookKey = seedBookKey(t, isbn);

  // 1) 저장분 먼저(영속). 워커가 선조회하지만 collector 도 레이스 가드로 재확인.
  if (dbConfigured() && !forceRefresh) {
    const stored = await seedRead(bookKey);
    if (stored.length) { log(`  stored hit (${stored.length}): ${t}`); return { seeds: stored, status: 'stored', stored: true }; }
  }

  // 2) 크롤.
  const res = await crawlYes24(managed, { title: t, author, isbn }, { log });
  if (!res.seeds.length) return { seeds: [], status: res.status, stored: false };

  // 3) 적재(service role). forceRefresh 면 교체, 아니면 append(중복 url 무시).
  if (dbConfigured()) {
    if (forceRefresh) await seedRefresh(bookKey, res.seeds);
    else await seedWrite(bookKey, res.seeds);
  }
  return { seeds: res.seeds, status: 'ok', productUrl: res.productUrl, stored: false };
}
