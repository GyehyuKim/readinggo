import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nestSource = readFileSync(new URL('../docs/readinggo/js/nest.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../docs/readinggo/js/app.js', import.meta.url), 'utf8');

function section(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  assert.ok(start >= 0 && end > start, `${startToken} 검증 구간이 있어야 한다`);
  return source.slice(start, end);
}

const submit = section(nestSource, 'const submitSentence', '// 쪽수 stepper');
const successClear = submit.indexOf("setDrafts([{ text: '', visibility }])");
const pageClear = submit.indexOf("setQuickSentPage('')");
const persistenceWait = submit.indexOf('await Promise.resolve(handleCheckin(');
const failureCatch = submit.indexOf('} catch (e) {');
const guardCheck = submit.indexOf('if (_sentenceSubmittingRef.current) return;');
const guardLock = submit.indexOf('_sentenceSubmittingRef.current = true;');
const guardUnlock = submit.indexOf('_sentenceSubmittingRef.current = false;');

assert.ok(submit.startsWith('const submitSentence = async'), '한 문장 제출은 비동기 영속화를 기다려야 한다');
assert.equal((submit.match(/awaitPersistence: true/g) || []).length, 2, '단일·배치 저장 모두 완료 신호를 요청해야 한다');
assert.ok(guardCheck >= 0 && guardLock > guardCheck && persistenceWait > guardLock, '두 번째 동시 제출은 영속화 호출 전에 동기 차단해야 한다');
assert.ok(persistenceWait >= 0 && successClear > persistenceWait, '입력 문장은 저장 성공을 기다린 뒤 비워야 한다');
assert.ok(pageClear > persistenceWait, '문장별 페이지는 저장 성공을 기다린 뒤 비워야 한다');
assert.ok(failureCatch > successClear && !submit.slice(failureCatch).includes('setDrafts('), '저장 실패 시 입력 문장을 보존해야 한다');
assert.ok(!submit.slice(failureCatch).includes('setQuickSentPage('), '저장 실패 시 문장별 페이지를 보존해야 한다');
assert.ok(guardUnlock > failureCatch && submit.includes('} finally {'), '성공·실패 모두 제출 락을 해제해 실패 후 재시도할 수 있어야 한다');
assert.ok(/disabled=\{sentenceSubmitting\} aria-busy=\{sentenceSubmitting\}/.test(nestSource), '제출 중 버튼 비활성·busy 상태를 알려야 한다');

const appCheckin = section(appSource, 'const handleCheckin = useCallback', '// 읽기모드 한 문장 저장');
assert.ok(appCheckin.includes('if (completion && completion.onSuccess) completion.onSuccess();'), '영속 성공 신호가 있어야 한다');
assert.ok(appCheckin.includes('if (completion && completion.onFailure) completion.onFailure(e);'), '영속 실패 신호가 있어야 한다');

console.log('✓ 한 문장 저장 성공 후 입력 초기화·실패 시 보존 회귀 계약');
