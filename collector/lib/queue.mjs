// seed_queue 조작 (service role REST). collector 가 아웃바운드 폴링.
import { env } from './env.mjs';

const SB = () => env('SUPABASE_URL');
const SRK = () => env('SUPABASE_SERVICE_ROLE_KEY');
const H = (extra = {}) => ({ apikey: SRK(), Authorization: `Bearer ${SRK()}`, ...extra });

export const MAX_ATTEMPTS = 3;

// pending 항목 픽업 — priority(high 먼저)·오래된 것 먼저. limit 개.
export async function fetchPending(limit = 3) {
  const u = `${SB()}/rest/v1/seed_queue?status=eq.pending&order=priority.desc,created_at.asc&limit=${limit}`
    + `&select=id,book_key,title,author,isbn,priority,attempts`;
  const r = await fetch(u, { headers: H() });
  if (!r.ok) return [];
  return await r.json();
}

export async function markDone(id) {
  await fetch(`${SB()}/rest/v1/seed_queue?id=eq.${id}`, {
    method: 'PATCH', headers: H({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status: 'done' }),
  }).catch(() => {});
}

// 실패 — attempts++. MAX 초과면 status='failed', 아니면 pending 유지(다음 폴에서 재시도).
export async function markFailed(id, attempts, errMsg) {
  const next = (attempts || 0) + 1;
  const status = next >= MAX_ATTEMPTS ? 'failed' : 'pending';
  await fetch(`${SB()}/rest/v1/seed_queue?id=eq.${id}`, {
    method: 'PATCH', headers: H({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status, attempts: next, last_error: String(errMsg || '').slice(0, 500) }),
  }).catch(() => {});
  return status;
}

// 큐잉(워커가 주로 하지만 prewarm·테스트용). book_key 중복은 무시.
export async function enqueue({ bookKey, title, author, isbn, priority = 'low' }) {
  const r = await fetch(`${SB()}/rest/v1/seed_queue?on_conflict=book_key`, {
    method: 'POST',
    headers: H({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' }),
    body: JSON.stringify({ book_key: bookKey, title, author: author || null, isbn: isbn || null, priority }),
  });
  return r.ok;
}
