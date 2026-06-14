// 관련 도서 ISBN 환각 필터 동작 테스트 (#496)
//
// 실제 docs/readinggo/js/data.js 를 node vm 샌드박스(window 등 스텁)에서 그대로 실행해,
// window 로 노출된 순수 함수 filterRelatedCandidates / normalizeIsbn13 의 동작을 검증한다.
// 단순 문자열 존재 검사가 아니라 통과/거부 동작을 직접 증명한다.
//
// 실행: node tests/related-filter.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'docs/readinggo/js/data.js'), 'utf8');

// data.js 는 브라우저 전용(window/document/fetch 의존). 정의·말미 window 할당만 실행되도록 스텁.
const sandbox = { window: {}, document: {}, console, fetch: () => {}, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const { filterRelatedCandidates, normalizeIsbn13 } = sandbox.window;
if (typeof filterRelatedCandidates !== 'function' || typeof normalizeIsbn13 !== 'function') {
  console.error('FAIL  data.js 가 filterRelatedCandidates/normalizeIsbn13 를 window 로 노출하지 않음');
  process.exit(1);
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('OK   ' + name); }
  else { fail++; console.error('FAIL ' + name); }
}
function eqIds(name, got, expected) {
  const g = JSON.stringify(got.map((b) => b.id));
  const e = JSON.stringify(expected);
  check(`${name} → ${g}`, g === e);
}

// 실존 books DB (loadBooks 형태: {id, isbn, title, ...}). 'self' 가 현재 보고 있는 책.
const db = [
  { id: 'b1', isbn: '9788937460001', title: '토지 1', author: '박경리' },
  { id: 'b2', isbn: '9788937460002', title: '데미안', author: '헤르만 헤세' },
  { id: 'self', isbn: '9788937460099', title: '사피엔스', author: '유발 하라리' },
];
const selfIsbn = '9788937460099';

// 1) 정확한 ISBN + 제목 → 통과
eqIds('1. 정확 ISBN+제목 통과',
  filterRelatedCandidates([{ isbn: '9788937460002', title: '데미안', author: '헤르만 헤세' }], db, selfIsbn),
  ['b2']);

// 2) 존재하지 않는 ISBN → 거부
eqIds('2. 미존재 ISBN 거부',
  filterRelatedCandidates([{ isbn: '9780000000000', title: '지어낸 책', author: 'X' }], db, selfIsbn),
  []);

// 3) ISBN 은 DB 에 있으나 제목이 다름 → 거부
eqIds('3. ISBN-제목 불일치 거부',
  filterRelatedCandidates([{ isbn: '9788937460002', title: '전혀 다른 제목', author: 'X' }], db, selfIsbn),
  []);

// 4) 현재 책과 같은 ISBN → 거부
eqIds('4. 현재 책 ISBN 거부',
  filterRelatedCandidates([{ isbn: '9788937460099', title: '사피엔스', author: '유발 하라리' }], db, selfIsbn),
  []);

// 5) 잘못된 ISBN 형식(13자리 아님) → 거부
eqIds('5. 형식 오류 ISBN 거부',
  filterRelatedCandidates([{ isbn: '123', title: '데미안', author: '헤르만 헤세' }], db, selfIsbn),
  []);

// 보조) 하이픈 포함 ISBN 도 정규화 후 정확 일치하면 통과
eqIds('6. 하이픈 ISBN 정규화 통과',
  filterRelatedCandidates([{ isbn: '978-89-374-6000-1', title: '토지 1', author: '박경리' }], db, selfIsbn),
  ['b1']);

// 보조) 같은 ISBN 중복 후보는 1개만
eqIds('7. 중복 ISBN 1개만',
  filterRelatedCandidates([
    { isbn: '9788937460002', title: '데미안', author: 'a' },
    { isbn: '9788937460002', title: '데미안', author: 'b' },
  ], db, selfIsbn),
  ['b2']);

// 보조) ISBN 누락 후보 거부
eqIds('8. ISBN 누락 거부',
  filterRelatedCandidates([{ title: '데미안', author: '헤르만 헤세' }], db, selfIsbn),
  []);

// normalizeIsbn13 단위
check('9. normalizeIsbn13 하이픈 제거 13자리', normalizeIsbn13('978-89-374-6000-1') === '9788937460001');
check('10. normalizeIsbn13 형식오류 → 빈문자', normalizeIsbn13('123') === '');
check('11. normalizeIsbn13 null → 빈문자', normalizeIsbn13(null) === '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
