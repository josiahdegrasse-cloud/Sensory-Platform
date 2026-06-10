import { describe, expect, it, afterEach, vi } from 'vitest';
import { getTenantSlug } from './tenant';

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
});
