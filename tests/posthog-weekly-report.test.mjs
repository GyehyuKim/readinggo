import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
    quality: { missingEnvironment: 2, missingReleaseSha: 1, reportRowsAtLimit: false, retentionRowsAtLimit: false },
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
  assert.match(markdown, /환경 누락 이벤트 2건/);
  assert.match(markdown, /production release_sha 누락 1건/);
});

test('모든 PostHog 요청이 production 필터를 포함하고 응답을 정규화한다', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, init, query: body.query.query });
    let results;
    if (body.query.query.startsWith('SELECT event')) {
      results = [['book_opened', 'user-1', '2026-07-13T00:00:00Z', 'sha-1']];
    } else if (body.query.query.startsWith('SELECT distinct_id')) {
      results = [['user-1', '2026-07-13T00:00:00Z']];
    } else {
      results = [[3, 2]];
    }
    return new Response(JSON.stringify({ results }), { status: 200 });
  };

  const data = await fetchWeeklyData({ apiKey: 'test-personal-key', bounds, fetchImpl });

  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.url, 'https://us.posthog.com/api/projects/458802/query/');
    assert.equal(request.init.headers.Authorization, 'Bearer test-personal-key');
    assert.match(request.query, /properties\.environment = 'production'/);
    assert.doesNotMatch(request.query, /development/);
  }
  assert.deepEqual(data.reportEvents[0], {
    event: 'book_opened',
    distinctId: 'user-1',
    timestamp: '2026-07-13T00:00:00Z',
    releaseSha: 'sha-1',
  });
  assert.deepEqual(data.quality, {
    missingEnvironment: 3,
    missingReleaseSha: 2,
    reportRowsAtLimit: false,
    retentionRowsAtLimit: false,
  });
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
    quality: { missingEnvironment: 0, missingReleaseSha: 0, reportRowsAtLimit: false, retentionRowsAtLimit: false },
  }, bounds);

  assert.equal(report.launchThreshold.latestEligibleCohort.cohortSize, 10);
  assert.equal(report.launchThreshold.latestEligibleCohort.rate, 0.5);
  assert.equal(report.launchThreshold.latestEligibleCohort.verdict, 'pass');
});

test('리텐션 행 제한에 도달하면 불완전한 데이터로 50% 판정을 내리지 않는다', () => {
  const report = calculateWeeklyReport({
    reportEvents: [],
    retentionEvents: [{ distinctId: 'truncated', timestamp: '2026-06-29T01:00:00+09:00' }],
    quality: { missingEnvironment: 0, missingReleaseSha: 0, reportRowsAtLimit: false, retentionRowsAtLimit: true },
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
