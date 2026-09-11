// Actual share-card functions in VM; mocked DataStore only, not live RPC evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('./share-card.js', import.meta.url), 'utf8');
const id = '22222222-2222-4222-8222-222222222222';
const ub = '11111111-1111-4111-8111-111111111111';
function setup(store) {
 const sent = [];
 const c = vm.createContext({ window: { DataStore: store }, location: { origin: 'https://reading.example' }, navigator: { share: async value => sent.push(value) }, console });
 vm.runInContext(source, c); return { c, sent };
}
test('other public sentence reshare uses public reader, not owner RPC', async () => {
 const { c, sent } = setup({ auth: { currentUser: async () => ({ id: 'viewer' }) }, myBooks: { publicBook: async () => ({ id: ub }), getVisibility: async () => { throw Error('owner RPC forbidden'); } }, sentences: { publicByBook: async () => [{ id }] } });
 assert.equal(await c.window.RG_sharePublicRecordLink({ id, userBookId: ub, userId: 'other' }), true);
 assert.equal(sent[0].url, 'https://reading.example/public/sentences/' + id);
});
test('own unknown blocks link; private cancellation blocks mutation and share', async () => {
 let writes = 0;
 const store = { auth: { currentUser: async () => ({ id: 'owner' }) }, myBooks: { getVisibility: async () => null, setVisibility: async () => writes++ } };
 const { c, sent } = setup(store);
 const target = { id, userBookId: ub, userId: 'owner' };
 assert.equal(await c.window.RG_sharePublicRecordLink(target), false);
 store.myBooks.getVisibility = async () => ({ id: ub, visibility: 'private', revision: 1 });
 vm.runInContext('_confirmBookPublication = async () => false', c);
 assert.equal(await c.window.RG_sharePublicRecordLink(target), false);
 assert.equal(sent.length, 0); assert.equal(writes, 0);
});
test('book links preserve user-book identity and sentence text carries actual URL', () => {
 const { c } = setup({});
 assert.equal(c.window.RG_publicShareUrl({ userBookId: ub }, 'books'), 'https://reading.example/public/books/' + ub);
 assert.match(c.window.buildShareText({ id, text: 'quote' }), new RegExp('/public/sentences/' + id));
});
