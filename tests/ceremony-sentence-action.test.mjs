import assert from 'node:assert/strict';
import fs from 'node:fs';

const ceremony = fs.readFileSync('docs/readinggo/js/ceremony.js', 'utf8');
const nest = fs.readFileSync('docs/readinggo/js/nest.js', 'utf8');
const html = fs.readFileSync('docs/readinggo/index.html', 'utf8');

assert.match(ceremony, /className="ceremony-reflection-save" onClick=\{saveReflection\}[\s\S]*내 생각 저장하기/,
  '단일 문장 저장 뒤 기본 행동은 완료 화면 안의 내 생각 저장이어야 한다');
assert.match(ceremony, /className="ceremony-action-continue" onClick=\{onContinue\}[\s\S]*이 책에서 계속 기록하기/,
  '현재 책에서 계속 기록하기는 하위 행동으로 유지해야 한다');
assert.match(ceremony, /onClick=\{onViewSaved\}>저장한 문장 보기<\/button>/,
  '방금 저장한 문장 영역으로 이동할 수 있어야 한다');
assert.match(ceremony, /onClick=\{onGoLibrary\}>내 서재로 가기<\/button>/,
  '저장 뒤 서재 자산으로 이동할 수 있어야 한다');
assert.doesNotMatch(ceremony, /reward-card|onAddSentence/,
  '저장 개수를 별도 결과 카드로 반복하지 않아야 한다');
assert.match(nest, /pushState\(\{ rgCeremonySentence: true, bookId: homeState\.book\.id \}/,
  '입력 이동 시 현재 책 문맥과 뒤로가기 history 항목을 보존해야 한다');
assert.match(nest, /pushState\(\{ rgCeremonySaved: true, bookId: homeState\.book\.id \}/,
  '저장 문장 이동도 현재 책 문맥과 뒤로가기를 보존해야 한다');
assert.match(nest, /_quickSentRef\.current[\s\S]*scrollIntoView[\s\S]*focus\(\{ preventScroll: true \}\)/,
  '현재 책의 한 문장 입력을 표시하고 포커스해야 한다');
assert.match(nest, /_bookQuotesRef\.current[\s\S]*scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/,
  '현재 책의 저장 문장 영역을 표시해야 한다');
assert.match(nest, /const previous = _sentenceCeremonyRef\.current;[\s\S]*setCeremony\(previous\)/,
  '웹과 Android WebView popstate에서 직전 결과 화면을 복원해야 한다');
assert.match(html, /\.ceremony-reflection textarea:focus-visible,[\s\S]*\.ceremony-action-secondary button:focus-visible[\s\S]*outline:/,
  '생각 입력부터 기존 완료 행동까지 키보드 포커스가 시각적으로 보여야 한다');

console.log('✓ 세리머니 다음 행동·접근성·뒤로가기 회귀 계약');
