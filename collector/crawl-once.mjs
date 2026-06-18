// 단발 크롤 검증 도구 — DB 적재 없이 예스24 파이프라인만 확인(시크릿 불필요).
// 사용: node crawl-once.mjs "제목" "저자" "isbn13"
//   예: node crawl-once.mjs "모순" "양귀자" "9788998441012"
import { createBrowser } from './lib/browser.mjs';
import { crawlYes24 } from './lib/yes24.mjs';

const [, , title, author = '', isbn = ''] = process.argv;
if (!title) { console.error('사용: node crawl-once.mjs "제목" "저자" "isbn13"'); process.exit(1); }

const mb = await createBrowser();
try {
  const res = await crawlYes24(mb, { title, author, isbn }, { log: (m) => console.log(m) });
  console.log(`\nstatus=${res.status}  url=${res.productUrl}`);
  console.log(`seeds=${res.seeds.length}`);
  res.seeds.forEach((s, i) => console.log(`  [${i + 1}] ${s.text}`));
} finally {
  await mb.close();
}
