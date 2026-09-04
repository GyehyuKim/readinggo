import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(root, 'docs', 'readinggo');
const jsRoot = path.join(appRoot, 'js');
const jackyRoot = path.join(appRoot, 'public', 'assets', 'jacky');
const read = (file) => fs.readFileSync(file, 'utf8');

function pngInfo(file) {
  const data = fs.readFileSync(file);
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file} must be PNG`);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colorType: data[25],
  };
}

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ['node_modules', 'dist'].includes(entry.name)) return [];
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

test('Jacky production assets are purpose-specific PNGs with required dimensions and alpha', () => {
  const expected = {
    'brand-mark.png': [512, 512, true],
    'launcher.png': [1024, 1024, false],
    'reading-guide.png': [512, 512, true],
    'success.png': [512, 512, true],
    'listening.png': [512, 512, true],
    'favicon-16.png': [16, 16, true],
    'favicon-32.png': [32, 32, true],
    'apple-touch-icon.png': [180, 180, false],
  };
  assert.deepEqual(fs.readdirSync(jackyRoot).sort(), Object.keys(expected).sort());
  for (const [name, [width, height, needsAlpha]] of Object.entries(expected)) {
    const info = pngInfo(path.join(jackyRoot, name));
    assert.deepEqual([info.width, info.height], [width, height], `${name} dimensions`);
    if (needsAlpha) assert.equal(info.colorType, 6, `${name} must be RGBA PNG`);
  }
});

test('runtime uses the raster role split and retired mascot SVG review is absent', () => {
  const main = read(path.join(appRoot, 'main.js'));
  const app = read(path.join(jsRoot, 'app.js'));
  const icons = read(path.join(jsRoot, 'icons.js'));
  const index = read(path.join(appRoot, 'index.html'));
  assert.match(icons, /assets\/jacky\/brand-mark\.png/);
  assert.match(index, /assets\/jacky\/favicon-32\.png/);
  assert.match(index, /assets\/jacky\/apple-touch-icon\.png/);
  assert.doesNotMatch(main + app, /mascot-review|RG_MASCOT_REVIEW|재키 A\/B\/C 비교/);
  const svgFiles = filesUnder(appRoot).filter((file) => file.endsWith('.svg'));
  assert.deepEqual(svgFiles, [], 'hand-coded mascot SVG assets must stay removed');
});

test('retired product implementation and mascot-as-user fallbacks are absent from active JS', () => {
  for (const removed of [
    'book-tree-selector.js', 'book-tree-home-ui.js', 'friend-book-tree-view.js',
  ]) assert.equal(fs.existsSync(path.join(jsRoot, removed)), false, `${removed} must be removed`);
  assert.equal(fs.existsSync(path.join(appRoot, 'supabase', '56_friend_book_tree.sql')), false);

  const source = fs.readdirSync(jsRoot).filter((name) => name.endsWith('.js'))
    .map((name) => read(path.join(jsRoot, name))).join('\n');
  const sourceWithoutTabAliases = source.replace(/function normalizeTab\(tab\) \{[\s\S]*?\n\}/, '');
  for (const retired of ['book-tree', 'bookTree', 'BookTree', 'friendBookTree', 'friend_book_tree', '책나무', 'nest-grow']) {
    assert.equal(sourceWithoutTabAliases.includes(retired), false, `active JS outside compatibility boundary contains retired marker: ${retired}`);
  }
  assert.doesNotMatch(source, /avatar\s*:[^\n]*SparrowMark|display_name[^\n]*SparrowMark|RG_ME[^\n]*SparrowMark/);
  assert.match(read(path.join(jsRoot, 'companion.js')), /_JackAvatar[\s\S]*<window\.SparrowMark/);
});

test('retired DEV RPCs have an idempotent cleanup migration', () => {
  const cleanup = read(path.join(appRoot, 'supabase', '59_friend_book_tree_retirement.dev.sql'));
  for (const signature of [
    'friend_book_tree_leaves(uuid, uuid, integer, integer)',
    'friend_book_tree(uuid)',
    'friend_book_tree_sharing_status()',
    'friend_book_tree_set_sharing(boolean)',
    'friend_book_tree_sharing_enabled(uuid)',
  ]) assert.match(cleanup, new RegExp(`drop function if exists public\\.${signature.replace(/[()]/g, '\\$&')}`, 'i'));
  assert.match(cleanup, /settings\s*=\s*settings\s*-\s*'friend_tree_sharing'/i);
  assert.doesNotMatch(cleanup, /^\s*(?:begin|commit)\s*;/im,
    'migrate-dev workflow가 transaction을 소유하므로 migration 자체 transaction 금지');
});

test('built bundle excludes retired mascot comparison in every environment', { skip: !['0', '1'].includes(process.env.EXPECT_MASCOT_REVIEW) }, () => {
  const assets = path.join(appRoot, 'dist', 'assets');
  const bundle = fs.readdirSync(assets).filter((name) => /\.(?:js|css|html)$/.test(name))
    .map((name) => read(path.join(assets, name))).join('\n');
  for (const marker of ['Jacky / 재키 모델 시트 비교', 'Candidate A · Balanced Sage', 'CANDIDATES, NOT CANONICAL']) {
    assert.equal(bundle.includes(marker), false, `${marker} must stay retired`);
  }
});
