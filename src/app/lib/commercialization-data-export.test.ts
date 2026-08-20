import { describe, expect, it } from 'vitest';
import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import type {
  CommercializationReportRecord,
  ConceptResponse,
  ConceptTest,
  DecisionRecord,
  InstrumentalDataset,
  PanelistInfo,
} from './database';
import type { CommercializationReportSnapshot } from './commercialization-report';
import type { EvidenceBundle } from './report-evidence-types';
import {
  buildCommercializationDataSheets,
  REPORT_DATA_SECTION_DEFINITIONS,
  type CommercializationDataExportInput,
} from './commercialization-data-export';

const product: Product = {
  id: 'product-1',
  name: 'Prototype A',
  category: 'cheese',
  createdDate: '2026-08-01',
  status: 'completed',
  projectId: 'project-1',
  instrumentalSampleId: 'instrument-1',
  sourceSampleId: 'sample-1',
  surveySections: ['cata', 'intensity', 'hedonic', 'emotions', 'comments'],
};

const foodResponse: QuestionnaireResponse = {
  id: 'food-response-1',
  userId: 'user-1',
  productId: product.id,
  timestamp: '2026-08-05T10:00:00.000Z',
  runNumber: 1,
  cataAttributes: ['Creamy', 'Savoury'],
  intensityRatings: { creaminess: 4.2 },
  hedonicScores: { overall: 8, flavor: 7 },
  emotionalProfile: { Happy: 4 },
  comments: 'Strong concept fit',
};

const concept: ConceptTest = {
  id: 'concept-1',
  name: 'Everyday plant-based cheese',
  category: 'cheese',
  description: 'A familiar format for everyday meals.',
  imageUrls: [],
  targetMarket: 'Flexitarian households',
  pricePoint: '£3.50',
  keyBenefits: 'Creamy; versatile',
  questions: [{ id: 'purchase', text: 'How likely are you to buy?', type: 'scale', required: true, category: 'purchase' }],
  panelSize: 24,
  assignedPanelistIds: ['user-1'],
  status: 'completed',
  createdAt: '2026-08-02T10:00:00.000Z',
  projectId: 'project-1',
  decisionRecordId: 'decision-1',
};

const conceptResponse: ConceptResponse = {
  id: 'concept-response-1',
  userId: 'user-1',
  conceptTestId: concept.id,
  answers: { purchase: 5 },
  createdAt: '2026-08-06T10:00:00.000Z',
};

const panelist = {
  id: 'user-1',
  name: 'Private Person',
  email: 'private@example.com',
  panelistId: 'P-007',
  ageBand: '30–39',
  gender: 'woman',
  nationalityCode: 'GB',
  ethnicity: 'mixed',
  householdSize: 3,
  householdSizePreferNotToSay: false,
  childrenInHousehold: true,
  dietaryPattern: 'flexitarian',
  dietaryOther: null,
  groceryRole: 'main_shopper',
  categoryUsageFrequency: 'weekly',
  smokerStatus: 'non_smoker',
  weeklyFoodSpend: '60_80',
  occupationGroup: 'professional',
  annualIncomeRange: '40_60k',
  trainingLevel: 'screened',
} as PanelistInfo;

const decision: DecisionRecord = {
  id: 'decision-1',
  timestamp: '2026-08-07T10:00:00.000Z',
  sampleId: 'sample-1',
  sampleName: 'Prototype A',
  decision: 'GO',
  issfScore: 82,
  confidence: 88,
  user: 'Research lead',
  note: 'Advance to buyer review.',
  methodVersion: 'ISSF-1.0',
  decisionFingerprint: 'fingerprint-1',
  projectId: 'project-1',
  instrumentalSampleId: 'instrument-1',
  evidenceBundleId: 'evidence-1',
};

const snapshot: CommercializationReportSnapshot = {
  product: { sampleId: 'sample-1', sampleName: 'Prototype A', foodType: 'Cheese' },
  decision: {
    recordId: decision.id,
    outcome: 'GO',
    issfScore: 82,
    confidence: 88,
    recommendation: 'Advance to buyer review.',
    dimensions: { hedonic: 84, texture: 80, cata: 79, emotional: 81 },
    gates: [{ id: 'gate-1', label: 'Acceptance', status: 'pass', detail: 'Above target.', impact: 3 }],
    prescriptions: [{ priority: 1, target: 'Packaging', action: 'Validate shelf stand-out.', expectedLift: 2 }],
    methodVersion: 'ISSF-1.0',
    fingerprint: 'fingerprint-1',
  },
  concept: {
    id: concept.id,
    name: concept.name,
    description: concept.description,
    targetMarket: concept.targetMarket,
    pricePoint: concept.pricePoint,
    keyBenefits: concept.keyBenefits,
    packagingImageId: null,
    packagingImageUrl: '',
  },
  evidence: {
    responseCount: 1,
    scaleMetrics: [{ question: 'How likely are you to buy?', average: 5, count: 1 }],
    topSelections: [{ option: 'Creamy', count: 1, percentage: 100 }],
    comments: ['Strong concept fit'],
    purchaseIntent: 5,
  },
  narrative: {
    executiveSummary: 'The product has a confirmed GO decision.',
    whyLiked: 'Creamy and versatile.',
    packagingRationale: 'Clear everyday positioning.',
    launchRecommendation: 'Proceed to buyer review.',
    claimCaution: 'Validate broader claims.',
  },
  generatedAt: '2026-08-08T10:00:00.000Z',
};

