/* Turnstile 수동 실행 모드와 요청 시 토큰 발급 계약 검증 (#1375)
 *
 * 실행: node tests/turnstile-execution.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'docs', 'readinggo', 'js', 'turnstile.js'), 'utf8');

let renderOptions = null;
let executeCount = 0;

function element() {
  return {
    style: {},
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
  };
}

const document = {
  createElement() { return element(); },
  querySelector() { return null; },
  head: { appendChild() {} },
  body: { appendChild() {} },
};

const window = {
  RG_CONFIG: { TURNSTILE_SITE_KEY: 'test-site-key' },
  turnstile: {
    render(_element, options) {
      renderOptions = options;
      return 'widget-1';
    },
    reset() {},
    execute() {
      executeCount += 1;
      renderOptions.callback('issued-token');
    },
  },
};

vm.runInNewContext(source, {
  window,
  document,
  Promise,
  setTimeout() {},
  fetch() {},
});

const tokenPromise = window.RG_turnstileToken();
window.RG_onTurnstileLoad();
const token = await tokenPromise;

if (renderOptions?.execution !== 'execute') {
  console.error(`FAIL execution mode=${renderOptions?.execution}, want execute`);
  process.exit(1);
}
if (executeCount !== 1) {
  console.error(`FAIL execute count=${executeCount}, want 1`);
  process.exit(1);
}
if (token !== 'issued-token') {
  console.error(`FAIL token=${token}, want issued-token`);
  process.exit(1);
}

console.log('✓ turnstile-execution: manual execution issues one token on request');