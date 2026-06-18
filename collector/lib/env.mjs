// 경량 .env 로더 — 기존 supabase/*.mjs 패턴 재사용(외부 의존 없음).
// 우선순위: process.env > collector/.env > repo 루트 .env.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(p) {
  const out = {};
  let txt = '';
  try { txt = readFileSync(p, 'utf8'); } catch { return out; }
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    let v = line.slice(eq + 1).trim();
    // 따옴표 감싼 값 허용
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

// collector/.env (수집기 전용) → repo 루트 .env (공용) 순으로 병합. 앞이 우선.
const fileEnv = {
  ...parseEnvFile(resolve(here, '../../.env')),       // repo 루트 .env (낮은 우선)
  ...parseEnvFile(resolve(here, '../.env')),          // collector/.env (높은 우선)
};

export function env(key, fallback = '') {
  return process.env[key] ?? fileEnv[key] ?? fallback;
}

export function requireEnv(key) {
  const v = env(key);
  if (!v) { console.error(`✘ 환경변수 ${key} 필요 (collector/.env 또는 repo 루트 .env)`); process.exit(2); }
  return v;
}
