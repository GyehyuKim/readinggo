# ReadingGo 스펙 — 인덱스

> **기준**: 이 디렉터리는 ReadingGo의 살아있는 SSOT다. 충돌 시 `meta/decisions.md`의 가장 최신 활성 결정 → 해당 기능 스펙 → 현재 구현·검증 증거 순으로 정합하며, 과거 v5~v16 설명은 감사 이력이지 현재 계약이 아니다.
> **구현 사실 기준**: 현재 런타임은 [architecture-asbuilt.md](./architecture-asbuilt.md), 기능별 구현 상태와 갭은 [_traceability.md](./_traceability.md)를 따른다.
> **원본**: `docs/2. specifications/_archive/readinggo-spec.md` 단일 문서를 2026-05-28 피처별로 분할했다. 아카이브는 현재 계약으로 사용하지 않는다.
> **편집 정책**: 변경은 해당 피처 파일의 spec-only PR로 먼저 승인·머지한다. 코드·DEV·Production·스토어 작업은 승인된 스펙 이후에만 진행한다.

---

## 파일 지도

| 분류 | 파일 | 현재 역할 |
|---|---|---|
| **제품 코어** | [`onboarding.md`](./onboarding.md) | 첫 진입·책 등록·세계관 구체화·가입 여정 |
|  | [`nest.md`](./nest.md) | 홈·읽기·기존 둥지/목표 책나무 화면 계약. 경로는 호환을 위해 유지 |
|  | [`profile.md`](./profile.md) | 프로필·내 서재·책 상태·문장 탐색 |
|  | [`feed.md`](./feed.md) | 피드·친구 책나무·공개 문장·UGC 안전 |
|  | [`co-reading.md`](./co-reading.md) | 같이읽기 기능과 읽기방 |
|  | [`companion.md`](./companion.md) | AI 독서 동반자 대화·완독 회고 |
|  | [`systems.md`](./systems.md) | 성장일·레거시 스트릭·XP 전환·NPC 시스템 |
| **기록·탐색** | [`resurface.md`](./resurface.md) | 저장 문장 되감기 |
|  | [`share.md`](./share.md) | 문장 외부 공유 카드 |
|  | [`barcode-scan.md`](./barcode-scan.md) | ISBN 스캔 책 등록 |
|  | [`integrated-shelf.md`](./integrated-shelf.md) | 서가 복원·검토함·시드 문장 |
|  | [`flexible-import.md`](./flexible-import.md) | 텍스트·파일 도서 기록 임포트 |
|  | [`referral.md`](./referral.md) | 서비스 공유·referral 초안 |
| **데이터·AI** | [`backend.md`](./backend.md) | 플랫폼·인증·DataStore·스키마·RLS |
|  | [`architecture-asbuilt.md`](./architecture-asbuilt.md) | 코드에서 역생성한 현재 런타임 사실 |
|  | [`analytics.md`](./analytics.md) | 이벤트·지표·동의·주간 리포트 |
|  | [`prompt-lab.md`](./prompt-lab.md) | DEV 전용 프롬프트 실험·승격 계약 |
|  | [`seed-collector.md`](./seed-collector.md) | 시드 문장 수집기 |
| **운영·출시** | [`ops.md`](./ops.md) | 스펙→코드→DEV→Production 전달 게이트 |
|  | [`ota.md`](./ota.md) | 웹 번들 OTA와 네이티브 버전 경계 |
|  | [`admin-dashboard.md`](./admin-dashboard.md) | 운영자 지표·검토 표면 |
|  | [`inquiry-sync.md`](./inquiry-sync.md) | 문의 직접 대응 정책 |
|  | [`SYNC-POLICY.md`](./SYNC-POLICY.md) | 스펙·코드 드리프트 방지 정책 |
| **디자인·법무** | [`design.md`](./design.md) | 토큰·컴포넌트·접근성·마이크로카피 |
|  | [`privacy-policy.md`](./privacy-policy.md) | 개인정보처리방침 정본·게시 |
|  | [`legal-copyright.md`](./legal-copyright.md) | 문장 인용·공개·시드 저작권 경계 |
| **내부 구조** | [`refactor-modularize.md`](./refactor-modularize.md) | 모듈화 구조와 안전한 리팩터링 |
|  | [`_traceability.md`](./_traceability.md) | 스펙별 구현 증거·결정 갭 매트릭스 |
| **메타** | [`meta/decisions.md`](./meta/decisions.md) | 시간순 제품 결정과 supersede 관계 |
|  | [`meta/open-issues.md`](./meta/open-issues.md) | 실제 미결정·미구현 안건 |
|  | [`meta/rejected.md`](./meta/rejected.md) | 의도적으로 기각한 방향 |
|  | [`meta/journey.md`](./meta/journey.md) | v5/v6까지의 역사적 여정 |

