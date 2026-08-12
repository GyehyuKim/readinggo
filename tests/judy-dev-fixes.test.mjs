import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../docs/readinggo/index.html', import.meta.url), 'utf8');
const social = fs.readFileSync(new URL('../docs/readinggo/js/social.js', import.meta.url), 'utf8');

assert.match(
  index,
  /\.topbar\s*\{[\s\S]*?padding:\s*calc\(var\(--safe-top\) \+ 8px\)[^;]*var\(--safe-right\)[^;]*var\(--safe-left\)/,
  'TopBar는 Capacitor SystemBars가 보정한 safe-area 변수를 사용해야 한다',
);
assert.doesNotMatch(
  index,
  /\.topbar\s*\{[\s\S]*?padding:[^;]*env\(safe-area-inset-top\)/,
  'TopBar가 Android에서 0px일 수 있는 env(safe-area-inset-top)을 직접 사용하면 안 된다',
);
assert.doesNotMatch(
  social,
  /NPC_QUOTES|BookSentencesFeed/,
  '책 상세·소셜 UI는 다른 책 NPC 문장을 주입하면 안 된다',
);

console.log('OK: Judy Android safe-area and book-sentence isolation regressions');
