/**
 * ReadingGo — LLM 독서 파트너 프록시
 * Cloudflare Worker: 클라이언트 → Worker → Anthropic API
 *
 * 배포: wrangler deploy
 * 환경 변수: ANTHROPIC_API_KEY (wrangler secret put ANTHROPIC_API_KEY)
 * 라우트: /api/companion (wrangler.toml routes 설정 필요)
 *
 * TODO: 말투·페르소나 튜닝은 클라이언트 system 프롬프트를 Worker에서 덮어쓰는 방식으로.
 */

const ALLOWED_ORIGINS = [
  'https://resilient-licorice-f4b889.netlify.app',
  'https://readinggo.pages.dev',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];

// TODO: Claude API 모델 — Phase 1 실배포 시 비용·품질 재검토
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { system, messages } = body;
    if (!system || !Array.isArray(messages) || !messages.length) {
      return new Response(JSON.stringify({ error: 'system 과 messages 필드가 필요합니다' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages }),
    });

    const data = await anthropicRes.json();
    return new Response(JSON.stringify(data), {
      status: anthropicRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
