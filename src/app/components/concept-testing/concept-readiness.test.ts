import { describe, expect, it } from 'vitest';
import type { ConceptDraft, Question } from './types';
import { EMPTY_VARIANT_DIMENSIONS } from './types';
import { getConceptReadiness } from './concept-readiness';

const draft: ConceptDraft = {
  name: 'Concept',
  category: 'Snack',
  projectName: 'Project 1',
  description: 'A clear consumer concept.',
  marketingImages: ['https://example.com/concept.png'],
  marketingImageIds: ['image-1'],
  targetMarket: 'Everyday snack buyers',
  targetOccasion: '',
  productAppearance: 'Golden baked squares with visible seasoning.',
  packageFormat: 'Resealable stand-up pouch.',
  visualSetting: '',
  colorDirection: '',
  mustShow: '',
  pricePoint: '',
  keyBenefits: '',
  technicalChallenges: '',
  promptStyle: 'balanced',
  visualNotes: '',
  forbiddenClaims: '',
  approvalStatus: 'draft',
  variantDimensions: { ...EMPTY_VARIANT_DIMENSIONS },
};

const questions: Question[] = [{
  id: 'q1',
  text: 'How appealing is this concept?',
  type: 'scale',
  required: true,
  category: 'appeal',
}];

describe('getConceptReadiness', () => {
  it('requires explicit panelist assignments', () => {
    const { items } = getConceptReadiness({ draft, questions, assignedPanelistIds: [] });
    expect(items.find(item => item.id === 'panelists')).toMatchObject({
      ready: false,
      fixStep: 'survey',
    });
  });

  it('reports each missing launch requirement with a repair step', () => {
    const { items } = getConceptReadiness({
      draft: { ...draft, projectName: '', marketingImages: [] },
      questions: [],
      assignedPanelistIds: [],
    });

    expect(items.filter(item => !item.ready).map(item => item.id)).toEqual([
      'project',
      'visuals',
      'questions',
      'panelists',
    ]);
    expect(items.every(item => item.detail.length > 0)).toBe(true);
  });

  it('requires the minimum image brief before leaving the concept step', () => {
    const { items } = getConceptReadiness({
      draft: {
        ...draft,
        targetMarket: '',
        productAppearance: '',
        packageFormat: '',
      },
      questions,
      assignedPanelistIds: ['panelist-1'],
    });

    expect(items.find(item => item.id === 'brief')).toMatchObject({
      ready: false,
      fixStep: 'concept',
    });
    expect(items.find(item => item.id === 'brief')?.detail).toContain('product appearance');
    expect(items.find(item => item.id === 'brief')?.detail).toContain('package format');
    expect(items.find(item => item.id === 'brief')?.detail).toContain('target customer');
  });

  it('returns a study quality score', () => {
    const { studyQuality } = getConceptReadiness({
      draft,
      questions,
      assignedPanelistIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'],
    });
    expect(studyQuality.overall).toBeGreaterThan(0);
    expect(studyQuality.overall).toBeLessThanOrEqual(100);
    expect(studyQuality.panelAdequacy).toBeGreaterThan(0);
  });
});
