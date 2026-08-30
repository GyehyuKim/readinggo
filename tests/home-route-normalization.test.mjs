import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('docs/readinggo/js/app.js', 'utf8');
const source = app.match(/function normalizeTab\(tab\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(source, 'normalizeTab boundary must exist');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source}; this.normalizeTab = normalizeTab;`, sandbox);
const { normalizeTab } = sandbox;

test('legacy tab inputs normalize to canonical routes', () => {
  assert.equal(normalizeTab('nest'), 'home');
  assert.equal(normalizeTab('nest-grow'), 'library');
  assert.equal(normalizeTab('social'), 'social');
});

test('runtime state and output use canonical home after the alias boundary', () => {
  assert.equal(app.split(source).length - 1, 1, 'normalizeTab boundary must appear exactly once');
  const canonicalRuntime = app.replace(source, '');

  assert.match(canonicalRuntime, /useState\('home'\)/);
  assert.match(canonicalRuntime, /setActiveTab\(normalizeTab\(tab\)\)/);
  assert.match(canonicalRuntime, /activeTab === 'home'/);
  assert.match(canonicalRuntime, /<HomeView[\s\S]*key="home"/);
  assert.match(canonicalRuntime, /\{ id: 'home', label: '홈'/);
  assert.doesNotMatch(canonicalRuntime, /['"]nest(?:-grow)?['"]/);
});
