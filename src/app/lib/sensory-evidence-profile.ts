import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import type { InstrumentalDataset } from './database';

export interface SensoryPanelAggregation {
  sourceSampleId?: string | null;
  productName?: string;
  n: number;
  cata: Record<string, number>;
  intensity: Record<string, number>;
  hedonic: Record<string, number>;
  emotions: { positive: number; negative: number };
}

function normalizedKey(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

function findAggregationForSample(
  sampleId: string,
  sampleName: string,
  aggregations: readonly SensoryPanelAggregation[],
) {
  const normalizedSampleId = normalizedKey(sampleId);
  const normalizedSampleName = normalizedKey(sampleName);
  return aggregations.find(aggregation =>
    normalizedKey(aggregation.sourceSampleId) === normalizedSampleId ||
    normalizedKey(aggregation.productName) === normalizedSampleName ||
    normalizedKey(aggregation.productName) === normalizedSampleId
  );
}

export function buildImportedSensoryProfiles(
  dataset: InstrumentalDataset | undefined,
  aggregations: readonly SensoryPanelAggregation[],
  options: {
    minimumResponses?: number;
    excludeSampleIds?: ReadonlySet<string>;
  } = {},
): EnhancedSensoryProfile[] {
  const minimumResponses = options.minimumResponses ?? 1;
  const excluded = options.excludeSampleIds ?? new Set<string>();

  return (dataset?.eTongueData ?? []).flatMap(sample => {
    if (excluded.has(sample.sampleId)) return [];

    const sampleName = sample.sampleName || sample.sampleId;
    const aggregation = findAggregationForSample(sample.sampleId, sampleName, aggregations);
    if (!aggregation || aggregation.n < minimumResponses) return [];

    const composition = dataset?.compositionData[sample.sampleId];
    const compounds = dataset?.gcmsData[sample.sampleId] ?? [];
    const measuredHedonic = (['appearance', 'flavour', 'texture', 'overall'] as const)
      .filter(key => {
        const value = key === 'flavour'
          ? aggregation.hedonic.flavour ?? aggregation.hedonic.flavor
          : aggregation.hedonic[key];
        return Number.isFinite(value) && Number(value) > 0;
      });

    return [{
      sampleId: sample.sampleId,
      sampleName,
      evidence: {
        provenance: 'imported' as const,
        measuredTaste: ['sourness', 'bitterness', 'umami', 'saltiness', 'sweetness'],
        measuredHedonic,
        compositionMeasured: Boolean(composition),
        // Imported compound tables are GC-MS evidence. They do not contain a
        // measured GC-O intensity and must not be presented as though they do.
        aromaMethod: compounds.length > 0 ? 'gc-ms' as const : 'not_measured' as const,
        instrumentQcMeasured: false,
      },
      taste: {
        sourness: sample.sourness,
        bitterness: sample.bitterness,
        astringency: 0,
        umami: sample.umami,
        saltiness: sample.saltiness,
        sweetness: sample.sweetness,
        astringencyAftertaste: 0,
        umamiAftertaste: 0,
        bitternessAftertaste: 0,
        richness: 0,
      },
      composition: {
        salt: composition?.saltContent ?? 0,
        fat: composition?.fat ?? 0,
        protein: composition?.protein ?? 0,
        starchDryMatter: Math.max(0, 100 - (
          (composition?.moisture ?? 0) +
          (composition?.fat ?? 0) +
          (composition?.protein ?? 0)
        )),
      },
      gcmsOlfactometry: compounds.map((compound, index) => ({
        retentionTime: index + 1,
        compound: compound.name,
        nistProbability: 0,
        peakArea: compound.concentration,
        odour: compound.aroma,
        // No GC-O intensity is present in the imported schema. Threshold ratio
        // remains available for category-aware risk screening.
        odourIntensity: 0,
        concentration: compound.concentration,
        threshold: compound.threshold,
      })),
      istdRecovery: null,
      olfactometryFlowSplit: compounds.length > 0 ? 'Imported CSV' : 'Not measured',
      panelN: aggregation.n,
      cata: aggregation.cata,
      intensity: aggregation.intensity,
      hedonic: {
        appearance: aggregation.hedonic.appearance ?? 0,
        flavour: aggregation.hedonic.flavour ?? aggregation.hedonic.flavor ?? 0,
        texture: aggregation.hedonic.texture ?? 0,
        overall: aggregation.hedonic.overall ?? 0,
      },
      emotions: aggregation.emotions,
    }];
  });
}

export function findSensoryEvidenceProfile(
  profiles: readonly EnhancedSensoryProfile[],
  input: { sampleId?: string | null; sampleName?: string | null },
) {
  const sampleId = normalizedKey(input.sampleId);
  const sampleName = normalizedKey(input.sampleName);

  return profiles.find(profile => sampleId && normalizedKey(profile.sampleId) === sampleId)
    ?? profiles.find(profile => sampleName && normalizedKey(profile.sampleName) === sampleName);
}
