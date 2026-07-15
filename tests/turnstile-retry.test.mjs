/* Turnstile api.js 로드 실패 후 다음 요청에서 재주입되는지 검증 (#1254)
 *
 * 실행: node tests/turnstile-retry.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'docs', 'readinggo', 'js', 'turnstile.js'), 'utf8');
const scripts = [];

function createScript() {
  const listeners = {};
  return {
    attributes: {},
    parentNode: null,
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatch(name) { listeners[name]?.(); },
  };
}

const document = {
  createElement(tag) {
    if (tag === 'script') return createScript();
    return { style: {}, appendChild() {}, addEventListener() {} };
  },
  querySelector(selector) {
    if (selector !== 'script[data-rg-turnstile]') return null;
    return scripts.find((script) => script.attributes['data-rg-turnstile']) || null;
  },
  head: {
    appendChild(script) {
      script.parentNode = this;
      scripts.push(script);
    },
    removeChild(script) {
      const index = scripts.indexOf(script);
      if (index !== -1) scripts.splice(index, 1);
      script.parentNode = null;
    },
  },
  body: { appendChild() {} },
};

const window = { RG_CONFIG: { TURNSTILE_SITE_KEY: 'test-site-key' } };
vm.runInNewContext(source, {
  window,
  document,
  Promise,
  setTimeout() {},
  fetch() {},
});

window.RG_turnstileToken();
window.RG_turnstileToken();
if (scripts.length !== 1) {
  console.error(`FAIL concurrent requests injected ${scripts.length} scripts, want 1`);
  process.exit(1);
}

const failedScript = scripts[0];
failedScript.dispatch('error');
if (scripts.length !== 0 || failedScript.parentNode !== null) {
  console.error('FAIL failed Turnstile script remained in the document');
  process.exit(1);
}

window.RG_turnstileToken();
if (scripts.length !== 1 || scripts[0] === failedScript) {
  console.error('FAIL later token request did not inject a fresh Turnstile script');
  process.exit(1);
}

console.log('✓ turnstile-retry: load error removes failed script and permits one fresh injection');
