import { validateChapterRows } from './chapter-core.js';

function strictInteger(value) {
  if (Number.isSafeInteger(value)) return value;
  const text = String(value == null ? '' : value).trim();
  return /^-?\d+$/.test(text) ? Number(text) : value;
}

function indentationDepth(prefix) {
  let depth = 0;
  let spaces = 0;
  for (const char of prefix) {
    if (char === '\t') { depth += 1; spaces = 0; }
    else if (char === ' ') {
      spaces += 1;
      if (spaces === 2) { depth += 1; spaces = 0; }
    }
  }
  return depth;
}

export function parseChapterPaste(input) {
  const rows = [];
  String(input == null ? '' : input).split(/\r?\n/).forEach((original) => {
    if (!original.trim()) return;
    const prefix = (original.match(/^[\t ]*/) || [''])[0];
    const content = original.slice(prefix.length);
    const tabAt = content.lastIndexOf('\t');
    const pipeAt = content.lastIndexOf('|');
    const separatorAt = tabAt >= 0 ? tabAt : pipeAt;
    const title = separatorAt >= 0 ? content.slice(0, separatorAt).trim() : content.trim();
    const page = separatorAt >= 0 ? content.slice(separatorAt + 1).trim() : '';
    rows.push({ title, start_page: page, depth: indentationDepth(prefix), position: rows.length });
  });
  return { rows, count: rows.length };
}

export function validateChapterDraft(input, totalPages = null) {
  const draft = Array.isArray(input) ? input : [];
  const candidate = draft.map((row, position) => ({
    title: String((row && row.title) == null ? '' : row.title).trim(),
    start_page: strictInteger(row && row.start_page),
    depth: strictInteger(row && row.depth),
    position,
  }));
  const result = validateChapterRows(candidate, totalPages);
  const errors = result.errors.slice();
  const seen = new Map();
  candidate.forEach((row, index) => {
    const signature = `${row.title}\u0000${String(row.start_page)}\u0000${String(row.depth)}`;
    if (seen.has(signature)) errors.push({ index, code: 'duplicate_row' });
    else seen.set(signature, index);
  });
  return { valid: errors.length === 0, rows: result.rows, errors };
}

export function buildChapterViewModel(projection, requestedView = 'all', expandedInput = []) {
  const source = projection || { hasToc:false, all:[], chapters:[], page_missing:[], outside_toc:[], counts:{} };
  if (!source.hasToc) return { view:'all', sentences:source.all || [], groups:[], counts:source.counts || {} };
  const allowed = new Set(['all', 'chapters', 'page_missing', 'outside_toc']);
  const view = allowed.has(requestedView) ? requestedView : 'all';
  if (view === 'all') return { view, sentences:source.all || [], groups:[], counts:source.counts || {} };
  if (view === 'page_missing') return { view, sentences:source.page_missing || [], groups:[], counts:source.counts || {} };
  if (view === 'outside_toc') return { view, sentences:source.outside_toc || [], groups:[], counts:source.counts || {} };
  const expanded = expandedInput instanceof Set ? expandedInput : new Set(expandedInput || []);
  const groups = (source.chapters || []).filter(row => row.aggregate_count > 0).map(row => ({
    ...row,
    expanded: expanded.has(row.position),
    visible_sentences: expanded.has(row.position) ? row.sentences : [],
  }));
  return { view, sentences:[], groups, counts:source.counts || {} };
}

if (typeof window !== 'undefined') {
  window.RG_chapterUI = { parsePaste:parseChapterPaste, validateDraft:validateChapterDraft, buildViewModel:buildChapterViewModel };
}
