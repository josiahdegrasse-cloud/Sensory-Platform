import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('report PDF preview security policy', () => {
  it('allows same-origin blob URLs in preview frames', () => {
    const configPath = fileURLToPath(new URL('../../../vercel.json', import.meta.url));
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      headers?: Array<{ headers?: Array<{ key?: string; value?: string }> }>;
    };
    const contentSecurityPolicy = config.headers
      ?.flatMap(rule => rule.headers ?? [])
      .find(header => header.key === 'Content-Security-Policy')
      ?.value;

    expect(contentSecurityPolicy).toContain("frame-src 'self' blob:");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
  });
});
