import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnalyticsRuntime } from './analytics.js';

function fakePosthog() {
  const captures = [];
  const registrations = [];
  return {
    captures,
    registrations,
    capture(event, props) { captures.push({ event, props }); },
    register(props) { registrations.push(props); },
  };
}

test('환경 미지정 빌드는 이벤트를 전송하지 않는다', () => {
  const posthog = fakePosthog();
  const analytics = createAnalyticsRuntime({ posthog });
  assert.equal(analytics.track('book_opened', { book_id: 'b1' }), false);
  assert.deepEqual(posthog.captures, []);
  assert.deepEqual(posthog.registrations, []);
});

test('공통 메타데이터는 호출자 값보다 우선하고 super properties에도 등록된다', () => {
  const posthog = fakePosthog();
  const analytics = createAnalyticsRuntime({
    environment: 'development',
    releaseSha: 'abc123',
    posthog,
    capacitor: { getPlatform: () => 'android' },
  });
  analytics.track('book_opened', {
    book_id: 'b1',
    environment: 'production',
    release_sha: 'spoofed',
    schema_version: 999,
    platform: 'web',
  });
  const expected = {
    environment: 'development',
    release_sha: 'abc123',
    schema_version: 1,
    platform: 'android',
  };
  assert.deepEqual(posthog.registrations, [expected]);
  assert.deepEqual(posthog.captures[0], {
    event: 'book_opened',
    props: { book_id: 'b1', ...expected },
  });
});

test('민감 원문과 자유형 오류 속성을 중첩 객체에서도 제거한다', () => {
  const posthog = fakePosthog();
  const analytics = createAnalyticsRuntime({ environment: 'production', posthog });
  analytics.track('app_error', {
    code: 'render_failed',
    stage: 'render',
    status: 500,
    email: 'reader@example.com',
    isbn13: '9780000000000',
    sentence_text: '원문',
    answer: '답변 원문',
    message: '자유형 오류',
    nested: { provider_response_body: '원문', safe_count: 2 },
  });
  assert.deepEqual(posthog.captures[0].props, {
    code: 'render_failed',
    stage: 'render',
    status: 500,
    nested: { safe_count: 2 },
    environment: 'production',
    release_sha: 'local',
    schema_version: 1,
    platform: 'web',
  });
});
