import { describe, expect, it } from 'vitest';
import { buildImportedDataset, recogniseColumns, validateImportedDataset } from './stage1-instrumental';

describe('CSV import workflow intelligence', () => {
  it('turns meat CSV rows into a complete meat project dataset', () => {
    const rows = [
      {
        sampleId: 'M1',
        sampleName: 'Plant Burger V1',
        foodType: 'meat',
        category: 'Burger',
        sourness: '1.2',
        bitterness: '1.8',
        saltiness: '2.6',
        umami: '4.2',
        sweetness: '0.8',
        compound: 'Hexanal',
        concentration: '2.1',
        aroma: 'green/fatty',
        threshold: '5',
        protein: '18.4',
        fat: '12.2',
        moisture: '54.1',
      },
      {
        sampleId: 'M2',
        sampleName: 'Plant Burger V2',
        foodType: 'meat',
        category: 'Burger',
        sourness: '1.0',
        bitterness: '1.4',
        saltiness: '2.4',
        umami: '4.8',
        sweetness: '0.7',
        compound: '2-methyl-3-furanthiol',
        concentration: '0.6',
        aroma: 'meaty',
        threshold: '0',
        protein: '19.1',
        fat: '11.8',
        moisture: '53.6',
      },
    ];

    const headers = Object.keys(rows[0]);
    const report = recogniseColumns(headers);
    const dataset = buildImportedDataset(rows, 'plant-meat-trial.csv');
    const validation = validateImportedDataset(rows, dataset, report, dataset.detection);

    expect(dataset.detection.slug).toBe('meat');
    expect(dataset.detection.confidence).toBeGreaterThanOrEqual(0.88);
    expect(dataset.eTongueData).toHaveLength(2);
    expect(dataset.gcmsData.M1).toHaveLength(1);
    expect(dataset.compositionData.M2.protein).toBe(19.1);
    expect(validation.errors).toEqual([]);
  });
});
