const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(o => o.trim()).filter(Boolean);

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  // When ALLOWED_ORIGINS isn't configured, reflect the caller's origin so the
  // function still works (e.g. local dev) instead of silently failing CORS
  // with an empty Allow-Origin header. When it IS configured, enforce the allowlist.
  const origin = allowedOrigins.length > 0
    ? (requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0])
    : (requestOrigin ?? '');
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}
