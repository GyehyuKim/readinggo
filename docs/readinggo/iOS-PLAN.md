# ReadingGo iOS (+ Android) 출시 계획 — DRAFT

> 상태: **DRAFT** (2026-05-21 작성, 미확정)
> 목적: 학기말 발표용 Phase 2 — App Store / Play Store 정식 출시
> 솔로 빌드: 계휴 / 2주 (1주 압축 목표, 1.5주 슬립 허용)
> 이후 2주: 유저 피드백 + 핫픽스

## 결정 요약

| 항목 | 결정 |
|---|---|
| 플랫폼 | **iOS + Android 양수겸장** (스펙 v4.3 Phase 2는 Android 단독 — iOS 추가가 변경점) |
| 스택 | **Capacitor** (웹 데모 코드 ~100% 재사용) |
| 백엔드 | Supabase (Phase 1과 동일) |
| 푸시 | iOS APNs + Android FCM (Capacitor Push Notifications plugin) |
| 빌드 환경 | Mac mini M3 16GB (계휴) |
| 배포 | App Store + Play Store 정식 트랙 |
| 개발자 계정 | Apple Developer Individual ($99/yr) + Google Play Console ($25 일회성) |

## 스택 선택 사유 (Capacitor vs Expo)

100시간 솔로 + 양수겸장 + 출시 제약에서:
- Capacitor: 데모 코드 거의 그대로 wrap → 순수 코딩 ~25h
- Expo: HTML/Tailwind → RN View/StyleSheet 전면 재작성 → ~60h 소요
- 학기 일정엔 Expo 비현실적. 차후 사용자 늘면 RN 마이그 검토 가능

**Capacitor 알려진 리스크와 대응**:
- App Store 4.2 (Minimum Functionality) 거절 위험 → 푸시·오프라인·햅틱으로 네이티브 기능 박기
- WebView 성능 체감 → Vite 번들링으로 첫 로딩 최적화
- iOS Safe Area/키보드 → `@capacitor/keyboard` + safe-area-inset CSS

## 1주 압축 계획 (50h)

| Day | h | 작업 | 산출물 |
|---|---|---|---|
| D1 | 8 | **블로커 먼저**: Apple Dev 결제 (활성화 대기 시작) → Vite 전환 → Capacitor init → 시뮬레이터에서 데모 동등 동작 | Vite 빌드 통과 + iOS 시뮬레이터 실행 |
| D2 | 8 | iOS 셸 (아이콘·스플래시·폰트·Safe Area·Keyboard) + Android 셸 + 갤플립6 USB deploy | 양 플랫폼 시뮬/실기기 동작 |
| D3 | 8 | Supabase (스키마·RLS·Google OAuth·books 시드) + localStorage→Supabase 마이그 + 가입 전 데이터 이관 | Supabase 연동 완료 |
| D4 | 8 | 푸시 (APNs Key·Push Notifications·FCM) + 알림 스케줄 (IM-06) + BACKLOG P0 1~2개 (IM-01 🔖→서재, IM-04 비공개) | 푸시 동작 + BACKLOG 2건 |
| D5 | 8 | BACKLOG P0 잔여 (IM-03 받은 모이, IM-13 NPC 진도, IM-08 첫 7일 방패) + `/design-review` 1회 | BACKLOG 5건 + 디자인 폴리시 |
| D6 | 6 | 스크린샷 (6.7"/6.5"/5.5") + 개인정보처리방침 (GitHub Pages) + 앱 설명·키워드·등급 설문 | 양 스토어 메타데이터 |
| D7 | 4 | iOS 심사 제출 + Play Store 정식 트랙 제출 | 심사 대기 진입 |

## 슬립 룰 (1주 → 1.5주 허용)

| 슬립 트리거 | 대응 |
|---|---|
| D3 (Supabase) 못 끝남 | Phase 0 localStorage 유지로 출시 → Phase 1 백엔드는 출시 후 OTA |
| D5 BACKLOG P0 못 끝남 | IM-01 (🔖→서재) 1개만 우선. 나머지는 Week 2로 |
| D7 제출 못 함 | +3일 → 출시일 Day 10. Week 2 안에 잔존 |
| TestFlight Beta Review 거절 | 푸시·햅틱·오프라인 강조하여 재제출 |

## Week 2 — 버퍼 + 정리 (50h)

| 활동 | 비중 |
|---|---|
| App Store 심사 거절 대응 | 가변 |
| BACKLOG IM/CL 잔여 처리 | 핵심 |
| 베타 테스터 (윤지·승원) 피드백 1차 반영 | 핵심 |
| 출시 후 모니터링 인프라 (Sentry + 인앱 피드백) | 4~6h |

## Week 3~4 — 유저 피드백

- 크래시 리포트 모니터링
- 사용자 인터뷰 5~10명
- 핫픽스 OTA (Capacitor Live Updates 또는 웹 자산 교체)

## Apple Developer 가입 체크리스트

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
- 시뮬레이터 동작 확인 (실기기는 Provisioning Profile 필요 → Apple Dev 필수)

## 즉시 행동 (오늘~내일)

- [ ] **Apple Developer Program 결제** (Individual)
- [ ] Google Play Console 가입 ($25)
- [ ] (선택) Firebase 프로젝트 생성 (FCM)
- [ ] 갤플립6 USB 디버깅 모드 ON / Mac에 ADB 설치
- [ ] Mac mini Xcode 16 + iOS 17 SDK 설치 확인

## 팀 분담 (DRAFT)

| 역할 | 담당 | 비고 |
|---|---|---|
| iOS/Android 빌드·출시 | 계휴 | 100h 솔로 |
| iOS 베타 테스트 (TestFlight) | 윤지·승원 | iPhone 보유 |
| Android 베타 테스트 (Play Internal) | 계휴 | 갤플립6 |
| 베타 피드백 수집 인터뷰 | (협의) | Week 2~4 |

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-21 | DRAFT 작성. 스택=Capacitor, 양수겸장, 1주 압축 목표 |
