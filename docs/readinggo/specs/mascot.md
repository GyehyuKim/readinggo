# Jacky / 재키 — 3D 브랜드·캐릭터 계약

> **결정 (2026-09-05, #1613)**: ReadingGo는 승인된 warm 3D 재키를 canonical identity로 사용한다. 브랜드 마크, 런처 아이콘, 인앱 캐릭터, 일반 UI 아이콘의 역할을 분리하며 손코딩 mascot SVG와 2D A/B/C 후보는 폐기한다.

## 1. canonical identity

재키는 통통하고 짧은 갈색 참새다. 모든 캐릭터 자산은 다음 특징을 유지한다.

- 세 갈래의 둥근 머리깃
- 갈색 cap과 body
- 크림색 얼굴판과 배
- 큰 검은 눈
- 작은 주황색 부리
- 볼 홍조
- 따뜻한 동화적 3D 질감

턱 아래의 뾰족한 크림색 털, 수염처럼 보이는 돌출, 의미 없는 색 조각, 구멍, halo와 fringe는 허용하지 않는다.

## 2. 역할별 자산

### 앱 런처·설치 아이콘

- 재키 얼굴과 하단의 명확한 펼친 초록 책을 사용한다.
- 책은 좌우 흰 페이지, 상단 page edge, 중앙 spine/fold, 초록 cover가 보여야 한다.
- 손, 글자, bookmark, 기능 glyph를 넣지 않는다.
- square full-bleed raster PNG를 사용한다.

### 작은 브랜드 마크

- 정면 얼굴만 사용한다. 책, 손, 몸, 배경 장식은 제거한다.
- 16px, 24px, 32px에서 눈·부리·세 갈래 머리깃·얼굴 외곽이 구분돼야 한다.
- 투명 배경 raster PNG를 사용한다.

### 인앱 캐릭터

- 감정·행동·안내가 필요한 곳에만 사용한다.
- `reading-guide`: 펼친 책을 들고 읽기를 안내한다.
- `success`: 책 없이 양 날개로 축하한다.
- `listening`: 책 없이 고개를 기울여 기다린다.
- 한 viewport에서 큰 3D 재키는 한 번만 사용하고, 같은 crop을 반복하지 않는다.

### 일반 기능·상태 아이콘

- 계정, 설정, 검색, 저장, 닫기, 오류 등 기능은 기존 표준 UI 아이콘을 사용한다.
- 사용자 fallback avatar에 재키를 사용하지 않는다.

## 3. 자산 형식

- canonical visual asset은 raster PNG다. mascot SVG와 기본 도형 조합을 정본으로 사용하지 않는다.
- 설치 아이콘과 인앱 자산은 목적별 파일을 사용하며 하나의 앱 아이콘 crop을 반복하지 않는다.
- master는 1024px급으로 보관하고 웹 표면에는 용도에 맞게 축소·최적화한 PNG를 제공한다.

## 4. 합격·탈락 기준

모든 후보는 실제 배경과 목표 표시 크기로 확인한다.

- 브랜드 마크: 16px, 24px, 32px blind 판독
- 인앱 캐릭터: 96px 이상에서 행동 판독
- 런처: 32px에서 얼굴과 펼친 책이 동시에 판독
- 설명 없이 책이 bowl, scarf, V-shape로 읽히면 탈락
- 의미 불명의 색 조각, hole, fringe, halo, 잘못 잘린 신체가 있으면 방향과 무관하게 탈락
- 제작자가 자기 결과를 단독 승인하지 않는다. 독립 리뷰와 실제 DEV 화면 확인을 거친다.

## 5. 출시 게이트

1. 원본과 용도별 축소본의 치수·alpha·파일 참조를 검사한다.
2. 자동 테스트와 production build를 통과한다.
3. DEV에서 헤더, favicon, 런처/설치 표면, 인앱 사용 위치를 시각 검증한다.
4. console error와 실패 network request가 없는지 확인한다.
5. 검증된 동일 Git SHA만 Production으로 승격하고 다시 receipt·화면·자산 응답을 확인한다.

## 6. 추적성

- 최종 구현·배포: GitHub issue #1613
- 이전 2D 모델시트 결정(폐기): GitHub issue #1389
- 이름 결정: GitHub issue #1455
- 관련 디자인 계약: [design.md](./design.md), [DESIGN.md](../DESIGN.md)
