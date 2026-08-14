// 크롤한 책 발췌를 "여러 NPC" 명의의 sentences 로 적재 (사용자 결정: 멀티NPC 분산).
//   - byBook 피드(sentences ⋈ user_books.book_id ⋈ users)에 아바타와 함께 노출됨.
//   - kind='quote' → "독자가 옮긴 인용"으로 정직(원작자인 척 아님).
//   - seed_sentences 는 원장(중복판정·출처·권리자 takedown)으로 병행 기록.
//
// book_id 는 canonical books.isbn13(UUID FK) 로만 해석. 카탈로그를 생성/보강하지 않는다.
import { env } from './env.mjs';
import { seedBookKey, seedWrite, dbConfigured } from './db.mjs';

const SB = () => env('SUPABASE_URL');
const SRK = () => env('SUPABASE_SERVICE_ROLE_KEY');
const H = (extra = {}) => ({ apikey: SRK(), Authorization: `Bearer ${SRK()}`, ...extra });
const onlyDigitsX = (s) => String(s || '').replace(/[^0-9Xx]/g, '');

let _npcCache = null;
// NPC 계정 풀(id 목록). 1회 로드 후 캐시.
async function npcPool() {
  if (_npcCache) return _npcCache;
  const r = await fetch(`${SB()}/rest/v1/users?select=id&is_npc=is.true`, { headers: H() });
  _npcCache = r.ok ? (await r.json()).map((u) => u.id) : [];
  return _npcCache;
}

const normTitle = (s) => String(s || '').toLowerCase().replace(/[\s·,.:;!?'"“”‘’()\[\]<>「」『』、~\-_]/g, '').trim();

// 검증된 ISBN-13 + 제목이 canonical books 행과 모두 일치해야 한다(#1431).
async function resolveBookId({ title, author, isbn }) {
  const isbn13 = onlyDigitsX(isbn);
  if (!/^97[89]\d{10}$/.test(isbn13) || !normTitle(title)) return null;
  const u = `${SB()}/rest/v1/books?select=id,isbn13,title,author&isbn13=eq.${isbn13}&limit=1`;
  const r = await fetch(u, { headers: H() });
  if (!r.ok) return null;
  const rows = await r.json();
  const book = rows && rows[0];
  if (book && normTitle(book.title) === normTitle(title)) return book.id;
  return null;
}

// NPC 의 user_book 확보(merge upsert) → user_book_id.
async function ensureUserBook(npcId, bookId) {
  const r = await fetch(`${SB()}/rest/v1/user_books?on_conflict=user_id,book_id`, {
    method: 'POST',
    headers: H({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify({ user_id: npcId, book_id: bookId, status: 'completed' }),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] ? rows[0].id : null;
}

// 이 book_id 에 이미 존재하는 sentences 텍스트(정규화) 집합 — 중복 NPC 문장 방지.
async function existingSentenceTexts(bookId) {
  const u = `${SB()}/rest/v1/sentences?select=text,user_book:user_books!inner(book_id)&user_book.book_id=eq.${bookId}&limit=200`;
  const r = await fetch(u, { headers: H() });
  if (!r.ok) return new Set();
  const rows = await r.json();
  return new Set((rows || []).map((x) => String(x.text || '').replace(/\s+/g, '').trim()));
}

async function insertSentence(npcId, userBookId, text) {
  const r = await fetch(`${SB()}/rest/v1/sentences`, {
    method: 'POST', headers: H({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ user_id: npcId, user_book_id: userBookId, text, kind: 'quote', page: null }),
  });
  return r.ok;
}

// Fisher-Yates 부분 셔플로 distinct NPC n명 추출(인덱스 i 로 변주 — Math.random 회피 불필요, 그냥 random 사용 가능).
function pickDistinct(pool, n) {
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.min(n, a.length));
}

// 발췌 배열을 멀티NPC sentences + seed_sentences 원장으로 적재.
//   반환 { written, skipped, bookId } — written=신규 sentences 수.
export async function writeSeedsAsNpc({ title, author, isbn }, seeds, opts = {}) {
  const log = opts.log || (() => {});
  if (!dbConfigured() || !seeds.length) return { written: 0, skipped: 0, bookId: null };
  // 표시 가능한 시드는 collector가 확인한 예스24 "책 속으로" 상품 URL과 본문만 허용한다.
  // 출처가 없거나 다른 경로에서 주입된 텍스트는 문장으로 저장하지 않는다(#1431).
  const verifiedSeeds = seeds.filter((s) =>
    s && String(s.text || '').trim()
    && s.sourceName === '예스24 책속으로'
    && /^https:\/\/(?:www\.)?yes24\.com\/product\/goods\/\d+(?:[?#].*)?$/i.test(String(s.sourceUrl || ''))
  );
  if (!verifiedSeeds.length) return { written: 0, skipped: seeds.length, bookId: null };
  const bookKey = seedBookKey(title, isbn);
  const norm = (s) => String(s || '').replace(/\s+/g, '').trim();

  // 1) canonical book_id 해석(미확인 책은 fail-closed).
  const bookId = await resolveBookId({ title, author, isbn });
  if (!bookId) { log(`  book_id 해석 실패: ${title}`); return { written: 0, skipped: seeds.length, bookId: null }; }

  // 2) 중복 판정 — 이 책에 이미 있는 sentences 텍스트 제외(멱등). 원장이 아니라 실제 문장 기준
  //    → 원장만 있고 NPC 문장 없던 책도 이번에 채워짐.
  const seenTexts = await existingSentenceTexts(bookId);
  const fresh = verifiedSeeds.filter((s) => !seenTexts.has(norm(s.text)));
  if (!fresh.length) { log(`  already has sentences (0 new): ${title}`); return { written: 0, skipped: seeds.length, bookId }; }

  // 3) 발췌마다 distinct NPC 배정 → sentences insert.
  const pool = await npcPool();
  if (!pool.length) { log('  NPC 풀 비어있음'); return { written: 0, skipped: fresh.length, bookId }; }
  const npcs = pickDistinct(pool, fresh.length);
  let written = 0;
  for (let i = 0; i < fresh.length; i++) {
    const npcId = npcs[i % npcs.length];
    const ubId = await ensureUserBook(npcId, bookId);
    if (!ubId) continue;
    if (await insertSentence(npcId, ubId, fresh[i].text)) written++;
  }

  // 4) 원장 기록(출처·중복판정·takedown). db.seedWrite 가 행별 프래그먼트로 중복 회피.
  await seedWrite(bookKey, fresh);

  log(`  ✓ NPC 적재 ${written}/${fresh.length}: ${title}`);
  return { written, skipped: seeds.length - fresh.length, bookId };
}
