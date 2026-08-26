import { describe, expect, it } from 'vitest';
import type { QuestionnaireResponse } from '../data/survey-domain';
import { aggregateLiveQuestionnaireResponses, selectPrimaryQuestionnaireResponses } from './use-survey-data';

function response(id: string, overrides: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse {
  return {
    id,
    userId: `panelist-${id}`,
    productId: 'product-1',
    timestamp: '2026-08-24T12:00:00.000Z',
    runNumber: 1,
    cataAttributes: [],
    intensityRatings: {},
    hedonicScores: {},
    emotionalProfile: {},
    ...overrides,
  };
}

describe('live survey aggregation', () => {
  it('uses one primary response per participant and product for the analysis set', () => {
    const first = response('first', { userId: 'panelist-a', runNumber: 1, hedonicScores: { overall: 8 } });
    const repeat = response('repeat', { userId: 'panelist-a', runNumber: 2, hedonicScores: { overall: 2 } });
    const other = response('other', { userId: 'panelist-b', runNumber: 1, hedonicScores: { overall: 6 } });

    expect(selectPrimaryQuestionnaireResponses([repeat, other, first]).map(item => item.id).sort()).toEqual(['first', 'other']);
  });

  it('excludes missing hedonic answers instead of converting them to zero', () => {
    const result = aggregateLiveQuestionnaireResponses([
      response('a', { hedonicScores: { overall: 8, appearance: 7 } }),
      response('b', { hedonicScores: { appearance: 5 } }),
      response('c'),
    ]);

    expect(result.n).toBe(3);
    expect(result.hedonic.overall).toBe(8);
    expect(result.hedonicN?.overall).toBe(1);
    expect(result.hedonic.appearance).toBe(6);
    expect(result.hedonicN?.appearance).toBe(2);
    expect(result.hedonic.flavor).toBeUndefined();
  });

  it('uses sample SD and records endpoint-specific intensity counts', () => {
    const result = aggregateLiveQuestionnaireResponses([
      response('a', { intensityRatings: { Creamy: 4 }, hedonicScores: { overall: 6 } }),
      response('b', { intensityRatings: { Creamy: 8 }, hedonicScores: { overall: 8 } }),
      response('c'),
    ]);

    expect(result.intensity.Creamy).toBe(6);
    expect(result.intensityN?.Creamy).toBe(2);
    expect(result.hedonicSD.overall).toBeCloseTo(Math.SQRT2);
  });
});
