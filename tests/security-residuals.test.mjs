import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [manifest, paths, extractionRules, gradle, auth, otaRelease, otaPromote, androidRelease] = await Promise.all([
  read('../docs/readinggo/android/app/src/main/AndroidManifest.xml'),
  read('../docs/readinggo/android/app/src/main/res/xml/file_paths.xml'),
  read('../docs/readinggo/android/app/src/main/res/xml/data_extraction_rules.xml'),
  read('../docs/readinggo/android/app/build.gradle'),
  read('../docs/readinggo/js/supabase-client.js'),
  read('../.github/workflows/ota-release.yml'),
  read('../.github/workflows/ota-promote.yml'),
  read('../.github/workflows/android-release.yml'),
]);

assert.match(manifest, /android:allowBackup="false"/, '인증·독서 데이터 앱은 Android 시스템 백업을 허용하면 안 된다');
assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
for (const domain of ['root', 'file', 'database', 'sharedpref', 'external']) {
  const rule = new RegExp(`<exclude\\s+domain="${domain}"\\s+path="\\."\\s*/>`, 'g');
  assert.equal([...extractionRules.matchAll(rule)].length, 2, `${domain} 데이터는 cloud backup과 device transfer 모두에서 제외해야 한다`);
}
assert.doesNotMatch(paths, /<external-path\b/, 'FileProvider가 외부 저장소 전체를 공유하면 안 된다');
assert.doesNotMatch(paths, /path="\."/, 'FileProvider가 cache/files 루트 전체를 공유하면 안 된다');
assert.match(paths, /<cache-path\s+name="shared_images"\s+path="shared-images\/"\s*\/>/);

assert.match(gradle, /release\s*\{[\s\S]*?minifyEnabled true[\s\S]*?shrinkResources true/, 'release 빌드는 R8와 resource shrink를 활성화해야 한다');
assert.match(gradle, /getDefaultProguardFile\('proguard-android-optimize\.txt'\)/, 'release R8는 최적화 기본 규칙을 사용해야 한다');
assert.match(gradle, /implementation "com\.google\.code\.gson:gson:2\.10\.1"/, 'barcode AAR의 누락된 Gson runtime dependency를 명시해야 한다');

assert.match(manifest, /android:scheme="@string\/custom_url_scheme"/);
assert.match(manifest, /android:host="login-callback"/);
assert.match(auth, /url\.protocol === NATIVE_REDIRECT_PROTOCOL/);
assert.match(auth, /url\.hostname === NATIVE_REDIRECT_HOST/);
assert.match(auth, /url\.pathname === '' \|\| url\.pathname === '\/'/);
assert.doesNotMatch(auth, /indexOf\('login-callback'\)/, 'OAuth callback은 부분 문자열로 신뢰하면 안 된다');

assert.doesNotMatch(otaRelease, /@capgo\/cli@latest/, 'privileged OTA CLI는 latest를 사용하면 안 된다');
assert.match(otaRelease, /@capgo\/cli@8\.41\.4/);
assert.match(otaRelease, /OTA_PRIVATE_KEY:/, 'OTA publish는 서명/암호화 private key secret을 요구해야 한다');
assert.match(otaRelease, /bundle encrypt[\s\S]*--key-data "\$OTA_PRIVATE_KEY"/, 'OTA bundle은 업로드 전에 private key로 보호해야 한다');
assert.match(otaPromote, /sessionKey/);
assert.match(otaPromote, /checksum/);
assert.match(androidRelease, /OTA_PUBLIC_KEY:/, '스토어 셸 빌드는 검증 public key 변수를 요구해야 한다');
assert.match(androidRelease, /key save --key-data "\$OTA_PUBLIC_KEY"/, 'public key를 cap sync 전에 네이티브 설정에 주입해야 한다');
assert.match(otaPromote, /environment:\s*ota-production/, 'Production OTA 승격은 별도 2인 승인 environment를 사용해야 한다');

console.log('OK: Android backup/FileProvider/R8, OAuth callback, OTA pin/signature/approval residual contracts');
