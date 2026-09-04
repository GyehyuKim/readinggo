---
class: spec
maintainer: gyehyu
status: active
last_reviewed: 2026-09-05
review_cadence: milestone
---

# SYNC-POLICY — 스펙·문서·코드 동기화 정책

> 근거: #895(worktree 병렬 개발 구조) · 웹서치 검증(GitHub Spec Kit, docs-as-code, Oxide RFD, Swimm Auto-sync, 자체 `loop/spec-align-full` Ralph 루프). 우선순위: `CONTRIBUTING.md` > `CLAUDE.md` > 본 문서.

## 왜 (문제)

스펙·제품 정의(비즈니스/철학) 문서가 구현과, 그리고 서로 어긋났다. 근본 원인 = **모든 문서를 같은 방식으로 취급**한 것. 해법 = 문서를 3개 클래스로 나누고 **클래스마다 다른 동기화 계약**을 건다.

## Policy 0 — 3개 문서 클래스

모든 문서는 정확히 한 클래스에 속한다. **클래스가 "어떻게 드리프트해도 되는지"와 "누가 책임지는지"를 결정한다.**

| 클래스 | 문서 | 진실의 기준 | 동기화 계약 | DRI |
|---|---|---|---|---|
| **A. 의도 (WHY)** | MANIFESTO · pitch · whytree · `meta/decisions.md`(ADR) | *왜* 만드는가 · 제품 비전 · 결정 | **코드와 줄단위 동기화 ❌.** 마일스톤마다 리뷰. 수정은 재작성이 아니라 **개정 블록**(Google design-doc 방식). | gyehyu |
| **B. 스펙 (WHAT-should)** | `specs/*.md` | 제품이 *무엇을* 해야 하나 (코드의 계약) | **스펙 PR 먼저**(CONTRIBUTING §4.1). spec-align + 마일스톤 감사로 드리프트 체크. | 합의된 이슈의 contributor |
| **C. 실제 (WHAT-is)** | `architecture-asbuilt.md` · `_traceability.md` | 코드가 *실제로* 하는 것 | **코드에서 재생성**(as-built §12 recipe). 사실 충돌 시 **C가 이긴다.** | gyehyu / 감사 에이전트 |

**핵심 원리**: C(실제)가 구현 추적 부담을 떠안으므로 A/B는 *의도*에만 충실하면 된다. **A/B와 C의 차이 = 다음 사이클 작업 목록.** A/B가 사실에서 C와 충돌하면 C가 이기고, 의도에서는 A/B가 이긴다.

## Policy 1 — 게이트 (PR을 막는 것)

원칙(리서치 합의): **에이전트는 찾아서 제안하고, 결정적(deterministic) 체크가 빌드를 깬다.**

**현행 유지** — spec-align invariant(`tests/spec-align/`), 이슈 링크(`Closes/Refs #N`), DataStore 계약, render-smoke, biome, markdownlint.

