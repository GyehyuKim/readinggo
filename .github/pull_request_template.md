## 무엇 / 왜
<!-- 한두 줄. 무엇을, 왜 바꾸는지 (무엇을 바꿨는지는 diff가 말해준다) -->

## 변경
<!-- 핵심 변경점 -->
-

## 관련 이슈
<!-- 완료: Closes #N · 관련: Refs #N · 없으면 사유 1줄 (CONTRIBUTING §4.2) -->

## 스펙 동기화 (필수 — §4.1)
<!-- 코드 PR이면 아래 셋 중 하나에 체크. spec PR이면 "스펙 변경 자체" 체크 -->
- [ ] 이 PR은 **동작/계약 변경 없음** (리팩터·버그수정·문서) → 스펙 영향 없음
- [ ] 동작/계약 변경이 있고, **관련 스펙(`docs/readinggo/specs/`)을 동반 spec PR로 갱신**함 → 링크: #___
- [ ] 타 오너 스펙 영역이라 직접 못 고치고 **`meta/decisions.md`에 플래그 + 해당 오너에 요청**함
- [ ] `spec-align` CI 통과 (새 기능은 `tests/spec-align/align_v7.py`에 invariant 추가)

## 체크리스트
- [ ] 브랜치 `<owner>/<topic-slug>` 형식 (§1)
- [ ] `main` 기준 최신 (rebase 또는 `Update branch`) (§3.0)
- [ ] 1 PR = 1 논리 단위 · **spec/코드 분리** (§4·§4.1)
- [ ] **관련 이슈 연결(`Closes`/`Refs`) 또는 새 이슈 생성** (§4.2)
- [ ] 커밋 메시지 Conventional Commits (§5)
- [ ] 타인 오너 파일 미수정(또는 PR에 조율 사유) (§3.5)
- [ ] `.env`·API 키·개인정보 없음 (§6)
