// 예스24 "책 속으로" 크롤 파이프라인 (spec §4).
//
// 입력 {title, author, isbn} → 출력 {seeds:[{text,sourceName,sourceUrl}], status, productUrl}.
//   1) 검색: /Product/Search?query=<제목 저자>&domain=BOOK  (JS 렌더 → .gd_name 대기)
//   2) 상품 매칭: 검색결과 .gd_name 앵커 후보를 ISBN13 대조로 정확 매칭(동명이서·판본 방지)
//   3) 발췌 추출: 상품페이지 스크롤(lazy-load) → innerText "책 속으로" 섹션 파싱
//
// 구현 메모(2026-06-18 라이브 검증으로 spec §4 갱신):
//   - spec 초안의 domain=ALL 은 현재 홈으로 리다이렉트 → domain=BOOK 사용.
//   - 검색결과 링크는 프로모 슬롯과 섞임 → 실제 결과 앵커 셀렉터 .gd_name 으로 한정.
//   - "책 속으로" 섹션은 스크롤해야 lazy-load 됨.
//   - 발췌 구분자는 책마다 다름("* " 또는 "--- p.NN 「장」 중에서" 인용줄) → 줄 단위 + 출처줄 제거로 통일.

const SEARCH_BASE = 'https://www.yes24.com/Product/Search?domain=BOOK&query=';
const SECTION_MARKER = '책 속으로';
const MIN_LEN = 15;
const MAX_LEN = 400;
const MAX_SEEDS = 6;            // spec §8: 인용 범위 최소 — 책당 ≤6
const MAX_CANDIDATES = 5;       // ISBN 대조할 검색결과 후보 상한

// "책 속으로" 다음에 오는 섹션 헤더들 — 섹션 경계 컷용(다음 섹션 잡음 차단).
const NEXT_SECTION_HEADERS = [
  '출판사 리뷰', '출판사리뷰', '추천사', '저자 소개', '저자소개', '목차',
  '회원 리뷰', '회원리뷰', '한줄평', '이 책의 시리즈', '함께 보면', '관련 분류',
  '카드/간편결제', '배송안내', '교환', '반품', '품질보증',
];

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const onlyDigitsX = (s) => String(s || '').replace(/[^0-9Xx]/g, '');
const buildQuery = (title, author) => norm(`${title || ''} ${author || ''}`);

// 출처/인용 메타 줄인가? (발췌 본문이 아니라 페이지·장 표기)
function isCitationLine(line) {
  const l = line.trim();
  if (!l) return true;
  if (/^[-–—]{2,}/.test(l)) return true;                 // "--- p.49 …"
  if (/^[*·•\-–—]\s/.test(l) && l.length < MIN_LEN) return true;
  if (/^(p\.?\s*\d+|\d+\s*(쪽|페이지|p))/i.test(l)) return true; // 페이지 표기
  if (/중에서\s*$/.test(l) && l.length < 40) return true; // "… 중에서"
  return false;
}

// "책 속으로" 섹션 텍스트 파싱 → 발췌 배열.
function parseExcerpts(bodyText) {
  const text = String(bodyText || '');
  const start = text.indexOf(SECTION_MARKER);
  if (start < 0) return [];
  let section = text.slice(start + SECTION_MARKER.length);
  // 다음 섹션 헤더 전까지로 경계 컷.
  let end = section.length;
  for (const h of NEXT_SECTION_HEADERS) {
    const i = section.indexOf(h);
    if (i > 0 && i < end) end = i;
  }
  section = section.slice(0, end);

  const out = [];
  const seen = new Set();
  for (let raw of section.split('\n')) {
    if (isCitationLine(raw)) continue;
    // 선행 불릿/별표 제거 후 정규화.
    let line = norm(raw.replace(/^[*·•\-–—]\s*/, ''));
    if (line.length < MIN_LEN || line.length > MAX_LEN) continue;
    const key = line.slice(0, 24);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= MAX_SEEDS) break;
  }
  return out;
}

