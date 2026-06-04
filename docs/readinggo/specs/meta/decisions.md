# 미결 → 확정 결정 이력

> **Split from** `docs/2. specifications/_archive/readinggo-spec.md` v6 (2026-05-28 분할). 원 위치: §8. 변경 이력은 git log 참조.
> **편집 정책**: 이 영역 변경은 이 파일 PR로. spec-only PR 룰 ([LF](../../../1. research_and_lectures/lecture-frameworks.md#lf-week6-spec-only-pr)) 준수.

## 8. 미결 → 확정 사항

### 8.0 v7 결정 (2026-06-01, web-first 롤백 — 아래 v5/v6 표보다 **우선**)

> 충돌하는 v5/v6 행(운영자 짹·둥지 가속·독서모임·모이·주간 리그·Capacitor 등)은 v7로 **대체**됨. 기각 보존은 [rejected.md §14.2](./rejected.md).

**게임 메카닉 / 화면**

| 이슈 | v7 결정 | 담당 |
|---|---|---|
| 둥지 진화 기준 | **활성 책 진척률** 5단계 (누적 XP 아님) | nest (승원) |
| 누적 성취 | **성(🏰) 컬렉션** — 완독 1권 = 🏰 1개. `user_books(status='completed')` 파생. 둥지+프로필 양쪽 전시 | nest→profile |
| 둥지 시각화 | **"둥지가 자란다"**. The Path(세션 노드) **제거** | nest |
| 첫 7일 둥지 가속 | **제거** | nest |
| XP 차감 | **폐지**. 미기록 = 스트릭만 깨짐, 둥지·XP 존속. 1차 KPI = "하루 1회 방문" | systems |
| 친구 짹 → XP | **채택** (+1). XP 수치 SSOT = `systems.md` | systems |
| 챕터 완료 XP + 공유 카드 | 채택하되 **후순위** | systems |
| 휴식코스 (Pause) | **채택** (장기출장/시험기간용). 기간·빈도·스트릭 동결 **상세 미정** | systems (승원) |
| 그룹 기능 | **마을** (파트 마일스톤·파트별 랭킹). 독서모임·메가스트림·서브모임 **폐기** | village (윤지) |
| 마을 공동자산 (도서관/세계수) | **삭제** | village |
| 운영자 짹 | **제거** | — |
| 소셜 피드 범위 | **전체 공개** (팔로워 한정은 향후) | social (계휴) |
| 리액션 | **짹** 1종 + 책갈피 (👏🥹🔖 폐기) | social |
| 스포일러 | **페이지 기반 블라인드** — 읽는 책의 내 현재페이지 이후 가림 + **전역 토글**. 완독·미독서 책 전체공개. `is_private` 폐기 | social |
| 주간 리그 | **기능 삭제** | — |
| 완독 별점 + 소감 | **채택** (`user_books.rating`/`review_text`) | profile |
| 책장 구경 | **전체 공개** | profile |
| AI 도서 추천 | **나↔책 fit** (친구 매칭 아님). Gemini Flash 무료 + 서버리스 프록시. Phase 0 하드코딩. 개발=계휴 | profile/backend |
| AI 추출 책 | 유지 (Gemini, Phase 2 고도화) | profile |
| `sentences.my_note` | **유지** (높은 우선순위) | backend |
| `chapter_id` 자동매핑 | **제거** | backend |
| `claps` 타깃 | `to_session_id` → **`to_sentence_id`** (짹 = 한 문장 좋아요) | backend |
| 알림 다양성 | **후순위** (Phase 2 PWA 웹푸시 이후) | onboarding |
| 락인 정당화 카드 | **제거** | profile |
| 날짜 시뮬레이터 | **채택** (발표용, Phase 0) | nest |

**용어 (정본: [README §0.5](../README.md))**

| 개념 | v7 명칭 | 폐기어 |
|---|---|---|
| 일일 기록 콘텐츠 | **한 문장** (오늘 작성분 = "오늘의 문장") | 모이 |
| 좋아요 | **짹** | 박수 / 👏🥹🔖 |
| 독려 넛지 | **콕찌르기** (🪱) | 모이 보내기 |
| 결정 마찰 카피 | **제거** ("그냥 펴진 페이지 한 줄도") | — |

**스택 / 플랫폼 ([CLAUDE.md Stack Lock] · [backend.md §7](../backend.md))**

| 이슈 | v7 결정 |
|---|---|
| 형태 | **web-first** — Phase 0 정적 웹(반응형) / Phase 1 Supabase. PWA·네이티브 보류 |
| Capacitor | **보류** (Phase 3 재검토). OCR·STT 함께 보류 → 입력 마찰은 **OS 키보드 음성입력**으로 대체 |
| 빌드 | 현행 **React 18 CDN** 유지. Vite는 PWA 전환 시 재검토 |
| 백엔드 | Phase 0 `localStorage` / Phase 1+ **Supabase**. **DataStore 계약**으로 추상화 (어댑터 교체) |
| AI | **Gemini Flash 무료 티어** + 서버리스 프록시. 클라 키 노출 금지 |
| 배포 | **Netlify** (`resilient-licorice-f4b889`). GitHub Pages 폐기 |
| 푸시 알림 | **Phase 2 PWA 웹푸시** 이후 |
| Phase | 0 정적웹 / 1 Supabase(반드시 도달) / 2 PWA+AI고도화 / 3 native 재검토 |

**작업 분배 (3인)**

| owner | 파일 |
|---|---|
| **gyehyu** | `social.md` · `profile.md` · `backend.md` · `onboarding.md` · `meta/*` · `README.md` |
| **seungwon** | `nest.md` · `systems.md` · `design.md` |
| **yunji** | `village.md` (마을) |

---

### 8.1 v7.1 결정 (2026-06-04, QA 2차 — 지인 베타 6/7 직전. 충돌 시 §8.0 위에 **우선**)

> 클로즈베타 사용자 QA로 확정. 일부는 v7 결정을 **뒤집음**(⚠️). 구현=PR #175, 스펙=이 PR.

| 이슈 | v7.1 결정 | 담당 | 비고 |
|---|---|---|---|
| 정체성(닉네임/아이디) | **닉네임 1개로 통합(Model A)** — 표시이름/아이디 구분 제거. 고유·변경가능 닉네임(=`handle`)을 피드·프로필 표시. 내부 식별=불변 `users.id`(UUID) → 닉 변경해도 기록 유지 | profile/backend | 신규 |
| 닉네임 규칙 | `^[A-Za-z0-9_가-힣]{2,20}$`(대문자·20자 허용) + `users.handle` UNIQUE. 클라(`RG_VALIDATE`)/DB CHECK 동일 | profile/backend | v5/v6 `[a-z…]{2,16}` 대체 |
| **한 문장 비공개** | ⚠️ **`is_private` 재도입** — 페이지 블라인드와 **병행**. 본인이 한 문장을 비공개(나만 보기)로 토글(RLS 강제). 감상은 `note_private` 별도(클라 존중) | social/backend | **v7 "`is_private` 폐기" 뒤집기 — 팀 합의 필요** |
| 소셜 피드 | **팔로우/최근/추천 3탭** (구 "전체"→"최근"). 추천=내 서재 책을 읽는 타인의 최근 1주 한 문장(공유 책 유사도), 비면 최근 폴백 | social | v7 "전체 공개"의 팔로우 필터 구현 |
| 이메일 인증 | 베타 한정 **autoconfirm=ON**(확인메일 없이 즉시 로그인 — 기본 메일러 발송한도+인지불가 회피). 공개 전 off 또는 매직링크/OAuth만 | backend | 신규(운영) |
| 입력 검증 | 서버 `04_constraints.sql`(DB CHECK: 길이·범위·형식) + 클라 `RG_VALIDATE` **동일 규칙**. 정책 정본=`SECURITY.md` | backend | 신규(보안) |
| 데이터 내보내기 | 설정 → 내 프로필·책·한 문장 **JSON 내보내기**(데이터 주권/GDPR) | profile | #172 |
| 한 문장 모아보기 | 둥지 "전체 보기" → 모달(전체/책별/좋아요 + 읽었음 카운터) | profile | #171 |
| 상세 모달 닫기 | 책·타인프로필·책정보 모달에 ✕ 닫기 버튼 | social/profile | #169 |
| 교보 링크 | ISBN 직링크 깨짐(교보 고유번호 S…) → **검색결과 URL** | profile | #1 |
| 완독 별점·소감 | 완독 후에도 **수정 가능**(BookDetailModal) | profile/nest | #3 |
| 스트릭 캘린더 | 🔥 탭 → 최근 5주 캘린더(읽은 날 🔥·방패 지킨 날 🔵) | **systems/nest(승원)** | #173 — **승원 스펙 반영 필요** |
| 하단 탭바 고정 | 앱 높이 `100dvh` → main만 스크롤, 탭바 고정 | design(승원) | #7 — 스펙 반영 플래그 |

**플래그(타 owner 스펙 반영 필요)**: #173 스트릭 캘린더=`systems.md`/`nest.md`(승원), #7 탭바=`design.md`·#3 세리머니 입력=`nest.md`(승원) → 해당 owner가 자기 스펙에 반영. [open-issues](./open-issues.md) 참조.

---

### 8.2 post-beta 결정 (2026-06-04, Ralph 루프 2차. 충돌 시 §8.1 위에 **우선**)

> PR #180 코드, 이 PR 스펙. 구현=`gyehyu/features-post-beta`.

| 이슈 | 결정 | 담당 | 비고 |
|---|---|---|---|
| **#156 짹 초기 liked 상태** | SentenceCard 마운트 시 `claps.isMine(sentenceId)` 로드 → initialLikedRef delta 공식으로 취소(-1)·신규(+1) optimistic 계산. 양 어댑터에 `isMine` 메서드 추가 | social/backend | 버그 수정 |
| **#159 매직링크 로그인** | **이번 범위 제외** — Supabase SMTP 설정 별도 안건. 현행 이메일+비밀번호·Google OAuth 유지 | onboarding | 추후 논의 |
| **#161 운영 대시보드** | Phase 2 기본 버전 우선 구현: is_admin 전용 📊 버튼 + AdminDashboardModal(집계 4종). Phase 2 full(필터·그래프)은 베타 이후 | profile/backend | §5.8.9 참조 |
| **P2 이슈 포함** | #161·#167(NPC 피드 동작 확인) 이번 루프에 포함. NPC 피드는 기존 feed() 쿼리 NPC 포함 확인으로 완료 | — | #167 close |
| **이슈 일괄 정리** | #165·#166·#151·#150·#152·#167·#160 — PR #175·#174에서 이미 구현 완료, 이슈 close 처리 | — | 이슈 close만 |

---

### 8.3 post-beta 결정 2 (2026-06-04, 추가 라운드. 충돌 시 §8.2 위에 **우선**)

> 구현=`gyehyu/features-round2`, 스펙=이 PR. 통합 데모 배포=`gyehyu/deploy-integration`(Netlify `resilient-licorice-f4b889`).

| 이슈 | 결정 | 담당 | 비고 |
|---|---|---|---|
| **#179 한 문장 공개 범위** | ⚠️ **`is_private` binary → `visibility` 3단계 확장**: `public`(전체)·`followers`(상호 팔로워)·`private`(나만). Instagram 모델. **작성자가 공개해야만 타인에게 보임.** RLS 강제(`followers`=양방향 follows). 마이그레이션 `06_privacy_v2.sql`. **SSOT=[social.md §5.7.1](../social.md)** | social/backend | §8.1 "is_private 재도입"을 **대체** |
| **#159 로그인 방식** | **이메일 1회 가입 + 세션 유지**(Supabase 세션 자동 유지). 만료 시 재로그인. Google OAuth 병행. (§8.2 "매직링크 제외" **갱신**) | onboarding/backend | 재논의 결과 |
| **이메일 템플릿 브랜딩** | 확인·매직링크 메일에 **ReadingGo 브랜딩 + 문의처(readinggo.admin@gmail.com)** 삽입 — 사용자가 발신 출처를 신뢰하고 클릭하도록. `admin-cli.mjs email-template set` | backend(운영) | 신규(#1 맥락) |
| **#154 마을 Supabase 연동** | `village.js` 데모 하드코딩 → `DataStore.villages.listMine/listPublic/create/join` 실연동 | village(윤지) | 사용자 지시로 계휴 작업 |
| **#170 본인 마을 제외** | 추천 공개 마을 목록에서 내가 생성/가입한 마을 `filter` 제외 | village(윤지) | — |
| **#153 반별점 0.5** | 별 좌측 절반 탭=0.5점. nest.md §5.4 SSOT 반영 | nest(승원) | 스펙 반영(구현 승원) |
| **#157 스포일러 토글 위치** | social.js 헤더 우측 `🔓` — 현재 미배선, 배선 대상으로 명시 | social(승원) | 스펙 현행화 |

---

### 8.4 post-beta 결정 3 (2026-06-04, batch3. 충돌 시 §8.3 위에 **우선**)

> 구현·배포 완료=`gyehyu/batch3`(PR #187), 스펙=이 PR. **(2026-06-04 갱신) 읽기모드(#184)·캐러셀(#185)·1000자·페이지 명시는 nest.md §5.3/§5.4/§5.5에 반영 완료** — 승원 pending 해소.

| 항목 | 결정 | 담당 | 비고 |
|---|---|---|---|
| **#3·4·5 타인 프로필 페이지** | 모달→**전체 페이지**. 책장 6권+더보기(읽은/읽는중 필터) + 책 탭 시 그 사람 평점·후기·한 문장 드릴다운. `users.publicShelf`·`bookContrib` 추가. '보고싶은'은 wish RLS 비공개라 본인만 | profile/backend | profile.md §5.8.2 반영 |
| **#186 틴더 한 문장 카드** | 소셜 피드 '카드로 넘겨보기' → 스와이프 우=좋아요(짹+책갈피)/좌=넘김/아래=유예. Pointer Events 직접(Stack Lock) | social | social.md 반영 |
| **운영자 문의** | 설정 폼 → `inquiries` 테이블(09_inquiries.sql, RLS: 본인 insert/select+admin) → admin 대시보드 목록. LLM 자동처리는 Phase 2(Gemini) | profile/backend | DB 방식 채택 |
| **한 문장 1000자** | 인용 200→**1000자**(감상과 동일). 클라(config)+DB(07_sentence_1000.sql) | nest/backend | ⚠️ **nest.md §5.4 '200자' → 1000자 갱신 필요(승원)** |
| **한 문장=페이지 명시** | 입력 시 그 문장이 속한 페이지를 기록(진행률과 별개 개념). 읽기모드/체크인에 명시 | nest | ⚠️ **nest.md 반영 필요(승원)** |
| **#184 읽기 모드** | 둥지→독서 타이머+상시 한 문장 입력(북모리식). 새 ReadingMode | **nest(승원)** | ⚠️ **승원 nest.md 정의 필요 — pending** |
| **#185 활성 책 캐러셀** | 둥지 책 배너 좌우 ‹ › 리볼빙 전환(`RG_activateBook`) | **nest(승원)** | ⚠️ **승원 nest.md §5.3 반영 필요 — pending** |
| **#7 NPC 닉네임** | 영문→한글 형용사+동물 30종(08_npc_rename.sql, 적용됨) | backend(운영) | — |
| **마을 공유/나가기/알림** | 가짜 rgo.app 링크→실 공유 URL+Web Share(#8), `villages.leave` 실동작(#9), 알림 체크박스 라벨 명확화(#10) | village(윤지) | village.js — 윤지 검토 |
| **로그인 redirect** | `site_url`·`uri_allow_list`를 Netlify URL로(서버 적용됨) — OAuth 후 localhost 폴백 해소 | backend(운영) | — |

**(해소됨)** #184 읽기모드·#185 캐러셀·1000자·페이지 명시 → **nest.md §5.3/§5.4/§5.5 반영 완료**(코드=PR #187, 스펙=spec-nest-readingmode PR). #153 반별점은 nest.md §5.4 스펙 있고 **코드는 승원 구현중**.

---

### 8.5 post-beta 결정 4 (2026-06-04, QA3. 충돌 시 §8.4 위에 **우선**)

> 구현=`gyehyu/qa3-fixes`(PR #193), 스펙=이 PR. CI `spec-align` 게이트 가동(PR #192).

| 항목 | 결정 | 담당 | 비고 |
|---|---|---|---|
| **#148 책 검색 재설계** | **우리 DB(books) 즉시 검색**(`books.search` ilike) + 데모 + **알라딘 병합·중복제거**(isbn13 기준, DB→데모→알라딘 우선). **외국 작가 표기 변이(도스토옙스키/Dostoevsky)는 알라딘에 위임**(재발명 X). 알라딘 책 선택 시 `books` upsert(lazy-cache). Netlify `ALADIN_TTB_KEY` 설정 | backend/social | 키 없어 미동작이던 것 정상화 |
| **#170 마을 추천/검색 필터** | 추천·검색 둘 다 `myVillageIds` 제외(렌더 단계 이중 방어) | village(윤지) | 버그 수정 |
| **공개 범위 토글 라벨** | 아이콘(🌐/👥/🔒) → **텍스트 칩 "전체공개/친구공개/비공개"**(아이콘만은 헷갈림) | social/profile | UX |
| **틴더 카드 책표지** | 카드 중앙 상단에 표지·제목·저자(카드 본문 불변). 피드 임베드 author 추가 | social | #186 후속 |
| **앱 버전 체계** | `RG_VERSION`(config.js) = 베타 **0.XXX**. **publish 1회마다 +0.001 수동**(≈머지 PR 수). 설정 표시 + 문의에 `app_version` 첨부(10_inquiry_version.sql) → "어느 버전 문제/해결" 추적 | backend/profile | 시작 0.192 |
| **문의 답변 메일** | 문의 작성 시 **auth 이메일 캡처**(닉 변경 무관) → admin 대시보드 mailto 답장 + 상태 토글(open/answered/closed) | backend/profile | #189 |
| **세션 관리** | 멀티 디바이스 유지 + 설정 "다른 기기 로그아웃"(`signOut scope:others`). 기기별 목록은 Phase 2(#191) | profile/backend | #189 |

**스펙-우선 강제(거버넌스, PR #192)**: CI `spec-align` 잡이 PR마다 스펙↔구현 invariant 검사 + PR 템플릿 스펙 체크리스트. 앞으로 동작 변경엔 스펙/ invariant 동반 필수.

**Phase 2 이슈로 분리**: 대시보드 고도화(#190), 기기 관리자+실시간(#191), 활동 히트맵(잔디, 신규). nest 영역(읽기모드/캐러셀/반별점)은 승원.

---

### 8.6 post-beta 결정 5 (2026-06-05, Phase 2 일부 구현. 충돌 시 §8.5 위에 **우선**)

> 구현=`gyehyu/qa4-phase2`(PR #200), 스펙=이 PR. 사용자 합의 범위만(나머지 Phase 2 유지).

| 항목 | 결정 | 담당 | 비고 |
|---|---|---|---|
| **#195 활동 히트맵** | 프로필에 **GitHub식 잔디**(최근 26주 일별 읽은 쪽수, 농도 4단계). `sessions.heatmap(days)` + `addToday`가 `pages_read_today`(전일 대비 증분 누적) 기록. ActivityHeatmap 컴포넌트 | profile/backend | profile.md §5.8.10 |
| **#190 대시보드 A+B** | **A**: 실사용자(NPC 제외) 카드. **B**: 최근 7일 추세 막대(체크인)+가입(+N). `admin.stats`에 realUsers·trend 추가. C(리텐션 코호트·인기책)는 Phase 2 유지 | profile/backend | §5.8.9 확장 |
| **#191 멀티 디바이스** | **refetch-on-focus**만(탭 포커스 시 Supabase 상태 재로드 → 다른 기기 변경 반영). 기기별 목록 관리자는 보류(#191 유지) | backend/profile | 합의 범위 |
| **#153 반별점** | 좌측 절반 탭=0.5 (Ceremony·BookDetailModal). 코드=PR #199 | nest | 계휴 구현(승원 미push) |
| **로컬 dev 서버** | 라이브(Netlify)만 사용 → 로컬 8888 python 서버 종료. CI/CD(#198)로 main 머지=자동 배포 | ops | — |

**후속**: align_v7.py에 ActivityHeatmap invariant 추가(#200 머지 후 — 지금 추가 시 spec PR CI 빨간불).

---

### 8.7 post-beta 결정 6 (2026-06-05, QA5 폴리시·백로그. 충돌 시 §8.6 위에 **우선**)

> 사용자 라이브 QA로 발견·요청. 이슈 #202~208 등록. 일부 구현(읽기모드 종료=PR #209), 나머지 백로그.

| 항목 | 결정 | 이슈 | 담당 |
|---|---|---|---|
| 검색 UX | 로딩 중 "🔎 검색 중…"(0건과 구분) + 제목/저자 말줄임 | #202 | gyehyu/social |
| 읽기 모드 | **독서 종료 버튼**(최종 페이지 확인→진도/체크인) + 페이지 입력 견고화(빈칸=미상) + 진입버튼 2줄 가운데 + **읽기모드가 오늘의 짹 충족** + 카운터 한도 근처만 | #203 | nest |
| 책 쪽수 메타 | 알라딘 itemPage 누락 시 교보/기타 보강 또는 수동 입력. **챕터정보는 유료라 알라딘 고집 불필요** | #204 | backend |
| **프로필 정리** | 중간 스탯카드(둥지레벨/완독/스트릭/XP) **제거**(상단 중복), **XP 전면 제거**(의미 약함), **성 컬렉션 최상단**, 별점 **유효숫자**(4→4.0), 상단 검색아이콘 한 줄·높이 축소, 로고 역할 부여 | #205 | profile |
| 대시보드 차트 | 신규 가입 **NPC 제외**. 체크인=막대(하단 숫자)+가입=선(포인트 숫자) 분리 | #206 | admin |
| 활동 히트맵 | 읽은 쪽수 **채도 4단계** + **월 라벨**(GitHub식) | #207 | profile |
| 문의 LLM 자동응답 | DB 문의 → Hermes agent/전담 LLM(Gemini) 자동 응답. Webhook→Edge Function. 키 서버리스. inquiries.response 컬럼 | #208 | backend |
| 이메일 SMTP | 공개 전 autoconfirm OFF용 커스텀 SMTP(Resend 추천) | #178 | ops |
| 로컬 dev 서버 | 종료(라이브만). CI/CD 자동배포(#198) | — | ops |

**XP 결정 (2026-06-05 확정, 구현 #215)**: 승원 #210/#212가 XP/Lv를 재설계·도입 → **XP 개념 유지**. #205는 **프로필 중간의 중복 스탯카드만 제거**(상단 Lv/XP는 유지). XP 폐지 아님.

**구현 vs 스펙 (#215)**: 코드는 PR #215, 결정은 이 §8.7. SSOT 세부는 [profile.md §5.8.4/§5.8.9/§5.8.10](../profile.md)·[backend.md §7.2](../backend.md)에 반영(spec-only PR).

**🚩 nest.md 플래그 (승원)**: #203 "**읽기 모드 종료 = 오늘의 짹 충족**"(읽기모드로 기록 시 둥지 짹 CTA 숨김) 동작이 nest.js에 구현됨 → `nest.md §5.5`에 SSOT 반영 필요(승원).

---

### v5/v6 결정 이력 (참고 — 충돌 시 §8.0 우선)

| 이슈 | 결정 |
|---|---|
| "오늘의 문장" 강제/선택 | 강제 |
| 페이지 입력 UI | `[−1]` `[+1]` `[+10]` + 숫자 직접 입력 |
| 오늘의 문장 글자 수 | 최대 200자, TEXT |
| 사전 질문 | 전부 제거 |
| 초기 방패 | 0개. 첫 7일 +1. 사용 후 7일 보충. 최대 3 |
| 챕터 미정의 책 | 페이지 20%씩 5단계 (둥지 진화) |
| 피드 카드 반응 | 👏🥹🔖 3종 칩 (각 토글, 숫자 ±1) |
| 마을 둥지 카드 반응 | 콕찌르기(🪱 모이) 1버튼, 친구당 일 1회 |
| NPC 운영 | pg_cron + 시드 풀, LLM 없음 |
| NPC 핸들 | `@book_bear`, `@activist_raccoon` |
| 닉네임 변경 | 무제한 |
| 닉네임 규칙 | `^[a-z0-9가-힣_]{2,16}$` + 중복 X + 금칙어 |
| 알림 디폴트 | 21:00, 22:00 이후 설정 차단, 23:00 긴급 |
| 알라딘 API | Phase 0/1 미사용. 정적 파일 |
| 책 검색 | 클라이언트 fuzzy (Fuse.js + 자모 분해) |
| 노드의 단위 | 세션 1건 = 노드 1개 |
| 하단 탭 구성 | 둥지 / 마을 / 소셜 / 내서재 (4탭) |
| 주간 리그 | Phase 1부터. 본인+팔로잉+NPC, 주간 XP, 월요일 00:00 KST 리셋 |
| 다중 책 진도 | `user_books` 단위 독립 저장. `users.active_user_book_id`로 활성 책 지정 |
| 활성 책 전환 UI | 둥지 탭 진화 배너 탭 → 슬라이드업 시트 |
| 다중 책 스트릭 연속성 | 스트릭 = 책 무관, 유저 단위. 어떤 책이든 오늘 세션 1개 이상이면 +1. Path는 활성 책 1권만 표시 |
| 하루 여러 문장 | 첫 기록 = 세션+XP+스트릭. 이후 "문장 추가" = sentences만 추가, 세션/XP/스트릭 변동 없음 |
| 문장 페이지 입력 | D-2 및 홈 문장 추가 모달에 "어느 페이지에서?" 숫자 입력 (기본값 = 현재 세션 페이지) |
| C-1 Top10 | Phase 0 하드코딩 큐레이션 (요즘 10종 / 스테디 10종 고정). Phase 1+ DB rank 칼럼으로 교체 |
| 책 상세 구매 링크 | 교보문고 ISBN 검색 URL. Phase 1+ 어필리에이트 파라미터 추가 |
| 콕찌르기(🪱) 수신 효과 | **미결** — 현재는 넛지 전송만. Phase 1 설계 시 방패 연계 여부 결정 (구 "모이 수신 효과") |
| "모이" 용어 | 오늘 읽은 책에서 옮겨 적은 짧은 인용구·감상의 앱 내 브랜드명. DB 테이블명은 `sentences` 유지 |
| 소셜 리그 | 소셜 탭에서 제거 (5/14 회의). `league` 로직은 Phase 1 유지하되 소셜 탭 UI에서 노출 안 함 |
| 소셜 피드 범위 | 친구 필터 없음. 전체 사용자의 공개 모이 피드 노출 |
| 피드 리액션 | 짹(좋아요) 1종 + 책갈피(🔖) 분리. v4.3까지의 👏🥹🔖 3종 칩 폐기 |
| 관심 책 리스트 | 내서재 내 별도 섹션. 소셜 피드 책 상세에서 "관심 책에 추가" 로 저장. DB: `wish_books` |
| 책갈피 | 소셜 피드 모이 카드 우측 상단 🔖 → 관심 문장 저장. DB: `sentence_bookmarks` |
| ~~마을 탭 설계~~ | **v6 해소** — 독서모임 탭으로 전면 대체 ([§5.5](../village.md)) |
| 외부 노출 슬로건 | "하루 한 페이지, 한 문장에서 시작해요." (내부 Duolingo 레퍼런스 외부 비노출) |
| DB | 관계형 + `users.settings` JSONB |
| Phase 분리 | 0 데모 / 1 Supabase 웹 / 2 Android+FCM |
| **v5 — 결정 마찰 카피** | 모이 입력 화면 하단에 "그냥 펴진 페이지 한 줄도 좋아요. 좋은 문장을 고를 필요 없어요." 상시 표시 |
| **v5 — 첫 7일 보호 주축** | [§5.6](../village.md) 운영자 짹 (Y Combinator do-things-that-don't-scale 패턴) |
| **v5 — 첫 7일 둥지 진화 가속** | 첫 책에 한해 D1/D3/D7 일자 트리거로 🪵→🪹→🏠 진화. 8일차+는 페이지 기반 |
| **v5 — 친구 짹 = +1 XP** | XP를 *사회적 화폐* 로 감각시키는 즉시 보상 메카닉 |
| **v5 — 컷오프** | 자정 KST 유지. 새벽 3-4시 유예 채택 안 함 (사용자 행동 모순) |
| **v5 — 알림 카피 강화** | 23:00 긴급 알림 카피에 "30초만 — 한 줄만" 강조 추가 |
| **v5 — 외부 API** | OCR / 음성 받아쓰기 등 *비용 발생 외부 API* 학기 범위 전체 기각 ([§14](../meta/rejected.md)) |
| **v5 — Duolingo 벤치마킹** | 게이미피케이션 세부 설계 시 의도적으로 인용 끊고 ReadingGo 고유 컨텍스트에서 발상 ([§14](../meta/rejected.md)) |
| **v5 — 운영자 정의** | `users.is_operator` 신설. ✨ 표식. NPC와 분리 |
| **v5 — XP destination** | 미해결, 별도 안건으로 보존 ([§13](../meta/open-issues.md)) |
| ~~**v5 — T2 mini**~~ | **v6 해소** — 독서모임 탭 메가 스트림으로 흡수 ([§5.5](../village.md)) |
| ~~**v5 — T2 좀비 사용자 처리**~~ | **v6 해소** — 독서모임 가입자 전용 공개 원칙으로 대체 ([§5.5](../village.md)) |
| **v5.1 — Phase 재정의** | Capacitor 처음부터 단일 코드베이스. Phase 0/1/2/3 모두 같은 `src/` 위에서 진행 |
| **v5.1 — 모이 확장 필드 (`sentences.my_note`)** | 짧은 한 문장 강제(`text`) 유지 + *내 감상* 선택 필드(`my_note`) 분리. Rich Text 자유 노트 별도 타입은 [§13.5](../meta/open-issues.md) 학기 후 결정 |
| **v5.1 — 챕터 ID 자동 매핑** | `sentences.chapter_id` 신설. 모이 작성 시 페이지로 챕터 자동 식별 (`books_toc.csv` 기준) |
| **v5.1 — 북모리 전체 벤치마크 + 단계 로드맵** | `docs/readinggo/ROADMAP.md` 신설. 북모리 모든 피쳐 × Phase × 우선순위 매트릭스 |
| **v5.1 — 모이 → 이미지 카드 공유 채택** | Phase 1 P1. 북모리의 바이럴 루프 |
| **v5.1 — 태그 시스템 채택** | 모이·책 양쪽. Phase 1 P1 |
| **v5.1 — 바코드 스캔 책 등록 채택** | Phase 1 P1. `@capacitor-mlkit/barcode-scanning` |
| **v5.1 — 책 메타데이터 자동 채움 채택** | 알라딘 OpenAPI 무료. Phase 1 P1 |
| **v5.1 — 무작위 모이 회상 채택** | Phase 1 P1. 홈 카드 → Phase 2 위젯 확장 |
| **v5.1 — Annual Rewind 채택** | Phase 1 골격 → Phase 2 본 화면. 12월 활성화 |
| **v5.1 — 위젯·자동백업·다크모드·PIN 채택** | Phase 2 P1~P2 |
| **v5.1 — 수익 모델 검토** | 학기 후 별도 안건 ([§13.6](../meta/open-issues.md)). 어필리에이트(교보문고)만 Phase 1 파라미터 추가로 즉시 적용 |
| **v5.1 — Rich Text 자유 노트** | *별도 타입 신설은 보류*. 모이 확장 필드(`my_note`)로 흡수. 별도 타입 채택 여부는 학기 후 ([§13.5](../meta/open-issues.md)) |
| **v6 — 독서모임 탭** | 마을 탭 대체. 메가 스트림(자동) + 서브 모임(공개/비공개). 구경 불가. ([§5.5](../village.md)) |
| **v6 — AI 도서 추천** | 완독 후 Gemini 기반 다음 책 3권 + 한 줄 이유. 교보문고 어필리에이트 연결. Phase 2 |
| **v6 — AI 추출 책** | 완독 모이를 AI가 재구성 → 나만의 추출 책. 이미지/Markdown export. Phase 2 |
| **v6 — SNS 이미지 카드 세부 스펙** | profile §5.10 신설 예정이었으나 **미생성** — v7에서 **후순위** 강등 ([ROADMAP](../../ROADMAP.md)). 한 문장 카드 + 마일스톤 카드 |
| **v6 — 마일스톤 공유 카드** | 50일·100일 스트릭 달성 시 특별 confetti + 공유 카드 자동 생성. ([§6.3](../systems.md)) |

---

