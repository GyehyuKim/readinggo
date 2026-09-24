/* Pure chapter validation and sentence projection for #1627. */
function finitePositiveInteger(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

function normalizedTotalPages(value) {
  return finitePositiveInteger(value) ? value : null;
}

export function validateChapterRows(input, totalPages = null) {
  const rows = Array.isArray(input) ? input : [];
  const total = normalizedTotalPages(totalPages);
  const errors = [];
  const normalized = rows.map((source, index) => {
    const row = source && typeof source === 'object' ? source : {};
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const startPage = row.start_page;
    const depth = row.depth;
    const position = row.position;
    const rowErrors = [];
    if (!title) rowErrors.push('title_required');
    if (!finitePositiveInteger(startPage)) rowErrors.push('start_page_invalid');
    if (total !== null && finitePositiveInteger(startPage) && startPage > total) rowErrors.push('start_page_over_total');
    if (!Number.isSafeInteger(depth) || depth < 0) rowErrors.push('depth_invalid');
    if (!Number.isSafeInteger(position) || position !== index) rowErrors.push('position_invalid');
    if (index === 0 && depth !== 0) rowErrors.push('first_depth_invalid');
    if (index > 0) {
      const previous = rows[index - 1] || {};
      if (finitePositiveInteger(startPage) && finitePositiveInteger(previous.start_page) && startPage <= previous.start_page) {
        rowErrors.push(startPage === previous.start_page ? 'start_page_duplicate' : 'start_page_not_increasing');
      }
      if (Number.isSafeInteger(depth) && Number.isSafeInteger(previous.depth) && depth > previous.depth + 1) {
        rowErrors.push('depth_jump');
      }
    }
    rowErrors.forEach(code => errors.push({ index, code }));
    return { title, start_page: startPage, depth, position };
  });
  return { valid: errors.length === 0, rows: normalized, errors };
}

export function assertValidChapterRows(input, totalPages = null) {
  const result = validateChapterRows(input, totalPages);
  if (!result.valid) {
    const error = new Error('invalid_chapter_rows');
    error.code = 'invalid_chapter_rows';
    error.details = result.errors;
    throw error;
  }
  return result.rows;
}

function compareSentenceAscending(a, b) {
  const ap = finitePositiveInteger(a.page) ? a.page : Number.POSITIVE_INFINITY;
  const bp = finitePositiveInteger(b.page) ? b.page : Number.POSITIVE_INFINITY;
  return ap - bp
    || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
    || String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

export function projectChapters(chapterInput, sentenceInput, totalPages = null) {
  const checked = validateChapterRows(chapterInput, totalPages);
  if (!checked.valid) {
    const error = new Error('invalid_chapter_rows');
    error.code = 'invalid_chapter_rows';
    error.details = checked.errors;
    throw error;
  }
  const chapters = checked.rows;
  const total = normalizedTotalPages(totalPages);
  const all = Array.isArray(sentenceInput) ? sentenceInput.slice() : [];
  const pageMissing = [];
  const outsideToc = [];
  const direct = chapters.map(() => []);

  if (chapters.length) {
    for (const sentence of all) {
      if (sentence.page == null) {
        pageMissing.push(sentence);
        continue;
      }
      if (!finitePositiveInteger(sentence.page)) {
        outsideToc.push(sentence);
        continue;
      }
      let chapterIndex = -1;
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (sentence.page >= chapters[i].start_page) { chapterIndex = i; break; }
      }
      if (chapterIndex < 0 || (total !== null && sentence.page > total)) outsideToc.push(sentence);
      else direct[chapterIndex].push(sentence);
    }
  }

  const rows = chapters.map((chapter, index) => {
    const next = chapters[index + 1];
    const endPage = next ? next.start_page - 1 : total;
    let subtreeEnd = index + 1;
    while (subtreeEnd < chapters.length && chapters[subtreeEnd].depth > chapter.depth) subtreeEnd++;
    const directSentences = direct[index].slice().sort(compareSentenceAscending);
    const aggregateCount = direct.slice(index, subtreeEnd).reduce((sum, values) => sum + values.length, 0);
    return { ...chapter, end_page: endPage, direct_count: directSentences.length,
      aggregate_count: aggregateCount, sentences: directSentences };
  });

  const flat = all.slice().sort((a, b) => {
    const at = Date.parse(a.created_at) || Number(a.created_at) || 0;
    const bt = Date.parse(b.created_at) || Number(b.created_at) || 0;
    return bt - at || String(b.id ?? '').localeCompare(String(a.id ?? ''));
  });
  return {
    hasToc: rows.length > 0,
    all: flat,
    chapters: rows,
    page_missing: pageMissing.slice().sort(compareSentenceAscending),
    outside_toc: outsideToc.slice().sort(compareSentenceAscending),
    counts: { all: all.length, chaptered: direct.reduce((sum, values) => sum + values.length, 0),
      page_missing: pageMissing.length, outside_toc: outsideToc.length },
  };
}

export function sameChapterRows(left, right) {
  const fields = ['title', 'start_page', 'depth', 'position'];
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((row, index) => fields.every(field => row[field] === right[index][field]));
}

if (typeof window !== 'undefined') {
  window.RG_chapters = { validate: validateChapterRows, assertValid: assertValidChapterRows,
    project: projectChapters, sameRows: sameChapterRows };
}
