const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(o => o.trim()).filter(Boolean);
const localOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);
const platformOrigins = new Set([
  'https://sensory-platform.vercel.app',
  'https://sensory-analysis-dashboard.vercel.app',
]);

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const configuredOrigins = new Set([...allowedOrigins, ...platformOrigins]);
  // Production can set ALLOWED_ORIGINS, but local dev origins should still work
  // against the linked project so admins can test Edge Functions from Vite.
  const origin = requestOrigin && (localOrigins.has(requestOrigin) || configuredOrigins.has(requestOrigin))
    ? requestOrigin
    : configuredOrigins.values().next().value ?? '';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}
