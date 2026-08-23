# ReadingGo 문서 지도

ReadingGo의 제품·구현·연구 문서를 찾는 진입점이다. 제품 계약의 단일 정본은 [`readinggo/specs/README.md`](./readinggo/specs/README.md)이며, 이 파일은 문서 위치와 참조 규칙만 설명한다.

## 어디서 시작하나

| 목적 | 시작점 | 역할 |
|---|---|---|
| 제품 계약·용어·기능별 스펙 | [`readinggo/specs/README.md`](./readinggo/specs/README.md) | **활성 SSOT** |
| 현재 런타임 사실 | [`readinggo/specs/architecture-asbuilt.md`](./readinggo/specs/architecture-asbuilt.md) | 코드에서 확인한 as-built |
| 구현·배포 운영 | [`readinggo/specs/ops.md`](./readinggo/specs/ops.md) | DEV·Production 전달 게이트 |
| 웹·모바일 앱 코드 | [`readinggo/`](./readinggo/) | Vite·Capacitor 런타임과 Supabase migration |
| 협업 규칙 | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | 브랜치·PR·검증·권한 SSOT |

## 디렉터리 역할

| 경로 | 분류 | 사용 규칙 |
|---|---|---|
| `readinggo/specs/` | 활성 제품 문서 | 새 계약과 변경은 해당 피처 스펙에 기록한다. 파일 지도는 `specs/README.md`를 따른다. |
| `readinggo/js/`, `readinggo/android/`, `readinggo/ios/`, `readinggo/supabase/` | 구현 | 스펙의 완료 증거가 아니다. 현재 사실은 코드·migration·검증 결과로 확인한다. |
| `readinggo/research/`, `readinggo/pitch/`, `readinggo/prototypes/` | 제품 보조 자료 | 조사·피치·시안 근거다. 활성 계약과 충돌하면 스펙이 우선한다. |
| `0. pitch_and_concept/` | 초기 피치·컨셉 | 역사적·발표용 참고 자료다. |
| `1. research_and_lectures/` | 강의·리서치 | 방법론과 조사 근거다. 제품 계약이 아니다. |
| `2. specifications/` | 과거 통합 스펙·아카이브 | 현재 계약으로 인용하지 않는다. 역사적 비교가 필요할 때만 **archive**라고 표시해 링크한다. |
| `prompt-experiment-api/` | 프롬프트 실험 도구 | DEV 실험 구현이다. 제품 승격 계약은 `readinggo/specs/prompt-lab.md`를 따른다. |

## SSOT와 참조 규칙

1. 제품 결정이 충돌하면 `readinggo/specs/meta/decisions.md`의 최신 활성 결정 → 해당 피처 스펙 → 현재 구현·검증 증거 순으로 정합한다.
2. `2. specifications/`의 문서는 과거 감사 자료다. 새 문서에서 활성 요구사항의 근거로 직접 링크하지 않는다.
3. 연구·강의·피치 자료를 인용할 때는 “근거” 또는 “참고”라고 표시하고, 최종 제품 계약은 해당 피처 스펙에 적는다.
4. 저장소 내부 링크는 상대 경로를 사용한다. 공백이 있는 경로는 Markdown 링크에서 `%20`으로 인코딩한다.
5. 파일을 옮길 때는 `git mv`를 사용하고 같은 PR에서 저장소 내부 inbound 링크를 모두 갱신한다. 외부에 공개된 고정 진입점이 아니면 내용 없는 redirect 문서를 만들지 않는다.
6. 새 문서 디렉터리나 활성 스펙을 추가·삭제할 때 이 지도와 `readinggo/specs/README.md`의 파일 지도를 함께 갱신한다.

## 문서 변경 검증

```bash
npx -y markdownlint-cli2 \
  'docs/readinggo/specs/**/*.md' \
  docs/README.md README.md CONTRIBUTING.md AGENTS.md
python3 tests/spec-align/align_v7.py
```

링크 대상이 이동했다면 변경 전 경로를 저장소 전체에서 검색해 남은 참조가 없는지도 확인한다.
