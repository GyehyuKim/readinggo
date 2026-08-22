import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeDataQuality,
  calculateWeeklyReport,
  completedKstWeek,
  fetchWeeklyData,
  kstWeekKey,
  renderMarkdown,
} from '../scripts/posthog-weekly-report.mjs';

const bounds = {
  start: new Date('2026-07-12T15:00:00.000Z'),
  end: new Date('2026-07-19T15:00:00.000Z'),
};

function qualityEvent(overrides = {}) {
  return {
    event: 'book_opened',
    distinctId: 'user-1',
    timestamp: '2026-07-13T00:00:00Z',
    environment: 'production',
    releaseSha: 'sha-1',
    schemaVersion: 1,
    platform: 'web',
    properties: { book_id: 'book-1', entry_point: 'shelf' },
    ...overrides,
  };
}

function quality(events = [], overrides = {}) {
  return {
    events,
    reportRowsAtLimit: false,
    retentionRowsAtLimit: false,
    qualityRowsAtLimit: false,
    ...overrides,
  };
}

test('KST 월요일 경계로 직전 완료 주를 계산한다', () => {
  assert.deepEqual(completedKstWeek(new Date('2026-07-22T03:00:00.000Z')), bounds);
  assert.equal(kstWeekKey('2026-07-19T14:59:59.999Z'), '2026-07-13');
  assert.equal(kstWeekKey('2026-07-19T15:00:00.000Z'), '2026-07-20');
});

test('WAU, 순차 퍼널, 성숙 W1 코호트와 표본 판정을 계산한다', () => {
  const reportEvents = [
    ['book_opened', 'a', '2026-07-13T00:00:00Z'],
    ['reading_session_end', 'a', '2026-07-13T00:01:00Z'],
    ['sentence_added', 'a', '2026-07-13T00:02:00Z'],
    ['book_completed', 'a', '2026-07-13T00:03:00Z'],
    ['book_opened', 'b', '2026-07-14T00:00:00Z'],
    ['sentence_added', 'b', '2026-07-14T00:01:00Z'],
    ['reading_session_end', 'b', '2026-07-14T00:02:00Z'],
    ['answer_saved', 'c', '2026-07-15T00:00:00Z'],
  ].map(([event, distinctId, timestamp]) => ({ event, distinctId, timestamp, releaseSha: 'abc123' }));
  const retentionEvents = [
    ['a', '2026-06-29T01:00:00+09:00'],
    ['a', '2026-07-06T01:00:00+09:00'],
    ['b', '2026-06-30T01:00:00+09:00'],
    ['c', '2026-07-06T01:00:00+09:00'],
    ['c', '2026-07-13T01:00:00+09:00'],
    ['d', '2026-07-13T01:00:00+09:00'],
  ].map(([distinctId, timestamp]) => ({ distinctId, timestamp }));

  const report = calculateWeeklyReport({
    reportEvents,
    retentionEvents,
    quality: quality([
      qualityEvent({ distinctId: 'missing-env', environment: null }),
      qualityEvent({ distinctId: 'missing-sha', releaseSha: '' }),
    ]),
  }, bounds);

  assert.equal(report.wauActiveIds, 3);
  assert.deepEqual(report.events.book_opened, { count: 2, users: 2 });
  assert.deepEqual(report.funnel.map((step) => step.users), [2, 2, 1, 1]);
  assert.deepEqual(report.retention, [
    { cohortWeek: '2026-06-29', cohortSize: 2, retained: 1, rate: 0.5, sample: 'reference', verdict: 'reference' },
    { cohortWeek: '2026-07-06', cohortSize: 1, retained: 1, rate: 1, sample: 'reference', verdict: 'reference' },
  ]);
  assert.equal(report.launchThreshold.latestEligibleCohort, null);
  const markdown = renderMarkdown(report);
  assert.match(markdown, /WAU\(활성 ID\): \*\*3\*\*/);
  assert.match(markdown, /환경 누락 이벤트 1건/);
  assert.match(markdown, /production release_sha 누락 1건/);
});

