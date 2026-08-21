import { describe, expect, it } from 'vitest';
import {
  buildPanelDemographicSummary,
  formatDecisionDimension,
  getDecisionQualifier,
  getEvidenceStrength,
  getEvidenceStrengthNote,
  rebuildDecisionForCommercialization,
  refreshCommercializationSnapshotImageUrls,
  resolveReportLogoUrl,
  summarizeConceptResponses,
} from './commercialization-report';

const dims = { hedonic: 84, texture: 43, cata: 99, emotional: 86 } as const;

describe('commercialization report evidence', () => {
  it('persists only aggregate respondent demographics and suppresses cells below n=3', () => {
    const responses = ['u1', 'u2', 'u3', 'u4'].map((userId, index) => ({
      id: `r${index + 1}`, userId, conceptTestId: 'c1', createdAt: '', answers: {},
    }));
    const panelists = [
      { id: 'u1', ageBand: '25-34', gender: 'woman', region: 'London', ethnicity: 'white_british', dietaryPattern: 'flexitarian', groceryRole: 'main_shopper', categoryUsageFrequency: 'weekly', householdSize: 2 },
      { id: 'u2', ageBand: '25-34', gender: 'woman', region: 'London', ethnicity: 'white_british', dietaryPattern: 'flexitarian', groceryRole: 'main_shopper', categoryUsageFrequency: 'weekly', householdSize: 2 },
      { id: 'u3', ageBand: '25-34', gender: 'woman', region: 'London', ethnicity: 'white_british', dietaryPattern: 'flexitarian', groceryRole: 'main_shopper', categoryUsageFrequency: 'weekly', householdSize: 2 },
      { id: 'u4', ageBand: '45-54', gender: 'man', region: 'North West', ethnicity: 'asian_indian', dietaryPattern: 'vegan', groceryRole: 'shared_shopper', categoryUsageFrequency: 'monthly', householdSize: 1 },
    ] as never;

    const summary = buildPanelDemographicSummary(responses, panelists);

    expect(summary.matchedProfileCount).toBe(4);
    expect(summary.dimensions.find(item => item.key === 'gender')?.groups).toEqual([
      expect.objectContaining({ label: 'Female', count: 3 }),
    ]);
    expect(summary.dimensions.find(item => item.key === 'gender')?.suppressedCount).toBe(1);
    expect(JSON.stringify(summary)).not.toContain('u1');
  });

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

  it('keeps concept-image preference separate from descriptor selections', () => {
    const questions = [
      { id: 'image', text: 'Pick a visual', type: 'image_choice' as const, required: true, category: 'appeal' },
      { id: 'message', text: 'Pick a message', type: 'multiple_choice' as const, options: ['Creamy', 'Bold'], required: true, category: 'appeal' },
    ];
    const responses = [
      { id: '1', userId: 'u1', conceptTestId: 'c1', createdAt: '', answers: { image: 'image-a', message: 'Creamy' } },
      { id: '2', userId: 'u2', conceptTestId: 'c1', createdAt: '', answers: { image: 'image-a', message: 'Creamy' } },
      { id: '3', userId: 'u3', conceptTestId: 'c1', createdAt: '', answers: { image: 'image-b', message: 'Bold' } },
    ];
    const result = summarizeConceptResponses([...questions], responses, {
      imageUrls: ['image-a', 'image-b'],
      provenance: 'synthetic',
    });

    expect(result.provenance).toBe('synthetic');
    expect(result.imagePreferences?.[0]).toMatchObject({ imageUrl: 'image-a', optionIndex: 0, count: 2 });
    expect(result.topSelections.map(item => item.option)).toEqual(['Creamy', 'Bold']);
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

  it('treats synthetic concept responses as test data regardless of response count', () => {
    expect(getEvidenceStrength(36, 'synthetic')).toBe('Limited');
    expect(getEvidenceStrengthNote(36, 'synthetic')).toContain('must not be interpreted as panel');
    const qualifier = getDecisionQualifier({
      decision: { dimensions: { hedonic: 84, texture: 72, cata: 99, emotional: 86 } } as never,
      evidence: { responseCount: 36, provenance: 'synthetic' } as never,
    });
    expect(qualifier.conditional).toBe(true);
    expect(qualifier.caveatLine).toContain('synthetic test data');
  });

  it('uses the NFI logo only as the default for the NFI workspace', () => {
    expect(resolveReportLogoUrl('New Food Innovation')).toBe('/new_foodinnovation_ltd_logo.jpg');
    expect(resolveReportLogoUrl('Client Foods')).toBeNull();
    expect(resolveReportLogoUrl('Client Foods', 'https://example.com/logo.png'))
      .toBe('https://example.com/logo.png');
  });

  it('refreshes expiring report image URLs from immutable stored ids', () => {
    const snapshot = {
      concept: {
        packagingImageUrl: 'https://signed.example/stale-pack',
        reportCoverImageUrl: 'https://signed.example/stale-cover',
      },
    } as never;
    const refreshed = refreshCommercializationSnapshotImageUrls(
      snapshot,
      { packagingImageId: 'pack-1', coverImageId: 'cover-1' },
      {
        imageIds: ['pack-1'],
        imageUrls: ['https://signed.example/fresh-pack'],
        reportCoverImageId: 'cover-1',
        reportCoverImageUrl: 'https://signed.example/fresh-cover',
      },
    );

    expect(refreshed.concept.packagingImageUrl).toContain('fresh-pack');
    expect(refreshed.concept.reportCoverImageUrl).toContain('fresh-cover');
  });

  it('rebuilds report decision detail from the confirmed record and current evidence', () => {
    const decision = rebuildDecisionForCommercialization({
      id: 'decision-1',
      timestamp: '2026-07-11T12:00:00.000Z',
      sampleId: 'sample-1',
      sampleName: 'Cashew Cream Cheese v2.0',
      decision: 'GO',
      issfScore: 78.7,
      confidence: 82,
      user: 'Reviewer',
      note: '',
      methodVersion: 'NFI-GST-2.0',
      decisionFingerprint: 'ABC123',
    }, {
      sampleSummaries: [{ sampleId: 'sample-1', riskLevel: 'medium' }],
      categoryResults: [
        { sampleId: 'sample-1', category: 'hedonic', score: 81 },
        { sampleId: 'sample-1', category: 'texture', score: 72 },
        { sampleId: 'sample-1', category: 'cata', score: 84 },
        { sampleId: 'sample-1', category: 'emotional', score: 76 },
      ],
      criticalAttributeResults: [{
        sampleId: 'sample-1', id: 'texture', label: 'Texture stability',
        status: 'watch', detail: 'Confirm stability at scale.', impact: -4,
      }],
      decisionReasons: ['Sensory evidence supports controlled advancement.'],
    } as never);

    expect(decision).toMatchObject({
      decision: 'GO',
      dimensionScores: { hedonic: 81, texture: 72, cata: 84, emotional: 76 },
      riskLevel: 'medium',
      decisionFingerprint: 'ABC123',
    });
    expect(decision?.prescriptions[0]).toMatchObject({ target: 'Texture stability', expectedLift: 4 });
    expect(decision?.recommendation).toContain('controlled advancement');
  });
});
