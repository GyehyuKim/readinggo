import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'docs/readinggo/js/co-reading.js'), 'utf8');
const formatterSource = source.match(/function rgForestSentenceDate\(iso\) \{[\s\S]*?\n\}/)?.[0];

assert.ok(formatterSource, '숲 한 문장 날짜 포맷터가 존재해야 한다');

const sandbox = { Date, Number, String };
vm.createContext(sandbox);
vm.runInContext(formatterSource, sandbox);

const format = sandbox.rgForestSentenceDate;
const originalTimezone = process.env.TZ;

try {
  for (const timezone of ['Asia/Seoul', 'America/Los_Angeles', 'UTC']) {
    process.env.TZ = timezone;
    assert.equal(
      format('2026-06-19T23:30:00.000000+00:00'),
      '2026.06.19',
      `${timezone}: 로컬 날짜가 달라도 created_at의 UTC 날짜를 유지해야 한다`,
    );
    assert.equal(
      format('2026-06-19T00:30:00.000000+00:00'),
      '2026.06.19',
      `${timezone}: UTC 자정 직후에도 전날로 바뀌지 않아야 한다`,
    );
  }
} finally {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
}

assert.equal(format(''), '', '빈 값은 빈 문자열');
assert.equal(format('not-a-date'), '', '잘못된 값은 빈 문자열');
assert.match(source, /time: rgForestSentenceDate\(s\.created_at\)/, '숲 한 문장 정규화에서 포맷터를 사용해야 한다');

const socialSource = fs.readFileSync(path.join(root, 'docs/readinggo/js/social.js'), 'utf8');
assert.match(socialSource, /time: s\.time \|\| rgRelTime\(s\.created_at\)/, '발견 피드의 상대시간 계약은 유지해야 한다');

console.log('✓ forest sentence UTC date regression');
