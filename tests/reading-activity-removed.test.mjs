import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const components = await readFile(new URL('../docs/readinggo/js/components.js', import.meta.url), 'utf8');
const supabase = await readFile(new URL('../docs/readinggo/js/datastore-supabase.js', import.meta.url), 'utf8');

assert.doesNotMatch(components, /ActivityHeatmap|독서 활동 잔디/, '폐기된 독서 활동 히트맵 UI가 다시 들어오면 안 된다');
assert.doesNotMatch(supabase, /async\s+heatmap\s*\(|sessions\.heatmap|활동 히트맵/, '폐기된 히트맵 조회 계약이 다시 들어오면 안 된다');

console.log('OK: 독서 활동 히트맵 UI와 조회 계약이 제거된 상태');
