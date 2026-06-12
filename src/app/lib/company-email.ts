// Client-side mirror of the company email domain rules enforced in the DB
// (is_public_email_domain() and org_email_domains_lowercase_format in
// 20260612000000_company_email_domains.sql). Used to give admins immediate,
// friendly validation before an insert hits the check constraints.

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'live.co.uk',
  'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'gmx.de',
  'mail.com', 'mail.ru', 'yandex.com', 'yandex.ru', 'zoho.com',
  'fastmail.com', 'hey.com', 'qq.com', '163.com', '126.com',
  'web.de', 't-online.de', 'orange.fr', 'wanadoo.fr', 'free.fr',
  'btinternet.com', 'sky.com', 'virginmedia.com', 'comcast.net', 'att.net',
]);

const DOMAIN_FORMAT = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isPublicEmailDomain(domain: string): boolean {
  return PUBLIC_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}

/**
 * Normalize admin input ("Acme.com", "@acme.com", "jane@acme.com") to a bare
 * lowercase domain, or explain why it can't be registered.
 */
export function validateCompanyDomain(input: string): { domain: string } | { error: string } {
  let candidate = input.trim().toLowerCase();
  if (candidate.includes('@')) candidate = extractEmailDomain(candidate) ?? candidate.replace(/^@/, '');
  candidate = candidate.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

  if (!candidate) return { error: 'Enter a domain, e.g. acme.com.' };
  if (!DOMAIN_FORMAT.test(candidate)) return { error: `"${candidate}" doesn't look like a valid domain. Use the form acme.com.` };
  if (isPublicEmailDomain(candidate)) {
    return { error: `${candidate} is a personal email provider and can't be linked to a company. Use a domain your company owns.` };
  }
  return { domain: candidate };
}
