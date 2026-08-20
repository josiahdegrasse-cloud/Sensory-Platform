import { describe, expect, it } from 'vitest';
import {
  COVER_QA_FIELDS,
  coverQaFailures,
  coverQaReady,
  normalizeCoverQaScore,
} from './concept-cover-governance';

describe('concept report-cover governance', () => {
  it('requires every fidelity score to reach four', () => {
    const scores = Object.fromEntries(COVER_QA_FIELDS.map(field => [field.key, 4]));
    expect(coverQaReady(scores)).toBe(true);
    expect(coverQaFailures({ ...scores, surfaceTexture: 3 })).toEqual(['surfaceTexture']);
  });

  it('treats missing and invalid scores as failing', () => {
    expect(coverQaReady({})).toBe(false);
    expect(normalizeCoverQaScore('not-a-score')).toBe(1);
    expect(normalizeCoverQaScore(8)).toBe(5);
  });
});
