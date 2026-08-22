# OTA Live Updates — 웹 번들 무선 업데이트 (#876)

> **신설 (2026-06-24)**: 설치된 네이티브 앱에 웹 레이어(JS/HTML/CSS)를 스토어 우회로 갱신.
> iOS-PLAN [§10.5 업데이트 전략](../iOS-PLAN.md)의 OTA 골격을 구체화한 **피처 스펙**.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec PR 먼저 → 코드 PR 나중.
> **현행 정합 (2026-08-22, `origin/main@2a84029`)**: `@capgo/capacitor-updater`, Worker `/api/ota`, R2 `readinggo-ota`, KV `ota:android:<channel>`이 구현돼 있다. 현재 `ota-release.yml`과 `ota-promote.yml`은 모두 `workflow_dispatch`이며 stable DEV receipt·`origin/main`·입력 SHA 일치와 GitHub `production` environment 승인을 요구한다. main push는 설치 사용자 채널을 자동 변경하지 않는다.
>
> **채널 격리 갱신 (#1489)**: 채널(beta|production) 선택은 `custom_id`가 아니라 `defaultChannel`로 한다 — Capgo 플러그인이 `capacitor.config.json` `plugins.CapacitorUpdater.defaultChannel` 값을 네이티브 부팅 시 읽어 **첫 업데이트 체크 요청부터** `defaultChannel` 필드로 싣는다(런타임 JS 호출 불필요, 빌드 시점 결정적 고정). `custom_id`는 별개 필드(계정 타게팅용, §3④ Phase 2 OUT)라 채널 선택에 쓰지 않는다. Worker는 명시적 `defaultChannel`이 `beta`/`production`일 때만 해당 채널을 사용한다. #1489 이전 release 셸은 `defaultChannel` 없이 native `is_prod:true`를 보내므로 이 경우에만 production 호환을 유지한다. DEV의 `is_prod:false`, 필드 누락, 빈 값, 명시적 미상 값은 **fail-closed** no-update다. DEV/debug APK(`android-apk.yml`)는 커밋된 `capacitor.config.json`의 `defaultChannel: "production"` 기본값을 `beta`로 override해 발행하며, OTA 자체를 끄지 않는다(과거엔 `updateUrl` 삭제 + `autoUpdate:false`로 OTA를 전면 비활성했으나 이는 beta 채널 회귀 검증을 막는 임시방편이었다).

## 0. 목적

설치된 네이티브 앱(Capacitor 셸)은 **빌드 시점 웹 번들을 박제**한다. 웹(Cloudflare)에 배포해도 설치된 앱엔 반영되지 않아, 사소한 카피·버그·UI 수정마다 **스토어 재심사**(느림·병목)가 필요하다. **OTA**로 웹 레이어를 스토어 우회로 즉시 갱신하고, **네이티브 변경만** 스토어 빌드로 돌린다.

> 효과: 일상 업데이트(카피·버그·UI)는 *지금 웹처럼 수시 배포*, 스토어 제출은 네이티브가 바뀔 때만.

## 1. 범위 경계 (★ 안전의 핵심)

| 구분 | 내용 |
|---|---|
| **OTA로 내리는 것** | `dist` 웹 번들 — JS / HTML / CSS / assets |
| **OTA로 못 내리는 것** | 네이티브 — Capacitor 플러그인 추가·제거, `AndroidManifest`(딥링크 등), 네이티브 코드, 앱 아이콘·스플래시, OS 권한 → **스토어 빌드 필수** |

- **`minNativeVersion` 게이트**: 각 OTA 번들은 자신이 요구하는 **네이티브 셸 버전**을 선언한다. 설치된 셸이 그보다 낮으면 그 번들을 받지 않아 새 네이티브 API 호출로 인한 크래시를 차단한다. 단, 이 값은 DB migration·RLS/RPC 권한·공개범위 enum·legacy API 의미 호환을 보증하지 않는다. 해당 전환은 app version별 호출 관측, 최소 지원 버전, fail-closed 정책, 직접 API QA를 별도 통과해야 한다.
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

[릴리스] GitHub Action(workflow_dispatch + 승인된 main SHA)
  stable DEV/main SHA gate → vite build → dist zip → SHA-256 → R2 업로드 → KV manifest 갱신(채널=beta)
```

- **플러그인**: `@capgo/capacitor-updater` — 오픈소스, **자가호스팅**(Capgo 클라우드 미사용 → 비용 0·데이터 보유·우리 스택 일관). Appflow(`@capacitor/live-updates`)는 2026 종료 예정이라 배제.
- **번들 저장**: Cloudflare **R2 `readinggo-ota`** public bucket. `ota-release.yml`이 zip을 `--remote`로 올리고 Worker는 KV 매니페스트의 R2 URL을 반환한다. GitHub Releases 후보와 “R2 미활성”은 superseded.
- **매니페스트**: Workers **KV** `ota:<platform>:<channel>` → `{version, url, checksum, minNative}` (구현 #979 페이즈 A).
- **엔드포인트**: 기존 `readinggo` 워커의 **`POST /api/ota`**가 Capgo 규약(`platform·version_name·version_code·defaultChannel·is_prod`)을 수신해 매니페스트를 비교하고 `{version,url,checksum}` 또는 `{}`(no-update)를 반환한다. `custom_id`는 채널 선택에 사용하지 않는다. 동일출처 게이트 없음(네이티브 클라).

## 3. 의사결정

### ① 인프라
- **호스팅**: 자가호스팅(CF Worker + R2 + KV). 근거: 비용 0·데이터 보유·기존 워커 재사용.
- **버전 표기**: `1.0.<github.run_number>` semver. `@capgo/cli` 검증을 따르며 git SHA·날짜는 매니페스트 `sha`·`date`로 추적한다. 초기 버전안은 superseded.
- **무결성**: SHA-256 **checksum**(플러그인이 적용 전 검증). 공개키 **서명**은 Phase 2(후속).

### ② 동작
- **적용 시점**: **백그라운드 다운로드 → 다음 앱 시작 시 적용**(`directUpdate: false`). 사용 중 화면 끊김 없음.
- **롤백**: **자동**. 새 번들이 부팅 후 `notifyAppReady()`를 시간 내 호출하지 못하면(크래시/백스크린) 직전 양호 번들로 자동 복귀(Capgo 내장). → 망가진 번들이 앱을 벽돌로 만들지 않음.
- **네이티브/OTA 경계**: §1 `minNativeVersion`.

### ③ 릴리스 전략 ⭐ (핵심 결정)
- **채널 2개**: `beta` · `production`.
- **트리거**: `ota-release.yml`을 `workflow_dispatch`로 실행해 stable DEV에서 검증된 `origin/main` SHA의 번들을 `beta`에 발행한다. beta 기기 QA 뒤 `ota-promote.yml`을 별도 수동 실행해 같은 SHA의 manifest를 재빌드 없이 `production`으로 승격한다. 두 workflow 모두 GitHub `production` environment 승인 대상이다.
- **근거**: main push가 설치 사용자 채널을 자동 변경하지 않게 하고, DEV 검증 artifact와 beta·production OTA의 SHA·checksum을 단일 receipt로 추적한다.
- **대안(기각)**: iOS-PLAN §10.5 원안 = `main → production` 자동 + staged %. 더 빠르나 prod 자동 노출. → 출시 초기엔 **수동 승격**을 채택, staged % 점진배포는 Phase 2로.

### ④ MVP 범위
- **IN**: Android(우선) · `beta`+`production` 2채널 · checksum · 자동 롤백 · 백그라운드 적용 · `minNativeVersion` 게이트.
- **OUT(후속)**: 공개키 서명 · iOS · staged % 점진배포 · 델타 업데이트 · 유저 타게팅.

## 4. 릴리스 흐름

1. main SHA가 stable DEV `/api/release`와 일치하고 DEV QA가 승인된 뒤 `ota-release.yml`을 수동 실행한다.
2. workflow가 같은 SHA를 checkout해 `dist` zip·SHA-256을 만들고 R2에 업로드한 뒤 `ota:android:beta` manifest에 version·URL·checksum·`minNative`·SHA를 기록한다.
3. **베타 앱**이 다음 시작 시 수신·검증·적용한다. 운영자가 실제 기기와 대상 역할을 확인한다.
4. 정상일 때만 `ota-promote.yml`을 같은 SHA로 수동 실행해 beta manifest를 검증하고 `ota:android:production`으로 그대로 복사한다.
5. 이상이면 production 승격을 하지 않는다. beta의 부팅 실패 자동 rollback과 production `:prev` 복원은 별도 증거를 남긴다.

## 5. minNativeVersion 운영

- 셸 빌드마다 `nativeVersion`을 증가(플러그인/매니페스트 변경 시). 앱에 상수로 내장.
- 네이티브 변경을 **동반하는** 웹 번들 publish 시 `minNative`를 그 셸 버전으로 올림 → 구 셸은 그 번들을 **스킵**하고 "스토어 업데이트" 배너를 띄운다.

## 6. 보안 / 약관

- checksum 검증(MITM·손상 방지) + HTTPS.
- Play/App Store: 웹 콘텐츠 업데이트 허용 범위 내(네이티브 바이너리 미다운로드).
- R2·KV 접근은 워커 서버측만(클라이언트 노출 0). 키는 워커 시크릿.

## 7. Stack Lock 노트

- **신규 의존성**: `@capgo/capacitor-updater` — Capacitor 1차 생태계, 오픈소스, 자가호스팅. **Capacitor 단일 lock 내**(새 프레임워크 아님). 코드 PR에서 추가 시 재확인.

## 8. 구현 계약 (#1489)

1. `capacitor.config.json`의 release/production 기본값은 `updateUrl`, `autoUpdate:true`, `directUpdate:false`, `resetWhenUpdate:true`, `defaultChannel:"production"`을 사용한다.
2. `main.js`는 네이티브 부팅 성공 후 `notifyAppReady()`를 호출하고, 수동 QA용 `window.RG_otaDiagnostics()`에서 활성/빌트인/다운로드 번들의 id·version만 반환한다. 토큰·사용자·문장 데이터는 포함하지 않는다.
3. Worker `POST /api/ota`는 `defaultChannel`로 채널을 선택하고 `custom_id`는 채널에 사용하지 않는다. 명시적 미상 채널과 DEV 미설정은 fail-closed no-update이며, `defaultChannel`이 없는 구 release 셸의 `is_prod:true`만 production 호환을 유지한다.
4. `android-apk.yml`은 DEV/debug APK의 `defaultChannel`을 `beta`로 override하고 OTA 자체는 유지한다. 과거의 전면 비활성 임시 가드를 되살리지 않는다.
5. `ota-release.yml`은 stable DEV/main gate를 통과한 승인 SHA의 build/checksum을 beta에 발행하고, `ota-promote.yml`은 같은 manifest를 production에 수동 승격한다. main push 자동 발행은 사용하지 않는다.

> 실제 R2/KV 객체와 설치 기기의 수신 성공은 워크플로우 실행·기기 QA 근거로 별도 판정한다. `defaultChannel` override가 실기기에서 실제로 `/api/ota` 요청에 실리는지는 기기 QA(예: `window.RG_otaDiagnostics()` + 네트워크 캡처)로만 확정된다. 진단 함수는 `active`, `builtin`, `downloaded` 각각의 bundle id·version만 반환한다.
