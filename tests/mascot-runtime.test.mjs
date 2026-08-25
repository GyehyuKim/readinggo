import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(root, 'docs', 'readinggo');
const jsRoot = path.join(appRoot, 'js');
const candidatesRoot = path.join(jsRoot, 'mascot-candidates');
const read = (file) => fs.readFileSync(file, 'utf8');

const candidateFiles = ['jacky-candidate-a.svg', 'jacky-candidate-b.svg', 'jacky-candidate-c.svg'];
const requiredViews = ['face-icon', 'full-body-front', 'full-body-side', 'emotion-calm', 'emotion-welcome', 'emotion-curious', 'emotion-empathy', 'preview-48'];

test('three candidate SVG model sheets are complete, self-contained, and retain Jacky identity', () => {
  assert.deepEqual(fs.readdirSync(candidatesRoot).sort(), candidateFiles);
  candidateFiles.forEach((name, index) => {
    const svg = read(path.join(candidatesRoot, name));
    assert.match(svg, new RegExp(`data-candidate="${String.fromCharCode(65 + index)}"`));
    assert.match(svg, /Jacky \/ 재키/);
    assert.match(svg, /~2\.5 heads/);
    assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org\/2000\/svg)/, `${name} must not reference external assets`);
    for (const view of requiredViews) assert.match(svg, new RegExp(`id="${view}"`), `${name} is missing ${view}`);
  });
});

test('DEV comparison is gated and exposes equal A/B/C, 48px, auditable criteria, and keyboard-native controls', () => {
  const main = read(path.join(appRoot, 'main.js'));
  const app = read(path.join(jsRoot, 'app.js'));
  const review = read(path.join(jsRoot, 'mascot-review.js'));
  assert.match(main, /VITE_READINGGO_ENV === 'development'[\s\S]*import\('\.\/js\/mascot-review\.js'\)/);
  assert.match(app, /RG_DEV_REVIEW_ENABLED && mascotReviewOpen && window\.RG_MASCOT_REVIEW/);
  assert.match(app, /재키 A\/B\/C 비교/);
  assert.equal([...review.matchAll(/id: '[ABC]'/g)].length, 3);
  assert.equal([...review.matchAll(/\['(?:small|views|emotion|brand|surface|identity|meaning)'/g)].length, 7);
  assert.match(review, /width: 48, height: 48/);
  assert.match(review, /repeat\(auto-fit, minmax/);
  assert.match(review, /<button[^>]+aria-pressed=/);
  assert.match(review, /aria-labelledby="mascot-review-title"/);
});

test('retired product implementation and mascot-as-user fallbacks are absent from active JS', () => {
  for (const removed of [
    'book-tree-selector.js', 'book-tree-home-ui.js', 'friend-book-tree-view.js',
  ]) assert.equal(fs.existsSync(path.join(jsRoot, removed)), false, `${removed} must be removed`);
  assert.equal(fs.existsSync(path.join(appRoot, 'supabase', '56_friend_book_tree.sql')), false);

  const source = fs.readdirSync(jsRoot).filter((name) => name.endsWith('.js'))
    .map((name) => read(path.join(jsRoot, name))).join('\n');
  for (const retired of ['book-tree', 'bookTree', 'BookTree', 'friendBookTree', 'friend_book_tree', '책나무', 'nest-grow']) {
    assert.equal(source.includes(retired), false, `active JS contains retired marker: ${retired}`);
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
});

test('built bundle contains comparison only for explicit development build', { skip: !['0', '1'].includes(process.env.EXPECT_MASCOT_REVIEW) }, () => {
  const assets = path.join(appRoot, 'dist', 'assets');
  const bundle = fs.readdirSync(assets).filter((name) => /\.(?:js|svg)$/.test(name))
    .map((name) => read(path.join(assets, name))).join('\n');
  const expected = process.env.EXPECT_MASCOT_REVIEW === '1';
  for (const marker of ['Jacky / 재키 모델 시트 비교', 'Candidate A · Balanced Sage', 'CANDIDATES, NOT CANONICAL']) {
    assert.equal(bundle.includes(marker), expected, `${marker} DEV boundary mismatch`);
  }
});
