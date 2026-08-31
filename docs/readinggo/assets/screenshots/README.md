# 스토어 스크린샷

App Store / Play Store 제출용 스크린샷.

## ios-6.9/

iPhone 6.9" (iPhone 17 Pro Max) — App Store Connect **필수** 사이즈. 1320 × 2868 px.

현재 유효한 이미지 파일은 없다. 아래 이름으로 현재 UI를 재촬영한다.

| 예정 파일 | 화면 | 강조 |
|---|---|---|
| `01-home.png` | 홈 | 오늘 읽은 쪽 기록·진행바·"내가 남긴 흔적" |
| `02-feed.png` | 피드 | 한 문장 소셜 피드(여러 독자) |
| `03-library.png` | 서재 | 읽고 싶은 책·읽는 중·완독·중단 |
| `04-profile.png` | 프로필 | 월간 활동·내 문장 |
| `05-search.png` | 검색 | 제목·저자·ISBN·바코드 검색 |

구 이미지는 삭제된 XP·성장 단계·독서 활동 히트맵 또는 구 IA를 담고 있어 제거했다. 현재 5탭 IA를 기준으로 다시 촬영한다.

## 재생성 방법

Capacitor iOS 빌드를 시뮬레이터에 올리고 `xcrun simctl io booted screenshot`으로 캡처한다.

```bash
# 1. 빌드 + 동기화 (docs/readinggo/)
npm run build && npx cap sync ios
# 2. iPhone 17 Pro Max 부팅 + 빌드/설치/실행 (CAPACITOR.md 참고, 키체인 우회 env)
# 3. App Store 컨벤션 상태바
xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
# 4. 각 화면 캡처
xcrun simctl io booted screenshot 01-home.png
```

탭 전환은 데모 게스트 상태에서 수행. 동의 배너는 localStorage `rg_data_consent=yes`로 사전 처리.

## TODO (후속)

- 게스트 배너 제거 / 로그인 상태 캡처 (마케팅 폴리시)
- 마케팅 프레임·카피 오버레이 (#874 `store/listing-ko.md` 카피 활용)
- Android Play Store 사이즈(계휴 Windows 빌드 후)
- iPad 6.5"/12.9" (선택)
