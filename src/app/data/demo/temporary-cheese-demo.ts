import type { ConceptResponse, ConceptTest, DecisionRecord } from '../../lib/database';
import { ESSENSE25_EMOTIONS, type Product, type QuestionnaireResponse } from '../survey-domain';

export const TEMPORARY_CHEESE_DEMO_LABEL = 'Temporary cheese demo';

export const TEMPORARY_CHEESE_PRODUCT: Product = {
  id: 'demo-cheese-product-s4',
  name: 'Coconut Cheddar v3.0 (S4)',
  category: 'Cheese',
  createdDate: '2026-06-01T12:00:00.000Z',
  status: 'active',
  customAttributes: ['Cheese', 'Butter', 'Lactic acid', 'Milk', 'Nutty', 'Creamy', 'Smooth', 'Grainy', 'Chalky', 'Firm', 'Spreadable'],
  assignedPanelistIds: [],
  sourceImportBatchId: null,
  sourceSampleId: 'S4',
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
      ? ['Cheese', 'Butter', 'Creamy', 'Smooth']
      : ['Cheese', 'Butter', 'Lactic acid', 'Milk', 'Nutty', 'Creamy', 'Smooth'],
    intensityRatings: {
      creamy: 8.4 + variation * 0.2,
      smooth: 8.6 + variation * 0.2,
      cheesiness: 6.8 + variation * 0.2,
      milkiness: 7.2 + variation * 0.2,
      grainy: 1.8 + variation * 0.1,
      chalky: 1.2 + variation * 0.1,
      oily: 2.8 + variation * 0.1,
    },
    hedonicScores: {
      overall: 7.6 + variation * 0.3,
      appearance: 7.8 + variation * 0.2,
      aroma: 7.4 + variation * 0.2,
      flavor: 7.6 + variation * 0.3,
      texture: 7.5 + variation * 0.2,
    },
    emotionalProfile: { ...positiveEmotions, ...negativeEmotions },
    comments: [
      'Strong cheddar-category character with a creamy, smooth mouthfeel.',
      'The buttery and lactic notes feel familiar; firmness still needs to be measured.',
      'Smooth and creamy, with low graininess and chalkiness in this sample.',
      'I would like a little more sharpness and clearer evidence on melt and structure.',
    ][index % 4],
  };
});

const conceptQuestions = [
  { id: 'appeal', text: 'How appealing is this concept?', type: 'scale' as const, required: true, category: 'appeal' },
  { id: 'purchase', text: 'How likely are you to purchase it?', type: 'scale' as const, required: true, category: 'purchase' },
  { id: 'clarity', text: 'How clearly does this communicate plant-based cheddar?', type: 'scale' as const, required: true, category: 'clarity' },
  { id: 'price', text: 'How acceptable is the proposed price for this pack?', type: 'scale' as const, required: true, category: 'price' },
  {
    id: 'benefits',
    text: 'Which benefits are most compelling?',
    type: 'multiple_choice' as const,
    options: ['Familiar cheddar cues', 'Creamy texture', 'Dairy-free format', 'Everyday cooking versatility', 'Smooth mouthfeel'],
    required: true,
    category: 'benefits',
  },
  {
    id: 'occasion',
    text: 'Which usage occasions feel most credible?',
    type: 'multiple_choice' as const,
    options: ['Burgers', 'Hot sandwiches', 'Toasties', 'Weeknight meals', 'Cheese boards'],
    required: true,
    category: 'occasion',
  },
  {
    id: 'coconut',
    text: 'What expectation does the coconut base create?',
    type: 'multiple_choice' as const,
    options: ['Positive natural cue', 'Creaminess cue', 'Concern about coconut flavour', 'No material effect'],
    required: true,
    category: 'expectation',
  },
  {
    id: 'overpromise',
    text: 'Does the concept appear to overpromise texture or melt performance?',
    type: 'multiple_choice' as const,
    options: ['No', 'Possibly', 'Yes'],
    required: true,
    category: 'claims',
  },
  { id: 'comment', text: 'What stands out?', type: 'open_text' as const, required: false, category: 'appeal' },
];

