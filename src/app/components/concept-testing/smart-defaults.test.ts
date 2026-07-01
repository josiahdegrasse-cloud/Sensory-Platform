import { describe, expect, it } from 'vitest';
import {
  buildTailoredConceptQuestions,
  defaultConceptPanelistIds,
  preferredConceptImageIndex,
} from './smart-defaults';
import type { ConceptDraft } from './types';
import { EMPTY_VARIANT_DIMENSIONS } from './types';

const draft: ConceptDraft = {
  name: 'Everyday Melt',
  category: 'Plant-based cheese',
  projectName: 'Coconut Cheddar',
  description: 'A familiar cheddar alternative for everyday meals.',
  marketingImages: ['https://example.com/front.png', 'https://example.com/use.png'],
  marketingImageIds: ['image-1', 'image-2'],
  marketingImageReviews: [
    { imageId: 'image-1', status: 'approved', qa: {}, notes: '', source: 'ai' },
    { imageId: 'image-2', status: 'selected', qa: {}, notes: '', source: 'ai' },
  ],
  targetMarket: 'Flexitarian households',
  targetOccasion: 'Weeknight meals',
  productAppearance: 'Pale cheddar-orange slices with a realistic melt.',
  packageFormat: 'Resealable 7 oz pouch with a clear window.',
  visualSetting: 'Bright modern kitchen in natural daylight.',
  colorDirection: 'Sage green with matte paper textures.',
  mustShow: 'Melted serving suggestion, plant-based cue',
  pricePoint: '$5.99',
  keyBenefits: 'Familiar flavor, dependable melt',
  technicalChallenges: '',
  promptStyle: 'balanced',
  visualNotes: '',
  forbiddenClaims: '',
  approvalStatus: 'draft',
  variantDimensions: { ...EMPTY_VARIANT_DIMENSIONS },
};

describe('concept workflow smart defaults', () => {
  it('builds a balanced, reviewable survey from a seeded concept', () => {
    const questions = buildTailoredConceptQuestions(draft);

    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(questions.some(question => question.text.includes('Everyday Melt'))).toBe(true);
    expect(questions.some(question => question.category === 'purchase')).toBe(true);
    expect(questions.some(question => question.category === 'attributes')).toBe(true);
    expect(questions.every(question => question.text.trim().length > 0)).toBe(true);
  });

  it('assigns only active panelists by default', () => {
    expect(defaultConceptPanelistIds([
      { id: 'active', status: 'active' },
      { id: 'inactive', status: 'inactive' },
      { id: 'legacy-without-status' },
    ])).toEqual(['active', 'legacy-without-status']);
  });

  it('prefers approved packaging, then selected packaging, then the first image', () => {
    expect(preferredConceptImageIndex([
      { reviewStatus: 'draft' },
      { reviewStatus: 'approved' },
      { reviewStatus: 'selected' },
    ], 3)).toBe(1);
    expect(preferredConceptImageIndex([
      { reviewStatus: 'draft' },
      { reviewStatus: 'selected' },
    ], 2)).toBe(1);
    expect(preferredConceptImageIndex(undefined, 2)).toBe(0);
  });
});
