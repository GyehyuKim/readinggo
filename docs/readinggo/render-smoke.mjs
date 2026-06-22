/* render-smoke.mjs (#886) — 런타임 렌더 회귀 방지.
 *
 * boot-smoke 는 'vite build 성공'만 검사 → #884(책장 크래시: 빌드 통과·런타임 ReferenceError)를 놓쳤다.
 * 이 스모크는 빌드 산출물을 헤드리스로 실제 띄워 전 탭을 클릭하고 에러화면/콘솔 치명에러를 단언한다.
 *
 * 실행: SMOKE_URL=http://localhost:4173/ node render-smoke.mjs   (기본 localhost:4173)
 *   CI: vite build → vite preview(백그라운드) → 이 스크립트. exit 1 = 렌더 회귀.
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://localhost:4173/';
const TABS = ['피드', '책장', '설정', '홈']; // 하단 내비 4탭 — 전부 클릭해 렌더 검증
const isNoise = (e) => /posthog|fonts\.googleapis|net::ERR|Failed to load resource|\/api\/|\/aladin/i.test(e);

const fails = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let bucket = [];
page.on('console', (m) => { if (m.type() === 'error') bucket.push(m.text()); });
page.on('pageerror', (e) => bucket.push('PAGEERR: ' + e.message));

async function assertView(label) {
  await page.waitForTimeout(1800);
  const broke = await page.evaluate(() => /문제가 생겼어요|길을 잃었네요/.test(document.body.innerText || ''));
  const kids = await page.evaluate(() => document.getElementById('root')?.children.length || 0);
  const fatal = bucket.filter((e) => !isNoise(e));
  bucket = [];
  if (broke) fails.push(`[${label}] ErrorBoundary 에러화면 노출`);
  if (kids === 0) fails.push(`[${label}] #root 빈 화면(미렌더)`);
  if (fatal.length) fails.push(`[${label}] 치명 콘솔에러 ${fatal.length}: ${fatal[0].slice(0, 160)}`);
  console.log(`  [${label}] 에러화면:${broke ? 'FAIL' : 'ok'} 렌더:${kids > 0 ? 'ok' : 'FAIL'} 치명에러:${fatal.length}`);
}

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await assertView('초기로드');
  for (const t of TABS) {
    const clicked = await page.evaluate((name) => {
      const el = [...document.querySelectorAll('button,div,span,a')].find((e) => (e.innerText || '').trim() === name);
      if (el) { el.click(); return true; }
      return false;
    }, t);
    if (!clicked) { fails.push(`[탭:${t}] 탭 버튼 못 찾음(라벨 변경?)`); console.log(`  [탭:${t}] 클릭 FAIL(못 찾음)`); continue; }
    await assertView('탭:' + t);
  }
} catch (e) {
  fails.push('스모크 실행 오류: ' + e.message);
} finally {
  await browser.close();
}

if (fails.length) {
  console.error('\n✘ render-smoke 실패:');
  fails.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('\n✓ render-smoke: 전 탭 정상 렌더(에러화면·치명 콘솔에러 0)');
