/* ReadingGo analytics runtime — analytics.md §3.1.1 (#1306).
   커스텀 이벤트의 빌드 메타데이터·PII 차단을 한 계층에서 강제한다. */

const RG_ANALYTICS_SCHEMA_VERSION = 1;
const RG_ANALYTICS_ENVIRONMENTS = new Set(['development', 'production']);
const RG_ANALYTICS_PLATFORMS = new Set(['web', 'ios', 'android']);
const RG_CHECKIN_SOURCES = new Set(['home', 'ocr_review']);
const RG_CHECKIN_STAGES = new Set(['preflight', 'session', 'sentence', 'readback']);
const RG_CHECKIN_CODES = new Set([
  'ugc_terms_required', 'invalid_sentence', 'missing_user_book', 'auth_expired', 'network',
  'session_write_failed', 'sentence_write_failed', 'batch_partial_failure', 'readback_failed', 'unknown',
]);
const RG_CHECKIN_ENDPOINTS = new Set(['checkin_atomic', 'sentences', 'streak+sentences']);
const RG_OCR_SOURCES = new Set(['home_single', 'home_album', 'book_detail_highlights']);
const RG_OCR_STAGES = new Set(['client', 'network', 'request', 'config', 'upstage', 'result']);
const RG_OCR_CODES = new Set([
  'ocr_method_not_allowed', 'ocr_unconfigured', 'ocr_request_invalid', 'ocr_image_missing',
  'ocr_image_too_large', 'ocr_upstream_auth', 'ocr_upstream_unavailable',
  'ocr_upstream_rejected', 'ocr_transport_failure', 'ocr_network_failure', 'ocr_empty',
  'ocr_failed', 'ocr_unavailable',
]);

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

function createOcrFailureProps({ source, code, stage, pageIdx, status } = {}) {
  const normalizedCode = code === 'unavailable' ? 'ocr_unavailable' : code;
  const props = {
    source: RG_OCR_SOURCES.has(source) ? source : 'unknown',
    code: RG_OCR_CODES.has(normalizedCode) ? normalizedCode : 'unknown',
    stage: RG_OCR_STAGES.has(stage) ? stage : 'unknown',
  };
  if (Number.isInteger(pageIdx) && pageIdx >= 0) props.page_idx = pageIdx;
  if (Number.isInteger(status) && status >= 100 && status <= 599) props.status = status;
  return props;
}

function createCheckinCorrelationId(cryptoImpl = globalThis.crypto) {
  try {
    if (cryptoImpl && typeof cryptoImpl.randomUUID === 'function') return cryptoImpl.randomUUID();
  } catch (e) { /* 비식별 UUID 폴백 사용 */ }
  const bytes = new Uint8Array(16);
  try {
    if (cryptoImpl && typeof cryptoImpl.getRandomValues === 'function') cryptoImpl.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  } catch (e) {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeCheckinFailure(error, stage) {
  const rawCode = String((error && error.code) || (error && error.message) || '').toLowerCase();
  if (rawCode.includes('ugc_terms_required')) return 'ugc_terms_required';
  if (rawCode.includes('invalid_sentence') || rawCode.includes('sentence_text_invalid') || rawCode.includes('sentence_text_required')) return 'invalid_sentence';
  if (rawCode.includes('missing_user_book') || rawCode.includes('user_book') || rawCode.includes('미해소')) return 'missing_user_book';
  if (rawCode.includes('jwt') || rawCode.includes('auth') || rawCode.includes('unauthorized') || Number(error && error.status) === 401) return 'auth_expired';
  if (rawCode.includes('network') || rawCode.includes('fetch') || rawCode.includes('timeout')) return 'network';
  if (rawCode.includes('sentence_batch_partial_failure')) return 'batch_partial_failure';
  if (stage === 'session') return 'session_write_failed';
  if (stage === 'sentence') return 'sentence_write_failed';
  if (stage === 'readback') return 'readback_failed';
  return 'unknown';
}

let nativeAppVersionPromise;
async function getNativeAppVersion() {
  if (typeof window === 'undefined' || !window.RG_NATIVE || !window.CapApp || typeof window.CapApp.getInfo !== 'function') return undefined;
  if (!nativeAppVersionPromise) {
    nativeAppVersionPromise = Promise.resolve(window.CapApp.getInfo())
      .then((info) => (info && typeof info.version === 'string' && info.version.length <= 32 ? info.version : undefined))
      .catch(() => undefined);
  }
  return nativeAppVersionPromise;
}

async function trackCheckinSaveFailed({ source, stage, error, endpointOrRpc, correlationId, retryCount = 0, itemCount = 0, track } = {}) {
  const safeStage = RG_CHECKIN_STAGES.has(stage) ? stage : 'preflight';
  const props = {
    source: RG_CHECKIN_SOURCES.has(source) ? source : 'home',
    stage: safeStage,
    code: RG_CHECKIN_CODES.has(normalizeCheckinFailure(error, safeStage)) ? normalizeCheckinFailure(error, safeStage) : 'unknown',
    correlation_id: typeof correlationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationId) ? correlationId : createCheckinCorrelationId(),
    retry_count: Number.isInteger(retryCount) && retryCount >= 0 ? retryCount : 0,
    item_count: Number.isInteger(itemCount) && itemCount >= 0 ? itemCount : 0,
  };
  if (RG_CHECKIN_ENDPOINTS.has(endpointOrRpc)) props.endpoint_or_rpc = endpointOrRpc;
  const status = Number(error && error.status);
  if (Number.isInteger(status) && status >= 100 && status <= 599) props.status = status;
  const appVersion = await getNativeAppVersion();
  if (appVersion) props.app_version = appVersion;
  const tracker = track || (typeof window !== 'undefined' && window.rgTrack);
  try { if (typeof tracker === 'function') tracker('checkin_save_failed', props); } catch (e) { /* 분석 실패는 저장 흐름을 막지 않는다. */ }
  return props;
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
  window.RG_createCheckinCorrelationId = createCheckinCorrelationId;
  window.RG_normalizeCheckinFailure = normalizeCheckinFailure;
  window.RG_trackCheckinSaveFailed = trackCheckinSaveFailed;
  window.RG_createOcrFailureProps = createOcrFailureProps;
}

export { createAnalyticsRuntime, createCheckinCorrelationId, createOcrFailureProps, normalizeCheckinFailure, sanitizeAnalyticsValue, trackCheckinSaveFailed };
