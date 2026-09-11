// Actual Worker handler; only Supabase RPC transport is mocked. Not live DB/RLS evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.mjs';
const bookId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const parent = { id: bookId, book: { title: '<script>bad</script>', author: 'Writer' }, author: { displayName: 'Reader' }, my_note: 'SECRET' };
const sentence = { id, userBookId: bookId, parent, page: 42, text: '<img onerror=bad>', thought: 'Own thought', my_note: 'SECRET', userId: 'PRIVATE_ID', session: 'SECRET' };
const env = { SUPABASE_URL: 'https://db.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-key' };
async function run(path, rpc, options = {}) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Response(JSON.stringify(await rpc(url, JSON.parse(init.body))), { status: 200 }); };
  try { const response = await worker.fetch(new Request('https://reading.example' + path, options), env, {}); return { response, body: await response.text(), calls }; }
  finally { globalThis.fetch = original; }
}
test('anonymous HTML renders actual bounded records, escaped OG and attribution without SPA', async () => {
  const result = await run('/public/sentences/' + id, () => sentence);
  assert.equal(result.response.status, 200);
  assert.match(result.body, /&lt;script&gt;/);
  assert.match(result.body, /&lt;img onerror=bad&gt;/);
  assert.match(result.body, /42쪽/);
  assert.doesNotMatch(result.body, /SECRET|PRIVATE_ID|<script>|<img onerror/);
  assert.equal(result.response.headers.get('Cache-Control'), 'private, no-store');
});
test('JSON allowlists quote/own_thought, rights and machine-readable guidance', async () => {
  const result = await run('/public/sentences/' + id + '.json', () => sentence);
  const data = JSON.parse(result.body);
  assert.deepEqual(data.records[0].content.map(c => c.content_type), ['quote', 'own_thought']);
  assert.equal(data.records[0].content[0].source_url, null);
  assert.equal(data.rights, 'unknown');
  assert.equal(data.reuse_guidance.full_text_reconstruction_allowed, false);
  assert.doesNotMatch(result.body, /SECRET|PRIVATE_ID|my_note/);
});
test('book uses gated RPCs, bounded 50 and parent readback', async () => {
  const result = await run('/public/books/' + bookId + '.json', url => url.endsWith('book_public') ? parent : Array.from({ length: 60 }, () => ({ ...sentence, user_book_id: bookId })));
  assert.equal(JSON.parse(result.body).records.length, 50);
  assert.equal(JSON.parse(result.body).collection_complete, false);
  assert.equal(result.calls.length, 3);
  assert.deepEqual(JSON.parse(result.calls[1].body), { p_user_book_id: bookId, p_sentence_id: null });
});
test('private, missing, hidden and blocked RPC denial have identical bodies', async () => {
  const bodies = [];
  for (const scenario of ['private', 'missing', 'hidden', 'blocked']) {
    const result = await run('/public/sentences/' + id + '.json', () => null);
    assert.equal(result.response.status, 404, scenario); bodies.push(result.body);
  }
  assert.equal(new Set(bodies).size, 1);
});
test('viewer bearer reaches JWT-verifying RPC, forged identity headers never do', async () => {
  const result = await run('/public/sentences/' + id, () => null, { headers: { Authorization: 'Bearer viewer.jwt.token', 'x-user-id': 'forged', Cookie: 'identity=forged' } });
  assert.equal(result.calls[0].headers.Authorization, 'Bearer viewer.jwt.token');
  assert.equal(result.calls[0].headers['x-user-id'], undefined);
  assert.equal(result.calls[0].headers.Cookie, undefined);
});
test('withdrawal between reads, RPC errors, malformed IDs and HEAD fail safely', async () => {
  let n = 0;
  const revoked = await run('/public/books/' + bookId, url => url.endsWith('book_public') ? (++n === 1 ? parent : null) : [sentence]);
  assert.equal(revoked.response.status, 404); assert.doesNotMatch(revoked.body, /Writer/);
  const failure = await run('/public/sentences/' + id, () => { throw Error('SECRET'); });
  assert.equal(failure.response.status, 503); assert.doesNotMatch(failure.body, /SECRET/);
  const malformed = await run('/public/books/not-a-uuid', () => { throw Error('must not call'); });
  assert.equal(malformed.calls.length, 0); assert.equal(malformed.response.status, 404);
  const head = await run('/public/sentences/' + id, () => sentence, { method: 'HEAD' });
  assert.equal(head.response.status, 200); assert.equal(head.body, '');
});
