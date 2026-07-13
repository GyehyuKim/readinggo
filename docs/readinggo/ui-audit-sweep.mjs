/* ui-audit-sweep.mjs (#1243) — UX 감사용 화면 캡처 스윕.
 *
 * render-smoke(#886)가 "렌더가 되는가"를 단언한다면, 이 도구는 **판정하지 않는다** —
 * 감사자(사람/에이전트)가 UX-AUDIT.md §2 렌즈로 판정할 증거(스크린샷 + 콘솔·네트워크 에러)를
 * 375px 실뷰포트에서 일괄 수집한다(§1 운영법). 게스트 조작만(localStorage) — 서버 쓰기 없음.
 *
 * 실행: cd docs/readinggo && npm run audit:ui
 *   AUDIT_URL=<대상, 기본 프로덕션> AUDIT_OUT=<산출 디렉토리, 기본 ./audit-shots>
 * 산출: NN-라벨.png 연번 스크린샷 + 마지막에 콘솔/네트워크 에러 요약(stdout).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL = process.env.AUDIT_URL || 'https://readinggo.hyuniverse.workers.dev/';
const OUT = process.env.AUDIT_OUT || './audit-shots';
mkdirSync(OUT, { recursive: true });

// 재방문 게스트 시드(#1221 hydration 경로) — 탭·상세·세리머니를 걷기 위한 최소 상태.
const SEED = {
  user_books: [{
    id: 'ub_audit', book_id: 'bk_audit',
    book: { id: 'bk_audit', title: '데미안', author: '헤르만 헤세', publisher: '민음사', total_pages: 248, cover_url: '', isbn13: '9788937437564' },
    status: 'reading', current_page: 42, sessions: [], sentences: [], started_at: '2026-07-01', completed_at: null,
  }],
  active_user_book_id: 'ub_audit',
  streak: { current: 1, longest: 1, last_check_in_date: '2026-07-01' }, xp: 12,
  claps: {}, bookmarks: {}, wish_books: [], pending: {},
};

const browser = await chromium.launch({ headless: true });
const errs = [];
let n = 0;

async function newPage(seed) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message.slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP' + r.status() + ' ' + r.url().slice(0, 110)); });
  if (seed) await page.addInitScript((s) => localStorage.setItem('rg_v41', JSON.stringify(s)), seed);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  return { ctx, page };
}
const shot = async (page, label) => {
  n += 1;
  await page.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${label}.png` });
  console.log('  shot', `${String(n).padStart(2, '0')}-${label}.png`);
};
const clickText = (page, t) => page.evaluate((name) => {
  const el = [...document.querySelectorAll('button,div,span,a')].find((e) => (e.innerText || '').trim() === name && e.offsetParent !== null);
  if (el) { el.click(); return true; }
  return false;
}, t);
const scrollMain = (page, y) => page.evaluate((v) => { const m = document.querySelector('main'); if (m) m.scrollTop = v; }, y);
const typeInput = (page, sel, v) => page.evaluate(({ sel, v }) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, { sel, v });
const step = async (label, fn) => {
  try { await fn(); } catch (e) { console.log(`  STEP-FAIL [${label}]: ${e.message.slice(0, 100)}`); }
};

// ── 패스 1: 진짜 신규 게스트(온보딩·검색) ──────────────────────────
console.log('패스 1 — 신규 게스트 (' + URL + ')');
{
  const { ctx, page } = await newPage(null);
  await shot(page, 'first-visit-home');
  await step('search', async () => {
    if (!(await clickText(page, '도서 찾기'))) throw new Error('도서 찾기 못 찾음');
    await page.waitForTimeout(1200); await shot(page, 'search-empty');
    await page.keyboard.type('데미안'); await page.waitForTimeout(3500); await shot(page, 'search-results');
    await typeInput(page, 'input', ''); await page.keyboard.type('ㅁㄴㅇㄹㅁㄴㅇㄹㅁㄴㅇㄹ');
    await page.waitForTimeout(3500); await shot(page, 'search-nonsense');
  });
  await ctx.close();
}

// ── 패스 2: 재방문 게스트(홈·세리머니·탭·상세) ─────────────────────
console.log('패스 2 — 재방문 게스트(시드)');
{
  const { ctx, page } = await newPage(SEED);
  await shot(page, 'home-seeded');
  await step('ceremony', async () => {
    await typeInput(page, 'textarea', '감사 스윕 문장입니다.');
    await page.waitForTimeout(300);
    await clickText(page, '남기기');
    await page.waitForTimeout(2500); await shot(page, 'ceremony');
    await page.waitForTimeout(2500); await shot(page, 'ceremony-late'); // 지연 오버레이(Turnstile 등) 검출용
    for (const t of ['내일도 짹 →', '내일도 짹', '계속하기', '확인']) if (await clickText(page, t)) break;
    await page.waitForTimeout(800);
  });
  for (const tab of ['함께', '책장', '설정']) {
    await step('tab-' + tab, async () => {
      if (!(await clickText(page, tab))) throw new Error('탭 못 찾음');
      await page.waitForTimeout(2000); await shot(page, 'tab-' + tab);
      await scrollMain(page, 1400); await page.waitForTimeout(600); await shot(page, 'tab-' + tab + '-scroll');
      await scrollMain(page, 0); await page.waitForTimeout(300);
    });
  }
  await step('book-detail', async () => {
    await clickText(page, '책장'); await page.waitForTimeout(1200);
    await scrollMain(page, 2800); await page.waitForTimeout(500);
    await page.evaluate(() => {
      const cands = [...document.querySelectorAll('main *')].filter((e) => (e.innerText || '').trim().startsWith('데미안') && e.children.length <= 3 && e.offsetParent !== null);
      const el = cands[cands.length - 1];
      if (el) el.click();
    });
    await page.waitForTimeout(2000); await shot(page, 'book-detail');
  });
  await ctx.close();
}

console.log(`\n== 에러 수집 (${errs.length}건, 중복 제거 상위 20) ==`);
[...new Set(errs)].slice(0, 20).forEach((e) => console.log(' -', e));
await browser.close();
console.log(`\n✓ 캡처 ${n}장 → ${OUT} — UX-AUDIT.md §2 렌즈로 판정하세요.`);
