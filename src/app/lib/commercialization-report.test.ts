import { describe, expect, it } from 'vitest';
import {
  formatDecisionDimension,
  getDecisionQualifier,
  getEvidenceStrength,
  getEvidenceStrengthNote,
  resolveReportLogoUrl,
  summarizeConceptResponses,
} from './commercialization-report';

const dims = { hedonic: 84, texture: 43, cata: 99, emotional: 86 } as const;

describe('commercialization report evidence', () => {
  it('summarizes scale, selection, purchase, and comment answers', () => {
    const questions = [
      { id: 'appeal', text: 'Overall appeal', type: 'scale', required: true, category: 'appeal' },
      { id: 'purchase', text: 'Purchase intent', type: 'scale', required: true, category: 'purchase' },
      { id: 'attrs', text: 'Select all', type: 'multiple_choice', required: true, category: 'attributes' },
      { id: 'comment', text: 'Why?', type: 'open_text', required: false, category: 'appeal' },
    ] as const;
    const responses = [
      { id: '1', userId: 'u1', conceptTestId: 'c1', createdAt: '', answers: { appeal: 8, purchase: 7, attrs: ['Premium', 'Fresh'], comment: 'Looks credible' } },
      { id: '2', userId: 'u2', conceptTestId: 'c1', createdAt: '', answers: { appeal: 6, purchase: 5, attrs: ['Premium'], comment: 'Clear flavor cue' } },
    ];
    const result = summarizeConceptResponses([...questions], responses);
    expect(result.responseCount).toBe(2);
    expect(result.scaleMetrics[0].average).toBe(7);
    expect(result.topSelections[0]).toMatchObject({ option: 'Premium', count: 2, percentage: 100 });
    expect(result.purchaseIntent).toBe(6);
    expect(result.comments).toHaveLength(2);
  });

  it('treats a one-person concept panel as limited evidence', () => {
    expect(getEvidenceStrength(1)).toBe('Limited');
    expect(getEvidenceStrengthNote(1)).toContain('only 1 panelist response');
    expect(getEvidenceStrengthNote(1)).toContain('directional, not representative');
  });

  it('uses client-facing labels for decision dimensions', () => {
    // cata is the trained-panel CATA descriptor profile — deliberately not
    // "panelist-selected descriptors", which collided with concept-test descriptors.
    expect(formatDecisionDimension('cata')).toBe('Sensory descriptor profile');
    expect(formatDecisionDimension('emotional')).toBe('Positive emotional response indicators');
  });

  it('flags a GO as conditional when a dimension is weak or concept evidence is absent', () => {
    const weakAndNoConcept = getDecisionQualifier({
      decision: { dimensions: dims } as never,
      evidence: { responseCount: 0 } as never,
    });
    expect(weakAndNoConcept.conditional).toBe(true);
    expect(weakAndNoConcept.caveats).toHaveLength(2);
    expect(weakAndNoConcept.caveatLine).toContain('Texture performance');
    expect(weakAndNoConcept.caveatLine).toContain('n=0');

    const clean = getDecisionQualifier({
      decision: { dimensions: { hedonic: 84, texture: 72, cata: 99, emotional: 86 } } as never,
      evidence: { responseCount: 40 } as never,
    });
    expect(clean.conditional).toBe(false);
    expect(clean.caveatLine).toBe('');
  });

  it('uses the NFI logo only as the default for the NFI workspace', () => {
    expect(resolveReportLogoUrl('New Food Innovation')).toBe('/new_foodinnovation_ltd_logo.jpg');
    expect(resolveReportLogoUrl('Client Foods')).toBeNull();
    expect(resolveReportLogoUrl('Client Foods', 'https://example.com/logo.png'))
      .toBe('https://example.com/logo.png');
  });
});
