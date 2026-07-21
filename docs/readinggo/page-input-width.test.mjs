import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:4173/';
const viewports = [
  { width: 390, height: 844, label: '390x844' },
  { width: 430, height: 932, label: '430x932' },
  { width: 1280, height: 900, label: 'desktop' },
];
const values = ['108', '999', '1000', '1234'];
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => localStorage.setItem('rg_v41', JSON.stringify({
      user_books: [{
        id: 'ub-page-width', book_id: 'book-page-width', status: 'reading', current_page: 108,
        book: { id: 'book-page-width', title: '쪽수 입력 테스트', author: 'ReadingGo', total_pages: 1234, cover_url: '' },
        sessions: [], sentences: [],
      }],
      active_user_book_id: 'ub-page-width',
      streak: { current: 0, longest: 0, last_check_in_date: null },
      xp: 0, claps: {}, bookmarks: {}, wish_books: [], settings: {}, pending: {},
    })));
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const progress = page.locator('.home-page-progress-row .rg-noscale-input');
    const sentence = page.locator('.home-sentence-toolbar .home-page-number-input');
    await assert.doesNotReject(() => progress.waitFor(), `${viewport.label}: 진도 입력을 찾지 못함`);
    await assert.doesNotReject(() => sentence.waitFor(), `${viewport.label}: 문장 입력을 찾지 못함`);

    for (const value of values) {
      for (const [surface, input] of [['진도', progress], ['문장', sentence]]) {
        await input.fill(value);
        const dimensions = await input.evaluate((el, surface) => ({
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          renderedValue: el.value,
          rowFlexWrap: getComputedStyle(el.closest(surface === '진도' ? '.home-page-progress-row' : '.home-sentence-toolbar')).flexWrap,
        }), surface);
        assert.equal(dimensions.renderedValue, value, `${viewport.label} ${surface}: ${value} 값 불일치`);
        assert.ok(dimensions.clientWidth >= dimensions.scrollWidth, `${viewport.label} ${surface}: ${value} 잘림 (${dimensions.clientWidth}<${dimensions.scrollWidth})`);
        assert.equal(dimensions.rowFlexWrap, 'nowrap', `${viewport.label} ${surface}: ${value} 줄바꿈 허용됨`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(overflow, false, `${viewport.label}: ${value}에서 가로 오버플로 발생`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('✓ page-input-width: 3~4자리 값이 두 입력 표면과 3개 뷰포트에서 잘림·줄바꿈 없이 표시됨');
