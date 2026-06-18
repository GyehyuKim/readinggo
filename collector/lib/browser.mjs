// 헤드리스 크롬 1개 관리(spec §5: 동시성 1) + 봇 탐지 완화 + 홈 워밍업.
// yes24 는 의심 트래픽을 홈(/Main/default.aspx)으로 소프트 리다이렉트한다 → 워밍업으로 세션 쿠키 확보.
import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function createBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage', '--lang=ko-KR'],
  });
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
  });
  // 흔한 headless 신호 제거(navigator.webdriver 등).
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });
  return new ManagedBrowser(browser, context);
}

export class ManagedBrowser {
  constructor(browser, context) {
    this.browser = browser;
    this.context = context;
    this._warmedAt = 0;
  }

  // 홈 1회 방문으로 세션 쿠키 확보. WARM_TTL 안에서는 재방문 생략.
  async warmup(force = false) {
    const WARM_TTL = 15 * 60 * 1000;
    if (!force && this._warmedAt && Date.now() - this._warmedAt < WARM_TTL) return;
    const page = await this.context.newPage();
    try {
      await page.goto('https://www.yes24.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      this._warmedAt = Date.now();
    } catch { /* best-effort */ } finally {
      await page.close().catch(() => {});
    }
  }

  async close() {
    await this.context.close().catch(() => {});
    await this.browser.close().catch(() => {});
  }
}
