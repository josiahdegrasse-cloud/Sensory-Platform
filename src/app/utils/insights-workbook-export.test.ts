import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import { downloadCommercializationDataWorkbook } from '../lib/commercialization-data-export';
import {
  buildFoodPanelWorkbookSheets,
  filterPanelResponsesByProductIds,
  meanAndSampleStandardDeviation,
} from './insights-workbook-export';

const product = {
  id: 'product-1',
  name: 'Prototype A',
  category: 'Cheese',
  sourceSampleId: 'sample-1',
  createdDate: '2026-08-20',
  status: 'active',
} as Product;

function response(id: string, userId: string, intensity: number, liking: number, emotion: number, selected: boolean): QuestionnaireResponse {
  return {
    id,
    userId,
    productId: product.id,
    timestamp: `2026-08-20T10:0${id}.000Z`,
    runNumber: 1,
    cataAttributes: selected ? ['Creamy'] : [],
    intensityRatings: { Creaminess: intensity },
    hedonicScores: { overall: liking },
    emotionalProfile: { Happy: emotion },
    comments: '',
  };
}

const responses = [
  response('1', 'private-user-b', 4, 7, 3, true),
  response('2', 'private-user-a', 6, 9, 5, false),
];

describe('food panel workbook export', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calculates arithmetic means and sample standard deviations', () => {
    expect(meanAndSampleStandardDeviation([4, 6])).toEqual({ n: 2, mean: 5, standardDeviation: 1.4142 });
    expect(meanAndSampleStandardDeviation([4])).toEqual({ n: 1, mean: 4, standardDeviation: null });
  });

  it('creates raw and summary sheets from the same response scope', () => {
    const [raw, summary] = buildFoodPanelWorkbookSheets([product], responses);

    expect([raw.name, summary.name]).toEqual(['Raw Data', 'Means and SD']);
    expect(raw.rows).toHaveLength(2);
    expect(raw.rows.map(row => row['Participant code'])).toEqual(['Participant 002', 'Participant 001']);
    expect(JSON.stringify(raw)).not.toContain('private-user-a');
    expect(raw.rows[0]['CATA · Creamy']).toBe(1);
    expect(raw.rows[1]['CATA · Creamy']).toBe(0);

    expect(summary.rows.find(row => row['Result group'] === 'Intensity')).toMatchObject({
      Attribute: 'Creaminess', N: 2, Mean: 5, 'Standard deviation': 1.4142,
    });
    expect(summary.rows.find(row => row['Result group'] === 'Hedonic')).toMatchObject({
      Attribute: 'overall', Mean: 8, 'Standard deviation': 1.4142,
    });
    expect(summary.rows.find(row => row['Result group'] === 'CATA')).toMatchObject({
      Attribute: 'Creamy', Mean: 0.5, 'Standard deviation': 0.7071,
    });
  });

  it('keeps both sheets scoped to the selected project products', () => {
    const other = { ...responses[0], id: 'other', productId: 'product-2' };
    expect(filterPanelResponsesByProductIds([...responses, other], new Set([product.id]))).toEqual(responses);
  });

  it('serializes the two datasets as separate Excel worksheets', async () => {
    let exportedBlob: Blob | undefined;
    const anchor = { href: '', download: '', hidden: false, click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return 'blob:food-panel-workbook';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    });

    await downloadCommercializationDataWorkbook({
      sheets: buildFoodPanelWorkbookSheets([product], responses),
      organizationName: 'New Food Innovation',
      reportTitle: 'Project A food panel results',
      generatedAt: new Date('2026-08-20T12:00:00.000Z'),
    });

    expect(anchor.download).toBe('project-a-food-panel-results-data.xlsx');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(exportedBlob).toBeDefined();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exportedBlob!.arrayBuffer());
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Raw Data', 'Means and SD']);
    expect(workbook.getWorksheet('Raw Data')?.rowCount).toBe(3);
    expect(workbook.getWorksheet('Means and SD')?.getRow(2).getCell(6).value).toBe('CATA');
  });
});
