import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4173/';
const qaOut = process.env.USER_SEARCH_QA_OUT;
if (qaOut) mkdirSync(qaOut, { recursive: true });
const viewports = [
  { width: 390, height: 844, label: '390x844' },
  { width: 430, height: 932, label: '430x932' },
  { width: 1280, height: 900, label: 'desktop' },
];
const seed = {
  user_books: [{
    id: 'ub-user-search', book_id: 'book-user-search', status: 'reading', current_page: 42,
    book: { id: 'book-user-search', title: '데미안', author: '헤르만 헤세', total_pages: 248, cover_url: '' },
    sessions: [], sentences: [],
  }],
  active_user_book_id: 'ub-user-search',
  streak: { current: 1, longest: 1, last_check_in_date: '2026-07-01' },
  xp: 12, claps: {}, bookmarks: {}, wish_books: [], pending: {},
};

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8_000);
    await page.addInitScript((state) => {
      localStorage.setItem('rg_v41', JSON.stringify(state));
      localStorage.setItem('rg_consent_v1', JSON.stringify({ necessary: true, ai: false, analytics: false }));
    }, seed);
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const consent = page.getByRole('button', { name: '필수만' });
    await page.waitForTimeout(1_000);
    if (await consent.isVisible()) await consent.click();
    await page.getByRole('button', { name: '함께' }).click();
    await page.getByRole('button', { name: '유저 찾기' }).click();

    const input = page.getByPlaceholder('@닉네임으로 친구 찾기');
    await input.waitFor();
    assert.equal(await input.evaluate((el) => document.activeElement === el), false,
      `${viewport.label}: 패널을 열자마자 키보드 포커스를 가져가면 안 됨`);

    await input.focus();
    await input.fill('book');
    if (viewport.width < 800) {
      await page.setViewportSize({ width: viewport.width, height: 420 });
      await page.setViewportSize(viewport);
    }
    await input.blur();
    await page.locator('main').evaluate((el) => { el.scrollTop = Math.max(0, el.scrollTop - 80); });

    const box = await input.boundingBox();
    assert.ok(box && box.y + box.height > 0 && box.y < viewport.height,
      `${viewport.label}: 키보드 열기·닫기와 스크롤 뒤에도 검색 패널에 접근 가능해야 함 (${JSON.stringify(box)})`);
    if (qaOut) await page.screenshot({ path: `${qaOut}/user-search-${viewport.label}.png` });
    console.log(`  ${viewport.label}: 정상`);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('✓ user-search-ios: 3개 뷰포트에서 열기·포커스·키보드 리사이즈·닫기·스크롤 경로 정상');
