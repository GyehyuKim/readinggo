import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync('docs/readinggo/js/app.js', 'utf8');
assert.match(source, /VITE_READINGGO_ENV === 'development'/, '검수 모드는 development 빌드 상수로 게이트해야 한다');
assert.match(source, /if \(!RG_DEV_REVIEW_ENABLED\) return/, '진입·종료 핸들러는 production에서 거부해야 한다');
assert.match(source, /reviewMode \? 'local'/, '검수 모드는 Supabase 인증 사용자가 아닌 local DataStore로 시작해야 한다');
assert.match(source, /if \(!_supa \|\| reviewMode\) return/, '검수 중 Supabase 인증 구독을 시작하면 안 된다');

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
assert.equal(text.includes('DEV에서는 실제 Google·카카오 로그인을 연결하지 않아요'), expected, expected
  ? 'development 번들에 실로그인 미연결 안내가 포함돼야 한다'
  : 'production 번들에 DEV 전용 안내가 포함되면 안 된다');
for (const loginLabel of ['Google로 시작하기', '카카오로 시작하기', '이메일로 시작하기']) {
  assert.equal(text.includes(loginLabel), true, `기존 로그인 UI가 유지돼야 한다: ${loginLabel}`);
}

console.log(`OK: ${expected ? 'development' : 'production'} review-mode boundary`);