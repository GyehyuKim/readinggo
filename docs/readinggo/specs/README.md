# ReadingGo 스펙 — 인덱스

> **기준**: **v7 (2026-06-01) — web-first 재정의 + v6 롤백.** 용어는 §0.5, Phase·스택은 §3, 데이터·DataStore 계약은 [backend.md](./backend.md). 분할 기반은 v6 (2026-05-28, #107 머지본)
> **분할일**: 2026-05-28
> **원본**: `docs/2. specifications/_archive/readinggo-spec.md` (1,651줄 단일 파일)을 강의 Week 11 *thin spec* 처방 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week11-spec-honest-synthesis))에 따라 피처별로 분할.
> **편집 정책**: 변경은 *해당 피처 파일* PR로. spec-only PR 룰 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.

---

## 파일 지도

| 영역 | 파일 | 다룬 절 (원 v6 spec) |
|---|---|---|
| **온보딩** | [`onboarding.md`](./onboarding.md) | [§4](./onboarding.md) 가입 여정 A~H |
| **둥지 탭** | [`nest.md`](./nest.md) | §5.1-5.4 둥지 진화·활성책·일일미션·성 컬렉션 |
| **마을** (⚠️ 폐기, #440) | [`village.md`](./village.md) | §5.5 마을 — 탭 삭제(소셜로 일원화). 이력 보존용 |
| **소셜 탭** | [`social.md`](./social.md) | [§5.7](./social.md) |
| **내서재(프로필)** | [`profile.md`](./profile.md) | [§5.8](./profile.md)-5.9 (v6: AI 도서 추천 포함) |
| **시스템 로직** | [`systems.md`](./systems.md) | §6 스트릭·방패·XP·NPC·휴식코스 |
| **백엔드** | [`backend.md`](./backend.md) | [§7](./backend.md) |
| **디자인** | [`design.md`](./design.md) | [§11](./design.md) + [§12](./design.md) |
| **메타: 여정** | [`meta/journey.md`](./meta/journey.md) | [§0.5](./meta/journey.md) |
| **메타: 결정 이력** | [`meta/decisions.md`](./meta/decisions.md) | [§8](./meta/decisions.md) 미결 → 확정 |
| **메타: 미해결** | [`meta/open-issues.md`](./meta/open-issues.md) | [§13](./meta/open-issues.md) |
| **메타: 기각** | [`meta/rejected.md`](./meta/rejected.md) | [§14](./meta/rejected.md) |

---

## 편집 정책

### 어디를 고치나
| 변경 종류 | 대상 파일 |
|---|---|
| 화면 스펙 (홈·소셜·내서재) | 해당 피처 `.md` (`nest.md`, `social.md`, `profile.md`). `village.md`는 ⚠️ 폐기(#440, 이력 보존용) |
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
[§5.5](./village.md)        ← 일반 참조
[village.md §5.5.4](./village.md#554-마을-내부-화면)  ← 정확한 앵커
```
같은 파일 내 참조는 `§X.Y` 그대로 둔다. 헤더 anchor는 GitHub 규칙 (한글 그대로, 공백 → `-`, 점·괄호 제거).

### 살아있는 spec 의무
구현 중 ① 가정이 틀림 ② 예상보다 어려움 ③ 예측 못 한 사용자 행동 발견 → **spec commit 먼저, 코드 commit 나중**. 근거: [LF: Living Document](../../1.%20research_and_lectures/lecture-frameworks.md#lf-week9-living-document).

### 파일 소유권 (v7 분배)

| 피처 파일 | owner | 비고 |
|---|---|---|
| `village.md` (마을, ⚠️ 폐기 #440) | **yunji** | 탭 삭제됨(`village.js`/`town.js` 제거). 이력 보존, spec PR은 윤지 |
| `nest.md` · `systems.md` · `design.md` | **seungwon** | 둥지·XP 보상체계·디자인 |
| `social.md` · `profile.md` · `backend.md` · `onboarding.md` | **gyehyu** | 소셜·내서재·백엔드·로그인 |
| `meta/*` · `README.md` | **gyehyu** | 결정 기록·통합 (머지 담당) |

> **SSOT 규칙**: XP 수치 = `systems.md`, 둥지 단계표 = `nest.md`, 스포일러 블라인드 = `social.md §5.7.1`. 타 파일은 복붙 말고 링크 참조.

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
| 하단 탭 | **홈 / 소셜 / 프로필** | ❌ "독서모임 / 내서재" · ❌ "둥지"(#447, 라벨만 '홈'으로 변경·내부 탭 키 `nest` 유지) · ❌ "마을"(#440, 탭 삭제 — 소셜로 일원화) |

> v7(2026-06-01) 롤백·신설. **운영자 짹 · 둥지 가속 · 주간 리그 · 결정 마찰 카피**는 폐지 ([meta/rejected.md](./meta/rejected.md)).
> v8(2026-06-14) 갱신: **마을 탭 삭제**(#440) · **하단탭 '둥지'→'홈'**(#447) · **둥지 캐릭터(NestTheatre)를 프로필로 이동**(#428) · **홈=읽기 세션 인라인**(#432·#436) · **성 컬렉션을 서재 '읽은 책' 탭으로 이동**(#429) · **상단바 칩 정리**(#425, ⚡XP·Lv만) · **체크인 세리머니 스트릭 제거 + 둥지 진척도 bar**(#426).

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

## 3. Phase 구분

**v7에서 재정의 (2026-06-01)**: Capacitor 단일 코드베이스 모델 폐기. **web-first** — Phase 0/1 은 순수 웹(반응형), 네이티브(Capacitor)는 Phase 3 으로 보류. Phase 0↔1 은 **DataStore 계약**([backend.md §7.2](./backend.md))으로 추상화되어, 어댑터 교체만으로 이행.

| Phase | 대상 | 산출물 | 백엔드 | 데이터 저장 |
|---|---|---|---|---|
| **Phase 0** | 정적 웹 데모 (발표 대상) | React 18 CDN + Babel, Netlify 배포 | **없음** | `localStorage`(`rg_v41`) + 정적 TSV |
| **Phase 1** | MVP — Supabase 연동 (반드시 도달) | 풀스택 웹. Google 로그인 · 실 데이터 · **실 Gemini AI 추천** | **Supabase** (Auth + Postgres + RLS + pg_cron) | Postgres + Storage |
| **Phase 2** | PWA 전환 + AI 고도화 | 설치형 PWA + **웹푸시 알림** · AI 추천 고도화 · AI 추출 책 | Supabase + Gemini (서버리스 프록시) | Postgres + 로컬 캐시 |
| **Phase 3** | native 재검토 (학기 후) | Capacitor 재도입 시 OCR · STT · 앱스토어 · 위젯 · 컬렉션 · 수익 모델 | 동일 | 동일 |

### 스택 결정 (v7 확정)

| 항목 | 선택 |
|---|---|
| 형태 | **순수 웹 (반응형)**. PWA·네이티브 앱 보류 |
| 빌드 도구 | 현행 **React 18 CDN + Babel** 유지. Vite 전환은 PWA 전환 시 재검토 |
| 백엔드 | Phase 0 `localStorage` / Phase 1+ **Supabase**. DataStore 계약으로 추상화 ([backend.md §7.2](./backend.md)) |
| 인증 | Supabase Auth (Google OAuth), Phase 1+ |
| AI 추천 | **Gemini Flash 무료 티어** + 서버리스 프록시 (Supabase Edge Function / Netlify Functions). Phase 1+ ([backend.md §7.9](./backend.md)) |
| 호스팅 | **Netlify** (`resilient-licorice-f4b889`) |
| 모바일·OCR·STT | **Capacitor 보류** (Phase 3 재검토). 입력 마찰은 **OS 키보드 음성입력**(폰 키보드 마이크)으로 대체 |
| 푸시 | **Phase 2 PWA 웹푸시** 이후 (Phase 0/1 알림 없음) |

### Phase 0 제약 (순수 웹)

- 외부 API 호출 없음. 책 데이터는 `docs/readinggo/data/books.tsv` 정적 로드 (**Phase 0 현재 구현** — Phase 1 canonical 전환은 #490, 아래 참조)
- 인증 없음. 닉네임은 입력만 받아 `localStorage` 저장
- NPC 활동·AI 추천은 시드/하드코딩으로 시뮬레이션
- 알림 없음 (인앱 토스트 시뮬)
- 다중 책 진도는 `user_book_id` 단위 분리 저장 (책 전환 시 진도 초기화 금지)
- 데이터 접근은 **DataStore `localStorageAdapter`** 경유 — 피처 코드에서 `localStorage` 직접 호출 금지 ([backend.md §7.2](./backend.md))

### Phase 1 신규

- Supabase Auth (Google OAuth), Postgres, RLS, pg_cron 배치
- DataStore **`supabaseAdapter` 로 교체** (피처 코드 무변경)
- `localStorage` → Supabase 동기화 (가입 전 데이터 이관, [backend.md §7.7](./backend.md))
- **책 데이터 단일 소스 = Supabase `books` (#490 결정 2026-06-15, Phase 1 SSOT)**:
  - 책 카탈로그의 canonical source 는 Supabase `books`. `getBook(id)` **동기 API** 는 부팅 시 Supabase 전체 책을 메모리 캐시에 적재해 그대로 보존(호출부 시그니처 불변).
  - **게스트 검색**도 publishable key + RLS read 로 같은 Supabase 카탈로그를 사용(로그인 불필요).
  - `books.tsv`·인라인 `RG_BOOKS` 는 **더 이상 주 데이터 소스가 아니다** — 시드 및 네트워크/부팅 실패용 **최소 폴백**으로만(근거·범위는 후속 코드 PR 에 명시).
  - **현재/목표 구분**: 위는 Phase 1 목표 상태(SSOT)다. Phase 0 현재 구현은 여전히 `localStorage` + 정적 TSV 폴백이며, **차집합 시드·코드 구현·데이터 적용은 이 결정(governance/spec) 머지 후 #490 후속 코드 PR** 에서 한다. (코드 구현 전 — trace/gap.)
- 클라이언트 사이드 fuzzy 검색 (Fuse.js)
- NPC 일일 활동 pg_cron 배치
- 닉네임 중복 검증 (서버), 금칙어 (LDNOOBW + 한국어 추가)
- **실 Gemini AI 도서 추천** — 서버리스 프록시 ([backend.md §7.9](./backend.md))

### Phase 2 신규 (PWA 전환)

- **PWA 전환** — 설치형 + service worker + **웹푸시 알림** (21:00 리마인드 등). 푸시는 이 단계부터 실동작
- **AI 도서 추천 고도화** + **AI 추출 책**
- 한 문장 → 이미지 카드 공유

### Phase 3 신규 (학기 후 — native 재검토)

- **Capacitor 재도입 검토** → OCR (`@capacitor-mlkit/text-recognition`), STT (`@capacitor-community/speech-recognition`), 앱스토어 출시, 위젯
- 컬렉션 / 시리즈
- Rich Text 자유 노트 — 별도 타입 신설 여부 ([§13.5](./meta/open-issues.md) 안건)
- **수익 모델 검토** — 구독·광고·결제. 학기 후 별도 안건 ([§13.6](./meta/open-issues.md))

---

## 9. 데모 시나리오 · 오픈 태스크 (v7 이관)

- **데모 시나리오**: v7 데모는 #124(`index.html` v7 재구현)에서 새로 작성. 구 v6 스크립트(모이·The Path·리그)는 폐기.
- **오픈 태스크**: GitHub Issues로 일원화 (저장소 Issues 탭). README에 중복 관리 안 함.

---

