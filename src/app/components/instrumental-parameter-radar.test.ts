import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ETongueMeasurement } from './stage1-instrumental-data';
import { InstrumentalParameterRadar } from './instrumental-parameter-radar';

function sample(sampleId: string, values: number[]): ETongueMeasurement {
  const [fat, hardness, moisture, shortStretch, longStretch, extension] = values;
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
      { key: 'fat', label: 'Fat', unit: '%', mean: fat, observationCount: 3 },
      { key: 'hardness', label: 'Hardness', unit: 'g', mean: hardness, observationCount: 3 },
      { key: 'moisture', label: 'Moisture', unit: '%', mean: moisture, observationCount: 3 },
      { key: 'stretch-2-5', label: 'Stretchability 2 mm to 5 mm', unit: 'responses', mean: shortStretch, observationCount: 3 },
      { key: 'stretch-5-10', label: 'Stretchability 5 mm to 10 mm', unit: 'responses', mean: longStretch, observationCount: 3 },
      { key: 'extension', label: 'Extension force', unit: 'gf', mean: extension, observationCount: 3 },
    ],
  };
}

describe('InstrumentalParameterRadar', () => {
  it('announces and renders the automatically selected radar and bar views', () => {
    const markup = renderToStaticMarkup(createElement(InstrumentalParameterRadar, {
      samples: [
        sample('Prototype A', [20, 4_000, 48, 2, 5, -20]),
        sample('Prototype B', [24, 5_000, 51, 4, 3, -10]),
      ],
      selectedSampleIds: ['Prototype A', 'Prototype B'],
      compareMode: true,
      selectedColor: '#2563eb',
    }));

    expect(markup).toContain('2 views · 6 parameters');
    expect(markup).toContain('Recommended');
    expect(markup).toContain('Build your own');
    expect(markup).toContain('Best-fit views based on parameter type, scale, and available replicate evidence.');
    expect(markup).toContain('Curated for a useful first read.');
    expect(markup).not.toContain('What stands out');
    expect(markup).not.toContain('Top 4 differences');
    expect(markup).not.toContain('This is an internal comparison, not an external target.');
    expect(markup).toContain('Recommended radar profile');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Radar parameters');
    expect(markup.match(/role="checkbox"/g)).toHaveLength(3);
    expect(markup).toContain('Parameter-specific charts');
    expect(markup).not.toContain('Precise parameter comparison');
    expect(markup).not.toContain('Explore parameter relationships');
    expect(markup).not.toContain('Radar overview');
    expect(markup).not.toContain('Positive continuous measurements can be compared fairly');
    expect(markup).not.toContain('Administrator override');
    expect(markup).toContain('Why this chart?');
    expect(markup).toContain('Range distribution');
    expect(markup).toContain('Share of responses within each sample');
    expect(markup).toContain('Direct scale');
    expect(markup).toContain('Stretchability 2 mm to 5 mm');
    expect(markup).toContain('Extension force');
  });
});
