import { describe, expect, it } from 'vitest';
import type { ConceptDraft, Question } from './types';
import { getConceptReadiness } from './concept-readiness';

const draft: ConceptDraft = {
  name: 'Concept',
  category: 'Snack',
  projectName: 'Project 1',
  description: 'A clear consumer concept.',
  marketingImages: ['https://example.com/concept.png'],
  marketingImageIds: ['image-1'],
  targetMarket: '',
  targetOccasion: '',
  pricePoint: '',
  keyBenefits: '',
  technicalChallenges: '',
  promptStyle: 'balanced',
  visualNotes: '',
  forbiddenClaims: '',
  approvalStatus: 'draft',
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
    const readiness = getConceptReadiness({ draft, questions, assignedPanelistIds: [] });
    expect(readiness.find(item => item.id === 'panelists')).toMatchObject({
      ready: false,
      fixStep: 'survey',
    });
  });

  it('reports each missing launch requirement with a repair step', () => {
    const readiness = getConceptReadiness({
      draft: { ...draft, projectName: '', marketingImages: [] },
      questions: [],
      assignedPanelistIds: [],
    });

    expect(readiness.filter(item => !item.ready).map(item => item.id)).toEqual([
      'project',
      'visuals',
      'questions',
      'panelists',
    ]);
    expect(readiness.every(item => item.detail.length > 0)).toBe(true);
  });
});
