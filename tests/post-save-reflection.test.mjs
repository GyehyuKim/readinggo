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
assert.match(app, /completion\.onSuccess\(\{ reflectionSentence \}\)/,
  '저장 완료 콜백에 정확한 성찰 문장을 전달해야 한다');

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
assert.match(home, /onSaveReflection=\{saveReflectionFromCeremony\}[\s\S]*onTalkToJacky=\{talkToJackyFromCeremony\}/,
  '완료 화면에 inline 저장과 재키 대화 콜백을 전달해야 한다');

assert.match(ceremony, /reflectionReady[\s\S]*className="ceremony-reflection"/,
  '정확한 문장이 준비된 경우에만 성찰 입력을 보여야 한다');
assert.match(ceremony, /textarea[\s\S]*placeholder="이 문장이 나에게 남긴 생각"[\s\S]*value=\{reflectionDraft\}[\s\S]*disabled=\{reflectionStatus === 'saving'\}/,
  '완료 화면 안에 제어된 생각 입력칸이 있고 저장 중에는 초안 변경을 막아야 한다');
assert.match(ceremony, /await onSaveReflection\(reflectionDraft\)[\s\S]*setReflectionStatus\('saved'\)/,
  '생각 저장 성공을 완료 상태로 전환해야 한다');
assert.match(ceremony, /const reflectionSaved = reflectionReady && reflectionStatus === 'saved'/,
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
