# Capacitor 설정 (#872) — 앱스토어 셸

ReadingGo 웹앱(Vite, #871)을 Capacitor로 감싸 iOS/Android 앱으로 출시한다.

- `appId`: `com.readinggo.app` · `appName`: `ReadingGo` · `webDir`: `dist` (Vite 산출물) — `capacitor.config.json`.
- 의존: `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli`(dev).

## 현재까지 (이 PR)
설정 + 의존만. **네이티브 프로젝트(`ios/`·`android/`)는 아직 생성 안 함** — 툴체인 필요.

## 다음 단계 (툴체인 준비 후) — 게이팅

### iOS (맥미니)
1. **Xcode 설치**(App Store, full — Command Line Tools만으론 불가) + `xcode-select --switch /Applications/Xcode.app`.
2. **CocoaPods**: `sudo gem install cocoapods`.
3. `cd docs/readinggo && npm run build && npx cap add ios && npx cap sync ios`.
4. `npx cap open ios` → Xcode 에서 시뮬레이터 빌드. Safe Area/Keyboard/WebView 확인.
5. 실기기·TestFlight 는 **Apple Developer 계정($99, #873)** 활성 후.

### Android (Windows = 계휴)
1. Android Studio + SDK.
2. `npm run build && npx cap add android && npx cap sync android`.
3. `npx cap open android` → 에뮬/실기기 빌드. **Play Console($25, #873)**.

## 웹 변경 반영 루틴
웹 코드 수정 → `npm run build` → `npx cap sync` → 네이티브 재빌드. (런칭 후엔 OTA Live Updates 로 빌드 없이 즉시 배포 — iOS-PLAN §10.5.)

## 메모
- `appId`(com.readinggo.app)는 스토어 번들 ID — 최종 확정 시 변경 가능(`capacitor.config.json` + 네이티브 프로젝트 재생성).
- `ios/`·`android/` 생성 후엔 보통 커밋(네이티브 설정 포함). 생성 시 `.gitignore`에 빌드 산출물(`Pods/`, `build/`, `*.xcworkspace/xcuserdata` 등) 추가.
