/* #1309 account-bound personalization client. No consent/source payload is persisted locally. */
const POLICY_VERSION = '2026-08-25';

export function createPersonalizationLifecycle({ auth, rpc, fetcher, apiOrigin = '', now = () => Date.now() }) {
  let epoch = 0;
  let ownerId = null;
  let accessToken = null;
  let control = null;
  const inflight = new Set();

  const invalidate = () => { epoch += 1; ownerId = null; accessToken = null; control = null; inflight.clear(); };
  const setSession = (session) => {
    const nextOwner = session && session.user && session.user.id || null;
    const nextToken = session && session.access_token || null;
    if (nextOwner !== ownerId || nextToken !== accessToken) invalidate();
    ownerId = nextOwner; accessToken = nextToken;
  };
  const snapshot = () => ({ ownerId, accessToken, epoch });
  const same = (captured, responseOwner) => !!captured.ownerId && captured.ownerId === ownerId
    && captured.accessToken === accessToken && captured.epoch === epoch && responseOwner === captured.ownerId;

  async function refreshSession() {
    const session = await auth();
    setSession(session || null);
    return snapshot();
  }
  async function readControl({ resumePending = true } = {}) {
    const captured = snapshot();
    if (!captured.ownerId) return null;
    const rows = await rpc('personalization_control_read', {});
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!same(captured, row && row.owner_id)) return null;
    control = row && row.policy_version === POLICY_VERSION ? row : null;
    const pendingGeneration = Number(control && control.revoke_pending_generation || 0);
    if (!resumePending || !pendingGeneration) return control;
    const count = Number(await rpc('personalization_lease_count', { p_before_generation: pendingGeneration }));
    if (!same(captured, captured.ownerId) || count > 0) return control;
    const finalizedRows = await rpc('personalization_revoke_finalize', { p_generation: pendingGeneration });
    const finalized = Array.isArray(finalizedRows) ? finalizedRows[0] : finalizedRows;
    if (!same(captured, captured.ownerId) || !finalized || finalized.status !== 'finalized') return control;
    return readControl({ resumePending: false });
  }
  async function optIn() {
    await refreshSession();
    if (!ownerId) throw new Error('auth_required');
    const rows = await rpc('personalization_opt_in', {});
    control = Array.isArray(rows) ? rows[0] : rows;
    return readControl();
  }
  async function revoke({ timeoutMs = 10000, pollMs = 50 } = {}) {
    await refreshSession();
    if (!ownerId) throw new Error('auth_required');
    control = null; inflight.clear();
    const rows = await rpc('personalization_revoke_start', {});
    const start = Array.isArray(rows) ? rows[0] : rows;
    const generation = Number(start && start.consent_generation);
    const deadline = now() + timeoutMs;
    while (now() < deadline) {
      const count = Number(await rpc('personalization_lease_count', { p_before_generation: generation }));
      if (count === 0) {
        const finalizedRows = await rpc('personalization_revoke_finalize', { p_generation: generation });
        const finalized = Array.isArray(finalizedRows) ? finalizedRows[0] : finalizedRows;
        if (finalized && finalized.status === 'finalized') {
          const verified = await readControl();
          if (verified && verified.enabled === false && Number(verified.consent_generation) === generation) return verified;
        }
        const error = new Error((finalized && finalized.status) || 'superseded'); error.code = error.message; throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    const error = new Error('revoke_pending'); error.code = 'revoke_pending'; throw error;
  }
  async function setSourceExcluded(type, id, excluded) {
    await refreshSession();
    if (!ownerId) throw new Error('auth_required');
    return rpc('personalization_source_set_excluded', { p_source_type: type, p_source_id: id, p_excluded: !!excluded });
  }
  async function requestQuestion(payload) {
    await refreshSession();
    const captured = snapshot();
    const before = await readControl();
    if (!same(captured, before && before.owner_id) || !before || before.enabled !== true) return null;
    const requestKey = Symbol('personalized-request'); inflight.add(requestKey);
    let response;
    try {
      response = await fetcher(apiOrigin + '/api/companion', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${captured.accessToken}` },
        body: JSON.stringify({ ...payload, personalization: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !same(captured, data.owner_id) || !inflight.has(requestKey)) return null;
      // Required owner-only post-readback. Generation alone is never sufficient.
      const after = await readControl();
      if (!same(captured, data.owner_id) || !inflight.has(requestKey) || !after || after.enabled !== true
        || Number(after.consent_generation) !== Number(data.consent_generation)) return null;
      return { data, captured, requestKey, generation: Number(data.consent_generation) };
    } finally {
      // Successful proof remains consumable until the synchronous guarded commit below.
      if (!response || !response.ok) inflight.delete(requestKey);
    }
  }
  function commit(proof, sinks) {
    if (!proof || !inflight.has(proof.requestKey) || !same(proof.captured, proof.data.owner_id)
      || !control || control.enabled !== true || Number(control.consent_generation) !== proof.generation) {
      if (proof) inflight.delete(proof.requestKey);
      return false;
    }
    inflight.delete(proof.requestKey);
    // No await in this guarded commit: display/store/analytics share exactly one validated boundary.
    if (sinks && sinks.display) sinks.display(proof.data);
    if (sinks && sinks.store) sinks.store(proof.data);
    if (sinks && sinks.analytics) sinks.analytics(proof.data);
    return true;
  }
  return { invalidate, setSession, refreshSession, readControl, optIn, revoke, setSourceExcluded,
    requestQuestion, commit, snapshot, isEnabled: () => !!(control && control.enabled === true) };
}

function installBrowserRuntime() {
  if (typeof window === 'undefined' || !window.RG_SB || !window.RG_SB.client) return;
  const client = window.RG_SB.client();
  if (!client) return;
  const apiOrigin = (window.RG_CONFIG && window.RG_CONFIG.API_ORIGIN) || '';
  const runtime = createPersonalizationLifecycle({
    auth: async () => { const { data } = await client.auth.getSession(); return data && data.session; },
    rpc: async (name, args) => { const { data, error } = await client.rpc(name, args); if (error) throw error; return data; },
    fetcher: (url, init) => {
      if (window.RG_apiFetch) {
        const path = apiOrigin && url.startsWith(apiOrigin) ? url.slice(apiOrigin.length) : url;
        return window.RG_apiFetch(path, init);
      }
      return fetch(url, init);
    },
    apiOrigin,
  });
  client.auth.onAuthStateChange((_event, session) => runtime.setSession(session));
  runtime.refreshSession().then(() => runtime.readControl()).catch(() => runtime.invalidate());
  window.RG_personalization = runtime;
}
installBrowserRuntime();
