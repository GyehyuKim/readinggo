# ReadingGo Roadmap — 북모리 전체 벤치마크 × Phase 매트릭스

> ## ⚠️ v7 갱신 필요 (2026-06-01)
> 아래 매트릭스는 **v5.1 기준이라 다수 항목이 폐기/이동**됐다. v7 변경 요지:
> - **Capacitor·앱스토어·OCR·STT·위젯·푸시 → Phase 3 보류** (web-first 전환). Phase 0/1은 순수 웹.
> - **폐기**: 운영자 짹(전 단계), 첫 7일 둥지 가속, 주간 리그, 결정 마찰 카피, 메가스트림/서브모임, chapter_id 자동매핑.
> - **복귀**: 마을(파트 마일스톤). **신규**: AI 도서 추천(Gemini 무료), 성 컬렉션, 페이지 블라인드, 휴식코스, DataStore 계약.
> - Phase 정의·스택은 [`specs/README.md` §3](./specs/README.md), 결정 근거는 [`specs/meta/decisions.md`](./specs/meta/decisions.md)를 정본으로 본다.
>
> *매트릭스 전면 재작성은 후속 작업. 현재는 위 요지가 우선.*
>
> ---
>
> 작성: 2026-05-23
> 상태: v5.1 결정 기준. *모든 항목은 가역적*, 분기마다 재검토.
> 입력: `docs/readinggo-spec.md` (v5.1), `docs/readinggo/COMPETITIVE-ANALYSIS.md`, `docs/readinggo/BACKLOG.md`, 북모리 정밀 조사 (2026-05-22)
> 산출 의도: *"무엇을 언제 만들지"* 의 단일 진실 원천. BACKLOG는 *어디서 온 항목인지* 트리아지, ROADMAP은 *언제 가져갈지* 매핑.

## 0. 매핑 원칙

### 0.1 출처

| 출처 코드 | 의미 |
|---|---|
| `북모리` | 북모리에서 벤치마크 (`COMPETITIVE-ANALYSIS.md` §1.2) |
| `RG-v5` | ReadingGo v5 결정 (운영자 짹·둥지 가속 등) |
| `RG-원래` | ReadingGo 원래 의도 (BACKLOG `IM-*`) |
| `경쟁` | 다른 경쟁자(Fable·Bookly·리더스 등)에서 차용 |
| `RG-신규` | v5.1에서 신설 |

### 0.2 Phase

| Phase | 시점 | 핵심 |
|---|---|---|
| **0** | 즉시~1주 | Capacitor 셸 + Vite + 기존 데모 동등 동작 |
| **1** | 학기 중 | Supabase + 운영자 짹 + Annual Rewind 골격 + 모이 확장 |
| **2** | 학기말 | App Store + Play Store 출시. OCR · 위젯 · 자동 백업 |
| **3** | 학기 후 | 컬렉션 · 음성 · 자유 노트 · 수익 모델 · T2 mini · 마을 재설계 |

### 0.3 우선순위 (Phase 내)

| 우선순위 | 의미 |
|---|---|
| **P0** | 그 Phase가 *성공으로 평가받기 위해* 반드시 포함 |
| **P1** | 강력히 권장. 시간 부족 시 마지막에 컷 |
| **P2** | 있으면 좋음. 슬립 시 다음 Phase로 자연 이전 |
| **P3** | 다음 Phase 입구. 우선순위 낮음 |

### 0.4 비용 표기

- **낮**: 1~4h
- **중**: 4~12h
- **높**: 12h+
- 시간은 1인 평일 기준 추정.

---

## 1. 전체 매트릭스

### 1.1 Phase 0 — Capacitor 셸 + Vite (즉시~1주)

| 항목 | 출처 | 우선순위 | 비용 | 비고 |
|---|---|---|---|---|
| Vite 전환 (`React+Babel CDN` → ES 모듈) | RG-신규 | P0 | 중 | `iOS-PLAN.md §3 S1` |
| Capacitor init (iOS + Android 플랫폼) | RG-신규 | P0 | 낮 | `iOS-PLAN.md §3 S3` |
| Netlify 배포 검증 (Vite `dist/` 산출물) | RG-신규 | P0 | 낮 | 무중단 |
| iOS 시뮬레이터 첫 빌드 + Safe Area | RG-신규 | P0 | 중 | `@capacitor/keyboard` |
| Android 에뮬레이터 첫 빌드 | RG-신규 | P0 | 중 | Windows + Android Studio |
| 아이콘·스플래시 (`@capacitor/assets`) | RG-신규 | P0 | 낮 | 자동 생성 |
| 기존 데모 기능 동등 동작 (둥지·마을·소셜·내서재) | RG-원래 | P0 | 낮 | 회귀 검증 |
| **결정 마찰 카피 박기** ("그냥 펴진 페이지 한 줄도 좋아요") | RG-v5 | P1 | 낮 | v5 §0.5.3 결정 |
| **첫 7일 둥지 진화 가속** (D1/D3/D7) | RG-v5 | P1 | 낮 | v5 §5.2 |
| **운영자 짹 Phase 0 시드 응답 5개 + 자동 토스트** | RG-v5 | P1 | 낮 | v5 §5.6 |
| **친구 짹 → +1 XP** | RG-v5 | P1 | 낮 | v5 §6.3 |
| **23:00 긴급 알림 카피 강화** ("30초만 — 한 줄만") | RG-v5 | P2 | 낮 | v5 §12 |
| Apple Developer 결제 + 활성화 대기 | RG-신규 | P0 (병행) | — | 24~48h 활성화 |
| Google Play Console 가입 ($25) | RG-신규 | P0 (병행) | — | 일회성 |

