import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'docs/readinggo/dist');
const text = readdirSync(join(dist, 'assets'))
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(join(dist, 'assets', name), 'utf8'))
  .join('\n');

const prodSupabaseHost = 'cttllwwkaddghqttyhkg.supabase.co';
const prodWorkerHost = 'readinggo.hyuniverse.workers.dev';
const expectedSupabaseHost = new URL(process.env.EXPECTED_DEV_SUPABASE_URL || '').hostname;
const expectedWorkerHost = new URL(process.env.EXPECTED_DEV_WORKER_URL || '').hostname;

assert(expectedSupabaseHost && expectedWorkerHost, 'DEV endpoint expectations are required');
assert(text.includes(expectedSupabaseHost), 'DEV build must contain the DEV Supabase endpoint');
assert(text.includes(expectedWorkerHost), 'DEV build must contain the DEV Worker endpoint');
assert(!text.includes(prodSupabaseHost), 'DEV build must not contain the production Supabase endpoint');
assert(!text.includes(prodWorkerHost), 'DEV build must not contain the production Worker endpoint');

const devConfig = readFileSync('wrangler.dev.toml', 'utf8');
assert(!devConfig.includes('e22049c87f9d44139242316c3c445bf9'), 'DEV must not bind production KV');
assert(!/^\[triggers\]/m.test(devConfig), 'DEV must not schedule side effects');
assert(!/\[\[r2_buckets\]\]/m.test(devConfig), 'DEV must not bind production R2');
console.log('OK: DEV bundle and Worker bindings exclude production endpoints and write paths');
