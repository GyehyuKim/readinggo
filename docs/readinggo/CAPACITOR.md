# Capacitor 설정 (#872) — 앱스토어 셸

ReadingGo 웹앱(Vite, #871)을 Capacitor로 감싸 iOS/Android 앱으로 출시한다.

- `appId`: `com.readinggo.app` · `appName`: `ReadingGo` · `webDir`: `dist` (Vite 산출물) — `capacitor.config.json`.
- 의존: `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli`(dev).

## 현재까지 (이 PR)
설정 + 의존만. **네이티브 프로젝트(`ios/`·`android/`)는 아직 생성 안 함** — 툴체인 필요.

## 다음 단계 (툴체인 준비 후) — 게이팅

### iOS (맥미니) — ✅ 2026-06 시뮬레이터 빌드 성공(#872)

> Capacitor 8 = **SPM**(CocoaPods 불필요). `ios/` 는 커밋됨(빌드물 제외).

**sudo 없이** 빌드하는 법(맥미니에서 검증):
```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # xcode-select sudo 우회(프로세스 단위)
cd docs/readinggo
npm ci && VITE_READINGGO_ENV=development npm run build            # 시뮬레이터용 웹 → dist
npx cap sync ios                                                  # dist → ios + 플러그인
# ⚠️ SPM 이 GitHub(capacitor-swift-pm)을 fetch → macOS 키체인 GUI 가 막음.
#    아래 env 로 시스템 git + 키체인 헬퍼 OFF(이 프로세스만) → 프롬프트 없이 진행:
export GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/usr/bin/true
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0=
cd ios/App
xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App -scmProvider system
xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -scmProvider system -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO build
# → ** BUILD SUCCEEDED **
```

App Store/TestFlight 아카이브용 번들은 반드시 production 분석 경계와 commit SHA를 포함해 빌드한다.

```bash
cd docs/readinggo
VITE_READINGGO_ENV=production npm run build
npx cap sync ios
```
- 키체인 창이 떠도 **Deny** 눌러도 됨(위 env 면 안 뜸). SPM 아티팩트 캐시가 깨지면 `rm -rf ~/Library/Caches/org.swift.swiftpm` 후 재해석.
- 실기기·TestFlight 는 **Apple Developer 계정($99, #873)** 활성 + 서명 필요(이후).

### Android (Windows = 계휴)
1. Android Studio + SDK.
2. `npm run build && npx cap add android && npx cap sync android`.
3. `npx cap open android` → 에뮬/실기기 빌드. **Play Console($25, #873)**.

## 웹 변경 반영 루틴
웹 코드 수정 → `npm run build` → `npx cap sync` → 네이티브 재빌드. (런칭 후엔 OTA Live Updates 로 빌드 없이 즉시 배포 — iOS-PLAN §10.5.)

## 메모
- `appId`(com.readinggo.app)는 스토어 번들 ID — 최종 확정 시 변경 가능(`capacitor.config.json` + 네이티브 프로젝트 재생성).
- `ios/`·`android/` 생성 후엔 보통 커밋(네이티브 설정 포함). 생성 시 `.gitignore`에 빌드 산출물(`Pods/`, `build/`, `*.xcworkspace/xcuserdata` 등) 추가.
