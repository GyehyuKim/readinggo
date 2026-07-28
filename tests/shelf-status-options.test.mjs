import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dataSource = readFileSync('docs/readinggo/js/data.js', 'utf8');
const optionBlock = dataSource.match(
  /const RG_SHELF_STATUS_OPTIONS = Object\.freeze\(\[[\s\S]*?\]\);/
);
assert.ok(optionBlock, '공용 책장 상태 선택 배열이 data.js에 있어야 한다');

const context = { Object };
context.window = context;
vm.runInNewContext(`${optionBlock[0]}\nwindow.options = RG_SHELF_STATUS_OPTIONS;`, context);

assert.deepEqual(
  JSON.parse(JSON.stringify(context.options.map(({ value, label }) => [value, label]))),
  [
    ['reading', '읽는 중'],
    ['wish', '읽고 싶은 책'],
    ['completed', '읽은 책'],
  ],
  '책장 상태 선택은 사용자 여정 순서와 canonical 문구를 따라야 한다'
);
assert.ok(Object.isFrozen(context.options), '공용 배열은 읽기 전용이어야 한다');
assert.ok(context.options.every(Object.isFrozen), '공용 선택 항목도 읽기 전용이어야 한다');

for (const file of ['search.js', 'barcode-scan.js', 'shelf-import.js', 'library.js']) {
  const source = readFileSync(`docs/readinggo/js/${file}`, 'utf8');
  assert.match(source, /RG_SHELF_STATUS_OPTIONS/, `${file}가 공용 책장 상태 선택 배열을 써야 한다`);
}

for (const file of ['search.js', 'barcode-scan.js']) {
  const source = readFileSync(`docs/readinggo/js/${file}`, 'utf8');
  assert.doesNotMatch(
    source,
    /\['(?:wish|reading|completed)',\s*'(?:읽고 싶어요|지금 읽는 중|다 읽었어요)'/,
    `${file}에 상태 순서·문구 중복 배열이 남으면 안 된다`
  );
}
