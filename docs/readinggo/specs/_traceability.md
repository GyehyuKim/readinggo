# 스펙 ↔ 구현 추적 매트릭스 (spec-align 리뷰)

> `loop/spec-align-full/PROMPT.md` 산출. **상태**: ✅구현 · 🔧이번정합 · ❌누락(이슈) · 🚩스펙드리프트(수정필요) · ⏳Phase미도래.
> nest/social/profile/village/onboarding/backend는 grep 실측 검증, systems/design은 owner(승원) 영역이라 갭만 표시. 클로즈베타까지의 QA1~7로 대부분 동기화됨.

## nest.md (둥지) — owner 승원
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §5.1 상단바·진화배너·둥지자람·캐러셀 | ✅ | app.js topbar · nest.js NestTheatre/twigs/switchBook |
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
| 질문 품질(반복방지·책맥락·난이도) · 평가👍👎 · 재생성🔄 · 방향성 프리셋 | ⏳ | 백로그 #373·#371·#372·#375 (실사용 피드백 기반) |

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
| §5.8.6 AI 카드 — 참새의 완독 회고(v7.4) | ✅ | #259/#345 회고 + #352 영속화. 다음책 추천/추출(`ai.recommendBooks`·`extractBook`)은 Phase1 ⏳ |
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
| §7 알라딘(검색≠쪽수, ISBN 보강) | ✅ | aladin.js·worker (#233) |
| ai.* Gemini · inquiries 자동응답 | ⏳ | stub / 컬럼만(#208) |

## design.md — owner 승원
| 디자인 토큰·컴포넌트 | ⏳ 미심층 | owner 승원 — 토큰(index.html `:root`) vs design.md 대조는 승원이 |

## meta/decisions.md
결정 이력(§8.0~8.8) — 매칭 기준 컨텍스트. 자체 구현 대상 아님.

---
**v7.4 갱신 (2026-06-10)**: companion(LLM solar-pro3·멀티턴·문장대화·동의·아카이브) ✅, 둥지 책분리 ✅(#313), 성컬렉션 그리드 ✅(#312), BookCover ✅(#316), export 상세화 ✅(#315), 게스트 우선 ✅(#298), ErrorBoundary ✅(#310), PostHog 이벤트 ✅, 동의 배너 ✅(#331). 해소: nest CTA·미션(#252)·Top3(#286)·스포일러토글(#3). 보류: 휴식코스(parking-lot), 문의 LLM(#208).

**v7.4.1 갱신 (2026-06-10, post-merge)**: 외서 검색 5+5 ✅(#302/#343), export 책 소개 ✅(#316/#344), 공개전환 체크리스트 ✅(#178/#344), 참새 완독 회고 ✅(#259/#345). spec-align: nest.py v7.2 현실로 갱신(getNestStage·NestView=function 선언형, ActiveBookSheet→캐러셀 #185, MissionModal→CheckinModal) → 10/10. backend.md Netlify→Cloudflare Worker 잔재 정정.

**남은 이슈 후보 (2026-06 감사 #877)**: ❌ **inquiry-sync.md(#701)** 문의→GitHub 이슈 동기화 — spec만, 코드 0(scheduled은 archive+prewarm만) · ❌ **companion-reading-end.md(#347)** 읽기종료 참새 — spec만, 코드 0 · ⏳ AI 다음책 추천·추출(stub, Phase1) · ⏳ companion 질문품질(#371-375) · 🗑️ **onboarding.js**(OnboardingFlow) 데드코드 — main.js 미import, app.js가 자체 로그인 구현 → 삭제 권장.
> seed-collector(✅ 구현됨 — `collector/` + worker 시드 파이프라인)는 매트릭스 미등재 — 가시성 위해 추후 행 추가.
> 해소됨: companion_sessions 실행·실증 ✅ · spec-drift CI ✅(#351, drift.py PASS) · 스포일러 spec 문구(#177).

---
**v7.4.2 갱신 (2026-06-11, post-merge 2)**: 외서 빈자리 보충 ✅(#350), 회고 영속화 ✅(#352), 한 문장 삭제 ✅(#358·둥지/책상세), 즉시 관리 id 전달 ✅(#358), 인용/내 생각 구분 ✅(#359·#360), 시간차 되감기 ✅(#346/#364), 게스트 데모 정합 ✅(#366·#367), spec-drift CI ✅(#351), 행동데이터 분석 ✅. SQL: 18~21(companion_sessions·companion_recap·sentence.kind·last_resurfaced_at) 전부 실행. 게이트 8종 green(align34·nest10·village·drift·contract·worker·biome·mdlint).

**신규 백로그 (실사용·분석 발견, 2026-06-11)**: #370 해자 데이터 누수(게스트 대화 미보존) · #371 질문 평가👍👎 · #372 질문 재생성🔄 · #373 질문 품질(반복·책맥락·난이도) · #375 질문 방향성 프리셋 · #374 책 오표시(OPEN PR).

**owner 윤지 (코드는 머지, spec PR 대기)**: #346 되감기(코드 #364 머지) · #347 읽기 종료 시 참새(미착수).
