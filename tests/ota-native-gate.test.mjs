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
assert.equal(nativeVersionCode, 5, 'OTA public key가 내장된 최초 Android 셸은 versionCode 5여야 한다');
assert.match(gradle, /^\s*versionName\s+"1\.0\.4"\s*$/m, 'OTA public key 네이티브 경계는 1.0.4로 올린다');

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

const encryptedChecksum = 'a'.repeat(64);
const manifest = (version) => JSON.stringify({
  version,
  url: `https://example.test/com.readinggo.app_${version}.zip`,
  checksum: encryptedChecksum,
  sessionKey: 'session-key-test',
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

// OTA public key가 없는 v4 이하 셸에는 encrypted manifest를 반환하지 않는다.
let response = await worker.fetch(otaRequest({ platform: 'android', defaultChannel: 'beta', version_name: 'builtin', version_code: '4' }), env, {});
assert.equal(response.status, 200);
const blocked = await response.json();
assert.deepEqual(blocked, { message: 'min native 5 > 4' });
assert.equal(blocked.url, undefined, 'public key가 없는 v4 셸에는 encrypted 번들 URL을 반환하면 안 된다');
assert.equal(blocked.version, undefined, 'v4 셸 응답은 no-update 계약이어야 한다');

response = await worker.fetch(otaRequest({ platform: 'android', defaultChannel: 'beta', version_name: 'builtin', version_code: '5' }), env, {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  version: '1.0.1441',
  url: 'https://example.test/com.readinggo.app_1.0.1441.zip',
  checksum: encryptedChecksum,
  sessionKey: 'session-key-test',
});

// production 채널은 별도 manifest — beta와 섞이지 않는다.
response = await worker.fetch(otaRequest({ platform: 'android', defaultChannel: 'production', version_name: 'builtin', version_code: '5' }), env, {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  version: '1.0.1440',
  url: 'https://example.test/com.readinggo.app_1.0.1440.zip',
  checksum: encryptedChecksum,
  sessionKey: 'session-key-test',
});

const envForManifest = (value) => ({ OTA_KV: { async get() { return JSON.stringify(value); } } });
const encryptedBase = {
  version: '1.0.1442',
  url: 'https://example.test/com.readinggo.app_1.0.1442.zip',
  checksum: encryptedChecksum,
  sessionKey: 'session-key-test',
  minNative: 5,
};
for (const { name, manifest: invalidManifest } of [
  { name: 'encrypted manifest minNative 누락 차단', manifest: { ...encryptedBase, minNative: undefined } },
  { name: 'encrypted manifest 문자열 minNative 차단', manifest: { ...encryptedBase, minNative: '5' } },
  { name: 'encrypted manifest 부분 숫자 minNative 차단', manifest: { ...encryptedBase, minNative: '5junk' } },
  { name: 'encrypted manifest v5 미만 minNative 차단', manifest: { ...encryptedBase, minNative: 4 } },
  { name: '공백 sessionKey 차단', manifest: { ...encryptedBase, sessionKey: ' ' } },
  { name: '빈 sessionKey 차단', manifest: { ...encryptedBase, sessionKey: '' } },
  { name: 'null sessionKey 차단', manifest: { ...encryptedBase, sessionKey: null } },
  { name: 'encrypted manifest checksum 누락 차단', manifest: { ...encryptedBase, checksum: undefined } },
  { name: 'encrypted manifest 객체 checksum 차단', manifest: { ...encryptedBase, checksum: {} } },
  { name: 'encrypted manifest non-SHA-256 checksum 차단', manifest: { ...encryptedBase, checksum: 'not-a-sha256' } },
  { name: 'HTTP bundle URL 차단', manifest: { ...encryptedBase, url: 'http://example.test/update.zip' } },
  { name: 'javascript URL 차단', manifest: { ...encryptedBase, url: 'javascript:alert(1)' } },
  { name: '객체 URL 차단', manifest: { ...encryptedBase, url: {} } },
  { name: '공백 포함 URL 차단', manifest: { ...encryptedBase, url: ' https://example.test/update.zip ' } },
  { name: '객체 version 차단', manifest: { ...encryptedBase, version: {} } },
]) {
  response = await worker.fetch(
    otaRequest({ platform: 'android', defaultChannel: 'beta', version_name: 'builtin', version_code: '5' }),
    envForManifest(invalidManifest),
    {},
  );
  assert.equal(response.status, 200, name);
  assert.deepEqual(await response.json(), {}, name);
}

// encrypted Production 최초 승격 전 KV에 남아 있는 기존 plaintext manifest는 읽기 호환만
// 유지한다. 신규 workflow는 plaintext를 발행하지 않지만 기존 v4 설치자의 경로를 즉시 끊지 않는다.
const legacyPlaintextEnv = { OTA_KV: { async get(key) {
  if (key !== 'ota:android:production' && key !== 'ota:android:beta') return null;
  return JSON.stringify({
    version: '1.0.1439',
    url: 'https://example.test/com.readinggo.app_1.0.1439.zip',
    checksum: 'legacy-checksum',
    minNative: 4,
  });
} } };
response = await worker.fetch(otaRequest({ platform: 'android', is_prod: true, version_name: 'builtin', version_code: '4' }), legacyPlaintextEnv, {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  version: '1.0.1439',
  url: 'https://example.test/com.readinggo.app_1.0.1439.zip',
  checksum: 'legacy-checksum',
});
response = await worker.fetch(otaRequest({ platform: 'android', is_prod: true, version_name: 'builtin', version_code: 4 }), legacyPlaintextEnv, {});
assert.equal(response.status, 200);
assert.equal((await response.json()).version, '1.0.1439', '숫자형 정상 v4 legacy 요청도 read compatibility 유지');
response = await worker.fetch(
  otaRequest({ platform: 'android', is_prod: true, version_name: 'builtin', version_code: '4' }),
  envForManifest({ version: '1.0.1438', url: 'https://example.test/plaintext.zip', checksum: 'legacy-checksum' }),
  {},
);
assert.equal((await response.json()).version, '1.0.1438', 'minNative가 없던 실제 legacy plaintext manifest도 호환');
for (const { name, manifest: invalidLegacyManifest } of [
  { name: 'legacy v4도 공백 sessionKey를 plaintext로 폴백하지 않음', manifest: { ...encryptedBase, sessionKey: ' ' } },
  { name: 'legacy v4도 malformed minNative를 허용하지 않음', manifest: { version: '1.0.1438', url: 'https://example.test/plaintext.zip', checksum: 'legacy-checksum', minNative: '4junk' } },
]) {
  response = await worker.fetch(
    otaRequest({ platform: 'android', is_prod: true, version_name: 'builtin', version_code: '4' }),
    envForManifest(invalidLegacyManifest),
    {},
  );
  assert.deepEqual(await response.json(), {}, name);
}

for (const { name, body } of [
  { name: 'v5 legacy Production 셸은 평문 manifest 차단', body: { platform: 'android', is_prod: true, version_name: 'builtin', version_code: '5' } },
  { name: '명시적 Production 채널은 v4여도 평문 manifest 차단', body: { platform: 'android', defaultChannel: 'production', version_name: 'builtin', version_code: '4' } },
  { name: 'beta 채널은 평문 manifest 차단', body: { platform: 'android', defaultChannel: 'beta', version_name: 'builtin', version_code: '5' } },
  { name: 'null 채널은 필드 부재로 정규화하지 않음', body: { platform: 'android', defaultChannel: null, is_prod: true, version_name: 'builtin', version_code: '4' } },
  { name: '객체 채널은 필드 부재로 정규화하지 않음', body: { platform: 'android', defaultChannel: {}, is_prod: true, version_name: 'builtin', version_code: '4' } },
  { name: '빈 채널은 필드 부재로 정규화하지 않음', body: { platform: 'android', defaultChannel: '', is_prod: true, version_name: 'builtin', version_code: '4' } },
  { name: '부분 숫자 versionCode는 legacy 예외 차단', body: { platform: 'android', is_prod: true, version_name: 'builtin', version_code: '4junk' } },
  { name: '소수 versionCode는 legacy 예외 차단', body: { platform: 'android', is_prod: true, version_name: 'builtin', version_code: 4.5 } },
  { name: '누락 versionCode는 legacy 예외 차단', body: { platform: 'android', is_prod: true, version_name: 'builtin' } },
  { name: 'null JSON 본문은 fail-closed', body: null },
  { name: '배열 JSON 본문은 fail-closed', body: [] },
]) {
  response = await worker.fetch(otaRequest(body), legacyPlaintextEnv, {});
  assert.equal(response.status, 200, name);
  assert.deepEqual(await response.json(), {}, name);
}

// #1489 이전 release 셸은 defaultChannel 없이 native is_prod:true만 보냈다.
// 공개키가 없는 기존 v4 Production 셸도 encrypted manifest는 받지 않는다.
response = await worker.fetch(otaRequest({ platform: 'android', is_prod: true, version_name: 'builtin', version_code: '4' }), env, {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { message: 'min native 5 > 4' });

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
