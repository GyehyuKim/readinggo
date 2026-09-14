import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) };
globalThis.window = { crypto: webcrypto, INITIAL_STATE: {} };
await import('../docs/readinggo/js/datastore.js');
const local = window.LocalDataStore;
local.local.configure({ storageKey: 'rg_dev_review_persona_room-test', initialState: { user_books: [], settings: {}, pending: {}, streak: {}, claps: {}, bookmarks: {}, wish_books: [] } });
const book = local.myBooks.add({ book: { title: 'Fixture' } });
const input = { userBookId: book.id, text: 'Original', migrationId: 'import-id', publishable_thought: 'Thought', created_at: 123 };
assert.equal(local.sentences.importExisting(input).page, null);
assert.equal(local.sentences.importExisting(input).id, 'import-id');
for (const change of [{ publishable_thought: 'changed' }, { sessionId: 'changed' }, { page: 2 }, { created_at: 456 }]) {
 assert.throws(() => local.sentences.importExisting({ ...input, ...change }), /idempotency_conflict/);
}
const calls = [];
const members = [{ user: { id: 'member', cumulativePage: null, todayRecorded: null, activityAvailable: false } }];
window.RG_SB = { client: () => ({ from() { throw Error('base table read prohibited'); }, rpc: async (name,args) => { calls.push({ name,args }); return { data: members }; } }) };
await import('../docs/readinggo/js/datastore-supabase.js');
const remote = window.SupabaseDataStore;
assert.equal(await remote.users.publicStreak('other'), null);
assert.deepEqual(await remote.rooms.members('room'), members);
assert.deepEqual(calls, [{ name: 'room_members_public', args: { p_room_id: 'room' } }]);
console.log('PASS: room RPC only, unavailable personal aggregate, local import conflict parity');
