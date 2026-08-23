import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [manifest, paths, extractionRules, gradle, auth, otaRelease, otaPromote, androidRelease, androidApk, releaseGuide] = await Promise.all([
  read('../docs/readinggo/android/app/src/main/AndroidManifest.xml'),
  read('../docs/readinggo/android/app/src/main/res/xml/file_paths.xml'),
  read('../docs/readinggo/android/app/src/main/res/xml/data_extraction_rules.xml'),
  read('../docs/readinggo/android/app/build.gradle'),
  read('../docs/readinggo/js/supabase-client.js'),
  read('../.github/workflows/ota-release.yml'),
  read('../.github/workflows/ota-promote.yml'),
  read('../.github/workflows/android-release.yml'),
  read('../.github/workflows/android-apk.yml'),
  read('../docs/readinggo/RELEASE.md'),
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
assert.match(otaRelease, /::add-mask::\$SESSION_KEY/, '파생 sessionKey는 workflow log에서 mask해야 한다');
assert.doesNotMatch(otaRelease, /echo "manifest: \$MANIFEST"/, 'encrypted manifest 전체를 release log에 출력하면 안 된다');
assert.match(otaPromote, /sessionKey/);
assert.match(otaPromote, /checksum/);
assert.match(otaPromote, /validString\(m\.sessionKey\)/, 'promote는 sessionKey를 nonempty trimmed string으로 검증해야 한다');
assert.match(otaPromote, /Number\.isSafeInteger\(m\.minNative\)&&m\.minNative>=5/, 'promote는 encrypted minNative 숫자형 v5 경계를 강제해야 한다');
assert.match(otaPromote, /u\.protocol==="https:"/, 'promote는 bundle URL을 HTTPS로 제한해야 한다');
assert.match(otaPromote, /\^\[a-f0-9\]\{64\}\$\/i\.test\(m\.checksum\)/, 'promote는 checksum을 SHA-256 hex로 검증해야 한다');
assert.match(otaRelease, /Number\.isSafeInteger\(versionCode\) \|\| versionCode < 5/, 'release는 Android versionCode v5 경계를 publish 전에 검증해야 한다');
assert.match(otaRelease, /u\.protocol==="https:"/, 'release는 최종 manifest bundle URL을 HTTPS로 검증해야 한다');
assert.match(otaRelease, /\^\[a-f0-9\]\{64\}\$\/i\.test\(m\.checksum\)/, 'release는 최종 manifest checksum을 SHA-256 hex로 검증해야 한다');
assert.doesNotMatch(releaseGuide, /wrangler@4(?=[\s`])/, '수동 rollback의 privileged CLI는 정확한 버전으로 고정해야 한다');
assert.doesNotMatch(releaseGuide, /GOOD=.*checksum/, 'sessionKey 없는 수동 encrypted manifest 재구성 절차를 제공하면 안 된다');
assert.match(releaseGuide, /2세대 이상 이전 복원은[\s\S]{0,120}지원하지 않는다/, '다세대 encrypted archive 전에는 2세대+ rollback을 지원한다고 쓰면 안 된다');
assert.doesNotMatch(otaPromote, /promoting beta manifest: \$BETA|backing up current production manifest[^\n]*\$CUR/, 'OTA manifest 전체를 promote log에 출력하면 안 된다');
assert.match(androidRelease, /OTA_PUBLIC_KEY:/, '스토어 셸 빌드는 검증 public key 변수를 요구해야 한다');
assert.match(androidRelease, /key save --key-data "\$OTA_PUBLIC_KEY"/, 'public key를 cap sync 전에 네이티브 설정에 주입해야 한다');
assert.match(androidApk, /OTA_PUBLIC_KEY:\s*\$\{\{ vars\.OTA_PUBLIC_KEY \}\}/, 'beta APK도 release 셸과 같은 OTA public key를 요구해야 한다');
assert.match(androidApk, /@capgo\/cli@8\.41\.4 key save --key-data "\$OTA_PUBLIC_KEY"/, 'beta APK는 encrypted bundle 검증 key를 cap sync 전에 주입해야 한다');
assert.match(androidApk, /publicKey\|\|c\.plugins\.CapacitorUpdater\.defaultChannel!==['"]beta['"]/, 'key 저장 후 beta 채널과 public key를 함께 fail-closed 검증해야 한다');
assert.match(otaPromote, /environment:\s*ota-production/, 'Production OTA 승격은 별도 2인 승인 environment를 사용해야 한다');
assert.match(otaPromote, /gh api "repos\/\$\{GITHUB_REPOSITORY\}\/environments\/ota-production"/, 'OTA 승격 전 live environment 설정을 조회해야 한다');
assert.match(otaPromote, /rule\.prevent_self_review !== true/, 'OTA environment는 self-review 차단을 fail-closed 검증해야 한다');
assert.match(otaPromote, /needs:\s*verify-ota-production-environment/, 'promotion job은 보호 설정 preflight 성공에 의존해야 한다');

console.log('OK: Android backup/FileProvider/R8, OAuth callback, OTA pin/signature/approval residual contracts');
