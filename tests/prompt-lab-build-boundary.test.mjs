import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const assets = join('docs', 'readinggo', 'dist', 'assets');
const text = readdirSync(assets).filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(join(assets, name), 'utf8')).join('\n');
const expected = process.env.EXPECT_PROMPT_LAB === '1';
for (const marker of ['/api/prompt-lab', 'Prompt Lab 열기', '합성 fixture', 'baseline_promote']) {
  assert.equal(text.includes(marker), expected, expected
    ? `DEV bundle must retain Prompt Lab marker: ${marker}`
    : `PROD bundle must exclude Prompt Lab marker: ${marker}`);
}
console.log(`OK: ${expected ? 'DEV retains' : 'PROD excludes'} Prompt Lab UI/fixtures/access endpoint`);
