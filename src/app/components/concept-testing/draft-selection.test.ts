import { describe, expect, it } from 'vitest';
import { chooseNewestConceptDraft, conceptDraftMatchesLineage } from './draft-selection';

const draft = (savedAt: string, id = 'decision-1', evidenceBundleId = 'evidence-1') => ({
  draft: { name: 'Saved concept' },
  sourceDecision: { id, evidenceBundleId },
  savedAt,
});

describe('concept draft restoration', () => {
  it('accepts a saved draft for the requested decision', () => {
    expect(conceptDraftMatchesLineage(draft('2026-08-13T10:00:00Z'), {
      id: 'decision-1',
      evidenceBundleId: 'evidence-1',
    })).toBe(true);
  });

  it('rejects a draft from another decision and evidence bundle', () => {
    expect(conceptDraftMatchesLineage(draft('2026-08-13T10:00:00Z'), {
      id: 'decision-2',
      evidenceBundleId: 'evidence-2',
    })).toBe(false);
  });

  it('restores the newer browser edit over an older workspace copy', () => {
    const browser = draft('2026-08-13T10:02:00Z');
    const workspace = draft('2026-08-13T10:01:00Z');
    expect(chooseNewestConceptDraft({ browser, workspace })).toBe(browser);
  });

  it('uses the durable workspace draft when it is newest', () => {
    const browser = draft('2026-08-13T10:01:00Z');
    const workspace = draft('2026-08-13T10:02:00Z');
    expect(chooseNewestConceptDraft({ browser, workspace })).toBe(workspace);
  });
});
