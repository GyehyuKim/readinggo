import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const data = readFileSync(new URL('../docs/readinggo/js/data.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../docs/readinggo/js/app.js', import.meta.url), 'utf8');

const countSource = data.match(/function nestCastleCount\(totalXp\)\{[^}]+\}/)?.[0];
assert.ok(countSource, 'nestCastleCount 구현을 찾을 수 있어야 한다');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`const NEST_CYCLE_XP = 1600; ${countSource}; this.count = nestCastleCount;`, sandbox);

for (const [xp, expected] of [
  [-1, 0],
  [0, 0],
  [1599, 0],
  [1600, 1],
  [3199, 1],
  [3200, 2],
]) {
  assert.equal(sandbox.count(xp), expected, `${xp} XP의 완성 둥지 수`);
}

const topbar = app.slice(app.indexOf('<div className="topbar-stats">'), app.indexOf('{/* 로그인 모달 */'));
assert.match(topbar, /XP \{\(appState\.xp \|\| 0\)\.toLocaleString\(\)\}/, 'TopBar는 XP를 유지해야 한다');
assert.match(topbar, /· 🪺 둥지 \{nestCastleCount\(appState\.xp\)\}개/, 'TopBar는 완성 둥지 수 SSOT를 사용해야 한다');
assert.doesNotMatch(topbar, /Lv\.|calcLevel/, 'TopBar에 사용자 Lv가 남으면 안 된다');
assert.doesNotMatch(data, /function calcLevel|window\.calcLevel/, '폐기한 사용자 레벨 계산/API가 남으면 안 된다');

console.log('✓ #1415 TopBar XP·완성 둥지 수 계약');
