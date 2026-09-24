import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { projectChapters } from './chapter-core.js';
import { buildChapterViewModel, parseChapterPaste, validateChapterDraft } from './chapter-ui.js';

const sentence = (id, page, created_at = '2026-01-01T00:00:00Z') => ({ id, page, created_at });

test('paste parser supports tab and pipe rows and keeps indentation as an editable depth candidate', () => {
  const parsed = parseChapterPaste('Part 1\t1\n  Child | 12\n\tGrandchild\t20\n\nAppendix | 90');
  assert.equal(parsed.count, 4);
  assert.deepEqual(parsed.rows, [
    { title:'Part 1', start_page:'1', depth:0, position:0 },
    { title:'Child', start_page:'12', depth:1, position:1 },
    { title:'Grandchild', start_page:'20', depth:1, position:2 },
    { title:'Appendix', start_page:'90', depth:0, position:3 },
  ]);
});

test('malformed paste remains in the draft and validation reports row-level errors', () => {
  const parsed = parseChapterPaste('No page here\n | nope\nNo page here');
  assert.equal(parsed.count, 3);
  const checked = validateChapterDraft(parsed.rows, 100);
  assert.equal(checked.valid, false);
  assert.ok(checked.errors.some(error => error.index === 0 && error.code === 'start_page_invalid'));
  assert.ok(checked.errors.some(error => error.index === 1 && error.code === 'title_required'));
  assert.ok(checked.errors.some(error => error.index === 2 && error.code === 'duplicate_row'));
});

test('draft validation canonicalizes positions and blocks order, depth, and total-page errors', () => {
  const checked = validateChapterDraft([
    { title:'A', start_page:'10', depth:'0' },
    { title:'B', start_page:'9', depth:'2' },
    { title:'C', start_page:'101', depth:'0' },
  ], 100);
  assert.equal(checked.valid, false);
  assert.deepEqual(checked.rows.map(row => row.position), [0, 1, 2]);
  assert.ok(checked.errors.some(error => error.index === 1 && error.code === 'start_page_not_increasing'));
  assert.ok(checked.errors.some(error => error.index === 1 && error.code === 'depth_jump'));
  assert.ok(checked.errors.some(error => error.index === 2 && error.code === 'start_page_over_total'));
});

test('chapter render model starts collapsed, preserves hierarchy/counts, and exposes sentences only after expansion', () => {
  const projection = projectChapters([
    { title:'Part', start_page:1, depth:0, position:0 },
    { title:'Child', start_page:10, depth:1, position:1 },
  ], [sentence('parent', 2), sentence('child', 10)], 100);
  const collapsed = buildChapterViewModel(projection, 'chapters');
  assert.deepEqual(collapsed.groups.map(group => [group.title, group.depth, group.direct_count, group.aggregate_count, group.expanded, group.visible_sentences.length]), [
    ['Part', 0, 1, 2, false, 0], ['Child', 1, 1, 1, false, 0],
  ]);
  const expanded = buildChapterViewModel(projection, 'chapters', new Set([1]));
  assert.deepEqual(expanded.groups[1].visible_sentences.map(row => row.id), ['child']);
  assert.equal(expanded.groups[0].visible_sentences.length, 0);
});

test('bucket render models use project output without duplicating or guessing sentences', () => {
  const projection = projectChapters([{ title:'One', start_page:5, depth:0, position:0 }], [
    sentence('inside', 5), sentence('missing', null), sentence('outside', 2),
  ], 20);
  assert.deepEqual(buildChapterViewModel(projection, 'all').sentences.map(row => row.id), ['outside', 'missing', 'inside']);
  assert.deepEqual(buildChapterViewModel(projection, 'page_missing').sentences.map(row => row.id), ['missing']);
  assert.deepEqual(buildChapterViewModel(projection, 'outside_toc').sentences.map(row => row.id), ['outside']);
});

test('BookDetailModal chapter editor keeps the atomic owner contract and accessible grouped controls', async () => {
  const source = await readFile(new URL('./book-detail-modal.js', import.meta.url), 'utf8');
  assert.equal((source.match(/DataStore\.chapters\.replace\(/g) || []).length, 1);
  assert.match(source, /window\.confirm\(`목차/);
  assert.match(source, /DataStore\.chapters\.list\(book\.ubId\)/);
  assert.doesNotMatch(source, /chapters\.publicByBook/);
  assert.match(source, /role="tablist" aria-label="문장 보기"/);
  assert.match(source, /aria-expanded=\{group\.expanded\}/);
  assert.match(source, /chapterModel\.groups\.map/);
  assert.match(source, /bookQuotes\.map\(renderQuoteCard\)/);
  assert.match(source, /group\.visible_sentences\.map\(renderQuoteCard\)/);
});
