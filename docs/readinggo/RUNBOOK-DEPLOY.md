# 배포 런북 — 자동배포 실패 시 복구 (#693)

> ReadingGo 데모는 **Cloudflare Workers Build** 가 `main` 푸시 시 자동 배포한다.
> 평상시엔 수동 배포가 필요 없다([cicd-auto-deploy] 원칙). 이 문서는 **자동배포가 멈췄을 때만** 쓰는 예외 절차다.

## 1. 증상

- `main` 머지 후 라이브 사이트(`https://readinggo.hyuniverse.workers.dev`)가 갱신 안 됨.
- `deploy-verify` 워크플로우가 **fail**(라이브 `_RG_V` ≠ 머지본 `_RG_V`).
- 브라우저 강력 새로고침으로도 옛 버전 → 서버(엣지) stale, 캐시 아님.

## 2. 원인 (관측 이력)

- 배포를 짧은 시간에 매우 자주 하면 **Workers Build 빌드 할당량/레이트리밋** 소진 추정 → 특정 빌드를 건너뜀(#692 사례, 2026-06-16).
- 정확 사유는 Cloudflare 대시보드 → **Workers & Pages → `readinggo` → Builds** 에서 해당 빌드 상태(skipped/failed/quota) 확인.

## 3. 즉시 복구

```bash
# 직접 업로드 — Workers Build CI 우회, 빌드 할당량과 무관.
npx wrangler deploy
```

배포 후 라이브 `_RG_V`(`docs/readinggo/index.html` 상단 `const _RG_V`)가 머지본과 일치하는지 확인.

## 4. 재발 방지

- **배포 빈도 줄이기**: 작은 PR 여러 개를 몰아 머지(머지 큐) → 빌드 횟수 감소.
- **한도 확인**: CF 대시보드에서 Builds 월 한도·리셋 주기 점검(필요 시 플랜 검토). *(계휴/대시보드 권한 필요)*
- **감지**: `deploy-verify` 워크플로우가 미반영을 자동 감지(라이브 `_RG_V` 폴링, 최대 10분).
- **(선택) Actions 폴백 배포 job**: `wrangler deploy` 를 Actions 에서 직접 실행하면 Builds 쿼터와 무관하게 배포 가능. 단 `CLOUDFLARE_API_TOKEN` 시크릿 필요 + Workers Build 와의 **이중 배포** 주의 → 도입 시 `workflow_dispatch`(수동 트리거)로 한정 권장. *(미도입, 계휴 결정)*
- **자동 롤백 (P2 #900, 도입됨)**: 배포 반영 후 `deploy-verify` 가 production live render-smoke 를 **3회 재시도** → 연속 실패 시 `wrangler rollback --yes` 로 직전 버전 자가복구 + `auto-rollback` 라벨 이슈 생성. `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`(P1 #899 에서 등록) 사용, 3회 재시도로 일시 오류 오롤백 방어. **auto-rollback 이슈를 받으면** 그 커밋의 런타임 회귀부터 조사 — preview-smoke(#899)는 통과했는데 production 만 실패면 preview↔production 의 env·시크릿 차이를 먼저 의심.

[cicd-auto-deploy]: 메모리 — main 머지 시 CI/CD 자동 배포가 기본. 이 런북은 그 예외(자동배포 실패) 전용.
