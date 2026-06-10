# ReadingGo 클로즈베타 배포 런북 (6/7)

> 핵심 코드는 **main 에 머지 완료**(#163). 이 문서는 **배포자**가 남은 단계로 수행하는 순서.
> Supabase 운영(SQL·인증설정·계정)은 이제 `supabase/admin-cli.mjs` 로 자동화됨 — 대시보드 수작업 대신 명령 한 줄.
> 코드 게이트: babel 13/13 + align_v7 28/28(정적). 런타임 QA·배포는 사람이.

## 0. 자동화 도구 (admin-cli.mjs)
레포 루트 `.env` 에 시크릿을 넣고(`.gitignore`됨, 커밋 안 됨) 명령으로 운영:
```
SUPABASE_URL=https://cttllwwkaddghqttyhkg.supabase.co
SUPABASE_ACCESS_TOKEN=sbp_...          # supabase.com → Account → Access Tokens
SUPABASE_SERVICE_ROLE_KEY=...          # 대시보드 → Settings → API → service_role
```
```
cd docs/readinggo/supabase
node admin-cli.mjs verify              # 토큰 연결 확인
node admin-cli.mjs state               # users/npc/admin/books/sentences 카운트
node admin-cli.mjs sql <file.sql>      # 마이그레이션 적용
node admin-cli.mjs create-admin <email>  # 공통 admin 계정 생성 + is_admin
node admin-cli.mjs auth-seturl <url>   # 배포 origin 을 site_url+redirect 로 등록
```
⚠️ service_role · access token · Google secret · 알라딘 TTBKey 는 채팅·깃에 **절대 노출 금지**.

## 1. 이미 적용됨 (자동화로 완료)
- ✅ `schema.sql` + `02_admin.sql`(is_admin 컬럼·`is_admin()` 헬퍼) 적용
- ✅ `04_constraints.sql`(서버측 입력 길이·범위 CHECK — 보안, `SECURITY.md` 참조)
- ✅ **이메일 가입 autoconfirm = ON** — 확인메일 없이 가입 즉시 로그인(기본 메일러 발송한도 문제 회피). 기존 미확인 계정도 confirm 처리
- ✅ NPC 같은-책 피드 시드(`seed_npc.mjs`, 민음사 492권 × NPC 2명)
- ✅ 설정에서 **@아이디(handle) 변경 + 중복검사** (이 PR)

## 2. 이 PR 브라우저 QA → 머지
```
git fetch origin && git checkout <이 PR 브랜치>
npx serve docs/readinggo -l 8888       # http://localhost:8888
```
- [ ] 로그인(구글 또는 이메일) → 둥지 진입
- [ ] 설정 ⚙️ → **아이디(@) 변경 + 중복검사**(남이 쓰는 핸들 입력 시 거부) / 표시 이름 변경
- [ ] 책 검색 → 등록 → 체크인(한 문장) → **하드리로드 후 유지**
- [ ] 소셜 피드(@아이디 표시) / 서재(읽는중·완독·🏰성컬렉션) / 책상세 ✏️감상 / 타인 프로필
통과 시 GitHub 에서 **squash 머지 → main**, 관련 이슈 닫기.

## 3. Netlify 배포
- **env 추가**: `ALADIN_TTB_KEY` = (알라딘 TTBKey) — 검색 프록시(`/.netlify/functions/aladin`)용. 없으면 알라딘 검색만 비활성(로컬 카탈로그는 동작).
- **env 추가(권장)**: `ALLOWED_ORIGIN` = 배포 도메인(예 `https://xxx.netlify.app`) — 알라딘 프록시 CORS 제한(미설정 시 `*`, 보안 감사 Medium #3).
- 배포: `netlify deploy --prod` (publish=`docs/readinggo`, functions=`netlify/functions` — `netlify.toml` 참조).

## 4. 배포 후 인증 URL (필수 — 안 하면 배포본 로그인 리디렉션이 localhost 로 깨짐)
```
node admin-cli.mjs auth-seturl https://<배포-origin>.netlify.app
```
(site_url + uri_allow_list 자동 갱신. Google 콜백 URI 는 Supabase 콜백 그대로라 변경 없음.)

## 5. 공통 admin 계정 (팀 공유 — 통계/관리 전용)
```
node admin-cli.mjs create-admin readinggo.admin@example.com
```
→ 계정 생성 + is_admin=true + 임시 비밀번호 출력(팀 공유, 첫 로그인 후 변경). 개인 계정은 실사용, 이 계정은 관리 전용.

## 6. 스모크 테스트 (배포본)
로그인 → 알라딘 검색·등록 → 체크인 → 새로고침 영속 → 소셜/서재/프로필 → admin 계정에서 데이터 확인.

## 7. 공개 전환 전 체크리스트 (베타 → 일반 공개, #178)

베타 동안 `mailer_autoconfirm = ON`(확인메일 없이 즉시 로그인 — 기본 메일러 발송한도·발신자명 "Supabase" 인지 문제 회피). **일반 공개 시 반드시 OFF**.

- [ ] **커스텀 SMTP 설정** (SendGrid/Mailgun 등) — Supabase 대시보드 → Auth → SMTP Settings
- [ ] 커스텀 SMTP 완료 후 → `node admin-cli.mjs auth-autoconfirm off`
- [ ] 이메일 템플릿 커스터마이징 (ReadingGo 브랜딩 — 발신자명·제목·본문)

**대안 (SMTP 없이 공개)**: 매직링크/OAuth 경로만 UI 노출(비밀번호 가입 숨김) → autoconfirm ON 유지 가능. 단, 비밀번호 가입을 통한 사칭 계정 위험 존재 → 비밀번호 가입을 완전히 막아야 안전.

## 잔여 (베타 허용, 후속)
- isbn 없는 책 dedup(제목매칭 완화) · 실시간 짹 카운트 · 아바타 이미지 · 프로필 무한스크롤
- admin in-app 대시보드(방문·가입·짹·인기책 집계) = #161 2단계
