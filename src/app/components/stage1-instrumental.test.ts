import { describe, expect, it } from 'vitest';
import {
  buildImportedDataset,
  buildRetestBatchName,
  getPointColor,
  inferYogurtCategory,
  mergeInstrumentalData,
  recogniseColumns,
  validateImportedDataset,
} from './stage1-instrumental-data';

describe('CSV import workflow intelligence', () => {
  it('labels item-specific retest and reformulation imports clearly', () => {
    expect(buildRetestBatchName({
      sampleId: 'S5',
      sampleName: 'Cashew Mozzarella v1.2',
      decision: 'TWEAK',
    })).toBe('Cashew Mozzarella v1.2 retest');

    expect(buildRetestBatchName({
      sampleId: 'S5',
      sampleName: 'Cashew Mozzarella v1.2',
      decision: 'STOP',
    })).toBe('Cashew Mozzarella v1.2 reformulation');
  });

  it('preserves the built-in cheese and bread machine datasets', () => {
    const dataset = mergeInstrumentalData(null);

    expect(dataset.eTongueData.some(sample => sample.sampleId === 'S1')).toBe(true);
    expect(dataset.eTongueData.some(sample => sample.sampleId === 'B1')).toBe(true);
    expect(dataset.gcmsData.S1.length).toBeGreaterThan(0);
    expect(dataset.compositionData.B1).toBeTruthy();
  });

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

  it('categorizes yogurt styles while keeping their chart palette restrained', () => {
    const names = [
      'Coconut cultured',
      'Low sugar skyr',
      'Whole milk plain',
      'Greek strained',
      'High protein vanilla',
      'Strawberry fruit',
      'Oat cultured',
      'Lemon kefir',
    ];

    const rows = names.map((sampleName, index) => ({
      sampleId: `Y${index + 1}`,
      sampleName,
      foodType: 'yogurt',
      category: 'Yogurt',
      sourness: String(1 + index / 10),
      bitterness: '1',
      saltiness: '1',
      umami: '1',
      sweetness: '1',
    }));

    const dataset = buildImportedDataset(rows, 'yogurt-import.csv');
    const categories = dataset.eTongueData.map(sample => sample.category);
    const colors = dataset.eTongueData.map(sample => getPointColor(sample.type, sample.category));

    expect(categories).toEqual(names);
    expect(new Set(colors)).toEqual(new Set(['#0f766e']));
    expect(inferYogurtCategory('Greek strained', 'Yogurt')).toBe('Greek strained');
  });
});
