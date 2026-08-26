#!/usr/bin/env node

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const POSTHOG_HOST = 'https://us.posthog.com';
export const POSTHOG_PROJECT_ID = 458802;
const DEFAULT_LOOKBACK_HOURS = 6;
const MAX_LOOKBACK_HOURS = 168;
const ROW_LIMIT = 100;

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function normalizeHours(value) {
  const hours = Number(value || DEFAULT_LOOKBACK_HOURS);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_LOOKBACK_HOURS) {
    throw new Error(`LOOKBACK_HOURS must be > 0 and <= ${MAX_LOOKBACK_HOURS}`);
  }
  return hours;
}

export function failureQuery({ since, platform = 'android' }) {
  return `
SELECT
  timestamp,
  properties.platform,
  properties.release_sha,
  properties.schema_version,
  properties.app_version,
  properties.source,
  properties.stage,
  properties.code,
  properties.endpoint_or_rpc,
  properties.status,
  properties.retry_count,
  properties.item_count,
  properties.correlation_id
FROM events
WHERE event = 'checkin_save_failed'
  AND properties.environment = 'production'
  AND properties.platform = ${sqlString(platform)}
  AND timestamp >= ${sqlString(new Date(since).toISOString())}
ORDER BY timestamp DESC
LIMIT ${ROW_LIMIT}`.trim();
}

async function hogql({ apiKey, query, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('POSTHOG_PERSONAL_API_KEY is missing');
  const response = await fetchImpl(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`PostHog Query API failed (${response.status}): ${detail || response.statusText}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.results)) throw new Error('PostHog Query API response has no results array');
  return payload.results;
}

export function sanitizeRows(rows) {
  return rows.map(([
    timestamp, platform, releaseSha, schemaVersion, appVersion, source, stage, code,
    endpointOrRpc, status, retryCount, itemCount, correlationId,
  ]) => ({
    timestamp: timestamp || '',
    platform: platform || '',
    release_sha: releaseSha || '',
    schema_version: schemaVersion || '',
    app_version: appVersion || '',
    source: source || '',
    stage: stage || '',
    code: code || '',
    endpoint_or_rpc: endpointOrRpc || '',
    status: status ?? '',
    retry_count: retryCount ?? '',
    item_count: itemCount ?? '',
    correlation_id: correlationId || '',
  }));
}

function cell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderMarkdown(report) {
  const lines = [
    '# Production Android check-in failures',
    '',
    `- Generated: ${report.generated_at}`,
    `- Since: ${report.since}`,
    `- Events: ${report.events.length}`,
    '- Privacy: user content and identity fields were not queried.',
    '',
    '| Time | Release | App | Source | Stage | Code | Endpoint/RPC | Status | Items | Correlation |',
    '|---|---|---|---|---|---|---|---:|---:|---|',
  ];
  for (const row of report.events) {
    lines.push(`| ${cell(row.timestamp)} | ${cell(row.release_sha)} | ${cell(row.app_version)} | ${cell(row.source)} | ${cell(row.stage)} | ${cell(row.code)} | ${cell(row.endpoint_or_rpc)} | ${cell(row.status)} | ${cell(row.item_count)} | ${cell(row.correlation_id)} |`);
  }
  if (!report.events.length) lines.push('| *(none)* | | | | | | | | | |');
  return `${lines.join('\n')}\n`;
}

export async function generateReport({
  apiKey,
  hours = DEFAULT_LOOKBACK_HOURS,
  now = new Date(),
  outputDir = 'artifacts/posthog-checkin-failures',
  fetchImpl = fetch,
} = {}) {
  const lookbackHours = normalizeHours(hours);
  const since = new Date(new Date(now).getTime() - lookbackHours * 60 * 60 * 1000);
  const rows = await hogql({ apiKey, query: failureQuery({ since }), fetchImpl });
  const report = {
    generated_at: new Date(now).toISOString(),
    since: since.toISOString(),
    platform: 'android',
    environment: 'production',
    queried_fields_exclude_user_content_and_identity: true,
    events: sanitizeRows(rows),
  };
  const markdown = renderMarkdown(report);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(`${outputDir}/report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(`${outputDir}/report.md`, markdown, 'utf8'),
  ]);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8');
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateReport({
    apiKey: process.env.POSTHOG_PERSONAL_API_KEY,
    hours: process.env.LOOKBACK_HOURS,
    outputDir: process.env.REPORT_OUTPUT_DIR,
  }).then((report) => {
    console.log(`Production Android check-in failures: ${report.events.length}`);
  }).catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
