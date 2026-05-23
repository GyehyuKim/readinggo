# ReadingGo iOS + Android 출시 계획

> 상태: **v5.1 기준 재작성** (2026-05-23). v4의 *학기말 1주 압축 모델* 폐기.
> 모델: **Capacitor 처음부터 — Phase 0/1/2 점진**. 같은 `src/`로 웹·iOS·Android 동시 빌드.
> 출시 목표: 학기말(Phase 2) App Store + Play Store 정식 트랙.

## 0. 모델 변경 (v4 → v5.1)

| | v4 모델 (폐기) | v5.1 모델 |
|---|---|---|
| 개발 흐름 | Phase 0/1 웹 → Phase 2 Capacitor wrap (학기말 1주 압축) | 처음부터 Capacitor 단일 코드베이스 |
| 작업 횟수 | 두 번 (웹 → 앱) | 한 번 |
| OCR/위젯 가능 시점 | Phase 3 (학기 후) | Phase 2 (학기말 안에) |
| Apple Dev 결제 | 학기말 D1 | **즉시** (활성화 대기 미리 시작) |
| 학기말 1주 압축 압박 | 있음 | 없음 |

## 1. 결정 요약 (v5.1)

| 항목 | 결정 |
|---|---|
| 플랫폼 | iOS + Android 양수겸장 |
| 스택 | **Capacitor** (RN/Expo 아님). 같은 React 컴포넌트가 웹·모바일 모두 동작 |
| 빌드 도구 | **Vite** (현재 React+Babel CDN 폐기) |
| 백엔드 | Supabase (Phase 1+) |
| 푸시 | iOS APNs + Android FCM (Capacitor Push Notifications) |
| 빌드 환경 | macmini M3 16GB (계휴, iOS) + Windows (Android Studio) |
| 호스팅 | Netlify (Vite `dist/` 산출물) |
| 배포 | App Store + Play Store 정식 트랙 |
| 개발자 계정 | Apple Developer Individual ($99/yr) + Google Play Console ($25) |
| 네이티브 플러그인 — Phase 2 P1 | `@capacitor-mlkit/text-recognition` (OCR), `@capacitor-mlkit/barcode-scanning`, Push Notifications, Filesystem, Share |
| 네이티브 플러그인 — Phase 3 | `@capacitor-community/speech-recognition` (STT) |

## 2. 스택 사유 (Capacitor 단일 선택)

| | Capacitor | Expo (탈락) | Flutter (탈락) |
|---|---|---|---|
| 기존 코드 재사용 | **~100%** (React 그대로) | 60h 재작성 | 100h 재작성 |
| 학습 부담 | 낮음 (웹 기술 그대로) | 중 (RN 패러다임) | 높음 (Dart 새 언어) |
| 네이티브 OCR/위젯 | ✅ 플러그인 | ✅ 일부 | ✅ |
| 학기 일정 적합 | ✅ | ❌ | ❌ |

**Capacitor 알려진 리스크와 대응**:
- App Store 4.2 (Minimum Functionality) 거절 위험 → 푸시·OCR·바코드·햅틱·위젯으로 네이티브 기능 박기
- WebView 성능 → Vite 번들링 + lazy load
- iOS Safe Area/키보드 → `@capacitor/keyboard` + safe-area-inset CSS (Phase 0 단계에 박음)

## 3. Phase 0 — Capacitor 셸 + Vite 전환 (1주 내)

> *학기 압축 1주가 아니라*, **현재 데모 위에 Capacitor 셸을 씌우는 일회성 셋업**.

| 단계 | 시간 | 작업 | 산출물 |
|---|---|---|---|
| **결제 (병행)** | — | Apple Dev Individual 결제 → 활성화 대기 (24~48h) | Apple Dev 활성 |
| **결제 (병행)** | — | Google Play Console 가입 ($25 일회) | Play Console 활성 |
| **S1** | 4~6h | **Vite 전환** — `index.html` + 6개 js 파일을 ES 모듈로 정리. `npm create vite@latest`. JSX 변환 빌드 타임으로 이전 | `npm run dev` 작동 |
| **S2** | 2~3h | Vite 빌드 산출물(`dist/`) Netlify 배포 검증. 기존 배포와 동등 | Netlify 그대로 동작 |
| **S3** | 4~6h | Capacitor init: `npm i @capacitor/core @capacitor/cli`, `npx cap init`, iOS/Android 플랫폼 추가 | `npx cap sync` 통과 |
| **S4** | 3~4h | iOS 시뮬레이터 첫 빌드 (Mac). Safe Area · Keyboard · WebView 호환 검증 | iOS 시뮬에서 데모 동등 동작 |
| **S5** | 3~4h | Android 에뮬레이터 첫 빌드 (Windows + Android Studio). 갤플립6 USB deploy | Android 시뮬·실기기 동작 |
| **S6** | 2~3h | 아이콘·스플래시 (`@capacitor/assets` 자동 생성). 머니그라피 폰트 네이티브 번들 | 스토어 메타 일부 |

**Phase 0 총 시간 ≈ 18~26h (3~4일 압축, 또는 1~2주 분산)**. 이후 Phase 1·2 작업은 같은 코드베이스 위에서 *점진* 추가.

## 4. Phase 1 — Supabase 연동 + 운영자 짹 + Annual Rewind 골격

> 학기 중. `npm run dev` 로 웹 미리보기 + 모바일 시뮬레이터 병행 검증.

