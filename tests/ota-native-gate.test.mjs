import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../worker/index.mjs';

const gradle = await readFile(new URL('../docs/readinggo/android/app/build.gradle', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../.github/workflows/ota-release.yml', import.meta.url), 'utf8');
const apkWorkflow = await readFile(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const capConfig = JSON.parse(await readFile(new URL('../docs/readinggo/capacitor.config.json', import.meta.url), 'utf8'));
const mainJs = await readFile(new URL('../docs/readinggo/main.js', import.meta.url), 'utf8');

const versionCodes = [...gradle.matchAll(/^\s*versionCode\s+(\d+)\s*$/gm)];
assert.equal(versionCodes.length, 1, 'Android versionCode는 정확히 한 곳에서 선언해야 한다');
const nativeVersionCode = Number(versionCodes[0][1]);
assert.equal(nativeVersionCode, 4, '#1419 네이티브 스캐너 셸은 versionCode 4여야 한다');
assert.match(gradle, /^\s*versionName\s+"1\.0\.3"\s*$/m, 'versionCode 3의 다음 Android 셸은 1.0.3으로 올린다');

assert.match(workflow, /readFileSync\("android\/app\/build\.gradle"/);
assert.match(workflow, /MIN_NATIVE: \$\{\{ steps\.native\.outputs\.version-code \}\}/);
assert.match(workflow, /minNative: Number\(process\.env\.MIN_NATIVE\)/);
assert.doesNotMatch(workflow, /^\s*minNative:\s*\d+/m, 'OTA workflow에 minNative 숫자를 하드코딩하면 안 된다');

/* ── #1489 빌드/패키지 경로 → 채널 매핑 계약 ─────────────────
   Capgo 플러그인은 capacitor.config.json plugins.CapacitorUpdater.defaultChannel 값을
   네이티브가 *첫* 체크 요청부터 defaultChannel 필드로 싣는다(런타임 JS 호출 불필요).
   release/production 빌드는 저장소 기본값을 그대로 쓰고, DEV/debug APK 빌드만
   android-apk.yml이 beta로 override한다 — 두 경로 모두 결정적이며 production으로 새지 않는다. */
assert.equal(
  capConfig.plugins?.CapacitorUpdater?.defaultChannel,
  'production',
  'release/production 빌드가 상속하는 capacitor.config.json 기본 채널은 production이어야 한다'
);
assert.equal(capConfig.plugins.CapacitorUpdater.autoUpdate, true);
assert.equal(capConfig.plugins.CapacitorUpdater.directUpdate, false);
assert.equal(capConfig.plugins.CapacitorUpdater.resetWhenUpdate, true);

assert.match(apkWorkflow, /defaultChannel\s*=\s*'beta'/, 'DEV APK 빌드는 capacitor.config.json defaultChannel을 beta로 override해야 한다');
assert.doesNotMatch(apkWorkflow, /autoUpdate\s*=\s*false/, 'DEV APK가 OTA 자체를 꺼서는 안 된다(#1489 — beta로 격리, 전면 비활성은 회귀 검증을 막는다)');
assert.match(apkWorkflow, /readinggo\.hyuniverse\.workers\.dev\/api\/ota/, 'DEV APK도 실제 OTA 엔드포인트를 구독해야 한다');
assert.match(mainJs, /window\.RG_otaDiagnostics\s*=\s*async/);
assert.match(mainJs, /active:\s*\{ id: cur\.bundle\.id, version: cur\.bundle\.version \}/);
assert.match(mainJs, /builtin:\s*bundles\.find\(\(b\) => b\.id === 'builtin'\) \|\| null/);
assert.match(mainJs, /downloaded:\s*bundles\.filter\(\(b\) => b\.id !== 'builtin'\)/);

const manifest = (version) => JSON.stringify({
  version,
  url: `https://example.test/com.readinggo.app_${version}.zip`,
  checksum: 'checksum-test',
  minNative: nativeVersionCode,
});
const kvEntries = {
  'ota:android:beta': manifest('1.0.1441'),
  'ota:android:production': manifest('1.0.1440'),
};
const env = { OTA_KV: { async get(key) {
  return Object.prototype.hasOwnProperty.call(kvEntries, key) ? kvEntries[key] : null;
} } };
const otaRequest = (body) => new Request('https://readinggo.example/api/ota', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// minNative 게이트(기존 계약 유지) — beta 채널.
let response = await worker.fetch(otaRequest({ platform: 'android', defaultChannel: 'beta', version_name: 'builtin', version_code: '3' }), env, {});
assert.equal(response.status, 200);
const blocked = await response.json();
assert.deepEqual(blocked, { message: 'min native 4 > 3' });
assert.equal(blocked.url, undefined, 'v3 셸에는 v4 번들 URL을 반환하면 안 된다');
assert.equal(blocked.version, undefined, 'v3 셸 응답은 no-update 계약이어야 한다');

response = await worker.fetch(otaRequest({ platform: 'android', defaultChannel: 'beta', version_name: 'builtin', version_code: '4' }), env, {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  version: '1.0.1441',
  url: 'https://example.test/com.readinggo.app_1.0.1441.zip',
  checksum: 'checksum-test',
});

// production 채널은 별도 manifest — beta와 섞이지 않는다.
response = await worker.fetch(otaRequest({ platform: 'android', defaultChannel: 'production', version_name: 'builtin', version_code: '4' }), env, {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  version: '1.0.1440',
  url: 'https://example.test/com.readinggo.app_1.0.1440.zip',
  checksum: 'checksum-test',
});

// #1489 이전 release 셸은 defaultChannel 없이 native is_prod:true만 보냈다.
// 새 release가 보급되기 전에도 기존 Production 설치자의 OTA 경로를 끊지 않는다.
response = await worker.fetch(otaRequest({ platform: 'android', is_prod: true, version_name: 'builtin', version_code: '4' }), env, {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  version: '1.0.1440',
  url: 'https://example.test/com.readinggo.app_1.0.1440.zip',
  checksum: 'checksum-test',
});

// #1489 fail-closed 계약 — defaultChannel이 없거나 beta/production이 아니면 절대 production으로
// 새지 않는다(옛 custom_id 기반 로직은 미설정 시 production을 내려줬다 — 그 회귀 재발 방지).
const failClosedCases = [
  { name: 'defaultChannel 필드 없음(구버전/DEV 이전 빌드)', body: { platform: 'android', version_name: 'builtin', version_code: '4' } },
  { name: 'DEV 빈 문자열(네이티브 기본값)', body: { platform: 'android', defaultChannel: '', is_prod: false, version_name: 'builtin', version_code: '4' } },
  { name: '미상 채널 값', body: { platform: 'android', defaultChannel: 'staging', version_name: 'builtin', version_code: '4' } },
  { name: 'release라도 명시적 미상 채널은 production으로 폴백하지 않음', body: { platform: 'android', defaultChannel: 'staging', is_prod: true, version_name: 'builtin', version_code: '4' } },
  { name: '공백이 섞인 채널은 정규화하지 않고 거부', body: { platform: 'android', defaultChannel: ' beta ', is_prod: false, version_name: 'builtin', version_code: '4' } },
  { name: 'custom_id는 채널이 아니다(#1489 이전 오설계) — 무시돼야 함', body: { platform: 'android', custom_id: 'beta', version_name: 'builtin', version_code: '4' } },
];
for (const { name, body } of failClosedCases) {
  response = await worker.fetch(otaRequest(body), env, {});
  assert.equal(response.status, 200, name);
  assert.deepEqual(await response.json(), {}, `fail-closed 계약 위반: ${name}`);
}

console.log('OK: Android versionCode → OTA minNative 단일 원천, beta/production 채널 매핑, fail-closed 미상 채널 게이트');
