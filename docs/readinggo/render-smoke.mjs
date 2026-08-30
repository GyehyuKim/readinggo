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
const TABS = ['함께', '서재', '프로필', '설정', '홈']; // 하단 내비 5탭 — 전부 클릭해 렌더 검증
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

async function assertLibrarySurface() {
  const activityCount = await page.locator('.rg-activity').count();
  if (activityCount !== 0) fails.push('[서재] profile 활동 캘린더가 중복 노출됨');
  const focusCard = page.locator('.shelf-focus-card');
  const focusCount = await focusCard.count();
  const emptyCount = await page.getByText('아직 서재에 책이 없어요', { exact: true }).count();
  if (focusCount > 1 || (focusCount === 0 && emptyCount === 0)) {
    fails.push('[서재] 중앙 전체 표지 또는 정식 빈 상태가 없음');
  }
  const rail = page.locator('.shelf-peek-rail');
  if (await rail.count()) {
    const metrics = await rail.evaluate((el) => ({
      overflowX: getComputedStyle(el).overflowX,
      snap: getComputedStyle(el).scrollSnapType,
      cards: el.querySelectorAll('.shelf-peek-item').length,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      active: el.getAttribute('aria-activedescendant'),
    }));
    if (!/auto|scroll/.test(metrics.overflowX) || !/x/.test(metrics.snap)) {
      fails.push(`[서재] 주변 책 rail CSS 불일치 overflow=${metrics.overflowX} snap=${metrics.snap}`);
    }
    if (metrics.cards > 5 && metrics.scrollWidth <= metrics.clientWidth) {
      fails.push('[서재] 책이 많은데 유한 가로 스크롤 범위가 없음');
    }
    if (metrics.cards > 1) {
      const titleBefore = await focusCard.locator('.shelf-focus-title').innerText();
      await rail.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      const titleAfter = await focusCard.locator('.shelf-focus-title').innerText();
      const activeAfter = await rail.getAttribute('aria-activedescendant');
      if (titleAfter === titleBefore || activeAfter === metrics.active) {
        fails.push('[서재] ArrowRight로 중앙 선택 책이 바뀌지 않음');
      }
    }
  }
}

async function assertProfileActivity() {
  if (await page.locator('.shelf-stage, .shelf-peek-rail').count()) fails.push('[프로필] 서재 탐색 UI가 중복 노출됨');
  const activity = page.locator('.rg-activity');
  if (await activity.count() !== 1) { fails.push('[프로필] 월간 활동 캘린더가 없음'); return; }
  if (await activity.locator('.rg-activity-day').count() !== 42) fails.push('[프로필] 월간 캘린더가 42칸이 아님');
  const next = activity.locator('button[aria-label="다음 달"]');
  if (!(await next.isDisabled())) fails.push('[프로필] 현재 달에서 미래 달 이동이 활성화됨');
  const titleBefore = await activity.locator('.rg-activity-nav strong').innerText();
  await activity.locator('button[aria-label="이전 달"]').click();
  await page.waitForTimeout(100);
  const titlePrevious = await activity.locator('.rg-activity-nav strong').innerText();
  if (titlePrevious === titleBefore) fails.push('[프로필] 이전 달 이동이 동작하지 않음');
  if (await next.isDisabled()) fails.push('[프로필] 과거 달에서 다음 달 복귀가 비활성화됨');
  await next.click();
  await page.waitForTimeout(100);
  if (await activity.locator('.rg-activity-nav strong').innerText() !== titleBefore) fails.push('[프로필] 현재 달 복귀가 동작하지 않음');
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
    if (t === '서재') await assertLibrarySurface();
    if (t === '프로필') await assertProfileActivity();
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
