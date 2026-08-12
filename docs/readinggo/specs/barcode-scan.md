# 바코드(ISBN) 스캔 책 등록 — `barcode-scan.md`

> **상태**: 🟢 활성 (Phase 0 무의존 프로토타입). 신설 #943 (콜드스타트 OCR 제거 #944 의 올바른 후속).
> **owner**: gyehyu (검색·등록·온보딩 경로). **데이터/매칭 계약**은 [backend.md §7](./backend.md), 책 매칭은 [data.js `BOOK_BY_ID`·`normalizeIsbn13`].
> **편집 정책**: 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.
> **Stack Lock**: 본 스펙의 Phase 0 권장안(웹 `BarcodeDetector`)은 **새 의존성 0** — 브라우저 네이티브 API. iOS 셸용 네이티브 플러그인(옵션 c)은 **별도 Stack Lock 결정 + 사용자 확인 필요**(§6). 무단 npm 추가 금지.

## 1. 왜 — 사진으로 책을 식별하는 올바른 도구

콜드스타트 OCR(#941, *본문 사진* → 첫 문장 → 그 텍스트로 책 추정)은 **본문 ≠ 제목**이라 책 식별이 구조적으로 불가능했고 #944 로 제거됐다. "사진으로 책을 등록하고 싶다"는 욕구 자체는 정당하다 — 다만 찍어야 할 것은 *본문*이 아니라 **뒤표지 바코드(EAN-13 = ISBN-13)** 다.

- 바코드 → **정확한 ISBN-13** → `books`/알라딘 **정확 매칭**(fuzzy 불필요, 오탐 0).
- 첫 책 등록·서재 추가의 **검색 타이핑을 진짜로 없앤다**. 책을 손에 들고 있을 때 가장 빠른 등록 경로.
- SLC: "한 컷에 정확히 책이 잡힌다"는 *delightful*. 단 **카메라 권한·미지원·실패 폴백(수동 검색)** 설계가 *complete* 의 조건(§4).

> **본문 OCR과의 관계**: 글귀 추출(읽기모드 단발 OCR [nest.md §5.6], 배치 강조 OCR §5.7)은 *이미 읽는 중인 책의 문장*을 담는 별개 기능 — 본 스펙(책 *식별*)과 목적이 다르다. 둘 다 유지.

## 2. 핵심 흐름 — 스캔 → ISBN → 매칭 → 등록

```
[바코드로 등록] 진입 (검색 모달 헤더 / 온보딩 — §3)
   │  (항상 노출 — capability gate는 카메라/수동 모드만 결정 §5)
   ▼
카메라 뷰파인더 (getUserMedia, facingMode:environment)
   │  BarcodeDetector.detect(video) 폴링 루프 (≈ rAF/250ms)
   ▼
EAN-13 rawValue 검출 → normalizeIsbn13() (숫자 13자리 검증)
   │     └ 실패(13자리 아님·체크섬 불일치)면 계속 스캔
   ▼
ISBN 해석 (§2.1)
   ├─ 1) 로컬 즉시:  BOOK_BY_ID[isbn]            (부팅 캐시 — 동기, 오프라인 OK)
   ├─ 2) 카탈로그:   loadBooks() 중 isbn 일치       (Supabase/인라인 폴백)
   └─ 3) 원격 단건:  ALADIN_PROXY?isbn=<isbn>       (ItemLookUp — 외서 보강 포함)
   ▼
책 1권 확정 → 기존 등록 경로 재사용
   onSelectBook(book, shelf)  ↔  handleSearchSelectBook  ↔  RG_registerBook
   (책장 선택 시트: 읽고싶어요/읽는중/완독 — search.js 와 동일)
   ▼
실패(어느 경로도 못 찾음) → 토스트 + 수동 검색 폴백(검색창에 ISBN 프리필)
```

### 2.1 ISBN → 책 해석 규칙 (오탐 0 보장)

1. **로컬 즉시 히트** — `window.BOOK_BY_ID[isbn]`. `data.js _indexBooks` 가 부팅 시 `id`·`isbn13` 양쪽 키로 채운다(#490 A). 동기·오프라인. 가장 빠름.
2. **카탈로그 스캔** — 1) 미스 시 `loadBooks()`(Supabase canonical / 장애 시 인라인 `RG_BOOKS` 12권 최소 폴백) 결과에서 ISBN 정확 일치를 탐색한다. 구 `books.tsv` 폴백은 #972로 제거됐다.
3. **원격 단건 조회** — 1·2 미스 시 `ALADIN_PROXY?isbn=<isbn>`(worker `aladinProxy` → `ItemLookUp`, 외서는 Google→OpenLibrary 보강 #529). 결과를 `{isbn13,title,author,publisher,total_pages,cover_url}` 로 매핑해 등록.
4. **모두 미스** — "이 바코드의 책을 찾지 못했어요" 토스트 + 검색 모달에 ISBN 프리필(수동 확인). **자동 등록 금지**(잘못된 책 등록 방지).

> **fuzzy 금지**: 매칭은 항상 **정규화 ISBN-13 정확 일치**만. 제목/저자 fuzzy 로 떨어지지 않는다 — 바코드의 본질(정확성)을 흐리지 않기 위함. (#944 가 본문→제목 fuzzy 의 실패를 보여줬다.)

## 3. 진입점 (Phase 0)

- **검색 모달 헤더** (`search.js SearchModal`): 검색 입력 옆 **"바코드/ISBN으로 등록"** 버튼(아이콘). **항상 렌더**(#943 후속) — capability gate(§5)는 *진입점 노출*이 아니라 *카메라 스캔 사용 여부*만 가른다. 미지원 브라우저(iOS Safari 등)·카메라 없음이면 모달이 **ISBN 직접 입력**으로 바로 열린다(수동 폴백, §4). `cameraSupported` prop 으로 전달.
- 검출 **또는 ISBN 직접 입력** → 책 확정 → `SearchModal` 의 `onSelectBook(book, shelf)` 로 위임(책장 선택 시트 재사용). 신규 등록 UI 없음.
- **ISBN 직접 입력 폴백**: 카메라 검출과 **동일한 `resolveBookByIsbn` 경로**를 공유(오탐 0 규칙 §2.1 그대로). 데모(물리 책 불필요)·iOS 웹·데스크톱 웹에서도 등록 경로 확보. 스캔 중에도 "바코드가 안 잡히나요? ISBN 직접 입력" 토글로 접근.
- **온보딩**(later): 첫 책 등록 단계에서 "바코드로 빠르게" 보조 진입. **본 PR 범위 아님**(검색 모달 우선 — 가장 재사용 경로가 짧음).

## 4. 실패·권한·엣지 (complete 의 조건)

| 상황 | 처리 |
|---|---|
| `BarcodeDetector` 미지원 (iOS Safari·구형) | 모달이 **ISBN 직접 입력**으로 바로 열림(`cameraSupported=false`). 진입점은 유지 — 등록 경로 확보. |
| 지원하나 `ean_13` 미포함 | 동일하게 ISBN 직접 입력(`getSupportedFormats()` 확인). |
| **네이티브 권한 선언 누락 (#1103)** | AndroidManifest `CAMERA` + iOS `NSCameraUsageDescription` 가 없으면 시스템이 권한 요청을 **띄우지 못한다**(증상: "권한 요청 자체를 안 함") → 둘 다 **선언 필수**. |
| 카메라 권한 거부 | 명확한 안내 + **ISBN 직접 입력** + "제목·저자로 검색하기"(검색 모달로 폴백). 무한 로딩 금지. |
| `getUserMedia` 실패(HTTPS 아님·장치 없음) | 동일 — ISBN 직접 입력 폴백. (프로덕션은 `https://readinggo.hyuniverse.workers.dev` — secure context OK.) |
| 검출은 됐으나 ISBN 13자리 아님(잡 바코드) | 무시하고 스캔 계속(토스트 스팸 금지). |
| ISBN 직접 입력이 13자리 아님 | "ISBN 13자리를 정확히 입력해주세요" 토스트, 재입력 대기(자동 검색 안 함). |
| ISBN 유효하나 책 못 찾음(§2.1-4) | 토스트 + 검색에 ISBN 프리필. |
| 모달 닫힘/언마운트 | `track`/`getUserMedia` 스트림 **반드시 stop**(카메라 LED·배터리 누수 방지) + 폴링 루프 취소. |
| **해석 중 닫힘/재열림 (#1162)** | `resolveAndRoute`가 세대 토큰(`tokenRef`)을 잡고 await 후 재확인 — 닫힘/재열림이면 결과 폐기(닫힌 모달에 setState 금지). `handleClose`·open effect 가 토큰 증가. |
| **해석 예외 후 스캐너 정지 (#1162)** | catch 에서 카메라면 `scanNonce`++ 로 open effect 재실행 → 카메라·디코드 루프 재시작(예외로 죽은 스캐너 부활). 미지원이면 'manual' 유지. |
| **후면 카메라 초점 이탈 (#1290)** | track capability에 `continuous` focus가 있으면 시작 직후 우선 적용한다. 지원하지 않거나 `applyConstraints`가 실패해도 디코드 루프는 계속한다. |
| **뷰파인더 탭 (#1290)** | 지원 track이면 탭 위치를 정규화한 `pointsOfInterest`와 single-shot focus/exposure를 best-effort 적용한다. 미지원이면 무반응으로 두지 않고 안내를 표시한다. |
| **계속 흐림/정지 (#1290)** | 하단에 "초점 다시 맞추기"와 "카메라 다시 시작"을 제공한다. 재시작은 기존 track·rAF를 먼저 정리한 뒤 새 세대로 연다. ISBN 직접입력은 항상 유지한다. |

- **개인정보**: 프레임은 **클라이언트에서만** BarcodeDetector 로 디코드 — **이미지 업로드 0**. (OCR 과 달리 서버 왕복 없음.) 분석엔 ISBN·성공여부만.
- **분석 이벤트**(systems/analytics 합류): `barcode_scan_opened`, `barcode_detected`(matched: local|catalog|aladin|none), `barcode_register`(book_id).

## 5. Capability gate (무의존 핵심)

```js
// barcode-scan.js — 카메라 스캔 사용 여부(진입점 노출 조건 아님 — #943 후속).
//   false 면 모달이 ISBN 직접 입력으로 열림. 비동기(getSupportedFormats) 1회 캐시.
async function barcodeScanSupported() {
  if (!('BarcodeDetector' in window)) return false;
  try {
    const fmts = await window.BarcodeDetector.getSupportedFormats();
    return Array.isArray(fmts) && fmts.includes('ean_13');
  } catch { return false; }
}
```

지원은 정적 브라우저 표가 아니라 `barcodeScanSupported()`의 API + `ean_13` 런타임 검사로 판정한다. 미지원이면 버튼을 숨기지 않고 `cameraSupported=false`로 ISBN 수동 입력을 연다.

| 환경 | `BarcodeDetector` | 비고 |
|---|---|---|
| Android Chrome / 삼성 인터넷 | ✅ | 본진(한국 안드로이드 점유 높음). Phase 0 즉시 가치. |
| 데스크톱 Chrome/Edge | ✅ (대체로) | 웹캠. |
| iOS Safari / iOS 모든 브라우저(WebKit) | ❌ | **셸(#872) 위 네이티브 플러그인(§6 옵션 c)로만 해결** → Phase 2. |
| 데스크톱 Firefox | ❌(플래그) | 숨김 처리. |

→ **결론**: Phase 0 웹에서 *지원 환경엔 무의존 delightful(카메라 스캔)*, *미지원 환경엔 ISBN 직접 입력으로 등록 경로 유지*(더는 숨기지 않음 — #943 후속). iOS 풀커버(네이티브 스캔)는 셸 단계에서 별도 결정.

## 6. 옵션 비교 + 권장안

| 옵션 | 의존성 | iOS Safari | 구현 비용 | Stack Lock |
|---|---|---|---|---|
| **(a) 웹 `BarcodeDetector`** | **0 (브라우저 네이티브)** | ❌ (숨김 폴백) | 낮음 (이 PR) | **불필요** — OCR 웹해제(v8)와 동급 선례 |
| (b) `@zxing/library` 등 JS lib | **+1 npm (≈ 수백 KB)** | ✅ (WASM/JS 디코드) | 중 | **결정 필요** — 새 런타임 의존성 |
| (c) `@capacitor-mlkit/barcode-scanning` | +1 npm + 네이티브 | ✅ (셸 안에서) | 중 (셸 전제) | **결정 필요** — 네이티브 플러그인(iOS-PLAN Phase 2) |

**트레이드오프**

- **(a) BarcodeDetector** — *유일한 무의존 옵션*. 본진(안드로이드)을 즉시 커버, 미지원 환경은 graceful 숨김. 한계는 iOS 웹. **SLC·Stack Lock 양쪽에서 최적의 첫 수**.
- **(b) @zxing** — iOS 웹까지 커버하지만 번들 +수백 KB(현재 무빌드→Vite 전환 직후 민감)·런타임 의존성. iOS는 어차피 (c) 셸로 가는 게 자연스러워 (b)의 추가 가치가 *좁다*. **현 시점 비권장**(필요 판명 시 별도 lock PR).
- **(c) Capacitor MLKit** — iOS/안드로이드 셸의 *정답*(네이티브 카메라·MLKit 정확도). 단 셸(#872) 안에서만 의미, 새 네이티브 의존성. **iOS-PLAN Phase 2 로 유지** — 이때 lock 결정.

**권장 (단계)**

1. **지금 (Phase 0 웹)**: **(a) `BarcodeDetector` 무의존 채택**. 검색 모달 진입 + ISBN→`BOOK_BY_ID`/알라딘 매칭 + 책장 시트 재사용. 새 의존성 0.
2. **iOS 셸 (Phase 2, #872 위)**: (c) `@capacitor-mlkit/barcode-scanning` 로 iOS·미지원 환경 커버 — **그때 Stack Lock 결정 PR**. (a) 코드는 capability gate 로 공존(셸은 (c), 웹은 (a)).
3. **(b)는 보류** — iOS 웹이 셸 출시 전 *반드시* 필요하다고 판명될 때만 재론.

### 6.1 기존 결정과의 정합

- [meta/decisions.md] `v5.1 — 바코드 스캔 책 등록 채택`(Phase 1 P1, `@capacitor-mlkit/barcode-scanning`)은 **네이티브 전제**였다. 본 스펙은 그 결정을 **폐기하지 않고 갱신**: Phase 0 웹은 무의존 (a)로 *선행*, 네이티브 (c)는 셸 단계로 유지(둘은 배타 아님, capability gate 로 공존).
- [ROADMAP.md] "바코드 스캔 = 보류(네이티브 의존 → Phase 3)" 행도 본 스펙으로 **부분 해제**(웹 (a)는 Phase 0 가능). ROADMAP 갱신은 후속(이 PR은 spec 신설 + 무의존 프로토타입에 집중).
- 선례: **OCR 웹해제**(v8, 2026-06-11 — 네이티브 보류였던 OCR을 *웹 기반*이면 Stack Lock 대상 아님으로 해제). 바코드 (a)는 *더 강한* 무의존(서버 왕복도 0)이라 동일 논리가 그대로 적용된다.

## 7. 구현 메모 (Phase 0, 무의존)

- 새 파일 `js/barcode-scan.js` — `BarcodeScanModal`(뷰파인더 + 디코드 루프) + `barcodeScanSupported()` + ISBN 해석기. `window.BarcodeScanModal` 전역 노출(파일 끝 `window.X=X` 패턴). `main.js` 에서 `search.js` 다음 import.
- **카메라**: `getUserMedia({ video:{ facingMode:{ideal:'environment'}, focusMode:{ideal:'continuous'} } })` → `<video autoplay playsinline muted>` → `requestAnimationFrame`(또는 250ms) 루프에서 `detector.detect(videoEl)`. 제약은 capability 확인 뒤 best-effort로 적용하며, 미지원/실패가 스캔 자체를 막지 않는다. 검출 시 루프 정지 + stream stop.
- **초점 UX (#1290)**: 시작 직후 `track.getCapabilities()`/`getSettings()`를 읽어 continuous autofocus 지원 여부를 판단한다. 뷰파인더 탭은 지원 환경에서 정규화 좌표 `pointsOfInterest` + single-shot focus/exposure를 시도하고, 항상 짧은 시각 피드백을 준다. 하단에는 초점 재시도·카메라 재시작·ISBN 직접입력을 함께 둔다.
- **매칭 재사용**: `normalizeIsbn13`(data.js) + `window.BOOK_BY_ID` + `window.loadBooks` + `RG_CONFIG.ALADIN_PROXY`. 등록은 `onSelectBook`(=`handleSearchSelectBook`). **신규 등록/저장 로직 0** — 전부 기존 경로.
- **정리(cleanup)**: `useEffect` 반환에서 stream track stop + rAF cancel + detector 참조 해제. 모달은 닫힘/언마운트/검출 성공 모두에서 카메라를 끈다.
- **DESIGN.md**: 전체화면 어두운 뷰파인더 + 중앙 가이드 프레임(EAN 가로 비율) + 하단 "직접 검색" 보조버튼(3차/텍스트 위계). 1차 솔리드 버튼은 결과 확정(책장 시트)에서만.

## 8. 미해결 / 후속

> **#1290 분리**: 이 정합 PR은 바코드 버튼/입력 포커스 구현을 흡수하지 않는다.

- 온보딩 첫 책 단계 진입점 추가(§3) — 별도 PR.
- iOS 셸 (c) 플러그인 도입 + capability 분기(셸=네이티브, 웹=BarcodeDetector) — Phase 2, Stack Lock 결정 동반.
- ISBN-10(구간 도서) 입력 시 → ISBN-13 변환(978 prefix + 체크섬) 후 매칭 — 현재는 EAN-13(=ISBN-13)만. 필요 판명 시 추가.
- 다중 검출(한 프레임에 여러 바코드) 시 가장 큰/중앙 우선 — 현재 첫 EAN-13 채택. 실사용 데이터로 튜닝.
- Android Chrome/Capacitor Android의 실제 기기별 autofocus·tap-to-focus 지원 편차는 실기기 검증표로 남긴다. 웹 API 미지원 기기는 ISBN 직접입력이 최종 폴백이다.
