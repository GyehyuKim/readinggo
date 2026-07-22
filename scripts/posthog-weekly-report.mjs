#!/usr/bin/env node

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const POSTHOG_HOST = 'https://us.posthog.com';
export const POSTHOG_PROJECT_ID = 458802;
export const CORE_EVENTS = [
  'book_opened',
  'reading_session_end',
  'sentence_added',
  'answer_saved',
  'book_completed',
];
export const FUNNEL_EVENTS = [
  'book_opened',
  'reading_session_end',
  'sentence_added',
  'book_completed',
];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const QUERY_ROW_LIMIT = 100_000;

function iso(date) {
  return new Date(date).toISOString();
}

export function kstWeekStart(value) {
  const shifted = new Date(new Date(value).getTime() + KST_OFFSET_MS);
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  const localMonday = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysSinceMonday,
  );
  return new Date(localMonday - KST_OFFSET_MS);
}

export function completedKstWeek(now = new Date()) {
  const end = kstWeekStart(now);
  return { start: new Date(end.getTime() - WEEK_MS), end };
}

export function kstWeekKey(value) {
  const start = kstWeekStart(value);
  return new Date(start.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function eventList() {
  return CORE_EVENTS.map(sqlString).join(', ');
}

function reportEventsQuery({ start, end }) {
  return `
SELECT event, distinct_id, timestamp, properties.release_sha
FROM events
WHERE event IN (${eventList()})
  AND properties.environment = 'production'
  AND timestamp >= ${sqlString(iso(start))}
  AND timestamp < ${sqlString(iso(end))}
ORDER BY timestamp ASC
LIMIT ${QUERY_ROW_LIMIT}`.trim();
}

function retentionEventsQuery({ end }) {
  return `
SELECT distinct_id, timestamp
FROM events
WHERE event = 'reading_session_end'
  AND properties.environment = 'production'
  AND timestamp < ${sqlString(iso(end))}
ORDER BY timestamp ASC
LIMIT ${QUERY_ROW_LIMIT}`.trim();
}

function dataQualityQuery({ start, end }) {
  return `
SELECT
  countIf(empty(coalesce(properties.environment, ''))) AS missing_environment,
  countIf(properties.environment = 'production' AND empty(coalesce(properties.release_sha, ''))) AS missing_release_sha
FROM events
WHERE event IN (${eventList()})
  AND (properties.environment = 'production' OR empty(coalesce(properties.environment, '')))
  AND timestamp >= ${sqlString(iso(start))}
  AND timestamp < ${sqlString(iso(end))}`.trim();
}

async function hogql(fetchImpl, apiKey, query) {
  const response = await fetchImpl(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`PostHog Query API failed (${response.status}): ${detail || response.statusText}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.results)) throw new Error('PostHog Query API response has no results array.');
  return payload.results;
}

export async function fetchWeeklyData({ apiKey, bounds, fetchImpl = fetch }) {
  if (!apiKey) {
    throw new Error(
      'POSTHOG_PERSONAL_API_KEY is missing. Add a read-only PostHog Personal API key at GitHub repository Settings → Secrets and variables → Actions → New repository secret, using the name POSTHOG_PERSONAL_API_KEY.',
    );
  }

  const [reportRows, retentionRows, qualityRows] = await Promise.all([
    hogql(fetchImpl, apiKey, reportEventsQuery(bounds)),
    hogql(fetchImpl, apiKey, retentionEventsQuery(bounds)),
    hogql(fetchImpl, apiKey, dataQualityQuery(bounds)),
  ]);

  return {
    reportEvents: reportRows.map(([event, distinctId, timestamp, releaseSha]) => ({
      event,
      distinctId: String(distinctId),
      timestamp,
      releaseSha: releaseSha || '',
    })),
    retentionEvents: retentionRows.map(([distinctId, timestamp]) => ({
      distinctId: String(distinctId),
      timestamp,
    })),
    quality: {
      missingEnvironment: Number(qualityRows[0]?.[0] || 0),
      missingReleaseSha: Number(qualityRows[0]?.[1] || 0),
      reportRowsAtLimit: reportRows.length === QUERY_ROW_LIMIT,
      retentionRowsAtLimit: retentionRows.length === QUERY_ROW_LIMIT,
    },
  };
}

export function calculateWeeklyReport({ reportEvents, retentionEvents, quality }, bounds) {
  const eventStats = Object.fromEntries(
    CORE_EVENTS.map((event) => [event, { count: 0, users: new Set() }]),
  );
  const activeIds = new Set();
  const funnelStage = new Map();

  for (const row of [...reportEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))) {
    if (!eventStats[row.event]) continue;
    activeIds.add(row.distinctId);
    eventStats[row.event].count += 1;
    eventStats[row.event].users.add(row.distinctId);

    const stage = funnelStage.get(row.distinctId) || 0;
    if (row.event === FUNNEL_EVENTS[stage]) funnelStage.set(row.distinctId, stage + 1);
  }

  const funnel = FUNNEL_EVENTS.map((event, index) => ({
    event,
    users: [...funnelStage.values()].filter((stage) => stage > index).length,
  }));

  const sessionsById = new Map();
  if (!quality.retentionRowsAtLimit) {
    for (const row of retentionEvents) {
      if (!sessionsById.has(row.distinctId)) sessionsById.set(row.distinctId, new Set());
      sessionsById.get(row.distinctId).add(kstWeekKey(row.timestamp));
    }
  }

  const cohorts = new Map();
  for (const [distinctId, weeks] of sessionsById) {
    const cohortWeek = [...weeks].sort()[0];
    const cohortStart = kstWeekStart(`${cohortWeek}T00:00:00+09:00`);
    if (cohortStart.getTime() + 2 * WEEK_MS > bounds.end.getTime()) continue;
    if (!cohorts.has(cohortWeek)) cohorts.set(cohortWeek, { members: 0, retained: 0 });
    const cohort = cohorts.get(cohortWeek);
    cohort.members += 1;
    const nextWeek = kstWeekKey(new Date(cohortStart.getTime() + WEEK_MS));
    if (weeks.has(nextWeek)) cohort.retained += 1;
  }

  const retention = [...cohorts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohortWeek, cohort]) => ({
      cohortWeek,
      cohortSize: cohort.members,
      retained: cohort.retained,
      rate: cohort.members ? cohort.retained / cohort.members : 0,
      sample: cohort.members < 10 ? 'reference' : 'eligible',
      verdict: cohort.members < 10 ? 'reference' : cohort.retained / cohort.members >= 0.5 ? 'pass' : 'fail',
    }));
  const latestEligible = [...retention].reverse().find((cohort) => cohort.sample === 'eligible') || null;

  return {
    schemaVersion: 1,
    environment: 'production',
    projectId: POSTHOG_PROJECT_ID,
    generatedAt: new Date().toISOString(),
    week: { start: iso(bounds.start), endExclusive: iso(bounds.end), timezone: 'Asia/Seoul' },
    wauActiveIds: activeIds.size,
    events: Object.fromEntries(
      Object.entries(eventStats).map(([event, stats]) => [event, { count: stats.count, users: stats.users.size }]),
    ),
    funnel,
    retention,
    launchThreshold: {
      minimumCohortSize: 10,
      targetRate: 0.5,
      status: quality.retentionRowsAtLimit ? 'incomplete' : latestEligible ? latestEligible.verdict : 'insufficient_sample',
      latestEligibleCohort: latestEligible,
    },
    dataQuality: quality,
  };
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderMarkdown(report) {
  const warnings = [];
  if (report.dataQuality.missingEnvironment) warnings.push(`환경 누락 이벤트 ${report.dataQuality.missingEnvironment}건`);
  if (report.dataQuality.missingReleaseSha) warnings.push(`production release_sha 누락 ${report.dataQuality.missingReleaseSha}건`);
  if (report.dataQuality.reportRowsAtLimit) warnings.push(`주간 이벤트가 ${QUERY_ROW_LIMIT.toLocaleString()}행 제한에 도달함`);
  if (report.dataQuality.retentionRowsAtLimit) warnings.push(`리텐션 이벤트가 ${QUERY_ROW_LIMIT.toLocaleString()}행 제한에 도달함`);
  if (!warnings.length) warnings.push('감지된 누락/행 제한 없음');

  const latest = report.launchThreshold.latestEligibleCohort;
  const threshold = report.launchThreshold.status === 'incomplete'
    ? '**판정 보류** — 리텐션 입력이 행 제한에 도달해 완전하지 않음'
    : latest
    ? `${latest.cohortWeek} 코호트 ${percent(latest.rate)} — **${latest.verdict === 'pass' ? '50% 달성' : '50% 미달'}**`
    : '판정 가능한 표본 10 이상 성숙 코호트 없음';

  return `# ReadingGo PostHog 주간 리포트\n\n` +
    `- 범위: ${report.week.start} ~ ${report.week.endExclusive} (끝 시각 미포함, KST 월요일 경계)\n` +
    `- 환경: **production** · PostHog project ${report.projectId}\n` +
    `- WAU(활성 ID): **${report.wauActiveIds}**\n` +
    `- 런칭 W1 기준: ${threshold}\n\n` +
    `## 핵심 이벤트\n\n| 이벤트 | 고유 활성 ID | 건수 |\n|---|---:|---:|\n` +
    CORE_EVENTS.map((event) => `| \`${event}\` | ${report.events[event].users} | ${report.events[event].count} |`).join('\n') +
    `\n\n## 4단계 퍼널\n\n| 단계 | 이벤트 | 도달 ID |\n|---:|---|---:|\n` +
    report.funnel.map((step, index) => `| ${index + 1} | \`${step.event}\` | ${step.users} |`).join('\n') +
    `\n\n## W1 리텐션\n\n| 시작 주(KST) | 코호트 | W1 복귀 | W1 | 판정 |\n|---|---:|---:|---:|---|\n` +
    (report.retention.length
      ? report.retention.map((row) => `| ${row.cohortWeek} | ${row.cohortSize} | ${row.retained} | ${percent(row.rate)} | ${row.sample === 'reference' ? '참고치(<10)' : row.verdict === 'pass' ? '달성' : '미달'} |`).join('\n')
      : '| - | 0 | 0 | - | 성숙 코호트 없음 |') +
    `\n\n## 데이터 품질\n\n${warnings.map((warning) => `- ${warning}`).join('\n')}\n`;
}

export async function run({
  apiKey = process.env.POSTHOG_PERSONAL_API_KEY,
  now = new Date(),
  fetchImpl = fetch,
  outputDir = process.env.REPORT_OUTPUT_DIR || 'artifacts/posthog-weekly-report',
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
} = {}) {
  const bounds = completedKstWeek(now);
  const data = await fetchWeeklyData({ apiKey, bounds, fetchImpl });
  const report = calculateWeeklyReport(data, bounds);
  const markdown = renderMarkdown(report);
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(`${outputDir}/posthog-weekly-report.json`, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(`${outputDir}/posthog-weekly-report.md`, markdown),
    summaryPath ? appendFile(summaryPath, markdown) : Promise.resolve(),
  ]);
  return report;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
