/* ReadingGo analytics runtime — analytics.md §3.1.1 (#1306).
   커스텀 이벤트의 빌드 메타데이터·PII 차단을 한 계층에서 강제한다. */

const RG_ANALYTICS_SCHEMA_VERSION = 1;
const RG_ANALYTICS_ENVIRONMENTS = new Set(['development', 'production']);
const RG_ANALYTICS_PLATFORMS = new Set(['web', 'ios', 'android']);

// 원문·개인정보·자유형 오류를 담을 가능성이 있는 키는 값과 무관하게 폐기한다.
// code/stage/status 같은 안정된 오류 분류만 허용한다.
const RG_BLOCKED_PROPERTIES = new Set([
  'email', 'e_mail', 'name', 'nickname', 'oauth_id', 'isbn', 'isbn13',
  'sentence', 'sentence_text', 'question', 'question_text', 'answer', 'answer_text', 'text',
  'message', 'error', 'error_message', 'exception', 'stack',
  'token', 'invite_token', 'url', 'query', 'hash',
  'response', 'response_body', 'provider_response', 'provider_response_body',
  'prompt', 'content', 'review_text', 'my_note',
]);

function isBlockedAnalyticsProperty(key) {
  const normalized = String(key || '').toLowerCase();
  return RG_BLOCKED_PROPERTIES.has(normalized)
    || /_(email|isbn|token|url|message|body|prompt|content)$/.test(normalized);
}

function sanitizeAnalyticsValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeAnalyticsValue);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, nested] of Object.entries(value)) {
    if (isBlockedAnalyticsProperty(key)) continue;
    clean[key] = sanitizeAnalyticsValue(nested);
  }
  return clean;
}

function resolveAnalyticsPlatform(capacitor) {
  try {
    const platform = capacitor && typeof capacitor.getPlatform === 'function'
      ? capacitor.getPlatform()
      : 'web';
    return RG_ANALYTICS_PLATFORMS.has(platform) ? platform : 'web';
  } catch (e) {
    return 'web';
  }
}

function createAnalyticsRuntime({ environment, releaseSha, posthog, capacitor } = {}) {
  const enabled = RG_ANALYTICS_ENVIRONMENTS.has(environment);
  const metadata = Object.freeze({
    environment,
    release_sha: releaseSha || 'local',
    schema_version: RG_ANALYTICS_SCHEMA_VERSION,
    platform: resolveAnalyticsPlatform(capacitor),
  });

  if (enabled && posthog && typeof posthog.register === 'function') {
    try { posthog.register(metadata); } catch (e) { /* 분석 실패는 앱 흐름을 막지 않는다. */ }
  }

  return {
    enabled,
    metadata,
    track(event, props) {
      if (!enabled || typeof event !== 'string' || !event) return false;
      if (!posthog || typeof posthog.capture !== 'function') return false;
      try {
        // 호출자가 공통 키를 위조해도 빌드 메타데이터가 마지막에 덮어쓴다.
        posthog.capture(event, { ...sanitizeAnalyticsValue(props || {}), ...metadata });
        return true;
      } catch (e) {
        return false;
      }
    },
  };
}

const buildEnvironment = import.meta.env && import.meta.env.VITE_READINGGO_ENV;
const buildReleaseSha = (import.meta.env && import.meta.env.VITE_RELEASE_SHA) || 'local';
const runtime = typeof window === 'undefined'
  ? createAnalyticsRuntime()
  : createAnalyticsRuntime({
      environment: buildEnvironment,
      releaseSha: buildReleaseSha,
      posthog: window.posthog,
      capacitor: window.Capacitor,
    });

if (typeof window !== 'undefined') {
  window.RG_ANALYTICS = runtime;
  window.rgTrack = runtime.track;
}

export { createAnalyticsRuntime, sanitizeAnalyticsValue };
