import type { ConceptResponse, ConceptTest, DecisionRecord } from '../lib/database';
import { ESSENSE25_EMOTIONS, type Product, type QuestionnaireResponse } from './mock-users';

export const TEMPORARY_CHEESE_DEMO_LABEL = 'Temporary cheese demo';

export const TEMPORARY_CHEESE_PRODUCT: Product = {
  id: 'demo-cheese-product-s1',
  name: 'Coconut Cheddar v2.1 (S1)',
  category: 'Cheese',
  createdDate: '2026-06-01T12:00:00.000Z',
  status: 'active',
  customAttributes: ['Buttery', 'Creamy', 'Smooth', 'Cheesy', 'Nutty', 'Mild'],
  assignedPanelistIds: [],
  sourceImportBatchId: null,
  sourceSampleId: 'S1',
};

const positiveEmotions = Object.fromEntries(ESSENSE25_EMOTIONS.positive.map(emotion => [emotion, 4]));
const negativeEmotions = Object.fromEntries(ESSENSE25_EMOTIONS.negative.map(emotion => [emotion, 1]));

export const TEMPORARY_CHEESE_RESPONSES: QuestionnaireResponse[] = Array.from({ length: 14 }, (_, index) => {
  const variation = (index % 3) - 1;
  return {
    id: `demo-cheese-response-${index + 1}`,
    userId: `demo-panelist-${index + 1}`,
    productId: TEMPORARY_CHEESE_PRODUCT.id,
    timestamp: new Date(Date.UTC(2026, 5, 1, 12, index)).toISOString(),
    runNumber: 1,
    cataAttributes: index % 4 === 0
      ? ['Buttery', 'Creamy', 'Smooth', 'Mild']
      : ['Buttery', 'Creamy', 'Smooth', 'Cheesy', 'Nutty'],
    intensityRatings: {
      creaminess: 4.2 + variation * 0.2,
      cheesiness: 3.9 + variation * 0.2,
      saltiness: 3.2 + variation * 0.1,
      melt: 4.1 + variation * 0.2,
      aftertaste: 2.4 + variation * 0.1,
    },
    hedonicScores: {
      overall: 7.4 + variation * 0.3,
      appearance: 7.6 + variation * 0.2,
      aroma: 7.1 + variation * 0.2,
      flavor: 7.3 + variation * 0.3,
      texture: 7.7 + variation * 0.2,
    },
    emotionalProfile: { ...positiveEmotions, ...negativeEmotions },
    comments: [
      'Creamy texture and convincing cheddar flavor.',
      'The melt and smooth mouthfeel make this feel ready for burgers.',
      'Clear dairy-free alternative with a mild, family-friendly flavor.',
      'I would like a little more sharpness, but the texture is strong.',
    ][index % 4],
  };
});

const conceptQuestions = [
  { id: 'appeal', text: 'How appealing is this concept?', type: 'scale' as const, required: true, category: 'appeal' },
  { id: 'purchase', text: 'How likely are you to purchase it?', type: 'scale' as const, required: true, category: 'purchase' },
  {
    id: 'benefits',
    text: 'Which benefits are most compelling?',
    type: 'multiple_choice' as const,
    options: ['Melts well', 'Creamy texture', 'Dairy-free', 'Family friendly'],
    required: true,
    category: 'benefits',
  },
  { id: 'comment', text: 'What stands out?', type: 'open_text' as const, required: false, category: 'appeal' },
];

export const TEMPORARY_CHEESE_CONCEPTS: ConceptTest[] = [
  {
    id: 'demo-cheese-concept-melt',
    name: 'Everyday Melt Cheddar',
    category: 'Plant-Based Cheese',
    description: 'A creamy coconut-based cheddar slice designed for burgers, toasties, and weeknight family meals.',
    imageUrls: [],
    targetMarket: 'Flexitarian families seeking an easy dairy swap',
    pricePoint: '$5.99 per 7 oz resealable pack',
    keyBenefits: 'Reliable melt, creamy texture, familiar cheddar flavor',
    questions: conceptQuestions,
    panelSize: 20,
    assignedPanelistIds: [],
    projectName: 'Coconut Cheddar v2.1',
    foodTypeSlug: 'cheese',
    approvalNotes: TEMPORARY_CHEESE_DEMO_LABEL,
    status: 'active',
    createdAt: '2026-06-02T12:00:00.000Z',
    launchedAt: '2026-06-02T12:00:00.000Z',
  },
  {
    id: 'demo-cheese-concept-premium',
    name: 'Cultured Kitchen Cheddar',
    category: 'Plant-Based Cheese',
    description: 'A premium cultured cheddar block positioned around smooth slicing, savory depth, and elevated home cooking.',
    imageUrls: [],
    targetMarket: 'Food-curious adults and premium plant-based shoppers',
    pricePoint: '$7.49 per 8 oz block',
    keyBenefits: 'Cultured flavor, smooth slicing, premium culinary use',
    questions: conceptQuestions,
    panelSize: 20,
    assignedPanelistIds: [],
    projectName: 'Coconut Cheddar v2.1',
    foodTypeSlug: 'cheese',
    approvalNotes: TEMPORARY_CHEESE_DEMO_LABEL,
    status: 'active',
    createdAt: '2026-06-03T12:00:00.000Z',
    launchedAt: '2026-06-03T12:00:00.000Z',
  },
];

export const TEMPORARY_CHEESE_CONCEPT_RESPONSES: Record<string, ConceptResponse[]> = Object.fromEntries(
  TEMPORARY_CHEESE_CONCEPTS.map((concept, conceptIndex) => [
    concept.id,
    Array.from({ length: conceptIndex === 0 ? 14 : 12 }, (_, index) => ({
      id: `${concept.id}-response-${index + 1}`,
      userId: `demo-concept-panelist-${index + 1}`,
      conceptTestId: concept.id,
      answers: {
        appeal: conceptIndex === 0 ? 7 + (index % 3) : 6 + (index % 3),
        purchase: conceptIndex === 0 ? 7 + (index % 2) : 6 + (index % 3),
        benefits: conceptIndex === 0
          ? ['Melts well', 'Creamy texture', 'Family friendly']
          : ['Creamy texture', 'Dairy-free'],
        comment: conceptIndex === 0
          ? 'The familiar melt and family meal positioning feel useful.'
          : 'The premium direction feels credible but needs a stronger sharp-cheddar cue.',
      },
      createdAt: new Date(Date.UTC(2026, 5, 4, 12, index)).toISOString(),
    })),
  ]),
);

export const TEMPORARY_CHEESE_DECISION: DecisionRecord = {
  id: 'demo-cheese-decision-s1',
  timestamp: '2026-06-05T12:00:00.000Z',
  sampleId: 'S1',
  sampleName: 'Coconut Cheddar v2.1',
  decision: 'GO',
  issfScore: 82,
  confidence: 88,
  user: 'Temporary demo fixture',
  note: 'Temporary cheese evidence for previewing Insights, Concept, and Report workflows.',
  methodVersion: 'DEMO-2026-06',
  decisionFingerprint: 'demo-cheese-s1-go',
};

export function mergeTemporaryFixtures<T extends { id: string }>(records: T[], fixtures: T[]) {
  const existingIds = new Set(records.map(record => record.id));
  return [...records, ...fixtures.filter(fixture => !existingIds.has(fixture.id))];
}
