/* OCR Worker stable code/stage 계약과 클라이언트 분류 검증 (#1302/#1313)
 * 실행: node tests/ocr-response.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import worker from '../worker/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataSource = readFileSync(join(root, 'docs', 'readinggo', 'js', 'data.js'), 'utf8');
const helperStart = dataSource.indexOf('const OCR_MAX_BYTES');
const helperEnd = dataSource.indexOf('\nwindow.RG_BOOKS=', helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error('OCR client helper not found');

let clientResponse;
const clientWindow = { RG_apiFetch: async () => clientResponse };
vm.runInNewContext(`${dataSource.slice(helperStart, helperEnd)}\nwindow.ocrExtractSentence = ocrExtractSentence;`, {
  window: clientWindow, FormData, Promise, String,
});
const nestSource = readFileSync(join(root, 'docs', 'readinggo', 'js', 'nest.js'), 'utf8');
const messageStart = nestSource.indexOf('function _ocrFailureMessage');
const messageEnd = nestSource.indexOf('\nwindow._ocrFailureMessage', messageStart);
if (messageStart < 0 || messageEnd < 0) throw new Error('OCR message helper not found');
vm.runInNewContext(`${nestSource.slice(messageStart, messageEnd)}\nwindow._ocrFailureMessage = _ocrFailureMessage;`, { window: clientWindow });

let passed = 0;
function check(name, condition) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed += 1;
  console.log(`OK   ${name}`);
}

let result = await clientWindow.ocrExtractSentence({ size: 9 * 1024 * 1024 });
check('클라이언트 8MB 초과는 Worker와 같은 code/stage를 쓴다',
  result.error === 'ocr_image_too_large' && result.stage === 'request' && result.status === 413);

clientResponse = { status: 502, json: async () => ({ code: 'ocr_upstream_auth', stage: 'upstage' }) };
result = await clientWindow.ocrExtractSentence(new Blob(['image'], { type: 'image/png' }));
check('클라이언트는 Worker code/stage/status를 손실 없이 유지한다',
  result.error === 'ocr_upstream_auth' && result.stage === 'upstage' && result.status === 502);
check('Turnstile·upstream·network 안내는 서로 구분된다',
  clientWindow._ocrFailureMessage('TURNSTILE_REQUIRED') !== clientWindow._ocrFailureMessage('ocr_upstream_auth')
    && clientWindow._ocrFailureMessage('ocr_upstream_auth') !== clientWindow._ocrFailureMessage('ocr_network_failure'));

const request = (form) => new Request('https://readinggo.test/api/ocr', { method: 'POST', body: form });
const env = { UPSTAGE_API_KEY: 'test-key', LLM_BASE_URL: 'https://llm.test', LLM_MODEL: 'test-model' };
const formWith = (blob = new Blob(['image'], { type: 'image/png' })) => {
  const form = new FormData(); form.append('document', blob, 'page.png'); return form;
};
let response = await worker.fetch(request(new FormData()), env, {});
let body = await response.json();
check('이미지 누락은 422 request stable code다',
  response.status === 422 && body.code === 'ocr_image_missing' && body.stage === 'request');

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
const warnings = [];
console.warn = (line) => warnings.push(String(line));
try {
  globalThis.fetch = async () => new Response('provider-secret-body', { status: 401 });
  response = await worker.fetch(request(formWith()), env, {}); body = await response.json();
  check('Upstage auth 실패는 provider body 없는 stable code다', response.status === 502
    && body.code === 'ocr_upstream_auth' && body.stage === 'upstage'
    && !JSON.stringify(body).includes('provider-secret-body'));

  globalThis.fetch = async () => { throw new Error('private upstream detail'); };
  response = await worker.fetch(request(formWith()), env, {}); body = await response.json();
  check('전송 실패는 내부 예외를 노출하지 않는다', response.status === 502
    && body.code === 'ocr_transport_failure' && body.stage === 'upstage'
    && !JSON.stringify(body).includes('private upstream detail'));

  globalThis.fetch = async () => Response.json({ text: '' });
  response = await worker.fetch(request(formWith()), env, {}); body = await response.json();
  check('빈 OCR은 200 result code며 raw 필드가 없다', response.status === 200
    && body.empty === true && body.code === 'ocr_empty' && body.stage === 'result' && !('raw' in body));

  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({ text: '원문 문장' });
    throw new Error('correction unavailable');
  };
  response = await worker.fetch(request(formWith()), env, {}); body = await response.json();
  check('LLM 보정 실패는 raw OCR 성공을 실패로 바꾸지 않는다',
    response.status === 200 && body.text === '원문 문장' && body.corrected === false && calls === 2);
  check('안전 로그는 code/stage/status만 남긴다', warnings.length >= 2
    && warnings.every((line) => /"code"|"event"/.test(line)
      && !line.includes('provider-secret-body') && !line.includes('private upstream detail')));
} finally {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
}

console.log(`\n${passed} passed`);
