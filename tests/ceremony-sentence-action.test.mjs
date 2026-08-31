import assert from 'node:assert/strict';
import fs from 'node:fs';

const ceremony = fs.readFileSync('docs/readinggo/js/ceremony.js', 'utf8');
const home = fs.readFileSync('docs/readinggo/js/home.js', 'utf8');
const html = fs.readFileSync('docs/readinggo/index.html', 'utf8');

assert.match(ceremony, /className="ceremony-reflection-save" onClick=\{saveReflection\}[\s\S]*내 생각 저장하기/,
  '단일 문장 저장 뒤 완료 화면 안에서 내 생각을 저장할 수 있어야 한다');
assert.match(ceremony, /className="ceremony-action-next" onClick=\{onContinue\}[\s\S]*다음 문장 기록하기/,
  '저장 완료 화면의 1차 행동은 다음 문장 기록이어야 한다');
assert.match(ceremony, /className="ceremony-action-home" onClick=\{onGoHome\}[\s\S]*홈으로 돌아가기/,
  '저장 완료 화면에서 홈 복귀를 선택할 수 있어야 한다');
assert.match(ceremony, /onClick=\{onViewSaved\} disabled=\{reflectionSaving\}>저장한 문장 보기<\/button>/,
  '방금 저장한 문장 영역으로 이동할 수 있고 저장 중에는 이탈을 막아야 한다');
assert.doesNotMatch(ceremony, /내 서재로 가기|onGoLibrary|ceremony-action-continue/,
  '퇴역한 완료 행동 카피와 prop을 다시 만들면 안 된다');
assert.doesNotMatch(ceremony, /reward-card|onAddSentence/,
  '저장 개수를 별도 보상 카드로 반복하지 않아야 한다');
assert.match(ceremony, /className="saved-quote" role="region" aria-label="저장한 문장 전체 내용" tabIndex=\{0\}/,
  '긴 저장 문장은 키보드로 진입 가능한 영역이어야 한다');
assert.match(ceremony, /sentenceNeedsScrollHint = Array\.from\(String\(sentence \|\| ''\)\)\.length > 140[\s\S]*스크롤해서 전체 보기/,
  '긴 문장에는 스크롤 가능하다는 안내를 보여야 한다');
assert.match(html, /\.ceremony \.saved-quote\{[\s\S]*max-height:[^;]+; overflow-y:auto;[\s\S]*overscroll-behavior:contain/,
  '긴 저장 문장은 완료 창 안에서 세로 스크롤할 수 있어야 한다');
assert.match(html, /\.ceremony \.inner\{[\s\S]*max-height: var\(--app-h, 100dvh\); overflow-y:auto;[\s\S]*-webkit-overflow-scrolling:touch/,
  '완료 창 본문도 모바일 화면 안에서 스크롤할 수 있어야 한다');
assert.match(home, /pushState\(\{ rgCeremonySentence: true, bookId: homeState\.book\.id \}/,
  '입력 이동 시 현재 책 문맥과 뒤로가기 history 항목을 보존해야 한다');
assert.match(home, /pushState\(\{ rgCeremonySaved: true, bookId: homeState\.book\.id \}/,
  '저장 문장 이동도 현재 책 문맥과 뒤로가기를 보존해야 한다');
assert.match(home, /const goHomeFromCeremony = \(\) => \{[\s\S]*pendingMilestoneRef\.current = null;[\s\S]*onNavigate\('home'\)/,
  '홈 복귀는 대기 overlay를 정리하고 canonical 홈으로 이동해야 한다');
assert.match(home, /_quickSentRef\.current[\s\S]*scrollIntoView[\s\S]*focus\(\{ preventScroll: true \}\)/,
  '현재 책의 한 문장 입력을 표시하고 포커스해야 한다');
assert.match(home, /_bookQuotesRef\.current[\s\S]*scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/,
  '현재 책의 저장 문장 영역을 표시해야 한다');
assert.match(home, /const previous = _sentenceCeremonyRef\.current;[\s\S]*setCeremony\(previous\)/,
  '웹과 Android WebView popstate에서 직전 결과 화면을 복원해야 한다');
assert.match(html, /\.ceremony-reflection textarea:focus-visible,[\s\S]*\.ceremony-action-home:focus-visible,[\s\S]*\.ceremony-action-secondary button:focus-visible[\s\S]*outline:/,
  '생각 입력부터 완료 행동까지 키보드 포커스가 시각적으로 보여야 한다');

console.log('✓ 세리머니 저장 결과·다음 행동·스크롤·접근성 회귀 계약');
