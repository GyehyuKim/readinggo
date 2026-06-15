// 둥지 1,600 XP 주기 단계 계산 동작 테스트 (#520 spec / #521 구현)
//
// 실제 docs/readinggo/js/data.js 를 node vm 샌드박스(window 등 스텁)에서 그대로 실행해,
// window 로 노출된 순수 함수의 동작을 검증한다(문자열 존재 검사 아님).
//
// 실행: node tests/nest-cycle.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'docs/readinggo/js/data.js'), 'utf8');

const sandbox = { window: {}, document: {}, console, fetch: () => {}, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const { getNestStageByXp, nestCycleXp, nestCastleCount, nestXpProgress, NEST_CYCLE_XP } = sandbox.window;
for (const [n, f] of [['getNestStageByXp', getNestStageByXp], ['nestCycleXp', nestCycleXp], ['nestCastleCount', nestCastleCount], ['nestXpProgress', nestXpProgress]]) {
  if (typeof f !== 'function') { console.error(`FAIL  data.js 가 ${n} 을 window 로 노출하지 않음`); process.exit(1); }
}

let pass = 0, fail = 0;
function eq(name, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`OK   ${name} → ${JSON.stringify(got)}`); }
  else { fail++; console.error(`FAIL ${name} → got ${JSON.stringify(got)}, want ${JSON.stringify(expected)}`); }
}
const lv = (xp) => getNestStageByXp(xp).lv;

// NEST_CYCLE_XP 상수
eq('NEST_CYCLE_XP = 1600', NEST_CYCLE_XP, 1600);

// 단계 경계 (현재 주기 XP 기반): 0-99=1, 100-399=2, 400-899=3, 900-1599=4
eq('xp 0 → Lv1', lv(0), 1);
eq('xp 99 → Lv1', lv(99), 1);
eq('xp 100 → Lv2', lv(100), 2);
eq('xp 399 → Lv2', lv(399), 2);
eq('xp 400 → Lv3', lv(400), 3);
eq('xp 899 → Lv3', lv(899), 3);
eq('xp 900 → Lv4', lv(900), 4);
eq('xp 1599 → Lv4', lv(1599), 4);

// 1,600 경계: 단계는 Lv1 로 리셋(책 진도 아닌 XP 주기), 상시 표시는 Lv1-4
eq('xp 1600 → Lv1 (주기 리셋)', lv(1600), 1);
eq('xp 1700 → Lv2 (cycleXp 100)', lv(1700), 2);
eq('xp 3200 → Lv1 (2주기째 시작)', lv(3200), 1);

// cycleXp = totalXp % 1600
eq('nestCycleXp(0)', nestCycleXp(0), 0);
eq('nestCycleXp(1599)', nestCycleXp(1599), 1599);
eq('nestCycleXp(1600)', nestCycleXp(1600), 0);
eq('nestCycleXp(1650)', nestCycleXp(1650), 50);

// castleCount = floor(totalXp / 1600), 완독 권수와 무관
eq('nestCastleCount(0)', nestCastleCount(0), 0);
eq('nestCastleCount(1599)', nestCastleCount(1599), 0);
eq('nestCastleCount(1600) = 1', nestCastleCount(1600), 1);
eq('nestCastleCount(3200) = 2', nestCastleCount(3200), 2);

// 성 획득 트리거 동작: 1,600 경계 통과 시 castleCount 증가
const prevXp = 1500, newXp = 1500 + 200; // 완독 보상 등으로 경계 통과
eq('1,600 경계 통과 → 성 +1', nestCastleCount(newXp) - nestCastleCount(prevXp), 1);
eq('경계 통과 후 단계 = Lv2 (cycleXp 100)', lv(newXp), 2);

// 진행도 % = cycleXp / 1600
eq('nestXpProgress(0)', nestXpProgress(0), 0);
eq('nestXpProgress(800) = 50', nestXpProgress(800), 50);
eq('nestXpProgress(1600) = 0 (리셋)', nestXpProgress(1600), 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
