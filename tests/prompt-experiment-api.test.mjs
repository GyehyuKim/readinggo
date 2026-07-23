/* Judy용 Solar prompt experiment API 회귀 테스트 (#1330)
 * 실행: node tests/prompt-experiment-api.test.mjs
 */
import worker from '../worker/index.mjs';
import { readFile } from 'node:fs/promises';

let passed = 0;
function check(name, condition) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed += 1;
  console.log(`OK   ${name}`);
}

class MemoryKV {
  constructor() { this.rows = new Map(); }
  async get(key) { return this.rows.has(key) ? this.rows.get(key) : null; }
  async put(key, value) { this.rows.set(key, String(value)); }
}

const kv = new MemoryKV();
const env = {
  ENVIRONMENT: 'development',
  PROMPT_EXPERIMENT_TOKEN: 'judy-test-token',
  PROMPT_EXPERIMENT_DAILY_LIMIT: '2',
  PROMPT_EXPERIMENT_MINUTE_LIMIT: '10',
  LLM_BASE_URL: 'https://api.upstage.test/v1',
  LLM_MODEL: 'solar-pro3',
  UPSTAGE_API_KEY: 'upstage-test-key',
  OTA_KV: kv,
};
const baseBody = {
  protocol_version: '1.0',
  data_classification: 'synthetic',
  experiment: { id: 'tone-001', variant: 'warm-v1', note: '합성 테스트' },
  prompt: {
    system: '당신은 사용자와 같은 책을 읽고 담백하게 대화하는 독서 친구 재키입니다.',
    first_turn_instruction: '문장과 감상에 짧게 반응하세요.',
    followup_instruction: '직전 답변에 먼저 반응하고 한 단계만 이어가세요.',
    constraints: ['2~3문장 이내로 답한다.', '모르는 내용을 지어내지 않는다.'],
  },
  input: {
    book: { title: '가상의 책', author: '가상의 작가', brief: '합성 책 브리프' },
    kind: 'quote', sentence: '가상의 한 문장이다.', comment: '조금 오래 남았다.', preset: 'balanced',
  },
  history: [],
  generation: { temperature: 0.7, max_tokens: 180 },
  trace: { include_compiled_messages: true },
};
function request(body = baseBody, token = 'judy-test-token', path = '/api/prompt-experiments/run', extra = {}) {
  return new Request(`https://readinggo-dev.example${path}`, {
    method: extra.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extra.headers || {}),
    },
    body: (extra.method || 'POST') === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
}

const originalFetch = globalThis.fetch;
const providerPayloads = [];
globalThis.fetch = async (url, init = {}) => {
  if (String(url) !== 'https://api.upstage.test/v1/chat/completions') throw new Error(`unexpected fetch ${url}`);
  const payload = JSON.parse(init.body);
  providerPayloads.push(payload);
  return Response.json({
    id: 'chat-test', model: 'solar-pro3-test-version',
    choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Solar의 합성 테스트 응답입니다.' } }],
    usage: { prompt_tokens: 120, completion_tokens: 15, total_tokens: 135 },
  });
};

