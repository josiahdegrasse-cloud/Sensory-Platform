import { describe, expect, it } from 'vitest';
import { cataPrevalenceInterval, studentTCritical95 } from './survey-analysis-tabs';

describe('sensory descriptive intervals', () => {
  it('reports a bounded CATA prevalence interval without a false chance null', () => {
    const [lower, upper] = cataPrevalenceInterval(7, 10);
    expect(lower).toBeGreaterThan(0);
    expect(upper).toBeLessThanOrEqual(100);
    expect(lower).toBeLessThan(70);
    expect(upper).toBeGreaterThan(70);
  });

  it('uses a wider Student-t critical value for small panels', () => {
    expect(studentTCritical95(5)).toBe(2.776);
    expect(studentTCritical95(100)).toBe(1.96);
  });
});
