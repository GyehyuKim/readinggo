# ReadingGo — 하루 한 페이지, 한 문장에서 시작하는 독서 습관 앱

> KAIST IT경영 특수논제(AI 기반 비즈니스 진화·전략·실습) 학기 프로젝트.
> 레포명 `glocalx` — 초기 아이디어 탐색([`old/`](./old/))을 거쳐 **ReadingGo**로 수렴했다.

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

## 지금 상태 (v7 · 2026-06)

- **web-first.** Phase 0 = 순수 정적 웹 데모, Phase 1 = Supabase. 네이티브(Capacitor)는 Phase 3로 보류.
- **Phase 0 데모 완성·배포 중** — 둥지 / 마을 / 소셜 / 프로필 4탭.
- Phase 0↔1은 **DataStore 계약**([backend.md §7.2](./docs/readinggo/specs/backend.md))으로 추상화 → 어댑터 교체만으로 이행.

| Phase | 산출물 | 데이터 |
|---|---|---|
| **0** (발표용) | 정적 웹 데모 (React 18 CDN + Babel) | `localStorage` + 정적 TSV |
| **1** (MVP) | Supabase + Google 로그인 + 실 Gemini 추천 | Postgres + RLS + pg_cron |
| **2** | PWA + 웹푸시 알림 + AI 고도화 | + 로컬 캐시 |
| **3** (학기 후) | Capacitor 재검토 (OCR·STT·앱스토어) | 동일 |

---

## 데모 보기

- **온라인**: <https://readinggo.hyuniverse.workers.dev>
- **로컬**: 빌드 불필요(React 18 + Babel CDN). `books.tsv`를 `fetch`로 읽으므로 `file://` 직접 열기보다 **정적 서버** 권장:
  ```bash
  npx serve docs/readinggo
  ```
- **재배포**: `npx wrangler deploy` (Cloudflare Workers — Netlify에서 이전 완료)
- **도서 데이터**: [`docs/readinggo/data/books.tsv`](./docs/readinggo/data/books.tsv) (542권, 유일한 소스 — 코드에 책 정보 하드코딩 금지)

---

## 레포 구조

```
docs/
  readinggo/                 ← ReadingGo (현재 메인 프로젝트)
    index.html               진입점 (React 18 CDN, 빌드 없음)
    js/                       데모 코드 (data·datastore·nest·social·library·village·…)
    data/books.tsv            도서 DB 542권
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
