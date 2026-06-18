// seed_sentences 적재/조회 (service role, Supabase REST). 워커 seedRead/seedWrite 와 동일 계약.
// 컬럼: book_key, text, source_name, source_url (30_seed_sentences.sql). 유니크(book_key, coalesce(source_url,'')).
import { env } from './env.mjs';

const SB = () => env('SUPABASE_URL');
const SRK = () => env('SUPABASE_SERVICE_ROLE_KEY');
export const SEED_TARGET = 10;          // 워커 SEED_TARGET 와 일치(책당 목표 문장 수)
export const SEED_TTL_DAYS = 30;        // #806 시드 신선도

function sbHeaders(extra = {}) {
  return { apikey: SRK(), Authorization: `Bearer ${SRK()}`, ...extra };
}

// 책 키 — isbn13 우선, 없으면 정규화 제목(소문자·공백 접기). 워커 seedBookKey 와 동일.
export function seedBookKey(title, isbn) {
  const i = String(isbn || '').replace(/[^0-9Xx]/g, '');
  if (i.length >= 10) return i;
  return String(title || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function dbConfigured() {
  return Boolean(SB() && SRK());
}

// 저장된 시드 조회(레이스 가드 — collector 도 적재 전 stored 확인).
export async function seedRead(bookKey) {
  if (!dbConfigured()) return [];
  try {
    const u = `${SB()}/rest/v1/seed_sentences?book_key=eq.${encodeURIComponent(bookKey)}&select=text,source_name,source_url&limit=${SEED_TARGET}`;
    const r = await fetch(u, { headers: sbHeaders() });
    if (!r.ok) return [];
    const rows = await r.json();
    return (rows || []).map((x) => ({ text: x.text, sourceName: x.source_name || '', sourceUrl: x.source_url || '' }));
  } catch { return []; }
}

// 가장 최신 시드의 created_at (#806 TTL 판정). 없으면 null.
export async function seedLatestAt(bookKey) {
  if (!dbConfigured()) return null;
  try {
    const u = `${SB()}/rest/v1/seed_sentences?book_key=eq.${encodeURIComponent(bookKey)}&select=created_at&order=created_at.desc&limit=1`;
    const r = await fetch(u, { headers: sbHeaders() });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows && rows[0] && rows[0].created_at) || null;
  } catch { return null; }
}

// 신규 시드 insert. 중복 url 은 유니크 인덱스가 무시(Prefer: resolution=ignore-duplicates).
export async function seedWrite(bookKey, seeds) {
  if (!dbConfigured() || !seeds.length) return 0;
  try {
    const r = await fetch(`${SB()}/rest/v1/seed_sentences`, {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' }),
      body: JSON.stringify(seeds.map((s) => ({
        book_key: bookKey, text: s.text, source_name: s.sourceName || null, source_url: s.sourceUrl || null,
      }))),
    });
    return r.ok ? seeds.length : 0;
  } catch { return 0; }
}

// 트렌드 갱신(#806) — 기존 삭제 후 새 시드로 교체. fresh 있을 때만(빈 결과로 비우지 않음).
export async function seedRefresh(bookKey, seeds) {
  if (!dbConfigured() || !seeds.length) return 0;
  try {
    await fetch(`${SB()}/rest/v1/seed_sentences?book_key=eq.${encodeURIComponent(bookKey)}`, {
      method: 'DELETE', headers: sbHeaders(),
    });
  } catch { /* best-effort — 실패해도 아래 write 로 append */ }
  return seedWrite(bookKey, seeds);
}

export function ttlExpired(iso, days = SEED_TTL_DAYS) {
  const t = Date.parse(iso);
  if (isNaN(t)) return false;
  return (Date.now() - t) > days * 86400000;
}

// 인기책 목록(sales_point desc) — prewarm 용.
export async function popularBooks(limit = 150) {
  if (!dbConfigured()) return [];
  try {
    const u = `${SB()}/rest/v1/books?select=isbn13,title,author&sales_point=not.is.null&order=sales_point.desc.nullslast&limit=${limit}`;
    const r = await fetch(u, { headers: sbHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
