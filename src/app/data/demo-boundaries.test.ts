import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (entry.name.includes('.test.')) return [];
    return [fullPath];
  }));

  return nested.flat();
}

describe('demo data boundaries', () => {
  it('keeps production source imports off legacy mock/demo fixture paths', async () => {
    const files = await collectSourceFiles(appRoot);
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (/from\s+['"][^'"]*data\/mock-users['"]/.test(source)) {
        violations.push(path.relative(appRoot, file));
      }
      if (/from\s+['"][^'"]*data\/temporary-cheese-demo['"]/.test(source)) {
        violations.push(path.relative(appRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps compatibility defaults from silently becoming cheese or dairy', async () => {
    const source = await readFile(path.join(appRoot, 'data/survey-domain.ts'), 'utf8');

    expect(source).not.toMatch(/DEFAULT_CATA_ATTRIBUTES\s*=\s*CATEGORY_CATA_ATTRIBUTES\.(?:dairy|cheese)/);
    expect(source).not.toMatch(/INTENSITY_ATTRIBUTES\s*=\s*CATEGORY_INTENSITY_ATTRIBUTES\.(?:dairy|cheese)/);
  });
});
