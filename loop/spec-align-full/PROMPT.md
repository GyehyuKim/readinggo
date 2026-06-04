Goal: docs/readinggo/specs/ 의 모든 SSOT 스펙을 **조항(clause) 단위로 line-by-line** 훑어, 각 규범적 진술이 docs/readinggo/js/ (+ netlify/functions/, supabase/) 코드의 어디에 어떻게 구현됐는지 **추적 매트릭스**(docs/readinggo/specs/_traceability.md)로 1:1 매칭하고, 어긋난 코드를 스펙에 정합시킨다. 매칭 안 되는 조항은 (구현 누락) 또는 (스펙이 모호/과다) 로 분류해 처리한다.

Source (스펙 정본 — 이 순서로 한 파일씩 완주):
- docs/readinggo/specs/meta/decisions.md (§8 결정 이력 — 충돌 시 최신 §이 우선; 매칭의 기준 컨텍스트)
- docs/readinggo/specs/nest.md (§5.1-5.5)
- docs/readinggo/specs/social.md (§5.6-5.7)
- docs/readinggo/specs/profile.md (§5.8-5.9)
- docs/readinggo/specs/village.md (§5.5 마을)
- docs/readinggo/specs/systems.md (§6 스트릭·XP·휴식)
- docs/readinggo/specs/onboarding.md (§4 가입 여정)
- docs/readinggo/specs/backend.md (§7 DataStore 계약·데이터 모델)
- docs/readinggo/specs/design.md (디자인 토큰·컴포넌트)
구현측: docs/readinggo/js/*.js, docs/readinggo/index.html(CSS), netlify/functions/aladin.js, docs/readinggo/supabase/*.sql

Output:
- docs/readinggo/specs/_traceability.md (신규/갱신) — 스펙 파일별 표:
  | 조항(§·줄/제목) | 규범 요지 | 구현 위치(file:func 또는 line, refer 허용) | 상태 |
  상태 = ✅구현됨 / 🔧이번에 코드수정해 정합 / ❌구현누락(이슈화) / 🚩스펙수정필요(BLOCKED) / ⏳Phase미도래(의도된 미구현)
- 코드 수정: 스펙과 어긋난 구현만 정합 (스펙 자체는 수정 금지 — 모호하면 BLOCKED).
- ❌구현누락은 gh issue 로 등록하고 매트릭스에 이슈번호 적기.

Exit: 아래 둘 다 만족하면 loop/spec-align-full/DONE 파일을 빈 내용으로 생성한다.
1. `python tests/spec-align/align_v7.py` exit 0 (33/33 유지 또는 추가 invariant 포함 전부 통과).
2. _traceability.md 가 위 9개 SSOT 파일을 **모두** 포함하고, 모든 조항이 ✅/🔧/❌(이슈번호 명시)/🚩(BLOCKED.md 명시)/⏳ 중 하나로 분류돼 미분류(빈칸) 행이 0.

Blocked (loop/spec-align-full/BLOCKED.md 에 누적 기록 후, 막힌 조항만 건너뛰고 계속 — 전체를 멈추지 말 것):
- 스펙이 모호/두 해석 가능 → (a) 파일·절 (b) 해석 2개+ (c) 추천 해석.
- 스펙 수정 필요(코드가 더 옳거나, 스펙이 과다/구식) → 어느 절을 어떻게 바꿀지 제안. 사용자가 별도 spec-only PR로 처리.
- 타 owner 영역(nest/systems/design=승원, village=윤지)이라 코드 정합이 경계를 넘으면 → 어느 cross-owner 변경이 필요한지 명시 + decisions.md 플래그 제안만.

Constraints:
- React 18 + Babel standalone CDN. 빌드 도구·새 라이브러리 금지 (CLAUDE.md Stack Lock).
- 각 파일 끝 `window.X = X` export 규약 유지. 상태=Supabase(Phase 1) / localStorage(rg_v41, Phase 0) 양 어댑터 대칭.
- spec-only PR 룰: 본 loop 는 *코드 + _traceability.md 만* 변경. 스펙 본문(.md SSOT) 수정이 필요하면 BLOCKED.md 로 넘긴다.
- 배포·SQL 실행 금지. `.sql` 새로 필요하면 파일만 작성하고 "적용은 사용자" 명시.
- 본 PROMPT.md, tests/spec-align/*, loop/* 디렉토리는 변경 금지.
- 매 코드 수정 후 babel 파스 OK 확인: `node "C:\Users\Hyu\AppData\Local\Temp\rg-babel\check.js" "docs/readinggo/js"` → ALL PARSE OK.
- 커밋은 한 문장 단위 + Co-Authored-By 트레일러 (CONTRIBUTING §5). PR 본문엔 Closes/Refs #N (issue-link 게이트).

Verification self-check (매 iteration):
- align_v7.py 통과 유지(깨면 그 조항 정합 롤백).
- _traceability.md 새 행의 구현 위치가 실제로 존재하는지 grep 으로 확인(추측 금지 — 보고 전 검증 §).
- ❌/🚩 행은 반드시 이슈/BLOCKED.md 로 후속이 걸려 있는지.
- 진행률을 BLOCKED.md 상단에 "N/9 파일 완료" 로 기록(중단·재개 대비).
