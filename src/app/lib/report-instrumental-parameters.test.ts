import { describe, expect, it } from 'vitest';
import type { InstrumentalDataset } from './database';
import { collectReportInstrumentalParameters } from './report-instrumental-parameters';

const dataset: InstrumentalDataset = {
  eTongueData: [{
    sampleId: 'sample-1',
    sampleName: 'Pilot sample',
    sourness: 1,
    bitterness: 2,
    saltiness: 3,
    umami: 4,
    sweetness: 5,
    hasETongueData: true,
    measurements: [{
      key: 'hardness-g',
      label: 'Hardness',
      unit: 'g',
      mean: 1240,
      observationCount: 4,
      standardDeviation: 84,
      minimum: 1110,
      maximum: 1360,
      replicateValues: [1110, 1220, 1270, 1360],
      metadata: {
        dataType: 'continuous',
        scaleType: 'ratio',
        zeroMeaningful: true,
        direction: 'lower',
        expectedMinimum: 1000,
        expectedMaximum: 1300,
        source: 'declared',
      },
      chartPreference: 'box',
    }],
  }],
  gcmsData: {},
  compositionData: {
    'sample-1': { protein: 8, fat: 24, moisture: 50, pH: 5.2, saltContent: 1.8, calciumMg: 120 },
  },
};

describe('report instrumental parameter normalization', () => {
  it('preserves arbitrary measurements, units, replicate evidence, metadata, and range status', () => {
    const parameters = collectReportInstrumentalParameters(dataset, 'sample-1');
    const hardness = parameters.find(parameter => parameter.key === 'hardness-g');

    expect(hardness).toMatchObject({
      family: 'texture_rheology',
      source: 'imported_parameter',
      unit: 'g',
      mean: 1240,
      observationCount: 4,
      standardDeviation: 84,
      minimum: 1110,
      maximum: 1360,
      replicateValues: [1110, 1220, 1270, 1360],
      chartPreference: 'box',
      status: 'within_expected_range',
    });
  });

  it('retains legacy taste and composition measurements in the same contract', () => {
    const parameters = collectReportInstrumentalParameters(dataset, 'sample-1');

    expect(parameters.some(parameter => parameter.key === 'umami' && parameter.source === 'e_tongue')).toBe(true);
    expect(parameters.some(parameter => parameter.key === 'moisture' && parameter.source === 'composition')).toBe(true);
    expect(new Set(parameters.map(parameter => parameter.id)).size).toBe(parameters.length);
  });

  it('does not invent legacy E-tongue rows for a generic-only import', () => {
    const genericOnly: InstrumentalDataset = {
      ...dataset,
      eTongueData: [{
        ...dataset.eTongueData[0],
        hasETongueData: false,
        measurements: dataset.eTongueData[0].measurements,
      }],
      compositionData: {},
    };

    const parameters = collectReportInstrumentalParameters(genericOnly, 'sample-1');
    expect(parameters.map(parameter => parameter.key)).toEqual(['hardness-g']);
  });
});
