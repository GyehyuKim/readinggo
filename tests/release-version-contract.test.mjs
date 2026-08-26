import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [pkgText, gradle, xcode, releaseDoc] = await Promise.all([
  readFile(new URL('../docs/readinggo/package.json', import.meta.url), 'utf8'),
  readFile(new URL('../docs/readinggo/android/app/build.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../docs/readinggo/ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8'),
  readFile(new URL('../docs/readinggo/RELEASE.md', import.meta.url), 'utf8'),
]);

const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const iosMarketingVersion = /^\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?$/;

const pkg = JSON.parse(pkgText);
assert.equal(typeof pkg.version, 'string', 'npm package version must be a string');
assert.match(pkg.version, semver, 'npm package metadata must be valid SemVer');

const androidNames = [...gradle.matchAll(/^\s*versionName\s+"([^"]+)"\s*$/gm)];
const androidCodes = [...gradle.matchAll(/^\s*versionCode\s+(\d+)\s*$/gm)];
assert.equal(androidNames.length, 1, 'Android versionName must have exactly one declaration');
assert.equal(androidCodes.length, 1, 'Android versionCode must have exactly one declaration');
assert.match(androidNames[0][1], semver, 'Android versionName must be valid SemVer');
assert.ok(Number(androidCodes[0][1]) > 0, 'Android versionCode must be a positive integer');

const iosMarketing = [...xcode.matchAll(/\bMARKETING_VERSION = ([^;]+);/g)].map((match) => match[1].trim());
const iosBuilds = [...xcode.matchAll(/\bCURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1].trim());
assert.ok(iosMarketing.length >= 2, 'iOS Debug/Release MARKETING_VERSION declarations are required');
assert.ok(iosBuilds.length >= 2, 'iOS Debug/Release CURRENT_PROJECT_VERSION declarations are required');
assert.equal(new Set(iosMarketing).size, 1, 'iOS configurations must agree with each other on MARKETING_VERSION');
assert.equal(new Set(iosBuilds).size, 1, 'iOS configurations must agree with each other on CURRENT_PROJECT_VERSION');
assert.match(iosMarketing[0], iosMarketingVersion, 'iOS MARKETING_VERSION must be parseable');
assert.match(iosBuilds[0], /^\d+$/, 'iOS CURRENT_PROJECT_VERSION must be an integer');
assert.ok(Number(iosBuilds[0]) > 0, 'iOS CURRENT_PROJECT_VERSION must be positive');

assert.match(releaseDoc, /플랫폼 간 문자열 일치 요구 없음/);
assert.match(releaseDoc, /빌드 번호도 플랫폼 간 동기화하지 않음/);
assert.match(releaseDoc, /스토어 바이너리로만/);
assert.doesNotMatch(releaseDoc, /마케팅 버전 3곳 일치/);
assert.doesNotMatch(releaseDoc, /둘을 같은 정수로 맞춰/);

console.log('OK: npm·Android·iOS 독립 버전 SSOT와 store-only release 계약');
