import assert from 'node:assert/strict';
import fs from 'node:fs';

const ceremony = fs.readFileSync('docs/readinggo/js/ceremony.js', 'utf8');
const nest = fs.readFileSync('docs/readinggo/js/nest.js', 'utf8');
const html = fs.readFileSync('docs/readinggo/index.html', 'utf8');

assert.match(ceremony, /<button[\s\S]*className="reward-card gold reward-card-action"[\s\S]*onClick=\{onAddSentence\}/,
  '문장 수 카드 전체가 기본 키보드 활성화를 제공하는 button이어야 한다');
assert.match(ceremony, /aria-label=\{`\$\{savedSentence[\s\S]*한 문장 남기기로 이동`\}/,
  '문장 수와 이동 목적을 접근성 이름으로 알려야 한다');
assert.match(nest, /pushState\(\{ rgCeremonySentence: true, bookId: nestState\.book\.id \}/,
  '이동 시 현재 책 문맥과 뒤로가기 history 항목을 보존해야 한다');
assert.match(nest, /_quickSentRef\.current[\s\S]*scrollIntoView[\s\S]*focus\(\{ preventScroll: true \}\)/,
  '현재 책의 한 문장 입력을 표시하고 포커스해야 한다');
assert.match(nest, /const previous = _sentenceCeremonyRef\.current;[\s\S]*setCeremony\(previous\)/,
  '웹과 Android WebView popstate에서 직전 결과 화면을 복원해야 한다');
assert.match(html, /\.reward-card-action:focus-visible\s*\{[\s\S]*outline:/,
  '키보드 포커스가 시각적으로 보여야 한다');

console.log('✓ 세리머니 문장 카드 이동·접근성·뒤로가기 회귀 계약');
