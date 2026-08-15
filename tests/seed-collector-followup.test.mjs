import assert from 'node:assert/strict';
import { crawlYes24, productIsbnFromMetadata, productItempropFromDocument } from '../collector/lib/yes24.mjs';
import { writeSeedsAsNpc } from '../collector/lib/npc.mjs';
import { markDone, markFailed } from '../collector/lib/queue.mjs';
import { processOne } from '../collector/poller.mjs';

const SB = 'https://seed-followup-test.supabase.co';
process.env.SUPABASE_URL = SB;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
const originalFetch = globalThis.fetch;

const CURRENT_ISBN = '9788937460449';
const RELATED_ISBN = '9788937460777';

// 관련상품 ISBN이 JSON-LD 안에 먼저 있어도 본체 Book만 신뢰한다.
assert.equal(productIsbnFromMetadata({
  jsonLd: [JSON.stringify({
    '@type': 'Book',
    isbn: CURRENT_ISBN,
    relatedLink: [{ '@type': 'Book', isbn: RELATED_ISBN }],
  })],
}), CURRENT_ISBN);
assert.equal(productIsbnFromMetadata({ itemprop: [RELATED_ISBN, CURRENT_ISBN] }), '', '충돌하는 상품 영역 ISBN은 fail-closed 해야 한다');
assert.equal(productIsbnFromMetadata({
  meta: [RELATED_ISBN],
  jsonLd: [JSON.stringify({ '@type': 'Book', isbn: CURRENT_ISBN })],
}), '', 'meta와 JSON-LD의 ISBN이 충돌하면 source 우선순위 없이 fail-closed 해야 한다');
assert.equal(productIsbnFromMetadata({
  jsonLd: [JSON.stringify({
    '@graph': [
      { '@type': 'WebPage', mainEntity: { '@id': '#current' } },
      { '@id': '#related', '@type': 'Book', isbn: RELATED_ISBN },
      { '@id': '#current', '@type': 'Book', isbn: CURRENT_ISBN },
    ],
  })],
}), CURRENT_ISBN, 'WebPage.mainEntity @id가 가리키는 상품만 따라가야 한다');
assert.equal(productIsbnFromMetadata({
  jsonLd: [JSON.stringify({
    '@graph': [
      { '@type': 'WebPage', mainEntity: { '@type': 'Book', isbn: CURRENT_ISBN } },
      { '@type': 'Book', isbn: RELATED_ISBN },
    ],
  })],
}), CURRENT_ISBN, 'graph 내부 WebPage.mainEntity 객체를 본체로 인식해야 한다');
assert.equal(productIsbnFromMetadata({
  jsonLd: [JSON.stringify({ '@graph': [
    { '@type': 'Book', isbn: CURRENT_ISBN },
    { '@type': 'Book', isbn: RELATED_ISBN },
  ] })],
}), '', 'mainEntity 없는 복수 상품 graph는 임의 선택하지 않는다');
let currentScope;
const currentIsbnElement = {
  getAttribute: (name) => (name === 'content' ? CURRENT_ISBN : ''),
  textContent: '',
  closest: () => currentScope,
};
currentScope = {
  getAttribute: (name) => (name === 'itemtype' ? 'https://schema.org/Book' : ''),
  querySelectorAll: () => [currentIsbnElement],
};
const directDocument = {
  querySelectorAll: (selector) => {
    assert.equal(selector, '#yDetailTopWrap[itemscope],#infoset_specific[itemscope],main[itemscope]');
    return [currentScope];
  },
};
assert.deepEqual(productItempropFromDocument(directDocument), [CURRENT_ISBN], '현재 상품 wrapper 자체의 직접 ISBN은 허용한다');
const nestedRelatedOnlyDocument = {
  querySelectorAll: (selector) => {
    assert.equal(selector, '#yDetailTopWrap[itemscope],#infoset_specific[itemscope],main[itemscope]');
    // 실제 DOM에는 #yDetailTopWrap 아래 related Product scope만 있지만 wrapper 자체는 itemscope가 아니다.
    return [];
  },
};
assert.deepEqual(productItempropFromDocument(nestedRelatedOnlyDocument), [], 'wrapper 아래 related Product만 있으면 ISBN 근거로 쓰지 않는다');

