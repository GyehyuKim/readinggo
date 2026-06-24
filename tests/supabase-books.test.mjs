// Supabase books canonical + isbn13 매칭 동작 테스트 (#490, A)
//
// 실제 docs/readinggo/js/data.js 를 node vm 에서 실행하고 RG_SB(supabase) 를 스텁해
// loadBooks 가 Supabase 책을 canonical 로 적재하고 id+isbn13 양쪽으로 getBook 되는지 검증.
//
// 실행: node tests/supabase-books.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'docs/readinggo/js/data.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('OK   ' + name); } else { fail++; console.error('FAIL ' + name); } }

// ── 케이스 1: Supabase books 가 있으면 canonical (uuid id) + isbn13 인덱스 ──
{
  const fakeBooks = [
    { id: 'uuid-1', isbn13: '9788937460777', title: '1984', author: '조지 오웰', publisher: '민음사', total_pages: 452, cover_url: 'https://c/1984', description: '디스토피아' },
    { id: 'uuid-2', isbn13: '9788937460449', title: '데미안', author: '헤르만 헤세', publisher: '민음사', total_pages: 248, cover_url: 'https://c/demian', description: null },
  ];
  const sandbox = {
    window: {}, document: {}, console, fetch: () => Promise.reject(new Error('no tsv')),
    RG_SB: { client: () => ({ from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: fakeBooks, error: null }) }) }) }) },
  };
  sandbox.window.RG_SB = sandbox.RG_SB;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const W = sandbox.window;
  const books = await W.loadBooks();
  check('1. Supabase canonical 적재 (2권)', Array.isArray(books) && books.length === 2);
  const b = books.find((x) => x.isbn === '9788937460777');
  check('1. 매핑: publisher→pub', b && b.pub === '민음사');
  check('1. 매핑: total_pages→total', b && b.total === 452);
  check('1. 매핑: cover_url→cover', b && b.cover === 'https://c/1984');
  check('1. description 매핑', b && b.description === '디스토피아');
  check('1. id 유지(uuid)', b && b.id === 'uuid-1');
  // isbn13 매칭(A) — id(uuid)·isbn13 양쪽으로 getBook
  check('1. getBook(uuid) → 책', W.getBook('uuid-1') && W.getBook('uuid-1').isbn === '9788937460777');
  check('1. getBook(isbn13) → 동일 책 (isbn 인덱스)', W.getBook('9788937460777') && W.getBook('9788937460777').id === 'uuid-1');
  // 인라인 12권 isbn 시드(fb/toc)가 isbn 으로 이어짐 — 데미안(b008, isbn 9788937460449)
  check('1. isbn 시드 fb 매칭(데미안)', W.getBook('9788937460449') && Array.isArray(W.getBook('9788937460449').fb));
}

// ── 케이스 2: Supabase 미설정(RG_SB null) → 인라인 RG_BOOKS 폴백 (#972: 정적 TSV 폴백 제거) ──
{
  const sandbox = {
    window: {}, document: {}, console,
    fetch: () => Promise.reject(new Error('no network')),  // 폴백은 더 이상 fetch 안 함 — 인라인 RG_BOOKS
    RG_SB: null,
  };
  sandbox.window.RG_SB = null;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const W = sandbox.window;
  const books = await W.loadBooks();
  check('2. RG_SB 미설정 → 인라인 RG_BOOKS 폴백', Array.isArray(books) && books.length === W.RG_BOOKS.length && books[0].title === '사피엔스');
  check('2. 폴백도 isbn 인덱스', W.getBook('9788934972464') && W.getBook('9788934972464').id === 'b001');
}

// ── 케이스 3: Supabase 빈 결과([]) → 인라인 RG_BOOKS 폴백 (#972) ──
{
  const sandbox = {
    window: {}, document: {}, console,
    fetch: () => Promise.reject(new Error('no network')),
    RG_SB: { client: () => ({ from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) },
  };
  sandbox.window.RG_SB = sandbox.RG_SB;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const W = sandbox.window;
  const books = await W.loadBooks();
  check('3. Supabase 빈 결과 → 인라인 RG_BOOKS 폴백', Array.isArray(books) && books.length === W.RG_BOOKS.length && books[0].title === '사피엔스');
  check('3. 폴백서 1984 isbn 조회', W.getBook('9788937460777') && W.getBook('9788937460777').title === '1984');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