test('KPI 쿼리는 production 전용이고 품질 감사만 모든 환경을 검사한다', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, init, query: body.query.query });
    let results;
    if (body.query.query.startsWith('SELECT event,')) {
      results = [['book_opened', 'user-1', '2026-07-13T00:00:00Z', 'sha-1']];
    } else if (body.query.query.startsWith('SELECT distinct_id')) {
      results = [['user-1', '2026-07-13T00:00:00Z']];
    } else {
      results = [[
        'book_opened', 'user-2', '2026-07-13T01:00:00Z', null, null, 1, 'web',
        'book-2', 'shelf', null, null, null, null, null, null, null, null,
      ]];
    }
    return new Response(JSON.stringify({ results }), { status: 200 });
  };

  const data = await fetchWeeklyData({ apiKey: 'test-personal-key', bounds, fetchImpl });

  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.url, 'https://us.posthog.com/api/projects/458802/query/');
    assert.equal(request.init.headers.Authorization, 'Bearer test-personal-key');
  }
  assert.match(requests[0].query, /properties\.environment = 'production'/);
  assert.match(requests[1].query, /properties\.environment = 'production'/);
  assert.doesNotMatch(requests[2].query, /properties\.environment = 'production'/);
  assert.match(requests[2].query, /properties\.environment,/);
  assert.deepEqual(data.reportEvents[0], {
    event: 'book_opened',
    distinctId: 'user-1',
    timestamp: '2026-07-13T00:00:00Z',
    releaseSha: 'sha-1',
  });
  assert.deepEqual(data.quality, {
    events: [qualityEvent({
      distinctId: 'user-2',
      timestamp: '2026-07-13T01:00:00Z',
      environment: null,
      releaseSha: null,
      properties: {
        book_id: 'book-2',
        entry_point: 'shelf',
        pages_logged: null,
        is_complete: null,
        kind: null,
        source: null,
        rating_present: null,
        review_present: null,
        lens: null,
        answer_length: null,
      },
    })],
    reportRowsAtLimit: false,
    retentionRowsAtLimit: false,
    qualityRowsAtLimit: false,
  });
});

test('같은 차원의 이상을 그룹화하고 필수 속성별 활성 ID를 집계한다', () => {
  const result = analyzeDataQuality(quality([
    qualityEvent({ distinctId: 'a', properties: { book_id: null, entry_point: 'shelf' } }),
    qualityEvent({ distinctId: 'b', timestamp: '2026-07-13T01:00:00Z', properties: { book_id: null, entry_point: 'shelf' } }),
    qualityEvent({ distinctId: 'a', timestamp: '2026-07-13T02:00:00Z', properties: { book_id: null, entry_point: 'shelf' } }),
  ]));

  assert.equal(result.status, 'warning');
  assert.deepEqual(result.anomalyTotals, [{
    type: 'missing_required_property',
    severity: 'warning',
    label: '필수 이벤트 속성 누락',
    count: 3,
    users: 2,
    groups: 1,
  }]);
  assert.equal(result.anomalyGroups[0].property, 'book_id');
  assert.equal(result.anomalyGroups[0].count, 3);
  assert.equal(result.anomalyGroups[0].users, 2);
  assert.equal(result.anomalyGroups[0].firstSeen, '2026-07-13T00:00:00Z');
  assert.equal(result.anomalyGroups[0].lastSeen, '2026-07-13T02:00:00Z');
});

test('environment 위반은 critical이고 기타 계약 위반은 warning이다', () => {
  const result = analyzeDataQuality(quality([
    qualityEvent({ environment: null }),
    qualityEvent({ distinctId: 'bad-env', environment: 'staging' }),
    qualityEvent({ distinctId: 'bad-schema', schemaVersion: 2, platform: 'desktop' }),
  ]));

  assert.equal(result.status, 'critical');
  assert.deepEqual(result.anomalyTotals.slice(0, 2).map((row) => [row.type, row.severity]), [
    ['missing_environment', 'critical'],
    ['invalid_environment', 'critical'],
  ]);
  assert.equal(result.anomalyTotals.find((row) => row.type === 'invalid_schema_version').severity, 'warning');
  assert.equal(result.anomalyTotals.find((row) => row.type === 'invalid_platform').severity, 'warning');
});

