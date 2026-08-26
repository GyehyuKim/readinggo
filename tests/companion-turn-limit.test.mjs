import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import worker from '../worker/index.mjs';

const source = readFileSync(new URL('../docs/readinggo/js/companion.js', import.meta.url), 'utf8');
const parserSource = source.match(/function parseNoteToExchanges[\s\S]*?\n}\n\n\/\* ── 문장별/)[0].replace(/\n\n\/\* ── 문장별[\s\S]*$/, '');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${parserSource}; this.parseNoteToExchanges = parseNoteToExchanges;`, sandbox);

const note = (count) => Array.from({ length: count }, (_, i) => `Q. 질문 ${i + 1}\nA. 답 ${i + 1}`).join('\n\n');
for (const count of [1, 2, 3, 4, 9, 10, 12]) {
  assert.equal(sandbox.parseNoteToExchanges(note(count)).length, count, `저장 Q/A ${count}개를 그대로 세야 한다`);
}
assert.match(source, /const COMPANION_MAX_TURNS = 10/);
assert.match(source, /past\.length >= COMPANION_MAX_TURNS/);
assert.doesNotMatch(source, /consent !== 'yes'/, '선택 미동의가 AI 대화를 단발 종료하면 안 된다');
assert.match(source, /archiveCompanion[\s\S]*RG_consent[\s\S]*=== 'yes'/, '미동의 대화는 아카이브하지 않아야 한다');
for (const event of ['answer_saved', 'companion_q_regen', 'companion_q_rated', 'companion_preset_set']) {
  assert.match(source, new RegExp(`consent === 'yes'[^\\n]*${event}`), `${event}는 선택 동의자만 분석해야 한다`);
}
assert.match(source, /RG_openBookshelfRecord/, '캡 CTA는 책장의 기록으로 이동해야 한다');

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key) || null; }
  async put(key, value) { this.map.set(key, value); }
}
const request = (exchanges = [], ip = '203.0.113.10') => new Request('https://readinggo.test/api/companion', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
  body: JSON.stringify({ sentence: '한 문장', bookTitle: '책', exchanges }),
});

const env = { APP_KV: new MemoryKV() };
let response = await worker.fetch(request(Array.from({ length: 9 }, (_, i) => ({ q: `q${i}`, a: `a${i}` }))), env, {});
assert.equal(response.status, 200, '저장 9턴은 마지막 질문 생성을 허용해야 한다');
response = await worker.fetch(request(Array.from({ length: 10 }, (_, i) => ({ q: `q${i}`, a: `a${i}` })), '203.0.113.11'), env, {});
assert.equal(response.status, 409, '저장 10턴 이상은 API가 새 추론을 거절해야 한다');

const rateEnv = { APP_KV: new MemoryKV() };
for (let i = 0; i < 40; i++) {
  response = await worker.fetch(request([], '203.0.113.12'), rateEnv, {});
  assert.equal(response.status, 200, `분당 허용 요청 ${i + 1}은 통과해야 한다`);
}
response = await worker.fetch(request([], '203.0.113.12'), rateEnv, {});
assert.equal(response.status, 429, 'companion 41번째 분당 요청은 차단해야 한다');

console.log('✓ companion cumulative turn, consent boundary, API cap and rate-limit regression');
