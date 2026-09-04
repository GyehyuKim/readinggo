import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('docs/readinggo/js/app.js', 'utf8');
const home = fs.readFileSync('docs/readinggo/js/home.js', 'utf8');
const ceremony = fs.readFileSync('docs/readinggo/js/ceremony.js', 'utf8');
const html = fs.readFileSync('docs/readinggo/index.html', 'utf8');

assert.match(app, /let savedSentenceRow = null;[\s\S]*savedSentenceRow = await Promise\.resolve\(DataStore\.sentences\.add/,
  '단일 문장 mutation이 반환한 행을 별도로 보존해야 한다');
assert.match(app, /mineDb\.find\(x => x\.id === savedSentenceRow\.id\)[\s\S]*reflectionSentence/,
  'readback에서 같은 ID의 문장을 확인해 성찰 문맥을 만들어야 한다');
assert.match(app, /completion\.onSuccess\(\{ reflectionSentence, currentPage: authoritativeCurrentPage \}\)/,
  '저장 완료 콜백에 정확한 성찰 문장과 권위 현재 쪽을 전달해야 한다');
assert.match(app, /notePrivate: !!savedReadbackRow\.note_private,[\s\S]*note_private: !!savedReadbackRow\.note_private/,
  '저장 완료 readback은 비공개 생각 플래그를 공유 경계까지 전달해야 한다');

assert.match(home, /reflectionPending: sentenceCount === 1/,
  '단일 문장 완료만 성찰 연결을 기다려야 한다');
assert.match(home, /onSuccess: \(result\) =>[\s\S]*reflectionSentence: result && result\.reflectionSentence/,
  '저장 성공 결과를 현재 완료 화면에 연결해야 한다');
assert.match(home, /saveReflectionFromCeremony[\s\S]*DataStore\.sentences\.setNote\(sentence\.id, note \|\| null\)/,
  'inline 생각은 방금 저장한 정확한 sentence ID에 setNote로 저장해야 한다');
assert.match(home, /rgJoinNote\(draft\.trim\(\), rgSplitNote\(sentence\.note\)\.qa\)/,
  'inline 생각 저장은 기존 재키 Q/A를 보존해야 한다');
assert.match(home, /talkToJackyFromCeremony[\s\S]*RG_openCompanion\(sentence, \{ mode: 'jacky' \}\)/,
  '재키 대화는 방금 문장을 jacky 모드로 열어야 한다');
assert.match(home, /shareSentenceFromCeremony[\s\S]*shareSentenceWithFormatChoice \|\| window\.shareSentence[\s\S]*if \(!sentence \|\| !sentence\.id \|\| !share\) return;[\s\S]*entry: 'post_save'/,
  '공유는 권위 ID가 있는 방금 문장을 기존 선택기에 post_save 진입점으로 전달해야 한다');
assert.match(home, /note: sentence\.note \|\| ''[\s\S]*my_note: sentence\.note \|\| ''/,
  '생각 저장 뒤 공유에는 최신 저장 note를 전달해야 한다');
assert.match(home, /onSaveReflection=\{saveReflectionFromCeremony\}[\s\S]*onTalkToJacky=\{talkToJackyFromCeremony\}[\s\S]*onShareSentence=\{shareSentenceFromCeremony\}/,
  '완료 화면에 inline 저장, 재키 대화, 공유 콜백을 전달해야 한다');

assert.match(ceremony, /reflectionReady[\s\S]*className="ceremony-reflection"/,
  '정확한 문장이 준비된 경우에만 성찰 입력을 보여야 한다');
assert.match(ceremony, /\{reflectionReady && \([\s\S]*className="ceremony-action-share"[\s\S]*onClick=\{onShareSentence\}[\s\S]*이 문장 공유하기/,
  '권위 있는 단일 문장이 준비된 경우에만 저장 직후 공유 CTA를 보여야 한다');
assert.match(html, /\.ceremony-action-secondary \.ceremony-action-share\{[\s\S]*background:var\(--brand-tint\)[\s\S]*color:var\(--brand-3\)[\s\S]*font-weight:900/,
  '공유 CTA는 비활성처럼 보이지 않는 brand-tonal 위계를 가져야 한다');
assert.match(ceremony, /textarea[\s\S]*placeholder="이 문장이 나에게 남긴 생각"[\s\S]*value=\{reflectionDraft\}[\s\S]*disabled=\{reflectionStatus === 'saving'\}/,
  '완료 화면 안에 제어된 생각 입력칸이 있고 저장 중에는 초안 변경을 막아야 한다');
assert.match(ceremony, /await onSaveReflection\(reflectionDraft\)[\s\S]*setReflectionStatus\('saved'\)/,
  '생각 저장 성공을 완료 상태로 전환해야 한다');
assert.match(ceremony, /const \[reflectionStatus, setReflectionStatus\] = _useState\(data && data\.reflectionSaved \? 'saved' : 'idle'\)/,
  'history 복원으로 remount돼도 저장 완료 상태로 초기화해야 한다');
assert.match(ceremony, /reflectionWasSaved[\s\S]*setReflectionStatus\(reflectionWasSaved \? 'saved' : 'idle'\)[\s\S]*\[reflectionId, reflectionWasSaved\]/,
  '동일 문장 payload의 저장 완료 marker 갱신을 반영해야 한다');
assert.match(home, /const markReflectionSaved = current[\s\S]*reflectionSaved: true[\s\S]*reflectionSentence: \{ \.\.\.current\.reflectionSentence, note \}[\s\S]*_sentenceCeremonyRef\.current = markReflectionSaved\(_sentenceCeremonyRef\.current\)[\s\S]*setCeremony\(markReflectionSaved\)/,
  '저장 성공 시 현재 화면과 history ref에 완료 marker·최신 note를 함께 보존해야 한다');
assert.match(ceremony, /const reflectionSaving = reflectionReady && reflectionStatus === 'saving'/,
  '저장 요청 중 이탈 행동을 하나의 상태로 막아야 한다');
for (const actionPattern of [
  /className="ceremony-dismiss"[\s\S]*disabled=\{reflectionSaving\}/,
  /className="ceremony-reflection-jacky"[\s\S]*disabled=\{reflectionSaving\}/,
  /className="ceremony-action-next"[\s\S]*disabled=\{reflectionSaving\}/,
  /className="ceremony-action-home"[\s\S]*disabled=\{reflectionSaving\}/,
  /onClick=\{onShareSentence\} disabled=\{reflectionSaving\}/,
  /onClick=\{onViewSaved\} disabled=\{reflectionSaving\}/,
  /RG_login[\s\S]*disabled=\{reflectionSaving\}/,
]) {
  assert.match(ceremony, actionPattern, '저장 중에는 완료 화면 이탈·보조 행동을 비활성화해야 한다');
}
assert.match(html, /\.ceremony button:disabled\{[\s\S]*cursor:not-allowed/,
  '저장 중 비활성 버튼은 시각적으로 구분해야 한다');

assert.match(ceremony, /const reflectionSaved = reflectionReady && \(reflectionWasSaved \|\| reflectionStatus === 'saved'\)/,
  '정확한 문장의 생각 저장 성공만 결과 화면을 열어야 한다');
assert.match(ceremony, /reflectionReady && !reflectionSaved[\s\S]*className="ceremony-reflection"/,
  '저장 전에는 생각 입력 폼을 보여야 한다');
assert.match(ceremony, /reflectionSaved && \([\s\S]*className="ceremony-reflection-saved"[\s\S]*내가 남긴 생각[\s\S]*reflectionDraft\.trim\(\)/,
  '저장 뒤에는 입력 폼 대신 저장한 생각 결과를 다시 보여야 한다');
assert.match(ceremony, /reflectionSaved \? '내 생각을 저장했어요'[\s\S]*저장한 내용을 확인하고 다음을 선택하세요/,
  '저장 성공 제목과 안내가 화면 중심에 명확히 보여야 한다');
assert.doesNotMatch(ceremony, /reflectionStatus === 'saved' \? '내 생각을 저장했어요\.'/,
  '저장 성공을 작은 meta 상태 문구로만 표시하면 안 된다');
assert.match(ceremony, /className=\{`ceremony-actions\$\{reflectionSaved \? ' is-saved' : ''\}`\}[\s\S]*이제 무엇을 할까요\?/,
  '저장 결과 뒤에는 다음 행동 선택을 명시해야 한다');
assert.match(ceremony, /catch \(error\)[\s\S]*setReflectionStatus\('error'\)/,
  '생각 저장 실패는 입력을 지우지 않고 오류 상태를 표시해야 한다');
assert.match(ceremony, /onClick=\{onTalkToJacky\}[\s\S]*재키와 대화하기/,
  '완료 화면에서 재키 대화를 즉시 시작할 수 있어야 한다');
assert.match(ceremony, /!isComplete && data\.reflectionPending[\s\S]*저장한 문장을 연결하고 있어요/,
  'readback 전에는 성찰 입력 대신 연결 상태를 알려야 한다');
assert.match(html, /\.ceremony-reflection textarea:focus-visible[\s\S]*outline:/,
  'inline 생각 입력의 키보드 포커스가 보여야 한다');

console.log('✓ #1564 저장 직후 inline 생각·재키 대화 회귀 계약');