### 1.2 Phase 1 — Supabase 연동 + 핵심 신규 (학기 중)

| 항목 | 출처 | 우선순위 | 비용 | 비고 |
|---|---|---|---|---|
| Supabase Auth (Google OAuth) | RG-원래 | P0 | 중 | 웹·모바일 공통 |
| Supabase Postgres + RLS 마이그레이션 (v5.1 스키마) | RG-원래 | P0 | 중 | `users.is_operator`, `sentences.my_note`, `chapter_id`, `operator_replies` 포함 |
| `localStorage` → Supabase 동기화 (가입 전 데이터 이관) | RG-원래 | P0 | 중 | §7.7 |
| pg_cron 스트릭/방패/NPC 배치 | RG-원래 | P0 | 중 | §6 |
| 닉네임 RPC + 금칙어 사전 (LDNOOBW + 한국어) | RG-원래 | P0 | 낮 | §7.6 |
| 운영자 짹 대시보드 `/operator` | RG-v5 | P0 | 중 | §5.6.3 |
| **모이 → 이미지 카드 공유** (배경/폰트/색상 커스텀) | 북모리 | P1 | 중 | Canvas API. 북모리 바이럴 루프 핵심 |
| **태그 시스템** (모이·책 양쪽) | 북모리 | P1 | 낮 | DB 컬럼 + UI |
| **바코드 스캔 책 등록** (`@capacitor-mlkit/barcode-scanning`) | 북모리 | P1 | 낮 | 네이티브 플러그인 |
| **책 메타데이터 자동 채움** (알라딘 OpenAPI 무료) | 북모리 | P1 | 낮 | TTBKey 발급 필요 |
| **무작위 모이 회상** (홈 카드 1개) | 북모리 | P1 | 낮 | 위젯은 Phase 2 |
| **챕터 단위 모이 연결** (`sentences.chapter_id` 자동 매핑) | RG-신규 | P1 | 낮 | `books_toc.csv` 기반 |
| 모이 `my_note` 입력 필드 UI | RG-v5 | P1 | 낮 | v5.1 데이터 모델 |
| **독서 달력 히트맵** (스트릭 달력 확장) | 북모리 | P2 | 낮 | 일별 색농도 |
| **일일·연간 목표** (페이지/문장) | 북모리 | P2 | 중 | 설정 + 달력 표시 |
| **통계 확장** (월별·연간 페이지/시간) | 북모리 | P2 | 중 | 차트 라이브러리 (Chart.js / Recharts) |
| **별점/리뷰 깊이** (책 상세 강화) | 북모리 | P2 | 낮 | UI만 |
| 운영자 짹 D1/D7 자동 큐잉 + D2~D6 수동 응답 | RG-v5 | P2 | 중 | UX 정성껏 |
| Annual Rewind **골격** (12월 활성화될 화면) | 북모리 | P2 | 중 | 컴포넌트 + 데이터 쿼리 준비, 실 발동은 12월 |
| BACKLOG IM-04 비공개 모이 토글 | RG-원래 | P2 | 낮 | UI 토글 |
| BACKLOG IM-05 ⚙️ 설정 — 닉네임 변경·알림 시간 | RG-원래 | P2 | 낮 | 내서재 설정 패널 |
| BACKLOG IM-21 알림 권한 요청 흐름 (F 화면) | RG-원래 | P2 | 낮 | Phase 1 진입 시 |
| BACKLOG IM-20 NPC 시드 문장 풀 60~100개/명 | RG-원래 | P2 | 중 | 수동 작성 |
| 챕터 단위 BACKLOG IM-22 진척 (페이지 20% 5단계) | RG-원래 | P3 | 낮 | 챕터 없는 책 폴백 |

### 1.3 Phase 2 — 학기말 출시 + 네이티브 기능 (학기말)

