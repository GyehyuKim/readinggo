import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import worker from '../worker/index.mjs';

const SB = 'https://readinggo-auth-test.supabase.co';
const env = {
  SUPABASE_URL: SB,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  RATE_LIMITER: {
    blocked: false,
    calls: 0,
    async limit() { this.calls += 1; return { success: !this.blocked }; },
  },
};
const originalFetch = globalThis.fetch;
const upstream = [];

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  upstream.push({ url: url.toString(), init });
  if (url.pathname === '/auth/v1/user') {
    return init.headers.Authorization === 'Bearer valid-user-token'
      ? Response.json({ id: '11111111-1111-4111-8111-111111111111' })
      : Response.json({ error: 'invalid token' }, { status: 401 });
  }
  if (url.pathname === '/rest/v1/books') {
    return Response.json([{ id: 'canonical-book', isbn13: '9781234567897', title: '서버 정본' }]);
  }
  throw new Error(`unexpected upstream request ${url}`);
};

const request = (token, isbn13 = '9781234567897') => new Request('https://readinggo.example/api/book-upsert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ isbn13, title: '공격자가 보낸 제목' }),
});

try {
  let response = await worker.fetch(request(''), env, {});
  assert.equal(response.status, 401);
  assert.equal(upstream.length, 0, '무인증은 GoTrue/DB에 도달하지 않아야 한다');

  response = await worker.fetch(request('foreign-token'), env, {});
  assert.equal(response.status, 401);
  assert.equal(upstream.filter(({ url }) => url.endsWith('/auth/v1/user')).length, 1);
  assert.equal(upstream.filter(({ url }) => url.includes('/rest/v1/books')).length, 0);

  env.RATE_LIMITER.blocked = true;
  response = await worker.fetch(request('foreign-token'), env, {});
  assert.equal(response.status, 429, 'rate-limit은 인증 upstream보다 먼저 종료해야 한다');
  assert.equal(upstream.filter(({ url }) => url.endsWith('/auth/v1/user')).length, 1);
  env.RATE_LIMITER.blocked = false;

  response = await worker.fetch(request('valid-user-token', ''), env, {});
  assert.equal(response.status, 400, '제목-only 전역 카탈로그 삽입을 허용하지 않아야 한다');

  response = await worker.fetch(request('valid-user-token'), env, {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).title, '서버 정본');
  assert.equal(upstream.some(({ init }) => init.body && String(init.body).includes('공격자가 보낸 제목')), false);
} finally {
  globalThis.fetch = originalFetch;
}

const source = readFileSync(new URL('../docs/readinggo/js/datastore-supabase.js', import.meta.url), 'utf8');
let refreshes = 0;
const clientFetches = [];
const auth = {
  async getSession() { return { data: { session: { access_token: 'expired-token', user: { id: 'u1' } } }, error: null }; },
  async refreshSession() { refreshes += 1; return { data: { session: { access_token: 'fresh-token', user: { id: 'u1' } } }, error: null }; },
};
const context = {
  console,
  Date,
  Math,
  setTimeout,
  clearTimeout,
  window: {
    RG_CONFIG: { API_ORIGIN: 'https://api.example' },
    RG_SB: { client: () => ({ auth }), onAuthChange: () => () => {} },
  },
  fetch: async (_url, init) => {
    clientFetches.push(init);
    return clientFetches.length === 1
      ? new Response('{}', { status: 401 })
      : Response.json({ id: 'canonical-book' });
  },
};
context.window.window = context.window;
vm.runInNewContext(source, context);
const result = await context.window.SupabaseDataStore.books.upsert({ isbn13: '9781234567897', title: '클라이언트 제목' });
assert.equal(result.id, 'canonical-book');
assert.equal(refreshes, 1, '401 뒤 세션 갱신은 한 번이어야 한다');
assert.equal(clientFetches.length, 2, '갱신 뒤 요청을 정확히 한 번 재시도해야 한다');
assert.equal(clientFetches[0].headers.Authorization, 'Bearer expired-token');
assert.equal(clientFetches[1].headers.Authorization, 'Bearer fresh-token');
assert.deepEqual(JSON.parse(clientFetches[1].body), { isbn13: '9781234567897' });

