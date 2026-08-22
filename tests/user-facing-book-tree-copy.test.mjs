import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = 'docs/readinggo/js';
// 호환 read shim·미마운트 레거시 구현·Phase 4 삭제 대상은 사용자 표면 검사에서 제외한다.
const compatibilityOnly = new Set([
  'data.js', 'datastore.js', 'datastore-supabase.js', 'icons.js',
  'nest-grow.js', 'nest-theatre.js', 'library.test.js',
]);
const runtimeFiles = fs.readdirSync(root)
  .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js') && !compatibilityOnly.has(name));

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

const activeSurface = runtimeFiles
  .map((name) => `\n/* ${name} */\n${withoutComments(fs.readFileSync(`${root}/${name}`, 'utf8'))}`)
  .join('');

for (const forbidden of [
  'N번째 둥지', '완성 둥지', '완성된 둥지', '성 획득', '성을 완성',
  '다음 둥지', '1,600 XP', '둥지가 자라요', '🏰', 'nest_castle', ' XP',
  'streak_repair_', '연속 기록 이어가기',
]) {
  assert.equal(activeSurface.includes(forbidden), false,
    `사용자 DOM·알림·카피·payload에 금지 표면이 남음: ${forbidden}`);
}

assert.match(activeSurface, /문장으로 남겨요/, '게스트 Home onboarding은 익숙한 문장 용어를 써야 한다');
assert.match(activeSurface, /rgIcon\('book', 30\)/, '완독 회고는 현 중립 book 아이콘을 유지해야 한다');
assert.match(activeSurface, /rgRoomNestEmoji[\s\S]*rgIcon\('book', 18\)/,
  '같이읽기 멤버 진척은 중립 book 아이콘이어야 한다');

console.log('✓ #1453 Phase 3-B 사용자 금지 표면 전역 회귀 계약');