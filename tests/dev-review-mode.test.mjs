import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync('docs/readinggo/js/app.js', 'utf8');
const mainSource = readFileSync('docs/readinggo/main.js', 'utf8');
const datastoreSource = readFileSync('docs/readinggo/js/datastore.js', 'utf8');
const personaSource = readFileSync('docs/readinggo/js/dev-review-personas.js', 'utf8');
assert.match(source, /VITE_READINGGO_ENV === 'development'/, '검수 모드는 development 빌드 상수로 게이트해야 한다');
assert.match(source, /if \(!RG_DEV_REVIEW_ENABLED\) return/, '진입·종료 핸들러는 production에서 거부해야 한다');
assert.match(source, /reviewMode \? 'local'/, '검수 모드는 Supabase 인증 사용자가 아닌 local DataStore로 시작해야 한다');
assert.match(source, /if \(!_supa \|\| reviewMode\) return/, '검수 중 Supabase 인증 구독을 시작하면 안 된다');
assert.match(source, /RG_DEV_REVIEW\.current\(\)\) return;[\s\S]{0,180}grantXp\(XP_RULES\.visit/, '검수 fixture는 reload 시 방문 XP로 자동 변경되면 안 된다');
assert.match(source, /disabled=\{reviewBusy\}/, '비동기 전환·리셋·종료 중 중복 클릭을 막아야 한다');
assert.match(source, /finally \{ setReviewBusy\(false\); \}/, '비동기 검수 동작은 성공·실패 모두 busy를 해제해야 한다');
assert.match(mainSource, /if \(!devReviewRestored && window\.RG_SB/, '복원된 검수 모드에서 Supabase 인증 조회를 건너뛰어야 한다');
assert.doesNotMatch(mainSource, /^import '\.\/js\/supabase-client\.js';/m, '검수 복원 전에 Supabase auth 모듈을 정적 평가하면 안 된다');
assert.match(mainSource, /if \(!devReviewRestored\) \{\s+await import\('\.\/js\/supabase-client\.js'\);\s+await import\('\.\/js\/datastore-supabase\.js'\);/s, 'Supabase 모듈은 검수 세션이 아닐 때만 동적으로 평가해야 한다');
assert.match(datastoreSource, /rg_dev_review_persona_/, '로컬 어댑터가 페르소나별 저장 namespace를 검증해야 한다');
assert.match(personaSource, /window\.SupabaseDataStore = null/, '직접 Supabase adapter 우회도 fail-closed로 차단해야 한다');
assert.match(personaSource, /isConfigured: \(\) => false/, '검수 모드에서는 auth gateway를 비활성화해야 한다');
assert.match(personaSource, /\/api\/dev-review-personas/, '합성 fixture 변경은 DEV Worker 저장 경로로 동기화해야 한다');

const bundleText = () => readdirSync(join('docs/readinggo/dist', 'assets'))
  .filter(name => name.endsWith('.js'))
  .map(name => readFileSync(join('docs/readinggo/dist', 'assets', name), 'utf8'))
  .join('\n');

const text = bundleText();
const expected = process.env.EXPECT_REVIEW_MODE === '1';
assert.equal(text.includes('DEV 검수 모드'), expected, expected
  ? 'development 번들에 검수 모드가 포함돼야 한다'
  : 'production 번들에 검수 모드 카피가 포함되면 안 된다');
assert.equal(text.includes('개발 검수 모드로 둘러보기'), expected, expected
  ? 'development 번들에 검수 진입 버튼이 포함돼야 한다'
  : 'production 번들에 검수 진입 버튼이 포함되면 안 된다');
for (const devOnlyText of ['합성 검수 페르소나 선택', '합성 · 계휴 스타일 제품 탐험가', '합성 · Judy 스타일 문장 수집가', '합성 · Jerome 스타일 꾸준한 완독가', '초기 데이터로 리셋']) {
  assert.equal(text.includes(devOnlyText), expected, expected
    ? `development 번들에 DEV 전용 페르소나 UI/fixture가 포함돼야 한다: ${devOnlyText}`
    : `production 번들에 DEV 전용 페르소나 UI/fixture가 포함되면 안 된다: ${devOnlyText}`);
}
assert.equal(text.includes('DEV에서는 실제 Google·카카오 로그인을 연결하지 않아요'), expected, expected
  ? 'development 번들에 실로그인 미연결 안내가 포함돼야 한다'
  : 'production 번들에 DEV 전용 안내가 포함되면 안 된다');
for (const loginLabel of ['Google로 시작하기', '카카오로 시작하기', '이메일로 시작하기']) {
  assert.equal(text.includes(loginLabel), true, `기존 로그인 UI가 유지돼야 한다: ${loginLabel}`);
}

console.log(`OK: ${expected ? 'development' : 'production'} review-mode boundary`);