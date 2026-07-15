/* wiki-ask 클라이언트 응답 분기 검증 (#1283)
 *
 * 실행: node tests/wiki-ask-response.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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

response = {
  ok: false,
  status: 403,
  json: async () => ({ error: 'turnstile required' }),
};
try {
  await window.RG_wikiAsk('질문', [{ text: '문장' }]);
  check('Turnstile 403은 실패', false);
} catch (error) {
  check('Turnstile 403을 검증 오류로 분류', error.code === 'TURNSTILE' && error.status === 403);
  check('Turnstile 안내에 토큰 문제와 다시 묻기 포함', /토큰/.test(window.RG_wikiAskErrorMessage(error)) && /다시 묻기/.test(window.RG_wikiAskErrorMessage(error)));
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