---

## 편집 정책

### 어디를 고치나
| 변경 종류 | 대상 파일 |
|---|---|
| 화면 스펙 (홈·소셜·내서재) | 해당 피처 `.md` (`nest.md`, `feed.md`, `profile.md`) |
| 가입 여정 | `onboarding.md` |
| 시스템 로직 (스트릭·방패·XP·NPC·휴식코스) | `systems.md` |
| 데이터 모델·플랫폼 | `backend.md` |
| 디자인 토큰·마이크로카피 | `design.md` |
| 한 줄·약속·핵심 루프·Phase·데모·태스크 | 이 `README.md` |
| 새 결정 등록 | `meta/decisions.md` 표 갱신 |
| 미해결 안건 추가 | `meta/open-issues.md` |
| 의도적 기각 보존 | `meta/rejected.md` |

### PR 룰
- **spec PR과 코드 PR을 분리.** spec PR 먼저 머지 → 코드 PR 별도. 근거: [LF: Spec only PR](../../1.%20research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr).
- **여러 파일 동시 변경**은 *논리적으로 한 변경*일 때만 허용. 관련 없는 두 피처는 두 PR.
- **본 README의 파일 지도**는 *피처 추가·삭제* 시만 갱신. 일반 변경은 갱신 불요.

### Cross-file 참조 규칙
다른 spec 파일을 가리킬 때:
```markdown
[§5.6](./co-reading.md)        ← 일반 참조
[co-reading.md §5.3](./co-reading.md#53-방-내부-화면)  ← 정확한 앵커
```
같은 파일 내 참조는 `§X.Y` 그대로 둔다. 헤더 anchor는 GitHub 규칙 (한글 그대로, 공백 → `-`, 점·괄호 제거).

