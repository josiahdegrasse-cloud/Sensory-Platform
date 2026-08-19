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
import { applyImportMappings, inferImportMappings } from '../lib/csv-import-mapping';

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
        ingredientStatement: 'Water, pea protein, rapeseed oil, salt',
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
        ingredientStatement: 'Water, pea protein, coconut oil, natural flavouring',
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
    expect(dataset.ingredientStatements.M1).toMatchObject({
      text: 'Water, pea protein, rapeseed oil, salt',
      source: 'csv_import',
    });
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

  it('imports one mean profile per formulation instead of one product per replicate row', () => {
    const rows = [
      {
        formulationId: 'F-01', formulationName: 'Full fat v1', sampleId: 'F-01-A', foodType: 'yogurt',
        sourness: '1', sweetness: '5', fat: '10', protein: '4', compound: 'Diacetyl', concentration: '2', threshold: '1',
      },
      {
        formulationId: 'F-01', formulationName: 'Full fat v1', sampleId: 'F-01-A', foodType: 'yogurt',
        sourness: '1', sweetness: '5', fat: '10', protein: '4', compound: 'Diacetyl', concentration: '4', threshold: '1',
      },
      {
        formulationId: 'F-01', formulationName: 'Full fat v1', sampleId: 'F-01-B', foodType: 'yogurt',
        sourness: '3', sweetness: '7', fat: '20', protein: '6', compound: 'Diacetyl', concentration: '5', threshold: '3',
      },
      {
        formulationId: 'F-02', formulationName: 'Low fat v2', sampleId: 'F-02-A', foodType: 'yogurt',
        sourness: '4', sweetness: '3', fat: '5', protein: '8', compound: 'Acetaldehyde', concentration: '6', threshold: '2',
      },
    ];

    const dataset = buildImportedDataset(rows, 'yogurt-formulations.csv');

    expect(dataset.eTongueData).toHaveLength(2);
    expect(dataset.eTongueData[0]).toMatchObject({
      sampleId: 'F-01',
      sampleName: 'Full fat v1',
      sourness: 2,
      sweetness: 6,
    });
    expect(dataset.compositionData['F-01']).toMatchObject({ fat: 15, protein: 5 });
    expect(dataset.gcmsData['F-01'][0]).toMatchObject({
      name: 'Diacetyl',
      concentration: 4,
      threshold: 2,
    });
    expect(dataset.aggregation).toEqual({
      groupedByFormulation: true,
      sourceRowCount: 4,
      sourceSampleCount: 3,
      formulationCount: 2,
      averagedFormulationCount: 1,
    });
  });

  it('averages every populated workbook measurement by repeated formulation name', () => {
    const rawRows = [
      { Name: 'Cheddar ref', Type: 'Cheese', 'Fat (%)': '20', 'Moisture (%)': '40', 'Melting (cm)': '6', 'Hardness (g)': '100' },
      { Name: 'Cheddar ref', Type: 'Cheese', 'Fat (%)': '30', 'Moisture (%)': '', 'Melting (cm)': '8', 'Hardness (g)': '200' },
      { Name: 'Cheddar ref', Type: 'Cheese', 'Fat (%)': '', 'Moisture (%)': '44', 'Melting (cm)': '', 'Hardness (g)': '300' },
      { Name: 'Mozza ref', Type: 'Cheese', 'Fat (%)': '10', 'Moisture (%)': '50', 'Melting (cm)': '4', 'Hardness (g)': '50' },
      { Name: 'Mozza ref', Type: 'Cheese', 'Fat (%)': '14', 'Moisture (%)': '54', 'Melting (cm)': '6', 'Hardness (g)': '70' },
    ];
    const mappings = inferImportMappings(Object.keys(rawRows[0]));
    const dataset = buildImportedDataset(applyImportMappings(rawRows, mappings), 'Samples_test.xlsx');

    expect(dataset.eTongueData).toHaveLength(2);
    expect(dataset.aggregation).toMatchObject({
      groupedByFormulation: true,
      sourceRowCount: 5,
      sourceSampleCount: 5,
      formulationCount: 2,
    });
    const cheddar = dataset.eTongueData.find(sample => sample.sampleId === 'Cheddar ref');
    expect(cheddar).toMatchObject({ sampleName: 'Cheddar ref', hasETongueData: false });
    expect(cheddar?.measurements).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Fat', unit: '%', mean: 25, observationCount: 2 }),
      expect.objectContaining({ label: 'Moisture', unit: '%', mean: 42, observationCount: 2 }),
      expect.objectContaining({ label: 'Melting', unit: 'cm', mean: 7, observationCount: 2 }),
      expect.objectContaining({ label: 'Hardness', unit: 'g', mean: 200, observationCount: 3 }),
    ]));
  });
});
