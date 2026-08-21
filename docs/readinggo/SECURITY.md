# ReadingGo 보안 정책 & 입력 검증 규칙

> 2026-06-04 클로즈베타 감사의 역사적 기준선이다. v17 친구 책나무 보안 정본은 [`specs/backend.md §7.0.3`](./specs/backend.md)과 [`specs/feed.md §5.7.0`](./specs/feed.md)이다. broad base-table read, 구 클라이언트 fail-open, private 문장 존재·개수·상호작용 side channel은 해결·역할별 검증 전까지 Production 활성화 blocker다.

## 1. 입력 검증 규칙 ("값 생성 규칙")
단일 출처: 클라 `js/config.js`의 **`RG_VALIDATE`** + 서버 DB CHECK. 클라는 UX(즉시 인라인 경고), 서버는 최종 방어선(anon 키 직접 POST 등 우회 차단)이다. 아래 표는 현행과 승인된 v17 목표를 분리한다.

| 입력 | 현행 as-built | v17 목표 (#1457) | 서버 경계 |
|---|---|---|---|
| 아이디 `@handle` | 2~20자 · 한글/영문/숫자/_ · 고유 | 유지 | `users_handle_fmt` + `unique` |
| 표시 이름 `display_name` | 1~40자 | 유지 | `users_dname_len` |
| 한 문장 `text` | `private`는 1~1,000자, `public\|followers`는 최대 200자. OCR 201~1,000자는 `private` 강제, 배치 추출은 200자 초과 제외 | 모든 입력·공개범위에서 최종값 1~1,000자. 1,001자 이상은 클라이언트 저장 시 앞 1,000 Unicode 문자로 절단·안내하며 공개범위 유지 | 현행 `52_sentence_visibility_length.sql`; 목표 CHECK는 #1457 구현 PR에서 교체 |
| 사후 감상 `my_note` | ≤1000자 | 유지 | `sentences_note_len` |
| 완독 소감 `review_text` | ≤1000자(UI 300) | 유지 | `ub_review_len` |
| 별점 `rating` | 0.5~5.0 · 0.5 단위 | 유지 | `ub_rating_range` |
| `bio` | ≤300자 | 유지 | `users_bio_len` |

**전환 원칙**: #1457의 Worker·DataStore·DB CHECK·OCR·직접입력·배치/import·카피·경계 테스트가 모두 반영되고 DEV 역할별 저장/재조회 증거가 생기기 전에는 1,000자 공개 저장을 구현 완료로 표시하지 않는다. 정상 클라이언트는 1,001자 이상을 앞 1,000 Unicode 문자로 정규화하고 사용자에게 알리며, 직접 API/DB 우회 입력은 서버와 CHECK가 최종 거부한다. 새 입력 필드는 클라 검증과 DB CHECK를 함께 추가한다.

## 2. 보안 감사 요약 (2026-06-04)
**2026-06 당시 감사 범위**의 위험도는 LOW–MEDIUM, Critical/High 0건이었다. 이 평가는 이후 추가된 친구 책나무·공개범위·구 APK 전환의 안전 판정이 아니다. 현재 알려진 broad `user_books` read와 private 문장 존재 추론 side channel은 v17 친구 책나무 출시 차단급 결함이다.

### 조치 완료
- ✅ **[Medium] 서버측 입력 제약 부재** → DB CHECK 8종 추가(`04_constraints.sql`, `NOT VALID`로 라이브 안전 적용). 클라 우회 시 저비용 DoS·이상치 저장 차단.
- ✅ **[Medium] 알라딘 프록시** → `isbn` 형식 검증(숫자 10~13자리) + `query` 100자 제한 + CORS를 `ALLOWED_ORIGIN` env로 제한 가능.
- ✅ **클라 입력 검증 단일화**(`RG_VALIDATE`) + 경고 UX(표시이름·아이디·감상).

### 후속 (백로그 — 베타 허용)
- **[Medium] CDN SRI/버전 핀 부재** — 공개 전환 시 번들링(Vite 등) 도입과 함께. 현재 `@babel/standalone`·`@supabase/...@2` 미고정.
- **[Medium] autoconfirm=ON** — 이메일 미검증 가입(사칭/스팸 표면). **매직링크/OAuth 경로는 메일 소유 검증이 곧 confirm이라 안전**, 현재 로그인 UI가 Google+매직링크라 노출 작음. 베타 종료 시 `auth-autoconfirm off` 또는 비번 가입 UI 미노출.
- **[Low]** 콘솔 로그 게이팅 · `admin-cli` 비밀번호 stdout(매직링크 로그인 권장) · XP/스트릭 서버 RPC화 · 부트에러 `textContent`화.

### 2026-06 감사에서 양호했던 항목
SQL 인젝션 없음(PostgREST 파라미터화) · 저장형 XSS 없음(React 자동 이스케이프) · 시크릿 미커밋(`.env` gitignore, 히스토리 클린) · 이메일 PII는 `auth.users`에만 존재했다. 그러나 모든 테이블이 소유자 전용 RLS라는 뜻은 아니다. 현행 `user_books` broad read와 clap/report/count 오류 차이는 [backend.md](./specs/backend.md)·[feed.md](./specs/feed.md)의 전환 게이트를 따른다. 과거 `npm audit 0`도 현재 의존성 상태의 증거로 재사용하지 않는다.

## 3. 상시 규칙 (개발 시 준수)
1. **시크릿**: `service_role`·Management PAT·Google Secret·알라딘 TTBKey 는 `.env`/Netlify env/`process.env`에서만. 채팅·깃·클라 번들 금지. 클라엔 publishable(anon) 키만(RLS 보호).
2. **DB 접근**: 항상 supabase-js 빌더(`.eq/.insert/...` 파라미터화). 동적 문자열 SQL 금지. `admin-cli` 인라인 SQL은 운영자 전용(입력 신뢰).
3. **렌더**: 사용자 콘텐츠는 JSX 표현식(자동 이스케이프). `dangerouslySetInnerHTML`/`innerHTML`/`eval`에 사용자 입력 **절대 금지**(현재 SVG 둥지는 내부 상수만 — 회귀 주의).
4. **공개 데이터**: 레거시 `select using(true)` 또는 broad authenticated-read 정책을 신규 친구 책나무의 권한 경계로 사용하지 않는다. 상호 팔로우·차단·opt-out·문장 공개범위는 서버의 제한 view/RPC가 판정하고, base table은 5-A 컷오버 뒤 `owner-only`로 축소한다. private 문장은 본문뿐 아니라 존재·개수·오류 차이·clap/report/count도 숨긴다.

## 4. 공개 전환 전 체크리스트
- [ ] `auth-autoconfirm off` 또는 비밀번호 가입 UI 제거
- [ ] CDN SRI + 버전 핀 (또는 번들링)
- [ ] `console.*` 제거/게이팅
- [ ] `uri_allow_list` = 배포 도메인만 (`admin-cli auth-get`으로 확인)
- [ ] Netlify `ALLOWED_ORIGIN` = 배포 도메인
