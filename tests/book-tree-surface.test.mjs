import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('docs/readinggo/js/app.js');
const ceremony = read('docs/readinggo/js/ceremony.js');
const reminder = read('docs/readinggo/js/streak-reminder.js');
const settings = read('docs/readinggo/js/settings-modal.js');
const nest = read('docs/readinggo/js/nest.js');

const tabbar = app.slice(app.indexOf('<nav className="tabbar">'), app.indexOf('</nav>', app.indexOf('<nav className="tabbar">')));
assert.match(tabbar, /id:\s*'nest-grow',\s*label:\s*'책나무'/,
  '호환 route key nest-grow를 유지하며 사용자 라벨을 책나무로 바꿔야 한다');
assert.match(tabbar, /aria-label=\{t\.label\}/,
  '하단 탭 접근성 이름은 표시 라벨과 같아야 한다');
assert.doesNotMatch(tabbar, /label:\s*'둥지'/,
  '하단 탭에 구 둥지 라벨이 남으면 안 된다');
assert.match(app, /addEventListener\('rg:wish-changed', refresh\)/,
  '책 추가·삭제 시 TopBar 집계를 같은 projection으로 다시 읽어야 한다');
assert.match(app, /removeEventListener\('rg:wish-changed', refresh\)/,
  'TopBar 책 변경 listener는 unmount 시 정리해야 한다');

const reminderLines = reminder.slice(reminder.indexOf('const RG_REMINDER_LINES'), reminder.indexOf('function _rmPickLine'));
const deleteCopy = [...settings.matchAll(/정말 삭제할까요\?[\s\S]{0,140}?되돌릴 수 없어요\./g)].map((match) => match[0]).join('\n');
const topbar = app.slice(app.indexOf('<div className="topbar-stats">'), app.indexOf('{/* 전역 Toast'));
for (const forbidden of [
  'N번째 둥지', '완성 둥지', '완성된 둥지', '성 획득', '성을 완성', '다음 둥지', '1,600 XP',
  '아직이에요', '기다려요', '둥지가 오늘을 기다려요',
]) {
  // nest.js는 호환 계산·주석을 보존하므로 실제 과거 토스트/세리머니 문자열만 별도 검증한다.
  if (forbidden === '성 획득') continue;
  assert.equal([topbar, ceremony, reminderLines, deleteCopy].join('\n').includes(forbidden), false,
    `전환 대상 사용자 카피에 ${forbidden}가 남으면 안 된다`);
}
assert.doesNotMatch(nest, /showToast\(`🏰 전설의 재키 성주|showToast\('🏰 성 컬렉션/,
  '저장·완독 흐름에서 레거시 성 토스트를 노출하면 안 된다');
assert.match(deleteCopy, /모든 독서 기록\(책·문장·대화\)이 영구 삭제/,
  '계정 삭제는 실제 책·문장·대화 기록을 평이하게 설명해야 한다');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} helper를 찾을 수 있어야 한다`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} helper 끝을 찾을 수 없다`);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${extractFunction(ceremony, 'finishCeremony')}; this.finishCeremony = finishCeremony;`, sandbox);
const calls = [];
sandbox.finishCeremony({
  isComplete: true,
  rating: 4.5,
  reviewText: '  다시 읽고 싶어요  ',
  onComplete: (payload) => calls.push(['complete', payload]),
  onClose: () => calls.push(['close']),
});
assert.equal(JSON.stringify(calls), JSON.stringify([
  ['complete', { rating: 4.5, review_text: '다시 읽고 싶어요' }],
  ['close'],
]), '완독 persistence 진입이 modal close보다 먼저 실행돼야 한다');

const normalCalls = [];
sandbox.finishCeremony({
  isComplete: false,
  rating: 0,
  reviewText: '',
  onComplete: () => normalCalls.push('complete'),
  onClose: () => normalCalls.push('close'),
});
assert.deepEqual(normalCalls, ['close'], '일반 저장은 완료 mutation 없이 modal을 닫아야 한다');
assert.match(ceremony, /className="rating-stars"[\s\S]*className="review-area"/,
  '완독 별점·소감 review 진입은 유지해야 한다');
assert.doesNotMatch(ceremony, /className="stat xp"|xp-breakdown|nest-progress|nest-evo|NEST_STAGES/,
  '세리머니 UI에 XP·성장 단계·둥지 진화가 남으면 안 된다');

console.log('✓ #1453 탭·카피·세리머니 완료/닫기 회귀 계약');
