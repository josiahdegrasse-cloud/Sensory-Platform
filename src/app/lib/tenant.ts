// Resolves the current tenant (organization) slug from the URL, used pre-login
// to fetch a company's branding for the login page. Returns null when no tenant
// can be determined, in which case the app falls back to default branding.
//
// Resolution rules:
//   • `VITE_ROOT_DOMAIN` (e.g. "sensoryplatform.com") is the canonical apex.
//     A host of `acme.sensoryplatform.com` → "acme"; the apex or `www` → null.
//   • `*.localhost` is supported for local dev: `acme.localhost` → "acme".
//   • Anything else (IPs, vercel preview URLs, the apex itself) → null.
//   • Reserved labels (`www`, `app`) never count as a tenant.

const RESERVED_LABELS = new Set(['www', 'app']);

export function getTenantSlug(host: string = window.location.hostname): string | null {
  if (!host) return null;

  // Local development: acme.localhost
  if (host.endsWith('.localhost')) {
    const label = host.slice(0, -'.localhost'.length);
    return label && !RESERVED_LABELS.has(label) ? label : null;
  }

  // Bare localhost / IP addresses carry no tenant.
  if (host === 'localhost' || /^[0-9.]+$/.test(host) || /^\[[0-9a-f:]+\]$/i.test(host)) {
    return null;
  }

  const rootDomain = import.meta.env.VITE_ROOT_DOMAIN as string | undefined;
  if (!rootDomain) return null; // No configured apex yet → single-brand mode.

  if (host === rootDomain || host === `www.${rootDomain}`) return null;

  if (host.endsWith(`.${rootDomain}`)) {
    const label = host.slice(0, host.length - rootDomain.length - 1);
    // Only a single-label subdomain is a tenant (ignore deeper nesting).
    if (!label || label.includes('.') || RESERVED_LABELS.has(label)) return null;
    return label;
  }

  return null;
}
