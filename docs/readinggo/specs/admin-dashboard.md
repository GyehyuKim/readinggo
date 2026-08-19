# 운영자 대시보드 스펙 (admin dashboard)

> **신설 (#744, 2026-06-17)**: 운영자 대시보드 고도화 — 모달 → **풀페이지 인앱 뷰** 승격 + 분석 3종(완독/코호트 리텐션·콘텐츠 공명·PostHog 링크아웃). 데이터 전략은 [analytics.md §3.3](./analytics.md) 하이브리드(C)를 구체화.
> **편집 정책**: 이 영역(운영자 대시보드 구조·지표) 변경은 이 파일 PR로. spec-only PR 준수. 측정 이벤트 카탈로그는 [analytics.md §3.1](./analytics.md), 문의 직접 대응 정책은 [inquiry-sync.md](./inquiry-sync.md).

## 0. v17 상태 경계

- "공개 문장·익명 집계"는 승인된 목표다. 현재 RPC·adapter가 사용자 UUID나 문장 본문을 반환할 수 있는 as-built와 동일한 상태로 표시하지 않는다. 원시 식별자·본문 반환 여부와 최소 필드 projection을 구현 전에 다시 정적 감사하고 Production은 별도 검증한다.
- 운영자가 볼 수 있다는 사실만으로 데이터 최소화가 면제되지 않는다. 문장 원문·이메일·세션 리플레이는 목적·동의·권한·감사로그가 승인된 표면에서만 접근한다.
- 아래 화면 구조·RPC명·필드명은 현행 또는 후보다. v17 정본은 release·보안·삭제 게이트를 판정할 수 있는 결과이며 정확한 레이아웃과 이름은 구현 계획 전 미결정이다.

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

- 핵심 수치: 가입자·활성 유저·완독·오늘 체크인·인기책 Top·문의(상태 토글·개별 이메일 답장, [inquiry-sync.md](./inquiry-sync.md)).

### 3.2 완독률 + 가입 코호트 리텐션 (Supabase, 신규 RPC)

- **완독률**: `user_books` status 분포 → 등록 대비 완독 비율.
- **코호트 리텐션**: `users.created_at` 주차별 코호트 × `reading_sessions.session_date` → N주 후 잔존(체크인 1회+). 표/히트맵.
- 신규 RPC(SECURITY DEFINER + `is_admin` 가드) — `12_admin_insights.sql` 패턴 따른 마이그레이션. 원시 행 노출 금지, 집계만 반환(§7 제약).

### 3.3 콘텐츠 공명 Top (Supabase)

- "어떤 문장·책이 반응을 끌어내나" — `claps`(현행 좋아요) 기반 **문장/책 집계 후보**. 목표는 공개 문장만 최소 집계로 반환하는 것이며, 현재 UUID·본문 반환 가능성과 실제 Production 권한은 검증 전 완료로 보지 않는다.
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

## 6. v17 운영 결과 계약

운영 표면은 정확한 화면 형태와 무관하게 다음 결과를 판정할 수 있어야 한다.

- release commit SHA, workflow run, Worker version, OTA version·checksum·수신 상태, Play versionCode/AAB provenance
- DB migration 파일 hash, 적용 ledger read-back, policy·view·RPC body·grant·trigger·RLS·backfill 검증 결과
- app version·release SHA별 XP mutation, legacy RPC/base-table 호출, 지원 버전 분포
- owner·friend·nonfriend·blocked·anonymous 역할별 Production 직접 API/화면 QA 결과
- 공개범위 동의 버전·효력·철회와 계정 삭제의 Supabase·PostHog·문의·모더레이션 처리 상태
- 각 항목 상태 `PASS | FAIL | BLOCKED | NOT_RUN`; skip·unknown·secret 부재는 PASS가 아님

정확한 카드·표·필드명·대시보드 URL은 후보이며 제품·운영·개인정보 승인 전 확정하지 않는다.

## 7. 후속 (코드 PR)

1. **Supabase**: 최소 필드 집계와 위 운영 결과를 제공할 제한 RPC 후보 + migration. 정확한 이름은 구현 계획에서 승인한다.
2. **운영 UI**: 현행 `AdminDashboardModal`의 UUID·본문 반환 여부를 감사하고 필요한 운영 결과만 표시한다. 풀페이지 전환 여부는 별도 후보다.
3. **분석**: 동의된 PostHog 링크아웃과 legacy 관측을 배선하되 원문·검색어·private 존재를 전송하지 않는다.
4. **검증**: DEV 합성 fixture와 Production 역할별 직접 API 증거를 release receipt에 연결한다.
