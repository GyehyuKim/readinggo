import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';

let rateLimitCalls = 0;
const env = {
  ENVIRONMENT: 'production',
  RATE_LIMITER: { limit: async () => { rateLimitCalls += 1; throw new Error('rate limit reached'); } },
  SUPABASE_URL: 'https://should-not-be-called.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-not-a-secret',
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('auth/database/provider reached'); };

try {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
    for (const auth of [false, true]) {
      const headers = { Origin: 'capacitor://localhost' };
      if (auth) headers.Authorization = 'Bearer synthetic-token';
      const response = await worker.fetch(new Request('https://readinggo.example/api/prompt-lab', {
        method, headers, body: ['GET', 'OPTIONS'].includes(method) ? undefined : '{}',
      }), env, {});
      assert.equal(response.status, 404, `${method}/${auth ? 'auth' : 'anon'} must be 404`);
      assert.deepEqual(await response.json(), { error: 'not found' });
    }
  }
  assert.equal(rateLimitCalls, 0, 'PROD Prompt Lab must return before rate limiting');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('OK: PROD Prompt Lab is 404 before CORS/rate-limit/auth/database for every method/auth state');
