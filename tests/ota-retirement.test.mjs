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

const activeFiles = [
  'docs/readinggo/package.json',
  'docs/readinggo/package-lock.json',
  'docs/readinggo/capacitor.config.json',
  'docs/readinggo/main.js',
  'docs/readinggo/android/capacitor.settings.gradle',
  'docs/readinggo/android/app/capacitor.build.gradle',
  'docs/readinggo/ios/App/CapApp-SPM/Package.swift',
  'worker/index.mjs',
  'wrangler.toml',
  'wrangler.dev.toml',
  '.github/workflows/android-apk.yml',
  '.github/workflows/android-release.yml',
];
const forbidden = /@capgo\/capacitor-updater|CapacitorUpdater|capgo-capacitor-updater|\/api\/ota|OTA_KV|OTA_PRIVATE_KEY|OTA_PUBLIC_KEY|ota-production|RG_otaDiagnostics|notifyAppReady|defaultChannel/;
for (const path of activeFiles) {
  assert.doesNotMatch(read(path), forbidden, `${path}에 퇴역한 업데이트 경로가 남으면 안 된다`);
}

const workflowDir = new URL('../.github/workflows/', import.meta.url);
for (const file of readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name))) {
  assert.doesNotMatch(read(`.github/workflows/${file}`), /OTA_PRIVATE_KEY|OTA_PUBLIC_KEY|ota-production|ota-release|ota-promote/, `${file}가 퇴역한 발행 경로를 참조하면 안 된다`);
}

assert.match(read('docs/readinggo/RELEASE.md'), /스토어 바이너리로만/);
assert.match(read('docs/readinggo/specs/meta/decisions.md'), /v18\.8 — 설치 앱 OTA 은퇴/);

console.log('OK: 설치 앱 업데이트는 store-only이며 OTA 재도입 표면 없음');