console.log('OK: book-upsert 인증·인증 전 rate-limit·서버 정본·세션 갱신 경계');

// /aladin 일반 검색은 페이지 크기와 provider continuation을 지켜야 한다 (#1547).
const kakaoDocuments = Array.from({ length: 60 }, (_, i) => ({
  isbn: `1234567890 9780000${String(i + 1).padStart(6, '0')}`,
  title: `카카오 책 ${i + 1}`,
  authors: ['저자'],
}));
const googleItems = Array.from({ length: 60 }, (_, i) => ({
  volumeInfo: {
    title: `Google Book ${i + 1}`,
    industryIdentifiers: [{ type: 'ISBN_13', identifier: `9790000${String(i + 1).padStart(6, '0')}` }],
  },
}));
const aladinItems = Array.from({ length: 60 }, (_, i) => ({
  isbn13: `9781000${String(i + 1).padStart(6, '0')}`,
  title: `알라딘 책 ${i + 1}`,
  author: '저자',
}));

async function searchResult(max, {
  kakaoFails = false,
  aladinFails = false,
  googleFailure = '',
  primaryCount = 60,
  legacy = false,
  isbn = false,
  cursor = '',
  expectedStatus = 200,
} = {}) {
  const savedFetch = globalThis.fetch;
  const upstream = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    upstream.push(url);
    if (url.hostname === 'dapi.kakao.com') {
      if (kakaoFails) return Response.json({ error: 'upstream failure' }, { status: 502 });
      const size = Number(url.searchParams.get('size') || 10);
      const page = Number(url.searchParams.get('page') || 1);
      const start = (page - 1) * size;
      return Response.json({
        documents: kakaoDocuments.slice(start, Math.min(start + size, primaryCount)),
        meta: { total_count: primaryCount, pageable_count: primaryCount, is_end: start + size >= primaryCount },
      });
    }
    if (url.hostname === 'www.googleapis.com') {
      if (googleFailure === 'network') throw new Error('google network failure');
      if (googleFailure === 'http') return Response.json({ error: 'google failure' }, { status: 502 });
      const size = Number(url.searchParams.get('maxResults') || 10);
      const start = Number(url.searchParams.get('startIndex') || 0);
      return Response.json({ totalItems: googleItems.length, items: googleItems.slice(start, start + size) });
    }
    if (url.hostname === 'aladin.co.kr') {
      if (aladinFails) throw new Error('aladin network failure');
      if (url.searchParams.has('ItemId')) return Response.json({ item: [aladinItems[0]] });
      const size = Number(url.searchParams.get('MaxResults') || 10);
      const page = Number(url.searchParams.get('start') || 1);
      const start = (page - 1) * size;
      return Response.json({ item: aladinItems.slice(start, Math.min(start + size, primaryCount)), totalResults: primaryCount });
    }
    throw new Error(`unexpected search upstream ${url}`);
  };
  try {
    const suffix = max == null ? '' : `&max=${encodeURIComponent(max)}`;
    const cursorSuffix = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const searchEnv = legacy || isbn
      ? { ALADIN_TTB_KEY: 'test-key', BOOKS_PROVIDER: 'aladin' }
      : { KAKAO_REST_KEY: 'test-key' };
    const requestPath = isbn ? `isbn=3234567890120${suffix}` : `query=test${suffix}${cursorSuffix}`;
    const response = await worker.fetch(new Request(`https://readinggo.example/aladin?${requestPath}`), searchEnv, {});
    assert.equal(response.status, expectedStatus);
    const body = await response.json();
    return { items: body.items || [], body, response, upstream };
  } finally {
    globalThis.fetch = savedFetch;
  }
}