| 항목 | 출처 | 우선순위 | 비용 | 비고 |
|---|---|---|---|---|
| iOS App Store 정식 출시 (TestFlight → 심사) | RG-신규 | P0 | 중 | `iOS-PLAN.md §5` |
| Google Play 정식 출시 (Internal → Production) | RG-신규 | P0 | 중 | 동시 |
| 스크린샷 6.7"/6.5"/5.5" + 5인치 Android | RG-신규 | P0 | 중 | 시뮬레이터 캡처 |
| 개인정보처리방침 정적 페이지 | RG-신규 | P0 | 낮 | GitHub Pages |
| 앱 설명·키워드·등급 설문 | RG-신규 | P0 | 낮 | 양 스토어 |
| **OCR — `@capacitor-mlkit/text-recognition`** | 북모리 | P1 | 중 | 디바이스 내장, 비용 0, 한국어 OK. v5 §14 부분 해제 |
| **푸시 알림 — APNs + FCM** | 북모리 + 경쟁 | P1 | 중 | Capacitor Push Notifications |
| **홈 화면 위젯** (오늘의 모이 / 무작위 / 스트릭) | 북모리 | P1 | 중 | iOS WidgetKit + Android Glance |
| **OS 표준 공유 시트** (이미지 카드 외부 공유) | 북모리 | P1 | 낮 | `@capacitor/share` |
| TestFlight 베타 (윤지·승원 iOS) | RG-신규 | P1 | 낮 | 초대 |
| Play Internal Testing (계휴 갤플립6) | RG-신규 | P1 | 낮 | — |
| **Annual Rewind 본 화면** (12월 자동 활성화) | 북모리 | P2 | 중 | Phase 1 골격 위에 카피·애니메이션 |
| **다크모드 + 폰트 변경** | 북모리 | P2 | 낮 | CSS 변수 토글 |
| **PIN / 생체인식 잠금** | 북모리 | P2 | 낮 | `@capacitor-community/biometric-auth` |
| **자동 백업** (Google Drive + iCloud) | 북모리 | P3 | 중 | 낮은 우선순위 (사용자 결정) |
| 결제 BM 검토 시작 (사용자 N 데이터 수집) | 북모리 | P3 | — | 결정은 Phase 3 |

### 1.4 Phase 3 — 학기 후 지속 (학기 후)

| 항목 | 출처 | 우선순위 | 비용 | 비고 |
|---|---|---|---|---|
| **컬렉션/시리즈** (책 묶음 관리) | 북모리 | P1 | 중 | 라이브러리 정리 강화 |
| **음성 받아쓰기** (`@capacitor-community/speech-recognition`) | 북모리 | P1 | 중 | 디바이스 내장, 비용 0 |
| **태그별 통계 심화** | 북모리 | P1 | 낮 | 태그 시스템 위에 |
| **챕터 자동 인식** (알라딘 프리미엄 또는 OCR 결과 기반) | RG-원래 | P2 | 높 | 의존 정확도 |
| **Rich Text 자유 노트 별도 타입** (보류 → 검토) | 북모리 | P2 | 중 | `my_note` 사용 데이터로 결정 (v5 §13.5) |
| **수익 모델 진입** (구독/광고/결제) | 북모리 + 경쟁 | P2 | 높 | v5 §13.6 별도 안건 |
| **T2 mini (같은 책 자동 패널)** 본 설계 | 경쟁 (Fable) | P1 | 중 | 좀비 사용자 처리 핵심 (v5 §13.2) |
| **마을 탭 전체 재설계** | RG-v5 | P1 | 중 | TBD 해제 (v5 §13.4) |
| **XP destination** (모은 XP를 무엇에 쓰는가) | RG-신규 | P1 | 중 | Duolingo 벤치마킹 금지 (v5 §13.1) |
| **운영자 짹 자동화 단계 2** (N≤100 시드 풀 확장) | RG-v5 | P1 | 중 | v5 §13.3 |
| **운영자 짹 자동화 단계 3** (N≤500 AI 반자동) | RG-v5 | P2 | 높 | LLM 응답 후보 |
| **운영자 짹 자동화 단계 4** (N≥500 AI 자동) | RG-v5 | P3 | 높 | 품질 가드 |
| Sentry / 인앱 피드백 모니터링 인프라 | RG-신규 | P1 | 낮 | 출시 후 1주 내 |
| BACKLOG IM-17 교보문고 어필리에이트 (수익 검토 일부) | RG-원래 | P2 | 낮 | 수익 모델과 묶어 |

---

## 2. 의도적으로 *다르게* 가는 것 (북모리와의 차별)

