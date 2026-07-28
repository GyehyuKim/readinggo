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
export const EVENT_REQUIRED_PROPERTIES = {
  book_opened: ['book_id', 'entry_point'],
  reading_session_end: ['book_id', 'pages_logged', 'is_complete'],
  sentence_added: ['book_id', 'kind', 'source'],
  answer_saved: ['book_id', 'lens', 'answer_length'],
  book_completed: ['book_id', 'rating_present', 'review_present'],
};

const ALLOWED_ENVIRONMENTS = new Set(['development', 'production']);
const ALLOWED_PLATFORMS = new Set(['web', 'ios', 'android']);
const QUALITY_DETAIL_LIMIT = 50;

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

function dataQualityEventsQuery({ start, end }) {
  return `
SELECT
  event,
  distinct_id,
  timestamp,
  properties.environment,
  properties.release_sha,
  properties.schema_version,
  properties.platform,
  properties.book_id,
  properties.entry_point,
  properties.pages_logged,
  properties.is_complete,
  properties.kind,
  properties.source,
  properties.rating_present,
  properties.review_present,
  properties.lens,
  properties.answer_length
FROM events
WHERE event IN (${eventList()})
  AND timestamp >= ${sqlString(iso(start))}
  AND timestamp < ${sqlString(iso(end))}
ORDER BY timestamp ASC
LIMIT ${QUERY_ROW_LIMIT}`.trim();
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
    hogql(fetchImpl, apiKey, dataQualityEventsQuery(bounds)),
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
      events: qualityRows.map(([
        event, distinctId, timestamp, environment, releaseSha, schemaVersion, platform,
        bookId, entryPoint, pagesLogged, isComplete, kind, source, ratingPresent,
        reviewPresent, lens, answerLength,
      ]) => ({
        event,
        distinctId: String(distinctId),
        timestamp,
        environment,
        releaseSha,
        schemaVersion,
        platform,
        properties: {
          book_id: bookId,
          entry_point: entryPoint,
          pages_logged: pagesLogged,
          is_complete: isComplete,
          kind,
          source,
          rating_present: ratingPresent,
          review_present: reviewPresent,
          lens,
          answer_length: answerLength,
        },
      })),
      reportRowsAtLimit: reportRows.length === QUERY_ROW_LIMIT,
      retentionRowsAtLimit: retentionRows.length === QUERY_ROW_LIMIT,
      qualityRowsAtLimit: qualityRows.length === QUERY_ROW_LIMIT,
    },
  };
}

function isMissing(value) {
  return value === null || value === undefined || value === '';
}

const ANOMALY_METADATA = {
  missing_environment: { severity: 'critical', label: 'environment 누락' },
  invalid_environment: { severity: 'critical', label: 'environment 허용값 위반' },
  missing_release_sha: { severity: 'warning', label: 'production release_sha 누락' },
  missing_schema_version: { severity: 'warning', label: 'schema_version 누락' },
  invalid_schema_version: { severity: 'warning', label: 'schema_version 불일치' },
  missing_platform: { severity: 'warning', label: 'platform 누락' },
  invalid_platform: { severity: 'warning', label: 'platform 허용값 위반' },
  missing_required_property: { severity: 'warning', label: '필수 이벤트 속성 누락' },
};

function eventAnomalies(row) {
  const anomalies = [];
  if (isMissing(row.environment)) anomalies.push({ type: 'missing_environment' });
  else if (!ALLOWED_ENVIRONMENTS.has(String(row.environment))) anomalies.push({ type: 'invalid_environment' });
  if (row.environment === 'production' && isMissing(row.releaseSha)) anomalies.push({ type: 'missing_release_sha' });
  if (isMissing(row.schemaVersion)) anomalies.push({ type: 'missing_schema_version' });
  else if (Number(row.schemaVersion) !== 1) anomalies.push({ type: 'invalid_schema_version' });
  if (isMissing(row.platform)) anomalies.push({ type: 'missing_platform' });
  else if (!ALLOWED_PLATFORMS.has(String(row.platform))) anomalies.push({ type: 'invalid_platform' });
  for (const property of EVENT_REQUIRED_PROPERTIES[row.event] || []) {
    if (isMissing(row.properties[property])) anomalies.push({ type: 'missing_required_property', property });
  }
  return anomalies;
}

function displayValue(value) {
  return isMissing(value) ? '(누락)' : String(value);
}

