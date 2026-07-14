import { describe, expect, it } from 'vitest';
import { canConfirmDecisionOutcome, decisionRecordMatchesEvidence } from './decision-governance';

describe('decision governance', () => {
  it('allows the calculated outcome or a more conservative confirmation', () => {
    expect(canConfirmDecisionOutcome('GO', 'GO')).toBe(true);
    expect(canConfirmDecisionOutcome('GO', 'TWEAK')).toBe(true);
    expect(canConfirmDecisionOutcome('TWEAK', 'STOP')).toBe(true);
  });

  it('never allows human review to promote TWEAK or STOP to GO', () => {
    expect(canConfirmDecisionOutcome('TWEAK', 'GO')).toBe(false);
    expect(canConfirmDecisionOutcome('STOP', 'GO')).toBe(false);
    expect(canConfirmDecisionOutcome('STOP', 'TWEAK')).toBe(false);
  });

  it('requires the same project for live evidence and keeps unscoped demo records isolated', () => {
    const record = { sampleId: 'S1', decisionFingerprint: 'ABC', projectId: 'project-a' };
    expect(decisionRecordMatchesEvidence(record, {
      sampleId: 'S1', decisionFingerprint: 'ABC', projectId: 'project-a',
    })).toBe(true);
    expect(decisionRecordMatchesEvidence(record, {
      sampleId: 'S1', decisionFingerprint: 'ABC', projectId: 'project-b',
    })).toBe(false);
    expect(decisionRecordMatchesEvidence(record, {
      sampleId: 'S1', decisionFingerprint: 'ABC', projectId: null,
    })).toBe(false);
    expect(decisionRecordMatchesEvidence(
      { sampleId: 'S1', decisionFingerprint: 'ABC', projectId: null },
      { sampleId: 'S1', decisionFingerprint: 'ABC', projectId: null },
    )).toBe(true);
  });
});
