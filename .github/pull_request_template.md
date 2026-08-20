## 무엇 / 왜
<!-- 한두 줄. 무엇을, 왜 바꾸는지 (무엇을 바꿨는지는 diff가 말해준다) -->

## 변경
<!-- 핵심 변경점 -->
-

## 관련 이슈
<!-- ⚠️ CI(issue-link)가 강제 — 아래 중 하나가 본문에 없으면 빨간불(머지 차단) -->
<!-- 완료: Closes #N (머지 시 자동 close) · 관련: Refs #N · 이슈 불필요: no-issue: <사유> -->

## 스펙 동기화 (필수 — §4.1)
<!-- 코드 PR이면 아래 셋 중 하나에 체크. spec PR이면 "스펙 변경 자체" 체크 -->
- [ ] 이 PR은 **동작/계약 변경 없음** (리팩터·버그수정·문서) → 스펙 영향 없음
- [ ] 동작/계약 변경이 있고, **관련 스펙(`docs/readinggo/specs/`)을 동반 spec PR로 갱신**함 → 링크: #___
- [ ] 다른 spec·런타임까지 변경이 필요하면 **합의된 이슈 범위와 수용 기준에 포함하거나 별도 이슈·spec-only PR로 분리**함
- [ ] `spec-align` CI 통과 (새 기능은 `tests/spec-align/align_v7.py`에 invariant 추가)

## 체크리스트
- [ ] 브랜치 `<actor>/<topic-slug>` 형식 (`gyehyu/*`, `seungwon/*`, `yunji/*`; 파일·기능 전용 권한 아님, §1)
- [ ] 승원·윤지 self-merge 금지 · 최종 merge는 김계휴만 수행 (§0)
- [ ] `main` 기준 최신 (rebase 또는 `Update branch`) (§3.0)
- [ ] 1 PR = 1 논리 단위 · **spec/코드 분리** (§4·§4.1)
- [ ] **관련 이슈 연결(`Closes`/`Refs`) 또는 새 이슈 생성** (§4.2)
- [ ] 커밋 메시지 Conventional Commits (§5)
- [ ] 합의된 이슈 범위를 벗어난 파일 변경 없음(또는 별도 이슈·분리 사유 명시) (§3.5)
- [ ] `.env`·API 키·개인정보 없음 (§6)

## Hermes 감독 머지 게이트
<!-- CI green은 자동 머지 승인이 아님. contributor는 self-merge하지 않고 계휴/Hermes의 감독 머지를 기다린다. -->
- [ ] 필수 CI 전체 green 및 `main` 최신화
- [ ] Hermes가 관련 이슈, diff 범위, 테스트 증거, 미해결 대화를 확인
