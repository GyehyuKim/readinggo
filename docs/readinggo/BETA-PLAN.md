# ReadingGo — 클로즈베타 빌드 플랜 (6/7 런칭)

> **목표**: 2026-06-07 **클로즈베타** — 지인 대상 실배포. Phase 0(정적 데모) 종료 → **Phase 1(Supabase 실서비스)** 진입.
> **데드라인**: 하드(6/7). 작성 2026-06-02 (**D-5**).
> **분담**: 계휴 = 백엔드 올인 · 승원·윤지 = 피처.
> 베타 후 = 지인 피드백 반영 + 깎기. 상세는 [specs/README](./specs/README.md) · 데이터·계약 [backend.md](./specs/backend.md).

---

## 0. ⚡ D-5 오늘 — 사람이 직접 해야 할 프로비저닝 (막히면 백엔드 전체가 막힘)

코드로 못 하는 계정·키 발급. **계휴가 오늘 중:**

- [ ] **Supabase 프로젝트** 생성(free tier) → `SUPABASE_URL` · `anon key` 확보
- [ ] **Google Cloud OAuth 클라이언트**(웹) 생성 → Supabase Auth Google provider에 client ID/secret 등록 + redirect URL 설정
- [ ] **알라딘 TTBKey** 발급 (OpenAPI 신청, 무료)
- [ ] **Netlify 환경변수** 세팅 (Supabase keys; **알라딘 키는 Netlify Functions 안에만** — 클라 노출 금지)

> 이 4개가 백엔드 작업의 선행. 발급되면 알려주면 스키마 SQL·어댑터·프록시 코드는 작성. **지금 즉시 시작 가능한 건 §3 B4(UI→DataStore 마이그레이션) — 외부 의존 0.**

---

## 1. 분담

| 담당 | 영역 |
|---|---|
| **계휴** | Supabase(스키마·RLS·Auth) · supabaseAdapter · **UI→DataStore 마이그레이션** · 가입 전 동기화 · onboarding 배선 · 실 소셜 · 알라딘 프록시 · 배포 |
| **승원** | 반별점 별UI(세리머니) · 한 문장 강제 확정 · activeBook 시트 · design.md v7 정리 · 둥지 표현 폴리시 |
| **윤지** | 마을 #140 QA·머지 + 실데이터 점검(생성/초대/참여) |

---

## 2. 임계경로 (계휴)

```
프로비저닝 ─→ 스키마+RLS ─→ supabaseAdapter ┐
              UI→DataStore 마이그레이션 ─────┼─→ OAuth + onboarding 가입흐름 ─→ 가입 전 동기화
                                            └─→ 실 소셜(피드·짹·팔로우)
알라딘 프록시 (병렬) ─→ 임의 책 등록
                          전부 ─→ 배포(env) ─→ 실기기 QA ─→ 런칭
```

> **최대 리스크 = UI→DataStore 마이그레이션.** 지금 UI가 `INITIAL_*` 전역을 직접 읽어, supabaseAdapter로 바꿔도 화면이 안 바뀜. 이걸 먼저 끝내야 "실데이터"가 의미를 가짐. (감사 근거: 렌더 계층이 DataStore 미사용)

---

## 3. 작업 분해

### 🔴 MUST — 런칭 블로커

| # | 작업 | 담당 | 의존 | 규모 |
|---|---|---|---|---|
| B1 | Supabase 스키마 SQL ([backend §7.3](./specs/backend.md) 테이블+인덱스) | 계휴 | 프로비저닝 | M |
| B2 | RLS 정책 ([§7.5](./specs/backend.md)) | 계휴 | B1 | S |
| B3 | supabaseAdapter (DataStore [§7.2](./specs/backend.md) 계약 구현) | 계휴 | B1 | L |
| B4 | **UI→DataStore 마이그레이션** (library/social/nest/profile 읽기 전부 DataStore 경유) | 계휴 | 없음(**즉시**) | L |
| B5 | Google OAuth (Supabase Auth) | 계휴 | 프로비저닝 | M |
| B6 | onboarding.js 로드 + 부팅 게이트 + 가입 흐름 | 계휴 | B5 | M |
| B7 | 가입 전 데이터 동기화 ([§7.7](./specs/backend.md)) | 계휴 | B3·B6 | M |
| B8 | 실 소셜: 피드·짹·팔로우 크로스유저 | 계휴 | B3 | M |
| B9 | 알라딘 프록시(Netlify Fn) + 임의 책 등록 | 계휴 | 프로비저닝 | M |
| B10 | 배포(env) + 실기기 smoke QA | 전원 | 위 전부 | M |
| F1 | 반별점 별UI(0.5) — 세리머니 | 승원 | 없음 | M |
| V1 | 마을 #140 QA·머지 + 실데이터 점검 | 윤지 | B3 | M |

### 🟡 SHOULD — 베타 목표, 첫 슬립 대상

무작위 회상(계휴/승원, S) · 한 문장 사후 감상 편집(계휴, M) · 타인 책장 진입로(계휴, M) · design.md v7 정리(승원, S) · 한 문장 강제 확정(승원, S)

### ⚪ DEFER — 베타 후 피드백+깎기

AI 추천/추출(Gemini) · Export · 책삭제 · 컬렉션/시리즈 · 통계/목표/타이머 · 친구찾기 고도화 · 다크모드/이미지카드

---

## 4. Graceful degradation (밀리면 이 순서로 양보)

1. **알라딘 늦음** → 542권 TSV로 런칭, 임의 책 추가는 핫픽스
2. **실 소셜 늦음** → 피드만 실데이터, 팔로우/마을은 핫픽스
3. **onboarding 늦음** → 구글 로그인 + 간이 닉네임만

> **절대 사수**: 구글 계정 로그인 + 핵심 루프(기록→둥지→완독) + 데이터 영속. ← 이게 "진짜 베타"의 최소선. 이게 안 되면 베타가 아니라 데모임.

---

## 5. 메모

- **pg_cron**(스트릭/NPC 배치)은 SHOULD — 베타엔 NPC 시드 최소, 스트릭은 로그인 시 클라 보정 가능.
- **날짜 시뮬레이터**(Phase 0 발표용)는 베타에선 끔(실시간).
- 모든 백엔드 접근은 **DataStore 경유 강제**([§7.2](./specs/backend.md)) — 베타 코드도 위반 금지.
- 관련 PR: #140(마을 이식) · #141(스펙 정합성). 둘 다 베타 전 머지 권장.

---

*2026-06-02 · D-5 · 계휴 초안. 베타 진행하며 갱신.*