function fakeManaged({ metadataIsbn, bodyFirstIsbn = RELATED_ISBN }) {
  let current = '';
  const page = {
    async goto(url) { current = String(url); },
    async waitForSelector() {},
    url() { return current; },
    async $$eval() { return ['/product/goods/123']; },
    async evaluate(fn, position) {
      if (position !== undefined) return true;
      if (String(fn).includes('querySelectorAll')) return { meta: [metadataIsbn], jsonLd: [], itemprop: [] };
      return `관련상품 ISBN ${bodyFirstIsbn}\n현재 상품 ISBN ${metadataIsbn}\n책 속으로\n검증할 수 있는 충분히 긴 원문 발췌 문장입니다.\n출판사 리뷰`;
    },
    async waitForTimeout() {},
    async close() {},
  };
  return { warmup: async () => {}, context: { newPage: async () => page } };
}

let crawl = await crawlYes24(fakeManaged({ metadataIsbn: CURRENT_ISBN }), {
  title: '데미안', author: '헤르만 헤세', isbn: RELATED_ISBN,
});
assert.equal(crawl.status, 'isbn-mismatch', '본문 첫 관련상품 ISBN을 현재 상품 ISBN으로 오인하면 안 된다');
assert.deepEqual(crawl.seeds, []);

crawl = await crawlYes24(fakeManaged({ metadataIsbn: CURRENT_ISBN }), {
  title: '데미안', author: '헤르만 헤세', isbn: CURRENT_ISBN,
});
assert.equal(crawl.status, 'ok');
assert.equal(crawl.seeds.length, 1);

const job = { id: 1439, attempts: 0, title: '데미안', author: '헤르만 헤세', isbn: CURRENT_ISBN };
const seeds = [{ text: '검증된 문장', sourceName: '예스24 책속으로', sourceUrl: 'https://www.yes24.com/product/goods/123' }];

async function transitionFor(outcome) {
  const transitions = [];
  await processOne(job, {
    managed: {},
    crawlYes24: async () => ({ status: 'ok', seeds }),
    writeSeedsAsNpc: async () => outcome,
    markDone: async (id) => transitions.push(['done', id]),
    markFailed: async (id, attempts, reason) => { transitions.push(['failed', id, attempts, reason]); return 'pending'; },
    log: () => {},
  });
  return transitions;
}

assert.deepEqual(await transitionFor({ written: 1, outcome: 'written' }), [['done', 1439]]);
assert.deepEqual(await transitionFor({ written: 0, outcome: 'already-exists' }), [['done', 1439]], '이미 존재하는 0건 신규는 정상 완료');
let transitions = await transitionFor({ written: 0, outcome: 'retryable', reason: 'npc-pool-empty' });
assert.deepEqual(transitions, [['failed', 1439, 0, 'npc write: npc-pool-empty']], '일시 0건은 attempts를 사용해 재시도');
transitions = await transitionFor({ written: 0, outcome: 'rejected', reason: 'unverified-source' });
assert.equal(transitions[0][0], 'failed');
assert.equal(transitions[0][2], 99, '영구 검증 거부는 즉시 failed 처리');

// 실제 writer 경로에서 빈 NPC 응답은 TypeError가 아니라 구조화된 retryable 결과여야 한다.
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  if (url.pathname === '/rest/v1/books') return Response.json([{ id: 'canonical-book-id', title: '데미안' }]);
  if (url.pathname === '/rest/v1/sentences' && !init.method) return Response.json([]);
  if (url.pathname === '/rest/v1/users') return Response.json([]);
  throw new Error(`unexpected empty-pool fetch ${url}`);
};
const emptyPool = await writeSeedsAsNpc(
  { title: '데미안', author: '헤르만 헤세', isbn: CURRENT_ISBN },
  seeds,
);
assert.deepEqual(
  { written: emptyPool.written, outcome: emptyPool.outcome, reason: emptyPool.reason },
  { written: 0, outcome: 'retryable', reason: 'npc-pool-empty' },
);

// queue PATCH가 거부되거나 네트워크 오류면 성공 상태를 보고하지 않는다.
globalThis.fetch = async () => new Response(null, { status: 503 });
await assert.rejects(markDone(1439), /queue-done-http-503/);
await assert.rejects(markFailed(1439, 0, 'temporary'), /queue-failed-http-503/);
globalThis.fetch = async () => { throw new Error('offline'); };
await assert.rejects(markDone(1439), /queue-done-network: offline/);
await assert.rejects(markFailed(1439, 0, 'temporary'), /queue-failed-network: offline/);

globalThis.fetch = originalFetch;

console.log('OK: product-scoped ISBN and zero-write queue transitions');
