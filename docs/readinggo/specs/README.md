# ReadingGo 스펙 — 인덱스

> **기준**: v5.1 (2026-05-22 + Capacitor·모이·북모리 벤치마크) 분할판
> **분할일**: 2026-05-28
> **원본**: `docs/readinggo-spec.md` (1,533줄 단일 파일)에서 *피처별 분할*. 강의 Week 11 *thin spec* 처방 ([LF](../../lecture-frameworks.md#lf-week11-spec-honest-synthesis)) 적용.
> **편집 정책**: 변경은 *해당 피처 파일* PR로. 인덱스(이 파일)는 새 피처 추가 시만 갱신.

---

## 파일 지도

| 영역 | 파일 | 다룬 절 (원 spec) |
|---|---|---|
| **온보딩** | [`onboarding.md`](./onboarding.md) | §4 가입 여정 A~H |
| **둥지 탭** | [`nest.md`](./nest.md) | §5.1-5.4 The Path·진화·활성책·일일미션 |
| **마을 + 운영자 짹** | [`village.md`](./village.md) | §5.5-5.6 리딩 빌리지·운영자 |
| **소셜 탭** | [`social.md`](./social.md) | §5.7 |
| **내서재(프로필)** | [`profile.md`](./profile.md) | §5.8-5.9 |
| **시스템 로직** | [`systems.md`](./systems.md) | §6 스트릭·방패·XP·NPC·리그 |
| **백엔드** | [`backend.md`](./backend.md) | §7 플랫폼·인증·데이터 모델 |
| **디자인** | [`design.md`](./design.md) | §11 토큰 + §12 카피 |
| **메타: 여정** | [`meta/journey.md`](./meta/journey.md) | §0.5 v5 도달까지의 여정 |
| **메타: 결정 이력** | [`meta/decisions.md`](./meta/decisions.md) | §8 미결 → 확정 |
| **메타: 미해결** | [`meta/open-issues.md`](./meta/open-issues.md) | §13 미해결 안건 |
| **메타: 기각** | [`meta/rejected.md`](./meta/rejected.md) | §14 의도적 기각 |

---

## 0. 한 줄

> "하루 한 페이지, 한 문장에서 시작해요. 그냥 펴진 페이지 한 줄도 좋아요."

*(내부 컨셉 레퍼런스: "독서습관 앱계의 Duolingo" — 외부 노출 불가. v5 부터 게이미피케이션 세부 설계는 Duolingo 벤치마킹을 의도적으로 끊고 ReadingGo 고유 컨텍스트에서 발상.)*

---

## 1. 제품 약속

| 사용자가 얻는 것 | 제품이 책임지는 것 |
|---|---|
| 하루 1페이지 이상 읽는 습관 형성 | 듀오링고 수준의 지속성 엔진 (스트릭·방패·복귀) |
| 읽은 책의 핵심을 손에 남긴다 | "오늘의 문장" 누적 → 책 한 권의 엑기스 → Markdown export |
| 혼자가 아니라 같이 읽는다 | 단방향 팔로우 + 마을 둥지 시각화 + 박수 + NPC 동행 |

타겟: **읽고 싶은데 이어나가지 못하는 사람**. 안 읽는 사람을 끌어오는 제품 아님.

### 1.1 왜 책 / 왜 페이지

- 모두가 하고 싶어하는 행동 — "더 읽고 싶다"는 보편적 욕구
- 최소한의 정량화가 가능한 유일한 일상 카테고리 — 1페이지가 명확한 진척 단위

### 1.2 슬로건

> **"하루 한 페이지, 한 문장에서 시작해요."**
> 보조 카피: *"그냥 펴진 페이지 한 줄도 좋아요."*

UI 상 진입 화면 헤더·로그인 화면·온보딩 카피에서 일관되게 사용. v5부터 모이 입력 화면 하단에는 *결정 마찰 제거* 를 위해 보조 카피 항상 표시.

---

## 2. 핵심 루프

```
[책 등록] (여러 권 가능, 1권을 "활성 책"으로 지정)
   ↓
[앱 밖에서 읽기 — 하루 1페이지 이상이면 충분]
   ↓
[일일 미션: 활성 책의 현재 페이지 입력 + 오늘의 문장 입력(둘 다 강제)]
   ↓
[스트릭 갱신 → XP 보상 → 참새 다음 노드로 hop]
   ↓
[마을에서 친구 둥지 불빛 ON, 소셜 피드 노출 → 박수(짝짝짝)]
   ↓
[다음날 21:00 알림. 미참여 시 23:00 긴급 알림]
```

**목표 페이지 설정 없음.** 부담을 없애는 게 핵심 — 1페이지만 읽어도 오늘은 성공.

### 2.1 핵심 체크인 트리거

**"모이" 입력 (강제, 200자 이내).** *(브랜드명: 모이. 오늘 읽은 책에서 마음에 든 한 문장을 옮겨 적은 짧은 인용구·감상. DB 내부 테이블명은 `sentences`로 유지.)*

페이지 입력만으로는 읽음을 검증할 수 없다. 한 문장을 직접 적는 행위가 (a) 읽음의 증명이며 (b) 사용자에게 누적되는 자산이 된다.

### 2.2 이탈 방어선

- **스트릭 lock-in** — 끊기지 않은 연속일이 머무를 이유
- **누적 문장 export** — 떠나도 가져갈 수 있다는 신뢰가 lock-in의 윤리적 부담 상쇄

---

## 3. Phase 구분

**v5에서 재정의**: 기존 Phase 0(정적 웹) → Phase 1(Supabase 웹) → Phase 2(Capacitor 앱) 의 *2번 작업* 모델 폐기. **처음부터 Capacitor 단일 코드베이스**로 진행. 같은 `src/`가 `npm run dev`(웹 미리보기), `npm run build`(Netlify 배포), `npx cap run ios/android`(시뮬레이터·실기기)에 모두 사용됨.

| Phase | 대상 | 산출물 | 백엔드 | 데이터 저장 |
|---|---|---|---|---|
| **Phase 0** | Capacitor 셸 + 기본 데모 | Vite + Capacitor + React, Netlify 웹 배포 + iOS/Android 시뮬레이터 빌드 | **없음** | `localStorage` (Preferences plugin) + 정적 TSV |
| **Phase 1** | MVP — Supabase 연동 | 풀스택 웹앱 + 모바일 동시. 운영자 짹·푸시·Annual Rewind 골격 | **Supabase** (Auth + Postgres + pg_cron) | Postgres + Storage |
| **Phase 2** | 학기말 발표 — 앱스토어 출시 | iOS App Store + Google Play. OCR · 위젯 · 자동 백업 | Supabase + FCM + APNs | Postgres + 로컬 캐시 |
| **Phase 3** | 학기 후 지속 개발 | 컬렉션·자유 노트 별도 타입(검토)·음성 받아쓰기·챕터 자동 인식·수익 모델 검토 | 동일 | 동일 |

### 스택 결정 (v5 확정)

| 항목 | 선택 |
|---|---|
| 빌드 도구 | **Vite** (React+Babel CDN 폐기) |
| 모바일 wrap | **Capacitor** (Cordova 아님, RN 아님). 사유: `docs/readinggo/iOS-PLAN.md` |
| 네이티브 OCR (Phase 2+) | `@capacitor-mlkit/text-recognition` (Android ML Kit + iOS ML Kit). 디바이스 내장, **비용 0**, 한국어 지원 |
| 음성 받아쓰기 (Phase 3) | `@capacitor-community/speech-recognition` (iOS Speech + Android SpeechRecognizer). **비용 0** |
| 백엔드 | Supabase (Phase 1+) |
| 푸시 | APNs (iOS) + FCM (Android), Capacitor Push Notifications plugin (Phase 2+) |
| 호스팅 | Netlify (Vite 빌드 산출물) |

### Phase 0 제약 (Capacitor 환경)

- 외부 API 호출 없음. 책 데이터는 `docs/readinggo/data/books.tsv` 정적 로드
- 인증 없음. 닉네임은 입력만 받아 Preferences plugin (`localStorage` 호환) 저장
- NPC 활동은 시드 데이터로 시뮬레이션
- 알림 없음 (시뮬레이션 토스트)
- 다중 책 진도는 책별 분리 저장 (책 전환 시 진도 초기화 금지)
- **iOS Safari WKWebView 호환 검증**: Vite 전환 직후 iOS 시뮬레이터에서 데모 동등 동작 확인 필수
- **Safe Area + Keyboard 처리** Phase 0 단계에서 박아둠 (`@capacitor/keyboard` + safe-area-inset CSS)

### Phase 1 신규

- Supabase Auth (Google OAuth), Postgres, RLS, pg_cron 배치
- Chrome Notification API (웹 푸시 권한) + Capacitor Push Notifications (모바일 푸시)
- 클라이언트 사이드 fuzzy 검색 (Fuse.js)
- NPC 일일 활동 pg_cron 배치
- 닉네임 중복 검증 (서버), 금칙어 (LDNOOBW + 한국어 추가)
- 주간 리그 (XP 합산 개인 랭킹) — *소셜 탭 UI 노출은 v4.4 결정에 따라 보류*
- **운영자 짹 대시보드** (`/operator`) §5.6
- **Annual Rewind 골격** — 12월에 활성화될 연말 회고 화면 (`docs/readinggo/ROADMAP.md` 참조)

### Phase 2 신규

- **iOS App Store + Google Play 정식 출시** — `docs/readinggo/iOS-PLAN.md` 의 단계화된 출시 계획
- **OCR — `@capacitor-mlkit/text-recognition`** (v5 §14 기각 결정 부분 해제: 네이티브 환경 + 디바이스 내장 = 비용 0)
- **위젯** (iOS WidgetKit + Android Glance) — 오늘의 모이 / 무작위 모이 / 스트릭
- **자동 백업** — Google Drive (Android) + iCloud (iOS). 낮은 우선순위
- FCM + APNs 푸시
- NPC 다인·확장된 일과
- 챕터 자동 인식 후보 (알라딘 프리미엄 또는 사용자 OCR 결과 기반)

### Phase 3 신규 (학기 후 지속)

- Rich Text 자유 노트 — 별도 타입 신설 여부 (§13.5 안건)
- 음성 받아쓰기 (`@capacitor-community/speech-recognition`)
- 컬렉션 / 시리즈
- 태그별 통계 심화
- 챕터 자동 인식 본격화
- **수익 모델 검토** — 구독·광고·결제. 학기 후 별도 안건 (§13.6)
- T2 mini (같은 책 자동 패널) §13.2 본 설계 진입

---

## 9. Phase 0 데모 시나리오 (#58, 2026-05-16)

4분 클릭 시연. 데이터는 localStorage + 정적 TSV.

| 시간 | 화면 | 동작 |
|---|---|---|
| 0:00 | A 진입 | 슬로건 "하루 한 페이지, 한 문장에서 시작해요.", `시작하기` |
| 0:15 | C-1 검색 | 요즘 Top10 탭 표시 → "사피" 입력 → 사피엔스 fuzzy 매칭 |
| 0:30 | C-2 확인+모이 | 표지 확인, 현재 페이지 10 입력, 모이 페이지 10 + "역사는 픽션이 만든 질서다" 입력 |
| 1:00 | D-3 세리머니 | Confetti 8색, 보상 카드, "Google로 계속" CTA |
| 1:30 | H 둥지 | 둥지 진화 배너 + The Path 노드 1개 + 🔥 탭 → 달력 |
| 1:50 | 둥지 "문장 추가" | "✍️ 문장 추가" → 두 번째 문장 입력 |
| 2:05 | 날짜 이동 | 우하단 🗓 버튼으로 +1일 → Path 새 노드 가능 상태 |
| 2:20 | 마을 탭 | 3열 그리드. 카드 탭 → 친구 상세 시트 (책, 문장) |
| 2:35 | 소셜 탭 | 민트 리그 + 피드 👏🥹🔖 칩. "친구 찾기" → @reading_owl 팔로우 |
| 2:50 | 내서재 | 책 추가, 두 번째 책 등록 후 활성 책 전환 시연 |
| 3:10 | 책 상세 | 문장 타임라인 + "교보문고에서 보기 →" 링크 |
| 3:30 | 마무리 | 슬로건 |

---

## 10. 오픈 태스크

| # | 항목 | Phase |
|---|---|---|
| 1 | `docs/readinggo/index.html` Phase 0 데모 (이 스펙대로) | 0 |
| 2 | 책 100권 데이터 cover_url 보강 + TSV 정리 | 0 |
| 3 | NPC 시드 문장 2명 × 60개 작성 | 0 |
| 4 | 디자인 토큰 적용 (§11) | 0 |
| 5 | 모이 입력 화면 결정 마찰 카피 박기 ("그냥 펴진 페이지 한 줄도 좋아요") | 0 |
| 6 | 첫 7일 둥지 진화 가속 로직 (`docs/readinggo/js/nest.js`) | 0 |
| 7 | 운영자 짹 Phase 0 시드 — 시드 응답 5개 하드코딩, 자동 토스트 | 0 |
| 8 | 친구 짹 → +1 XP 적립 로직 (`docs/readinggo/js/social.js`) | 0 |
| 9 | 23:00 긴급 알림 카피 강화 ("30초만 — 한 줄만") | 0 |
| 10 | Supabase 프로젝트 셋업, 7.3 스키마 마이그레이션 (operator_replies 포함) | 1 |
| 11 | Google OAuth 연동 | 1 |
| 12 | pg_cron 스트릭/방패/NPC/리그 배치 | 1 |
| 13 | 운영자 대시보드 `/operator` 화면 + 미응답 큐 | 1 |
| 14 | `users.is_operator` 권한 부여 (Supabase admin) | 1 |
| 15 | Chrome Notification 알림 | 1 |
| 16 | 닉네임 RPC + 금칙어 사전 | 1 |
| 17 | 주간 리그 쿼리·캐시 | 1 |
| 18 | T2 mini (같은 책 자동 패널) 설계 확정 — §13 안건 (학기 후) | 1+ |
| 19 | XP destination 설계 — §13 안건 (학기 후) | 1+ |
| 20 | iOS + Android Capacitor 빌드 (`docs/readinggo/iOS-PLAN.md`) | 2 |
| 21 | FCM 푸시 + APNs | 2 |

---