### 살아있는 spec 의무
구현 중 ① 가정이 틀림 ② 예상보다 어려움 ③ 예측 못 한 사용자 행동 발견 → **spec commit 먼저, 코드 commit 나중**. 근거: [LF: Living Document](../../1.%20research_and_lectures/lecture-frameworks.md#lf-week9-living-document).

### 파일 소유권 (v7 분배)

| 피처 파일 | owner | 비고 |
|---|---|---|
| `nest.md` · `systems.md` · `design.md` | **seungwon** | 둥지·XP 보상체계·디자인 |
| `feed.md` · `profile.md` · `backend.md` · `onboarding.md` | **gyehyu** | 소셜·내서재·백엔드·로그인 |
| `meta/*` · `README.md` | **gyehyu** | 결정 기록·통합 (머지 담당) |

> **SSOT 규칙**: XP 수치 = `systems.md`, 둥지 단계표 = `nest.md`, 스포일러 블라인드 = `feed.md §5.7.1`. 타 파일은 복붙 말고 링크 참조.

---

## 0. 한 줄

> "하루 한 페이지, 한 문장에서 시작해요."

*(내부 컨셉 레퍼런스: "독서습관 앱계의 Duolingo" — 외부 노출 불가. v5 부터 게이미피케이션 세부 설계는 Duolingo 벤치마킹을 의도적으로 끊고 ReadingGo 고유 컨텍스트에서 발상.)*

---

## 0.5 용어 사전 (v7 — 정본)

전 spec 파일이 이 표를 따른다. 변경 시 이 표를 먼저 갱신.

| 개념 | 정식 명칭 | 폐기어 / 비고 |
|---|---|---|
| 일일 기록 콘텐츠 | **한 문장** (오늘 작성분 = "오늘의 문장") | ❌ "모이". DB 테이블 `sentences` 유지 |
| 좋아요 리액션 | **짹** (한 문장에 +1 토글) | ❌ "박수 / 👏🥹🔖 3종" |
| 독려 넛지 (미기록 친구) | **콕찌르기** (🪱) | ❌ "모이 보내기". DB `pokes` |
| 둥지 진행 시각화 | **둥지가 자란다** (누적 XP 5단계, [nest.md §5.2](./nest.md)) | ❌ "The Path / 세션 노드" |
| 누적 성취 | **성(🏰) 컬렉션** (= 완독 권수, 파생) | v7 신설 |
| 하단 탭 | **홈 / 함께 / 둥지 / 프로필 / 설정** 5개 목적지 | PR #1366. 내부 키 `nest`/`social`/`nest-grow`/`profile`/`settings`. 마을 탭은 폐기 상태 유지 |

> v7(2026-06-01) 롤백·신설. **운영자 짹 · 둥지 가속 · 주간 리그 · 결정 마찰 카피**는 폐지 ([meta/rejected.md](./meta/rejected.md)).
> v8(2026-06-14) 갱신: **마을 탭 삭제**(#440) · **하단탭 '둥지'→'홈'**(#447) · **둥지 캐릭터(NestTheatre)를 프로필로 이동**(#428) · **홈=읽기 세션 인라인**(#432·#436) · **성 컬렉션을 서재 '읽은 책' 탭으로 이동**(#429) · **상단바 칩 정리**(#425, ⚡XP·Lv만) · **체크인 세리머니 스트릭 제거 + 둥지 진척도 bar**(#426).
> v8.4(2026-06-23, #877) 정합: 하단 탭 라벨 **소셜→피드**(#639) · **프로필→책장**. 설정은 목적지 탭이 아니라 바텀시트 액션(#567).
> v9(2026-07-30, PR #1366): 하단 탭을 **홈/함께/둥지/프로필/설정**으로 재편. v8.4의 책장 라벨과 설정 액션 계약을 대체한다.

---

## 1. 제품 약속

| 사용자가 얻는 것 | 제품이 책임지는 것 |
|---|---|
| 하루 1페이지 이상 읽는 습관 형성 | 듀오링고 수준의 지속성 엔진 (스트릭·방패·복귀) |
| 읽은 책의 핵심을 손에 남긴다 | "오늘의 문장" 누적 → 책 한 권의 엑기스 → Markdown export |
| 혼자가 아니라 같이 읽는다 | 단방향 팔로우 + 소셜 피드(같은 책 둥지 시각화) + 짹 + NPC 동행 |

타겟: **읽고 싶은데 이어나가지 못하는 사람**. 안 읽는 사람을 끌어오는 제품 아님.

### 1.1 왜 책 / 왜 페이지

- 모두가 하고 싶어하는 행동 — "더 읽고 싶다"는 보편적 욕구
- 최소한의 정량화가 가능한 유일한 일상 카테고리 — 1페이지가 명확한 진척 단위

### 1.2 슬로건

> **"하루 한 페이지, 한 문장에서 시작해요."**

UI 상 진입 화면 헤더·로그인 화면·온보딩 카피에서 일관되게 사용.

---

## 2. 핵심 루프

```
[책 등록] (여러 권 가능, 1권을 "활성 책"으로 지정)
   ↓
[앱 밖에서 읽기 — 하루 1페이지 이상이면 충분]
   ↓
[일일 미션: 활성 책의 현재 페이지 입력 + 한 문장 입력(둘 다 강제)]
   ↓
[스트릭 갱신 → XP 보상 → 둥지가 자람(누적 XP 5단계) / 완독 시 🏰 1개]
   ↓
[소셜 피드에 친구 둥지 불빛 ON, 한 문장 노출 → 짹]
   ↓
[리마인드 알림(Phase 2 PWA 이후). 미참여 시 스트릭만 위기 — 둥지·XP는 존속]
```

**목표 페이지 설정 없음.** 부담을 없애는 게 핵심 — 1페이지만 읽어도 오늘은 성공.

### 2.1 핵심 체크인 트리거

**"한 문장" 입력 (강제, 200자 이내).** *(오늘 읽은 책에서 마음에 든 한 문장을 그대로 옮겨 적은 짧은 인용구. 오늘 작성분은 "오늘의 문장". DB 테이블명은 `sentences` 유지.)*

페이지 입력만으로는 읽음을 검증할 수 없다. 한 문장을 직접 적는 행위가 (a) 읽음의 증명이며 (b) 사용자에게 누적되는 자산이 된다.

### 2.2 이탈 방어선

- **스트릭 lock-in** — 끊기지 않은 연속일이 머무를 이유
- **누적 문장 export** — 떠나도 가져갈 수 있다는 신뢰가 lock-in의 윤리적 부담 상쇄

---

## 3. 현재 런타임과 Phase 구분

> **정합 갱신 (2026-07, #1289)**: 현재 배포 코드는 **Vite 빌드 + Capacitor 단일 코드베이스 + Cloudflare Workers**를 사용한다. 과거의 "React CDN+Babel·Netlify·Capacitor Phase 3 보류"는 v7 당시 결정 기록이며 활성 구현 규범이 아니다. Phase는 플랫폼 전환 순서가 아니라 기능·운영 범위를 설명한다. 사실 기준은 [architecture-asbuilt.md](./architecture-asbuilt.md), 변경 이력은 [decisions.md](./meta/decisions.md)다.

| 범위 | 현재 상태 | 클라이언트·배포 | 데이터 경로 |
|---|---|---|---|
| **게스트/데모 경로** | 현재 제공 | Vite 산출물(`dist`)을 웹·Capacitor 셸이 공유, Cloudflare Workers assets 배포 | `localStorageAdapter`(`rg_v41`) + Supabase `books` 공개 카탈로그, 장애 시 인라인 `RG_BOOKS` 폴백 |
| **로그인 MVP 경로** | 현재 제공 | 같은 Vite·Capacitor 번들, Google/Kakao/Apple(지원 환경) OAuth | `supabaseAdapter` + Auth/Postgres/RLS, 게스트 데이터 이관 |
| **후속 제품 범위** | 별도 결정·이슈 선행 | 웹푸시·위젯·수익 모델·새 네이티브 라이브러리 | 기능별 설계와 운영 비용 검토 후 확정 |

### 스택 결정 (현재 활성)

| 항목 | 선택 |
|---|---|
| 형태 | **반응형 웹 + Capacitor iOS/Android 셸**. 같은 React 코드베이스를 공유 |
| 빌드 도구 | **Vite**. `main.js`의 모듈 import 순서와 `npm run build` 산출물 `dist/`가 런타임 계약 |
| 백엔드 | 로그인 여부에 따라 `localStorageAdapter` / **Supabase**를 DataStore 계약으로 전환 ([backend.md §7.2](./backend.md)) |
| 인증 | Supabase Auth (Google · Kakao · Apple 지원 환경) |
| AI | Cloudflare Worker 서버 보관 키. 텍스트는 solar-pro3, vision은 Gemini를 현재 사용([architecture-asbuilt.md §11](./architecture-asbuilt.md)) |
| 호스팅 | **Cloudflare Workers** — prod `readinggo`, 별도 dev `readinggo-dev` (#1303, 승격 규칙은 [ops.md §2](./ops.md)) |
| 모바일·OCR·STT | Capacitor는 현재 채택. 웹 OCR은 Worker 경유로 제공하며, 새 네이티브 플러그인·STT는 Stack Lock 별도 결정 |
| 푸시 | 프로덕션 사용자 알림 채널·운영 정책은 별도 이슈에서 확정. 단순히 "Phase 2 PWA 이후"로 가정하지 않음 |

### 현재 데이터·기능 경계

- 책 데이터 canonical = Supabase `books`(#490). 게스트도 anon RLS read를 쓰며 구 정적 `books.tsv`는 제거됨(#972); 장애 시 인라인 `RG_BOOKS`(12)만 폴백한다.
- 미로그인 사용자는 `localStorageAdapter`로 기능을 계속 쓰고, 로그인 사용자는 `supabaseAdapter`로 전환한다. 데이터 접근은 항상 **DataStore** 경유이며 피처 코드의 직접 저장소 호출은 금지한다 ([backend.md §7.2](./backend.md)).
- 다중 책 진도는 `user_book_id` 단위로 분리한다. 책 전환이 진도를 초기화하면 안 된다.
- NPC·추천·알림 등은 각각의 구현 상태와 운영 여부를 해당 feature spec 및 GitHub Issue로 관리한다. Phase 라벨만으로 구현 여부를 추정하지 않는다.

---

## 9. 데모 시나리오 · 오픈 태스크 (v7 이관)

- **데모 시나리오**: v7 데모는 #124(`index.html` v7 재구현)에서 새로 작성. 구 v6 스크립트(모이·The Path·리그)는 폐기.
- **오픈 태스크**: GitHub Issues로 일원화 (저장소 Issues 탭). README에 중복 관리 안 함.

---
