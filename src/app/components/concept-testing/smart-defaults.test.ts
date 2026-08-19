import { describe, expect, it } from 'vitest';
import {
  buildTailoredConceptQuestions,
  defaultConceptPanelistIds,
  preferredConceptImageIndex,
  publicConceptName,
} from './smart-defaults';
import type { ConceptDraft } from './types';
import { EMPTY_VARIANT_DIMENSIONS } from './types';
import { AI_QUESTION_TEMPLATES } from './questions-data';

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
  brandReference: null,
};

describe('concept workflow smart defaults', () => {
  it('builds a balanced, reviewable survey from a seeded concept', () => {
    const questions = buildTailoredConceptQuestions(draft);

    expect(questions.length).toBe(13);
    expect(questions.some(question => question.text.includes('Everyday Melt'))).toBe(true);
    expect(questions.some(question => /claim|claimed|pack claim|benefits and claims/i.test(question.text))).toBe(false);
    expect(questions.some(question => question.category === 'purchase')).toBe(true);
    expect(questions.some(question => question.category === 'attributes')).toBe(true);
    expect(questions.every(question => question.text.trim().length > 0)).toBe(true);
  });

  it('rates each selected visual before asking panelists to choose a winner', () => {
    const questions = buildTailoredConceptQuestions(draft);
    const visualRatings = questions.filter(question => question.imageIndex !== undefined);
    const winnerIndex = questions.findIndex(question => question.type === 'image_choice');

    expect(visualRatings).toHaveLength(2);
    expect(visualRatings.map(question => question.imageIndex)).toEqual([0, 1]);
    expect(visualRatings.every(question => question.type === 'scale' && question.required)).toBe(true);
    expect(winnerIndex).toBeGreaterThan(questions.findIndex(question => question.id === visualRatings[1].id));
  });

  it('uses food-aware cues and occasions without generic demographics or duplicate purchase questions', () => {
    const questions = buildTailoredConceptQuestions(draft);
    const cues = questions.find(question => question.id === 'q_tailored_visual_cues');
    const usage = questions.find(question => question.id === 'q_tailored_usage_1');

    expect(cues?.options).toEqual(expect.arrayContaining(['Creamy', 'Cheesy', 'None of these']));
    expect(usage?.options).toEqual(expect.arrayContaining(['Sandwiches or wraps', 'Cooking or melting']));
    expect(questions.filter(question => question.category === 'demographics')).toHaveLength(0);
    expect(questions.filter(question => question.id.startsWith('q_tailored_purchase_'))).toHaveLength(1);
  });

  it('only asks about price when both a concrete price and pack description are available', () => {
    const priced = buildTailoredConceptQuestions(draft);
    const unpriced = buildTailoredConceptQuestions({ ...draft, packageFormat: '', variantDimensions: { ...EMPTY_VARIANT_DIMENSIONS } });

    expect(priced.find(question => question.category === 'price')?.text).toContain('$5.99');
    expect(priced.find(question => question.category === 'price')?.text).toContain('Resealable 7 oz pouch');
    expect(unpriced.some(question => question.category === 'price')).toBe(false);
  });

  it('keeps fallback templates clear of claim-specific wording', () => {
    expect(AI_QUESTION_TEMPLATES.some(question => /claim|claimed|pack claim/i.test(question.text))).toBe(false);
  });

  it('normalizes the public concept name from the editable concept draft', () => {
    expect(publicConceptName({ name: '  Golden Slice Pack  ' })).toBe('Golden Slice Pack');
    expect(publicConceptName({ name: '' })).toBe('this product');
  });

  it('uses the current concept page name in generated survey copy', () => {
    const questions = buildTailoredConceptQuestions({
      ...draft,
      name: 'Golden Slice Pack',
    });

    expect(questions.some(question => question.text.includes('Golden Slice Pack'))).toBe(true);
    expect(questions.some(question => question.text.includes('Everyday Melt'))).toBe(false);
  });

  it('requires the image-choice question only when multiple selected visuals exist', () => {
    const twoImageQuestions = buildTailoredConceptQuestions(draft);
    const oneImageQuestions = buildTailoredConceptQuestions({
      ...draft,
      marketingImages: ['https://example.com/front.png'],
    });

    expect(twoImageQuestions.find(question => question.type === 'image_choice')).toMatchObject({ required: true });
    expect(oneImageQuestions.find(question => question.type === 'image_choice')?.required ?? false).toBe(false);
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
