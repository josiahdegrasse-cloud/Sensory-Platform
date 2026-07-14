import { describe, expect, it } from 'vitest';
import { buildDecisionSummary, formatDecisionNote } from './decision-summary';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';

const decision: GoStopTweakDecision = {
  sampleId: 'sample-a',
  sampleName: 'Sample A',
  issfScore: 68,
  confidenceScore: 82,
  decision: 'TWEAK',
  recommendation: 'Adjust texture before advancing.',
  riskLevel: 'medium',
  details: ['Texture liking is below target.', 'Overall liking is close to target.'],
  dimensionScores: { hedonic: 70, texture: 55, cata: 72, emotional: 68 },
  gates: [{ id: 'texture', label: 'Texture', status: 'watch', detail: 'Texture needs review.', impact: -5 }],
  prescriptions: [{ priority: 1, target: 'Texture', action: 'Reduce firmness.', expectedLift: 5 }],
  decisionFingerprint: 'abc',
  methodVersion: '1',
};

describe('decision summary', () => {
  it('keeps the explanation concise and action oriented', () => {
    const summary = buildDecisionSummary(decision);
    expect(summary.outcome).toBe('TWEAK');
    expect(summary.confidence).toBe('Moderate');
    expect(summary.reasons).toHaveLength(3);
    expect(summary.nextStep).toContain('adjustment plan');
  });

  it('treats review-range evidence as moderate confidence instead of low confidence', () => {
    const summary = buildDecisionSummary({ ...decision, confidenceScore: 67 });
    expect(summary.confidence).toBe('Moderate');
  });

  it('formats a structured tweak plan without schema changes', () => {
    expect(formatDecisionNote({
      outcome: 'TWEAK',
      issue: 'Texture is too firm',
      adjustment: 'Reduce cook time',
      retest: true,
      note: 'Pilot batch B',
    })).toBe('Issue: Texture is too firm\nAdjustment: Reduce cook time\nRetest: Required\nAdmin note: Pilot batch B');
  });
});
