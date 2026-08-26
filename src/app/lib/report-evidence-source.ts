import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from '../data/enhanced-sensory';
import { ESSENSE25_EMOTIONS, type Product, type QuestionnaireResponse } from '../data/survey-domain';
import {
  fetchAllResponses,
  fetchInstrumentalDataset,
  fetchProducts,
  fetchWorkspaceSettings,
  type InstrumentalDataset,
} from './database';
import { buildEvidenceBundleFromProfiles } from './report-evidence';
import { collectReportInstrumentalParameters } from './report-instrumental-parameters';

function buildLiveAggregation(products: Product[], responses: QuestionnaireResponse[]) {
  const productsById = new Map(products.map(product => [product.id, product]));
  const singleResponses = responses.filter(response => !response.sessionType);
  const grouped = new Map<string, QuestionnaireResponse[]>();
  singleResponses.forEach(response => {
    grouped.set(response.productId, [...(grouped.get(response.productId) ?? []), response]);
  });
  return [...grouped.entries()].map(([productId, productResponses]) => {
    const product = productsById.get(productId);
    const n = productResponses.length;
    const cata: Record<string, number> = {};
    const intensityTotals: Record<string, { sum: number; count: number }> = {};
    const hedonicKeys = ['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const;
    const hedonicSums: Record<string, number> = { overall: 0, appearance: 0, aroma: 0, flavor: 0, texture: 0 };
    let posSum = 0;
    let negSum = 0;

    productResponses.forEach(response => {
      response.cataAttributes.forEach(attribute => { cata[attribute] = (cata[attribute] ?? 0) + 1; });
      Object.entries(response.intensityRatings).forEach(([attribute, value]) => {
        const current = intensityTotals[attribute] ?? { sum: 0, count: 0 };
        intensityTotals[attribute] = { sum: current.sum + Number(value), count: current.count + 1 };
      });
      hedonicKeys.forEach(key => { hedonicSums[key] += Number(response.hedonicScores[key] ?? 0); });
      ESSENSE25_EMOTIONS.positive.forEach(emotion => { posSum += response.emotionalProfile[emotion] ?? 0; });
      ESSENSE25_EMOTIONS.negative.forEach(emotion => { negSum += response.emotionalProfile[emotion] ?? 0; });
    });

    return {
      productId,
      productName: product?.name ?? productId,
      sourceSampleId: product?.sourceSampleId,
      n,
      cata,
      intensity: Object.fromEntries(Object.entries(intensityTotals).map(([key, value]) => [key, value.sum / value.count])),
      hedonic: Object.fromEntries(hedonicKeys.map(key => [key, hedonicSums[key] / Math.max(1, n)])) as Record<string, number>,
      emotions: {
        positive: posSum / Math.max(1, n * ESSENSE25_EMOTIONS.positive.length),
        negative: negSum / Math.max(1, n * ESSENSE25_EMOTIONS.negative.length),
      },
    };
  });
}

function importedProfile(
  sampleId: string,
  dataset: InstrumentalDataset,
  products: Product[],
  responses: QuestionnaireResponse[],
  minimumResponses: number,
): EnhancedSensoryProfile | null {
  const sample = dataset.eTongueData.find(item => item.sampleId === sampleId);
  if (!sample) return null;
  const aggregation = buildLiveAggregation(products, responses).find(item =>
    item.sourceSampleId === sample.sampleId ||
    item.productName.toLowerCase() === (sample.sampleName ?? sample.sampleId).toLowerCase(),
  );
  if (!aggregation || aggregation.n < minimumResponses) return null;
  const composition = dataset.compositionData[sample.sampleId];
  const compounds = dataset.gcmsData[sample.sampleId] ?? [];
  return {
    sampleId: sample.sampleId,
    sampleName: sample.sampleName || sample.sampleId,
    taste: {
      sourness: sample.sourness,
      bitterness: sample.bitterness,
      astringency: 0,
      umami: sample.umami,
      saltiness: sample.saltiness,
      sweetness: sample.sweetness,
      astringencyAftertaste: 0,
      umamiAftertaste: sample.umami,
      bitternessAftertaste: sample.bitterness,
      richness: sample.umami,
    },
    composition: {
      salt: composition?.saltContent ?? 0,
      fat: composition?.fat ?? 0,
      protein: composition?.protein ?? 0,
      starchDryMatter: Math.max(0, 100 - ((composition?.moisture ?? 0) + (composition?.fat ?? 0) + (composition?.protein ?? 0))),
    },
    gcmsOlfactometry: compounds.map((compound, index) => ({
      retentionTime: index + 1,
      compound: compound.name,
      nistProbability: 0,
      peakArea: compound.concentration,
      odour: compound.aroma,
      odourIntensity: compound.threshold > 0 && compound.concentration > compound.threshold
        ? 5
        : Math.min(5, Math.max(1, compound.concentration)),
      concentration: compound.concentration,
      threshold: compound.threshold,
    })),
    // Panel-only evidence has no instrument QC — null keeps the QC gate at
    // "not measured" in downstream reports instead of a fabricated pass.
    istdRecovery: null,
    olfactometryFlowSplit: compounds.length > 0 ? 'Imported CSV' : 'Not measured',
    panelN: aggregation.n,
    cata: aggregation.cata,
    intensity: aggregation.intensity,
    hedonic: {
      appearance: aggregation.hedonic.appearance ?? 0,
      flavour: aggregation.hedonic.flavor ?? 0,
      texture: aggregation.hedonic.texture ?? 0,
      overall: aggregation.hedonic.overall ?? 0,
    },
    emotions: aggregation.emotions,
  };
}

export async function buildEvidenceBundle(sampleId: string, createdBy = 'system') {
  const [settings, dataset, products, responses] = await Promise.all([
    fetchWorkspaceSettings(),
    fetchInstrumentalDataset(),
    fetchProducts(),
    fetchAllResponses({ limit: 1000 }),
  ]);
  const reference = ENHANCED_SENSORY_DATA.find(profile => profile.sampleId === sampleId);
  const imported = importedProfile(sampleId, dataset, products, responses, settings.decisionMinResponses);
  const profile = reference ?? imported;
  const foodTypeSlug = dataset.eTongueData.find(sample => sample.sampleId === sampleId)?.type ?? 'cheese';
  return buildEvidenceBundleFromProfiles({
    projectId: sampleId,
    profiles: profile ? [profile] : [],
    foodTypeSlug,
    createdBy,
    thresholds: { go: settings.decisionGoThreshold, stop: settings.decisionStopThreshold },
    minimumResponses: settings.decisionMinResponses,
    instrumentalParameters: collectReportInstrumentalParameters(dataset, sampleId),
  });
}