- Supabase Auth (Google OAuth) — 웹·모바일 모두 `@capacitor/browser` 또는 Supabase JS SDK 그대로
- 7.3 스키마 마이그레이션 (`users.is_operator`, `sentences.my_note`, `sentences.chapter_id`, `operator_replies` 포함)
- `localStorage` → Supabase 동기화 (가입 전 데이터 이관)
- 푸시 알림 — Capacitor Push Notifications + APNs Key + FCM
- 운영자 짹 대시보드 `/operator` (§5.6)
- 운영자 권한 부여 (Supabase admin)
- Annual Rewind 골격 — 12월 활성화될 화면 (`ROADMAP.md`)
- 알림 시간 디폴트 21:00, 긴급 23:00 ("30초만 — 한 줄만")
- 닉네임 RPC + 금칙어 사전

## 5. Phase 2 — 학기말 출시 (App Store + Play Store)

### 5.1 출시 직전 P0 (제출용)

- 스크린샷 — 6.7"/6.5"/5.5" iOS + Android 다양 (Fastlane Snapshot 또는 시뮬레이터 수동)
- 개인정보처리방침 (GitHub Pages 정적 페이지)
- 앱 설명·키워드·등급 설문
- TestFlight 베타 (윤지·승원 iOS) + Play Internal Testing (계휴 갤플립6)

### 5.2 출시 직전 P1 (포함 가능)

- **OCR — `@capacitor-mlkit/text-recognition`** — 책 사진 → 모이 자동. 마찰 1·2층 해소. 데모 임팩트 큼
- **바코드 스캔 — `@capacitor-mlkit/barcode-scanning`** — 책 등록 한 번에
- **위젯** — iOS WidgetKit + Android Glance (오늘의 모이 / 무작위 모이 / 스트릭)
- **OS 표준 공유 시트** — 모이 이미지 카드 외부 공유

### 5.3 P2 (시간 여유 시)

- 다크모드·폰트 변경
- PIN/생체인식 잠금
- 자동 백업 (Google Drive / iCloud)

## 6. Phase 3 — 학기 후 지속

- 음성 받아쓰기 — `@capacitor-community/speech-recognition`
- 컬렉션/시리즈
- Rich Text 자유 노트 별도 타입 (보류, `my_note` 필드 사용 데이터 보고 결정)
- 챕터 자동 인식 본격화
- 수익 모델 검토 (구독·광고·결제)
- T2 mini (같은 책 자동 패널) 본 설계

## 7. 슬립 룰

| 슬립 트리거 | 대응 |
|---|---|
| Phase 0 Vite 전환 4일 이상 소요 | 윤지·승원 도움 요청. 컴포넌트 분리 작업 분할 가능 |
| iOS 시뮬 WKWebView 호환 깨짐 | 폴리필 또는 해당 기능 대체. WebView 차이는 보통 CSS 수준 |
| Phase 2 OCR 통합 시간 부족 | 출시 전 P2로 강등, 출시 후 1주 내 OTA |
| TestFlight Beta Review 거절 | 푸시·OCR·바코드 강조 재제출 (Minimum Functionality 거절 대응) |

## 8. Apple Developer 가입 체크리스트

**개인 (Individual) 선택 — Organization 아님**
- 개인: D-U-N-S 불필요, 즉시 결제, 활성화 24~48h
- 조직: D-U-N-S 신청 별도 1~2주 → 학기엔 부적합
- 표시 개발자명 = 본인 실명

**가입 전**:
- [ ] Apple ID 2단계 인증 활성화
- [ ] 해외결제 가능 신용카드
- [ ] 만 18세 이상

**가입 후 스킵 가능 (무료 앱)**:
- Tax/Banking 정보
- Paid Applications Agreement

**활성화 대기 중 가능 작업** (Apple Dev 무관):
- Vite 전환
- Capacitor init
- iOS 시뮬레이터 동작 확인 (실기기는 Provisioning Profile 필요 → Apple Dev 필수)

## 9. 즉시 행동 (오늘~내일)

- [ ] **Apple Developer Program 결제** (Individual, $99) — 활성화 24~48h 대기 시작
- [ ] **Google Play Console 가입** ($25 일회)
- [ ] (선택) Firebase 프로젝트 생성 (FCM)
- [ ] macmini Xcode 16 + iOS 17 SDK 설치 확인
- [ ] Windows Android Studio + Android SDK 설치 (Android 빌드용)
- [ ] 갤플립6 USB 디버깅 모드 ON
- [ ] Vite 전환 PR 생성 — 본 계획의 **Phase 0 S1~S2**가 첫 PR

## 10. 팀 분담

| 역할 | 담당 | 비고 |
|---|---|---|
| Vite 전환 + Capacitor init | 계휴 | Phase 0 일회성 |
| iOS 빌드·출시 | 계휴 (macmini 전담) | App Store Connect |
| Android 빌드·출시 | 계휴 (Windows + Android Studio) | Play Console |
| 데모 기능 개발 | 계휴 + 윤지 + 승원 | `npm run dev` 웹 미리보기로 누구나 작업 가능 |
| iOS 베타 테스트 | 윤지·승원 (iPhone) | TestFlight |
| Android 베타 테스트 | 계휴 (갤플립6) | Play Internal |
| 베타 피드백 수집 | (협의) | Phase 2 출시 후 |

> **핵심**: Vite + Capacitor 셸링 후에는 *기존 데모 작업 방식 그대로 유지*. 윤지·승원은 브라우저로 작업 계속 가능. iOS/Android 빌드만 계휴 전담.

## 11. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-21 | DRAFT 작성. 스택=Capacitor, 양수겸장, 1주 압축 목표 |
| 2026-05-23 | **v5.1 모델로 재작성**. 1주 압축 폐기 → Capacitor 처음부터 점진 모델. OCR/바코드/위젯이 Phase 2에 자연 편입 |
