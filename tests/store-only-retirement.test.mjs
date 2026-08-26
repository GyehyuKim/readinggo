import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const term = (...parts) => parts.join('');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const retiredPrefix = term('o', 'ta');
const forbiddenFiles = [
  `.github/workflows/${retiredPrefix}-release.yml`,
  `.github/workflows/${retiredPrefix}-promote.yml`,
  `docs/readinggo/specs/${retiredPrefix}.md`,
];
for (const path of forbiddenFiles) {
  assert.equal(existsSync(new URL(path, root)), false, `${path}는 퇴역 후 다시 생기면 안 된다`);
}

const ignoredDirectories = new Set(['.git', '.gradle', '.build', 'node_modules', 'dist', 'build']);
const activeExtensions = /\.(?:cjs|mjs|js|jsx|ts|tsx|json|jsonc|ya?ml|toml|gradle|java|kt|kts|swift|xml|plist|properties|xcconfig|html|css|scss|sh|bash|py|sql|txt|md|svg|storyboard|bat|example|pbxproj|podspec|pro|resolved)$/;
const activeNames = new Set(['Dockerfile', 'Makefile', 'gradlew']);
const retiredLiterals = [
  term('Cap', 'go'),
  term('Capacitor', 'Updater'),
  term('O', 'TA_'),
  term('RG_', 'otaDiagnostics'),
  term('notify', 'AppReady'),
  term('default', 'Channel'),
];
const retiredWord = term('o', 'ta');
const retiredWordPattern = `(?:^|[^A-Za-z0-9_])${retiredWord}(?:[^A-Za-z0-9_]|$)`;
const retiredIdentifierPattern = new RegExp(`(?:^|[^A-Za-z0-9])${term('[oO]', '[tT]', '[aA]')}(?:_|[A-Z])`);
const forbidden = new RegExp([...retiredLiterals.map(escapeRegex), retiredWordPattern].join('|'), 'i');
const walk = (directory, prefix = '') => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  if (ignoredDirectories.has(entry.name)) return [];
  const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isDirectory()) return walk(new URL(`${entry.name}/`, directory), relative);
  const extensionless = !entry.name.includes('.') || (entry.name.startsWith('.') && !entry.name.slice(1).includes('.'));
  return activeExtensions.test(entry.name) || activeNames.has(entry.name) || extensionless ? [relative] : [];
});
for (const path of walk(root)) {
  if (path === 'tests/store-only-retirement.test.mjs') continue;
  const source = read(path);
  const searchableSource = source.replace(/base64,[A-Za-z0-9+/=\r\n]+/g, 'base64,[omitted]');
  assert.doesNotMatch(searchableSource, forbidden, `${path}에 퇴역한 업데이트 경로가 남으면 안 된다`);
  assert.doesNotMatch(searchableSource, retiredIdentifierPattern, `${path}에 퇴역한 업데이트 식별자가 남으면 안 된다`);
}

assert.match(read('docs/readinggo/RELEASE.md'), /스토어 바이너리로만/);
assert.match(read('docs/readinggo/specs/meta/decisions.md'), /스토어 외 설치 앱 업데이트 경로 폐기/);

console.log('OK: 설치 앱 업데이트는 store-only이며 퇴역 경로 재도입 표면 없음');
