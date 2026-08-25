import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const analytics = read('docs/readinggo/specs/analytics.md');
const backend = read('docs/readinggo/specs/backend.md');
const decisions = read('docs/readinggo/specs/meta/decisions.md');
const feed = read('docs/readinggo/specs/feed.md');
const openIssues = read('docs/readinggo/specs/meta/open-issues.md');
const ops = read('docs/readinggo/specs/ops.md');

// #1389 spec PR은 기존 runtime을 승인하거나 보존하지 않는다. runtime/DB 제거와
// migration rollback 검증은 retirement spec merge 뒤 별도 구현 PR에서 수행한다.
test('book-tree product is retired without a reactivation contract', () => {
  assert.match(decisions, /은퇴 tombstone:[\s\S]+책나무[\s\S]+제품에서 제외/);
  assert.match(backend, /책나무 제품의 UI·route·flag·전용 RPC\/DataStore·analytics는 은퇴/);
  assert.match(feed, /후속 runtime\/DB 제거 inventory/);
  assert.match(openIssues, /책나무·레거시 탭용 자산·flag·route 재개 없음/);
  assert.match(ops, /책나무 route·flag·전용 DataStore\/RPC\/analytics는 제거 대상/);
  assert.match(ops, /책나무 route·flag·전용 API를 rollback 경로로 복원하지 않는다/);
  assert.doesNotMatch(analytics, /friend_book_tree_viewed|branch_count_bucket/);
});

test('retirement preserves active minimum-privilege and activity-inbox security contracts', () => {
  assert.match(backend, /### 7\.0\.3 현재 보안 갭과 retained surface 컷오버 게이트/);
  assert.match(backend, /broad base SELECT 복원은 금지/);
  assert.match(backend, /#1260 활동함의 목록·count·mark는 같은 current projection과 moderation filter/);
  assert.match(backend, /### 7\.0\.6 활동함 읽기 모델·상태 계약 \(#1260\)/);
  assert.match(ops, /#1260 source grant를 넓히지 않는다/);
});
