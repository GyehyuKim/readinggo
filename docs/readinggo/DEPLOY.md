# ReadingGo 클로즈베타 배포 런북 (6/7)

> 코드는 **PR #162** (`gyehyu/beta-coreloop`)에 완성. 이 문서는 **배포자(계휴)** 가 머지 후 수행하는 순서. 코드(랄프)는 정적검증(babel 13/13 + align_v7 28/28)까지, 런타임 QA·배포·SQL은 사람이.

## 0. 사전 (대부분 완료)
- Supabase 프로젝트: `cttllwwkaddghqttyhkg`
- Auth: **Google provider 활성**(Client ID/Secret 입력됨) + **이메일 매직링크**(email provider 기본 enabled)
- Netlify 사이트 (재배포 명령은 메모 `project_netlify` 참조)

## 1. PR #162 브라우저 QA → 머지
```
git fetch origin && git checkout gyehyu/beta-coreloop
npx serve docs/readinggo -l 8888       # http://localhost:8888
```
QA 체크리스트:
- [ ] 로그인(구글 또는 이메일 매직링크) → 둥지 진입
- [ ] 책 검색(🔍) → 등록 → 둥지 활성 책
- [ ] 체크인(한 문장) → **하드리로드 후 유지**(콘솔 `✅ 체크인 저장 완료`)
- [ ] 소셜 피드(내 문장 표시) / 서재(실 책·읽는중·완독·성컬렉션) / 책상세 ✏️감상 / 💭무작위회상
- [ ] 소셜 @핸들 탭 → 타인 프로필
- [ ] 프로필 탭 정상(흰화면 없음)

통과 시 GitHub 에서 **squash 머지 → main**. (그 후 관련 이슈 닫기.)

## 2. SQL Editor (Supabase 대시보드 → SQL Editor) — 순서대로
1. `supabase/schema.sql` — 최초 1회만 (이미 했으면 skip)
2. `supabase/02_admin.sql` — is_admin 컬럼·헬퍼. 실행 후 **본인 운영자 지정**:
   ```sql
   update public.users set is_admin = true where handle = 'reader_xxxxxxxx';
   ```
3. `supabase/03_demo_seed.sql` — (선택) 데모 계정 시드. 데모 계정으로 먼저 로그인 → `v_handle` 교체 → Run.

## 3. Netlify 배포
- **env 추가**: `ALADIN_TTB_KEY` = (알라딘 TTBKey) — 알라딘 검색 프록시(`/.netlify/functions/aladin`)용. **이게 없으면 알라딘 검색만 안 됨**(데모 카탈로그는 동작).
- 배포: `netlify deploy --prod` (publish=`docs/readinggo`, functions=`netlify/functions` — `netlify.toml` 참조)
- 배포 origin(예 `https://xxx.netlify.app`)을:
  - **Supabase → Auth → URL Configuration → Redirect URLs** 에 추가
  - (Google Console 승인 리디렉션 URI 는 Supabase 콜백 그대로 — 변경 없음)

## 4. 스모크 테스트 (배포본)
로그인 → 알라딘 검색으로 책 등록 → 체크인 → 새로고침 영속 → 소셜/서재/프로필 → admin 계정에서 데이터 확인.

## 잔여 (베타 허용, 후속 — architect 리뷰)
- H1 isbn 없는 책 등록 dedup(제목 매칭으로 완화됨) · H2 스트릭 DB정합(완화됨)
- 둥지 "같은 책" 피드 실데이터, 아바타 이미지, 실시간 짹 카운트, 프로필 무한스크롤 등
