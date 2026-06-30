const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(o => o.trim()).filter(Boolean);
const localOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  // Production must set ALLOWED_ORIGINS. Without it, only local dev origins are
  // allowed so deployed functions do not reflect arbitrary websites.
  const origin = allowedOrigins.length > 0
    ? (requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0])
    : (requestOrigin && localOrigins.has(requestOrigin) ? requestOrigin : '');
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}
