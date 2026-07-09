# COLLAB.md — 팀 커뮤니케이션 / Slack 채널 운영 가이드

> 이 문서는 실시간·비동기 소통(#readinggo Slack)의 운영 원칙을 정한다.
> 협업 규율의 단일 진실 소스는 여전히 [`CONTRIBUTING.md`](../../CONTRIBUTING.md)이며, 이 문서는 그 위의 얇은 실시간 레이어를 정의한다.
> 우선순위: `CONTRIBUTING.md` > `CLAUDE.md` > `AGENTS.md` > 이 문서.

## 0. 핵심 전제 — Slack은 GitHub를 복제하지 않는다

ReadingGo의 협업은 이미 GitHub 중심으로 규율화되어 있다: 이슈-퍼스트(§4.2), owner 분담(gyehyu/seungwon/yunji), P0/P1/P2 라벨, 마일스톤 트리아지, spec-PR/code-PR 분리. Slack이 메꿀 공백은 **실시간·비동기 소통 하나뿐**이다.

- **GitHub = 진실 소스** — 무엇을·왜·상태. 확정된 작업은 반드시 이슈.
- **Slack = 얇은 실시간 레이어** — 의사결정·조율·알림.
- 작업 트래킹을 Slack에 이중으로 두지 않는다. 반사적으로 "이건 이슈로 열자".

## 1. Slack에서 하는 것 / GitHub에서 하는 것

| Slack #readinggo | GitHub |
|---|---|
| "이거 이슈로 열까 말까" 빠른 합의 | 확정된 태스크 = 이슈 |
| owner 경계 넘는 파일 수정 사전 조율(§3.5) | PR 리뷰·승인·머지 |
| 팀미팅 필요 결정 소집 | 결정 결과 = `specs/meta/decisions.md` |
| P0 보안/배포 알림, "지금 머지해도 돼?" | 스펙 논의 상세 |
| 마일스톤 트리아지·데모 D-day 리듬 | 이슈 라벨(P0/P1/P2) |

## 2. 채널 컨벤션

- **owner 프리픽스**: 메시지 앞에 `[gyehyu]` `[seungwon]` `[yunji]` `[claude]` 를 붙여 영역을 즉시 구분. 브랜치/파일 owner 규칙(CONTRIBUTING §3.5)과 1:1 매핑.
- **결정은 스레드로, 결론은 기록으로**: 결론이 나면 "→ decisions.md / #이슈에 기록함" 한 줄로 닫는다. Slack에만 남은 결정은 사라진 결정.
- **핀·북마크 고정**: CONTRIBUTING.md, iOS-PLAN.md, 데모 URL(`https://readinggo.hyuniverse.workers.dev`), 오픈 이슈 필터, "이슈 먼저" 리마인더.
- **채널 토픽**: "ReadingGo 런칭(Android-first) — 진실 소스는 GitHub, 여긴 실시간 조율. 태스크는 이슈로."

## 3. Claude 봇 활용

- **이슈 → 브랜치 → 드래프트 PR**: 채널에서 명시적으로 요청하면 governance(브랜치 네이밍·rebase-before-push·spec/code 분리)를 지켜 PR까지. 머지는 규칙대로 계휴가 웹에서.
- **P0 알림 라우팅**: 런칭 블로커(보안 감사 결과 등)를 채널에 요약·상태 추적.
- **베타 피드백 브리핑**: 유저 문의 auto-sync 이슈(#701)를 하루 한 번 요약.
- 주의: **채널 논의는 참고, 실행 트리거는 명시적으로.** 봇이 Slack 대화만 근거로 코드를 바꾸지 않는다.

## 4. 카덴스 (레포에 이미 정의된 리듬을 Slack에 얹기)

- **주 1회 위클리**: 오픈 이슈 P0/P1 훑기 + 막힌 것 처리. 마일스톤 트리아지(§4.2.5)를 정례화.
- **마일스톤/데모 전**: 트리아지 스레드 + `/insights` 실행 리마인더.
- **배포 시**: canary/staged rollout 상태를 채널에 한 줄.
