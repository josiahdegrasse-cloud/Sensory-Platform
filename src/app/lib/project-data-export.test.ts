import { describe, expect, it } from 'vitest';
import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import type { ConceptResponse, ConceptTest, DecisionRecord, InstrumentalDataset, PanelistInfo } from './database';
import { buildProjectDataSheets, PROJECT_DATA_SECTION_DEFINITIONS } from './project-data-export';

function buildInput() {
  const product = {
    id: 'study-1', name: 'Cheddar study', category: 'Cheese', status: 'active', createdDate: '2026-08-20',
    assignedPanelistIds: ['panelist-1'], projectId: 'project-1', sourceSampleId: 'sample-1', surveySections: ['cata', 'intensity', 'hedonic'],
  } as Product;
  const response = {
    id: 'response-1', userId: 'panelist-1', productId: 'study-1', timestamp: '2026-08-20', runNumber: 1,
    cataAttributes: ['Creamy'], intensityRatings: { Creamy: 7 }, hedonicScores: { overall: 8 }, emotionalProfile: { Happy: 4 }, comments: 'Balanced.',
  } as QuestionnaireResponse;
  const panelist = {
    id: 'panelist-1', name: 'Private Name', email: 'private@example.com', phone: '07000000000', addressLine1: 'Private address',
    panelistId: 'P-001', ageYears: 34, ageBand: '25–34', gender: 'female', nationalityCode: 'GB', ethnicity: 'white',
    dietaryPattern: 'omnivore', smokerStatus: 'non_smoker', weeklyFoodSpend: '40_60', householdSize: 2,
    householdSizePreferNotToSay: false, occupationGroup: 'professional', annualIncomeRange: '40_60', trainingLevel: 'consumer',
  } as unknown as PanelistInfo;
  const concept = {
    id: 'concept-1', name: 'Cheddar concept', category: 'Cheese', status: 'active', description: 'Concept', targetMarket: 'UK',
    pricePoint: '£4', keyBenefits: 'Creamy', panelSize: 1, assignedPanelistIds: ['panelist-1'], createdAt: '2026-08-20',
    imageUrls: [], questions: [{ id: 'q1', text: 'Would you buy it?', type: 'scale', required: true, category: 'intent' }],
  } as ConceptTest;
  const conceptResponse = {
    id: 'concept-response-1', userId: 'panelist-1', conceptTestId: 'concept-1', answers: { q1: 8 }, createdAt: '2026-08-20',
  } as ConceptResponse;
  const decision = {
    id: 'decision-1', timestamp: '2026-08-20', sampleId: 'sample-1', sampleName: 'Cheddar', decision: 'GO', issfScore: 82,
    confidence: 0.9, user: 'admin', note: 'Proceed', methodVersion: '1', decisionFingerprint: 'fingerprint', projectId: 'project-1',
  } as DecisionRecord;
  const instrumentalDataset = {
    eTongueData: [{ sampleId: 'sample-1', sampleName: 'Cheddar', sourness: 2, bitterness: 1, saltiness: 6, umami: 5, sweetness: 2 }],
    gcmsData: { 'sample-1': [{ name: 'Diacetyl', concentration: 4, aroma: 'Buttery', threshold: 2 }] },
    compositionData: { 'sample-1': { protein: 8, fat: 24, moisture: 50, pH: 5.2, saltContent: 1.8, calciumMg: 120 } },
  } as InstrumentalDataset;

  return {
    projectId: 'project-1', projectName: 'Cheddar project', organizationName: 'NFI', workspaceName: 'Lab', anonymizePanelists: true,
    products: [product], foodPanelResponses: [response], panelists: [panelist], concepts: [concept], conceptResponses: [conceptResponse],
    decisions: [decision], instrumentalDataset, instrumentalSampleIds: new Set(['sample-1']), formulationVersions: [],
  };
}

describe('project data export', () => {
  it('builds the project workbook without a commercialization report', () => {
    const sheets = buildProjectDataSheets(buildInput());

    expect(sheets.map(sheet => sheet.key)).toEqual(PROJECT_DATA_SECTION_DEFINITIONS.map(section => section.key));
    expect(sheets.find(sheet => sheet.key === 'food-panel-responses')?.rows).toHaveLength(1);
    expect(sheets.find(sheet => sheet.key === 'concept-responses')?.rows).toHaveLength(1);
    expect(sheets.find(sheet => sheet.key === 'decision-evidence')?.rows).toHaveLength(1);
    expect(sheets.find(sheet => sheet.key === 'e-tongue')?.rows.length).toBeGreaterThan(0);
  });

  it('never exports direct panelist contact details', () => {
    const sheet = buildProjectDataSheets(buildInput()).find(item => item.key === 'panelist-demographics');
    const serialized = JSON.stringify(sheet);

    expect(serialized).toContain('Participant 001');
    expect(serialized).not.toContain('Private Name');
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('07000000000');
    expect(serialized).not.toContain('Private address');
  });
});
