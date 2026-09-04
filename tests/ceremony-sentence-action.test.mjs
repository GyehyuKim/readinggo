import assert from 'node:assert/strict';
import fs from 'node:fs';

const ceremony = fs.readFileSync('docs/readinggo/js/ceremony.js', 'utf8');
const home = fs.readFileSync('docs/readinggo/js/home.js', 'utf8');
const app = fs.readFileSync('docs/readinggo/js/app.js', 'utf8');
const html = fs.readFileSync('docs/readinggo/index.html', 'utf8');

assert.match(ceremony, /className="ceremony-reflection-save" onClick=\{saveReflection\}[\s\S]*내 생각 저장하기/,
  '단일 문장 저장 뒤 완료 화면 안에서 내 생각을 저장할 수 있어야 한다');
assert.match(ceremony, /reflectionSaved[\s\S]*className="ceremony-action-next" onClick=\{onContinue\}[\s\S]*다음 문장 남기기/,
  '생각 저장 완료의 1차 행동은 연속 문장 기록이어야 한다');
assert.match(ceremony, /reflectionSaved[\s\S]*className="ceremony-action-home" onClick=\{onViewSaved\}[\s\S]*기록 마치기/,
  '생각 저장 완료의 종료 행동은 방금 저장한 문장 영역으로 가야 한다');
assert.match(ceremony, /!reflectionSaved[\s\S]*onClick=\{onViewSaved\} disabled=\{reflectionSaving\}>저장한 문장 보기<\/button>/,
  '생각 저장 전에는 방금 저장한 문장 영역으로 이동할 수 있어야 한다');
assert.doesNotMatch(ceremony, /내 서재로 가기|onGoLibrary|ceremony-action-continue/,
  '퇴역한 완료 행동 카피와 prop을 다시 만들면 안 된다');
assert.doesNotMatch(ceremony, /reward-card|onAddSentence/,
  '저장 개수를 별도 보상 카드로 반복하지 않아야 한다');
assert.match(ceremony, /const pageOnly = !isComplete && !savedSentence;/,
  '페이지 진척만 저장한 완료 상태를 문장 저장과 명시적으로 구분해야 한다');
assert.match(ceremony, /pageOnly \? '오늘도 읽었어요' : '문장을 저장했어요'/,
  '페이지 전용과 문장 저장 완료 제목이 달라야 한다');
assert.match(ceremony, /Number\.isFinite\(currentPage\) \? `\$\{currentPage\}쪽까지 읽었어요`/,
  '페이지 전용 완료는 저장된 현재 쪽을 표시해야 한다');
assert.doesNotMatch(ceremony, /streakText|현재 \$\{streak\}일 연속 읽기/,
  '페이지 전용 완료에서 레거시 streak를 다시 노출하면 안 된다');
assert.match(ceremony, /pageOnly \? '한 문장 남기기' : '다음 문장 기록하기'/,
  '페이지 전용 완료 행동은 저장하지 않은 문장을 다음 기록으로 표현하지 않아야 한다');
