# RELEASE.md — 스토어 전용 앱 릴리스

ReadingGo 설치 앱은 iOS App Store와 Google Play의 **스토어 바이너리로만** 배포·업데이트한다. 웹 Worker 배포는 설치 앱 업데이트가 아니며, 앱에 포함될 웹 자산은 승인된 소스에서 Vite로 빌드해 네이티브 바이너리에 함께 넣는다.

스토어 빌드·서명 명령은 [`RELEASE-BUILD.md`](./RELEASE-BUILD.md), 웹 Worker의 DEV→Production 승격은 [`RUNBOOK-DEPLOY.md`](./RUNBOOK-DEPLOY.md)가 담당한다.

## 1. 릴리스 원칙

- 앱 변경은 JS·HTML·CSS·정적 자산을 포함해 모두 새 APK/AAB 또는 IPA에 포함하고 스토어 심사를 거친다.
- `main`에서 stable DEV를 검증한 뒤 릴리스용 브랜치나 태그를 만들고, 같은 승인 소스에서 production 웹 번들을 빌드한다.
- Android와 iOS는 각 스토어의 단계적 출시 기능을 사용한다. 이상이 있으면 롤아웃을 중단하고 직전 정상 소스를 더 큰 빌드 번호로 다시 제출한다.
- 저장소의 빌드·서명 workflow는 아티팩트 생성까지만 담당한다. 스토어 업로드·심사·출시는 별도 승인 작업이다.

## 2. 버전 SSOT

| 역할 | 파일 | 키 | 규칙 |
|---|---|---|---|
| npm·웹 패키지 메타데이터 | `package.json` | `version` | 내부 빌드 메타데이터. 모바일 버전과 독립 |
| Android 마케팅 버전 | `android/app/build.gradle` | `versionName` | 사용자 노출 SemVer |
| Android 빌드 번호 | `android/app/build.gradle` | `versionCode` | Play 업로드마다 단조 증가하는 양의 정수 |
| iOS 마케팅 버전 | `ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` | App Store 사용자 노출 버전 |
| iOS 빌드 번호 | 같은 파일 | `CURRENT_PROJECT_VERSION` | App Store Connect 업로드마다 단조 증가하는 양의 정수 |

- 플랫폼 간 문자열 일치 요구 없음: npm, Android, iOS는 소비자와 릴리스 주기가 다르다.
- 빌드 번호도 플랫폼 간 동기화하지 않음: 각 스토어 이력 안에서만 단조 증가하면 된다.
- Android Debug/Release 설정끼리, iOS Debug/Release 설정끼리는 같은 플랫폼 버전에 합의해야 한다.

## 3. Android 체크리스트

```text
[ ] origin/main의 승인된 SHA와 stable DEV 검증 근거 확인
[ ] versionName 결정, versionCode를 직전 Play 업로드보다 크게 증가
[ ] VITE_READINGGO_ENV=production npm run build
[ ] npx cap sync android
[ ] android-release workflow 또는 RELEASE-BUILD.md 절차로 서명된 AAB/APK 생성
[ ] 내부 테스트에서 설치·로그인·핵심 기록·업데이트 설치 확인
[ ] Play Console에 업로드하고 staged rollout 계획 확인
[ ] commit SHA, versionName/versionCode, AAB checksum, workflow run, 기기 QA를 receipt에 기록
```

## 4. iOS 체크리스트

```text
[ ] origin/main의 승인된 SHA와 stable DEV 검증 근거 확인
[ ] MARKETING_VERSION 결정, CURRENT_PROJECT_VERSION을 직전 업로드보다 크게 증가
[ ] Debug/Release 선언값이 각각 하나의 값으로 일치하는지 확인
[ ] VITE_READINGGO_ENV=production npm run build
[ ] npx cap sync ios
[ ] Xcode archive·서명·TestFlight 빌드 생성
[ ] TestFlight 실기기에서 로그인·핵심 기록·업데이트 설치 확인
[ ] App Store Connect에 제출하고 phased release 계획 확인
[ ] commit SHA, 버전/빌드, archive provenance, workflow·기기 QA를 receipt에 기록
```

## 5. 롤백과 핫픽스

- **출시 중**: Play staged rollout 또는 App Store phased release를 즉시 중단한다.
- **이미 설치됨**: 스토어는 자동 다운그레이드를 제공하지 않는다. 직전 정상 소스로 복구하되 새 `versionCode` 또는 `CURRENT_PROJECT_VERSION`으로 롤포워드 빌드를 제출한다.
- **웹 코드 핫픽스**도 동일하다. 수정 PR → stable DEV 검증 → 새 스토어 바이너리 → 내부 테스트 → 단계적 출시 순서를 생략하지 않는다.
- 과거 바이너리 재사용, 빌드 번호 재사용, 승인되지 않은 로컬 소스의 긴급 업로드는 금지한다.

## 6. 읽기 전용 정합 검사

```bash
# docs/readinggo에서 실행
node -p "'npm metadata: ' + require('./package.json').version"
grep -m1 -E '^\s*versionName\s+' android/app/build.gradle
grep -m1 -E '^\s*versionCode\s+' android/app/build.gradle
grep -o 'MARKETING_VERSION = [^;]*' ios/App/App.xcodeproj/project.pbxproj | sort -u
grep -o 'CURRENT_PROJECT_VERSION = [^;]*' ios/App/App.xcodeproj/project.pbxproj | sort -u
node ../../tests/release-version-contract.test.mjs
```
