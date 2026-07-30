/* Turnstile 상호작용 챌린지가 짧은 passive timeout에 의해 빈 토큰으로 종료되지 않는지 검증 (#1377)
 * 실행: node tests/turnstile-interactive-timeout.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'docs', 'readinggo', 'js', 'turnstile.js'), 'utf8');

let renderOptions = null;
let nextTimerId = 1;
const timers = new Map();
const setTimeoutFake = (fn, ms) => {
  const id = nextTimerId++;
  timers.set(id, { fn, ms, cleared: false });
  return id;
};
const clearTimeoutFake = (id) => {
  const timer = timers.get(id);
  if (timer) timer.cleared = true;
};
function runTimersAtOrBelow(ms) {
  for (const timer of timers.values()) {
    if (!timer.cleared && timer.ms <= ms) {
      timer.cleared = true;
      timer.fn();
    }
  }
}

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
    render(_element, options) { renderOptions = options; return 'widget-1'; },
    reset() {},
    execute() { renderOptions['before-interactive-callback'](); },
  },
};

vm.runInNewContext(source, {
  window,
  document,
  Promise,
  setTimeout: setTimeoutFake,
  clearTimeout: clearTimeoutFake,
  fetch() {},
});

let settled = false;
let settledToken = null;
const tokenPromise = window.RG_turnstileToken().then((token) => {
  settled = true;
  settledToken = token;
  return token;
});
window.RG_onTurnstileLoad();

// 실제 회귀: 챌린지가 화면에 떠 있어도 기존 6초 timer가 pending을 비워 요청을 빈 토큰으로 진행했다.
runTimersAtOrBelow(15_000);
await Promise.resolve();
if (settled) {
  console.error(`FAIL interactive challenge settled early with token=${JSON.stringify(settledToken)}`);
  process.exit(1);
}

renderOptions.callback('human-token');
const token = await tokenPromise;
if (token !== 'human-token') {
  console.error(`FAIL callback token=${token}, want human-token`);
  process.exit(1);
}

console.log('✓ turnstile-interactive-timeout: interactive challenge outlives passive timeout and returns token');