test('품질 감사 행 제한은 이상 유무보다 우선해 incomplete로 표시한다', () => {
  const result = analyzeDataQuality(quality([], { qualityRowsAtLimit: true }));
  assert.equal(result.status, 'incomplete');
  assert.equal(result.anomalyTotals.some((row) => row.type === 'collection_silence'), false);
});

test('완료된 감사 기간에 핵심 이벤트가 없으면 collection_silence critical을 보고한다', () => {
  const result = analyzeDataQuality(quality([]));
  assert.equal(result.status, 'critical');
  assert.deepEqual(result.anomalyTotals, [{
    type: 'collection_silence', severity: 'critical', label: '감사 대상 핵심 이벤트 수집 없음', count: 0, users: 0, groups: 1,
  }]);
  assert.equal(result.anomalyGroups[0].event, 'book_opened,reading_session_end,sentence_added,answer_saved,book_completed');
});

test('마크다운에 품질 상태, 환경, 이상 요약과 상세를 출력한다', () => {
  const report = calculateWeeklyReport({
    reportEvents: [],
    retentionEvents: [],
    quality: quality([
      qualityEvent({ environment: null, properties: { book_id: null, entry_point: 'shelf' } }),
    ]),
  }, bounds);
  const markdown = renderMarkdown(report);

  assert.match(markdown, /상태: \*\*critical\*\*/);
  assert.match(markdown, /`\(누락\)` 1건/);
  assert.match(markdown, /### 이상 유형 요약/);
  assert.match(markdown, /environment 누락/);
  assert.match(markdown, /### 이상 상세/);
  assert.match(markdown, /필수 이벤트 속성 누락.*`book_opened`.*`book_id`/);
});

test('표본 10 이상인 최신 성숙 코호트에 50% 기준을 적용한다', () => {
  const retentionEvents = [];
  for (let index = 0; index < 10; index += 1) {
    retentionEvents.push({ distinctId: `eligible-${index}`, timestamp: '2026-06-29T01:00:00+09:00' });
    if (index < 5) {
      retentionEvents.push({ distinctId: `eligible-${index}`, timestamp: '2026-07-06T01:00:00+09:00' });
    }
  }
  const report = calculateWeeklyReport({
    reportEvents: [],
    retentionEvents,
    quality: quality(),
  }, bounds);

  assert.equal(report.launchThreshold.latestEligibleCohort.cohortSize, 10);
  assert.equal(report.launchThreshold.latestEligibleCohort.rate, 0.5);
  assert.equal(report.launchThreshold.latestEligibleCohort.verdict, 'pass');
});

test('리텐션 행 제한에 도달하면 불완전한 데이터로 50% 판정을 내리지 않는다', () => {
  const report = calculateWeeklyReport({
    reportEvents: [],
    retentionEvents: [{ distinctId: 'truncated', timestamp: '2026-06-29T01:00:00+09:00' }],
    quality: quality([], { retentionRowsAtLimit: true }),
  }, bounds);

  assert.deepEqual(report.retention, []);
  assert.equal(report.launchThreshold.status, 'incomplete');
  assert.equal(report.launchThreshold.latestEligibleCohort, null);
  assert.match(renderMarkdown(report), /판정 보류/);
});

test('API key 누락 시 GitHub Secret 설정 경로를 안내한다', async () => {
  await assert.rejects(
    fetchWeeklyData({ apiKey: '', bounds, fetchImpl: () => assert.fail('fetch should not run') }),
    /Settings → Secrets and variables → Actions.*POSTHOG_PERSONAL_API_KEY/,
  );
});
