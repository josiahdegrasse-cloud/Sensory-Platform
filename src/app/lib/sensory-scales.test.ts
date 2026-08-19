import { describe, expect, it } from 'vitest';
import {
  intensityScalePercentage,
  toNinePointIntensity,
} from './sensory-scales';

describe('sensory intensity scales', () => {
  it('keeps live 1–9 panel responses unchanged', () => {
    expect(toNinePointIntensity(1, 9)).toBe(1);
    expect(toNinePointIntensity(5, 9)).toBe(5);
    expect(toNinePointIntensity(9, 9)).toBe(9);
  });

  it('maps legacy 0–10 reference values onto the 1–9 frame', () => {
    expect(toNinePointIntensity(0, 10)).toBe(1);
    expect(toNinePointIntensity(5, 10)).toBe(5);
    expect(toNinePointIntensity(10, 10)).toBe(9);
  });

  it('positions the scale endpoints and midpoint correctly', () => {
    expect(intensityScalePercentage(1)).toBe(0);
    expect(intensityScalePercentage(5)).toBe(50);
    expect(intensityScalePercentage(9)).toBe(100);
  });
});
