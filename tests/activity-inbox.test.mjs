import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const migration = read('docs/readinggo/supabase/57_activity_inbox.sql');
const sqlRegression = read('tests/sql/activity-inbox.sql');
const supabase = read('docs/readinggo/js/datastore-supabase.js');
const local = read('docs/readinggo/js/datastore.js');
const ui = read('docs/readinggo/js/activity-inbox.js');
const app = read('docs/readinggo/js/app.js');
const main = read('docs/readinggo/main.js');
const createRequestGate = vm.runInNewContext(`${ui.slice(0, ui.indexOf('function ActivityInboxButton'))}\ncreateActivityInboxRequestGate`);

function domain(source, name, nextName) {
  const start = source.indexOf(`${name}: {`);
  const end = source.indexOf(`${nextName}: {`, start);
  return source.slice(start, end);
}

test('migration derives a bounded deterministic current projection without snapshots', () => {
  assert.match(migration, /create table if not exists public\.activity_inbox_state/);
  assert.match(migration, /seen_event_keys text\[\][\s\S]+cardinality\(seen_event_keys\) <= 100/);
  assert.match(migration, /from public\.claps[\s\S]+union all[\s\S]+from public\.follows[\s\S]+union all[\s\S]+from public\.pokes/i);
  assert.match(migration, /s\.user_id = p_viewer[\s\S]+c\.from_user_id <> p_viewer/);
  assert.match(migration, /f\.following_id = p_viewer[\s\S]+f\.follower_id <> p_viewer/);
  assert.match(migration, /p\.to_user_id = p_viewer[\s\S]+p\.from_user_id <> p_viewer/);
  assert.match(migration, /statement_timestamp\(\) - interval '90 days'/);
  assert.match(migration, /order by v\.occurred_at desc, v\.kind asc, v\.event_key asc[\s\S]+limit 100/);
  assert.match(migration, /follow:' \|\| encode\(extensions\.digest\([\s\S]+f\.created_at[\s\S]+'sha256'/);
  assert.doesNotMatch(migration, /encode\(digest\(/, 'restricted search_path에서 public.digest를 찾지 않아야 한다');
  for (const filter of ['moderation_suspended_users', 'user_blocks', 'moderation_hidden_sentences']) {
    assert.match(migration, new RegExp(filter));
  }
  assert.doesNotMatch(migration, /notification|snapshot/i);
});

test('mark-seen validates, intersects, atomically merges, prunes and keeps late keys unread', () => {
  const mark = migration.slice(migration.indexOf('create or replace function public.activity_inbox_mark_seen'));
  assert.match(mark, /cardinality\(p_event_keys\) > 100/);
  assert.match(mark, /btrim\(k\) = ''/);
  assert.match(mark, /select distinct btrim\(k\)/);
  assert.match(mark, /activity_inbox_projection\(v_uid\)[\s\S]+p\.event_key = any\(v_requested\)/);
  assert.match(mark, /on conflict \(user_id\) do update set[\s\S]+activity_inbox_projection\(v_uid\)[\s\S]+seen_event_keys \|\| excluded\.seen_event_keys/i);
  assert.match(mark, /insert into public\.activity_inbox_state\(user_id, seen_event_keys, updated_at\)[\s\S]+select[\s\S]+from public\.activity_inbox_projection\(v_uid\) p[\s\S]+where p\.event_key = any\(v_requested\)[\s\S]+on conflict/i);
  assert.doesNotMatch(mark, /values \(v_uid, v_allowed,/i);
  assert.match(mark, /activity_inbox_projection\(v_uid\)[\s\S]+where p\.event_key = any/);
  for (const marker of ['top100_bound_failed', 'same_timestamp_order_failed', 'late_same_timestamp_was_marked', 'refollow_key_reused', 'arbitrary_key_persisted', 'blank_key_accepted']) {
    assert.match(sqlRegression, new RegExp(marker));
  }
});

test('state and RPC privileges are owner/authenticated only', () => {
  assert.match(migration, /alter table public\.activity_inbox_state enable row level security/);
  assert.match(migration, /for select using \(user_id = auth\.uid\(\)\)/);
  assert.match(migration, /revoke all on public\.activity_inbox_state from public, anon, authenticated/);
  assert.match(migration, /grant select on public\.activity_inbox_state to authenticated/);
  for (const signature of ['activity_inbox\\(\\)', 'activity_inbox_unread_count\\(\\)', 'activity_inbox_mark_seen\\(text\\[\\]\\)']) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon[\\s\\S]+grant execute on function public\\.${signature} to authenticated`));
  }
  assert.match(migration, /v_uid uuid := auth\.uid\(\)/);
  assert.doesNotMatch(migration, /activity_inbox\(p_(viewer|user)/);
  assert.match(sqlRegression, /state_rls_disabled[\s\S]+anon_state_select[\s\S]+direct_state_mutation_granted[\s\S]+anon_rpc_execute/);
});

test('DataStore adapters have parity and guest adapter is empty/no-op with no RPC', () => {
  const remoteDomain = domain(supabase, 'activityInbox', 'pokes');
  const localDomain = domain(local, 'activityInbox', 'pokes');
  for (const method of ['list', 'unreadCount', 'markSeen']) {
    assert.match(remoteDomain, new RegExp(`${method}\\(`));
    assert.match(localDomain, new RegExp(`${method}\\(`));
  }
  assert.match(remoteDomain, /rpc\('activity_inbox'\)/);
  assert.match(remoteDomain, /rpc\('activity_inbox_unread_count'\)/);
  assert.match(remoteDomain, /rpc\('activity_inbox_mark_seen'/);
  assert.match(remoteDomain, /eventKeys\.length > 100[\s\S]+!key\.trim\(\)[\s\S]+new Set/);
  assert.match(localDomain, /return \{ items: \[\], unreadCount: 0 \}/);
  assert.match(localDomain, /return 0/);
  assert.doesNotMatch(localDomain, /rpc\(|fetch\(/);
});

test('request gate rejects stale list, mark and cross-account responses', () => {
  const gate = createRequestGate('user-a');
  const firstList = gate.begin();
  const firstMark = gate.capture();
  const reopenedList = gate.begin();
  assert.equal(gate.isCurrent(firstList), false);
  assert.equal(gate.isCurrent(firstMark), false);
  assert.equal(gate.isCurrent(reopenedList), true);

  gate.invalidate();
  assert.equal(gate.isCurrent(reopenedList), false);
  const userARequest = gate.begin();
  gate.setAccount('user-b');
  assert.equal(gate.isCurrent(userARequest), false);
  assert.equal(gate.isCurrent(gate.capture()), true);
});

test('같이읽기 header action and sheet preserve guest/error/empty/rendered-key behavior', () => {
  assert.match(main, /import '\.\/js\/activity-inbox\.js'/);
  assert.match(app, /activeTab === 'social'[\s\S]+ActivityInboxButton/);
  assert.match(app, /activityGuest = authUser === null \|\| authUser === 'local'/);
  assert.match(app, /activityAccountKey = activityGuest \? 'guest' : String\(\(authUser && authUser\.id\)/);
  assert.match(app, /ActivityInboxButton key=\{activityAccountKey\} guest=\{activityGuest\} accountKey=\{activityAccountKey\}/);
  assert.doesNotMatch(app, /activityGuest = window\.DataStore !== window\.SupabaseDataStore/);
  assert.match(ui, /width: 44, height: 44/);
  assert.match(ui, /읽지 않은 활동 \$\{unread\}개/);
  assert.match(ui, /useOverlayBack/);
  assert.match(ui, /event\.key === 'Escape'[\s\S]+event\.key !== 'Tab'[\s\S]+querySelectorAll[\s\S]+last\.focus\(\)[\s\S]+first\.focus\(\)/);
  assert.match(ui, /restoreFocusRef\.current = false[\s\S]+setOpen\(false\)[\s\S]+next\(\)/);
  assert.match(ui, /triggerRef[\s\S]+closeRef[\s\S]+restoreFocusRef\.current[\s\S]+\.focus\(\)/);
  assert.match(ui, /handoff\(onLogin\)/);
  assert.match(ui, /handoff\(\(\) => window\.RG_openBook/);
  assert.match(ui, /handoff\(\(\) => window\.RG_openProfile/);
  assert.match(ui, /로그인하면 좋아요, 새 팔로워, 콕찌르기를 여기서 확인할 수 있어요/);
  assert.match(ui, /아직 새로운 활동이 없어요/);
  assert.match(ui, /활동을 불러오지 못했어요\. 다시 시도해주세요/);
  assert.match(ui, /requestAnimationFrame[\s\S]+markSeen\(keys\)/);
  assert.match(ui, /createActivityInboxRequestGate[\s\S]+requestGate\.begin\(\)[\s\S]+requestGate\.isCurrent\(request\)/);
  assert.match(ui, /markedKeys\.has\(item\.eventKey\)[\s\S]+isUnread: false/);
  assert.match(ui, /DataStore\.activityInbox\.list\(\)[\s\S]+find\(\(candidate\) => candidate\.eventKey === item\.eventKey\)/);
  assert.match(ui, /지금은 볼 수 없는 활동이에요/);
  assert.match(ui, /if \(guest \|\| !\(DataStore\.activityInbox[\s\S]+setResult\(\{ items: \[\], unreadCount: 0 \}\);[\s\S]+return;/);
  assert.match(ui, /if \(guest\) \{[\s\S]+return Promise\.resolve\(\{ items: \[\], unreadCount: 0 \}\);[\s\S]+\}[\s\S]+setLoading\(true\)/);
});
