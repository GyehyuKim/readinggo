import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import worker from '../worker/index.mjs';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function kakaoDocuments(count, page = 1) {
  return Array.from({ length: count }, (_, i) => {
    const n = ((page - 1) * 50) + i + 1;
    return {
      isbn: `1234567890 9780000${String(n).padStart(6, '0')}`,
      title: `일반 검색 ${n}`,
      authors: [`저자 ${n}`],
      publisher: '국내 출판사',
      thumbnail: `https://example.com/kakao-${n}.jpg`,
      contents: '일반 검색 결과',
      datetime: '2026-08-01T00:00:00.000+09:00',
    };
  });
}

function googleVolumes(count, page = 1) {
  return Array.from({ length: count }, (_, i) => {
    const n = ((page - 1) * 40) + i + 1;
    return {
      id: `google-${n}`,
      volumeInfo: {
        title: `Google result ${n}`,
        authors: [`Google author ${n}`],
        publisher: 'Google publisher',
        industryIdentifiers: [{ type: 'ISBN_13', identifier: `9790000${String(n).padStart(6, '0')}` }],
      },
    };
  });
}

function installProviders({ kakaoPages = {}, kakaoTotal = 0, googlePages = {}, googleTotal = 0 }) {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.hostname === 'dapi.kakao.com') {
      const page = Number(url.searchParams.get('page') || 1);
      const documents = kakaoDocuments(kakaoPages[page] || 0, page);
      return Response.json({
        documents,
        meta: {
          total_count: kakaoTotal,
          pageable_count: kakaoTotal,
          is_end: page >= Math.ceil(kakaoTotal / Number(url.searchParams.get('size') || 10)),
        },
      });
    }
    if (url.hostname === 'www.googleapis.com') {
      const maxResults = Number(url.searchParams.get('maxResults') || 10);
      const page = Math.floor(Number(url.searchParams.get('startIndex') || 0) / maxResults) + 1;
      return Response.json({ totalItems: googleTotal, items: googleVolumes(googlePages[page] || 0, page) });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return calls;
}

async function search(params = '') {
  const suffix = params ? `&${params}` : '';
  return worker.fetch(
    new Request(`https://readinggo.example/aladin?query=${encodeURIComponent('Hemingway')}${suffix}`),
    { KAKAO_REST_KEY: 'test-key' },
    { waitUntil() {} },
  );
}

test('첫 페이지는 10권과 primary continuation 메타를 반환한다', async () => {
  const calls = installProviders({ kakaoPages: { 1: 10 }, kakaoTotal: 25 });
  const response = await search();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 10);
  assert.equal(body.items.every((item) => item.source === 'kakao'), true);
  assert.equal(body.hasMore, true);
  assert.equal(typeof body.nextCursor, 'string');
  assert.equal(body.totalCount, 25);
  assert.equal(body.pageableCount, 25);
  assert.equal(calls[0].searchParams.get('page'), '1');
  assert.equal(calls.some((url) => url.hostname === 'www.googleapis.com'), false);
});

test('nextCursor는 일반 검색의 다음 Kakao 페이지를 이어서 조회한다', async () => {
  const calls = installProviders({ kakaoPages: { 1: 10, 2: 10 }, kakaoTotal: 25 });
  const first = await search();
  const cursor = (await first.json()).nextCursor;
  const second = await search(`cursor=${encodeURIComponent(cursor)}`);
  assert.equal(second.status, 200);
  const body = await second.json();
  assert.equal(body.items.length, 10);
  assert.equal(body.items[0].title, '일반 검색 51');
  assert.equal(calls.filter((url) => url.hostname === 'dapi.kakao.com')[1].searchParams.get('page'), '2');
});

test('max는 전체 상한이 아니라 최대 50의 페이지 크기다', async () => {
  const calls = installProviders({ kakaoPages: { 1: 30 }, kakaoTotal: 70 });
  const response = await search('max=30');
  const body = await response.json();
  assert.equal(body.items.length, 30);
  assert.equal(calls[0].searchParams.get('size'), '30');
  assert.equal(body.hasMore, true);
});

test('primary 마지막 페이지 뒤에는 Google 첫 페이지 continuation을 제공한다', async () => {
  installProviders({ kakaoPages: { 1: 4 }, kakaoTotal: 4, googlePages: { 1: 10 }, googleTotal: 30 });
  const first = await search();
  const firstBody = await first.json();
  assert.equal(firstBody.items.length, 4);
  assert.equal(firstBody.hasMore, true);

  const second = await search(`cursor=${encodeURIComponent(firstBody.nextCursor)}`);
  const secondBody = await second.json();
  assert.equal(secondBody.items.length, 10);
  assert.equal(secondBody.items.every((item) => item.source === 'google'), true);
  assert.equal(secondBody.hasMore, true);
});

test('변조되거나 범위를 벗어난 cursor는 provider 호출 전에 400으로 거부한다', async () => {
  const calls = installProviders({ kakaoPages: { 1: 10 }, kakaoTotal: 10 });
  for (const cursor of ['broken', 'kakao:0', 'kakao:51', 'other:1']) {
    const response = await search(`cursor=${encodeURIComponent(cursor)}`);
    assert.equal(response.status, 400);
  }
  assert.equal(calls.length, 0);
});

test('Google continuation은 Google provider 예산으로 예약한다', async () => {
  installProviders({ googlePages: { 1: 10 }, googleTotal: 10 });
  let reservedProvider = '';
  const guard = {
    idFromName() { return 'global'; },
    get() {
      return {
        async fetch(_url, init) {
          reservedProvider = JSON.parse(init.body).provider;
          return new Response('{}', { status: 200 });
        },
      };
    },
  };
  const response = await worker.fetch(
    new Request('https://readinggo.example/aladin?query=Hemingway&cursor=google%3A1'),
    { KAKAO_REST_KEY: 'test-key', BOOK_PROVIDER_GUARD: guard },
    { waitUntil() {} },
  );
  assert.equal(response.status, 200);
  assert.equal(reservedProvider, 'google');
});
