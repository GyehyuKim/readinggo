# OTA Live Updates — 웹 번들 무선 업데이트 (#876)

> **신설 (2026-06-24)**: 설치된 네이티브 앱에 웹 레이어(JS/HTML/CSS)를 스토어 우회로 갱신.
> iOS-PLAN [§10.5 업데이트 전략](../iOS-PLAN.md)의 OTA 골격을 구체화한 **피처 스펙**.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec PR 먼저 → 코드 PR 나중.
> ⚠️ **본 PR은 spec only**. 코드·신규 의존성(`@capgo/capacitor-updater`)·인프라(R2/KV)는 후속 코드 PR.

## 0. 목적

설치된 네이티브 앱(Capacitor 셸)은 **빌드 시점 웹 번들을 박제**한다. 웹(Cloudflare)에 배포해도 설치된 앱엔 반영되지 않아, 사소한 카피·버그·UI 수정마다 **스토어 재심사**(느림·병목)가 필요하다. **OTA**로 웹 레이어를 스토어 우회로 즉시 갱신하고, **네이티브 변경만** 스토어 빌드로 돌린다.

> 효과: 일상 업데이트(카피·버그·UI)는 *지금 웹처럼 수시 배포*, 스토어 제출은 네이티브가 바뀔 때만.

## 1. 범위 경계 (★ 안전의 핵심)

| 구분 | 내용 |
|---|---|
| **OTA로 내리는 것** | `dist` 웹 번들 — JS / HTML / CSS / assets |
| **OTA로 못 내리는 것** | 네이티브 — Capacitor 플러그인 추가·제거, `AndroidManifest`(딥링크 등), 네이티브 코드, 앱 아이콘·스플래시, OS 권한 → **스토어 빌드 필수** |

- **`minNativeVersion` 게이트 (최우선 안전장치)**: 각 OTA 번들은 자신이 요구하는 **네이티브 셸 버전**을 선언한다. 설치된 셸이 그보다 낮으면 그 번들을 **받지 않는다**. → 새 네이티브 API를 호출하는 웹 번들이 구(舊) 셸에 적용돼 **크래시하는 것**을 원천 차단. (예: 이번 OAuth 딥링크처럼 네이티브 플러그인이 추가된 변경은 OTA로 내리면 안 되고, 새 셸 빌드 + `minNative` 상향이 필요.)
- **스토어 약관**: 웹/해석형 콘텐츠 업데이트는 Google Play·App Store 모두 허용 범위. **네이티브 실행코드 다운로드는 금지** — 우리는 웹 번들만 내리므로 적합.

## 2. 아키텍처 — 자가호스팅 (Cloudflare)

```
앱(@capgo/capacitor-updater)
  │  check?platform&channel&currentVersion&native
  ▼
CF Worker  /api/ota   ──(채널별 최신 manifest 조회)──▶  Workers KV
  │  { version, url, checksum, minNative }
  ▼
앱: url(R2)에서 zip 다운로드 → checksum 검증 → **다음 앱 시작 시** 적용

[릴리스] GitHub Action(main 머지)
  vite build → dist zip → SHA-256 → R2 업로드 → KV manifest 갱신(채널=beta)
```

- **플러그인**: `@capgo/capacitor-updater` — 오픈소스, **자가호스팅**(Capgo 클라우드 미사용 → 비용 0·데이터 보유·우리 스택 일관). Appflow(`@capacitor/live-updates`)는 2026 종료 예정이라 배제.
- **번들 저장**: Cloudflare **R2** (`bundles/<version>.zip`).
- **매니페스트**: Workers **KV** (`channel:beta` / `channel:production` → `{version,url,checksum,minNative}`).
- **엔드포인트**: 기존 `readinggo` 워커에 **`/api/ota`** 추가.

## 3. 의사결정

### ① 인프라
- **호스팅**: 자가호스팅(CF Worker + R2 + KV). 근거: 비용 0·데이터 보유·기존 워커 재사용.
- **버전 표기**: `YYYY.MM.DD-<gitSHA7>` — 시간순 정렬 + 커밋 추적.
- **무결성**: SHA-256 **checksum**(플러그인이 적용 전 검증). 공개키 **서명**은 Phase 2(후속).

