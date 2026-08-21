import { describe, expect, it } from 'vitest';
import type { ETongueMeasurement } from '../components/stage1-instrumental-data';
import {
  buildInstrumentalParameterRadarModel,
  collectInstrumentalParameters,
  instrumentalAxisSupportsBuildChart,
  instrumentalPearsonCorrelation,
  instrumentalParameterChartKind,
  isInstrumentalRangeBand,
  learnInstrumentalParameterRelationships,
  orderInstrumentalAxesByBuildAvailability,
  orderInstrumentalAxesByRelationships,
  recommendInstrumentalChart,
  selectRecommendedBoxPlotAxes,
  summarizeInstrumentalDistribution,
} from './instrumental-parameter-chart';

function sample(
  sampleId: string,
  measurements: ETongueMeasurement['measurements'],
): ETongueMeasurement {
  return {
    sampleId,
    sampleName: sampleId,
    sourness: 0,
    bitterness: 0,
    saltiness: 0,
    umami: 0,
    sweetness: 0,
    hasETongueData: false,
    measurements,
  };
}

describe('instrumental parameter radar model', () => {
  const samples = [
    sample('Cheddar ref', [
      { key: 'fat', label: 'Fat', unit: '%', mean: 25, observationCount: 45 },
      { key: 'hardness-g', label: 'Hardness', unit: 'g', mean: 6000, observationCount: 45 },
      { key: 'extension', label: 'Extension', unit: 'gf', mean: -20, observationCount: 45 },
    ]),
    sample('Mozza ref', [
      { key: 'fat', label: 'Fat', unit: '%', mean: 20, observationCount: 45 },
      { key: 'hardness-g', label: 'Hardness', unit: 'g', mean: 3000, observationCount: 45 },
      { key: 'extension', label: 'Extension', unit: 'gf', mean: -10, observationCount: 45 },
    ]),
  ];

  it('collects every imported numeric parameter once and preserves its unit', () => {
    expect(collectInstrumentalParameters(samples)).toEqual([
      expect.objectContaining({ key: 'fat', label: 'Fat', unit: '%', metadata: expect.objectContaining({ dataType: 'proportion' }) }),
      expect.objectContaining({ key: 'hardness-g', label: 'Hardness', unit: 'g', metadata: expect.objectContaining({ dataType: 'continuous' }) }),
      expect.objectContaining({ key: 'extension', label: 'Extension', unit: 'gf', metadata: expect.objectContaining({ dataType: 'continuous' }) }),
    ]);
  });

  it('routes range bands and raw-only values to bars while keeping comparable measures on the radar', () => {
    expect(isInstrumentalRangeBand('Stretchability 2mm to 5 mm')).toBe(true);
    expect(isInstrumentalRangeBand('Stretchability over 20 mm')).toBe(true);
    expect(isInstrumentalRangeBand('Hardness')).toBe(false);
    expect(instrumentalParameterChartKind({
      label: 'Stretchability 2mm to 5 mm',
      scale: { minimum: 1, maximum: 4, mean: 2.5, sampleCount: 2, hasVariation: true, method: 'project-mean-deviation' },
    })).toBe('bar');
    expect(instrumentalParameterChartKind({
      label: 'Extension force',
      scale: { minimum: -20, maximum: -10, mean: -15, sampleCount: 2, hasVariation: true, method: 'raw-only' },
    })).toBe('bar');
    expect(instrumentalParameterChartKind({
      label: 'Hardness',
      scale: { minimum: 3_000, maximum: 6_000, mean: 4_500, sampleCount: 2, hasVariation: true, method: 'project-mean-deviation' },
    })).toBe('radar');
  });

  it('compares positive measures with their project mean while retaining raw evidence', () => {
    const model = buildInstrumentalParameterRadarModel({
      samples,
      selectedSampleIds: ['Cheddar ref', 'Mozza ref'],
      selectedParameterKeys: ['fat', 'hardness-g', 'extension'],
    });

    expect(model.axes[0].values['Cheddar ref']).toMatchObject({
      raw: 25,
      deviationFromProjectMean: ((25 - 22.5) / 22.5) * 100,
      observationCount: 45,
    });
    expect(model.axes[0].values['Mozza ref']?.deviationFromProjectMean).toBeCloseTo(((20 - 22.5) / 22.5) * 100);
    expect(model.axes[1].values['Mozza ref']?.deviationFromProjectMean).toBeCloseTo(((3000 - 4500) / 4500) * 100);
    expect(model.axes[2].values['Cheddar ref']?.deviationFromProjectMean).toBeNull();
    expect(model.axes[2].values['Mozza ref']?.deviationFromProjectMean).toBeNull();
    expect(model.axes[0].scale).toEqual({
      minimum: 20,
      maximum: 25,
      mean: 22.5,
      sampleCount: 2,
      hasVariation: true,
      method: 'project-mean-deviation',
    });
    expect(model.axes[2].scale.method).toBe('raw-only');
    expect(model.projectSampleCount).toBe(2);
  });

  it('omits deselected parameters and parameters missing from every active sample', () => {
    const model = buildInstrumentalParameterRadarModel({
      samples,
      selectedSampleIds: ['Cheddar ref'],
      selectedParameterKeys: ['fat'],
    });

    expect(model.axes.map(axis => axis.key)).toEqual(['fat']);
  });

  it('uses every project sample to set the average, not only the compared samples', () => {
    const projectSamples = [10, 20, 30].map((mean, index) => sample(`Prototype ${index + 1}`, [
      { key: 'protein', label: 'Protein', unit: '%', mean, observationCount: 6 },
    ]));
    const model = buildInstrumentalParameterRadarModel({
      samples: projectSamples,
      selectedSampleIds: ['Prototype 1', 'Prototype 2'],
      selectedParameterKeys: ['protein'],
    });

    expect(model.axes[0].scale.mean).toBe(20);
    expect(model.axes[0].values['Prototype 1']?.deviationFromProjectMean).toBe(-50);
    expect(model.axes[0].values['Prototype 2']?.deviationFromProjectMean).toBe(0);
    expect(model.projectSampleCount).toBe(3);
  });

  it('shows a constant positive measure at exactly the project average', () => {
    const constantSamples = [
      sample('Prototype A', [
        { key: 'moisture', label: 'Moisture', unit: '%', mean: 48, observationCount: 12 },
      ]),
      sample('Prototype B', [
        { key: 'moisture', label: 'Moisture', unit: '%', mean: 48, observationCount: 9 },
      ]),
    ];
    const model = buildInstrumentalParameterRadarModel({
      samples: constantSamples,
      selectedSampleIds: ['Prototype A', 'Prototype B'],
      selectedParameterKeys: ['moisture'],
    });

    expect(model.axes[0].scale).toEqual({
      minimum: 48,
      maximum: 48,
      mean: 48,
      sampleCount: 2,
      hasVariation: false,
      method: 'project-mean-deviation',
    });
    expect(model.axes[0].values['Prototype A']?.deviationFromProjectMean).toBe(0);
    expect(model.axes[0].values['Prototype B']?.deviationFromProjectMean).toBe(0);
  });

  it('treats non-finite and missing active measurements as unavailable evidence', () => {
    const incompleteSamples = [
      sample('Prototype A', [
        { key: 'fat', label: 'Fat', unit: '%', mean: 20, observationCount: 8 },
        { key: 'hardness', label: 'Hardness', unit: 'g', mean: Number.NaN, observationCount: 8 },
      ]),
      sample('Prototype B', [
        { key: 'fat', label: 'Fat', unit: '%', mean: 25, observationCount: 8 },
        { key: 'hardness', label: 'Hardness', unit: 'g', mean: 4000, observationCount: 8 },
      ]),
    ];
    const model = buildInstrumentalParameterRadarModel({
      samples: incompleteSamples,
      selectedSampleIds: ['Prototype A', 'Prototype B'],
      selectedParameterKeys: ['fat', 'hardness'],
    });

    expect(model.axes.find(axis => axis.key === 'hardness')?.values).toMatchObject({
      'Prototype A': null,
      'Prototype B': {
        raw: 4000,
        deviationFromProjectMean: 0,
        observationCount: 8,
      },
    });
  });

  it('prefers box plots when replicate evidence exists and honours valid administrator overrides', () => {
    const model = buildInstrumentalParameterRadarModel({
      samples: [
        sample('Prototype A', [{ key: 'hardness', label: 'Hardness', unit: 'g', mean: 100, observationCount: 4, replicateValues: [90, 95, 105, 110] }]),
        sample('Prototype B', [{ key: 'hardness', label: 'Hardness', unit: 'g', mean: 120, observationCount: 4, replicateValues: [110, 115, 125, 130] }]),
      ],
      selectedSampleIds: ['Prototype A', 'Prototype B'],
      selectedParameterKeys: ['hardness'],
    });
    const axis = model.axes[0];

    expect(recommendInstrumentalChart(axis)).toMatchObject({ primaryChart: 'box', radarEligible: true });
    expect(recommendInstrumentalChart(axis, 'bar')).toMatchObject({ primaryChart: 'bar', radarEligible: false, source: 'admin-override' });
    expect(summarizeInstrumentalDistribution([90, 95, 105, 110])).toEqual({
      minimum: 90,
      lowerQuartile: 93.75,
      median: 100,
      upperQuartile: 106.25,
      maximum: 110,
    });
    expect(instrumentalAxisSupportsBuildChart(axis, 'radar')).toBe(true);
    expect(instrumentalAxisSupportsBuildChart(axis, 'bar')).toBe(true);
    expect(instrumentalAxisSupportsBuildChart(axis, 'box')).toBe(true);

    const candidates = Array.from({ length: 8 }, (_, index) => ({
      ...axis,
      key: `hardness-${index}`,
      label: `Hardness ${index}`,
    }));
    expect(selectRecommendedBoxPlotAxes(candidates)).toHaveLength(4);
  });

  it('keeps custom chart choices within scientifically compatible parameter types', () => {
    const model = buildInstrumentalParameterRadarModel({
      samples,
      selectedSampleIds: ['Cheddar ref', 'Mozza ref'],
      selectedParameterKeys: ['fat', 'extension'],
    });
    const fat = model.axes.find(axis => axis.key === 'fat')!;
    const extension = model.axes.find(axis => axis.key === 'extension')!;

    expect(instrumentalAxisSupportsBuildChart(fat, 'radar')).toBe(true);
    expect(instrumentalAxisSupportsBuildChart(extension, 'radar')).toBe(false);
    expect(instrumentalAxisSupportsBuildChart(extension, 'bar')).toBe(true);
    expect(instrumentalAxisSupportsBuildChart(extension, 'box')).toBe(false);
    expect(orderInstrumentalAxesByBuildAvailability([extension, fat], ['radar']).map(axis => axis.key)).toEqual(['fat', 'extension']);
    expect(orderInstrumentalAxesByBuildAvailability([extension, fat], ['bar']).map(axis => axis.key)).toEqual(['extension', 'fat']);
  });

  it('calculates relationship strength only when enough varying samples exist', () => {
    expect(instrumentalPearsonCorrelation([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }])).toBeCloseTo(1);
    expect(instrumentalPearsonCorrelation([{ x: 1, y: 2 }, { x: 2, y: 4 }])).toBeNull();
    expect(instrumentalPearsonCorrelation([{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }])).toBeNull();
  });

  it('learns parameter relationships in the model and places strongly related radar axes together', () => {
    const relationshipSamples = [
      [1, 2, 9],
      [2, 4, 1],
      [3, 6, 8],
      [4, 8, 3],
    ].map(([alpha, beta, gamma], index) => sample(`Prototype ${index + 1}`, [
      { key: 'alpha', label: 'Alpha', unit: 'g', mean: alpha, observationCount: 3 },
      { key: 'gamma', label: 'Gamma', unit: 'g', mean: gamma, observationCount: 3 },
      { key: 'beta', label: 'Beta', unit: 'g', mean: beta, observationCount: 3 },
    ]));
    const model = buildInstrumentalParameterRadarModel({
      samples: relationshipSamples,
      selectedSampleIds: relationshipSamples.map(item => item.sampleId),
      selectedParameterKeys: ['alpha', 'gamma', 'beta'],
    });
    const learned = learnInstrumentalParameterRelationships(relationshipSamples);
    const strongest = learned[0];
    const orderedKeys = orderInstrumentalAxesByRelationships(model.axes, model.relationships).map(axis => axis.key);

    expect(strongest).toMatchObject({ leftKey: 'alpha', rightKey: 'beta', sampleCount: 4 });
    expect(strongest.correlation).toBeCloseTo(1);
    expect(model.relationships).toEqual(learned);
    expect(Math.abs(orderedKeys.indexOf('alpha') - orderedKeys.indexOf('beta'))).toBe(1);
  });
});
