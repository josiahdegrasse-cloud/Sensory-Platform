import { describe, expect, it } from 'vitest';
import {
  canShowInferentialStatistics,
  deriveInsightsEvidenceStrength,
  deriveInsightsNextAction,
  filterProjectConceptTests,
  filterProjectInstrumentSamples,
} from './insights';

describe('Insights evidence', () => {
  it('treats one live response as directional and limited', () => {
    const result = deriveInsightsEvidenceStrength({
      liveResponseCount: 1,
      minimumResponses: 12,
      datasetsPresent: 3,
    });
    expect(result.level).toBe('Limited');
    expect(result.representative).toBe(false);
    expect(result.note).toContain('one response');
  });

  it('never promotes reference-only evidence', () => {
    const result = deriveInsightsEvidenceStrength({
      liveResponseCount: 14,
      minimumResponses: 12,
      datasetsPresent: 3,
      usesReferenceData: true,
    });
    expect(result.level).toBe('Insufficient');
    expect(result.representative).toBe(false);
  });

  it('requires complete supporting evidence for a strong rating', () => {
    expect(deriveInsightsEvidenceStrength({
      liveResponseCount: 12,
      minimumResponses: 12,
      datasetsPresent: 2,
    }).level).toBe('Moderate');
    expect(deriveInsightsEvidenceStrength({
      liveResponseCount: 12,
      minimumResponses: 12,
      datasetsPresent: 3,
    }).level).toBe('Strong');
  });

  it('suppresses inferential statistics for small or reference samples', () => {
    expect(canShowInferentialStatistics(1, false)).toBe(false);
    expect(canShowInferentialStatistics(14, true)).toBe(false);
    expect(canShowInferentialStatistics(12, false)).toBe(true);
  });
});

describe('Insights project scoping', () => {
  it('filters instrument samples to the active import batch', () => {
    const samples = [
      { sampleId: 'A', type: 'cheese', importBatchId: 'batch-a', sourness: 1, bitterness: 1, saltiness: 1, umami: 1, sweetness: 1 },
      { sampleId: 'B', type: 'cheese', importBatchId: 'batch-b', sourness: 1, bitterness: 1, saltiness: 1, umami: 1, sweetness: 1 },
    ];
    expect(filterProjectInstrumentSamples(samples, 'cheese', 'batch-a').map(sample => sample.sampleId)).toEqual(['A']);
  });

  it('does not borrow concepts from another named project', () => {
    const tests = [
      { id: 'a', projectName: 'Project A', foodTypeSlug: 'cheese', status: 'active' },
      { id: 'b', projectName: 'Project B', foodTypeSlug: 'cheese', status: 'active' },
    ] as Parameters<typeof filterProjectConceptTests>[0];
    expect(filterProjectConceptTests(tests, {
      foodType: 'cheese',
      importBatchId: 'batch-a',
      projectName: 'Project A.csv',
    }).map(test => test.id)).toEqual(['a']);
  });

  it('uses canonical project identity before same-food-type or legacy folder matches', () => {
    const tests = [
      { id: 'cashew-cheddar', projectId: 'cashew-project', projectName: 'Reference concepts', foodTypeSlug: 'cheese', status: 'active' },
      { id: 'cashew-cream-cheese', projectId: 'cashew-project', projectName: 'Mozza Ref', foodTypeSlug: 'cheese', status: 'active' },
      { id: 'mozza-reference', projectId: 'mozza-project', projectName: 'Mozza Ref', foodTypeSlug: 'cheese', status: 'active' },
      { id: 'legacy-projectless', projectId: null, projectName: 'Mozza Ref', foodTypeSlug: 'cheese', status: 'active' },
    ] as Parameters<typeof filterProjectConceptTests>[0];

    expect(filterProjectConceptTests(tests, {
      foodType: 'cheese',
      importBatchId: 'mozza-batch',
      projectId: 'mozza-project',
      projectName: 'Mozza Ref',
    }).map(test => test.id)).toEqual(['mozza-reference']);
  });
});

describe('Insights next action', () => {
  const fallback = { label: 'Fallback', description: '', path: '/', tone: 'neutral' as const };

  it('routes weak evidence back to response collection', () => {
    expect(deriveInsightsNextAction({
      fallback,
      hasInstrumentData: true,
      productCount: 1,
      liveResponseCount: 1,
      minimumResponses: 12,
      decision: null,
      conceptCount: 0,
      conceptResponseCount: 0,
      reportStatus: 'not-ready',
    }).label).toBe('Collect more responses');
  });

  it('routes sufficient evidence to decision review', () => {
    expect(deriveInsightsNextAction({
      fallback,
      hasInstrumentData: true,
      productCount: 1,
      liveResponseCount: 12,
      minimumResponses: 12,
      decision: null,
      conceptCount: 0,
      conceptResponseCount: 0,
      reportStatus: 'not-ready',
    }).path).toBe('/decision');
  });
});
