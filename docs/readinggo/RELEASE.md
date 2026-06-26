# RELEASE.md — 릴리스 프로세스 (OTA · 릴리스 브랜치 · 버전 · 롤백)

> **신설 (2026-06-26, #876)**: ReadingGo 가 출시될 때 *어떻게* 업데이트를 내보내는가의 **프로세스 문서**.
> iOS-PLAN [§10.5 업데이트 전략](./iOS-PLAN.md#105-업데이트-전략-런칭-후--ota--릴리스-브랜치)의 골격과 [`specs/ota.md`](./specs/ota.md)의 OTA 구현 결정을 **운영 절차로 묶는다**.
>
> **파일 분리 (중요)**: 이 문서는 *프로세스*(채널·브랜치·버전 동기화·롤백 절차)만 다룬다.
> 스토어 빌드의 **메커닉**(`.aab`/`.ipa` 빌드·서명·Play/App Store Connect 업로드 명령)은 별도 문서
> **`RELEASE-BUILD.md`**(#1024)가 담당한다. 둘이 겹치면 빌드 명령은 RELEASE-BUILD, 의사결정·순서·게이트는 RELEASE 가 source of truth.
>
> **연관 문서**: [`DEPLOY.md`](./DEPLOY.md)·[`RUNBOOK-DEPLOY.md`](./RUNBOOK-DEPLOY.md)는 **웹(Cloudflare Worker)** 배포 런북이다.
> 이 문서는 **설치된 앱**(iOS/Android 셸 + OTA 웹 번들)의 릴리스를 다룬다. 웹 즉시배포는 그대로 유지된다.

---

## 0. TL;DR — 무엇을 어디로 내보내나

| 바꾼 것 | 경로 | 심사 | 속도 | 버전 올림 |
|---|---|---|---|---|
| JS / HTML / CSS / assets (웹 번들 = `dist`) | **OTA** (Capgo self-hosted → KV 매니페스트) | 없음 | 즉시(다음 앱 시작 시 적용) | `1.0.<run_number>` 자동 |
| 네이티브 (플러그인·권한·`AndroidManifest`·아이콘·스플래시·OS SDK) | **스토어 바이너리** (Play / App Store Connect) | 있음(iOS 1~3일) | 주기적 | `versionName`/`versionCode`·`MARKETING_VERSION` 수동 |

**한 줄 규칙**: `dist` 안에서 끝나는 변경 = OTA. `dist` 밖(네이티브 셸)을 건드리면 = 스토어 빌드 + `minNative` 상향.

> ⚠️ 현재 OTA 구현 범위 = **Android 만**(iOS OTA 는 `specs/ota.md` §3④ OUT, 후속). iOS 는 당분간 **스토어 빌드로만** 업데이트된다. 아래 OTA 절은 Android 기준이며, iOS OTA 활성화 시 본 문서를 갱신한다.

---

## 1. OTA 채널 — staging(=beta) / production

### 1.1 채널 2개와 흐름

OTA 매니페스트는 Workers KV 에 **채널별**로 저장된다: `ota:android:beta` · `ota:android:production`.

> **용어 주의**: 본 문서·iOS-PLAN §10.5 의 "staging" = 구현(`specs/ota.md`·워크플로우)의 **`beta`** 채널과 동일물이다.
> KV 키·`ota-promote.yml`·`capacitor.config.json` 채널명은 전부 `beta`/`production` 이다(코드가 source of truth). "staging" 은 개념어로만 쓴다.

```
[main 머지]
   │  ota-release.yml (push: main)
   ▼
vite build → dist zip → SHA-256 → R2 업로드 → KV: ota:android:beta = {version,url,checksum,minNative}
   │  = beta 채널 자동 publish
   ▼
[베타 앱(채널=beta)]  다음 시작 시 수신 → checksum 검증 → 적용. 운영자/베타테스터가 확인.
   │
   │  ── 정상 ──▶  ota-promote.yml (workflow_dispatch, 수동)
   │                  KV: ota:android:production ← ota:android:beta (verbatim 복사, 재빌드 X)
   │                  = production 채널 승격 → 설치 사용자(prod 앱) 순차 수신
   │
   └─ 이상 ──▶  승격 안 함(prod 무영향). beta 는 Capgo 자동 롤백(§4).
```

- **왜 수동 승격인가**: 배포안전 에픽(#897)의 카나리 철학을 앱 레이어에 적용. 웹은 `main`=즉시 100% 지만, **앱은 한 겹 더 보수적**으로 — 운영자가 beta 에서 먼저 확인한 *그 바이너리·체크섬을 그대로* prod 로 올린다(재빌드하면 카나리가 무의미). (`specs/ota.md` §3③)
- **앱이 채널을 어떻게 아는가**: Capgo `defaultChannel` / 런타임 `setChannel`. 베타테스터 빌드 = `beta`, 스토어 배포 빌드 = `production`. (현재 `capacitor.config.json` 의 `updateUrl` 은 `…/api/ota`; 워커가 `?channel=` 로 분기.)

### 1.2 무엇이 OTA 로 가고 무엇이 네이티브 빌드인가 (★ 안전의 핵심)

| OTA 로 내리는 것 (`dist` 안) | 스토어 빌드 필수 (`dist` 밖 = 네이티브 셸) |
|---|---|
| React/JS 로직, 컴포넌트, 카피·문구 | Capacitor **플러그인 추가/제거/버전업** |
| CSS·디자인 토큰·레이아웃 | `AndroidManifest`(딥링크·권한)·`Info.plist` |
| `public/` 정적 자산(폰트·이미지) | 앱 아이콘·스플래시 |
| Supabase 쿼리·클라이언트 로직 | OS 권한·네이티브 SDK·Capacitor core 업그레이드 |

- **`minNativeVersion` 게이트** = 최우선 안전장치. 각 OTA 번들은 자신이 요구하는 **네이티브 셸 버전**(`minNative`)을 선언한다. 설치된 셸이 그보다 낮으면 그 번들을 **받지 않고** "스토어 업데이트" 배너를 띄운다. → 새 네이티브 API 를 호출하는 웹 번들이 구(舊) 셸에서 **크래시**하는 것을 원천 차단.
  - 현재 `ota-release.yml` 은 `minNative=1`(현 셸 versionCode) 하드코딩. **네이티브가 바뀐 셸을 낸 직후**부터, 그 새 네이티브 API 를 쓰는 웹 번들을 publish 할 때 이 값을 **새 셸 versionCode 로 상향**해야 한다(§3.3 체크리스트).
- **판단 규칙**: "이 변경이 새 APK/IPA 없이 기존 설치 앱에서 동작하나?" → 예면 OTA, 아니오면 스토어 빌드. 애매하면 **스토어 빌드 + `minNative` 상향**(보수적 기본값).
- **스토어 약관**: 웹/해석형 콘텐츠 업데이트는 Play·App Store 모두 허용. **네이티브 실행코드 다운로드는 금지** — 우리는 웹 번들(`dist`)만 내리므로 적합.

---

## 2. release 브랜치 전략 + SemVer

### 2.1 main 과 release 브랜치의 관계

- **`main` = 연속 통합 + OTA 소스.** 피처 브랜치 → PR → `main` 머지 시:
  1. 웹: Cloudflare Worker 자동 배포(기존 그대로).
  2. 앱: `ota-release.yml` 이 `beta` 채널 OTA 자동 publish.
- **`release/x.y.z` = 스토어 바이너리 컷 지점.** 네이티브 변경을 스토어에 내보낼 때만 `main` 에서 브랜치를 컷한다. 일상 OTA 업데이트는 release 브랜치가 **필요 없다**(main → beta → prod 로 충분).

```
main  ──●──●──●──────●──────●──●──▶   (연속, 매 머지 = beta OTA)
            │ cut          │ cut
            ▼              ▼
   release/1.1.0    release/1.2.0      ← 네이티브 변경 시에만 컷
        │                  │
   (버전 범프·빌드·         (동일)
    스토어 제출·태그)
```

### 2.2 release 브랜치 컷 시점

`release/x.y.z` 를 컷하는 **유일한 트리거 = 스토어 바이너리 제출이 필요한 시점**, 즉 다음 중 하나:

1. **네이티브 변경**이 main 에 쌓여 설치 사용자에게 전달돼야 할 때(`minNative` 게이트에 막혀 OTA 로 못 가는 것).
2. **정기 스토어 동기화**(예: 월 1회) — 그동안 OTA 로 나간 웹 번들을 새 스토어 빌드에 박제(baseline 갱신, OTA 적용 전 첫 실행 경험 개선).
3. **스토어 정책상 강제 업데이트**(SDK 최소버전 상향 등).

컷 절차:

```bash
# main 최신에서 컷
git fetch origin && git checkout -b release/1.2.0 origin/main
# → §3 버전 범프 → 빌드(RELEASE-BUILD.md) → 스토어 제출 → 태그
git tag v1.2.0 && git push origin v1.2.0
```

- release 브랜치는 **빌드·제출용 동결 지점**이다. 새 기능은 계속 `main` 에. 스토어 심사 중 main 이 앞서가도 무방(다음 컷이 따라잡는다).
- release 브랜치의 버전 범프 커밋은 **main 으로 다시 머지/체리픽**한다(버전 단조 증가 유지, §3.4).

### 2.3 hotfix 흐름

| 핫픽스 종류 | 경로 | 근거 |
|---|---|---|
| **웹 레이어 버그**(대다수) | `main` 에 fix PR 머지 → beta OTA → 확인 → prod 승격 | OTA 가 *곧* 핫픽스 채널. 스토어 우회. |
| **네이티브 버그**(크래시·권한·플러그인) | `release/x.y.(z+1)` 컷 → patch 범프 → 빌드 → **긴급 제출** | OTA 로 못 고침. iOS 는 [긴급 심사 요청](https://developer.apple.com/contact/app-store/?topic=expedite) 가능. |
| **나쁜 OTA 번들이 prod 에 나감** | **롤백 먼저**(§4) → main 에서 정상 fix → 재-publish | 사용자 영향 최소화가 1순위. |

### 2.4 SemVer 규칙 — `major.minor.patch`

스토어 바이너리(`versionName`/`MARKETING_VERSION`)에 적용. 기준:

| 증가 | 언제 | 예 | 보통 경로 |
|---|---|---|---|
| **major** (`x`) | 호환 깨짐·전면 개편·데이터 마이그레이션 동반 | `1.x.x → 2.0.0` | release 브랜치 |
| **minor** (`y`) | 새 기능·**네이티브 추가**(플러그인·권한) | `1.1.x → 1.2.0` | release 브랜치(스토어 빌드) |
| **patch** (`z`) | 버그픽스·카피·UI 미세 조정 | `1.2.0 → 1.2.1` | **대부분 OTA**(웹), 네이티브 버그만 release 브랜치 |

> **핵심 비대칭**: patch·웹 핫픽스는 **OTA**(스토어 안 거침). minor 이상(네이티브 동반)은 **스토어 바이너리 릴리스**. → 일상 업데이트는 지금 웹처럼 수시 배포, 스토어 제출은 네이티브가 바뀔 때만.
>
> **OTA 번들 버전 ≠ 스토어 SemVer**: OTA 번들 버전은 `ota-release.yml` 이 `1.0.<github.run_number>`(단조 증가)로 자동 발급한다. Capgo CLI 가 비-semver(예: `2026.06.24-sha`)를 거부하기 때문(`invalid_semver`). git sha·날짜는 매니페스트의 `sha`/`date` 메타데이터에만 싣는다. **스토어 SemVer(`x.y.z`)는 사람이 release 브랜치에서 범프**한다 — 둘은 독립 축이다(OTA=웹 번들 일련번호, SemVer=네이티브 셸 마케팅 버전).

---

## 3. 버전 범프 절차 (스토어 빌드 시)

### 3.1 버전이 사는 4(+1) 곳

| # | 파일 | 키 | 현재값 | 의미 |
|---|---|---|---|---|
| 1 | `docs/readinggo/package.json` | `version` | `0.1.0` | 프로젝트 명목 버전(npm). SemVer 의 SoT 로 사용. |
| 2 | `docs/readinggo/android/app/build.gradle` | `versionName` | `"1.0"` | Android 마케팅 버전(사용자 노출 = SemVer). |
| 2b | `docs/readinggo/android/app/build.gradle` | `versionCode` | `1` | Android 내부 **정수, 빌드마다 +1 단조 증가**(Play 가 순서 판단). |
| 3 | `docs/readinggo/ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` | `1.0` | iOS 마케팅 버전(= SemVer). `Info.plist` `CFBundleShortVersionString` 가 이 변수를 참조. |
| 3b | 〃 | `CURRENT_PROJECT_VERSION` | `1` | iOS 빌드 번호(정수, 빌드마다 +1). `CFBundleVersion` 가 참조. |

> `capacitor.config.json` 에는 **버전 필드가 없다**(앱 버전은 네이티브 프로젝트 소유). Capgo `@capgo/capacitor-updater` 의 OTA 버전은 빌드타임이 아니라 런타임 매니페스트가 결정하므로 여기 박을 필요 없음.
>
> ⚠️ `build.gradle`·iOS `project.pbxproj` 의 실제 **편집 명령·빌드·서명**은 `RELEASE-BUILD.md`(#1024) 소관. 여기서는 *무엇을 어떤 값으로* 맞추는지(정합 규칙)만 정의한다.

### 3.2 동기화 규칙

- **마케팅 버전 3곳 일치**: `package.json version` = `versionName` = `MARKETING_VERSION` = `x.y.z`.
- **빌드 번호 단조 증가**: `versionCode`(Android)·`CURRENT_PROJECT_VERSION`(iOS)는 **스토어 업로드마다 반드시 +1**. 같은 마케팅 버전이라도 재업로드하면 빌드 번호는 올려야 한다(Play/App Store 가 중복 거부). 둘을 같은 정수로 맞춰 두면 추적이 쉽다(예: 둘 다 `5`).
- **OTA `minNative`**: 네이티브가 바뀐 셸을 새로 냈으면, 그 셸 versionCode 를 `ota-release.yml` 의 `minNative` 에 반영(현재 하드코딩 `1`).

### 3.3 동기화 체크리스트 (release 브랜치에서)

```text
[ ] release/x.y.z 컷 (origin/main 최신에서)
[ ] package.json        version  → x.y.z
[ ] build.gradle        versionName → "x.y.z"
[ ] build.gradle        versionCode → (직전 +1)
[ ] project.pbxproj     MARKETING_VERSION → x.y.z   (2곳: Debug/Release 모두)
[ ] project.pbxproj     CURRENT_PROJECT_VERSION → (직전 +1)  (2곳)
[ ] (네이티브 변경 동반 시) ota-release.yml  minNative → 새 versionCode
[ ] 아래 §3.4 스크립트로 정합 확인
[ ] 빌드·서명·제출 → RELEASE-BUILD.md
[ ] git tag vx.y.z && push
[ ] 버전 범프 커밋 main 으로 머지/체리픽
```

### 3.4 정합 확인 스크립트 (읽기 전용)

빌드 전, 마케팅 버전 3곳이 일치하는지 한 번에 본다(편집 안 함 — 확인용):

```bash
# docs/readinggo 에서 실행
echo "package.json : $(node -p "require('./package.json').version")"
echo "versionName  : $(grep -m1 versionName android/app/build.gradle | grep -oE '\"[^\"]+\"')"
echo "versionCode  : $(grep -m1 versionCode android/app/build.gradle | grep -oE '[0-9]+')"
echo "MARKETING_VERSION (iOS):"; grep -o 'MARKETING_VERSION = [^;]*' ios/App/App.xcodeproj/project.pbxproj | sort -u
echo "CURRENT_PROJECT_VERSION (iOS):"; grep -o 'CURRENT_PROJECT_VERSION = [^;]*' ios/App/App.xcodeproj/project.pbxproj | sort -u
```

마케팅 버전 3줄(package.json / versionName / MARKETING_VERSION)이 같은 `x.y.z` 면 통과. 다르면 §3.3 으로 맞춘다.

> 자동 범프 스크립트(한 번에 4곳 수정)는 `RELEASE-BUILD.md`(#1024)에서 빌드 메커닉과 함께 제공하는 것이 적절하다(파일을 실제 수정하므로). 본 문서는 *무엇을 맞춰야 하는가*의 계약만 정의한다.

---

## 4. 롤백 검증

### 4.1 OTA 롤백 — 이전 KV 매니페스트로

OTA 롤백은 두 층이다:

1. **Capgo 자동 롤백 (앱 내, 즉시)**: 새 번들이 부팅 후 시간 내 `notifyAppReady()` 를 호출하지 못하면(크래시·백스크린) 플러그인이 **직전 양호 번들로 자동 복귀**한다(`resetWhenUpdate`/내장 안전망). → 망가진 번들이 앱을 벽돌로 만들지 않음. 사용자 측 1차 방어선.
2. **수동 롤백 (서버 측, prod 채널 되돌리기)**: 나쁜 번들이 *충돌은 안 하지만 잘못된* 경우(기능 회귀·데이터 오작동) — 자동 롤백이 안 걸린다. 운영자가 **production 매니페스트를 직전 양호 버전으로 덮어쓴다**.

production 을 직전 양호 매니페스트로 되돌리는 법(서버 측). 아래 **A) 가 기본**(원클릭) — `ota-promote.yml` 이 매 승격마다 직전 prod 를 `:prev` 키에 자동 백업하므로(#1029), 한 줄로 복원한다.

```bash
NS=e22049c87f9d44139242316c3c445bf9   # OTA_KV namespace id (wrangler.toml)

# A) ★ 원클릭 롤백 — 직전 prod 매니페스트(:prev)를 production 으로 복원.
#    ota-promote.yml 이 승격 직전 현재 prod 를 ota:android:production:prev 로 백업해 둔다(#1029).
#    = 직전 1세대로 즉시 되돌리기. 가장 흔한 롤백(방금 승격이 나빴다).
#    --remote 필수: 없으면 로컬 KV 만 건드려 실제 prod 가 안 바뀐다(#990).
PREV=$(npx -y wrangler@4 kv key get --remote --namespace-id "$NS" "ota:android:production:prev")
[ -z "$PREV" ] && echo "백업 없음(:prev). 최초 승격이거나 백업 전 — B/C 로." || \
  npx -y wrangler@4 kv key put --remote --namespace-id "$NS" "ota:android:production" "$PREV"

# B) beta 가 아직 양호하면: 현재 beta 를 prod 로 다시 승격 (재승격으로 덮기).
#    → 단, beta 도 이미 나쁜 번들이면 쓰지 말 것. (:prev 가 있으면 보통 A 가 더 안전.)

# C) 특정 이전 버전으로 되돌리기 — 그 버전 매니페스트를 prod 키에 다시 쓴다(2세대+ 이전).
#    이전 양호 번들의 url/checksum 을 알면(Action 로그/R2) 직접 구성해 put.
GOOD='{"version":"1.0.NN","url":"https://pub-….r2.dev/com.readinggo.app_1.0.NN.zip","checksum":"<sha256>","minNative":1}'
npx -y wrangler@4 kv key put --remote --namespace-id "$NS" "ota:android:production" "$GOOD"
```

- **핵심**: prod 매니페스트만 이전 버전을 가리키게 하면, prod 앱은 다음 체크에서 그 이전 번들을 받아 복귀한다(번들 바이너리는 R2 에 그대로 남아 있으므로 재빌드 불필요).
- 현재 매니페스트 확인: `npx -y wrangler@4 kv key get --remote --namespace-id "$NS" "ota:android:production"`.
- 백업 확인(롤백 전 무엇으로 돌아가는지): `npx -y wrangler@4 kv key get --remote --namespace-id "$NS" "ota:android:production:prev"`.
- **`:prev` 범위·주의**: `:prev` 는 **직전 1세대만** 보관한다(매 승격이 직전 값으로 덮어씀). 두 세대 이상 이전으로 가려면 C)(Action 로그/R2 로 매니페스트 재구성). 롤백(A) 직후 곧장 또 승격하면 그 롤백 값이 다시 `:prev` 가 되니, 연속 롤백은 매번 현재 prod 를 먼저 확인하고 진행한다.

### 4.2 네이티브 롤백 — 스토어 한계

- **OTA 처럼 즉시 되돌릴 수 없다.** 스토어에 이미 배포된 바이너리는 클라이언트가 자동 다운그레이드되지 않는다.
- **Android(Play)**: 단계적 출시(staged rollout) 중이면 **롤아웃 중단/일시정지**로 추가 노출을 막을 수 있다. 이미 받은 사용자는 다운그레이드 안 됨 → **이전 양호 빌드를 새 versionCode 로 재업로드**(롤포워드)해야 실질 복구.
- **iOS(App Store)**: 출시 후 즉시 롤백 없음. 단계적 출시(phased release) 중이면 **일시정지** 가능. 복구 = 이전 코드로 빌드해 **새 빌드 번호로 재제출**(심사 재대기).
- **결론**: 네이티브 변경은 **보수적으로**. 그래서 ① 네이티브 변경 ≠ 일상 업데이트(OTA 로 최대한 흡수), ② 스토어는 **단계적 출시**(10%→50%→100%)로 회귀 조기 발견, ③ 웬만한 핫픽스는 OTA 로 가능하게 설계.

### 4.3 롤백 테스트 방법 (출시 전 1회 + 분기마다)

OTA 롤백이 *실제로* 동작하는지 검증한다(설계만 믿지 않는다):

```text
[OTA 자동 롤백]
[ ] 일부러 부팅 크래시 번들(예: 최상위에서 throw) 을 beta 에 publish
[ ] 베타 기기에서 앱 재시작 → 크래시 → 재시작 시 직전 양호 번들로 복귀 확인
[ ] 정상 화면 뜨면 통과 (Capgo notifyAppReady 안전망 동작)

[OTA 수동 롤백]
[ ] 정상이지만 눈에 띄는 회귀(예: 버튼 라벨 변경) 번들을 prod 로 승격
[ ] §4.1-A 원클릭(:prev → production)으로 prod 매니페스트를 직전 버전으로 되돌림
[ ] prod 기기 재시작 → 이전 라벨로 복귀 확인

[네이티브 (스토어) — 모의]
[ ] 내부테스트 트랙에서 staged rollout 일시정지 동작 확인(실제 prod 위험 없이)
[ ] 롤포워드 절차(이전 코드 + versionCode+1 재빌드)를 RELEASE-BUILD.md 대로 1회 리허설
```

---

## 5. 한눈에 — 의사결정 요약

| 항목 | 결정 |
|---|---|
| OTA 채널 | `beta`(=staging 개념) → `production`. main 머지=beta 자동, prod=수동 승격(앱판 카나리). |
| OTA 범위 | 현재 **Android 만**. `dist` 웹 번들. iOS OTA·서명·staged% 는 후속. |
| OTA/네이티브 경계 | `dist` 안=OTA, `dist` 밖(셸)=스토어 빌드. `minNativeVersion` 게이트가 강제. |
| release 브랜치 | `release/x.y.z` 는 **스토어 빌드 컷 지점만**. 일상 OTA 는 불필요. |
| SemVer | patch·웹=OTA, minor↑(네이티브)=스토어. OTA 번들 버전(`1.0.<run#>`)과 스토어 SemVer 는 독립. |
| 버전 동기화 | 마케팅 3곳 일치(package.json·versionName·MARKETING_VERSION), 빌드번호 단조+1(versionCode·CURRENT_PROJECT_VERSION). |
| 롤백 | OTA=자동(crash)+수동(prod KV 되돌리기). 네이티브=스토어 한계 → staged rollout·롤포워드. 분기마다 리허설. |

## 6. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-06-26 | 신설(#876). OTA 채널·release 브랜치·버전 동기화·롤백 절차 문서화. iOS-PLAN §10.5 + `specs/ota.md` 를 운영 프로세스로 통합. |
| 2026-06-26 | §4.1 원클릭 OTA 롤백 추가(#1029). `ota-promote.yml` 이 승격 직전 prod 를 `ota:android:production:prev` 로 백업 → `:prev`→`production` 한 줄 복원. 본 문서를 상시 markdownlint globs 에 등록. |
