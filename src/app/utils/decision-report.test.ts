import { describe, expect, it } from 'vitest';
import { buildDecisionReportRows } from './decision-report';

describe('decision report', () => {
  it('builds complete buyer-facing formulation rows', () => {
    const rows = buildDecisionReportRows([{
        sampleId: 'M1',
        sampleName: 'Burger',
        decision: 'TWEAK',
        issfScore: 68,
        confidenceScore: 82,
        recommendation: 'Adjust salt & aroma.',
        costSavings: 1,
        timeline: '1 week',
        riskLevel: 'medium',
        details: [],
        dimensionScores: { hedonic: 60, texture: 60, cata: 60, emotional: 60 },
        gates: [],
        prescriptions: [{ priority: 1, target: 'Salt balance', action: 'Reduce salt', expectedLift: 4 }],
        decisionFingerprint: '12345678',
        methodVersion: 'test',
      }]);

    expect(rows[0]).toMatchObject({
      sample: 'Burger',
      decision: 'TWEAK',
      issf: 68,
      confidence: 82,
      nextActions: 'Reduce salt',
      fingerprint: '12345678',
    });
  });
});
