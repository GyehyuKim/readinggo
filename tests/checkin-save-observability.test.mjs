import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCheckinCorrelationId, normalizeCheckinFailure, trackCheckinSaveFailed } from '../docs/readinggo/js/analytics.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('docs/readinggo/js/app.js');
const home = read('docs/readinggo/js/home.js');

const captured = [];
const correlationId = '123e4567-e89b-42d3-a456-426614174000';
const props = await trackCheckinSaveFailed({
  source: 'ocr_review',
  stage: 'sentence',
  error: { code: 'sentence_text_invalid', status: 422, message: '원문은 절대 전송하면 안 됨' },
  endpointOrRpc: 'sentences',
  correlationId,
  retryCount: 0,
  itemCount: 1,
  track: (event, values) => captured.push({ event, values }),
});

assert.equal(captured.length, 1, '최종 실패당 이벤트는 한 번만 전송한다');
assert.equal(captured[0].event, 'checkin_save_failed');
assert.deepEqual(props, {
  source: 'ocr_review', stage: 'sentence', code: 'invalid_sentence', endpoint_or_rpc: 'sentences',
  correlation_id: correlationId, retry_count: 0, item_count: 1, status: 422,
});
assert.deepEqual(Object.keys(props).sort(), ['code', 'correlation_id', 'endpoint_or_rpc', 'item_count', 'retry_count', 'source', 'stage', 'status']);
assert.equal(normalizeCheckinFailure(new Error('anything'), 'readback'), 'readback_failed');
assert.equal(normalizeCheckinFailure(new Error('jwt expired'), 'sentence'), 'auth_expired');
assert.match(createCheckinCorrelationId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

assert.match(home, /const correlationId = window\.RG_createCheckinCorrelationId\(\)/, '시도 시작에서 canonical correlation_id를 만든다');
assert.match(home, /onCheckin\([^\n]+\{ source, correlationId, itemCount \}\)/, 'preflight ID를 persistence까지 전달한다');
assert.ok(home.indexOf('RG_validateSentenceText') < home.indexOf('checkinResult = onCheckin('), '문장 preflight는 persistence보다 앞선다');
assert.ok(home.indexOf("rg:ugc-terms-required") < home.indexOf('checkinResult = onCheckin('), 'UGC preflight는 persistence보다 앞선다');
assert.doesNotMatch(home.slice(home.indexOf('const saveOcrReview'), home.indexOf('// 입력 페이지 정규화')), /rgTrack\('checkin_save_failed'/, 'OCR은 공통 실패 계측을 중복 호출하지 않는다');
assert.doesNotMatch(`${app}\n${home}`, /stage:\s*['\"]xp['\"]/, '허용 stage에 xp를 되살리지 않는다');
assert.match(app, /reportFailure\('session'/, '세션 경계에서 실패를 기록한다');
assert.match(app, /reportFailure\('sentence'/, '문장 경계에서 실패를 기록한다');
assert.match(app, /reportFailure\('readback'/, 'readback 실패를 별도 기록한다');
assert.match(app, /!ubId[\s\S]+reportFailure\('preflight', new Error\('missing_user_book'\)\)/, '첫 write 전 user_book 미해소는 preflight로 기록한다');
assert.match(app, /'checkin_atomic'[\s\S]+'sentences'[\s\S]+'streak\+sentences'/, '실패 payload는 실제 RPC·endpoint allowlist를 쓴다');
assert.match(app, /window\.RG_createCheckinCorrelationId\(\)/, '내부 호출도 persistence 경계에서 ID를 보완한다');
assert.match(app, /withInquiryCode[\s\S]+세션이 만료됐어요/, '인증 만료를 포함한 최종 실패 UI에 문의 코드를 표시한다');
assert.match(home, /checkinFailureStage === 'preflight'[\s\S]+문의 코드/, 'app 호출 전 preflight 실패도 문의 코드를 표시한다');

console.log('✅ check-in save observability contract passed');
