import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const dataSource = fs.readFileSync(new URL('../docs/readinggo/js/data.js', import.meta.url), 'utf8');
const growSource = fs.readFileSync(new URL('../docs/readinggo/js/nest-grow.js', import.meta.url), 'utf8');
const helperStart = growSource.indexOf('function rgNestGrowthModel');
const helperEnd = growSource.indexOf('\nfunction NestGrowView', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, '둥지 진행 helper를 찾을 수 있어야 한다');

const sandbox = {
  window: {},
  document: {},
  console,
  fetch: () => {},
  setTimeout,
  clearTimeout,
};
vm.createContext(sandbox);
vm.runInContext(dataSource, sandbox);
vm.runInContext(
  `${growSource.slice(helperStart, helperEnd)}\nthis.model = rgNestGrowthModel;`,
  sandbox,
);
const model = sandbox.model;

const cases = [
  [-1,       1, 1, 0,   0, 100],
  [0,        1, 1, 0,   0, 100],
  [99,       1, 1, 0,  99,   1],
  [100,      2, 1, 0, 100, 300],
  [101,      2, 1, 0, 101, 299],
  [399,      2, 1, 0, 399,   1],
  [400,      3, 1, 0, 400, 500],
  [401,      3, 1, 0, 401, 499],
  [899,      3, 1, 0, 899,   1],
  [900,      4, 1, 0, 900, 700],
  [1599,     4, 1, 0, 1599,  1],
  [1600,     1, 2, 1,   0, 100],
  [1601,     1, 2, 1,   1,  99],
  [3200,     1, 3, 2,   0, 100],
  [4899,     1, 4, 3,  99,   1],
];

for (const [xp, stage, nestNumber, completed, cycleXp, remainingXp] of cases) {
  const result = model(xp);
  assert.deepEqual(
    {
      stage: result.cycleStage,
      nestNumber: result.nestNumber,
      completed: result.completedNestCount,
      cycleXp: result.cycleXp,
      remainingXp: result.remainingXp,
    },
    { stage, nestNumber, completed, cycleXp, remainingXp },
    `XP ${xp}의 단계·주기·완성·남은 XP를 계약대로 파생한다`,
  );
}

for (const invalid of [undefined, null, '', 'not-a-number', Number.NaN, Infinity, -Infinity]) {
  assert.equal(model(invalid).totalXp, 0, `비정상 XP ${String(invalid)}는 0으로 정규화한다`);
}
assert.equal(model('1700').cycleStage, 2, '숫자 문자열 XP도 안전하게 정규화한다');
assert.equal(model(1700.9).totalXp, 1700, '소수 XP는 정수 누적값으로 정규화한다');

assert.match(growSource, /rgTrack\('nest_tab_viewed', analyticsProps\)/);
assert.match(growSource, /rgTrack\('nest_growth_guide_opened', analyticsProps\)/);
assert.match(growSource, /rgTrack\('nest_completion_viewed', analyticsProps\)/);
assert.match(growSource, /cycle_stage:\s*growth\.cycleStage/);
assert.match(growSource, /completed_nest_count:\s*castleCount/);
assert.doesNotMatch(
  growSource.slice(growSource.indexOf('const analyticsProps'), growSource.indexOf('};', growSource.indexOf('const analyticsProps'))),
  /totalXp|book|sentence/,
  '둥지 analytics 속성에 totalXp·책·한 문장 정보를 넣지 않는다',
);

console.log(`nest-progress: ${cases.length + 12} passed`);
