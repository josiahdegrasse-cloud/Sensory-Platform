import { describe, expect, it } from 'vitest';
import { buildDecisionReportHtml } from './decision-report';

describe('decision report', () => {
  it('escapes buyer-facing content', () => {
    const html = buildDecisionReportHtml({
      foodType: 'Meat & alternatives',
      generatedAt: new Date('2026-06-06T12:00:00Z'),
      decisions: [{
        sampleId: 'M1',
        sampleName: '<Burger>',
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
        prescriptions: [],
        decisionFingerprint: '12345678',
        methodVersion: 'test',
      }],
    });

    expect(html).toContain('Meat &amp; alternatives');
    expect(html).toContain('&lt;Burger&gt;');
    expect(html).not.toContain('<Burger>');
  });
});