// 상품페이지 스크롤로 lazy 콘텐츠 트리거.
async function scrollToLoad(page) {
  for (let y = 0; y < 10; y++) {
    await page.evaluate((n) => window.scrollTo(0, n * 1000), y);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
}

async function extractFromProduct(page) {
  await scrollToLoad(page);
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  const isbnOnPage = (bodyText.match(/\b(97[89]\d{10})\b/) || [])[1] || '';
  return { excerpts: parseExcerpts(bodyText), isbnOnPage };
}

// 검색결과 .gd_name 앵커 → 상품 URL 후보(중복 제거, 상위 N).
async function collectResultLinks(page) {
  let hrefs = [];
  try {
    hrefs = await page.$$eval('.gd_name', (as) => as.map((a) => a.getAttribute('href')).filter(Boolean));
  } catch { hrefs = []; }
  const seen = new Set();
  const out = [];
  for (const h of hrefs) {
    const m = h.match(/\/(?:product\/goods|Product\/Goods)\/(\d+)/i);
    if (!m) continue;
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(`https://www.yes24.com/product/goods/${id}`);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

// 소프트 차단 감지 — 검색이 홈으로 리다이렉트됐는지.
function isSoftBlocked(url) {
  return /\/Main\/default\.aspx/i.test(url) || /yes24\.com\/?$/.test(url.replace(/[?#].*/, ''));
}

// 단일 책 크롤. managed.context 1개로 순차 사용(server 큐가 직렬 보장).
// status: 'ok' | 'no-excerpt' | 'not-found' | 'blocked'.
export async function crawlYes24(managed, { title, author, isbn }, opts = {}) {
  const log = opts.log || (() => {});
  await managed.warmup();
  const context = managed.context;
  const wantIsbn = onlyDigitsX(isbn);
  const page = await context.newPage();
  try {
    const searchUrl = SEARCH_BASE + encodeURIComponent(buildQuery(title, author));
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    try { await page.waitForSelector('.gd_name', { timeout: 12000 }); } catch { /* 아래서 판정 */ }

    if (isSoftBlocked(page.url())) {
      // 1회 강제 재워밍업 후 1회 재시도.
      log(`  soft-blocked (redirect to home), re-warming: ${title}`);
      await managed.warmup(true);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      try { await page.waitForSelector('.gd_name', { timeout: 12000 }); } catch {}
      if (isSoftBlocked(page.url())) { log(`  still blocked: ${title}`); return { seeds: [], status: 'blocked', productUrl: '' }; }
    }

    const candidates = await collectResultLinks(page);
    if (!candidates.length) { log(`  no results: ${title}`); return { seeds: [], status: 'not-found', productUrl: '' }; }

    let chosen = null;            // ISBN 일치
    let firstWithExcerpt = null;  // 발췌 있는 첫 상품(폴백)

    for (const productUrl of candidates) {
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
      const { excerpts, isbnOnPage } = await extractFromProduct(page);
      const isbnMatch = wantIsbn && isbnOnPage && onlyDigitsX(isbnOnPage) === wantIsbn;

      if (isbnMatch) { chosen = { productUrl, excerpts }; break; }
      if (!firstWithExcerpt && excerpts.length) firstWithExcerpt = { productUrl, excerpts };
      if (!wantIsbn) { chosen = { productUrl, excerpts }; break; }  // ISBN 없으면 첫 결과로 충분
    }

    const pick = chosen || firstWithExcerpt;
    if (!pick || !pick.excerpts.length) {
      const url = (pick && pick.productUrl) || candidates[0];
      log(`  matched but no excerpt: ${title}`);
      return { seeds: [], status: 'no-excerpt', productUrl: url };
    }

    const seeds = pick.excerpts.map((text) => ({ text, sourceName: '예스24 책속으로', sourceUrl: pick.productUrl }));
    log(`  ✓ ${seeds.length} excerpts: ${title}`);
    return { seeds, status: 'ok', productUrl: pick.productUrl };
  } finally {
    await page.close().catch(() => {});
  }
}

export const YES24_LIMITS = { MIN_LEN, MAX_LEN, MAX_SEEDS };
