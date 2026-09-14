import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const companion = source('companion.js');

test('conversation caller stores private roles, never rewrites legacy note', async () => {
  const calls = [];
  const sentence = { id: 'sentence-1', note: 'ambiguous Q. legacy', publishable_thought: 'explicit' };
  const context = { sentence, pendingRequest: { current: null }, window: { crypto: { randomUUID: () => 'request-1' } },
    DataStore: { sentenceConversations: { savePair: async (id, turn) => calls.push({ id, ...turn }) } } };
  vm.createContext(context);
  const body = companion.slice(companion.indexOf('  const persist = async'), companion.indexOf('  // 내 감상만 저장'));
  vm.runInContext(body + '\nglobalThis.persist = persist;', context);
  assert.equal(await context.persist([{ q: 'assistant question', a: 'private response' }]), true);
  assert.deepEqual(calls, [{ id: 'sentence-1', q: 'assistant question', a: 'private response', requestId: 'request-1' }]);
  assert.equal(sentence.note, 'ambiguous Q. legacy');
  assert.equal(sentence.publishable_thought, 'explicit');
});

test('thought callers use explicit field and leave mixed legacy notes out of drafts', () => {
  assert.match(companion, /_useState\(\(\) => sentence\.publishable_thought \|\| ''\)/);
  for (const file of ['companion.js', 'home.js']) {
    assert.doesNotMatch(source(file), /DataStore\.sentences\.setNote/);
    assert.match(source(file), /DataStore\.sentences\.setThought/);
  }
});

test('owner story candidates ignore stale sentence flags, require parent identity', () => {
  const text = source('book-detail-modal.js');
  const predicate = text.match(/const _storyPublicQuote = ([^;]+);/)[1];
  const eligible = vm.runInNewContext(predicate);
  assert.equal(eligible({ id: 's', userBookId: 'parent', visibility: 'private', isPrivate: true }), true);
  assert.equal(eligible({ id: 's', visibility: 'public' }), false);
  assert.match(text, /RG_sharePublicRecordLink\(\{ userBookId: book\.ubId, bookTitle: book\.title \}, 'books'\)/);
});

test('migration callers preserve stable identity and source timestamp', () => {
  const app = source('app.js');
  assert.match(app, /migrationId: se\._migration_sentence_id, created_at: se\.created_at/);
  assert.match(app, /migrationId: pend\.sentence\._migration_sentence_id, created_at: pend\.sentence\.created_at/);
  assert.match(app, /publishable_thought: se\.publishable_thought \?\? null/);
  assert.doesNotMatch(app, /backfillCompanionSessions\(\);/);
});

test('caller projections retain parent and explicit thought for share', () => {
  for (const file of ['app.js', 'sentence-collection-modal.js', 'book-detail-modal.js']) {
    assert.match(source(file), /userBookId:/);
    assert.match(source(file), /publishable_thought:/);
  }
  assert.doesNotMatch(source('home.js'), /settings\.default_sentence_visibility/);
});
