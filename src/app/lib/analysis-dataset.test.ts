import { describe, expect, it } from 'vitest';
import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import { mergeAnalysisProfiles } from './analysis-dataset';

function profile(sampleId: string, overrides: Partial<EnhancedSensoryProfile> = {}): EnhancedSensoryProfile {
  return {
    sampleId,
    sampleName: `Sample ${sampleId}`,
    taste: {
      sourness: 1,
      bitterness: 1,
      astringency: 1,
      umami: 1,
      saltiness: 1,
      sweetness: 1,
      astringencyAftertaste: 1,
      umamiAftertaste: 1,
      bitternessAftertaste: 1,
      richness: 1,
    },
    composition: { salt: 1, fat: 1, protein: 1, starchDryMatter: 1 },
    gcmsOlfactometry: [],
    istdRecovery: 90,
    olfactometryFlowSplit: '67:33 confirmed',
    cata: { Creamy: 8 },
    intensity: { creamy: 7 },
    hedonic: { appearance: 7, flavour: 7, texture: 7, overall: 7 },
    emotions: { positive: 4, negative: 1 },
    ...overrides,
  };
}

describe('mergeAnalysisProfiles', () => {
  it('keeps reference sensory results while refreshing imported machine data', () => {
    const reference = profile('S1');
    const imported = profile('S1', {
      sampleName: 'Imported cheddar',
      taste: { ...reference.taste, sweetness: 6 },
      composition: { ...reference.composition, protein: 12 },
      hedonic: { appearance: 0, flavour: 0, texture: 0, overall: 0 },
      cata: {},
      emotions: { positive: 0, negative: 0 },
      olfactometryFlowSplit: 'Imported CSV',
    });

    const [merged] = mergeAnalysisProfiles([reference], [imported]);

    expect(merged.sampleName).toBe('Imported cheddar');
    expect(merged.taste.sweetness).toBe(6);
    expect(merged.composition.protein).toBe(12);
    expect(merged.hedonic.overall).toBe(7);
    expect(merged.cata).toEqual({ Creamy: 8 });
    expect(merged.emotions.positive).toBe(4);
  });

  it('retains all reference samples and appends newly imported food samples', () => {
    const merged = mergeAnalysisProfiles(
      [profile('S1'), profile('B1')],
      [profile('M1', { sampleName: 'Plant burger' })],
    );

    expect(merged.map(item => item.sampleId)).toEqual(['S1', 'B1', 'M1']);
  });
});
