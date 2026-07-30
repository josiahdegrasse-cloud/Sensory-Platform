// Resolves the current tenant (organization) slug from the URL, used pre-login
// to fetch a company's branding for the login page. Returns null when no tenant
// can be determined, in which case the app falls back to default branding.
//
// Resolution rules:
//   • `VITE_ROOT_DOMAIN` (e.g. "sensoryplatform.com") is the canonical apex.
//     A host of `acme.sensoryplatform.com` → "acme"; the apex or `www` → null.
//   • `*.localhost` is supported for local dev: `acme.localhost` → "acme".
//   • Shared preview hosts can opt into public branding with `?tenant=acme`.
//   • Anything else (IPs, provider URLs without that hint, the apex itself) → null.
//   • Reserved labels (`www`, `app`) never count as a tenant.

const RESERVED_LABELS = new Set(['www', 'app']);
const TENANT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function validTenantSlug(value: string | null | undefined): string | null {
  const slug = value?.trim().toLowerCase() ?? '';
  return slug && TENANT_SLUG.test(slug) && !RESERVED_LABELS.has(slug) ? slug : null;
}

export function getTenantSlug(
  host: string = typeof window === 'undefined' ? '' : window.location.hostname,
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): string | null {
  if (!host) return null;
  const hintedTenant = validTenantSlug(new URLSearchParams(search).get('tenant'));

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
  if (!rootDomain) {
    // A provider preview has no tenant subdomain. This explicit hint selects
    // public branding only; protected database records still enforce access.
    return hintedTenant;
  }

  if (host === rootDomain || host === `www.${rootDomain}`) return null;

  if (host.endsWith(`.${rootDomain}`)) {
    const label = host.slice(0, host.length - rootDomain.length - 1);
    // Only a single-label subdomain is a tenant (ignore deeper nesting).
    if (!label || label.includes('.') || RESERVED_LABELS.has(label)) return null;
    return label;
  }

  // Provider previews cannot use the production wildcard hostname. Keep the
  // explicit, validated hint working after VITE_ROOT_DOMAIN is configured.
  return hintedTenant;
}

export interface TenantAccessResult {
  allowed: boolean;
  requestedTenant: string | null;
  reason: 'shared-host' | 'tenant-match' | 'tenant-mismatch' | 'missing-organization';
}

/**
 * Enforces the authenticated-workspace boundary after login.
 *
 * The shared apex is intentionally organization-neutral, so any linked user may
 * use it. A branded tenant host is stricter: its slug must match the user's
 * organization slug exactly. The database organization is authoritative;
 * public branding/configuration never grants access.
 */
export function checkTenantAccess(
  organizationSlug: string | null | undefined,
  host: string = typeof window === 'undefined' ? '' : window.location.hostname,
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): TenantAccessResult {
  const requestedTenant = getTenantSlug(host, search);

  if (!requestedTenant) {
    return { allowed: true, requestedTenant, reason: 'shared-host' };
  }

  if (!organizationSlug) {
    return { allowed: false, requestedTenant, reason: 'missing-organization' };
  }

  const allowed = requestedTenant.toLowerCase() === organizationSlug.toLowerCase();
  return {
    allowed,
    requestedTenant,
    reason: allowed ? 'tenant-match' : 'tenant-mismatch',
  };
}

export interface TenantSignInEnvironment {
  rootDomain?: string;
  protocol: string;
  hostname: string;
  port?: string;
  origin: string;
}

export interface TenantAuthRedirectEnvironment {
  origin: string;
  hostname: string;
  search: string;
}

/**
 * Preserves a shared-preview tenant hint through OAuth and password recovery.
 * Wildcard tenant hosts already carry identity in the hostname.
 */
export function tenantAuthRedirectUrl(
  path = '/',
  environment?: TenantAuthRedirectEnvironment,
): string {
  const current = environment ?? {
    origin: typeof window === 'undefined' ? 'https://localhost' : window.location.origin,
    hostname: typeof window === 'undefined' ? 'localhost' : window.location.hostname,
    search: typeof window === 'undefined' ? '' : window.location.search,
  };
  const url = new URL(path, current.origin);
  const requestedTenant = getTenantSlug(current.hostname, current.search);
  const hostnameTenant = getTenantSlug(current.hostname, '');
  if (requestedTenant && !hostnameTenant) {
    url.searchParams.set('tenant', requestedTenant);
  }
  return url.toString();
}

/**
 * Builds the best available tenant sign-in address before a wildcard public
 * domain exists. Local development uses `tenant.localhost:<port>`; a shared
 * preview deployment uses an explicit tenant hint until DNS is connected.
 */
export function tenantSignInUrl(
  tenantSlug: string,
  environment?: TenantSignInEnvironment,
): string {
  const current = environment ?? {
    rootDomain: import.meta.env.VITE_ROOT_DOMAIN as string | undefined,
    protocol: typeof window === 'undefined' ? 'https:' : window.location.protocol,
    hostname: typeof window === 'undefined' ? 'localhost' : window.location.hostname,
    port: typeof window === 'undefined' ? '' : window.location.port,
    origin: typeof window === 'undefined' ? 'https://localhost' : window.location.origin,
  };
  const slug = validTenantSlug(tenantSlug);
  if (!slug) return current.origin;

  if (current.rootDomain) {
    return `${current.protocol}//${slug}.${current.rootDomain}`;
  }

  const isLocal = current.hostname === 'localhost'
    || current.hostname === '127.0.0.1'
    || current.hostname.endsWith('.localhost');
  if (isLocal) {
    const port = current.port ? `:${current.port}` : '';
    return `${current.protocol}//${slug}.localhost${port}`;
  }

  const previewUrl = new URL(current.origin);
  previewUrl.searchParams.set('tenant', slug);
  return previewUrl.toString();
}
