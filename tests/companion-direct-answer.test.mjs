import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker/index.mjs';

const client = fs.readFileSync('docs/readinggo/js/companion.js', 'utf8');

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key) || null; }
  async put(key, value) { this.map.set(key, value); }
}

const sentence = '우리마다 바닥에서 자는 돼지들이 쉰 마리씩 갇혀 있는데 그것들은 새끼를 낳는 암퇘지이고, 수지는 밖에서 잠을 잤다. 그래도 수지는 삼백육십 마리나 되었다.';
const userQuestion = '그럼 암퇘지를 포함한 전체 돼지 숫자를 유추해볼랫';
const requestBody = {
  sentence,
  exchanges: [{
    q: '혹시 이런 세부적인 묘사가 이야기에 더 몰입하게 만드는 데 도움이 되던가요?',
    a: userQuestion,
  }],
  preset: 'deep',
  avoid: '그 많은 암컷 돼지들이 낳은 새끼들은 어떻게 쓰였을지 궁금하네요.',
};
const makeRequest = (body, ip) => new Request('https://readinggo.test/api/companion', {
  method: 'POST',
  headers: { 'content-type': 'application/json', Origin: 'https://readinggo.test', 'CF-Connecting-IP': ip },
  body: JSON.stringify(body),
});

const originalFetch = globalThis.fetch;
let providerPayload = null;
globalThis.fetch = async (_url, init) => {
  providerPayload = JSON.parse(init.body);
  return new Response(JSON.stringify({ choices: [{ message: { content: '암퇘지는 12칸×50마리로 600마리이고, 밖의 수지 360마리를 더하면 본문에 나온 전체는 960마리예요.' } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
try {
  let response = await worker.fetch(makeRequest(requestBody, '203.0.113.31'), {
    ENVIRONMENT: 'development', APP_KV: new MemoryKV(),
    LLM_BASE_URL: 'https://llm.test/v1', LLM_MODEL: 'test-model', UPSTAGE_API_KEY: 'test-key',
  }, {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.message, data.question, 'message와 레거시 question은 같은 assistant 턴이어야 한다');
  assert.match(data.message, /960/);
  const compiled = providerPayload.messages.map((message) => message.content).join('\n');
  assert.match(compiled, /질문·계산·설명 요청[\s\S]*직접 답/,
    '최신 사용자 질문에는 직접 답하도록 compiled prompt가 지시해야 한다');
  assert.match(compiled, /수량[\s\S]*식[\s\S]*전제/,
    '본문 수량 계산은 식과 전제를 밝히도록 지시해야 한다');
  assert.doesNotMatch(compiled, /사용자가 방금 한 답변에[\s\S]*질문 하나만/,
    '최신 발화를 답변으로 고정해 질문만 강제하면 안 된다');
  assert.match(compiled, /직전 재키 응답[\s\S]*질문으로 돌리지 말고[\s\S]*정확성과 근거/,
    '재생성도 직접 질문을 새 질문으로 돌리지 말고 답을 개선해야 한다');
  assert.doesNotMatch(compiled, /다르게 물으세요/,
    '재생성 instruction이 다시 질문하도록 강제하면 안 된다');
  assert.match(compiled, /질문의 결[\s\S]*직접 답변[\s\S]*후순위|직접 답변[\s\S]*질문의 결[\s\S]*후순위/,
    'deep preset도 직접 답변보다 후순위여야 한다');

  response = await worker.fetch(makeRequest(requestBody, '203.0.113.32'), {
    ENVIRONMENT: 'development', APP_KV: new MemoryKV(),
  }, {});
  const fallback = await response.json();
  assert.equal(fallback.message, fallback.question);
  assert.match(fallback.message, /정확히 답하지 못했어요/,
    'LLM 미설정 시 직접 질문에는 무관한 탐색 질문 대신 정직한 fallback을 반환해야 한다');
  assert.doesNotMatch(fallback.message, /무엇이 떠오르|왜 이 문장|누군가에게 들려준다면/);
} finally {
  globalThis.fetch = originalFetch;
}

assert.match(client, /function readCompanionMessage[\s\S]*data\.message[\s\S]*data\.question/,
  '클라이언트는 message를 우선하고 legacy question을 fallback으로 읽어야 한다');
assert.match(client, /placeholder="답하거나 궁금한 걸 물어보세요"/,
  '입력칸은 답변 전용이 아니라 일반 대화임을 알려야 한다');
assert.match(client, /aria-label="재키 답변 다시 받기"/,
  '재생성은 질문이 아니라 재키 답변을 다시 받는 의미여야 한다');

console.log('✓ companion direct-answer prompt, compatibility, fallback and UI semantics');
