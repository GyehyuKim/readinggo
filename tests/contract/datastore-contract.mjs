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
