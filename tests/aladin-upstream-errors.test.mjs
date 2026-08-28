import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';

const SECRET_KEY = 'secret-ttb-key-1461';
const QUERY = 'provider-body-must-not-leak';
const googleItem = {
  volumeInfo: {
    title: 'Google fallback',
    authors: ['Author'],
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780987654321' }],
  },
};

function response(body, { status = 200, contentType = 'application/json' } = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': contentType },
  });
}

async function requestLegacy({ isbn = false, cursor = '', aladin, google = () => response({ items: [googleItem] }) }) {
  const savedFetch = globalThis.fetch;
  const savedError = console.error;
  const calls = [];
  const logs = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === 'aladin.co.kr') return aladin(url);
    if (url.hostname === 'www.googleapis.com') return google(url);
    throw new Error(`unexpected upstream host: ${url.hostname}`);
  };
  console.error = (...args) => logs.push(args);
  try {
    const params = isbn
      ? 'isbn=9781234567890'
      : `query=${encodeURIComponent(QUERY)}&max=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const result = await worker.fetch(
      new Request(`https://readinggo.example/aladin?${params}`),
      { ALADIN_TTB_KEY: SECRET_KEY, BOOKS_PROVIDER: 'aladin' },
      {},
    );
    const body = await result.json();
    return { result, body, calls, logs };
  } finally {
    globalThis.fetch = savedFetch;
    console.error = savedError;
  }
}

const failures = [
  ['429', () => response({ errorCode: 429, errorMessage: 'rate-limited-provider-body' }, { status: 429 }), 'http', 429],
  ['4xx', () => response({ errorCode: 400, errorMessage: 'bad-provider-request' }, { status: 400 }), 'http', 400],
  ['5xx JSON', () => response({ error: 'provider-json-body' }, { status: 500 }), 'http', 500],
  ['5xx non-JSON', () => response('provider-html-body', { status: 503, contentType: 'text/html' }), 'http', 503],
  ['network', () => { throw new Error('network-message-with-secret'); }, 'network', undefined],
  ['parse', () => response('<html>not json</html>', { contentType: 'text/html' }), 'parse', undefined],
  ['provider object', () => response({ errorCode: 8, errorMessage: 'invalid ttb key' }), 'provider', undefined],
];

for (const [name, aladin, classification, status] of failures) {
  const { result, body, calls, logs } = await requestLegacy({ aladin });
  assert.equal(result.status, 200, `${name}: 검색은 Google fallback 성공으로 복구해야 한다`);
  assert.equal(body.items.length, 1, `${name}: Google 결과를 반환해야 한다`);
  assert.match(result.headers.get('cache-control') || '', /max-age=3600/, `${name}: fallback은 1시간 캐시여야 한다`);
  assert.equal(calls[0].origin, 'https://aladin.co.kr', `${name}: 공식 HTTPS Aladin base만 사용해야 한다`);
  assert.equal(calls[0].pathname, '/ttb/api/ItemSearch.aspx');
  assert.deepEqual(calls.map((url) => url.hostname), ['aladin.co.kr', 'www.googleapis.com']);
  assert.equal(logs.length, 1, `${name}: upstream 실패 로그를 한 번 남겨야 한다`);
  const log = JSON.parse(String(logs[0][0]));
  assert.deepEqual(
    log,
    {
      event: 'provider_failure',
      provider: 'aladin',
      classification,
      ...(status == null ? {} : { status }),
      route: 'search',
    },
    `${name}: 안전한 구조화 필드만 기록해야 한다`,
  );
}

const emptyPrimary = await requestLegacy({
  aladin: () => response({ item: [], totalResults: 0 }),
});
assert.equal(emptyPrimary.result.status, 200, '유효한 Aladin 빈 결과는 성공이어야 한다');
assert.deepEqual(emptyPrimary.body.items, []);
assert.equal(emptyPrimary.body.hasMore, true, 'primary 종료 뒤 Google continuation이 있어야 한다');
assert.equal(typeof emptyPrimary.body.nextCursor, 'string');
assert.match(emptyPrimary.result.headers.get('cache-control') || '', /max-age=86400/, '유효한 primary 빈 결과는 24시간 캐시한다');
assert.deepEqual(emptyPrimary.calls.map((url) => url.hostname), ['aladin.co.kr'], 'primary 응답은 같은 요청에서 Google과 섞지 않는다');
assert.equal(emptyPrimary.logs.length, 0);

const emptyPrimaryContinuation = await requestLegacy({
  cursor: emptyPrimary.body.nextCursor,
  aladin: () => { throw new Error('Google cursor는 Aladin을 재호출하면 안 된다'); },
  google: () => response({ totalItems: 0, items: [] }),
});
assert.equal(emptyPrimaryContinuation.result.status, 200);
assert.deepEqual(emptyPrimaryContinuation.body.items, []);
assert.equal(emptyPrimaryContinuation.body.hasMore, false);
assert.deepEqual(emptyPrimaryContinuation.calls.map((url) => url.hostname), ['www.googleapis.com']);

