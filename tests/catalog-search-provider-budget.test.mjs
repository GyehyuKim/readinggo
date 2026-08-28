import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import worker from '../worker/index.mjs';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function kakaoDocuments(count) {
  return Array.from({ length: count }, (_, i) => ({
    isbn: `1234567890 978000000${String(i).padStart(4, '0')}`,
    title: `여름 ${i + 1}`,
    authors: [`국내 저자 ${i + 1}`],
    publisher: '국내 출판사',
    thumbnail: `https://example.com/kakao-${i + 1}.jpg`,
    contents: '여름 관련 책',
    datetime: '2026-08-01T00:00:00.000+09:00',
  }));
}

function googleVolumes(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `google-${i + 1}`,
    volumeInfo: {
      title: `Foreign summer ${i + 1}`,
      authors: [`Foreign author ${i + 1}`],
      publisher: 'Foreign publisher',
      industryIdentifiers: [{ type: 'ISBN_13', identifier: `979000000${String(i).padStart(4, '0')}` }],
    },
  }));
}

async function search({ max = 10, kakaoCount, googleCount = 0 }) {
  let googleCalls = 0;
  let googleMaxResults = null;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'dapi.kakao.com') {
      return Response.json({ documents: kakaoDocuments(kakaoCount) });
    }
    if (url.hostname === 'www.googleapis.com') {
      googleCalls += 1;
      googleMaxResults = Number(url.searchParams.get('maxResults'));
      return Response.json({ items: googleVolumes(googleCount) });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const response = await worker.fetch(
    new Request(`https://readinggo.example/aladin?query=${encodeURIComponent('여름')}&max=${max}`),
    { KAKAO_REST_KEY: 'test-key' },
    { waitUntil() {} },
  );
  assert.equal(response.status, 200);
  return { body: await response.json(), googleCalls, googleMaxResults };
}

test('주 공급자가 예산을 채우면 국내 검색 결과를 5권으로 자르지 않는다', async () => {
  const { body, googleCalls } = await search({ max: 10, kakaoCount: 10 });
  assert.equal(body.items.length, 10);
  assert.equal(body.items.every((item) => item.source === 'kakao'), true);
  assert.equal(googleCalls, 0);
});

test('주 공급자가 부족할 때만 Google Books가 남은 결과 예산을 채운다', async () => {
  const { body, googleCalls, googleMaxResults } = await search({ max: 10, kakaoCount: 6, googleCount: 4 });
  assert.equal(body.items.length, 10);
  assert.equal(body.items.filter((item) => item.source === 'kakao').length, 6);
  assert.equal(body.items.filter((item) => item.source === 'google').length, 4);
  assert.equal(googleCalls, 1);
  assert.equal(googleMaxResults, 4);
});

test('max=20 요청도 제품 총 10권 상한 안에서 주 공급자 결과를 보존한다', async () => {
  const { body, googleCalls } = await search({ max: 20, kakaoCount: 20 });
  assert.equal(body.items.length, 10);
  assert.equal(body.items.every((item) => item.source === 'kakao'), true);
  assert.equal(googleCalls, 0);
});
