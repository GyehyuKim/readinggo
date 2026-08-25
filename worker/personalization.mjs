const POLICY_VERSION = '2026-08-25';
const MAX_SOURCES = 5;
const MAX_CONTEXT_CODEPOINTS = 2000;
const PRESETS = new Set(['balanced', 'deep', 'light', 'emotional', 'critical', 'context', 'author', '']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cp = (value) => Array.from(String(value == null ? '' : value));
const clip = (value, max) => cp(value).slice(0, max).join('');
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function tokenFrom(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export async function personalizationActor(request, env, fetchImpl = fetch) {
  const token = tokenFrom(request);
  if (!token) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const response = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user && UUID.test(user.id || '') ? { id: user.id, token } : null;
  } catch { return null; }
}

async function rpc(env, actor, name, args = {}, fetchImpl = fetch) {
  const response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${actor.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('personalization rpc failed');
    error.status = response.status;
    error.code = data && data.message === 'revoke_pending' ? 'revoke_pending' : 'rpc_failed';
    throw error;
  }
  return data;
}

function controlRow(value) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || row.policy_version !== POLICY_VERSION || row.owner_id == null) return null;
  return row;
}

function sourceHeader(source, index) {
  return `[내 기록 ${index + 1} | ${source.type}]\n책: ${source.title || ''}${source.author ? ` / ${source.author}` : ''}\n쪽: ${source.page == null ? '' : source.page} | 날짜: ${source.created_at || ''} | 상태: ${source.status || ''}\n`;
}

function sourceBlock(source, index) {
  return `${sourceHeader(source, index)}미리보기: ${source.preview || ''}\n본문: ${source.text || ''}`;
}

export function composePersonalizationContext(rawSources, maxCodePoints = MAX_CONTEXT_CODEPOINTS) {
  const sources = [];
  let block = '';
  for (const raw of (Array.isArray(rawSources) ? rawSources : []).slice(0, MAX_SOURCES)) {
    const source = {
      type: ['sentence', 'note', 'qa'].includes(raw && raw.type) ? raw.type : 'sentence',
      id: String((raw && raw.id) || ''), book_id: String((raw && raw.book_id) || ''),
      page: raw && raw.page != null ? Number(raw.page) : null,
      created_at: String((raw && raw.created_at) || ''), title: String((raw && raw.title) || ''),
      author: String((raw && raw.author) || ''), status: String((raw && raw.status) || ''),
      preview: String((raw && raw.preview) || ''), text: String((raw && raw.text) || ''),
    };
    const separator = sources.length ? '\n\n---\n\n' : '';
    const fixed = separator + sourceHeader(source, sources.length) + '미리보기: \n본문: ';
    const available = maxCodePoints - cp(block + fixed).length;
    if (available < 0) break;
    const previewBudget = Math.min(cp(source.preview).length, Math.floor(available / 3));
    source.preview = clip(source.preview, previewBudget);
    const afterPreview = fixed.replace('미리보기: \n', `미리보기: ${source.preview}\n`);
    source.text = clip(source.text, Math.max(0, maxCodePoints - cp(block + afterPreview).length));
    const next = separator + sourceBlock(source, sources.length);
    if (cp(block + next).length > maxCodePoints) break;
    block += next;
    sources.push(source);
  }
  return { sources, block, total_chars: cp(block).length };
}

function validateContextBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const allowed = new Set(['current_sentence_id', 'book_id', 'query_text', 'preset']);
  if (Object.keys(body).some((key) => !allowed.has(key))) return null;
  if (!UUID.test(body.current_sentence_id || '') || !UUID.test(body.book_id || '')) return null;
  if (typeof body.query_text !== 'string' || cp(body.query_text).length > 2000) return null;
  if (typeof body.preset !== 'string' || !PRESETS.has(body.preset)) return null;
  return { current_sentence_id: body.current_sentence_id, book_id: body.book_id,
    query_text: body.query_text, preset: body.preset };
}

