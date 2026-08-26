import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const forbiddenFiles = [
  '.github/workflows/ota-release.yml',
  '.github/workflows/ota-promote.yml',
  'docs/readinggo/specs/ota.md',
];
for (const path of forbiddenFiles) {
  assert.equal(existsSync(new URL(path, root)), false, `${path}는 퇴역 후 다시 생기면 안 된다`);
}

const ignoredDirectories = new Set(['.git', '.gradle', 'node_modules', 'dist', 'build']);
const activeExtensions = /\.(?:cjs|mjs|js|jsx|ts|tsx|json|jsonc|ya?ml|toml|gradle|java|kt|kts|swift|xml|plist|properties|xcconfig|html|css|scss|sh|bash|py|sql|txt|svg|storyboard|bat|example|pbxproj|pro|resolved)$/;
const activeNames = new Set(['Dockerfile', 'Makefile', 'gradlew']);
const forbidden = /@capgo\/capacitor-updater|CapacitorUpdater|capgo-capacitor-updater|\/api\/ota|OTA_KV|OTA_PRIVATE_KEY|OTA_PUBLIC_KEY|ota-production|RG_otaDiagnostics|notifyAppReady|defaultChannel/;
const walk = (directory, prefix = '') => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
  const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isDirectory()) return walk(new URL(`${entry.name}/`, directory), relative);
  return activeExtensions.test(entry.name) || activeNames.has(entry.name) ? [relative] : [];
});
for (const path of walk(root)) {
  if (path === 'tests/ota-retirement.test.mjs') continue;
  assert.doesNotMatch(read(path), forbidden, `${path}에 퇴역한 업데이트 경로가 남으면 안 된다`);
}

const workflowDir = new URL('../.github/workflows/', import.meta.url);
for (const file of readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name))) {
  assert.doesNotMatch(read(`.github/workflows/${file}`), /OTA_PRIVATE_KEY|OTA_PUBLIC_KEY|ota-production|ota-release|ota-promote/, `${file}가 퇴역한 발행 경로를 참조하면 안 된다`);
}

const markdownDir = new URL('../docs/readinggo/', import.meta.url);
for (const relative of readdirSync(markdownDir, { recursive: true }).filter((name) => name.endsWith('.md'))) {
  const path = `docs/readinggo/${relative}`;
  if (path === 'docs/readinggo/specs/meta/decisions.md') continue;
  assert.doesNotMatch(read(path), /\bOTA\b|Capgo|\/api\/ota|OTA_KV|ota-release|ota-promote|ota-production|specs\/ota\.md/, `${path}에 현재 기능처럼 읽히는 OTA 서술이 남으면 안 된다`);
}

assert.match(read('docs/readinggo/RELEASE.md'), /스토어 바이너리로만/);
assert.match(read('docs/readinggo/specs/meta/decisions.md'), /v18\.8 — 설치 앱 OTA 은퇴/);

console.log('OK: 설치 앱 업데이트는 store-only이며 OTA 재도입 표면 없음');