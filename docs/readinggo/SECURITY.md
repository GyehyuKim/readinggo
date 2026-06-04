# ReadingGo 보안 정책 & 입력 검증 규칙

> 2026-06-04 보안 감사 기반. 클로즈베타(6/7) 기준. 보안 결정이 흔들릴 때 여기로 돌아온다.

## 1. 입력 검증 규칙 ("값 생성 규칙")
단일 출처: 클라 `js/config.js`의 **`RG_VALIDATE`** + 서버 `supabase/04_constraints.sql`(DB CHECK). 둘은 **동일 규칙을 공유** — 클라는 UX(즉시 인라인 경고), 서버는 최종 방어선(anon 키 직접 POST 등 우회 차단).

| 입력 | 규칙 | 클라(경고) | 서버(CHECK) |
|---|---|---|---|
| 아이디 `@handle` | 2~20자 · 한글/영문/숫자/_ · 고유(중복불가) | `RG_VALIDATE.handle` + `isHandleAvailable` | `users_handle_fmt` + `unique` |
| 표시 이름 `display_name` | 1~40자 | `RG_VALIDATE.displayName` | `users_dname_len` |
| 한 문장 `text` | 1~200자 | 200자 캡 + 카운터 | `sentences_text_len` |
| 사후 감상 `my_note` | ≤1000자 | `maxLength` | `sentences_note_len` |
| 완독 소감 `review_text` | ≤1000자(UI 300) | `maxLength` | `ub_review_len` |
| 별점 `rating` | 0.5~5.0 · 0.5 단위 | 별 UI | `ub_rating_range` |
| `bio` | ≤300자 | (편집 UI 추가 시) | `users_bio_len` |

**원칙**: 잘못된 값 → 빨간 인라인 메시지로 규칙을 안내하고 저장 차단. 서버는 위반 쓰기를 거부. 새 입력 필드를 추가하면 **RG_VALIDATE 규칙 + DB CHECK 를 동시에** 추가한다.

## 2. 보안 감사 요약 (2026-06-04)
전체 위험도 **LOW–MEDIUM**. Critical/High **0건** — 출시 차단급 결함 없음.

### 조치 완료
- ✅ **[Medium] 서버측 입력 제약 부재** → DB CHECK 8종 추가(`04_constraints.sql`, `NOT VALID`로 라이브 안전 적용). 클라 우회 시 저비용 DoS·이상치 저장 차단.
- ✅ **[Medium] 알라딘 프록시** → `isbn` 형식 검증(숫자 10~13자리) + `query` 100자 제한 + CORS를 `ALLOWED_ORIGIN` env로 제한 가능.
- ✅ **클라 입력 검증 단일화**(`RG_VALIDATE`) + 경고 UX(표시이름·아이디·감상).

### 후속 (백로그 — 베타 허용)
- **[Medium] CDN SRI/버전 핀 부재** — 공개 전환 시 번들링(Vite 등) 도입과 함께. 현재 `@babel/standalone`·`@supabase/...@2` 미고정.
- **[Medium] autoconfirm=ON** — 이메일 미검증 가입(사칭/스팸 표면). **매직링크/OAuth 경로는 메일 소유 검증이 곧 confirm이라 안전**, 현재 로그인 UI가 Google+매직링크라 노출 작음. 베타 종료 시 `auth-autoconfirm off` 또는 비번 가입 UI 미노출.
- **[Low]** 콘솔 로그 게이팅 · `admin-cli` 비밀번호 stdout(매직링크 로그인 권장) · XP/스트릭 서버 RPC화 · 부트에러 `textContent`화.

### 양호 (설계 의도대로 견고)
SQL 인젝션 없음(PostgREST 파라미터화) · 저장형 XSS 없음(React 자동 이스케이프) · 시크릿 미커밋(`.env` gitignore, 히스토리 클린) · RLS 소유권 정책(`user_id = auth.uid()`) · 이메일 PII는 `auth.users`에만(공개 `users`엔 없음) · `npm audit` 0 vulnerabilities.

## 3. 상시 규칙 (개발 시 준수)
1. **시크릿**: `service_role`·Management PAT·Google Secret·알라딘 TTBKey 는 `.env`/Netlify env/`process.env`에서만. 채팅·깃·클라 번들 금지. 클라엔 publishable(anon) 키만(RLS 보호).
2. **DB 접근**: 항상 supabase-js 빌더(`.eq/.insert/...` 파라미터화). 동적 문자열 SQL 금지. `admin-cli` 인라인 SQL은 운영자 전용(입력 신뢰).
3. **렌더**: 사용자 콘텐츠는 JSX 표현식(자동 이스케이프). `dangerouslySetInnerHTML`/`innerHTML`/`eval`에 사용자 입력 **절대 금지**(현재 SVG 둥지는 내부 상수만 — 회귀 주의).
4. **공개 데이터**: `select using(true)` 테이블은 anon 키로 누구나 읽음(전체공개 피드 = 설계). **민감정보를 이 테이블에 넣지 말 것.**

## 4. 공개 전환 전 체크리스트
- [ ] `auth-autoconfirm off` 또는 비밀번호 가입 UI 제거
- [ ] CDN SRI + 버전 핀 (또는 번들링)
- [ ] `console.*` 제거/게이팅
- [ ] `uri_allow_list` = 배포 도메인만 (`admin-cli auth-get`으로 확인)
- [ ] Netlify `ALLOWED_ORIGIN` = 배포 도메인
