/* datastore-contract.mjs — DataStore 런타임 안전망 (#257)
 * 피처 파일이 호출하는 DataStore.<domain>.<method> 가 supabase 어댑터에 실제로 정의돼 있는지 정적 검증.
 * "UI가 존재하지 않는 메서드를 호출" 버그(오타·계약 누락)를 빌드 없이 잡는다 (backend.md §7.2).
 * 실행: node tests/contract/datastore-contract.mjs  (exit 1 = 누락)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'readinggo', 'js');
const files = readdirSync(root).filter((f) => f.endsWith('.js'));

// supabase 어댑터가 정의하는 메서드 이름 집합
const supa = readFileSync(join(root, 'datastore-supabase.js'), 'utf8');
const defined = new Set();
for (const m of supa.matchAll(/(?:async\s+)?([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/g)) defined.add(m[1]);

// 피처 파일에서 DataStore.<domain>.<method>( 호출 수집
const KNOWN_SAFE = new Set(['isConfigured', 'client', 'currentUser', 'onAuthChange', 'myProfile', 'signInWithEmail']); // RG_SB 등 비-DataStore
const calls = new Map(); // method -> file
for (const f of files) {
  if (f.startsWith('datastore')) continue;
  const src = readFileSync(join(root, f), 'utf8');
  for (const m of src.matchAll(/\bDataStore\.(\w+)\.(\w+)\s*\(/g)) {
    if (!calls.has(m[2])) calls.set(m[2], `${f} (DataStore.${m[1]}.${m[2]})`);
  }
}

const missing = [...calls].filter(([method]) => !defined.has(method) && !KNOWN_SAFE.has(method));
console.log(`[contract] supabase 어댑터 정의 메서드 ${defined.size}개 · 피처 호출 ${calls.size}종 검사`);
if (missing.length) {
  console.error('✘ supabase 어댑터에 없는 DataStore 호출:');
  for (const [method, where] of missing) console.error(`  - ${method}  ← ${where}`);
  process.exit(1);
}
console.log('✓ 모든 DataStore 호출이 supabase 어댑터에 존재 (계약 OK)');

// Regression: QA ISSUE-004 — 피처 파일의 `SupabaseDataStore || DataStore` 폴백 금지.
// 이 패턴은 로그인 여부와 무관하게 Supabase를 우선해 게스트에서 user_id=eq.null 400을 유발.
// 활성 어댑터는 window.DataStore 하나(부트에서 스왑). Supabase 전용 기능(타인 프로필·admin)은
// 폴백 없는 직접 참조 + 가드만 허용. Found by /qa on 2026-06-10.
const leaky = [];
for (const f of files) {
  if (f.startsWith('datastore')) continue;
  const src = readFileSync(join(root, f), 'utf8');
  if (/SupabaseDataStore\s*\|\|/.test(src)) leaky.push(f);
}
if (leaky.length) {
  console.error('✘ 게스트 Supabase 누수 패턴(SupabaseDataStore || …) 발견 — window.DataStore 사용:');
  for (const f of leaky) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ SupabaseDataStore 폴백 패턴 없음 (게스트 누수 가드 OK)');
