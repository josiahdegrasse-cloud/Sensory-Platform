import { describe, expect, it } from 'vitest';
import { analyzeFormulationExperiment } from './experiment-analysis';

const arms = [
  { id: 'control', code: 'C0', label: 'Control', armType: 'control' as const },
  { id: 'variant', code: 'V1', label: 'Variant', armType: 'variant' as const },
];

describe('analyzeFormulationExperiment', () => {
  it('is deterministic and recommends a clearly superior independent variant', () => {
    const evaluations = Array.from({ length: 20 }, (_, index) => [
      { armId: 'control', participantKey: `c-${index}`, primaryScore: 60 + (index % 3) },
      { armId: 'variant', participantKey: `v-${index}`, primaryScore: 72 + (index % 3) },
    ]).flat();
    const first = analyzeFormulationExperiment({
      arms,
      evaluations,
      mode: 'independent',
      minimumN: 12,
      uncertaintyMargin: 2,
      seed: 17,
      iterations: 2000,
    });
    const second = analyzeFormulationExperiment({
      arms,
      evaluations,
      mode: 'independent',
      minimumN: 12,
      uncertaintyMargin: 2,
      seed: 17,
      iterations: 2000,
    });

    expect(first).toEqual(second);
    expect(first.recommendedWinnerArmId).toBe('variant');
    expect(first.arms[1].confidenceInterval[0]).toBeGreaterThan(2);
  });

  it('uses matched participants for paired analysis', () => {
    const evaluations = Array.from({ length: 14 }, (_, index) => [
      { armId: 'control', participantKey: `p-${index}`, primaryScore: 65 + (index % 2) },
      { armId: 'variant', participantKey: `p-${index}`, primaryScore: 69 + (index % 2) },
    ]).flat();
    evaluations.push({ armId: 'variant', participantKey: 'unmatched', primaryScore: 100 });

    const result = analyzeFormulationExperiment({
      arms,
      evaluations,
      mode: 'paired',
      minimumN: 12,
      uncertaintyMargin: 1,
      iterations: 2000,
    });

    expect(result.arms[1].n).toBe(14);
    expect(result.arms[1].liftVersusControl).toBe(4);
    expect(result.warnings.some(warning => warning.includes('matched C0 pairs'))).toBe(true);
  });
});