for (const [max, expected] of [[1, 1], [2, 2], [5, 5], [10, 10], [20, 20], [50, 50], [51, 50]]) {
  const result = await searchResult(max);
  assert.equal(result.items.length, expected, `Kakao max=${max} 페이지 크기`);
}
assert.equal((await searchResult()).items.length, 10, 'max 미지정은 기본 페이지 10개');
assert.equal((await searchResult('invalid')).items.length, 10, '잘못된 max는 기본 페이지 10개');
assert.equal((await searchResult('2abc')).items.length, 10, '부분 숫자 max는 기본 페이지 10개');
assert.equal((await searchResult('2.5')).items.length, 10, '정수가 아닌 max는 기본 페이지 10개');
assert.equal((await searchResult(0)).items.length, 10, 'max=0은 기본 페이지 10개');
assert.equal((await searchResult(-1)).items.length, 10, '음수 max는 기본 페이지 10개');

const kakaoFirst = await searchResult(10, { primaryCount: 15 });
assert.deepEqual(kakaoFirst.upstream.map((url) => url.hostname), ['dapi.kakao.com']);
assert.equal(kakaoFirst.body.hasMore, true);
const kakaoSecond = await searchResult(10, { primaryCount: 15, cursor: kakaoFirst.body.nextCursor });
assert.equal(kakaoSecond.items.length, 5);
assert.equal(kakaoSecond.body.hasMore, true, 'primary 종료 뒤 Google continuation을 제공한다');
assert.deepEqual(kakaoSecond.upstream.map((url) => url.hostname), ['dapi.kakao.com']);
const googleAfterPrimary = await searchResult(10, { cursor: kakaoSecond.body.nextCursor });
assert.equal(googleAfterPrimary.items.length, 10);
assert.deepEqual(googleAfterPrimary.upstream.map((url) => url.hostname), ['www.googleapis.com']);

const kakaoFallback = await searchResult(20, { kakaoFails: true });
assert.equal(kakaoFallback.items.length, 20, 'Kakao 실패 fallback도 요청 페이지 크기를 지켜야 한다');
assert.match(kakaoFallback.response.headers.get('cache-control') || '', /max-age=3600/);
const kakaoDoubleFailure = await searchResult(10, { kakaoFails: true, googleFailure: 'http', expectedStatus: 502 });
assert.equal(kakaoDoubleFailure.items.length, 0);

for (const max of [2, 20, 50]) {
  const legacySuccess = await searchResult(max, { legacy: true });
  assert.equal(legacySuccess.items.length, max, `레거시 Aladin 성공 max=${max} 페이지 크기`);
  assert.match(legacySuccess.response.headers.get('cache-control') || '', /max-age=86400/);
  const legacyFallback = await searchResult(max, { legacy: true, aladinFails: true });
  assert.equal(legacyFallback.items.length, Math.min(max, 40), `Aladin 실패→Google fallback max=${max} 페이지 크기`);
  assert.match(legacyFallback.response.headers.get('cache-control') || '', /max-age=3600/);
}

const legacyFirst = await searchResult(10, { legacy: true, primaryCount: 15 });
const legacySecond = await searchResult(10, { legacy: true, primaryCount: 15, cursor: legacyFirst.body.nextCursor });
assert.equal(legacySecond.items.length, 5);
assert.equal(legacySecond.upstream[0].searchParams.get('start'), '2');

const legacyDoubleFailure = await searchResult(10, { legacy: true, aladinFails: true, googleFailure: 'network', expectedStatus: 502 });
assert.equal(legacyDoubleFailure.items.length, 0);

const isbnResult = await searchResult(1, { isbn: true });
assert.equal(isbnResult.items.length, 1, 'ISBN 단건 조회는 검색 pagination 변경의 영향을 받지 않아야 한다');
assert.ok(!isbnResult.upstream.some((url) => url.hostname === 'dapi.kakao.com'));

console.log('OK: book search page size, continuation, fallback and ISBN boundary');
