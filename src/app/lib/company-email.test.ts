import { describe, expect, it } from 'vitest';
import { extractEmailDomain, isPublicEmailDomain, validateCompanyDomain } from './company-email';

describe('extractEmailDomain', () => {
  it('returns the lowercased domain of an email', () => {
    expect(extractEmailDomain('Jane@Acme.COM')).toBe('acme.com');
  });

  it('uses the last @ for quoted/odd local parts', () => {
    expect(extractEmailDomain('a@b@acme.com')).toBe('acme.com');
  });

  it('returns null when there is no domain', () => {
    expect(extractEmailDomain('not-an-email')).toBeNull();
    expect(extractEmailDomain('trailing@')).toBeNull();
    expect(extractEmailDomain('@acme.com')).toBeNull();
  });
});

describe('isPublicEmailDomain', () => {
  it('flags consumer mailbox providers', () => {
    expect(isPublicEmailDomain('gmail.com')).toBe(true);
    expect(isPublicEmailDomain('Outlook.com')).toBe(true);
    expect(isPublicEmailDomain('icloud.com')).toBe(true);
  });

  it('passes company domains', () => {
    expect(isPublicEmailDomain('acme.com')).toBe(false);
    expect(isPublicEmailDomain('newfoodinnovation.co.uk')).toBe(false);
  });
});

describe('validateCompanyDomain', () => {
  it('normalizes plain domains', () => {
    expect(validateCompanyDomain('  Acme.COM ')).toEqual({ domain: 'acme.com' });
  });

  it('accepts full emails, @-prefixed and url-ish input', () => {
    expect(validateCompanyDomain('jane@acme.com')).toEqual({ domain: 'acme.com' });
    expect(validateCompanyDomain('@acme.com')).toEqual({ domain: 'acme.com' });
    expect(validateCompanyDomain('https://www.acme.com/about')).toEqual({ domain: 'acme.com' });
  });

  it('accepts multi-label company domains', () => {
    expect(validateCompanyDomain('research.acme.co.uk')).toEqual({ domain: 'research.acme.co.uk' });
  });

  it('rejects consumer providers with an explanation', () => {
    const result = validateCompanyDomain('gmail.com');
    expect('error' in result && result.error).toMatch(/personal email provider/);
  });

  it('rejects malformed input', () => {
    expect('error' in validateCompanyDomain('')).toBe(true);
    expect('error' in validateCompanyDomain('acme')).toBe(true);
    expect('error' in validateCompanyDomain('-acme.com')).toBe(true);
    expect('error' in validateCompanyDomain('ac me.com')).toBe(true);
  });
});
