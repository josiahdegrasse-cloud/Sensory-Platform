import { describe, expect, it } from 'vitest';
import {
  generateBlindCode,
  getPanelistSampleOrder,
  isValidBlindCode,
  withBlindSampleCodes,
} from './blind-study';

describe('blind-study utilities', () => {
  it('generates stable unique 3-digit codes', () => {
    const code = generateBlindCode('study-a');
    expect(isValidBlindCode(code)).toBe(true);
    expect(generateBlindCode('study-a')).toBe(code);
    expect(generateBlindCode('study-a', [code])).not.toBe(code);
  });

  it('preserves valid unique sample codes and fills missing or duplicate codes', () => {
    const coded = withBlindSampleCodes([
      { id: 'a', code: '123', label: 'Alpha' },
      { id: 'b', code: '', label: 'Beta' },
      { id: 'c', code: '123', label: 'Gamma' },
      { id: 'd', code: 'abc', label: 'Delta' },
    ], 'study-1');

    expect(coded[0].code).toBe('123');
    expect(new Set(coded.map(sample => sample.code)).size).toBe(coded.length);
    expect(coded.every(sample => isValidBlindCode(sample.code))).toBe(true);
  });

  it('creates deterministic per-panelist sample orders', () => {
    const samples = [
      { id: 'a', code: '101', label: 'Alpha' },
      { id: 'b', code: '202', label: 'Beta' },
      { id: 'c', code: '303', label: 'Gamma' },
      { id: 'd', code: '404', label: 'Delta' },
    ];
    const first = getPanelistSampleOrder('product-1', 'panelist-1', samples).map(sample => sample.code);
    const second = getPanelistSampleOrder('product-1', 'panelist-1', samples).map(sample => sample.code);
    const otherPanelist = getPanelistSampleOrder('product-1', 'panelist-2', samples).map(sample => sample.code);

    expect(second).toEqual(first);
    expect(new Set(first)).toEqual(new Set(samples.map(sample => sample.code)));
    expect(otherPanelist).not.toEqual(first);
  });
});
