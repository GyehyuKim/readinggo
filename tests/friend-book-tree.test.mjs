import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const migration = read('docs/readinggo/supabase/56_friend_book_tree.sql');
const treeFunction = migration.slice(
  migration.indexOf('create or replace function public.friend_book_tree(p_owner_id uuid)'),
  migration.indexOf('create or replace function public.friend_book_tree_leaves('),
);
const sqlRegression = read('tests/sql/friend-book-tree.sql');
const adapter = read('docs/readinggo/js/datastore-supabase.js');
const local = read('docs/readinggo/js/datastore.js');
const profile = read('docs/readinggo/js/user-profile-modal.js');
const social = read('docs/readinggo/js/social.js');
const config = read('docs/readinggo/js/config.js');
const analytics = read('docs/readinggo/specs/analytics.md');
const uiSource = read('docs/readinggo/js/friend-book-tree-view.js');
const uiWindow = { React: { createElement() {}, useEffect() {}, useRef(v) { return { current: v }; }, useState(v) { return [v, () => {}]; } } };
vm.runInNewContext(uiSource, { window: uiWindow, React: uiWindow.React, console });
const { bucketFriendTreeCount, friendTreeSentenceItem } = uiWindow;

test('migration exposes one field-limited SECURITY DEFINER RPC and fails closed', () => {
  assert.match(migration, /create or replace function public\.friend_book_tree\(p_owner_id uuid\)/i);
  assert.match(migration, /security definer[\s\S]+set search_path = public, pg_temp/i);
  assert.match(migration, /v_viewer uuid := auth\.uid\(\)[\s\S]+if v_viewer is null or p_owner_id is null[\s\S]+raise exception 'friend_tree_forbidden'/i);
  assert.match(migration, /a\.follower_id = v_viewer and a\.following_id = p_owner_id/i);
  assert.match(migration, /b\.follower_id = p_owner_id and b\.following_id = v_viewer/i);
  assert.match(migration, /moderation_user_visible\(p_owner_id\)/i);
  assert.match(migration, /friend_tree_sharing[\s\S]+opted_out/i);
  assert.match(migration, /not \(coalesce\(u\.settings[\s\S]+\? 'friend_tree_sharing'\) then false/i);
  assert.match(migration, /visibility in \('public', 'followers', 'friends'\)/i);
  assert.match(migration, /wish_books[\s\S]+not exists[\s\S]+user_books existing[\s\S]+existing\.book_id = wb\.book_id/i);
  assert.match(migration, /moderation_hidden_sentences/i);
  assert.doesNotMatch(migration, /current_page|rating|review_text|my_note/i);
  assert.match(migration, /revoke all on function public\.friend_book_tree\(uuid\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.friend_book_tree\(uuid\) to authenticated/i);
  assert.doesNotMatch(treeFunction, /'id',\s*(ub|wb)\.id|'started_at'|'leaves'/i);
  assert.match(migration, /create or replace function public\.friend_book_tree_leaves\([\s\S]+v_limit integer := least\(greatest\(coalesce\(p_limit, 20\), 1\), 50\)/i);
  assert.match(migration, /offset v_offset limit v_limit/i);
  assert.match(migration, /revoke all on function public\.friend_book_tree_leaves\(uuid, uuid, integer, integer\) from public, anon/i);
});

test('SQL regression covers roles, explicit opt-in, immediate opt-out, and private non-inference', () => {
  assert.match(sqlRegression, /^begin;[\s\S]+rollback;\s*$/im);
  for (const marker of ['owner_control', 'default_opt_in_required', 'friend_control', 'nonfriend_denied', 'blocked_denied', 'anonymous_denied', 'opt_out_immediate', 'private_body_absent', 'private_count_absent', 'direct_private_id_absent']) {
    assert.match(sqlRegression, new RegExp(marker));
  }
});

test('DataStore uses only friend RPC and local/guest fails closed', () => {
  assert.match(adapter, /friendBookTree:\s*\{[\s\S]+rpc\('friend_book_tree'/);
  assert.match(adapter, /leaves\(ownerId, bookId, offset, limit\)[\s\S]+rpc\('friend_book_tree_leaves'/);
  assert.match(adapter, /setSharing[\s\S]+rpc\('friend_book_tree_set_sharing'/);
  assert.doesNotMatch(adapter.match(/friendBookTree:\s*\{[\s\S]+?\n\s*\},/s)?.[0] || '', /from\('user_books'\)|from\('sentences_public'\)/);
  assert.match(local, /friendBookTree:\s*\{[\s\S]+get\(\).*friend_tree_login_required/s);
});

test('friend UI is gated, reachable from profile and feed, and restores branch selection behind book detail', () => {
  assert.match(config, /friendBookTree:\s*RG_BUILD_ENV\s*===\s*['"]development['"]/);
  assert.match(profile, /RG_flag\('friendBookTree'\)/);
  assert.match(profile, /책나무 보기/);
  assert.match(profile, /FriendBookTreeView/);
  assert.match(social, /friendTreeSentence/);
  assert.match(social, /책나무 보기/);
  assert.match(profile, /friendTreeSelectedId/);
  assert.match(profile, /initialFriendTree[\s\S]+if \(relation\.mutual\) setFriendTreeOpen\(true\)[\s\S]+setFriendTreeNotice\(true\)/);
  assert.match(profile, /profileFriendRelation\(DS, target[\s\S]+setMutualFriend\(relation\.mutual\)/);
  assert.match(profile, /서로 팔로우한 친구만 책나무를 볼 수 있어요/);
  assert.match(profile, /_profileOverlayBack\(friendTreeOpen[\s\S]+_profileOverlayBack\(friendTreeOpen && !!friendTreeSelectedId/);
  assert.match(uiSource, /friendBookTree\.leaves\(ownerId, selectedBookId, 0, LEAF_PAGE_SIZE\)/);
  assert.match(uiSource, /공개 문장 더 보기/);
  assert.match(uiSource, /RG_openBook\(selected\.book_id\)/);
  assert.doesNotMatch(uiSource, /branch\.id/);
});

test('friend leaves reuse SentenceCard shape and analytics use only approved buckets', () => {
  const item = friendTreeSentenceItem({ id: 's1', text: '문장', page: 3, created_at: '2026-08-23T00:00:00Z' }, { id: 'b1', title: '책 제목', author: '작가' }, { id: 'u1', handle: 'friend' });
  assert.deepEqual({ id: item.id, q: item.q, page: item.page, bookId: item.bookId, userId: item.userId }, { id: 's1', q: '문장', page: 3, bookId: 'b1', userId: 'u1' });
  assert.equal(bucketFriendTreeCount(0), '0');
  assert.equal(bucketFriendTreeCount(1), '1-5');
  assert.equal(bucketFriendTreeCount(6), '6-20');
  assert.equal(bucketFriendTreeCount(21), '21-100');
  assert.equal(bucketFriendTreeCount(101), '101+');
  const ui = read('docs/readinggo/js/friend-book-tree-view.js');
  assert.match(ui, /window\.SentenceCard/);
  assert.match(ui, /friend_book_tree_viewed/);
  assert.doesNotMatch(ui, /owner_id|user_id\s*:|book_title|sentence_text|private_count/i);
  assert.match(analytics, /friend_book_tree_viewed/);
  assert.match(analytics, /branch_count_bucket/);
});
