// 책 소개 HTML 엔티티 디코드 회귀 테스트 (#562)
//
// decodeEntities는 #761 모듈화 뒤 components.js가 소유한다. JSX 전체 실행 대신
// 실제 함수 소스만 추출해 검증한다. node에는 document가 없으므로 정규식 폴백 경로가
// 동작한다(브라우저는 textarea 트릭으로 전체 엔티티를 처리).
//
// 실행: node tests/decode-entities.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/readinggo/js/components.js');
const src = fs.readFileSync(sourcePath, 'utf8');

// 모듈 레벨 함수 추출 — 닫는 '}' 는 라인 시작(들여쓰기 0), 내부 '}' 는 들여쓰기되어 있어 안전.
const m = src.match(/function decodeEntities\(s\) \{[\s\S]*?\n\}/);
if (!m) { console.error('FAIL  components.js 에서 decodeEntities 추출 실패'); process.exit(1); }
const decodeEntities = new Function('return (' + m[0] + ')')();

let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; console.log('OK   ' + name); }
  else { fail++; console.error(`FAIL ${name} → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}

eq('1. 꺾쇠 — <이방인>', decodeEntities('카뮈가 첫 작품 &lt;이방인&gt;과 같은 해에'), '카뮈가 첫 작품 <이방인>과 같은 해에');
eq('2. &amp; → &', decodeEntities('A &amp; B'), 'A & B');
eq('3. &quot; → "', decodeEntities('&quot;인용&quot;'), '"인용"');
eq("4. &#39; → '", decodeEntities('&#39;작은따옴표&#39;'), "'작은따옴표'");
eq("5. &#x27; → '", decodeEntities('&#x27;hex&#x27;'), "'hex'");
eq('6. 숫자 엔티티 &#65; → A', decodeEntities('&#65;BC'), 'ABC');
eq('7. & 없으면 그대로', decodeEntities('일반 텍스트 그대로'), '일반 텍스트 그대로');
eq('8. 미완성 엔티티(세미콜론 없음)는 보존', decodeEntities('1 & 2'), '1 & 2');
eq('9. 알 수 없는 엔티티는 보존', decodeEntities('&unknownent;'), '&unknownent;');
eq('10. 빈 값 안전', decodeEntities(''), '');
eq('11. null 안전', decodeEntities(null), '');
eq('12. 중첩 디코드 한 번만(&amp;lt; → &lt;)', decodeEntities('&amp;lt;'), '&lt;');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
