import { describe, expect, it } from 'vitest';
import type { ConceptResponse, ConceptTest } from '../lib/database';
import type { LiveAggregation } from '../lib/use-survey-data';
import {
  buildConceptTestingResultsRows,
  buildFoodPanelResultsRows,
  exportFilename,
  filterPanelResultsByProductIds,
  serializeInsightsCsv,
} from './insights-csv-export';

const panelResult: LiveAggregation = {
  productId: 'product-1',
  productName: '=Prototype One',
  sourceSampleId: 'S-01',
  category: 'cheese',
  n: 4,
  cata: { Creamy: 3 },
  intensity: { Saltiness: 5.5 },
  hedonic: { overall: 7.25 },
  hedonicSD: { overall: 0.8 },
  emotions: { positive: 0.7, negative: 0.1 },
};

const concept: ConceptTest = {
  id: 'concept-1',
  name: 'Everyday spread',
  category: 'Positioning',
  description: '',
  imageUrls: [],
  targetMarket: '',
  pricePoint: '',
  keyBenefits: '',
  questions: [
    { id: 'appeal', text: 'How appealing?', type: 'scale', required: true, category: 'Appeal' },
    { id: 'why', text: 'Why?', type: 'open_text', required: false, category: 'Language' },
  ],
  panelSize: 20,
  assignedPanelistIds: [],
  projectName: 'Cheese project',
  status: 'completed',
  createdAt: '2026-08-01T10:00:00.000Z',
};

const conceptResponse: ConceptResponse = {
  id: 'response-private-id',
  userId: 'panelist-private-id',
  conceptTestId: concept.id,
  answers: { appeal: 8, why: '+Fresh, clear idea' },
  createdAt: '2026-08-18T09:00:00.000Z',
};

describe('Insights CSV export', () => {
  it('builds normalized food-panel rows with response context and derived CATA percentage', () => {
    const rows = buildFoodPanelResultsRows([panelResult]);

    expect(rows[1]).toEqual([
      'product-1', 'S-01', '=Prototype One', 'cheese', 4,
      'CATA', 'Creamy', 'Selection count', 3, 'Count',
    ]);
    expect(rows[2]).toContain(75);
    expect(serializeInsightsCsv(rows)).toContain('"\'=Prototype One"');
  });

  it('keeps the food-panel export scoped to selected project products', () => {
    const other = { ...panelResult, productId: 'product-2' };
    expect(filterPanelResultsByProductIds([panelResult, other], new Set(['product-1'])))
      .toEqual([panelResult]);
  });

  it('exports de-identified concept answers without response or user identifiers', () => {
    const csv = serializeInsightsCsv(buildConceptTestingResultsRows([concept], [conceptResponse]));

    expect(csv).toContain('"Panelist 1"');
    expect(csv).toContain('"How appealing?"');
    expect(csv).toContain('"\'+Fresh, clear idea"');
    expect(csv).not.toContain(conceptResponse.id);
    expect(csv).not.toContain(conceptResponse.userId);
  });

  it('creates stable, workbook-friendly dataset filenames', () => {
    expect(exportFilename('Cheese Project / V2', 'concept-testing-results', new Date('2026-08-19T12:00:00.000Z')))
      .toBe('cheese-project-v2-concept-testing-results-2026-08-19.csv');
  });
});
