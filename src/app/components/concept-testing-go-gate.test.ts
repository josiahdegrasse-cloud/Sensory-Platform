import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./concept-testing.tsx', import.meta.url)),
  'utf8',
);

describe('Concept Lab GO gate', () => {
  it('does not expose an unlinked concept-work path', () => {
    expect(source).not.toContain('Start without decision');
    expect(source).not.toContain('startFromScratch');
    expect(source).toContain(
      'Boolean(sourceDecision?.id && sourceDecision.evidenceBundleId)',
    );
  });

  it('rejects route seeds and restored drafts without linked GO evidence', () => {
    expect(source).toContain(
      'if (!seed.sourceDecision?.id || !seed.sourceDecision.evidenceBundleId)',
    );
    expect(source).toContain(
      'saved.sourceDecision?.id && saved.sourceDecision.evidenceBundleId',
    );
  });
});