const report: CommercializationReportRecord = {
  id: 'report-1',
  decisionRecordId: decision.id,
  conceptTestId: concept.id,
  packagingImageId: null,
  evidenceBundleId: 'evidence-1',
  status: 'approved',
  version: 2,
  title: 'Prototype A commercialization report',
  reportSnapshot: snapshot as unknown as Record<string, unknown>,
  createdBy: 'admin-1',
  approvedBy: 'admin-2',
  approvedAt: '2026-08-09T10:00:00.000Z',
  createdAt: '2026-08-08T10:00:00.000Z',
  updatedAt: '2026-08-09T10:00:00.000Z',
  canonicalProjectId: 'project-1',
};

const instrumentalDataset: InstrumentalDataset = {
  eTongueData: [
    { instrumentalSampleId: 'instrument-1', sampleId: 'sample-1', sampleName: 'Prototype A', sourness: 2, bitterness: 1, saltiness: 3, umami: 4, sweetness: 1 },
    { instrumentalSampleId: 'instrument-2', sampleId: 'sample-2', sampleName: 'Other product', sourness: 9, bitterness: 9, saltiness: 9, umami: 9, sweetness: 9 },
  ],
  gcmsData: {
    'sample-1': [{ name: 'Diacetyl', concentration: 12, aroma: 'Buttery', threshold: 4 }],
    'sample-2': [{ name: 'Other', concentration: 99, aroma: 'Other', threshold: 1 }],
  },
  compositionData: {
    'sample-1': { protein: 12, fat: 20, moisture: 48, pH: 5.4, saltContent: 1.5, calciumMg: 180 },
  },
};

const evidenceBundle = {
  id: 'evidence-1',
  projectId: 'project-1',
  version: 1,
  schemaVersion: '1',
  generatedAt: '2026-08-07T10:00:00.000Z',
  sourceDataVersion: 'source-1',
  evidence: [{ id: 'metric-1', evidenceType: 'metric', title: 'Overall liking', description: 'Mean hedonic result', value: 8, sourceType: 'live_panel', confidence: 0.88, isCritical: true }],
  missingData: [],
  qualityWarnings: [],
  commercialProfile: { actionPlan: [{ workstream: 'Buyer review', owner: 'Commercial lead', team: 'Commercial', dueDate: null, priority: 'high', action: 'Book review', completionEvidence: 'Meeting notes', passingCriteria: 'Buyer interest recorded', dependencies: ['Approved report'], nextGate: 'Retail trial' }] },
} as unknown as EvidenceBundle;

function input(anonymizePanelists = true): CommercializationDataExportInput {
  return {
    report,
    snapshot,
    decision,
    concept,
    conceptResponses: [conceptResponse],
    products: [product],
    foodPanelResponses: [foodResponse],
    panelists: [panelist],
    instrumentalDataset,
    formulationVersions: [],
    evidenceBundle,
    organizationName: 'New Food Innovation',
    workspaceName: 'Sensory workspace',
    anonymizePanelists,
  };
}

describe('commercialization data export', () => {
  it('builds every selectable dataset as a uniquely named worksheet', () => {
    const sheets = buildCommercializationDataSheets(input());
    expect(sheets.map(item => item.key)).toHaveLength(REPORT_DATA_SECTION_DEFINITIONS.length);
    expect(new Set(sheets.map(item => item.name)).size).toBe(sheets.length);
    expect(sheets.find(item => item.key === 'food-panel-responses')?.columns).toEqual(expect.arrayContaining([
      'CATA descriptors', 'Intensity · creaminess', 'Hedonic · overall', 'Emotion · Happy',
    ]));
  });

  it('uses one anonymous participant code across demographics and both response sheets', () => {
    const sheets = buildCommercializationDataSheets(input());
    const demographics = sheets.find(item => item.key === 'panelist-demographics')!;
    const food = sheets.find(item => item.key === 'food-panel-responses')!;
    const concepts = sheets.find(item => item.key === 'concept-responses')!;

    expect(demographics.rows[0]['Participant code']).toBe('Participant 001');
    expect(food.rows[0]['Participant code']).toBe('Participant 001');
    expect(concepts.rows[0]['Participant code']).toBe('Participant 001');
    expect(JSON.stringify([demographics, food, concepts])).not.toContain(panelist.name);
    expect(JSON.stringify([demographics, food, concepts])).not.toContain(panelist.email);
  });

  it('uses registered panelist codes when report anonymization is disabled without exporting direct identity fields', () => {
    const demographics = buildCommercializationDataSheets(input(false)).find(item => item.key === 'panelist-demographics')!;
    expect(demographics.rows[0]['Participant code']).toBe('P-007');
    expect(JSON.stringify(demographics)).not.toContain(panelist.name);
    expect(JSON.stringify(demographics)).not.toContain(panelist.email);
  });

  it('keeps instrumental worksheets scoped to the report sample', () => {
    const sheets = buildCommercializationDataSheets(input());
    const eTongue = sheets.find(item => item.key === 'e-tongue')!;
    const gcms = sheets.find(item => item.key === 'gc-ms')!;

    expect(eTongue.rows).toHaveLength(5);
    expect(eTongue.rows.every(row => row['Sample ID'] === 'sample-1')).toBe(true);
    expect(gcms.rows).toHaveLength(1);
    expect(gcms.rows[0].Compound).toBe('Diacetyl');
  });
});
