# ReadingGo — 하루 한 페이지, 한 문장에서 시작하는 독서 습관 앱

> KAIST IT경영 특수논제(AI 기반 비즈니스 진화·전략·실습) 학기 프로젝트.
> 레포명 `readinggo` (구 `glocalx` — 초기 아이디어 탐색([`old/`](./old/))을 거쳐 **ReadingGo**로 수렴, 2026-06 리네임).

**🔗 라이브 데모 → <https://readinggo.hyuniverse.workers.dev>**

---

## ReadingGo가 뭔가

"읽고 싶은데 이어가지 못하는 사람"을 위한 독서 습관 앱. 핵심 wedge:

- **마찰 최소** — 타이머·목표 페이지 없음. 하루 **1페이지만** 읽어도 오늘은 성공
- **한 문장** — 오늘 읽은 책에서 마음에 든 한 문장을 적는 행위가 *읽음의 증명*이자, 누적되는 나만의 자산
- **게이미피케이션 + 소셜** — 스트릭·방패·**둥지가 자란다**(진척률 5단계)·완독 **성(🏰) 컬렉션** + 단방향 팔로우·**마을**·**짹**(좋아요)
- **한국 시장 + 무광고** — 북모리·Bookly·Fable이 비워 둔 *"고-게이미피케이션 × 고-소셜 × 한국 × 1페이지"* 좌표

> 한 줄: **"하루 한 페이지, 한 문장에서 시작해요."**

제품 정의·핵심 루프·용어 사전은 **[`docs/readinggo/specs/README.md`](./docs/readinggo/specs/README.md)** (스펙 인덱스 = 정본).

---

## 지금 상태 (v8 · 2026-07)

- **플랫폼 = Capacitor 채택**(런칭 결정, 2026-06). 같은 React 코드베이스로 **웹·iOS·Android 동시 출시**. 빌드는 **Vite 전환 완료**(#871 — 런타임 Babel 폐기, `main.js` 진입). *이전 web-first·Capacitor Phase 3 보류는 해제.* 상세: [`CLAUDE.md` Stack Lock](./CLAUDE.md) · [`iOS-PLAN.md`](./docs/readinggo/iOS-PLAN.md).
- **Phase 0 데모 배포 중** — 둥지 / 마을 / 소셜 / 프로필 4탭.
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
- **재배포**: `npx wrangler deploy` (Cloudflare Workers — Netlify에서 이전 완료)
- **도서 데이터**: canonical = Supabase `books` (#490). 구 정적 `books.tsv`는 제거됨(#972) — 폴백은 인라인 `RG_BOOKS`(12). 코드에 책 정보 하드코딩 금지

---

## 레포 구조

```
docs/
  readinggo/                 ← ReadingGo (현재 메인 프로젝트)
    index.html               HTML 셸 (CSS 토큰·부트) — main.js 로드
    main.js                   Vite 진입 (#871) — js/* import + 마운트
    js/                       데모 코드 (data·datastore·nest·social·library·village·…)
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

스펙 파일 소유권 (v7):

| 담당 | 파일 | 영역 |
|---|---|---|
| **계휴** (gyehyu) | `social.md` · `profile.md` · `backend.md` · `onboarding.md` · `meta/*` · `README.md` | 소셜·내서재·백엔드·로그인·통합·머지 |
| **승원** (seungwon) | `nest.md` · `systems.md` · `design.md` | 둥지·XP 보상·디자인 |
| **윤지** (yunji) | `village.md` | 마을 |

- 브랜치: `<owner>/<topic-slug>`. **spec PR과 코드 PR은 분리.** 머지는 계휴가 GitHub 웹에서.
- 오픈 태스크는 GitHub Issues로 일원화 (README에 중복 관리 안 함).

---

*KAIST-IMMS · 2026 Spring · BIZ.69911 · ReadingGo*
