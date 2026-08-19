import { describe, expect, it } from 'vitest';
import {
  INSTRUMENTAL_COMPARISON_COLORS,
  MAX_INSTRUMENTAL_COMPARISON_SAMPLES,
  instrumentalComparisonColor,
  normaliseInstrumentalComparisonSelection,
  toggleInstrumentalComparisonSample,
} from './instrumental-comparison';

describe('instrumental sample comparison', () => {
  it('adds samples in selection order up to five', () => {
    let selected = ['sample-a'];
    for (const sampleId of ['sample-b', 'sample-c', 'sample-d', 'sample-e']) {
      selected = toggleInstrumentalComparisonSample(selected, sampleId);
    }

    expect(selected).toEqual(['sample-a', 'sample-b', 'sample-c', 'sample-d', 'sample-e']);
    expect(selected).toHaveLength(MAX_INSTRUMENTAL_COMPARISON_SAMPLES);
  });

  it('does not replace an existing sample when the five-sample limit is reached', () => {
    const selected = ['sample-a', 'sample-b', 'sample-c', 'sample-d', 'sample-e'];
    expect(toggleInstrumentalComparisonSample(selected, 'sample-f')).toEqual(selected);
  });

  it('allows selected samples to be removed but always retains one sample', () => {
    expect(toggleInstrumentalComparisonSample(['sample-a', 'sample-b'], 'sample-b')).toEqual(['sample-a']);
    expect(toggleInstrumentalComparisonSample(['sample-a'], 'sample-a')).toEqual(['sample-a']);
  });

  it('deduplicates and caps restored selections', () => {
    expect(normaliseInstrumentalComparisonSelection([
      'sample-a', 'sample-b', 'sample-a', 'sample-c', 'sample-d', 'sample-e', 'sample-f',
    ])).toEqual(['sample-a', 'sample-b', 'sample-c', 'sample-d', 'sample-e']);
  });

  it('provides a distinct chart colour for every supported comparison series', () => {
    const colors = Array.from(
      { length: MAX_INSTRUMENTAL_COMPARISON_SAMPLES },
      (_, index) => instrumentalComparisonColor(index),
    );

    expect(new Set(colors).size).toBe(MAX_INSTRUMENTAL_COMPARISON_SAMPLES);
    expect(colors).toEqual([...INSTRUMENTAL_COMPARISON_COLORS]);
  });
});