**추가 예정**(싸고 우리 드리프트에 직격):
- **`lychee`** — `docs/**/*.md`의 삭제·이동된 스펙 링크 rot 차단.
- **`Vale` 용어 게이트** — 알려진 stale 용어 자동 적발: `Netlify`→Cloudflare, `Babel/CDN`→Vite, `마을/village`→폐기(#440), `Gemini`(구현은 solar-pro3) 등. `warn`으로 시작 → 1회 정리 후 `error`.
- **스펙+코드 동시 변경 차단** — `specs/**`와 `js/**`를 한 PR에서 같이 고치면 실패(본문에 `spec+code-exempt: <사유>` 없으면). §4.1을 honor-system에서 체크로.

## Policy 2 — 전용 sync 트랙 (worktree + 세션)

**cadence: 마일스톤(데모/베타/Phase 전환)마다 + 월 1회 최소.** per-PR은 과함(드리프트 피로), ad-hoc은 지금의 혼란을 부름.

1. **브랜치**: `gyehyu/spec-sync-<milestone>`. Hyu/Hermes가 전체 정합 감사를 조율한다.
2. **격리 worktree**: `claude --worktree spec-sync-<milestone>` — 전 코드베이스 read-sweep이 피처 작업과 안 섞이게.
3. **엔진 = 기존 Ralph 루프** `loop/spec-align-full/PROMPT.md`. 3가지 추가:
   - **Step 0**: as-built(클래스 C) 먼저 재생성(§12 grep recipe) → 사실 기준 확보 후 스펙 대조.
   - **출력**: 모든 `❌`/`🚩` 행을 GitHub 이슈로 발행(`drift:decay`/`drift:direction`/`drift:cargo-cult` 태그).
   - **클래스 A 패스**: 의도 문서는 *편집하지 않고*, as-built와 모순된 주장을 `## 동기화 리뷰 <date>` 노트로 덧붙이고 문서별 이슈 1건 발행(사람이 개정).
4. **종료 게이트**: `align_v7.py` exit 0 **and** `_traceability.md` 미분류 행 0 **and** 모든 `❌`/`🚩`에 이슈 번호 링크.
5. **산출**: 스펙-only PR(`_traceability.md` + as-built 재생성) + 발행된 이슈 묶음. **코드 수정은 합의된 이슈 범위의 actor가 별도 PR**로 수행한다.

(선택) 성숙하면 Claude Code GitHub Actions cron(`schedule: "0 9 1 * *"`)으로 월간 자동 감사 → 이슈 자동 발행.

### Policy 2.1 — 경량 Spec-to-Production 정합 감사 (#1611)

전수 감사의 단위는 문서나 코드 파일이 아니라 **사용자가 인식하는 기능 흐름**이다. `README.md`의 파일 지도를 기준으로 12~20개 흐름만 잡고, 각 흐름을 `_traceability.md`의 한 행에서 다음 순서로 판정한다.

`아이디어 → 활성 스펙 → main/DEV → Production`

| 단계 | 통과 증거 | 다음 단계로 가면 안 되는 상태 |
|---|---|---|
| **아이디어** | GitHub Issue 또는 `meta/open-issues.md`; 승인 여부 표시 | 제안·TBD를 이미 확정된 계약처럼 구현하지 않음 |
| **활성 스펙** | 기능 SSOT의 검증 가능한 계약과 승인·머지된 spec PR | 코드부터 고치거나 과거·초안 문서를 활성 계약으로 사용하지 않음 |
| **main/DEV** | 별도 구현 PR, 테스트, stable DEV `/api/release` exact SHA, 합성 fixture QA | CI green만으로 DEV QA나 제품 동작을 PASS 처리하지 않음 |
| **Production** | 보호 workflow success, Production `/api/release` exact SHA, 해당 흐름의 Production read-back/QA | 배포 버튼·workflow 시작·DEV 결과를 Production 완료 증거로 쓰지 않음 |

#### 판정 코드

- `ALIGNED`: 활성 스펙, DEV, Production이 같은 계약과 exact SHA 증거로 일치한다.
- `INTENTIONAL_GAP`: 승인된 스펙의 후속 범위이며 아직 구현하지 않기로 명시했다. drift가 아니다.
- `DECISION_NEEDED`: 아이디어 또는 TBD다. 구현하지 않고 Hyu의 제품 결정만 요청한다.
- `SPEC_DRIFT`: 구현·Production 동작은 있으나 활성 스펙이 없거나 서로 모순된다. **스펙을 사실에 맞춰 자동 변경하지 말고** 의도 확인 후 spec-only PR부터 진행한다.
- `DEV_ONLY`: 승인 스펙과 구현이 main/DEV에 있고 QA를 통과했지만 Production exact SHA/read-back이 없다. Production 승격 후보로 분리한다.
- `PROD_DRIFT`: Production이 활성 스펙 또는 승인 SHA와 다르다. P0/P1 결함으로 멈추고 수정·rollback 경로를 정한다.
- `UNVERIFIED`: 코드·SQL·workflow는 있으나 실행 증거가 없다. 존재를 PASS로 올리지 않는다.

#### 한 사이클 실행 순서

1. **기준선 고정**: `origin/main`, DEV·Production `/api/release`, 열린 PR·이슈, DB migration ledger를 읽고 감사 시점을 기록한다.
2. **기능 흐름 목록 확정**: 라우트·핵심 사용자 여정·데이터/권한·운영 배포만 포함한다. 파일별 체크리스트와 과거 이슈 연대기는 만들지 않는다.
3. **read-only 대조**: 기능 SSOT → 구현/테스트 → DEV → Production 순으로 증거를 채우고 위 판정 코드 하나를 부여한다.
4. **우선순위 지정**: 보안·개인정보·데이터 손실·Production 계약 위반=P0, 핵심 여정·DEV_ONLY=P1, 카피·문서 노후화=P2. 같은 원인의 반복 발견은 한 이슈로 묶는다.
5. **결정과 실행 분리**: `DECISION_NEEDED`만 Hyu에게 묻는다. 나머지는 근거가 있는 drift 이슈로 발행하되 감사 중 코드를 함께 고치지 않는다.
6. **순차 전달**: 필요한 경우 `아이디어 승인 → spec-only PR merge → 별도 구현 PR merge → stable DEV QA → 동일 SHA Production 승격 → Production QA`를 한 단계씩 진행한다. 앞 단계가 `PASS`가 아니면 다음 단계로 넘기지 않는다.
7. **종료**: 모든 기능 행이 `ALIGNED | INTENTIONAL_GAP | DECISION_NEEDED` 중 하나이고, `SPEC_DRIFT | DEV_ONLY | PROD_DRIFT | UNVERIFIED`는 각각 열린 이슈·owner·다음 gate를 가질 때 감사 완료다. 이슈가 모두 구현·배포될 때까지 기다리는 것은 감사 완료 조건이 아니다.

한 행의 최소 필드는 `기능 | 아이디어/결정 | 활성 스펙 | main/DEV 증거 | Production 증거 | 판정 | 이슈/다음 gate`다. 장문의 서술 대신 SHA·run·URL·테스트명·`file:line`을 링크한다. 실제 수정과 배포는 [ops.md §0·§2](./ops.md)의 권한·동일 SHA·release receipt 계약을 그대로 따른다.

## Policy 3 — 의도 문서를 살아있게 (ceremony 없이)

- **frontmatter**(클래스 A/B 전부): `class` / `status`(active·superseded·abandoned) / `last_reviewed` / `review_cadence`. 사람별 작업 배정은 문서 frontmatter가 아니라 합의된 이슈와 assignee로 관리한다.
- **마일스톤 리뷰(15분, 재작성 아님)**: DRI가 `last_reviewed` 갱신 + (a) 그대로 유효 확인, (b) 개정 블록 추가, (c) `status: abandoned` + `rejected.md` 기록 중 하나. `last_reviewed`가 현 마일스톤보다 오래되면 CI가 플래그 → *staleness가 보이게*.
- **ADR 규율**(`meta/decisions.md`): 결정된 행을 in-place 수정 ❌. 새 결정은 **번호 붙여 append**, 옛 것은 `superseded by §x` 표시(감사 추적 보존).
- **anti-bloat**(Anthropic 규칙): `CLAUDE.md`/`CONTRIBUTING.md`는 *거버넌스*지 sync 대상이 아님. 마일스톤마다 "이 줄 지우면 실수가 나나?" 테스트로 가지치기.

## 하지 말 것 (리서치 경고)

- **spec-as-source 금지** — 스펙에서 코드 생성(Tessl류)은 비용↑·비결정성(Thoughtworks). 우리는 **스펙-first + 테스트** 유지(이미 그렇게 함).
- **cargo-cult 드리프트 경계** — 아무도 실행 안 하는 화려한 스펙. `SPEC:코드 커밋 비율 1:10 = 드리프트` 휴리스틱 감시(lecture-frameworks).

## 기존 자산 매핑 (이미 80% 갖춤)

| 정책 요소 | 기존 자산 |
|---|---|
| 클래스 C SSOT | `architecture-asbuilt.md`(§11 드리프트 원장, §12 재생성 recipe) |
| 트레이서빌리티 | `_traceability.md` |
| sync 엔진 | `loop/spec-align-full/PROMPT.md`(Ralph 루프) |
| 결정적 게이트 | `tests/spec-align/` invariant |
| 드리프트 어휘 | `lecture-frameworks.md`("Drift 4 types", "3 defense patterns — pick ONE") |
