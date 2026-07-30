# 책장 탭 UX 개편 구현 방안

> 브랜치: `yunji/library-tab-ux`  
> 작성일: 2026-07-26

---

## 배경 및 목표

현재 "책장" 탭은 유저 프로필·둥지 캐릭터·독서 기록·문장·내보내기 기능이 한 스크롤에 혼재되어 있어 탭 이름이 내용을 대표하지 못하고 스크롤 깊이가 과도함. 히트맵 제거(결정 완료)와 함께 탭 구조 전면 개편.

---

## 최종 탭 구조

```
홈 | 함께 | 둥지 | 프로필 | 설정
```

- **홈** (`nest`): 매일 독서 체크인 — 변경 없음
- **함께** (`social`): 소셜 피드 — 변경 없음
- **둥지** (`nest-grow`): 둥지 성장 + XP 기록 — **신규 탭**
- **프로필** (`profile`): 유저 프로필 + 서재 + 문장 — 기존 책장 개편
- **설정** (`settings`): 풀페이지 설정 — 바텀 모달에서 전환

---

## 변경 파일 목록

| 파일 | 변경 종류 | 요약 |
|------|----------|------|
| `js/app.js` | 수정 | 탭 5개로 교체, 설정 모달 제거, 뷰 2개 추가 |
| `js/library.js` | 수정 | NestTheatre·ActivityHeatmap·내보내기·공유 버튼 제거 |
| `js/settings-modal.js` | 재작성 | 바텀 모달 → 풀페이지, 서브페이지 내비게이션 |
| `js/nest-grow.js` | **신규** | NestGrowView 컴포넌트 |
| `main.js` | 수정 | nest-grow.js import 추가 |

---

## 파일별 상세 변경 사항

### 1. `js/app.js`

#### 탭 배열 교체 (line ~1095)

```
현재: nest | social | profile('책장', 책 아이콘) | settings(모달 오픈)
변경: nest | social | nest-grow(신규) | profile('프로필', 사람 아이콘) | settings(일반 탭)
```

#### 제거
- `settingsOpen`, `setSettingsOpen` state
- 탭 클릭 분기 `if (t.id === 'settings') setSettingsOpen(true)`
- 탭 active 클래스 조건 `t.id !== 'settings'` 예외
- `SettingsModal` portal 렌더 (line ~1157)

#### 추가
```jsx
{activeTab === 'nest-grow' && (
  <NestGrowView key="nest-grow" state={appState} />
)}
{activeTab === 'settings' && (
  <SettingsView
    key="settings"
    spoilerReveal={spoilerReveal}
    setSpoilerReveal={setSpoilerReveal}
  />
)}
```

---

### 2. `js/library.js`

#### 제거
- `NestTheatre` 렌더 블록 (line ~292–294)
- `ActivityHeatmap` 렌더 블록 (line ~297–299) — 이미 결정
- `downloadBlob`, `exportData`, `exportMarkdown` 함수 (line ~99–235)
- 하단 내보내기 버튼들 (JSON / Markdown)
- 하단 친구 공유 버튼 → 설정 탭 최상단으로 이동

#### 유지
- 프로필 헤더 (닉네임 인라인 편집 / 소개 / 팔로잉·팔로워·좋아요)
- 🔍 내 문장에게 묻기
- 📚 서재 섹션 헤더 + `[책 찾아 담기]` `[한번에 추가하기]` 버튼
  - 한번에 추가하기 → '텍스트/파일로 가져오기', '사진으로 가져오기' 선택
- 서브탭: 읽고 싶은 책 / 읽고 있는 책 / 읽은 책 / 중단
- 이 책들의 문장·감상
- 타사 앱 밑줄 가져오기 (하단 유지)

---

### 3. `js/settings-modal.js`

#### 컴포넌트명
`SettingsModal` → `SettingsView`

#### 구조 변경
- 모달 backdrop / `.sheet` 래퍼 제거 → `.view` 풀페이지 div
- `onClose` prop 제거
- `subPage` state 추가: `null | 'export'`

