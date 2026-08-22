import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(path, 'utf8');
const data = read('docs/readinggo/js/data.js');
const app = read('docs/readinggo/js/app.js');
const nest = read('docs/readinggo/js/nest.js');
const sentenceCard = read('docs/readinggo/js/sentence-card.js');
const batch = read('docs/readinggo/js/book-detail-modal.js');
const dataImport = read('docs/readinggo/js/data-import.js');
const xpFreezeMigration = read('docs/readinggo/supabase/54_freeze_increment_xp.sql');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} compatibility shim이 유지돼야 한다`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} 끝을 찾을 수 없음`);
}

const calls = [];
const sandbox = {
  window: {
    DataStore: { xp: { add: (...args) => calls.push(['xp.add', ...args]) } },
    dispatchEvent: (...args) => calls.push(['event', ...args]),
  },
};
sandbox.DataStore = sandbox.window.DataStore;
vm.createContext(sandbox);
vm.runInContext(`${extractFunction(data, 'grantXp')}; this.grantXp = grantXp;`, sandbox);
assert.equal(sandbox.grantXp(200, 'legacy-call'), 0, '구 호출 shim은 보상을 0으로 중립화해야 한다');
assert.deepEqual(calls, [], '구 grantXp 호출도 DB write/event를 만들면 안 된다');

for (const [name, source] of Object.entries({ app, nest, sentenceCard, batch, dataImport })) {
  assert.doesNotMatch(source, /DataStore\.xp\.add\s*\(|grantXp\s*\(/,
    `${name} 신규 사용자 경로는 XP write helper를 호출하면 안 된다`);
}
assert.doesNotMatch(app, /(?:DataStore|DS)\.xp\.get\s*\(/,
  '신규 app bootstrap·hydration·저장 정합 경로는 XP를 읽으면 안 된다');
assert.match(app, /xp:\s*0[\s\S]*nest:\s*\{\s*lv:\s*1\s*\}/,
  '신규 app state의 legacy XP·nest 필드는 호환용 중립값이어야 한다');
assert.match(nest, /const xpGain = 0;/,
  '체크인 낙관 상태도 XP를 올리지 않아야 한다');

assert.match(xpFreezeMigration, /create or replace function public\.increment_xp\(p_amount int\)[\s\S]*returns int[\s\S]*security invoker/i,
  '구 APK용 increment_xp(int) 함수 서명과 RLS 경계를 유지해야 한다');
assert.match(xpFreezeMigration, /select coalesce\([\s\S]*select xp[\s\S]*where id = auth\.uid\(\)/i,
  '구 RPC는 기존 XP를 읽어 반환해야 한다');
const functionBody = xpFreezeMigration.match(/as \$fn\$([\s\S]*?)\$fn\$/i)?.[1] || '';
assert.doesNotMatch(functionBody, /\b(?:update|insert|delete)\b/i,
  '구 RPC 호환 함수는 XP나 사용자 행을 쓰면 안 된다');
assert.match(xpFreezeMigration, /grant execute on function public\.increment_xp\(int\) to authenticated/i,
  '구 APK authenticated 실행 권한을 유지해야 한다');

const sessionsAt = app.indexOf('DataStore.sessions.addToday({ userBookId: ubId');
const sentenceAt = app.indexOf('DataStore.sentences.add({ userBookId: ubId', sessionsAt);
const completionAt = app.indexOf('if (completion && completion.onSuccess)', sentenceAt);
assert.ok(sessionsAt >= 0 && sentenceAt > sessionsAt && completionAt > sentenceAt,
  '문장 저장은 세션/진도 영속 뒤 실행되고 성공 callback은 모든 저장 뒤 실행돼야 한다');
assert.match(app, /rating_present:[\s\S]*review_present:/,
  '완독 별점·소감 추적 계약을 보존해야 한다');

console.log('✓ #1453 Phase 3-B 신규 XP write 차단·영속 순서 회귀 계약');