import { describe, expect, it } from 'vitest';
import type { ETongueMeasurement } from '../components/stage1-instrumental-data';
import {
  buildInstrumentalParameterRadarModel,
  collectInstrumentalParameters,
} from './instrumental-parameter-chart';

function sample(
  sampleId: string,
  measurements: ETongueMeasurement['measurements'],
): ETongueMeasurement {
  return {
    sampleId,
    sampleName: sampleId,
    sourness: 0,
    bitterness: 0,
    saltiness: 0,
    umami: 0,
    sweetness: 0,
    hasETongueData: false,
    measurements,
  };
}

describe('instrumental parameter radar model', () => {
  const samples = [
    sample('Cheddar ref', [
      { key: 'fat', label: 'Fat', unit: '%', mean: 25, observationCount: 45 },
      { key: 'hardness-g', label: 'Hardness', unit: 'g', mean: 6000, observationCount: 45 },
      { key: 'extension', label: 'Extension', unit: 'gf', mean: -20, observationCount: 45 },
    ]),
    sample('Mozza ref', [
      { key: 'fat', label: 'Fat', unit: '%', mean: 20, observationCount: 45 },
      { key: 'hardness-g', label: 'Hardness', unit: 'g', mean: 3000, observationCount: 45 },
      { key: 'extension', label: 'Extension', unit: 'gf', mean: -10, observationCount: 45 },
    ]),
  ];

  it('collects every imported numeric parameter once and preserves its unit', () => {
    expect(collectInstrumentalParameters(samples)).toEqual([
      { key: 'fat', label: 'Fat', unit: '%' },
      { key: 'hardness-g', label: 'Hardness', unit: 'g' },
      { key: 'extension', label: 'Extension', unit: 'gf' },
    ]);
  });

  it('normalizes unlike units for plotting while retaining raw values and observation counts', () => {
    const model = buildInstrumentalParameterRadarModel({
      samples,
      selectedSampleIds: ['Cheddar ref', 'Mozza ref'],
      selectedParameterKeys: ['fat', 'hardness-g', 'extension'],
    });

    expect(model.axes[0].values['Cheddar ref']).toEqual({
      raw: 25,
      normalized: 100,
      observationCount: 45,
    });
    expect(model.axes[0].values['Mozza ref']?.normalized).toBe(80);
    expect(model.axes[1].values['Mozza ref']?.normalized).toBe(50);
    expect(model.axes[2].values['Cheddar ref']?.normalized).toBe(0);
    expect(model.axes[2].values['Mozza ref']?.normalized).toBe(100);
  });

  it('omits deselected parameters and parameters missing from every active sample', () => {
    const model = buildInstrumentalParameterRadarModel({
      samples,
      selectedSampleIds: ['Cheddar ref'],
      selectedParameterKeys: ['fat'],
    });

    expect(model.axes.map(axis => axis.key)).toEqual(['fat']);
  });
});
