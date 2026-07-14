import { describe, expect, it } from 'vitest';
import type { InstrumentalDataset } from './database';
import {
  buildImportedSensoryProfiles,
  findSensoryEvidenceProfile,
} from './sensory-evidence-profile';

const dataset: InstrumentalDataset = {
  eTongueData: [{
    sampleId: 'IMP-1',
    sampleName: 'Golden Crisp Snack',
    sourness: 1.2,
    bitterness: 0.8,
    saltiness: 3.4,
    umami: 2.1,
    sweetness: 1.8,
    type: 'snack',
  }],
  compositionData: {
    'IMP-1': {
      protein: 8.5,
      fat: 18.2,
      moisture: 8.1,
      pH: 6.3,
      saltContent: 1.4,
      calciumMg: 20,
    },
  },
  gcmsData: {
    'IMP-1': [{
      name: '2-Acetyl-1-pyrroline',
      concentration: 1.6,
      aroma: 'toasted',
      threshold: 0.8,
    }],
  },
};

describe('sensory evidence profile helpers', () => {
  it('reconstructs an enhanced profile from imported instruments and live panel aggregation', () => {
    const profiles = buildImportedSensoryProfiles(dataset, [{
      sourceSampleId: 'IMP-1',
      productName: 'Golden Crisp Snack',
      n: 15,
      cata: { Crunchy: 12, Toasted: 10 },
      intensity: { crunchy: 4.6, toasted: 4.2 },
      hedonic: { overall: 7.2, appearance: 7.0, flavor: 7.4, texture: 7.3 },
      emotions: { positive: 4.1, negative: 0.7 },
    }], { minimumResponses: 12 });

    expect(profiles).toHaveLength(1);
    expect(profiles[0].panelN).toBe(15);
    expect(profiles[0].hedonic.flavour).toBe(7.4);
    expect(profiles[0].composition.salt).toBe(1.4);
    expect(profiles[0].evidence).toMatchObject({
      provenance: 'imported',
      aromaMethod: 'gc-ms',
      compositionMeasured: true,
      instrumentQcMeasured: false,
    });
    expect(profiles[0].taste.richness).toBe(0);
    expect(profiles[0].taste.bitternessAftertaste).toBe(0);
    expect(profiles[0].gcmsOlfactometry[0]).toMatchObject({
      compound: '2-Acetyl-1-pyrroline',
      odour: 'toasted',
      odourIntensity: 0,
    });
    expect(findSensoryEvidenceProfile(profiles, { sampleName: 'Golden Crisp Snack' })?.sampleId).toBe('IMP-1');
  });

  it('does not create panel evidence below the configured decision threshold', () => {
    const profiles = buildImportedSensoryProfiles(dataset, [{
      sourceSampleId: 'IMP-1',
      productName: 'Golden Crisp Snack',
      n: 4,
      cata: { Crunchy: 3 },
      intensity: { crunchy: 4.1 },
      hedonic: { overall: 6.8, appearance: 6.7, flavor: 6.9, texture: 6.8 },
      emotions: { positive: 3.5, negative: 1.2 },
    }], { minimumResponses: 12 });

    expect(profiles).toEqual([]);
  });
});
