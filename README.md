# ReadingGo — 하루 한 페이지, 한 문장에서 시작하는 독서 습관 앱

> KAIST IT경영 특수논제(AI 기반 비즈니스 진화·전략·실습) 학기 프로젝트.
> 레포명 `readinggo` (구 `glocalx` — 초기 아이디어 탐색을 거쳐 **ReadingGo**로 수렴, 2026-06 리네임).

**🔗 라이브 데모 → <https://readinggo.hyuniverse.workers.dev>**

---

## ReadingGo가 뭔가

"읽고 싶은데 이어가지 못하는 사람"을 위한 독서 습관 앱. v17 목표:

- **마찰 최소** — 목표 페이지를 강제하지 않고 하루 한 페이지·한 문장부터 다시 책을 펼친다.
- **한 사람, 한 그루** — 사용자당 책나무 한 그루, 책당 가지 하나, 저장 문장당 나뭇잎 한 장을 영속 기록으로 보존한다.
- **비손실 성장** — 최근 14일 독서 리듬과 누적 성장일을 분리한다. 빈 날·중단·재독을 실패나 손상으로 표현하지 않는다.
- **친구 공개** — 상호 팔로우 친구에게 제한된 책 상태와 허용된 공개 문장만 서버 판정으로 보여준다. private 문장의 존재·개수·상호작용도 숨긴다.
- **폐기 대상** — XP·둥지 진화·스트릭 상실·방패·성 컬렉션을 신규 제품 보상으로 사용하지 않는다.

> 한 줄: **"하루 한 페이지, 한 문장에서 시작해요."**

제품 정의·핵심 루프·용어 사전은 **[`docs/readinggo/specs/README.md`](./docs/readinggo/specs/README.md)** (스펙 인덱스 = 정본).

---

## 지금 상태 (v17 목표 · 2026-08)

- **플랫폼 = Capacitor 채택**(런칭 결정, 2026-06). 같은 React 코드베이스로 **웹·iOS·Android 동시 출시**. 빌드는 **Vite 전환 완료**(#871 — 런타임 Babel 폐기, `main.js` 진입). *이전 web-first·Capacitor Phase 3 보류는 해제.* 상세: [`CLAUDE.md` Stack Lock](./CLAUDE.md) · [`iOS-PLAN.md`](./docs/readinggo/iOS-PLAN.md).
- **현행 as-built** — 웹·모바일 데모와 구 APK에는 XP·스트릭·둥지·broad 공개 경로가 남아 있다. 이는 v17 구현 완료가 아니라 전환·삭제 대상이다.
- **스펙 경계** — 피처별 문서는 `목표 계약 / 현행 as-built / 전환 게이트`를 분리한다. 실제 구현·DB·Production 상태는 코드와 검증된 release receipt로 확인한다.
- 저장소는 **DataStore 계약**([backend.md §7.2](./docs/readinggo/specs/backend.md))으로 추상화 → 어댑터 교체만으로 Phase 0(localStorage)↔1(Supabase) 이행.
- 책 데이터 canonical = **Supabase `books`**(#490). 구 정적 `books.tsv`는 **제거됨**(#972) — 폴백은 인라인 `RG_BOOKS`(12)뿐.

| Phase | 산출물 | 데이터 |
|---|---|---|
| **0** (데모) | 웹 데모 (React 18 · Vite 빌드) | `localStorage` + 폴백 인라인 `RG_BOOKS`(12) |
| **1** (MVP) | Supabase + Google/카카오 로그인 + Gemini 추천 | Postgres + RLS + pg_cron · canonical `books` |
| **2** | 웹푸시 알림 + AI 고도화(OCR·vision) | + 로컬 캐시 |
| **출시** | **Capacitor iOS+Android 앱스토어** (Vite 셸) | 동일 |

---

## 데모 보기

- **온라인**: <https://readinggo.hyuniverse.workers.dev>
- **로컬**: Vite dev(`cd docs/readinggo && npm run dev`) 또는 정적 서버. `file://` 직접 열기는 비권장(모듈·네트워크 fetch):
  ```bash
  npx serve docs/readinggo
  ```
- **재배포**: PR 검증 후 `main` 머지로 stable DEV를 자동 배포하고, 검증된 동일 SHA만 `promote-production.yml`에서 수동 Production 승격한다. 로컬 `npx wrangler deploy`는 정상 배포 경로가 아니다.
- **도서 데이터**: canonical = Supabase `books` (#490). 구 정적 `books.tsv`는 제거됨(#972) — 폴백은 인라인 `RG_BOOKS`(12). 코드에 책 정보 하드코딩 금지

---

## 레포 구조

```
docs/
  readinggo/                 ← ReadingGo (현재 메인 프로젝트)
    index.html               HTML 셸 (CSS 토큰·부트) — main.js 로드
    main.js                   Vite 진입 (#871) — js/* import + 마운트
    js/                       데모 코드 (data·datastore·nest·social·library·co-reading·…)
    (도서 데이터)             Supabase books — canonical (#490, 정적 TSV 제거 #972)
    specs/                    ★ 스펙 (정본) — README.md가 인덱스
    ROADMAP.md                Phase 매트릭스 + 북모리 채택 결정
    COMPETITIVE-ANALYSIS.md   경쟁자 분석 (북모리·Bookly·Fable·리더스…)
  0~4. */                    피치·리서치·스펙 원본·피어 피드백·유저 인터뷰
tests/spec-align/            스펙 ↔ 코드 정합 verifier (align_v7.py)
loop/                        Ralph 자동화 하니스
old/                         초기 아이디어 아카이브 (트렌드 패치노트·찍먹·GosiOps)
CONTRIBUTING.md              ★ 협업 규칙 (SSOT) · CLAUDE.md · AGENTS.md
```

---

## 협업 / 분배

거버넌스 SSOT = **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** (커밋·브랜치·PR·동기화 규칙). 에이전트 가이드 = [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md).

협업 역할:

| 담당 | 권한 | 영역 |
|---|---|---|
| **계휴** (gyehyu) | 구현·감독 머지 | 제품·아키텍처·통합 |
| **승원** (seungwon) | 제안·도메인 검토 | 둥지·XP 보상·디자인 |
| **윤지** (`jyj23-jeong`, yunji) | 승인 contributor | 계휴와 사전 합의된 이슈의 구현·PR |

- 브랜치: 계휴/Hermes=`gyehyu/<topic-slug>`, 윤지=`yunji/<topic-slug>`. **spec PR과 코드 PR은 분리.** contributor는 self-merge하지 않고 계휴/Hermes의 감독 머지를 거친다.
- 오픈 태스크는 GitHub Issues로 일원화 (README에 중복 관리 안 함).

---

*KAIST-IMMS · 2026 Spring · BIZ.69911 · ReadingGo*
