# 스펙 ↔ 구현 추적 매트릭스 (spec-align 리뷰)

> `loop/spec-align-full/PROMPT.md` 산출. **상태**: ✅구현 · 🔧이번정합 · ❌누락(이슈) · 🚩스펙드리프트(수정필요) · ⏳Phase미도래.
> nest/social/profile/village/onboarding/backend는 grep 실측 검증, systems/design은 owner(승원) 영역이라 갭만 표시. 클로즈베타까지의 QA1~7로 대부분 동기화됨.

## nest.md (둥지) — owner 승원
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §5.1 상단바·진화배너·둥지자람·캐러셀 | ✅ | app.js topbar · nest.js NestTheatre/twigs/switchBook |
| §5.2 5단계·마이크로카피4·성컬렉션 | ✅ | data.js NEST_STAGES/EVOLVE · datastore castles.list |
| §5.1 CTA"오늘 기록하기"·§5.4 일일미션 모달 | 🚩 | CheckinModal **진입점 없음**(QA6 #217로 짹CTA 제거, 읽기모드가 체크인 대체) → nest.md §5.1/§5.4 갱신 필요 |
| §5.4 별점0.5·완독세리머니 · §5.5 읽기모드 | ✅ | Ceremony fillPct · ReadingMode |

## social.md (소셜)
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §5.7 피드 3탭·틴더카드·짹·책갈피·본인비활성 | ✅ | social.js:27-29,60 · TinderCards · claps.toggle/isMine |
| §5.7.1 페이지 블라인드·visibility 3단계 | ✅ | components.js isSpoiler · library.js cycleVis |
| **§5.7 "이번 주 신규 시작러 Top3"** | ❌ | social.js/components/data 어디에도 없음 → 구현 누락 |
| **§5.7.1 친구 찾기 패널(NPC_SEARCH)** | ❌ | social UI에 친구찾기 패널 미발견(backend users.search는 있음) |
| §5.7.1 전역 스포일러 토글 🔓 | 🚩 | 토글이 설정(⚙️)으로 이전(#3)인데 spec은 "헤더 우측 🔓 미구현(#157)" → drift |

## profile.md (프로필) — owner 계휴
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §5.8 성컬렉션·bio·내문장10+더보기·별점4.0·헤더정리 | ✅ | QA5/6 (#205·#226·#228) |
| §5.8.9 대시보드(인기책·활성·차트·문의) · §5.8.10 히트맵(채도·월) | ✅ | #190·#206·#208·#195·#207 |
| §5.8.4 쪽수 폴백·책갈피·회상 | ✅ | #204 · bookmarks/random |
| §5.8.6 AI 추천/추출 | ⏳ | datastore `ai.recommendBooks()→[]`·`extractBook()→null` 빈 stub (Phase0 시뮬도 미구현) |

## village.md (마을) — owner 윤지
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §5.5.4 3탭·프로필연결·짹·게시판 실작성자/권한 | ✅ | QA6 (#219~225) town.js |
| 마을 Supabase 연동 | ✅ | villages.* (게시판은 Phase0 in-memory `_topics`) |

## systems.md (스트릭·XP·휴식) — owner 승원
| 조항 | 상태 | 근거/갭 |
|---|---|---|
| §6.3 XP 행동가중치·Lv · 스트릭·방패 | ✅ | #210/#212 · streak.bumpOnCheckIn · shield_log |
| **휴식코스(Pause·동결)** | ❌ | 코드에 pause/동결 없음 → 미구현 (decisions §8.0 "채택·상세 미정", #126 승원) |

## onboarding.md — owner 계휴
| §4 가입 A→C1→C2→D3·매직링크·닉네임규칙 | ✅ | onboarding.js · signInWithEmail · RG_VALIDATE/04_constraints |

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
**이슈 후보 요약**: ❌ social Top3 · social 친구찾기 패널 · systems 휴식코스(#126) / 🚩 nest CTA·미션(§5.1/5.4) · social 🔓 토글 drift / ⏳ AI stub · 문의 LLM(#208).
