/* boot-smoke.mjs — 부팅 메커니즘 회귀 방지 (#691)
 * index.html이 자체 호스팅 Babel(vendor/babel.min.js)로 loadBabel하는 모든 js 파일을
 * 실제 그 Babel로 동일 옵션(presets:[['react',{runtime:'classic'}]])으로 변환해
 * (1) 변환 자체가 throw하지 않고 (2) 출력에 import 구문이 주입되지 않음을 검증한다.
 * automatic runtime 회귀(#687: 전사이트 "Cannot use import statement" 크래시)를 빌드 없이 잡는다.
 * 실행: node tests/boot-smoke.mjs  (exit 1 = 부팅 깨짐)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'readinggo');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// 1) 자체 호스팅 Babel(UMD)을 Node에서 로드 — index.html이 실제로 참조하는 그 파일.
const babelSrc = readFileSync(join(root, 'vendor', 'babel.min.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', babelSrc)(mod, mod.exports);
const Babel = mod.exports;
if (typeof Babel.transform !== 'function') {
  console.error('✘ vendor/babel.min.js 로드 실패 — Babel.transform 없음');
  process.exit(1);
}
console.log(`[boot-smoke] vendor Babel v${Babel.version} 로드`);

// 2) index.html의 babel src가 자체 호스팅(vendor/)인지 확인 — unpkg 회귀 차단.
if (!/<script\s+src="vendor\/babel\.min\.js/.test(html)) {
  console.error('✘ index.html이 vendor/babel.min.js를 로드하지 않음 (unpkg 회귀?)');
  process.exit(1);
}

// 3) index.html이 loadBabel('js/X.js')로 로드하는 파일 목록 추출.
const files = [...html.matchAll(/loadBabel\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
if (files.length === 0) {
  console.error('✘ loadBabel 호출을 찾지 못함 — 부팅 시퀀스 파싱 실패');
  process.exit(1);
}
console.log(`[boot-smoke] 부팅 시 변환 대상 ${files.length}개: ${files.join(', ')}`);

// 4) 각 파일을 부팅과 동일 옵션으로 변환 — throw 없음 + import 미주입 검증.
const fails = [];
for (const rel of files) {
  const code = readFileSync(join(root, rel), 'utf8');
  let out;
  try {
    out = Babel.transform(code, {
      presets: [['react', { runtime: 'classic' }]],
      filename: rel,
    }).code;
  } catch (e) {
    fails.push(`${rel}: 변환 throw — ${e.message}`);
    continue;
  }
  // classic runtime이면 import/export가 출력에 남으면 안 됨(eval 시 "Cannot use import statement").
  if (/^\s*import\s/m.test(out) || /^\s*export\s/m.test(out)) {
    fails.push(`${rel}: 변환 출력에 import/export 주입됨 (automatic runtime 회귀?)`);
  }
}

if (fails.length) {
  console.error('✘ 부팅 스모크 실패:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ ${files.length}개 파일 모두 자체 호스팅 Babel로 정상 변환 (부팅 OK)`);