const emptyFallback = await requestLegacy({
  aladin: () => response({ errorCode: 429 }, { status: 429 }),
  google: () => response({ items: [] }),
});
assert.equal(emptyFallback.result.status, 200, '유효한 Google 빈 fallback도 성공이어야 한다');
assert.deepEqual(emptyFallback.body.items, []);
assert.match(emptyFallback.result.headers.get('cache-control') || '', /max-age=3600/);

const dualFailure = await requestLegacy({
  aladin: () => response('sensitive-provider-body', { status: 500, contentType: 'text/plain' }),
  google: () => { throw new Error('google-internal-stack-message'); },
});
assert.equal(dualFailure.result.status, 502, 'Aladin과 Google 이중 실패는 502여야 한다');
assert.deepEqual(dualFailure.body, { error: 'upstream_failure' }, '이중 실패는 generic 오류 코드만 반환해야 한다');
assert.equal(dualFailure.result.headers.get('cache-control'), 'no-store', '이중 실패는 캐시하지 않아야 한다');

const isbnFailure = await requestLegacy({
  isbn: true,
  aladin: () => { throw new Error(`network ${SECRET_KEY} ${QUERY}`); },
});
assert.equal(isbnFailure.result.status, 502, 'ISBN Aladin 실패는 fallback 없이 502여야 한다');
assert.deepEqual(isbnFailure.body, { error: 'upstream_failure' }, 'ISBN 실패는 generic 오류 코드만 반환해야 한다');
assert.equal(isbnFailure.result.headers.get('cache-control'), 'no-store', 'ISBN 실패는 캐시하지 않아야 한다');
assert.deepEqual(isbnFailure.calls.map((url) => url.hostname), ['aladin.co.kr'], 'ISBN 실패는 Google 검색 fallback을 호출하지 않아야 한다');
assert.equal(JSON.parse(String(isbnFailure.logs[0][0])).route, 'isbn');

for (const result of [dualFailure, isbnFailure]) {
  const publicPayload = JSON.stringify(result.body);
  assert.ok(!publicPayload.includes(SECRET_KEY));
  assert.ok(!publicPayload.includes(QUERY));
  assert.ok(!publicPayload.includes('sensitive-provider-body'));
  assert.ok(!publicPayload.includes('aladin.co.kr'));
  assert.ok(!publicPayload.toLowerCase().includes('stack'));
  assert.ok(!publicPayload.toLowerCase().includes('message'));
}

// 신규 provider 디스패치 비영향: Kakao 검색과 NLK ISBN은 Aladin을 호출하지 않는다.
{
  const savedFetch = globalThis.fetch;
  const hosts = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    hosts.push(url.hostname);
    if (url.hostname === 'dapi.kakao.com') {
      return response({ documents: [{ isbn: '9781234567890', title: '카카오 정상', authors: ['저자'] }] });
    }
    throw new Error(`unexpected upstream ${url.hostname}`);
  };
  try {
    const r = await worker.fetch(
      new Request('https://readinggo.example/aladin?query=test&max=1'),
      { KAKAO_REST_KEY: 'kakao-test-key' },
      {},
    );
    assert.equal(r.status, 200);
    assert.deepEqual(hosts, ['dapi.kakao.com']);
  } finally {
    globalThis.fetch = savedFetch;
  }
}

{
  const savedFetch = globalThis.fetch;
  const hosts = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    hosts.push(url.hostname);
    if (url.hostname === 'www.nl.go.kr') {
      return response({ docs: [{ EA_ISBN: '9781234567890', TITLE: '국중도 정상', AUTHOR: '저자', PUBLISHER: '출판사', PAGE: '200 p.' }] });
    }
    if (url.hostname === 'www.googleapis.com') return response({ items: [] });
    if (url.hostname === 'openlibrary.org') return response({});
    throw new Error(`unexpected upstream ${url.hostname}`);
  };
  try {
    const r = await worker.fetch(
      new Request('https://readinggo.example/aladin?isbn=9781234567890'),
      { NLK_CERT_KEY: 'nlk-test-key' },
      {},
    );
    assert.equal(r.status, 200);
    assert.ok(!hosts.includes('aladin.co.kr'), 'NLK ISBN 경로는 Aladin 변경의 영향을 받지 않아야 한다');
  } finally {
    globalThis.fetch = savedFetch;
  }
}

console.log('OK: Aladin upstream 오류 분류, 안전 응답/로그, fallback 캐시 및 provider 비영향');
