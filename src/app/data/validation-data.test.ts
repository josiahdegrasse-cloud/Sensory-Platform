import { describe, expect, it } from 'vitest';
import { METHOD_COMPARISON, VALIDATION_DATASET } from './validation-data';

describe('decision validation snapshot', () => {
  it('keeps reported agreement synchronized with the sample-level decisions', () => {
    const agreement = VALIDATION_DATASET.filter(record =>
      record.issfDecision === record.trainedPanelDecision && record.agreement
    ).length / VALIDATION_DATASET.length;
    expect(METHOD_COMPARISON.accuracy).toBeCloseTo(agreement, 3);
  });

  it('keeps every stored delta reproducible from the paired scores', () => {
    VALIDATION_DATASET.forEach(record => {
      expect(record.delta).toBeCloseTo(
        Math.abs(record.issfScore - record.trainedPanelScore),
        2,
      );
      expect(record.agreement).toBe(record.issfDecision === record.trainedPanelDecision);
    });
  });
});