async function retrieve(actor, input, env, fetchImpl) {
  const currentOwned = await rpc(env, actor, 'personalization_context_validate', {
    p_current_sentence_id: input.current_sentence_id,
    p_book_id: input.book_id,
  }, fetchImpl);
  if (currentOwned !== true) {
    const error = new Error('not found'); error.status = 404; error.code = 'not_found'; throw error;
  }
  const control = controlRow(await rpc(env, actor, 'personalization_control_read', {}, fetchImpl));
  if (!control || control.owner_id !== actor.id || control.enabled !== true) {
    const error = new Error('consent inactive'); error.status = 409; error.code = 'consent_inactive'; throw error;
  }
  const rows = await rpc(env, actor, 'personalization_retrieve', {
    p_current_sentence_id: input.current_sentence_id, p_book_id: input.book_id,
    p_query_text: input.query_text, p_preset: input.preset,
  }, fetchImpl);
  const context = composePersonalizationContext(rows);
  return { owner_id: actor.id, consent_generation: Number(control.consent_generation), ...context };
}

export async function personalizationContextProxy(request, env, fetchImpl = fetch) {
  if (env.ENVIRONMENT !== 'development') return json({ error: 'not found' }, 404);
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const actor = await personalizationActor(request, env, fetchImpl);
  if (!actor) return json({ error: 'unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid request' }, 400); }
  const input = validateContextBody(body);
  if (!input) return json({ error: 'invalid request' }, 400);
  try {
    const manifest = await retrieve(actor, input, env, fetchImpl);
    return json({ owner_id: manifest.owner_id, consent_generation: manifest.consent_generation,
      sources: manifest.sources, total_chars: manifest.total_chars });
  } catch (error) {
    return json({ error: error.code === 'consent_inactive' ? 'consent inactive' : 'unavailable' }, error.status || 503);
  }
}

export async function personalizedCompanion(request, body, env, generate, fetchImpl = fetch) {
  if (env.ENVIRONMENT !== 'development') return null;
  const actor = await personalizationActor(request, env, fetchImpl);
  if (!actor) return json({ error: 'unauthorized' }, 401);
  if (body && ('user_id' in body || 'owner_id' in body || 'sources' in body || 'source_ids' in body)) return json({ error: 'invalid request' }, 400);
  const input = validateContextBody({ current_sentence_id: body.current_sentence_id, book_id: body.book_id,
    query_text: body.query_text, preset: body.preset || '' });
  if (!input) return json({ error: 'invalid request' }, 400);
  let manifest;
  try { manifest = await retrieve(actor, input, env, fetchImpl); }
  catch (error) { return json({ error: error.code || 'unavailable' }, error.status || 503); }
  const requestId = crypto.randomUUID();
  let leased = false;
  try {
    leased = await rpc(env, actor, 'personalization_lease_acquire', {
      p_request_id: requestId, p_generation: manifest.consent_generation,
    }, fetchImpl) === true;
    if (!leased) return json({ error: 'stale_consent_generation' }, 409);
    const assertLeaseActive = async () => {
      const valid = await rpc(env, actor, 'personalization_lease_validate', {
        p_request_id: requestId, p_generation: manifest.consent_generation,
      }, fetchImpl);
      if (valid !== true) { const error = new Error('stale_consent_generation'); error.code = 'stale_consent_generation'; throw error; }
    };
    const result = await generate(manifest.block, assertLeaseActive);
    await assertLeaseActive();
    return json({ ...result, owner_id: actor.id, consent_generation: manifest.consent_generation,
      sources: manifest.sources, total_chars: manifest.total_chars });
  } catch (error) {
    if (error && error.code === 'stale_consent_generation') return json({ error: error.code }, 409);
    return json({ error: 'personalization unavailable' }, 503);
  }
  finally {
    if (leased) await rpc(env, actor, 'personalization_lease_release', { p_request_id: requestId }, fetchImpl).catch(() => {});
  }
}

export { POLICY_VERSION, MAX_SOURCES, MAX_CONTEXT_CODEPOINTS, validateContextBody };
