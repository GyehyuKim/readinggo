import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../worker/index.mjs';

const gradle = await readFile(new URL('../docs/readinggo/android/app/build.gradle', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../.github/workflows/ota-release.yml', import.meta.url), 'utf8');

const versionCodes = [...gradle.matchAll(/^\s*versionCode\s+(\d+)\s*$/gm)];
assert.equal(versionCodes.length, 1, 'Android versionCode는 정확히 한 곳에서 선언해야 한다');
const nativeVersionCode = Number(versionCodes[0][1]);
assert.equal(nativeVersionCode, 4, '#1419 네이티브 스캐너 셸은 versionCode 4여야 한다');
assert.match(gradle, /^\s*versionName\s+"1\.0\.3"\s*$/m, 'versionCode 3의 다음 Android 셸은 1.0.3으로 올린다');

assert.match(workflow, /readFileSync\("android\/app\/build\.gradle"/);
assert.match(workflow, /MIN_NATIVE: \$\{\{ steps\.native\.outputs\.version-code \}\}/);
assert.match(workflow, /minNative: Number\(process\.env\.MIN_NATIVE\)/);
assert.doesNotMatch(workflow, /^\s*minNative:\s*\d+/m, 'OTA workflow에 minNative 숫자를 하드코딩하면 안 된다');

const manifest = JSON.stringify({
  version: '1.0.1441',
  url: 'https://example.test/com.readinggo.app_1.0.1441.zip',
  checksum: 'checksum-test',
  minNative: nativeVersionCode,
});
const env = { OTA_KV: { async get(key) {
  assert.equal(key, 'ota:android:beta');
  return manifest;
} } };
const otaRequest = (versionCode) => new Request('https://readinggo.example/api/ota', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform: 'android',
    custom_id: 'beta',
    version_name: 'builtin',
    version_code: String(versionCode),
  }),
});

let response = await worker.fetch(otaRequest(3), env, {});
assert.equal(response.status, 200);
const blocked = await response.json();
assert.deepEqual(blocked, { message: 'min native 4 > 3' });
assert.equal(blocked.url, undefined, 'v3 셸에는 v4 번들 URL을 반환하면 안 된다');
assert.equal(blocked.version, undefined, 'v3 셸 응답은 no-update 계약이어야 한다');

response = await worker.fetch(otaRequest(4), env, {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  version: '1.0.1441',
  url: 'https://example.test/com.readinggo.app_1.0.1441.zip',
  checksum: 'checksum-test',
});

console.log('OK: Android versionCode → OTA minNative 단일 원천과 v3/v4 게이트');