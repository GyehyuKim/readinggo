# 운영자 대시보드 스펙 (admin dashboard)

> **신설 (#744, 2026-06-17)**: 운영자 대시보드 고도화 — 모달 → **풀페이지 인앱 뷰** 승격 + 분석 3종(완독/코호트 리텐션·콘텐츠 공명·PostHog 링크아웃). 데이터 전략은 [analytics.md §3.3](./analytics.md) 하이브리드(C)를 구체화.
> **편집 정책**: 이 영역(운영자 대시보드 구조·지표) 변경은 이 파일 PR로. spec-only PR 준수. 측정 이벤트 카탈로그는 [analytics.md §3.1](./analytics.md), 문의 동기화는 [inquiry-sync.md](./inquiry-sync.md).

## 1. 목적·범위

운영자(`is_admin=true`)가 제품 상태를 한 화면에서 본다. 소비자용 읽기 UI는 운영에 불필요하므로 **분리된 풀페이지**로 띄운다.

- **In**: `is_admin` 운영자.
- **Out (1차)**: 운영 카운트(현행) + 완독/코호트 리텐션 + 콘텐츠 공명 Top + 행동 퍼널·리플레이(PostHog 링크아웃).
- **비범위**: 일반 사용자 노출(권한 밖), PostHog Insight 임베드/Query API(후속), 별도 `/admin.html`(후속), 실시간 스트리밍.

## 2. 아키텍처 — 풀페이지 인앱 뷰

현행 `AdminDashboardModal`(modal, components.js #161)을 **전체화면 뷰로 승격**.

- **(1차 채택) 인앱 풀페이지 뷰**: `is_admin`이면 library 헤더 📊 → **모달 대신 전체화면 대시보드**로 진입(탭바·소비자 UI 숨김). 기존 앱 셸·Supabase 인증·`DataStore` **재사용**(SLC, 인증/번들 중복 없음).
- **진입**: 기존 `isAdmin` 게이트(`window.RG_ME.isAdmin`, library.js) 재사용. 버튼 진입(현행) 유지 + (선택) 운영자 로그인 시 자동 진입.
- **이탈**: 닫기 → 소비자 화면 복귀(운영자도 일반 사용 가능).
- **후순위**: 무거워지면(차트 라이브러리 등) 별도 `/admin.html` 독립 번들로 추출.

## 3. 섹션·지표 (1차)

### 3.1 운영 카운트 (Supabase, 현행 유지·정리)

기존 RPC(`admin.stats/inquiries/popularBooks/activeUsers`, SECURITY DEFINER + is_admin 가드, `12_admin_insights.sql` — 단 `admin.stats`는 `13_admin_stats.sql`, 드리프트 정정 2026-07-09)를 풀페이지 레이아웃으로 재배치.

- 핵심 수치: 가입자·활성 유저·완독·오늘 체크인·인기책 Top·문의(상태 토글, [inquiry-sync.md](./inquiry-sync.md)).

### 3.2 완독률 + 가입 코호트 리텐션 (Supabase, 신규 RPC)

- **완독률**: `user_books` status 분포 → 등록 대비 완독 비율.
- **코호트 리텐션**: `users.created_at` 주차별 코호트 × `reading_sessions.session_date` → N주 후 잔존(체크인 1회+). 표/히트맵.
- 신규 RPC(SECURITY DEFINER + `is_admin` 가드) — `12_admin_insights.sql` 패턴 따른 마이그레이션. 원시 행 노출 금지, 집계만 반환(§7 제약).

### 3.3 콘텐츠 공명 Top (Supabase)

- "어떤 문장·책이 반응을 끌어내나" — `claps`(짹) 많은 **문장 Top / 책 Top**. 동의·공개 범위 준수(공개 문장만, 익명 집계).
- 데이터 자산의 핵심(analytics.md §6, Phase 2 추천·Phase 3 B2B의 씨앗).

### 3.4 행동 퍼널·세션 리플레이 (PostHog 링크아웃)

- 인앱에서 직접 그리지 않고 **PostHog 콘솔 딥링크**:
  - **독서 루프 퍼널**: `book_opened → reading_session_end → sentence_added →`(완독) — #736로 이벤트 완비.
  - **온보딩 퍼널 / 세션 리플레이 / 리텐션** 바로가기.
- 외부 콘솔 강점 활용, 임베드/Query API는 후속(외부 의존·키 관리 트레이드오프).

## 4. 데이터 소스 매핑 (하이브리드 C)

| 지표 | 소스 | 비고 |
|---|---|---|
| 운영 카운트·완독률·코호트·공명 | **Supabase RPC** | 정답 수치·콘텐츠 조인·통제·프라이버시 |
| 행동 퍼널·리텐션 곡선·세션 리플레이·경로 | **PostHog (링크아웃)** | 탐색·리플레이 강점, 외부 콘솔 |

## 5. 진입·권한

- `is_admin=true` 만. RPC는 `is_admin` 가드(서버), UI는 `window.RG_ME.isAdmin` 게이트(클라).
- 미인증/비운영자에는 진입 버튼·뷰 모두 미노출.

## 6. 후속 (코드 PR)

1. **Supabase**: 코호트 리텐션·콘텐츠 공명 RPC + 마이그레이션(`admin_insights` 확장). 수동 적용([supabase-migrations-manual]).
2. **풀페이지 뷰**: `AdminDashboardModal` → 전체화면 뷰 승격(components.js/app.js 라우팅), 3.2–3.4 섹션 배선.
3. **PostHog 링크아웃**: 프로젝트(458802) 딥링크 상수.
