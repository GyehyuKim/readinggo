import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../docs/readinggo/js/nest-grow.js', import.meta.url), 'utf8');
const start = source.indexOf('function rgNestTimestamp');
const end = source.indexOf('\nfunction NestGrowView', start);
assert.ok(start >= 0 && end > start, '둥지 날짜 helper를 찾을 수 있어야 한다');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${source.slice(start, end)}\nthis.api = { rgNestTimestamp, rgNestDayKey, rgNestUniqueQuoteDays };`, sandbox);
const { rgNestTimestamp, rgNestDayKey, rgNestUniqueQuoteDays } = sandbox.api;

const july29 = Date.parse('2026-07-29T12:00:00Z');
const july30Early = Date.parse('2026-07-30T01:00:00Z');
const july30Late = Date.parse('2026-07-30T20:00:00Z');

assert.equal(rgNestTimestamp(july30Late), july30Late, 'epoch millisecond를 그대로 정렬값으로 사용한다');
assert.equal(rgNestTimestamp('2026-07-30T20:00:00Z'), july30Late, 'ISO 문자열을 같은 정렬값으로 변환한다');
assert.equal(rgNestTimestamp('not-a-date'), 0, '잘못된 날짜는 안전하게 제외한다');
assert.equal(rgNestDayKey('2026-07-30T20:00:00Z'), '2026-07-30', 'ISO 문자열의 기존 날짜 prefix 계약을 유지한다');

const rows = rgNestUniqueQuoteDays([
  { id: 'old-number', created_at: july29 },
  { id: 'new-iso', created_at: '2026-07-30T20:00:00Z' },
  { id: 'same-day-number', created_at: july30Early },
  { id: 'invalid', created_at: 'not-a-date' },
]);

assert.deepEqual(
  JSON.parse(JSON.stringify(rows.map(({ day, quote }) => ({ day, id: quote.id })))),
  [
    { day: '2026-07-30', id: 'new-iso' },
    { day: '2026-07-29', id: 'old-number' },
  ],
  '숫자·ISO 혼합 데이터를 최신순으로 정렬하고 같은 날짜는 한 번만 남긴다',
);

assert.match(source, /events\.sort\(\(a, b\) => rgNestTimestamp\(b\.date\) - rgNestTimestamp\(a\.date\)\)/,
  '완독과 문장 이벤트의 최종 정렬도 날짜 타입에 안전해야 한다');

console.log('nest-grow-date: 8 passed');