assert.match(ceremony, /\{savedSentence && \([\s\S]*onViewSaved[\s\S]*저장한 문장 보기/,
  '저장한 문장 보기는 실제 문장을 저장한 경우에만 노출해야 한다');
assert.match(home, /const ceremonyData = \{[^}]*currentPage: ns\.book\.cur/,
  '완료 화면에는 증가량이 아니라 저장된 현재 쪽을 전달해야 한다');
const submitPageStart = home.indexOf('const submitPage =');
const submitPageEnd = home.indexOf('// 한 문장 섹션', submitPageStart);
const submitPage = home.slice(submitPageStart, submitPageEnd);
assert.ok(submitPage.startsWith('const submitPage = async'),
  '페이지 저장은 비동기 영속화를 기다려야 한다');
assert.match(submitPage, /if \(_pageSubmittingRef\.current \|\| _sentenceSubmittingRef\.current\) return;/,
  '페이지 저장은 진행 중인 문장 저장과 교차 실행되면 안 된다');
assert.match(submitPage, /await Promise\.resolve\(handleCheckin\(\{[\s\S]*awaitPersistence: true/,
  '페이지 저장은 완료 callback을 요청해야 한다');
const submitSentenceStart = home.indexOf('const submitSentence =');
const submitSentenceEnd = home.indexOf('// 쪽수 stepper', submitSentenceStart);
const submitSentence = home.slice(submitSentenceStart, submitSentenceEnd);
assert.match(submitSentence, /if \(_sentenceSubmittingRef\.current \|\| _pageSubmittingRef\.current\) return;/,
  '문장 저장은 진행 중인 페이지 저장과 교차 실행되면 안 된다');
assert.match(home, /disabled=\{pageSubmitting \|\| sentenceSubmitting\}[\s\S]*disabled=\{sentenceSubmitting \|\| pageSubmitting\}/,
  '한 저장이 진행 중이면 페이지와 문장 저장 버튼을 모두 비활성화해야 한다');
assert.doesNotMatch(home, /setTimeout\(\(\) => \{ submitSentence\(\)/,
  '문장 저장 락은 페이지 전환 애니메이션 뒤로 미루면 안 된다');
assert.ok(submitPage.indexOf("setQuickPage('')") > submitPage.indexOf('await Promise.resolve(handleCheckin'),
  '페이지 입력은 영속 성공 후에만 비워야 한다');
assert.match(home, /const deferCeremony = awaitPersistence && \(sentenceCount === 0 \|\| source === 'ocr_review'\);/,
  '문장이 없는 체크인과 OCR 단일 저장은 영속 성공 전 완료 화면을 미뤄야 한다');
assert.match(app, /savedSessionRow[\s\S]*authoritativeCurrentPage[\s\S]*completion\.onSuccess\(\{ reflectionSentence, currentPage: authoritativeCurrentPage \}\)/,
  '완료 callback은 저장 RPC가 반환한 권위 현재 쪽을 전달해야 한다');
assert.match(home, /if \(deferCeremony\) \{[\s\S]*_openFreshCeremony\(resolvedCeremony\)[\s\S]*\} else \{[\s\S]*setCeremony\(current =>/,
  '지연한 페이지·OCR 완료는 성공 callback에서 새 ceremony 경계로 열어야 한다');
assert.match(home, /if \(!deferCeremony\) \{[\s\S]*_openFreshCeremony\(ceremonyData\)/,
  '문장 저장 완료의 기존 낙관 세리머니는 새 ceremony 경계로 유지해야 한다');
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
assert.match(home, /const hasExistingDraft = drafts\.some[\s\S]*if \(ceremony\.reflectionSaved && !hasExistingDraft\) \{[\s\S]*setDrafts\(\[\{ text: '' \}\]\);[\s\S]*setQuickSentPage\(String\(continuationPage\)\)/,
  '연속 기록은 기존 초안이 없을 때만 빈 문장과 방금 페이지로 초기화해야 한다');
assert.match(home, /_quickSentRef\.current[\s\S]*scrollIntoView[\s\S]*focus\(\{ preventScroll: true \}\)/,
  '현재 책의 한 문장 입력을 표시하고 포커스해야 한다');
assert.match(home, /_bookQuotesRef\.current[\s\S]*scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/,
  '현재 책의 저장 문장 영역을 표시해야 한다');
assert.match(home, /const _openFreshCeremony = \(nextCeremony\) => \{[\s\S]*const replacesContinuation = !!_sentenceCeremonyRef\.current;[\s\S]*_sentenceCeremonyRef\.current = null;[\s\S]*_closeCeremonyOnPopRef\.current = replacesContinuation;[\s\S]*setCeremony\(nextCeremony\)/,
  '새 저장 완료는 이전 연속 기록 payload를 폐기하고 필요한 경우에만 다음 back 닫기를 예약해야 한다');
assert.match(home, /_openFreshCeremony\(resolvedCeremony\)[\s\S]*_openFreshCeremony\(ceremonyData\)/,
  '지연 OCR 완료와 일반 완료 모두 새 ceremony 경계를 사용해야 한다');
assert.match(home, /const onPop = \(\) => \{[\s\S]*if \(_ocrHistoryRef\.current\) return;[\s\S]*const previous = _sentenceCeremonyRef\.current;[\s\S]*if \(previous\) \{[\s\S]*setCeremony\(previous\)[\s\S]*if \(!_closeCeremonyOnPopRef\.current\) return;[\s\S]*setCeremony\(null\)/,
  '뒤로가기는 OCR overlay pop에 관여하지 않고 이전 ceremony 복원과 연속 기록 뒤 새 완료 닫기만 처리해야 한다');
assert.match(html, /\.ceremony-reflection textarea:focus-visible,[\s\S]*\.ceremony-action-home:focus-visible,[\s\S]*\.ceremony-action-secondary button:focus-visible[\s\S]*outline:/,
  '생각 입력부터 완료 행동까지 키보드 포커스가 시각적으로 보여야 한다');

console.log('✓ 세리머니 저장 결과·다음 행동·스크롤·접근성 회귀 계약');
