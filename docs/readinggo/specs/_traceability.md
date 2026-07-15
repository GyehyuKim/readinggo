# 스펙 ↔ 구현 추적 매트릭스 (spec-align 리뷰)

> `loop/spec-align-full/PROMPT.md` 산출. **상태**: ✅구현 · 🔧이번정합 · ❌누락(이슈) · 🚩스펙드리프트(수정필요) · ⏳Phase미도래.
> nest/social/profile/village/onboarding/backend는 grep 실측 검증, systems/design은 owner(승원) 영역이라 갭만 표시. 클로즈베타까지의 QA1~7로 대부분 동기화됨.

## nest.md (둥지) — owner 승원
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §5.1 상단바 진행 지표 | 🚩 | **#1086 결정 미구현, #1176 Telegram 디자인 검토 대기.** 스펙은 XP·Lv 숫자 노출을 폐지하고 둥지 단계·성·스트릭으로 통일하지만, 현행 `app.js`의 `topbar-stats`는 `XP {n}`·`Lv.{n}`만 렌더한다. 컴팩트 표기 승인 전 UX 코드 작업 금지; 승인 후 별도 코드 이슈/PR로 정합 |
| §5.1 진화배너·둥지자람·캐러셀 | ✅ | nest.js NestTheatre/twigs/switchBook |
| §5.2 **둥지=1,600 XP 주기(v8.1)** · 경계 성 획득·리셋 | ✅ | nest.js `_cycleXp(xp)=xp%1600`·`nestCastleCount=floor(totalXp/1600)`·1600경계 성획득+리셋(#520/#521). 2026-06 정합(구 🚩는 오표기 — 구현 완료) |
| §5.1 CTA·§5.4 일일미션 = 읽기모드 대체 | ✅ | #252 — nest.md §5.5 반영(읽기모드가 체크인 대체). CheckinModal 폐기 |
| §5.4 별점0.5·완독세리머니(읽기모드 위임) · §5.5 읽기모드(나가기✕) | ✅ | #300 finish→handleCheckin · ReadingMode |

## companion.md (LLM 독서 파트너 — v7.4 신설) — owner 계휴
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §4 LLM 연결(solar-pro3, provider-agnostic) | ✅ | #287 worker callLLM(env) · /api/companion · genCompanionQuestion |
| §2 멀티턴 대화(답→후속, 최대 3턴) | ✅ | #327 genCompanionFollowup · exchanges · 문장 하단 스레드 |
| §3 한 문장 탭→대화 모달 + 본문 편집 | ✅ | #326 CompanionModal/RG_openCompanion · #325 sentences.updateText |
| 책·작가 맥락 프롬프트 · reasoning 토글 | ✅ | COMPANION_SYSTEM · LLM_REASONING_EFFORT |
| DEMO 폴백(키없음/실패) | ✅ | companionMock(서버)·pickCompanionQ(클라) |
| 대화 아카이브 companion_sessions | ✅ | #295 18_*.sql + companionSessions.add. **실증: 동의+로그인 답변 3건 적재 확인(2026-06-11)** |
| §4.1 완독 회고 + 영속화 | ✅ | #345 mode:recap · #352 user_books.companion_recap(19_*.sql)·saveRecap·다시받기 |
| §2 인용 vs 내 생각 구분 수신 + 맥락 불명 되묻기 | ✅ | #359 COMPANION_SYSTEM 역할분리 · #360 kind(quote/thought, 20_*.sql)·읽기모드 토글·💭 표기 |
| §5 시간차 되감기(둥지 카드·대화 재개) | ✅ | #346 코드=#364 머지(last_resurfaced_at 21_*.sql·resurfaceCandidate·1일게이트). spec PR은 윤지(#346 OPEN) |
| 질문 품질(반복방지·책맥락·난이도) · 평가👍👎 · 재생성🔄 · 방향성 프리셋 | ✅ | 반복방지(#373 — worker `avoid` 직전질문 회피, index.mjs:327)·책맥락(#373 — `getBookBrief` 브리프 프롬프트 주입, index.mjs:314-318)·평가👍👎(#371)·재생성🔄(#372)·프리셋(#375, 작가시선 #936). **#373은 PR #378로 완료**(클라 아닌 worker 프롬프트 구현 — 감사 1차 오판 정정) |

## feed.md (소셜)
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §5.7 피드 3탭·짹·책갈피·본인비활성 | ✅ | social.js:27-29,60 · claps.toggle/isMine |
| §5.7.1 페이지 블라인드·visibility 3단계 | ✅ | components.js isSpoiler · library.js cycleVis |
| §5.7 "이번 주 신규 시작러 Top3" | ✅ | #286 social_newcomers_weekly RPC · social.js 상단 스트립 |
| **§5.7.1 친구 찾기 패널(NPC_SEARCH)** | ✅ | social.js `findOpen` 패널(#250) + users.search(양 어댑터). 2026-06 정합(구 ❌는 오표기 — 구현 완료) |
| §5.7.1 전역 스포일러 토글 🔓 | 🔧 | #3 토글 설정(⚙️) 이전 완료 · #177 검토완료(spec 문구 후속) |

## profile.md (프로필) — owner 계휴
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §5.8 성컬렉션·bio·내문장10+더보기·별점4.0·헤더정리 | ✅ | QA5/6 (#205·#226·#228) |
| §5.8.9 대시보드(인기책·활성·차트·문의) · §5.8.10 히트맵(채도·월) | ✅ | #190·#206·#208·#195·#207 |
| §5.8.4 쪽수 폴백·책갈피·회상 · export 상세화(v7.4) | ✅ | #204 · bookmarks/random · #315 export(메타·완독·날짜) · #316 책 소개(알라딘 description) |
| §5.8.1.1 성 컬렉션 책장 상세(최근10+그리드/검색/정렬/필터, v7.4) | ✅ | #312 ArchiveShelfModal |
| 공용 BookCover + 표지 placeholder(v7.4) | ✅ | #316 components.js BookCover · 외서 5+5(#302/#343, 알라딘5+Google5) · export 책소개(#316/#344) |
| §5.8.6 AI 카드 — 참새의 완독 회고(v7.4) | ✅ | #259/#345 회고 + #352 영속화. 다음책 추천/추출(`ai.recommendBooks`·`extractBook`)은 **Phase 0 하드코딩 시뮬 구현 ✅**(#946 — data.js `recommendNextBooks`·`extractBookSummary` + 양 어댑터 위임 + BookDetailModal 완독 카드). 실 Gemini 호출은 Phase 1+(§7.9) |
| 한 문장 삭제 (책상세·둥지 상세) | ✅ | #358 sentences.remove(양 어댑터)·책상세 🗑 · CompanionModal 🗑(rg:sentence-removed 이벤트) |
| 한 문장 책 제목 오표시(getBook 폴백) 수정 | ✅ | PR #374 — onArchive bookTitle 전달 + 둥지 카드 폴백 가드 |

## village.md (마을) — owner 윤지 — ⚠️ 폐기 (#440, 2026-06)
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| 마을 탭 자체 | ⚠️폐기 | #440 — village.js/town.js 제거, 소셜로 일원화. 이하 항목은 이력 |
| §5.5.4 3탭·프로필연결·짹·게시판 실작성자/권한 | ⚠️폐기 | QA6 (#219~225) town.js (제거됨) |
| 마을 Supabase 연동 | ⚠️폐기 | villages.* (게시판은 Phase0 in-memory `_topics`, 코드 제거됨) |

## systems.md (스트릭·XP·휴식) — owner 승원
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §6.3 XP 행동가중치·Lv · 스트릭·방패 | ✅ | #210/#212 · streak.bumpOnCheckIn · shield_log |
| 둥지=누적 XP(v7.4) | ✅ | #313 systems.md §6.3 갱신 — 둥지·XP 같은 누적축 |
| **휴식코스(Pause·동결)** | ⏳보류 | 이번 컨셉 정렬 X → parking-lot.md §1 (#126/#251 닫음, 재개조건 명시) |

## onboarding.md — owner 계휴
| §4 가입 A→C1→C2→D3·매직링크·닉네임규칙 | ✅ | onboarding.js · signInWithEmail · RG_VALIDATE/04_constraints |
| §4 E 게스트 우선(로그인 벽 제거·저장 시점 로그인, v7.3) | ✅ | #298 app.js showLogin·syncPendingToSupabase · 데모 시드 누수 수정 #332 |

## analytics.md (행동데이터·동의 — v7.x) — owner 계휴
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §3 PostHog 자동수집 + 커스텀 이벤트·identify | ✅ | #296 index.html · #293 rgTrack(book_opened/highlight_selected/answer_saved/reading_session_end) |
| §5 데이터 활용 동의 — 진입 배너(필수/전체/상세) + 설정 토글 | ✅ | #294 DataStore.consent · #331 ConsentBanner |
| §4 companion_sessions 아카이브 | ✅ | #295 18_*.sql 실행 완료 · 실유저 답변 3건 적재 실증(2026-06-11) |
| 행동데이터 분석(Supabase first-party + PostHog) | ✅ | 2026-06-11 분석: 퍼널 가입8→등록7→문장6→완독3 · 아카이브 동의타이밍 규명(#370) |

## resilience — owner 계휴
| 전역 ErrorBoundary(컴포넌트 크래시 격리) | ✅ | #310 app.js ErrorBoundary key={activeTab} |

## backend.md — owner 계휴
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §7.2 DataStore 계약 전반 | ✅ | datastore-supabase.js 메서드 표면 일치 |
| RLS 17테이블·SECURITY DEFINER(search_path+is_admin) | ✅ | /cso 검증 |
| §7 알라딘(검색≠쪽수, ISBN 보강) | ✅현행 | aladin.js·worker (#233). **#1044 로 소스 이전 예정**(§7.2.1) — 알라딘 OpenAPI ToS(영리·캐싱 금지) 회피 |
| ai.recommendBooks·extractBook (다음책 추천/추출) | ✅ | Phase 0 하드코딩 시뮬(#946) — data.js `recommendNextBooks`/`extractBookSummary`(L482-555) + 양 어댑터 위임 + book-detail-modal.js L139-149 UI 연결. 실 Gemini는 Phase 1+(§7.9). 구 "⏳ stub"는 #946 머지로 해소 |
| inquiries 자동 응답(LLM) | ⏳보류 | parking-lot §3(#208) — 컬럼만. 코어 아님, 재개조건 미충족 |
| §7.2.1 책 데이터 소스 이전(알라딘 ToS 회피, #1044) | ⏳스펙선행/코드후속 | 방향 확정(국중도 ISBN 서지=쪽수·표지 + 카카오 책검색=검색·표지, 외서 Google 실시간만). worker 재배선(`aladinProxy`·`normalize`·`imgProxy`·`googleBooksSearch` upsert·`archive` 인기시드)·출시 전 실계정 ToS 확인 게이트 4건은 §7.2.1. 코드는 후속 PR(#1044) |

## design.md — owner 승원
| 디자인 토큰·컴포넌트 | ⏳ 미심층 | owner 승원 — 토큰(index.html `:root`) vs design.md 대조는 승원이 |

## 신규 스펙 7종 (main 적재, 매트릭스 누락 → 본 PR 추가·실측) — owner 계휴(승원: nest 영역)
> v8.5 이후 main 에 머지됐으나 매트릭스에 미등록이던 스펙. js/** + worker/index.mjs grep 실측.
| 스펙 | 상태 | 근거/갭 |
|---|---|---|
| **share.md** (한 문장 외부 카드, #651) | ✅ | share-card.js `renderSentenceCardBlob`(htmlToImage)·`shareSentence`(navigator.share→클립보드 폴백)·sentence-card.js 진입. 구현 #670, QA #674/#677 머지 |
| **barcode-scan.md** (ISBN 스캔 등록, #943) | ✅ | barcode-scan.js `BarcodeScanModal`·`barcodeScanSupported`(BarcodeDetector)·`resolveBookByIsbn`(normalizeIsbn13→books/알라딘 정확매칭)·미지원 폴백(수동검색). search.js 연동 |
| **integrated-shelf.md** (빈 서가 박멸, #772·#774) | ✅ | ① 능동복원: shelf-import.js→`/api/shelf-import`(worker L559 비전OCR)·library.js 상시 진입점(#832). ② 수동시드: book-info-modal.js L64-96 마중물 큐→`/api/seed`(worker L817)+cron `prewarmSeeds`(L797). align_v7 invariant 락(L156) |
| **ota.md** (웹 번들 OTA, #876) | ✅코드/⏳번들호스팅 | **스펙·이슈는 "코드 후속"이라 적었으나 이미 구현됨**: main.js L60 `@capgo/capacitor-updater`·package.json·capacitor.config.json + worker `/api/ota`=`otaCheck`(L1204, KV 매니페스트·minNative 게이트) + wrangler.toml `OTA_KV`(L28). 남은 건 R2 번들 호스팅+매니페스트 발행 도구(Phase C, #979 OPEN). ota.md 헤더·#876/#979 트래커가 코드보다 뒤처진 **역드리프트**(스펙 헤더 정합은 owner 후속) |
| **referral.md** (서비스 외부 공유·referral, #650-B) | ⏳부분 | 보상없는 코드만 동선 ✅(#727 — share-card.js `shareService`, library.js L560). **referral 코드·`?ref=` 귀속·랜딩(§5)·보상(§4.2)은 미구현 — CEO 보상 검토 의존(정상 보류, 신규 이슈 생성 안 함)** |
| **co-reading.md** (같이읽기 방, #987) | ❌미구현 | 코드 없음(villages/village_members 스키마는 #440 마을 폐기 후 잔존, 재사용 예정). 활성 OPEN 이슈 **#987(P1)·#988(P2)** 가 추적 — 신규 이슈 불필요. byBook '함께 읽은 사람들' 집계는 Phase 1(#496) |
| **resurface.md** (시간차 되감기, #639) | ✅코어/🅿️확장 | 코어 되감기 ✅(#346/#364 — datastore-supabase.js `resurfaceCandidate` L334·`markResurfaced` L364·1일 게이트 L456). resurface.md 자체는 🅿️보류(확장은 Phase later, 정상) |

## meta/decisions.md
결정 이력(§8.0~8.8) — 매칭 기준 컨텍스트. 자체 구현 대상 아님.

---
**v7.4 갱신 (2026-06-10)**: companion(LLM solar-pro3·멀티턴·문장대화·동의·아카이브) ✅, 둥지 책분리 ✅(#313), 성컬렉션 그리드 ✅(#312), BookCover ✅(#316), export 상세화 ✅(#315), 게스트 우선 ✅(#298), ErrorBoundary ✅(#310), PostHog 이벤트 ✅, 동의 배너 ✅(#331). 해소: nest CTA·미션(#252)·Top3(#286)·스포일러토글(#3). 보류: 휴식코스(parking-lot), 문의 LLM(#208).

**v7.4.1 갱신 (2026-06-10, post-merge)**: 외서 검색 5+5 ✅(#302/#343), export 책 소개 ✅(#316/#344), 공개전환 체크리스트 ✅(#178/#344), 참새 완독 회고 ✅(#259/#345). spec-align: nest.py v7.2 현실로 갱신(getNestStage·NestView=function 선언형, ActiveBookSheet→캐러셀 #185, MissionModal→CheckinModal) → 10/10. backend.md Netlify→Cloudflare Worker 잔재 정정.

**남은 이슈 후보 (2026-06 감사 #877, 갱신)**: ✅ **inquiry-sync.md(#701)** — #890 구현(worker 크론 */10 + 32_*.sql, GITHUB_TOKEN 필요) · ❌ **companion-reading-end(#347)** — 읽기 종료 자동 진입 미출시(읽기모드 #505 폐기), **도입 안 함·스펙 삭제(2026-07-09)** · ✅ **seed-collector** — `collector/` poller + 멀티NPC(#841 등) · ⏳ AI 다음책 추천·추출(stub, Phase1) · ⏳ companion 질문품질(#371-375) · ✅ onboarding.js 데드코드 삭제(#888).
> 해소됨: companion_sessions 실행·실증 ✅ · spec-drift CI ✅(#351, drift.py PASS) · 스포일러 spec 문구(#177).

---
**v7.4.2 갱신 (2026-06-11, post-merge 2)**: 외서 빈자리 보충 ✅(#350), 회고 영속화 ✅(#352), 한 문장 삭제 ✅(#358·둥지/책상세), 즉시 관리 id 전달 ✅(#358), 인용/내 생각 구분 ✅(#359·#360), 시간차 되감기 ✅(#346/#364), 게스트 데모 정합 ✅(#366·#367), spec-drift CI ✅(#351), 행동데이터 분석 ✅. SQL: 18~21(companion_sessions·companion_recap·sentence.kind·last_resurfaced_at) 전부 실행. 게이트 8종 green(align34·nest10·village·drift·contract·worker·biome·mdlint).

**신규 백로그 (실사용·분석 발견, 2026-06-11)**: #370 해자 데이터 누수(게스트 대화 미보존) · #371 질문 평가👍👎 · #372 질문 재생성🔄 · #373 질문 품질(반복·책맥락·난이도) · #375 질문 방향성 프리셋 · #374 책 오표시(OPEN PR).

**owner 윤지 (코드는 머지, spec PR 대기)**: #346 되감기(코드 #364 머지) · #347 읽기 종료 시 참새(✅ 구현 — nest.js handleCheckin→companion #438).

---
**v8.4 갱신 (2026-06-23, #877 감사 + 출시 정합)**:
- **출시 반영** ✅: 작가 시선 preset(#936) · 스트릭 복구 + 마일스톤 회고(#940 A1/A2) · 콜드스타트 OCR 제거(#944 — 본문 사진→책 식별 불가, 사진→책은 바코드 #943로 대체 검토).
- **nav 라벨 드리프트 정합** 🔧: 실제 하단 탭 = **홈(`nest`) / 피드(`social`) / 책장(`profile`)** + 설정(`settings`, 바텀시트 액션 #567). 구 '소셜'→'피드'(#639, feed.md 기존 문서화) · '프로필'→'책장'(미문서 → 본 PR 정합). onboarding.md·README.md·feed.md §5.7·profile.md 동기화.
- **#877 감사 결과**: 둥지 1,600 XP(#520/#521) ✅ · 친구찾기 NPC_SEARCH(#250) ✅ · companion 평가👍👎/재생성🔄/프리셋 ✅, **질문 품질필터(#373 반복방지·책맥락) ✅ PR #378**(worker `avoid`+`getBookBrief` — 감사 subagent가 클라만 보고 worker 놓친 오판, 본 노트로 정정) · **AI 다음책 추천/추출 ⏳빈 stub**(datastore-supabase.js:1001, UI 미연결 — #946) · parking-lot 3건(#126/#191/#208) 재개조건 미충족(정상 보류).

---
**v8.5 갱신 (2026-06-23, spec 드리프트 catch-up #951/#953 + spec-first 신규)**:
- **계기**: 요며칠 ship 모드로 코드 42 커밋 중 spec 동반 ~1/3 — spec-first 마찰(2-PR)·CI 미강제·폴리시/기능 경계 모호로 드리프트. 키워드 grep은 커버리지 과대평가, 실제는 *stale spec*(코드와 모순)이 핵심.
- **#951 정정** 🔧: `nest.md §5.1`·`feed.md`가 책 상세 진입 = `BookInfoModal` 단정하던 걸 **소유 라우팅**(보유→`BookDetailModal`/미보유→`BookInfoModal`)으로 정정. 코드는 이미 ship됨, spec이 stale했음.
- **#953 문서화** ✅: 한 문장 카드 렌더 = 공용 `QuoteCard` SSOT(nest.md §5.1, 책장과 단일 컴포넌트).
- **신규 spec-first**: '이 책의 다른 한 문장'(콜드스타트 사회적 증거, 내 문장 <3일 때 타인 좋아요순 ~6–8) — nest.md §5.1에 코드 전 spec 기재(미구현).
- **남은 델타-audit 후보**(키워드 spec은 있으나 as-shipped 일치 미검증): 배치OCR #844·일괄입력 #848·계정삭제 #875·export #929·시드UI #828·인기랭킹 #835 — #877식 심층 대조는 별도. (본 PR은 *확인된* stale/zero만 처리.)

---
**v8.6 갱신 (2026-06-24, #877 심층 재감사 — 신규 스펙 7종 등록 + 델타 후보 전수 검증)**:
- **계기**: open 이슈가 적어 진행 가시성 낮음(#877 본문). 매트릭스가 v8.5 이후 main 적재 스펙 7종(share·barcode-scan·integrated-shelf·ota·referral·co-reading·resurface)을 **통째로 누락** → 본 PR로 섹션 추가하고 `js/**`+`worker/index.mjs` grep 실측으로 상태 확정(위 "신규 스펙 7종" 표).
- **#877 본문 알려진 갭 = 전부 구현 확인** ✅: 둥지 1,600 XP 주기(#520/#521, nest.js L23-37·265-282) · 친구찾기 NPC_SEARCH(#250, social.js L20-71·179) · companion 질문품질/평가👍👎/재생성🔄/프리셋(#371/#372/#373/#375 — companion.js + worker `avoid`/`getBookBrief`/`PRESET_TONE` L304-331) · AI 다음책 추천·추출(#946 — Phase 0 시뮬, data.js L482-555 + UI 연결). **이 갭들엔 신규 이슈 불필요(이미 구현)**.
- **v8.5 델타-audit 후보 6종 전수 검증 = 전부 ✅ shipped**(closed 이슈 + 코드/worker 엔드포인트 대조): 배치OCR #844(`/api/extract-highlights`+book-detail-modal.js L86) · 일괄입력 #848(batch-quote-import.js) · 계정삭제 #875(`/api/delete-account` worker L35) · export #423/#929(profile export) · 시드UI #828(book-info-modal.js+collector) · 인기랭킹 #835(social 랭킹). → 델타 후보 줄 **해소**.
- **v8.4 stale 정정** 🔧: 구 "AI 다음책 추천/추출 ⏳빈 stub(datastore-supabase.js:1001, UI 미연결 #946)"는 **#946 머지로 해소** — 이제 ✅(시뮬 구현 + book-detail-modal.js UI 연결). backend.md 표의 "ai.* ⏳ stub" 행도 ✅로 분리·정정.
- **역드리프트 발견(코드가 트래커보다 앞섬)** ⚠️: **OTA(#876)** 가 ota.md 헤더·#876/#979 이슈에선 "코드 후속/미구현"으로 표기되나 **이미 동작 코드 적재**(main.js capgo 플러그인 + worker `otaCheck` + `OTA_KV` 바인딩). 남은 건 R2 번들 호스팅(#979 OPEN). 스펙 헤더 정합은 owner(계휴) 후속.
- **신규 갭 이슈 = 0건(의도)**: 묻힌 *미추적* 진짜 갭이 없음 — 미구현분은 전부 활성 OPEN 이슈가 이미 추적(#876/#979 OTA · #987/#988 co-reading · #897 배포안전 epic) 하거나 의도적 보류(resurface 확장 #639 · referral 보상 CEO검토 · parking-lot 3건 #126/#191/#208 재개조건 미충족). 추측으로 이슈를 만들지 않음(#877 지침 "확실한 것만").
