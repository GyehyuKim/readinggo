import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const homeSource = readFileSync(new URL('../docs/readinggo/js/home.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../docs/readinggo/js/app.js', import.meta.url), 'utf8');
const batchSource = readFileSync(new URL('../docs/readinggo/js/batch-quote-import.js', import.meta.url), 'utf8');

function section(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  assert.ok(start >= 0 && end > start, `${startToken} 검증 구간이 있어야 한다`);
  return source.slice(start, end);
}

const batchSandbox = { window: {}, Promise, Error, Array, _BQI_MAX: 1000, _bqiLength: (value) => Array.from(String(value == null ? '' : value).trim()).length };
vm.createContext(batchSandbox);
vm.runInContext(section(batchSource, 'async function saveSentenceBatch', 'function BatchQuoteImport'), batchSandbox);
const batchItems = [{ text: '첫째' }, { text: '둘째' }, { text: '가'.repeat(1001) }, { text: '넷째' }];
const batchResult = await batchSandbox.window.RG_saveSentenceBatch(batchItems, async (_item, index) => {
  if (index === 1) throw new Error('injected_failure');
  if (index === 3) return null;
  return { id: `saved-${index}` };
});
assert.deepEqual(Array.from(batchResult.savedIndices), [0, 2], '실제 성공한 인덱스만 반환');
assert.deepEqual(Array.from(batchResult.failedIndices), [1, 3], 'throw와 빈 row를 실패로 반환');
assert.deepEqual(Array.from(batchResult.truncatedIndices), [2], '성공한 1001자 행만 절단 알림 대상으로 반환');
assert.equal(batchResult.saved, 2, '0건 fallback 없이 실제 저장 수 반환');
assert.deepEqual(Array.from(batchSandbox.window.RG_retainFailedBatchItems(batchItems, batchResult.failedIndices), (item) => item.text), ['둘째', '넷째'], '실패 초안만 검토 화면에 남김');

const homeSandbox = { window: {}, Set, Array };
vm.createContext(homeSandbox);
vm.runInContext(section(homeSource, 'function _retainUnsavedDrafts', '/* ── HomeView'), homeSandbox);
const retainedDrafts = homeSandbox.window._retainUnsavedDrafts([
  { text: '첫째' }, { text: '' }, { text: '둘째' }, { text: '셋째' },
], [0, 2]);
assert.deepEqual(Array.from(retainedDrafts, (draft) => draft.text), ['', '둘째'], '홈은 성공한 초안만 제거하고 빈 행·실패 초안을 보존');

const submit = section(homeSource, 'const submitSentence', '// 쪽수 stepper');
const successClear = submit.indexOf("setDrafts([{ text: '' }])");
const pageClear = submit.indexOf("setQuickSentPage('')");
const persistenceWait = submit.indexOf('await Promise.resolve(handleCheckin(');
const failureCatch = submit.indexOf('} catch (e) {');
const guardCheck = submit.indexOf('if (_sentenceSubmittingRef.current || _pageSubmittingRef.current) return;');
const guardLock = submit.indexOf('_sentenceSubmittingRef.current = true;');
const guardUnlock = submit.indexOf('_sentenceSubmittingRef.current = false;');

assert.ok(submit.startsWith('const submitSentence = async'), '한 문장 제출은 비동기 영속화를 기다려야 한다');
assert.ok(/hadTruncation = ready\.some\(\(x\) => Array\.from\(x\.text\)\.length > 1000\)[\s\S]+await Promise\.resolve\(handleCheckin\([\s\S]+앞부분만 저장했어요/.test(submit), 'Unicode 1001자 입력은 영속 성공 후 절단 사실을 알려야 한다');
assert.equal((submit.match(/awaitPersistence: true/g) || []).length, 2, '단일·배치 저장 모두 완료 신호를 요청해야 한다');
assert.ok(guardCheck >= 0 && guardLock > guardCheck && persistenceWait > guardLock, '두 번째 동시 제출은 영속화 호출 전에 동기 차단해야 한다');
assert.ok(persistenceWait >= 0 && successClear > persistenceWait, '입력 문장은 저장 성공을 기다린 뒤 비워야 한다');
assert.ok(pageClear > persistenceWait, '문장별 페이지는 저장 성공을 기다린 뒤 비워야 한다');
assert.ok(failureCatch > successClear && !submit.slice(failureCatch).includes("setDrafts([{ text: '' }])"), '저장 실패 시 입력 전체를 비우지 않아야 한다');
assert.ok(/_retainUnsavedDrafts\(prev, saved\)/.test(submit.slice(failureCatch)), '부분 성공 시 검증된 helper로 성공 초안만 제거해야 한다');
assert.ok(!submit.slice(failureCatch).includes('setQuickSentPage('), '저장 실패 시 문장별 페이지를 보존해야 한다');
assert.ok(guardUnlock > failureCatch && submit.includes('} finally {'), '성공·실패 모두 제출 락을 해제해 실패 후 재시도할 수 있어야 한다');
assert.ok(/disabled=\{sentenceSubmitting \|\| pageSubmitting\} aria-busy=\{sentenceSubmitting \|\| pageSubmitting\}/.test(homeSource), '페이지·문장 제출 중 버튼 비활성·busy 상태를 알려야 한다');

const appCheckin = section(appSource, 'const handleCheckin = useCallback', '// 읽기모드 한 문장 저장');
assert.ok(appCheckin.includes('window.RG_saveSentenceBatch(batch'), '홈은 실행 검증된 공용 batch 저장 함수를 사용해야 한다');
assert.ok(appCheckin.includes('if (completion && completion.onSuccess) completion.onSuccess({ reflectionSentence, currentPage: authoritativeCurrentPage });'), '영속 성공 신호가 정확한 성찰 문맥과 권위 현재 쪽을 전달해야 한다');
assert.ok(appCheckin.includes('if (completion && completion.onFailure) completion.onFailure(e);'), '영속 실패 신호가 있어야 한다');
assert.ok(/result\.failedIndices\.length[\s\S]+throw error[\s\S]+completion\.onSuccess/.test(appCheckin), 'batch 실패는 성공 콜백 전에 reject해야 한다');

console.log('✓ 한 문장 저장 성공 후 입력 초기화·부분 실패 초안 보존 회귀 계약');