try {
  let response = await worker.fetch(request(baseBody, 'judy-test-token'), { ...env, ENVIRONMENT: 'production' }, {});
  check('production은 유효 토큰이어도 404', response.status === 404 && (await response.json()).error === 'not found');
  response = await worker.fetch(request(baseBody, 'wrong-token'), { ...env, ENVIRONMENT: 'production' }, {});
  check('production은 잘못된 토큰이어도 인증보다 먼저 404', response.status === 404);

  response = await worker.fetch(request(baseBody, 'judy-test-token', '/api/prompt-experiments/run', { method: 'GET' }), env, {});
  check('development의 POST 외 메서드는 405', response.status === 405 && (await response.json()).error.code === 'METHOD_NOT_ALLOWED');

  response = await worker.fetch(request(baseBody, ''), env, {});
  check('토큰 누락은 401', response.status === 401 && (await response.json()).error.code === 'UNAUTHORIZED');
  response = await worker.fetch(request(baseBody, 'wrong-token'), env, {});
  check('잘못된 토큰은 401', response.status === 401);

  response = await worker.fetch(request('{bad-json', 'judy-test-token'), env, {});
  check('깨진 JSON은 400', response.status === 400 && (await response.json()).error.code === 'INVALID_JSON');
  response = await worker.fetch(request(JSON.stringify({ padding: '한'.repeat(40000) }), 'judy-test-token'), env, {});
  check('UTF-8 기준 100KB 초과 본문은 413', response.status === 413 && (await response.json()).error.code === 'PAYLOAD_TOO_LARGE');
  response = await worker.fetch(request({ ...baseBody, data_classification: 'user-data' }), env, {});
  let body = await response.json();
  check('합성 데이터 선언이 없으면 400', response.status === 400 && body.error.details.includes('data_classification must be synthetic'));
  check('검증 실패는 사용량을 차감하지 않음', kv.rows.size === 0);

  const waits = [];
  response = await worker.fetch(request(), env, { waitUntil: (p) => waits.push(p) });
  body = await response.json();
  await Promise.all(waits);
  check('유효 요청은 실제 Solar 경로로 실행', response.status === 200 && body.result.content === 'Solar의 합성 테스트 응답입니다.');
  check('실제·요청 모델을 반환', body.model.requested === 'solar-pro3' && body.model.resolved === 'solar-pro3-test-version');
  check('provider usage를 보존', body.usage.prompt_tokens === 120 && body.usage.completion_tokens === 15 && body.usage.total_tokens === 135 && body.usage.source === 'provider');
  check('compiled messages와 해시를 반환', body.trace.compiled_messages.length === 3 && /^[a-f0-9]{64}$/.test(body.trace.prompt_hash));
  check('제약과 첫 턴 지시문을 정확히 조립', body.trace.compiled_messages[0].content.includes('추가 제약') && body.trace.compiled_messages[2].content.includes('문장과 감상에 짧게 반응하세요.'));
  check('생성 파라미터와 Solar 모델을 전달', providerPayloads[0].model === 'solar-pro3' && providerPayloads[0].temperature === 0.7 && providerPayloads[0].max_tokens === 180);
  check('호출 한도와 KST 일일 사용량 반환', body.limits.daily.used === 1 && body.limits.daily.limit === 2 && body.limits.daily.timezone === 'Asia/Seoul');
  check('원문 없이 요청별 사용량 로그 저장', [...kv.rows.keys()].some((k) => k.startsWith('pe:run:')) && ![...kv.rows.values()].some((v) => v.includes('가상의 한 문장')));

  const followup = structuredClone(baseBody);
  followup.experiment.variant = 'followup-v1';
  followup.history = [
    { role: 'assistant', content: '어떤 점이 남았어요?' },
    { role: 'user', content: '자세히 말하고 싶지는 않아.' },
  ];
  followup.trace.include_compiled_messages = false;
  response = await worker.fetch(request(followup), env, {});
  body = await response.json();
  check('assistant/user 쌍의 멀티턴을 전달', response.status === 200 && providerPayloads[1].messages[2].role === 'assistant' && providerPayloads[1].messages[3].role === 'user');
  check('후속 지시문 사용·trace 원문 생략', providerPayloads[1].messages.at(-1).content.includes('직전 답변에 먼저 반응') && body.trace.compiled_messages == null);

  response = await worker.fetch(request(), env, {});
  body = await response.json();
  check('일일 호출 제한 초과는 429', response.status === 429 && body.error.code === 'DAILY_LIMIT_EXCEEDED');

  response = await worker.fetch(request(baseBody, 'judy-test-token', '/api/prompt-experiments/run', { headers: { Origin: 'https://other.example' } }), { ...env, PROMPT_EXPERIMENT_DAILY_LIMIT: '100' }, {});
  check('브라우저 Origin 요청은 403', response.status === 403 && (await response.json()).error.code === 'FORBIDDEN_ORIGIN');

  const minuteEnv = { ...env, OTA_KV: new MemoryKV(), PROMPT_EXPERIMENT_DAILY_LIMIT: '100', PROMPT_EXPERIMENT_MINUTE_LIMIT: '1' };
  response = await worker.fetch(request(), minuteEnv, {});
  check('분당 제한 전 요청은 성공', response.status === 200);
  response = await worker.fetch(request(), minuteEnv, {});
  check('분당 호출 제한 초과는 429', response.status === 429 && (await response.json()).error.code === 'MINUTE_LIMIT_EXCEEDED');

  const contractRoot = new URL('../docs/prompt-experiment-api/', import.meta.url);
  const schema = JSON.parse(await readFile(new URL('jacky-experiment-v1.schema.json', contractRoot), 'utf8'));
  const openapi = await readFile(new URL('openapi.yaml', contractRoot), 'utf8');
  check('JSON Schema와 OpenAPI 계약 파일이 유효한 핵심 식별자를 가짐', schema.$schema.includes('2020-12') && schema.properties.protocol_version.const === '1.0' && openapi.includes('openapi: 3.1.0'));

  const exampleEnv = { ...env, OTA_KV: new MemoryKV(), PROMPT_EXPERIMENT_DAILY_LIMIT: '100' };
  for (const name of ['first-turn', 'followup-turn', 'quote', 'thought']) {
    const example = JSON.parse(await readFile(new URL(`examples/${name}.json`, contractRoot), 'utf8'));
    response = await worker.fetch(request(example), exampleEnv, {});
    check(`${name} 문서 예제가 런타임 계약을 통과`, response.status === 200);
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\n${passed} passed`);
