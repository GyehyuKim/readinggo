import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [manifest, paths, extractionRules, gradle, auth, androidRelease, androidApk, releaseGuide] = await Promise.all([
  read('../docs/readinggo/android/app/src/main/AndroidManifest.xml'),
  read('../docs/readinggo/android/app/src/main/res/xml/file_paths.xml'),
  read('../docs/readinggo/android/app/src/main/res/xml/data_extraction_rules.xml'),
  read('../docs/readinggo/android/app/build.gradle'),
  read('../docs/readinggo/js/supabase-client.js'),
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

assert.doesNotMatch(releaseGuide, /wrangler@4(?=[\s`])/, '수동 rollback의 privileged CLI는 정확한 버전으로 고정해야 한다');
assert.match(androidRelease, /npx cap sync android/, '스토어 AAB는 production web bundle을 Android 프로젝트에 동기화해야 한다');
assert.match(androidApk, /npx cap sync android/, 'DEV APK도 web bundle을 Android 프로젝트에 동기화해야 한다');
assert.doesNotMatch(androidRelease, /PUBLIC_KEY|PRIVATE_KEY/, '스토어 빌드에 폐기된 updater key 단계가 남으면 안 된다');
assert.doesNotMatch(androidApk, /PUBLIC_KEY|PRIVATE_KEY/, 'DEV APK에 폐기된 updater key 단계가 남으면 안 된다');

console.log('OK: Android backup/FileProvider/R8, OAuth callback, store-build residual contracts');