### ② 동작
- **적용 시점**: **백그라운드 다운로드 → 다음 앱 시작 시 적용**(`directUpdate: false`). 사용 중 화면 끊김 없음.
- **롤백**: **자동**. 새 번들이 부팅 후 `notifyAppReady()`를 시간 내 호출하지 못하면(크래시/백스크린) 직전 양호 번들로 자동 복귀(Capgo 내장). → 망가진 번들이 앱을 벽돌로 만들지 않음.
- **네이티브/OTA 경계**: §1 `minNativeVersion`.

### ③ 릴리스 전략 ⭐ (핵심 결정)
- **채널 2개**: `beta` · `production`.
- **트리거**: **main 머지 → 자동으로 `beta` 채널 publish**. **`beta` → `production` 은 수동 승격**(GitHub Action `workflow_dispatch`). = **앱판 카나리** — 운영자/베타테스터가 먼저 받아 확인 후 prod로 올린다.
- **근거**: 배포안전 에픽(#897)의 카나리 철학을 앱 레이어에 적용. 웹은 main=즉시 100%지만, **앱은 수동 게이트로 한 겹 더 보수적**으로(설치 사용자에게 잘못된 번들이 바로 가지 않게).
- **대안(기각)**: iOS-PLAN §10.5 원안 = `main → production` 자동 + staged %. 더 빠르나 prod 자동 노출. → 출시 초기엔 **수동 승격**을 채택, staged % 점진배포는 Phase 2로.

### ④ MVP 범위
- **IN**: Android(우선) · `beta`+`production` 2채널 · checksum · 자동 롤백 · 백그라운드 적용 · `minNativeVersion` 게이트.
- **OUT(후속)**: 공개키 서명 · iOS · staged % 점진배포 · 델타 업데이트 · 유저 타게팅.

## 4. 릴리스 흐름

1. **main 머지** → GitHub Action: `vite build` → `dist` zip → SHA-256 → R2 `bundles/<version>.zip` 업로드 → KV `channel:beta = {version,url,checksum,minNative}`.
2. **베타 앱**(채널=beta) 다음 시작 시 수신 → 검증 → 적용. 운영자가 확인.
3. 정상 → **수동 승격**(`workflow_dispatch`): KV `channel:production = 그 version`. prod 앱이 순차 수신.
4. 이상 → 승격 안 함(prod 무영향) + beta는 자동 롤백.

## 5. minNativeVersion 운영

- 셸 빌드마다 `nativeVersion`을 증가(플러그인/매니페스트 변경 시). 앱에 상수로 내장.
- 네이티브 변경을 **동반하는** 웹 번들 publish 시 `minNative`를 그 셸 버전으로 올림 → 구 셸은 그 번들을 **스킵**하고 "스토어 업데이트" 배너를 띄운다.

## 6. 보안 / 약관

- checksum 검증(MITM·손상 방지) + HTTPS.
- Play/App Store: 웹 콘텐츠 업데이트 허용 범위 내(네이티브 바이너리 미다운로드).
- R2·KV 접근은 워커 서버측만(클라이언트 노출 0). 키는 워커 시크릿.

## 7. Stack Lock 노트

- **신규 의존성**: `@capgo/capacitor-updater` — Capacitor 1차 생태계, 오픈소스, 자가호스팅. **Capacitor 단일 lock 내**(새 프레임워크 아님). 코드 PR에서 추가 시 재확인.

## 8. 구현 단계 (후속 코드 PR)

1. 플러그인 추가 + `capacitor.config`(updateUrl·autoUpdate·channel) + 앱 부팅에 `notifyAppReady()`.
2. CF Worker `/api/ota`(KV 조회) + R2 바인딩.
3. GitHub Action: build → zip → checksum → R2 → KV(beta).
4. 승격 워크플로우(`workflow_dispatch`: beta→prod).
5. 새 APK 빌드(플러그인=네이티브 변경) → 설치 → OTA 수신·적용·롤백 검증.
