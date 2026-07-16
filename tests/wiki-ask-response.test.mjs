/* wiki-ask 클라이언트 응답 분기 검증 (#1283)
 *
 * 실행: node tests/wiki-ask-response.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import worker from '../worker/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'docs', 'readinggo', 'js', 'supabase-client.js'), 'utf8');
const start = source.indexOf('window.RG_wikiAskErrorMessage');
const end = source.indexOf('\n};', source.indexOf('window.RG_wikiAsk =', start)) + 3;
if (start < 0 || end < 3) throw new Error('RG_wikiAsk source block not found');

let response;
const window = { RG_apiFetch: async () => response };
vm.runInNewContext(source.slice(start, end), { window, Error, JSON, String });

let passed = 0;
function check(name, condition) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed += 1;
  console.log(`OK   ${name}`);
}

response = {
  ok: true,
  status: 200,
  json: async () => ({ answer: '내 문장에 근거한 답' }),
};
check('200은 answer를 반환', await window.RG_wikiAsk('질문', [{ text: '문장' }]) === '내 문장에 근거한 답');

const workerRequest = (token) => new Request('https://readinggo.hyuniverse.workers.dev/api/wiki-ask', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { 'cf-turnstile-token': token } : {}),
  },
  body: JSON.stringify({ question: '질문', items: [{ text: '문장' }] }),
});
const workerEnv = {
  TURNSTILE_SECRET: 'test-secret',
  UPSTAGE_API_KEY: 'test-key',
  LLM_BASE_URL: 'https://llm.example',
  LLM_MODEL: 'test-model',
};

let workerResponse = await worker.fetch(workerRequest(''), workerEnv, {});
let workerBody = await workerResponse.json();
check('Worker required는 토큰 미전송 안전 코드를 반환', workerResponse.status === 403
  && workerBody.code === 'TURNSTILE_REQUIRED' && workerBody.message === '보안 확인 정보가 필요해요.');

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url) => {
    if (String(url).includes('/siteverify')) return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
    throw new Error('siteverify 거절 후 LLM을 호출하면 안 됨');
  };
  workerResponse = await worker.fetch(workerRequest('rejected-token'), workerEnv, {});
  workerBody = await workerResponse.json();
  check('Worker failed는 siteverify 상세 없이 승인 거절 안전 코드를 반환', workerResponse.status === 403
    && workerBody.code === 'TURNSTILE_FAILED' && workerBody.message === '보안 확인이 승인되지 않았어요.'
    && !JSON.stringify(workerBody).includes('invalid-input-response'));

  let fetchCount = 0;
  globalThis.fetch = async (url) => {
    fetchCount += 1;
    if (String(url).includes('/siteverify')) return Response.json({ success: true });
    if (String(url) === 'https://llm.example/chat/completions') {
      return Response.json({ choices: [{ message: { content: '내 문장에 근거한 답' } }] });
    }
    throw new Error('예상하지 못한 fetch: ' + url);
  };
  workerResponse = await worker.fetch(workerRequest('valid-token'), workerEnv, {});
  workerBody = await workerResponse.json();
  check('Worker 200은 Turnstile 검증 후 기존 answer를 반환', workerResponse.status === 200
    && workerBody.answer === '내 문장에 근거한 답' && fetchCount === 2);
} finally {
  globalThis.fetch = originalFetch;
}

response = {
  ok: false,
  status: 403,
  json: async () => ({ error: 'turnstile required', code: 'TURNSTILE_REQUIRED', message: '보안 확인 정보가 필요해요.' }),
};
try {
  await window.RG_wikiAsk('질문', [{ text: '문장' }]);
  check('Turnstile required 403은 실패', false);
} catch (error) {
  check('Turnstile required를 토큰 미전송으로 분류', error.code === 'TURNSTILE_REQUIRED' && error.status === 403);
  check('required 안내는 정보 미전송을 알림', /전송되지 않았/.test(window.RG_wikiAskErrorMessage(error)));
  check('required는 첫 실패 후 1회만 재시도', window.RG_wikiAskCanRetry(error, false) && !window.RG_wikiAskCanRetry(error, true));
}

response = {
  ok: false,
  status: 403,
  json: async () => ({ error: 'turnstile failed', code: 'TURNSTILE_FAILED', message: '보안 확인이 승인되지 않았어요.' }),
};
try {
  await window.RG_wikiAsk('질문', [{ text: '문장' }]);
  check('Turnstile failed 403은 실패', false);
} catch (error) {
  check('Turnstile failed를 siteverify 거절로 분류', error.code === 'TURNSTILE_FAILED' && error.status === 403);
  check('failed 안내는 승인 거절을 알림', /승인되지 않았/.test(window.RG_wikiAskErrorMessage(error)));
  check('failed도 첫 실패 후 1회만 재시도', window.RG_wikiAskCanRetry(error, false) && !window.RG_wikiAskCanRetry(error, true));
}

response = {
  ok: false,
  status: 502,
  json: async () => ({ error: 'llm failed' }),
};
try {
  await window.RG_wikiAsk('질문', [{ text: '문장' }]);
  check('LLM 502는 실패', false);
} catch (error) {
  check('LLM 502를 서비스 오류로 분류', error.code === 'SERVICE' && error.status === 502);
  check('502 안내는 Turnstile 안내와 다름', /서비스/.test(window.RG_wikiAskErrorMessage(error)) && !/토큰/.test(window.RG_wikiAskErrorMessage(error)));
}

console.log(`\n${passed} passed`);