export function analyzeDataQuality(quality) {
  const events = quality.events || [];
  const environmentCounts = new Map();
  const activeIds = new Set();
  const groups = new Map();
  const totals = new Map();

  for (const row of events) {
    activeIds.add(row.distinctId);
    const environment = displayValue(row.environment);
    environmentCounts.set(environment, (environmentCounts.get(environment) || 0) + 1);
    for (const anomaly of eventAnomalies(row)) {
      const dimensions = {
        type: anomaly.type,
        event: row.event,
        property: anomaly.property || '',
        environment,
        releaseSha: displayValue(row.releaseSha),
        schemaVersion: displayValue(row.schemaVersion),
        platform: displayValue(row.platform),
      };
      const key = JSON.stringify(dimensions);
      if (!groups.has(key)) groups.set(key, { ...dimensions, count: 0, ids: new Set(), firstSeen: row.timestamp, lastSeen: row.timestamp });
      const group = groups.get(key);
      group.count += 1;
      group.ids.add(row.distinctId);
      if (new Date(row.timestamp) < new Date(group.firstSeen)) group.firstSeen = row.timestamp;
      if (new Date(row.timestamp) > new Date(group.lastSeen)) group.lastSeen = row.timestamp;

      if (!totals.has(anomaly.type)) totals.set(anomaly.type, { count: 0, ids: new Set(), groups: 0 });
      const total = totals.get(anomaly.type);
      total.count += 1;
      total.ids.add(row.distinctId);
    }
  }

  const anomalyGroups = [...groups.values()]
    .map(({ ids, ...group }) => ({ ...group, users: ids.size, ...ANOMALY_METADATA[group.type] }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type) || a.event.localeCompare(b.event));
  for (const group of anomalyGroups) totals.get(group.type).groups += 1;
  const anomalyTotals = [...totals.entries()]
    .map(([type, total]) => ({
      type,
      ...ANOMALY_METADATA[type],
      count: total.count,
      users: total.ids.size,
      groups: total.groups,
    }))
    .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === 'critical' ? -1 : 1));
  const status = quality.qualityRowsAtLimit
    ? 'incomplete'
    : anomalyTotals.some((row) => row.severity === 'critical')
      ? 'critical'
      : anomalyTotals.length ? 'warning' : 'ok';

  return {
    status,
    scannedEvents: events.length,
    scannedActiveIds: activeIds.size,
    environmentCounts: Object.fromEntries([...environmentCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    missingEnvironment: anomalyTotals.find((row) => row.type === 'missing_environment')?.count || 0,
    missingReleaseSha: anomalyTotals.find((row) => row.type === 'missing_release_sha')?.count || 0,
    anomalyTotals,
    anomalyGroups: anomalyGroups.slice(0, QUALITY_DETAIL_LIMIT),
    hiddenAnomalyGroups: Math.max(0, anomalyGroups.length - QUALITY_DETAIL_LIMIT),
    reportRowsAtLimit: quality.reportRowsAtLimit,
    retentionRowsAtLimit: quality.retentionRowsAtLimit,
    qualityRowsAtLimit: quality.qualityRowsAtLimit,
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
    dataQuality: analyzeDataQuality(quality),
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
  if (report.dataQuality.qualityRowsAtLimit) warnings.push(`품질 감사 이벤트가 ${QUERY_ROW_LIMIT.toLocaleString()}행 제한에 도달해 결과가 불완전함`);
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
    `\n\n## 데이터 품질\n\n` +
    `- 상태: **${report.dataQuality.status}**\n` +
    `- 감사 범위: ${report.dataQuality.scannedEvents}건 · 활성 ID ${report.dataQuality.scannedActiveIds}개\n` +
    `- 환경별 이벤트: ${Object.entries(report.dataQuality.environmentCounts).map(([environment, count]) => `\`${environment}\` ${count}건`).join(' · ') || '없음'}\n` +
    `${warnings.map((warning) => `- ${warning}`).join('\n')}\n\n` +
    `### 이상 유형 요약\n\n| 심각도 | 유형 | 그룹 | 이벤트 | 활성 ID |\n|---|---|---:|---:|---:|\n` +
    (report.dataQuality.anomalyTotals.length
      ? report.dataQuality.anomalyTotals.map((row) => `| ${row.severity} | ${row.label} | ${row.groups} | ${row.count} | ${row.users} |`).join('\n')
      : '| - | 감지된 이상 없음 | 0 | 0 | 0 |') +
    `\n\n### 이상 상세\n\n| 심각도 | 유형 | 이벤트 | 속성 | environment | release_sha | schema_version | platform | 건수 | 활성 ID | 최초 | 최근 |\n|---|---|---|---|---|---|---|---|---:|---:|---|---|\n` +
    (report.dataQuality.anomalyGroups.length
      ? report.dataQuality.anomalyGroups.map((row) => `| ${row.severity} | ${row.label} | \`${row.event}\` | ${row.property ? `\`${row.property}\`` : '-'} | \`${row.environment}\` | \`${row.releaseSha}\` | \`${row.schemaVersion}\` | \`${row.platform}\` | ${row.count} | ${row.users} | ${row.firstSeen} | ${row.lastSeen} |`).join('\n')
      : '| - | 감지된 이상 없음 | - | - | - | - | - | - | 0 | 0 | - | - |') +
    (report.dataQuality.hiddenAnomalyGroups
      ? `\n\n> 상세 ${report.dataQuality.hiddenAnomalyGroups}개 그룹은 출력 상한으로 생략되었습니다. JSON artifact에서 전체 집계 유형을 확인하세요.`
      : '') +
    '\n';
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
