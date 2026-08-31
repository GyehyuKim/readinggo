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
const homeSource = readFileSync(join(root, 'docs', 'readinggo', 'js', 'home.js'), 'utf8');
const messageStart = homeSource.indexOf('function _ocrFailureMessage');
const messageEnd = homeSource.indexOf('\nwindow._ocrFailureMessage', messageStart);
if (messageStart < 0 || messageEnd < 0) throw new Error('OCR message helper not found');
vm.runInNewContext(`${homeSource.slice(messageStart, messageEnd)}\nwindow._ocrFailureMessage = _ocrFailureMessage;`, { window: clientWindow });

let passed = 0;
function check(name, condition) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed += 1;
  console.log(`OK   ${name}`);
}

const workerSource = readFileSync(join(root, 'worker', 'index.mjs'), 'utf8');
const parseStart = workerSource.indexOf('function parseHighlights');
const parseEnd = workerSource.indexOf('\n// ArrayBuffer', parseStart);
if (parseStart < 0 || parseEnd < 0) throw new Error('parseHighlights helper not found');
const highlightSandbox = {};
vm.runInNewContext(`${workerSource.slice(parseStart, parseEnd)}\nthis.parseHighlights = parseHighlights;`, highlightSandbox);
const highlightValues = ['가'.repeat(200), '나'.repeat(201), `  ${'다'.repeat(1000)}  `, '라'.repeat(1001)];
const parsedHighlights = highlightSandbox.parseHighlights(JSON.stringify(highlightValues));
check('강조 추출은 200·201·1,000·1,001자를 검토 초안까지 원문 보존한다',
  JSON.stringify(Array.from(parsedHighlights, (text) => text.length)) === JSON.stringify([200, 201, 1000, 1001])
    && parsedHighlights[2] === '다'.repeat(1000) && parsedHighlights[3] === highlightValues[3]);

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
const formWith = (blob = new Blob(['image'], { type: 'image/png' }), correct = true) => {
  const form = new FormData();
  form.append('document', blob, 'page.png');
  if (!correct) form.append('correct', 'false');
  return form;
};
const llmResponse = (content) => Response.json({ choices: [{ message: { content } }] });
const wordAt = (text, left, top) => ({
  text,
  boundingBox: { vertices: [
    { x: left, y: top }, { x: left + 700, y: top },
    { x: left + 700, y: top + 20 }, { x: left, y: top + 20 },
  ] },
});
async function runOcr({ text, pages = [], corrected, correct = true }) {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return Response.json({ text, pages });
    if (corrected instanceof Error) throw corrected;
    return llmResponse(corrected == null ? text : corrected);
  };
  const response = await worker.fetch(request(formWith(undefined, correct)), env, {});
  return { response, body: await response.json(), calls };
}

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

  const lines = [
    '그 사람만 생각하면', '나는 잠도 싫어지고', '음식도 싫어진다.',
    '먼 길을 지나', '집으로 돌아와', '문을 닫았다.',
    '메넬라오스는 이런 말로', '이야기를 시작했고', '모두가 조용히',
    '그의 오래된 말을', '숨을 죽인 채', '끝까지 들었다.',
    '그가 이런 것들을', '마음속으로 곰곰이', '생각하는 동안',
    '바람은 창가를 스치고', '등불은 흔들리며', '밤이 깊어졌다.',
  ];
  const indented = new Set([6, 12]);
  const page = {
    width: 1000,
    text: lines.join('\n'),
    words: lines.map((line, index) => wordAt(line, indented.has(index) ? 140 : 100, index * 30)),
  };
  ({ response, body } = await runOcr({ text: page.text, pages: [page], correct: false }));
  const expectedParagraphs = [lines.slice(0, 6), lines.slice(6, 12), lines.slice(12)]
    .map((paragraph) => paragraph.join(' ')).join('\n\n');
  check('18개 물리 행은 들여쓰기 기준의 3개 문단으로 정규화된다',
    response.status === 200 && body.text === expectedParagraphs && body.text.split('\n\n').length === 3);
  check('좌표와 OCR 원문은 응답에 추가 노출하지 않는다',
    !('raw' in body) && !('pages' in body) && !('words' in body));

  ({ body } = await runOcr({
    text: '첫 행\n둘째 행\n\n새 문단\n마지막 행', pages: [], correct: false,
  }));
  check('좌표 누락 폴백은 빈 줄만 문단으로 보존하고 단일 줄바꿈을 합친다',
    body.text === '첫 행 둘째 행\n\n새 문단 마지막 행');

  ({ body } = await runOcr({
    text: '첫 행\n둘째 행\n\n새 문단',
    pages: [{
      width: 1000,
      text: '첫 행\n둘째 행\n\n새 문단',
      words: [wordAt('첫 행', 100, 0), { text: '둘째 행' }, wordAt('새 문단', 140, 60)],
    }],
    correct: false,
  }));
  check('일부 단어 좌표가 불완전하면 의미를 추정하지 않고 빈 줄 폴백을 쓴다',
    body.text === '첫 행 둘째 행\n\n새 문단');

  ({ body } = await runOcr({ text: '첫 문장\n둘째 문장', corrected: '첫  문장   둘째\n문장' }));
  check('Solar whitespace-only 후보는 채택하되 결정론적 행 경계를 유지한다',
    body.text === '첫 문장 둘째 문장' && body.corrected === true);

  const rejectedCandidates = [
    ['단어 변경', '첫 문장\n다른 문장'],
    ['글자 삭제', '첫 문장\n둘째 문'],
    ['글자 추가', '첫 문장\n둘째 문장 추가'],
    ['출력 절단', '첫 문장'],
  ];
  for (const [kind, candidate] of rejectedCandidates) {
    ({ body } = await runOcr({ text: '첫 문장\n둘째 문장', corrected: candidate }));
    check(`Solar ${kind} 후보는 버리고 결정론적 결과를 반환한다`,
      body.text === '첫 문장 둘째 문장' && body.corrected === false);
  }

  let calls;
  ({ response, body, calls } = await runOcr({
    text: '원문\n문장', corrected: new Error('correction unavailable'),
  }));
  check('LLM 보정 실패는 정규화된 OCR 성공을 실패로 바꾸지 않는다',
    response.status === 200 && body.text === '원문 문장' && body.corrected === false && calls === 2);
  check('안전 로그는 code/stage/status만 남긴다', warnings.length >= 2
    && warnings.every((line) => /"code"|"event"/.test(line)
      && !line.includes('provider-secret-body') && !line.includes('private upstream detail')));
} finally {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
}

console.log(`\n${passed} passed`);
