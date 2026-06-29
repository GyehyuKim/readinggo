# 유연 도서기록 임포트 — 붙여넣기 → LLM 파싱 (#1039)

> **신설 (2026-06-29)**: 김문 님(소수책방)처럼 **쌓아온 도서기록**(노션·엑셀·구매내역 표·메모 복붙)을 "개떡같이 넣어도 찰떡같이" 받아주는 임포트 1순위 경로. 독서 이력 이주 마찰 = 신규 유저 최대 장벽 중 하나(#1039).
> **핵심 결정**: 텍스트가 있는 소스는 **붙여넣기 → 텍스트 LLM 파싱**이 1순위, **스크린샷 + 비전**([integrated-shelf.md §4](./integrated-shelf.md) / #772)은 *글자를 못 뽑는 소스*용 폴백으로 재배치.
> **재사용 원칙**: 매칭·검수·등록·검토함 코어는 [integrated-shelf.md](./integrated-shelf.md)(`window.RG_shelfImport` + `DataStore.importStaging`)를 **그대로** 쓰고, **입력 어댑터(텍스트 vs 이미지)만** 새로 둔다.
> **편집 정책**: spec-only. 코드는 후속 PR. Stack Lock 준수(§6). [integrated-shelf.md](./integrated-shelf.md)는 참조만(편집 안 함).

## 1. 목적·전략

- **문제**: 헤비 독서러는 이미 어딘가(노션·엑셀·블로그·서점 구매내역)에 도서기록을 쌓아 뒀다. 그걸 ReadingGo로 옮기는 마찰이 크면 빈 서가로 시작 → 이탈.
- **왜 텍스트 1순위 (비용·정확도 근거)**: 텍스트가 있는 소스를 스샷으로 받으면 비전(Gemini) 호출이 들고(LLM 코스트↑), 표지 아트·UI·잘린 글자 때문에 회수율이 출렁인다. **실측([integrated-shelf.md §4.2](./integrated-shelf.md)): 표지 그리드 텍스트 OCR 0권 / 풀이미지 단일 비전 호출 1권 — 같은 정보가 텍스트로 있으면 LLM 파싱이 더 싸고(텍스트 토큰만) 더 정확(원문 그대로 읽음)**하다. 그래서 **텍스트 소스 = 붙여넣기 1순위, 스크린샷 = 폴백**으로 재배치한다.
- **전략 한 줄**: 입력 어댑터만 갈아끼우고(텍스트), 비싸고 검증된 **매칭·검수·등록·검토함 코어는 100% 재사용**한다.

## 2. 비목표·가드

- **타인 원문 무단 전재 금지(저작권)**: 본 임포트는 **서지 메타데이터 + 본인의 평가·상태·날짜**(사실 데이터)만 다룬다. 붙여넣은 텍스트에 타인 서평·책 속 문장이 섞여 있어도 **책 목록(제목·저자)만 구조화**하고 *감상·인용 원문은 본문으로 옮기지 않는다*. 근거·가드는 [legal-copyright.md](./legal-copyright.md), [integrated-shelf.md §3](./integrated-shelf.md)(타인 원문 무단 전재 비목표).
- **대량 등록이 메인 UX가 되지 않게**([integrated-shelf.md §2](./integrated-shelf.md) 영혼 보존): 임포트는 *온보딩/빈 상태의 1회성 마중물*. 평상시 핵심 동선은 한 문장·짹·참새. 임포트된 책도 "한 문장 남기기"로 자연 유도.
- **외부 서점/이북 API 자동 연동 금지**([integrated-shelf.md §3](./integrated-shelf.md)): 개인 구매이력 비공개·약관 리스크 → 붙여넣기로 우회.
- **Stack Lock 준수**(§6): 새 프레임워크 0, 텍스트 LLM은 기존 프록시 재사용, 키 서버 보관.

## 3. 입력 (붙여넣기 텍스트 1순위)

- **1순위 — 붙여넣기 텍스트**: 사용자가 노션·엑셀·메모·구매내역 표 등에서 **복사한 임의 포맷 텍스트**를 큰 `textarea`에 붙여넣는다. 줄바꿈·탭·표·머리말·합계 행이 뒤섞여도 받는다("개떡같이 넣어도 찰떡같이").
- **후속(이번 범위 밖)**: **파일 업로드(CSV·TSV·마크다운)·노션 export(`.zip`/`.md`)** 직접 파싱. 같은 파싱·매칭·검수 코어를 타되 *입력 수집 단계만* 추가 — 후속 PR로 표기.
- **진입**: 내서재 빈 상태 CTA + 임포트 메뉴에서 "📋 붙여넣기로 가져오기"(스샷 복원과 나란히). 스샷 경로(#772)와 **형제 진입점**.
- **로그인 게이트**([integrated-shelf.md §4.7](./integrated-shelf.md) A 재사용): 검토함 스테이징이 로그인 전용이므로 본 경로도 **로그인 사용자 전용**. 미로그인(게스트)이면 모달 대신 `RG_login()` + 토스트. *비용 논거는 텍스트가 비전보다 약하지만(파싱이 저렴), 검토함·실계정 영속 논거(#1048 이유 ②)는 동일하게 성립 → 같은 게이트로 일관*.

## 4. LLM 파싱 (텍스트 프록시 재사용)

### 4.1 서버 — `POST /api/parse-books` (텍스트 LLM)

- **프록시 재사용**: `/api/wiki-ask`·`/api/companion`의 **형제** — worker의 공유 텍스트 LLM 호출(`callLLM`, solar-pro3/provider-agnostic)을 그대로 쓴다. **키는 서버 보관(클라 노출 금지)**. 새 모델·새 프레임워크 0(§6).
- **입력**: `{ text }` — 붙여넣은 원문 텍스트(상한 가드, 예: 32KB). 클라는 텍스트만 전송.
- **시스템 프롬프트**(`FLEXIBLE_PARSE_SYSTEM`, temperature 0.1): "임의 포맷의 도서 목록 텍스트에서 **책 항목만** 구조화. 각 책의 **제목**(필수)·**저자**, 그리고 텍스트에 *드러나 있으면* **상태**(읽음/읽는 중/읽고 싶음)·**별점**(0.5~5.0)·**날짜**를 함께. **불확실하면 제외(지어내지 말 것)**, **책이 아닌 줄(머리말·합계·페이지·UI·카테고리·서평 본문)은 무시**. 서평·감상·책 속 문장 원문은 **옮기지 말 것**(메타데이터만). JSON 배열 `[{title, author, status?, rating?, date?}]` 만."
- **파싱**: [integrated-shelf.md §4.2](./integrated-shelf.md)의 관용 파서(`parseShelfBooks`, 코드펜스·trailing comma 폴백 + `rating` 0.5단위 스냅·0.5~5.0 클램프)를 **재사용/확장**(`status`·`date` 정규화 추가).
- **출력**: `{ books, partial?, empty? }`. `status`는 `completed`/`reading`/`wish`로 정규화(매핑 못 하면 생략 → §5 기본값 라우팅).
- **실패/미설정**: LLM 미설정·키 없음 → `503 { demo:true }`(기존 패턴). 데모는 비활성 안내 + 수동 추가 폴백.

### 4.2 큰 입력

- 텍스트는 토큰 상한만 가드. 매우 긴 붙여넣기는 줄 경계로 **청크 분할 후 순차 호출 + 병합·dedup**(이미지 타일링 §4.2.1 패턴의 텍스트판). dedup·정규화는 `RG_shelfImport`의 `_norm`/`dedupeBooks` 재사용(NFC + 구두점 제거 완전일치). 대부분의 붙여넣기는 단일 호출로 충분 — 분할은 상한 초과 시만.

## 5. 매칭·검수·등록 (shelf-import 코어 재사용)

> **입력 어댑터만 다르고, 아래 전 단계는 [integrated-shelf.md §4.3~4.4·§4.7](./integrated-shelf.md)을 그대로 탄다.** 스크린샷 경로와 **같은 매칭·검수·등록·검토함 코어**를 공유한다(§7).

1. **매칭**([integrated-shelf.md §4.3](./integrated-shelf.md)): `RG_shelfImport.matchRows(books)` → 카탈로그(`loadBooks`) **랭크 매칭**(`rankMatch`, 제목 정확도 + 저자 가산, 보수 가드). 매칭 성공 → 카탈로그 `Book`(표지·메타). 미매칭 → **알라딘 보강**(`aladinLookup`, 표지·쪽수·ISBN, 비파괴 upsert #489). 끝까지 미매칭이면 "미확인"으로 최소 등록.
2. **검수**: 카드 목록(체크박스 + 제목·저자 인라인 편집 + 별점 ★ + "🔍 찾기" 재보강). [integrated-shelf.md §4.7](./integrated-shelf.md)의 매칭상태 3단계(매칭됨/확인됨/미확인, #1066) 표기 재사용.
3. **목적지 토글**(#1038 재사용): 검수 단계에서 **읽은 책(`completed`) / 읽고싶어요(`wish`) / 읽는 중(`reading`)** 일괄 선택. **단, 파싱이 행별 `status`를 줬으면 그 값을 기본 선택**으로 채운다(붙여넣기는 상태가 데이터에 있을 때가 많음 — 이미지보다 강점). 행별 status는 후속.
4. **검토함 적재**([integrated-shelf.md §4.7](./integrated-shelf.md) B 재사용): 검수 "담기" → `DataStore.importStaging.add(items)`로 **검토함(import_staging)** 적재(책장 직행 아님). 서재 "📦 가져온 책 · 검토" 뷰에서 항목별/일괄 **[내 서재로 이동]**(`commit` → `myBooks.addBatch`) / **[제외]**(`remove`). 어댑터·테이블·RLS 전부 재사용(신규 스키마 0, 단 §5.1 날짜 컬럼은 예외).

### 5.1 보존 — 상태·별점·날짜

- **상태**(`status`): 데이터에 있으면 그대로 목적지 라우팅(`addBatch` status). **없으면 기본값** → §8 **열린 결정**(계휴 확정 필요).
- **별점**(`rating`): 0.5~5.0 0.5단위 스냅 → `addBatch` item → `user_books.rating`([integrated-shelf.md §4.4](./integrated-shelf.md) 별점 보존 #1042 그대로). `wish` 경로는 별점 컬럼 없어 무시. 기존 user_book 재사용 시 **비어있을 때만** 채움(비파괴).
- **날짜**(`date`): 데이터에 읽은 날짜/완독일이 있으면 보존이 *목표*. **단 현재 `import_staging`·`addBatch` 표면은 status·rating만 운반**([integrated-shelf.md §4.7](./integrated-shelf.md)) → `date` 운반은 행(`rows.date`) → 검토함 row → `addBatch` item → `user_books`(완독일 컬럼)까지 **얇은 확장이 필요**(스키마 컬럼 유무 확인 후 backend.md PR 동반). 컬럼이 없거나 범위 밖이면 **상태·별점만 보존하고 날짜는 후속**으로 떨군다(무중단). 날짜 보존 범위는 §8 **열린 결정**.
- **메모/감상**: 본인이 직접 쓴 노트라도 임포트 본문 전재는 §2 저작권 가드와 충돌 소지 → **이번 범위 제외**(상태·별점·날짜만). 필요 시 별도 검토.

## 6. Stack Lock 정합 (CLAUDE.md)

- **AI(텍스트 LLM)**: CLAUDE.md AI lock(v9, 2026-06-20) — **텍스트 자유 사용** 안에 든다(도서 추천·파싱 등 용도 추가에 별도 lock 결정 불필요). **키는 서버 보관**(클라 노출 금지). → 텍스트 파싱 = 기존 프록시(`callLLM`, wiki-ask 형제) **확장**, 새 결정 불요.
- **DataStore 계약**: 피처 코드는 저장소 직접 호출 금지 — `importStaging`·`myBooks.addBatch`·`loadBooks`는 계약 경유([backend.md §7.2](./backend.md)). 신규 어댑터 메서드 0(있는 표면 재사용).
- **빌드/모듈**: React 18 + Vite. 신규 모듈은 #761 패턴(별도 js 파일 + `window.X`) — 입력 어댑터(텍스트 붙여넣기 UI)와 `RG_shelfImport.extractBooksFromText`(아래 §7)만 추가.

## 7. 스크린샷(#772)과의 관계 — 같은 코어, 입력만 다름

| 단계 | 텍스트 경로 (#1039, 본 spec) | 스크린샷 경로 (#772, [integrated-shelf.md](./integrated-shelf.md)) |
|---|---|---|
| **입력** | 붙여넣기 텍스트 | 이미지 업로드(표지 그리드·구매내역 스샷) |
| **추출** | `/api/parse-books`(텍스트 LLM, `callLLM`) → `RG_shelfImport.extractBooksFromText(text)` | `/api/shelf-import`(비전 1순위 + OCR 폴백) → `RG_shelfImport.extractBooks(file)` |
| **매칭** | `RG_shelfImport.matchRows`·`rankMatch`·`aladinLookup` | **(동일)** |
| **검수·목적지·별점** | 목적지 토글(#1038)·별점(#1042) | **(동일)** |
| **등록·검토함** | `importStaging.add` → `commit` → `myBooks.addBatch` | **(동일)** |

- **추출 앞단(입력 어댑터)만** 새로 만들고(`extractBooksFromText` — `extractBooks`의 텍스트 형제), `matchRows` 이후는 한 줄도 안 바꾼다.
- **재배치(임포트 1순위 = 텍스트)**: 텍스트가 있는 소스(노션·엑셀·데스크톱 웹·구매내역 표)는 본 경로가 1순위. **스크린샷 = 글자를 못 뽑는 소스**(모바일 앱 캡쳐·순수 표지 그리드·텍스트 선택 불가 화면)용 **폴백**. UI 카피·진입 순서로 텍스트를 먼저 권한다.

## 8. 결정·열린 결정 (계휴 확정 필요)

- **[결정]** 입력 1순위 = **붙여넣기 텍스트**(가장 유연). 파일·노션 export는 후속(§3). 근거: #1039 본문 Q1.
- **[결정]** 매칭·검수·등록·검토함 = [integrated-shelf.md](./integrated-shelf.md) 코어 **재사용**, 입력 어댑터만 신설(§7). 텍스트 LLM = 기존 프록시 재사용·키 서버 보관(§6).
- **[열린 결정 ① — 핵심] 상태 없을 때 기본 목적지**: 파싱이 행별 `status`를 못 줄 때 기본 책장.
  - **제안(미확정)**: `completed`(읽은 책). 이유 — 본 임포트의 1차 사용자(김문 님 등)는 *이미 읽은* 쌓인 기록을 옮긴다고 보는 게 자연스럽고, 스샷 경로 기본값(`completed`, #1038)과 일치. **단 계휴 확정 전까지 미확정**.
  - 대안: `wish`(보수적 — "읽고 싶음"으로 받고 사용자가 올림) / 검수 진입 시 사용자가 1회 선택 강제(기본값 없음).
- **[열린 결정 ②] 보존 범위**: 상태만? 상태+별점? 상태+별점+날짜? (#1039 Q2). 본 spec 제안 = **상태+별점은 코어 재사용으로 즉시, 날짜는 스키마 얇은 확장 동반 시(§5.1)**. 날짜를 이번에 포함할지(스키마 작업 감수) vs 후속으로 뺄지 = 계휴 확정.
- **[열린 결정 ③] 로그인 게이트**: 본 spec 제안 = 스샷과 동일하게 **로그인 전용**(검토함 일관성, §3). 텍스트는 저렴하니 게스트 파싱까지 허용할지 여부 = 계휴 확정(제안: 일관성 위해 게이트 유지).

## 9. 분석 이벤트

[analytics.md §3.1](./analytics.md) `window.rgTrack` 헬퍼. 스샷 경로의 `shelf_import_*`([integrated-shelf.md §4.6](./integrated-shelf.md)) **패턴을 미러**해 텍스트 경로 전용 이벤트를 둔다(퍼널에서 입력 출처 분리 가능).

```js
rgTrack('flexible_import_started', {})                  // 붙여넣기 임포트 진입(파싱 호출 직전)
rgTrack('flexible_import_parsed',  { count })           // LLM 파싱 결과 행 수
rgTrack('flexible_import_staged',  { count, status })   // 검토함 적재(목적지 토글값)
```

- **검토함 → 책장 이동(commit)** 은 입력 출처와 무관한 **공유 단계**(서재 검토함 뷰, library.js) → 기존 `shelf_import_registered` `{ count, status }`를 그대로 쓴다(중복 정의 안 함).
- **대안(더 가벼움)**: 신규 패밀리 대신 기존 `shelf_import_*`에 `source: 'text' | 'screenshot'` prop 추가로 단일 퍼널 비교. 채택 여부는 analytics owner(계휴) 후속.
- 필수=익명 집계([analytics.md §3.1](./analytics.md)). 텍스트 원문은 이벤트에 미포함(개인정보·저작권).

## 10. Phasing

| Phase | 범위 | 리스크 |
|---|---|---|
| **P1 (MVP)** | 붙여넣기 텍스트 → `/api/parse-books` → 매칭·검수(목적지 토글·별점) → 검토함 적재·이동. 상태·별점 보존 | 낮음(코어 재사용) |
| **P2** | 날짜 보존(스키마 얇은 확장, §5.1·§8 ②) · 큰 입력 청크 분할(§4.2) | 낮음~중 |
| **P3** | 파일 업로드·노션 export 직접 파싱(§3 후속) | 중(포맷 다양) |

## 11. 검증 체크리스트 (코드 PR마다)

- [ ] 텍스트 LLM 키 클라 미노출(Stack Lock §6) · 입력 상한 가드 · 실패 폴백 무중단(`demo`)
- [ ] 매칭·검수·등록·검토함은 `RG_shelfImport`·`DataStore.importStaging`·`myBooks.addBatch` **재사용**(신규 어댑터 메서드 0) — 입력 어댑터(`extractBooksFromText`)만 신설(§7)
- [ ] 상태·별점 보존(데이터에 있으면 그대로, 없으면 §8 ① 기본값) · 날짜는 스키마 있을 때만(§5.1)
- [ ] 저작권 가드(§2): 메타데이터만 구조화, 타인 서평·책 원문 본문 전재 0
- [ ] 로그인 게이트(§3) · 검수 "담기"=검토함 적재 · 서재 검토함서 이동/제외
- [ ] 영혼 보존([integrated-shelf.md §2](./integrated-shelf.md)): 임포트 후 "한 문장" 진입점 유지
- [ ] boot-smoke · spec-align · 프리뷰 통과
