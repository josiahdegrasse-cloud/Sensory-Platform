import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildInstrumentalParameterRadarModel } from '../lib/instrumental-parameter-chart';
import type { ETongueMeasurement } from './stage1-instrumental-data';
import { InstrumentalBoxPlots } from './instrumental-parameter-box-plots';

function sample(sampleId: string, hardness: number[], moisture: number[]): ETongueMeasurement {
  return {
    sampleId,
    sampleName: sampleId,
    sourness: 0,
    bitterness: 0,
    saltiness: 0,
    umami: 0,
    sweetness: 0,
    hasETongueData: false,
    measurements: [
      { key: 'hardness', label: 'Hardness', unit: 'g', mean: hardness.reduce((sum, value) => sum + value, 0) / hardness.length, observationCount: hardness.length, replicateValues: hardness },
      { key: 'moisture', label: 'Moisture', unit: '%', mean: moisture.reduce((sum, value) => sum + value, 0) / moisture.length, observationCount: moisture.length, replicateValues: moisture },
    ],
  };
}

describe('InstrumentalBoxPlots', () => {
  it('consolidates multiple parameters into one comparison view', () => {
    const samples = [
      sample('Prototype A', [90, 95, 105, 110], [47, 48, 49, 50]),
      sample('Prototype B', [110, 115, 125, 130], [50, 51, 52, 53]),
    ];
    const model = buildInstrumentalParameterRadarModel({
      samples,
      selectedSampleIds: samples.map(item => item.sampleId),
      selectedParameterKeys: ['hardness', 'moisture'],
    });
    const markup = renderToStaticMarkup(createElement(InstrumentalBoxPlots, {
      axes: model.axes,
      series: [
        { sampleId: 'Prototype A', name: 'Prototype A', color: '#2563eb' },
        { sampleId: 'Prototype B', name: 'Prototype B', color: '#7c3aed' },
      ],
    }));

    expect(markup).toContain('Selected parameters are consolidated into one comparison view');
    expect(markup).toContain('Hardness');
    expect(markup).toContain('Moisture');
    expect(markup.match(/id="replicate-distribution-heading"/g)).toHaveLength(1);
    expect(markup).not.toContain('Why this chart?');
  });
});