| 북모리 | ReadingGo |
|---|---|
| 소셜·피드·챌린지 *의도적 배제* | **소셜·피드·운영자 짹·마을** 핵심 |
| 게이미피케이션 매우 약함 (캐릭터 칭찬 1종) | **스트릭·XP·둥지 진화·세리머니** 핵심 |
| Rich Text 자유 노트 별도 타입 | **모이 + `my_note` 확장 필드** 흡수 (Phase 1). 별도 타입 검토는 Phase 3 |
| OCR 무료 = 광고 게이트, 프리미엄 = 무제한 | **광고 없음** (학기 데모 무료) |
| 구독 ₩3,900/월 · ₩35,000/년 | **수익 모델 학기 후 별도 안건** (Phase 3 P2) |
| "본질에 집중 — 혼자 깊게" | "함께 매일 — 1페이지·1문장·운영자 응답" |
| 한 문장 OCR/노트 입력은 강제 아님 (옵션) | **한 문장 강제 입력** = 읽음의 유일한 증명 (BYOC wedge) |

---

## 3. 의존성 그래프 (핵심 의존만)

```
Phase 0
  Vite 전환 ─┬─→ Capacitor init ─┬─→ iOS/Android 시뮬레이터
              │                     ├─→ Phase 1 모든 작업의 기반
              └─→ Netlify 검증     └─→ Phase 2 출시·OCR·위젯의 기반

Phase 1
  Supabase Auth ──→ 7.3 스키마 ──┬─→ 운영자 짹 대시보드
                                    ├─→ 모이 `my_note`·`chapter_id`
                                    └─→ 가입 전 데이터 동기화

  태그 시스템 ──→ 통계 확장 ──→ Phase 3 태그별 통계 심화
  Annual Rewind 골격 ──→ Phase 2 Annual Rewind 본 화면 (12월)

Phase 2
  Apple Dev 활성 ──→ TestFlight ──→ App Store 심사
  Google Play Console ──→ Internal ──→ Production
  OCR 플러그인 ──→ 모이 OCR 입력 UX ──→ Phase 3 챕터 자동 인식 (옵션)
  위젯 ──→ 무작위 모이 (Phase 1 카드) + 스트릭

Phase 3
  운영자 짹 사용 데이터 ──→ 자동화 단계 2/3/4 전환 임계값 결정
  `my_note` 길이 분포 ──→ 자유 노트 별도 타입 신설 여부 결정
  사용자 N ──→ 수익 모델 시점 결정
  T2 패널 활동 데이터 ──→ 좀비 사용자 처리 임계값 결정
```

---

## 4. 미해결 (Phase 결정 후에도 미정)

전부 `docs/readinggo-spec.md §13` 에 정식 안건으로 등록됨. 여기서는 *Phase 매핑상의 위치*만 명시.

| 안건 | Phase 매핑 | 결정 트리거 |
|---|---|---|
| XP destination | Phase 3 P1 | 별도 세션 (Duolingo 벤치마킹 금지) |
| T2 mini 좀비 사용자 처리 | Phase 3 P1 | T2 패널 활동 데이터 |
| 운영자 짹 자동화 점진 | Phase 3 P1~P3 | 사용자 N 임계값 |
| 마을 탭 재설계 | Phase 3 P1 | T2 mini와 함께 묶음 |
| Rich Text 자유 노트 별도 타입 | Phase 3 P2 | `my_note` 사용 데이터 분포 |
| 수익 모델 진입 | Phase 3 P2 | 사용자 N + 운영 비용 + 법인화 의향 |

---

## 5. 기각 보존 (재검토 트리거 명시)

전부 `docs/readinggo-spec.md §14` 에 정식 등록. 여기서는 ROADMAP 차원의 요약.

| 기각 항목 | 재검토 트리거 |
|---|---|
| OCR 웹 환경 | — (영구 기각, Capacitor로 우회) |
| 음성 받아쓰기 웹 환경 | — (영구 기각, Capacitor로 우회) |
| 광고 게이트 (북모리 패턴) | 수익 모델 진입 시 (Phase 3) |
| Rich Text 자유 노트 *별도 타입* (현재) | `my_note` 사용 데이터로 입증 시 |
| 짹마다 다른 색 confetti | v6 시각 디테일 라운드 |
| 첫 7일 XP 더블 | XP destination 결정 후 |
| 새벽 3-4시 컷오프 유예 | 새벽 활동 사용자 클러스터 데이터 |

---

## 6. 분기별 재검토

이 ROADMAP은 *분기마다 한 번* 재검토. 각 재검토 시 갱신:
- 완료 항목 → 별도 *변경 이력* 섹션으로 이동
- 우선순위 변동
- 새 안건 추가
- 기각 항목 재검토 여부

다음 재검토 시점: **2026-08 학기 종료 직후**.

---

*v5.1 · 2026-05-23 · `docs/readinggo/ROADMAP.md`*