export const TEMPORARY_CHEESE_CONCEPTS: ConceptTest[] = [
  {
    id: 'demo-cheese-concept-melt',
    name: 'Everyday Melt Cheddar',
    category: 'Plant-Based Cheese',
    description: 'Directional hypothesis: a coconut-based cheddar slice for burgers, toasties, hot sandwiches, and weeknight meals.',
    imageUrls: [],
    targetMarket: 'Hypothesis: flexitarian households seeking familiar plant-based cheddar cues and everyday cooking versatility',
    pricePoint: 'Hypothesis: $5.99-$6.49 per 7 oz resealable pack',
    keyBenefits: 'Evidence-supported: creamy, smooth, cheddar-category sensory cues. Directional: melt and everyday versatility.',
    questions: conceptQuestions,
    panelSize: 40,
    assignedPanelistIds: [],
    projectName: 'Coconut Cheddar v3.0',
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
    description: 'Directional hypothesis: a premium cultured cheddar-style block for slicing, cooking, and elevated home meals.',
    imageUrls: [],
    targetMarket: 'Hypothesis: food-curious adults and premium plant-based shoppers who prioritize culinary versatility',
    pricePoint: 'Hypothesis: $6.99-$7.49 per 8 oz block',
    keyBenefits: 'Evidence-supported: cheddar-category recognition and smooth mouthfeel. Directional: slicing and premium culinary use.',
    questions: conceptQuestions,
    panelSize: 40,
    assignedPanelistIds: [],
    projectName: 'Coconut Cheddar v3.0',
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
    Array.from({ length: conceptIndex === 0 ? 40 : 36 }, (_, index) => ({
      id: `${concept.id}-response-${index + 1}`,
      userId: `demo-concept-panelist-${index + 1}`,
      conceptTestId: concept.id,
      answers: {
        appeal: conceptIndex === 0 ? 7 + (index % 3) : 6 + (index % 3),
        purchase: conceptIndex === 0 ? 7 + (index % 2) : 6 + (index % 3),
        clarity: conceptIndex === 0 ? 8 - (index % 2) : 7 - (index % 2),
        price: conceptIndex === 0 ? 7 - (index % 2) : 6 - (index % 2),
        benefits: conceptIndex === 0
          ? ['Familiar cheddar cues', 'Creamy texture', 'Everyday cooking versatility']
          : ['Familiar cheddar cues', 'Smooth mouthfeel', 'Dairy-free format'],
        occasion: conceptIndex === 0
          ? ['Burgers', 'Hot sandwiches', 'Weeknight meals']
          : ['Hot sandwiches', 'Weeknight meals', 'Cheese boards'],
        coconut: index % 4 === 0 ? ['Concern about coconut flavour'] : ['Creaminess cue', 'No material effect'],
        overpromise: [index % 5 === 0 ? 'Possibly' : 'No'],
        comment: conceptIndex === 0
          ? 'The familiar cheddar and everyday-meal direction is clear; validate actual melt and firmness before making those claims.'
          : 'The premium direction is interesting but needs a sharper cheddar cue and proof of slicing performance.',
      },
      createdAt: new Date(Date.UTC(2026, 5, 4, 12, index)).toISOString(),
    })),
  ]),
);

export const TEMPORARY_CHEESE_DECISION: DecisionRecord = {
  id: 'demo-cheese-decision-s4',
  timestamp: '2026-06-05T12:00:00.000Z',
  sampleId: 'S4',
  sampleName: 'Coconut Cheddar v3.0',
  decision: 'GO',
  issfScore: 76.7,
  confidence: 90.78,
  user: 'Temporary demo fixture',
  note: 'Reference/demo S4 evidence for previewing Insights, Concept, and Report workflows. Not approved for external use.',
  methodVersion: 'NFI-GST-1.1',
  decisionFingerprint: '699B8585',
};

export function mergeTemporaryFixtures<T extends { id: string }>(records: T[], fixtures: T[]) {
  const existingIds = new Set(records.map(record => record.id));
  return [...records, ...fixtures.filter(fixture => !existingIds.has(fixture.id))];
}
