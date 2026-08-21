import { describe, expect, it } from 'vitest';
import {
  applyInstrumentalChartPreference,
  inferInstrumentalParameterMetadata,
  isInstrumentalRangeBand,
  parseInstrumentalChartPreference,
  parseInstrumentalParameterMetadata,
} from './instrumental-parameter-metadata';

describe('instrumental parameter metadata', () => {
  it('classifies range bands, signed measures, proportions, counts, and bounded pH', () => {
    expect(isInstrumentalRangeBand('Stretchability 2 mm to 5 mm')).toBe(true);
    expect(inferInstrumentalParameterMetadata({ label: 'Stretchability 2 mm to 5 mm', unit: 'responses' })).toMatchObject({
      dataType: 'range-band',
      scaleType: 'bounded',
    });
    expect(inferInstrumentalParameterMetadata({ label: 'Adhesiveness', unit: 'g·s' })).toMatchObject({
      dataType: 'continuous',
      scaleType: 'diverging',
    });
    expect(inferInstrumentalParameterMetadata({ label: 'Fat', unit: '%' })).toMatchObject({
      dataType: 'proportion',
      expectedMinimum: 0,
      expectedMaximum: 100,
    });
    expect(inferInstrumentalParameterMetadata({ label: 'Response count', unit: 'n' })).toMatchObject({
      dataType: 'count',
      zeroMeaningful: true,
    });
    expect(inferInstrumentalParameterMetadata({ label: 'pH', unit: '' })).toMatchObject({
      scaleType: 'bounded',
      expectedMaximum: 14,
    });
  });

  it('accepts declared metadata defensively and rejects unsupported preferences', () => {
    const fallback = inferInstrumentalParameterMetadata({ label: 'Hardness', unit: 'g' });
    expect(parseInstrumentalParameterMetadata({
      dataType: 'continuous',
      scaleType: 'interval',
      zeroMeaningful: false,
      direction: 'lower',
      source: 'declared',
    }, fallback)).toMatchObject({
      scaleType: 'interval',
      direction: 'lower',
      source: 'declared',
    });
    expect(parseInstrumentalChartPreference('box')).toBe('box');
    expect(parseInstrumentalChartPreference('dot')).toBe('auto');
    expect(parseInstrumentalChartPreference('pie')).toBe('auto');
  });

  it('applies and clears saved chart preferences without changing unrelated metrics', () => {
    const source = [
      { key: 'hardness', mean: 120 },
      { key: 'fat', mean: 20, chartPreference: 'bar' },
    ];
    expect(applyInstrumentalChartPreference(source, 'hardness', 'box')).toEqual({
      matched: true,
      metrics: [
        { key: 'hardness', mean: 120, chartPreference: 'box' },
        { key: 'fat', mean: 20, chartPreference: 'bar' },
      ],
    });
    expect(applyInstrumentalChartPreference(source, 'fat', 'auto')).toEqual({
      matched: true,
      metrics: [
        { key: 'hardness', mean: 120 },
        { key: 'fat', mean: 20 },
      ],
    });
  });
});
