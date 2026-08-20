import { describe, expect, it } from 'vitest';
import {
  COVER_QA_FIELDS,
  canGenerateFoodMaster,
  coverQaFailures,
  coverQaReady,
  foodMasterBriefReady,
  foodMasterSourceLabel,
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

  it('allows a food master to be generated from the written brief alone', () => {
    const brief = {
      name: 'Cultured cashew mozzarella',
      category: 'Plant-based cheese',
      productAppearance: 'Pale ivory ball with a moist, smooth surface and soft cut face.',
    };

    expect(foodMasterBriefReady(brief)).toBe(true);
    expect(canGenerateFoodMaster({ ...brief, busy: false })).toBe(true);
    expect(canGenerateFoodMaster({ ...brief, busy: true })).toBe(false);
  });

  it('still requires the food identity and appearance fields', () => {
    expect(foodMasterBriefReady({
      name: 'Cultured cashew mozzarella',
      category: 'Plant-based cheese',
      productAppearance: '   ',
    })).toBe(false);
  });

  it('makes generated-versus-photographic food-master provenance explicit', () => {
    expect(foodMasterSourceLabel('uploaded_reference')).toBe('Uploaded food photo locked');
    expect(foodMasterSourceLabel('text_generated')).toBe('AI food master locked');
    expect(foodMasterSourceLabel('reference_generated')).toBe('Photo-referenced AI master locked');
  });
});
