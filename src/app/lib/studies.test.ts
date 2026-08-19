import { describe, expect, it } from 'vitest';
import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import type { ConceptTest } from './database';
import {
  adaptConceptToStudySummary,
  adaptProductToStudySummary,
  buildStudySummaries,
  validateConceptStudy,
  validateMultiSampleStudy,
  validateProductStudy,
} from './studies';

const baseProduct: Product = {
  id: 'prod-1',
  name: 'Coconut Cheddar',
  category: 'Cheese',
  createdDate: '2026-06-01T00:00:00Z',
  status: 'active',
  customAttributes: ['Creamy', 'Salty'],
  assignedPanelistIds: [],
  sourceImportBatchId: 'batch-1',
  sourceSampleId: 'S-101',
};

const response: QuestionnaireResponse = {
  id: 'resp-1',
  userId: 'panelist-1',
  productId: 'prod-1',
  timestamp: '2026-06-02T00:00:00Z',
  runNumber: 1,
  cataAttributes: ['Creamy'],
  intensityRatings: {},
  hedonicScores: { overall: 7, appearance: 7, aroma: 7, flavor: 7, texture: 7 },
  emotionalProfile: {},
};

const baseConcept: ConceptTest = {
  id: 'concept-1',
  name: 'Lunchbox Melt',
  category: 'Cheese',
  description: 'A family-ready plant-based melt.',
  imageUrls: ['https://example.test/image.png'],
  targetMarket: 'Parents buying school lunches',
  pricePoint: '$5.99',
  keyBenefits: 'Melts cleanly',
  questions: [
    { id: 'q1', text: 'How likely are you to buy this?', type: 'scale', required: true, category: 'purchase' },
  ],
  panelSize: 50,
  assignedPanelistIds: ['panelist-1', 'panelist-2'],
  projectName: 'Coconut Cheddar',
  foodTypeSlug: 'cheese',
  status: 'approved',
  createdAt: '2026-06-03T00:00:00Z',
};

describe('study summary adapters', () => {
  it('normalizes a product sensory survey without changing its panelist route', () => {
    const summary = adaptProductToStudySummary(baseProduct, [response], [{
      id: 'batch-1',
      fileName: 'cheddar.csv',
      foodTypeSlug: 'cheese',
      foodTypeLabel: 'Cheese',
      rowCount: 1,
      importedBy: 'admin-1',
      importedByName: 'Admin',
      recognizedColumns: [],
      ignoredColumns: [],
      detectionConfidence: 1,
      status: 'active',
      createdAt: '2026-06-01T00:00:00Z',
      sampleCount: 1,
    }]);

    expect(summary.type).toBe('product_sensory');
    expect(summary.status).toBe('active');
    expect(summary.responseCount).toBe(1);
    expect(summary.completedCount).toBe(1);
    expect(summary.invitedCount).toBe(1);
    expect(summary.responseProgressLabel).toBe('1/1 complete');
    expect(summary.openToAll).toBe(false);
    expect(summary.assignmentLabel).toBe('No panelists assigned');
    expect(summary.previewPath).toBe('/questionnaire-info/prod-1');
    expect(summary.sourceImportBatchName).toBe('cheddar.csv');
  });

  it('tracks multi-sample completion by panelist instead of sample rows', () => {
    const multiSampleResponses = [
      { ...response, id: 'resp-1', userId: 'panelist-1', productId: 'prod-1', sampleCode: '101', sessionType: '3-sample-sequential' },
      { ...response, id: 'resp-2', userId: 'panelist-1', productId: 'prod-1', sampleCode: '102', sessionType: '3-sample-sequential' },
      { ...response, id: 'resp-3', userId: 'panelist-2', productId: 'prod-1', sampleCode: '101', sessionType: '3-sample-sequential' },
    ];

    const summary = adaptProductToStudySummary(
      { ...baseProduct, isMultiSample: true, assignedPanelistIds: ['panelist-1', 'panelist-2', 'panelist-3'], samples: [
        { id: '1', code: '101', label: 'A' },
        { id: '2', code: '102', label: 'B' },
      ] },
      multiSampleResponses,
    );

    expect(summary.responseCount).toBe(3);
    expect(summary.completedCount).toBe(2);
    expect(summary.invitedCount).toBe(3);
    expect(summary.completionPercent).toBe(67);
    expect(summary.responseProgressLabel).toBe('2/3 complete');
  });

  it('validates multi-sample structure through the compatibility adapter', () => {
    const blockers = validateMultiSampleStudy({
      ...baseProduct,
      isMultiSample: true,
      samples: [
        { id: '1', code: '101', label: 'A' },
        { id: '2', code: '101', label: 'B' },
      ],
    });

    expect(blockers.some(blocker => blocker.id === 'unique-sample-codes')).toBe(true);
  });

  it('validates triangle tests as 2 underlying samples presented as 3 coded servings', () => {
    const blockers = validateMultiSampleStudy({
      ...baseProduct,
      isMultiSample: true,
      samples: [
        { id: '1', code: '101', label: 'Control' },
        { id: '2', code: '204', label: 'Variant' },
        { id: '3', code: '339', label: 'Control' },
      ],
    });

    expect(blockers.some(blocker => blocker.severity === 'blocker')).toBe(false);
  });

  it('does not require a single linked source sample for triangle tests', () => {
    const blockers = validateProductStudy({
      ...baseProduct,
      isMultiSample: true,
      sourceSampleId: null,
      samples: [
        { id: 'S-101', code: '101', label: 'Control' },
        { id: 'S-204', code: '204', label: 'Variant' },
        { id: 'S-101-replicate', code: '339', label: 'Control' },
      ],
    });

    expect(blockers.map(blocker => blocker.id)).not.toContain('sample-linked');
  });

  it('does not surface compatibility defaults as study warnings', () => {
    const summary = adaptProductToStudySummary(baseProduct, []);
    expect(summary.blockers.map(blocker => blocker.id)).not.toContain('target-response-count');

    const multiSampleBlockers = validateMultiSampleStudy({
      ...baseProduct,
      isMultiSample: true,
      samples: [
        { id: '1', code: '101', label: 'Control' },
        { id: '2', code: '204', label: 'Variant' },
        { id: '3', code: '339', label: 'Control' },
      ],
    });
    expect(multiSampleBlockers.map(blocker => blocker.id)).not.toContain('sample-order');
  });

  it('keeps concept drafts in the shared study lifecycle and validates launch blockers', () => {
    const summary = adaptConceptToStudySummary(baseConcept, { 'concept-1': 3 });
    expect(summary.type).toBe('concept_test');
    expect(summary.status).toBe('draft');
    expect(summary.responseCount).toBe(3);
    expect(summary.responseProgressLabel).toBe('3/3 complete');
    expect(summary.previewPath).toBe('/concept-survey/concept-1');

    const blockers = validateConceptStudy({
      ...baseConcept,
      assignedPanelistIds: [],
      questions: [{ id: 'q2', text: 'Pick an image', type: 'image_choice', required: true, category: 'image' }],
      imageUrls: [],
    });
    expect(blockers.map(blocker => blocker.id)).toEqual(expect.arrayContaining(['assigned-panelists', 'image-choice']));
  });

  it('sorts mixed studies by creation date', () => {
    const summaries = buildStudySummaries({
      products: [baseProduct],
      concepts: [baseConcept],
      responses: [],
      conceptResponseCounts: {},
    });

    expect(summaries.map(study => study.id)).toEqual(['concept-1', 'prod-1']);
  });
});
