import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(root, 'docs', 'readinggo');
const jsRoot = path.join(appRoot, 'js');
const read = (file) => fs.readFileSync(file, 'utf8').replaceAll('\0', '');

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function productionModuleGraph(entry) {
  const seen = new Set();
  const visit = (file) => {
    const absolute = path.resolve(file);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const source = read(absolute);
    const imports = source.matchAll(/(?:import\s+(?:[^'";]+?\s+from\s+)?|import\s*\()\s*['"]([^'"]+)['"]/g);
    for (const match of imports) {
      if (!match[1].startsWith('.')) continue;
      let target = path.resolve(path.dirname(absolute), match[1]);
      if (!path.extname(target)) target += '.js';
      if (fs.existsSync(target)) visit(target);
    }
  };
  visit(entry);
  return [...seen];
}

test('production graph keeps nest-grow as the internal book-tree route without legacy modules', () => {
  const app = read(path.join(jsRoot, 'app.js'));
  assert.match(app, /activeTab === 'nest-grow'[\s\S]*BookTreeHomeView/);

  const graph = productionModuleGraph(path.join(appRoot, 'main.js'));
  const relativeGraph = graph.map((file) => path.relative(appRoot, file));
  for (const legacy of ['js/nest-theatre.js', 'js/nest-grow.js', 'js/streak-repair-copy.js']) {
    assert.equal(fs.existsSync(path.join(appRoot, legacy)), false, `${legacy} must be physically removed`);
    assert.equal(relativeGraph.includes(legacy), false, `${legacy} must not be production-reachable`);
  }

  const productionSource = graph.map((file) => stripComments(read(file))).join('\n');
  const forbidden = [
    /\bNEST_CYCLE_XP\b/, /\bNEST_STAGES\b/, /\bXP_RULES\b/,
    /\bcomputeCheckinXp\b/, /\breactionXpFor\b/, /\bgrantXp\b/,
    /\bnestCastleCount\b/, /\bnestXpProgress\b/, /\bgetNestStageByXp\b/,
    /\bnestUp\b/, /\bskipStreakRisk\b/,
    /DataStore\.xp\b/, /\bcastles\s*:/, /\brepairStatus\s*\(/,
    /\bstreak_repair(?:ed|_failed|_viewed)?\b/,
    /\bnest_(?:tab_viewed|growth_guide_opened|completion_viewed)\b/,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(productionSource, pattern);
});

test('dedicated nest evolution assets and CSS are physically absent; shared sparrow remains', () => {
  const html = read(path.join(appRoot, 'index.html'));
  const icons = read(path.join(jsRoot, 'icons.js'));
  for (const selector of ['nest-theatre', 'nest-health', 'nest-progress', 'nest-evo', 'fall-twig', 'crack-overlay', 'demo-decay']) {
    assert.equal(html.includes(selector), false, `${selector} CSS must be absent`);
  }
  for (const asset of ['lv1.png', 'lv2.png', 'lv3.png', 'lv4.png', 'lv5.png']) {
    assert.equal(fs.existsSync(path.join(appRoot, 'public', 'assets', 'nest', asset)), false, `assets/nest/${asset} must be physically removed`);
  }
  assert.equal(fs.existsSync(path.join(appRoot, 'public', 'assets', 'sparrow.svg')), true);
  assert.match(icons, /function SparrowMark\b/);
  assert.doesNotMatch(icons, /\bNEST_ART\b|function nestArt\b/);
});

test('local and Supabase DataStore contracts have no XP, castle, or streak-repair API', () => {
  for (const file of ['datastore.js', 'datastore-supabase.js']) {
    const source = stripComments(read(path.join(jsRoot, file)));
    assert.doesNotMatch(source, /\bxp\s*:\s*\{/);
    assert.doesNotMatch(source, /\bcastles\s*:\s*\{/);
    assert.doesNotMatch(source, /\brepairStatus\s*\(/);
    assert.doesNotMatch(source, /\b(?:async\s+)?repair\s*\(/);
    assert.doesNotMatch(source, /last_repair_date|increment_xp/);
  }

  const data = stripComments(read(path.join(jsRoot, 'data.js')));
  assert.doesNotMatch(data, /\bINITIAL_STATE\b[\s\S]*?\b(?:xp|nest|shield)\s*:/);
});
