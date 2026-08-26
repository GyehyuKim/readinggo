import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  failureQuery,
  generateReport,
  normalizeHours,
  renderMarkdown,
  sanitizeRows,
} from '../scripts/posthog-checkin-failures.mjs';

test('query is production Android only and excludes user content and identity', () => {
  const query = failureQuery({ since: new Date('2026-08-26T00:00:00Z') });
  assert.match(query, /event = 'checkin_save_failed'/);
  assert.match(query, /properties\.environment = 'production'/);
  assert.match(query, /properties\.platform = 'android'/);
  assert.doesNotMatch(query, /distinct_id|properties\.text|book_id|email/i);
});

test('lookback is bounded', () => {
  assert.equal(normalizeHours('6'), 6);
  assert.throws(() => normalizeHours('0'));
  assert.throws(() => normalizeHours('169'));
});

test('rows contain only approved diagnostic fields', () => {
  const rows = sanitizeRows([[
    '2026-08-26T12:00:00Z', 'android', 'abc', 'v1', '5', 'home', 'sentence',
    'sentence_write_failed', 'sentences', 400, 0, 1, 'correlation',
  ]]);
  assert.deepEqual(Object.keys(rows[0]), [
    'timestamp', 'platform', 'release_sha', 'schema_version', 'app_version', 'source',
    'stage', 'code', 'endpoint_or_rpc', 'status', 'retry_count', 'item_count',
    'correlation_id',
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /distinct_id|sentence_text|email/);
  assert.match(renderMarkdown({ generated_at: 'now', since: 'then', events: rows }), /sentence_write_failed/);
});

test('report writes sanitized JSON and Markdown', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'readinggo-checkin-failures-'));
  let requestBody = '';
  const fetchImpl = async (_url, init) => {
    requestBody = init.body;
    return {
      ok: true,
      async json() {
        return { results: [[
          '2026-08-26T12:00:00Z', 'android', 'abc', 'v1', '5', 'ocr_review',
          'sentence', 'network', 'sentences', 0, 0, 1, 'corr',
        ]] };
      },
    };
  };
  const report = await generateReport({
    apiKey: 'test-key',
    hours: 6,
    now: new Date('2026-08-26T13:00:00Z'),
    outputDir,
    fetchImpl,
  });
  assert.equal(report.events.length, 1);
  assert.doesNotMatch(requestBody, /test-key/);
  const json = await readFile(join(outputDir, 'report.json'), 'utf8');
  const markdown = await readFile(join(outputDir, 'report.md'), 'utf8');
  assert.match(json, /"code": "network"/);
  assert.match(markdown, /ocr_review/);
  assert.doesNotMatch(`${json}${markdown}`, /distinct_id|sentence_text|email/);
});
