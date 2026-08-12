import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  checkTenantAccess,
  getTenantSlug,
  localTenantPreviewRedirectUrl,
  tenantAuthRedirectUrl,
  tenantSignInUrl,
} from './tenant';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getTenantSlug', () => {
  it('returns null for bare localhost, IPs, and apex/www without a configured root', () => {
    expect(getTenantSlug('localhost')).toBeNull();
    expect(getTenantSlug('127.0.0.1')).toBeNull();
    expect(getTenantSlug('app.vercel.app')).toBeNull(); // no VITE_ROOT_DOMAIN → single-brand
  });

  it('reads a dev subdomain from *.localhost', () => {
    expect(getTenantSlug('acme.localhost')).toBe('acme');
    expect(getTenantSlug('www.localhost')).toBeNull(); // reserved label
  });

  it('reads an explicit tenant hint on a shared preview without trusting arbitrary values', () => {
    expect(getTenantSlug('sensory-platform.vercel.app', '?tenant=fermiq')).toBe('fermiq');
    expect(getTenantSlug('sensory-platform.vercel.app', '?tenant=www')).toBeNull();
    expect(getTenantSlug('sensory-platform.vercel.app', '?tenant=%3Cscript%3E')).toBeNull();
  });

  it('resolves a single-label subdomain against the configured root domain', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(getTenantSlug('acme.sensoryplatform.com')).toBe('acme');
    expect(getTenantSlug('beta-foods.sensoryplatform.com')).toBe('beta-foods');
  });

  it('treats the apex, www, and reserved labels as no tenant', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(getTenantSlug('sensoryplatform.com')).toBeNull();
    expect(getTenantSlug('www.sensoryplatform.com')).toBeNull();
    expect(getTenantSlug('app.sensoryplatform.com')).toBeNull();
  });

  it('ignores deeper nesting and unrelated hosts', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(getTenantSlug('a.b.sensoryplatform.com')).toBeNull();
    expect(getTenantSlug('acme.otherdomain.com')).toBeNull();
  });

  it('keeps an explicit preview hint after a production root is configured', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(getTenantSlug('sensory-platform-git-feature.vercel.app', '?tenant=fermiq')).toBe('fermiq');
  });
});

describe('localTenantPreviewRedirectUrl', () => {
  it('redirects a validated bare-localhost hint to the canonical tenant host', () => {
    expect(localTenantPreviewRedirectUrl({
      protocol: 'http:',
      hostname: 'localhost',
      port: '4173',
      pathname: '/reset-password',
      search: '?tenant=FermIQ&from=email',
      hash: '#confirm',
    })).toBe('http://fermiq.localhost:4173/reset-password?from=email#confirm');
  });

  it('does not redirect invalid, reserved, or already canonical tenant hosts', () => {
    const base = { protocol: 'http:', port: '4173', pathname: '/', hash: '' };
    expect(localTenantPreviewRedirectUrl({ ...base, hostname: 'localhost', search: '?tenant=www' })).toBeNull();
    expect(localTenantPreviewRedirectUrl({ ...base, hostname: 'localhost', search: '?tenant=%3Cscript%3E' })).toBeNull();
    expect(localTenantPreviewRedirectUrl({ ...base, hostname: 'fermiq.localhost', search: '?tenant=other' })).toBeNull();
  });
});

describe('checkTenantAccess', () => {
  it('allows a linked user on the shared apex', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(checkTenantAccess('acme', 'sensoryplatform.com')).toEqual({
      allowed: true,
      requestedTenant: null,
      reason: 'shared-host',
    });
  });

  it('allows an organization on its own branded tenant host', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(checkTenantAccess('acme', 'acme.sensoryplatform.com')).toEqual({
      allowed: true,
      requestedTenant: 'acme',
      reason: 'tenant-match',
    });
  });

  it('rejects an organization on another tenant host', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(checkTenantAccess('acme', 'competitor.sensoryplatform.com')).toEqual({
      allowed: false,
      requestedTenant: 'competitor',
      reason: 'tenant-mismatch',
    });
  });

  it('rejects an unlinked profile on a tenant host', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(checkTenantAccess(null, 'acme.sensoryplatform.com')).toEqual({
      allowed: false,
      requestedTenant: 'acme',
      reason: 'missing-organization',
    });
  });

  it('compares canonical slugs case-insensitively', () => {
    expect(checkTenantAccess('Acme', 'acme.localhost').allowed).toBe(true);
  });

  it('enforces the same organization boundary for a branded shared preview', () => {
    expect(checkTenantAccess('fermiq', 'sensory-platform.vercel.app', '?tenant=fermiq').allowed).toBe(true);
    expect(checkTenantAccess('competitor', 'sensory-platform.vercel.app', '?tenant=fermiq')).toMatchObject({
      allowed: false,
      requestedTenant: 'fermiq',
      reason: 'tenant-mismatch',
    });
  });
});

describe('tenantSignInUrl', () => {
  it('uses a port-aware localhost subdomain before a public domain exists', () => {
    expect(tenantSignInUrl('Fermiq', {
      protocol: 'http:',
      hostname: '127.0.0.1',
      port: '5173',
      origin: 'http://127.0.0.1:5173',
    })).toBe('http://fermiq.localhost:5173');
  });

  it('uses the configured public wildcard root when available', () => {
    expect(tenantSignInUrl('fermiq', {
      rootDomain: 'sensory.example.com',
      protocol: 'https:',
      hostname: 'sensory.example.com',
      origin: 'https://sensory.example.com',
    })).toBe('https://fermiq.sensory.example.com');
  });

  it('adds an explicit tenant hint to a shared preview deployment', () => {
    expect(tenantSignInUrl('fermiq', {
      protocol: 'https:',
      hostname: 'sensory-platform.vercel.app',
      origin: 'https://sensory-platform.vercel.app',
    })).toBe('https://sensory-platform.vercel.app/?tenant=fermiq');
  });
});

describe('tenantAuthRedirectUrl', () => {
  it('preserves the preview tenant hint for OAuth and recovery routes', () => {
    const environment = {
      origin: 'https://sensory-platform.vercel.app',
      hostname: 'sensory-platform.vercel.app',
      search: '?tenant=fermiq',
    };
    expect(tenantAuthRedirectUrl('/', environment)).toBe(
      'https://sensory-platform.vercel.app/?tenant=fermiq',
    );
    expect(tenantAuthRedirectUrl('/reset-password', environment)).toBe(
      'https://sensory-platform.vercel.app/reset-password?tenant=fermiq',
    );
  });

  it('does not add a redundant hint to a wildcard tenant host', () => {
    vi.stubEnv('VITE_ROOT_DOMAIN', 'sensoryplatform.com');
    expect(tenantAuthRedirectUrl('/', {
      origin: 'https://fermiq.sensoryplatform.com',
      hostname: 'fermiq.sensoryplatform.com',
      search: '',
    })).toBe('https://fermiq.sensoryplatform.com/');
  });
});