#### 화면 구성

```
┌─────────────────────────────────┐
│ [친구에게 ReadingGo 공유하기]    │  ← 최상단 CTA 버튼 (shareService)
├─────────────────────────────────┤
│ 읽기 환경 설정                   │
│   스포일러 모두 보기 [토글]       │
│   재키 질문 결 [드롭다운]         │
├─────────────────────────────────┤
│ 개인정보·데이터                  │
│   독서 대화 AI·분석 활용 [토글]  │
│   한 문장 기본 공개 범위 [라디오] │
│   읽고 싶은 책 공개 [토글]        │
│   내 데이터 내보내기          >  │  ← subPage='export'로 전환
├─────────────────────────────────┤
│ 계정                             │
│   이메일 표시                    │
│   [다른 기기 로그아웃] [이 기기]  │
│   계정 관리 (접힘 → 계정 삭제)   │
├─────────────────────────────────┤
│ 운영자에게 문의                  │
│ 앱 정보                          │
└─────────────────────────────────┘
```

#### 내보내기 서브페이지 (subPage === 'export')

```
← 내 데이터 내보내기

[JSON으로 내보내기]
[Markdown으로 내보내기]
[CSV로 내보내기]          ← 신규 포맷
```

- `downloadBlob`, `exportData`, `exportMarkdown` — library.js에서 이동
- `exportCsv` — 신규 작성 (myBooks + myQuotes → CSV)
- 각 함수가 DataStore를 직접 호출 (로컬 state 의존 제거)

---

### 4. `js/nest-grow.js` (신규)

**컴포넌트:** `NestGrowView({ state })`

#### 화면 구성

```
┌─────────────────────────────────┐
│ N번째 둥지 짓는 중               │  ← calcLevel(state.xp) 사용
│                                 │     레벨 로직 유지, 표현만 변경
├─────────────────────────────────┤
│ NestTheatre                     │  ← library.js에서 이동
│ (XP바 + 단계명 + 단계 로드맵)   │
├─────────────────────────────────┤
│ [둥지 기록] | [둥지 완성]        │  ← 내부 서브탭
├─────────────────────────────────┤
│ [둥지 기록] 탭                   │
│   📖 한 문장 기록  +20 XP  날짜  │
│   🏰 OO 완독      +200 XP 날짜  │
│   (DataStore.myBooks completedAt│
│    + sentences.listMine 기반)   │
├─────────────────────────────────┤
│ [둥지 완성] 탭                   │
│   1번째 둥지 완성  2026년 5월    │
│   (NEST_CYCLE_XP 기반 달성 이력)│
└─────────────────────────────────┘
```

#### 사용 전역 변수
- `window.calcLevel` — 레벨 계산 (data.js)
- `window.NEST_STAGES` — 단계 정보 (data.js)
- `window.NEST_CYCLE_XP` — 1사이클 XP (data.js)
- `window.XP_RULES` — XP 획득 규칙 (data.js)

---

### 5. `main.js`

```js
// settings-modal.js 이후, app.js 이전에 추가
import './js/nest-grow.js'
```

---

## 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 탭 수 | 5개 (홈·함께·둥지·프로필·설정) |
| 탭 순서 | 사용 빈도 기준 좌→우 |
| 설정 진입 | 바텀 모달 → 별도 탭 풀페이지 |
| 내보내기 위치 | 프로필 탭 → 설정 > 내 데이터 > 서브페이지 |
| 공유 버튼 위치 | 프로필 탭 하단 → 설정 탭 최상단 |
| 타사 앱 가져오기 | 프로필 탭 하단 유지 |
| 히트맵 | 제거 (기결정) |
| 둥지 탭 이름 | "둥지" (앱 고유 언어 유지) |
| 레벨 표현 | "N번째 둥지 짓는 중" (calcLevel 로직 유지) |
| XP 가이드 | 온보딩에서만 표시 (둥지 탭 미포함) |
| 단계 로드맵 | NestTheatre 내 표시 (기존 유지) |
