import type { CommercializationReportSnapshot } from '../commercialization-report';
import type { GoStopTweakDecision } from '../../utils/go-stop-tweak-engine';
import { buildReportContext, type SensoryAugmentation } from './context';
import type { ApprovalStatus, ReportContext } from './types';

// ════════════════════════════════════════════════════════════════════════════
// Regression fixtures for the QC pipeline. The Coconut Cheddar v3.0 fixture
// mirrors the real exported report: ISSF 76.7, 91% confidence, texture 43/100,
// descriptor profile 99/100, concept n=0, draft. The sensory descriptor
// frequencies are the actual S4 CATA citations (panel of 14).
// ════════════════════════════════════════════════════════════════════════════

export const COCONUT_CHEDDAR_DIMENSIONS = { hedonic: 84, texture: 43, cata: 99, emotional: 86 };

const COCONUT_SOURCE_EVIDENCE_IDS = [
  'sample.s4.decision',
  'sample.s4.issf-score',
  'sample.s4.confidence',
  'sample.s4.dimension.hedonic',
  'sample.s4.dimension.texture',
  'sample.s4.dimension.cata',
  'sample.s4.dimension.emotional',
];

export function coconutCheddarSnapshot(overrides?: Partial<CommercializationReportSnapshot>): CommercializationReportSnapshot {
  return {
    product: { sampleId: 'S4', sampleName: 'Coconut Cheddar v3.0', foodType: 'Cheese' },
    decision: {
      recordId: '8a9dd594-626a-42ff-8cdf-3dc49166e150',
      outcome: 'GO',
      issfScore: 76.7,
      confidence: 91,
      recommendation: 'Advance to controlled commercialization preparation.',
      dimensions: COCONUT_CHEDDAR_DIMENSIONS,
      gates: [
        { id: 'off-note', label: 'Off-note control', status: 'pass', detail: 'No material off-note remains.', impact: 0 },
        { id: 'qc', label: 'Instrument quality control', status: 'pass', detail: 'Recovery inside method range.', impact: 0 },
      ],
      prescriptions: [{
        priority: 1,
        target: 'Texture rebuild',
        action: 'Lift overall texture liking by reinforcing creamy, smooth, firm cues through formulation and process controls.',
        expectedLift: 7,
      }],
      methodVersion: 'NFI-GST-1.1',
      fingerprint: '699B8585',
    },
    concept: {
      id: 'concept-vitacheese',
      name: 'VitaCheese',
      description: 'A plant-based coconut cheddar positioned for everyday use.',
      targetMarket: '25-35',
      pricePoint: 'Price point requires validation.',
      keyBenefits: 'Familiar cheddar character with a coconut base.',
      packagingImageId: 'visual-vitacheese-01',
      packagingImageUrl: 'data:image/png;base64,placeholder',
      packagingImageMode: 'packaging',
      packagingImagePromptStyle: 'bold-retail',
      packagingImageAiGenerated: true,
    },
    evidence: {
      responseCount: 0,
      scaleMetrics: [],
      topSelections: [],
      comments: [],
      purchaseIntent: null,
    },
    narrative: {
      executiveSummary: 'Coconut Cheddar v3.0 reached a sensory GO at ISSF 76.7 (91% confidence).',
      whyLiked: 'The sensory descriptor profile (99/100) and emotional response (86/100) support a positive product experience.',
      packagingRationale: 'The directional packaging expresses the VitaCheese positioning and is a review stimulus, not final artwork.',
      launchRecommendation: 'Advance to pilot-scale sensory confirmation and target-consumer concept validation before any external launch.',
      claimCaution: 'No concept responses are available; consumer and market claims are unsupported pending validation.',
    },
    generatedAt: '2026-06-19T13:58:05.771Z',
    ...overrides,
  };
}

export function coconutCheddarDecision(): GoStopTweakDecision {
  const snap = coconutCheddarSnapshot();
  return {
    sampleId: 'S4',
    sampleName: 'Coconut Cheddar v3.0',
    issfScore: 76.7,
    confidenceScore: 91,
    decision: 'GO',
    recommendation: snap.decision.recommendation,
    costSavings: 0,
    timeline: 'pilot',
    riskLevel: 'medium',
    details: [],
    dimensionScores: COCONUT_CHEDDAR_DIMENSIONS,
    gates: snap.decision.gates ?? [],
    prescriptions: snap.decision.prescriptions,
    decisionFingerprint: '699B8585',
    methodVersion: 'NFI-GST-1.1',
  };
}

// Real S4 CATA descriptor citations (panel of 14) behind the descriptor score.
// Real S4 intensity attributes (0–10) — note firm/spreadable are absent, which
// is exactly why texture composites to 43 despite high creamy/smooth.
const COCONUT_INTENSITY: Record<string, number> = {
  sourMilk: 2.0, milkiness: 7.2, cheesiness: 6.8, creamy: 8.4, grainy: 1.8, oily: 2.8, chalky: 1.2, smooth: 8.6,
};

export function coconutCheddarAugmentation(): SensoryAugmentation {
  const panelSize = 14;
  const cata: Record<string, number> = { Cheese: 13, Butter: 12, 'Lactic acid': 11, Milk: 11, Nutty: 8 };
  return {
    panelSize,
    sourceEvidenceIds: COCONUT_SOURCE_EVIDENCE_IDS,
    intensity: COCONUT_INTENSITY,
    foodTypeSlug: 'cheese',
    instrumentSignal: 72.3,
    gatePenalty: 0,
    instrumentalFindings: [
      {
        source: 'E-tongue / composition model',
        batchId: 'S4',
        finding: 'Instrument signal 72.3/100 from taste and composition inputs',
        benchmark: 'Production ISSF instrument-signal transform',
        decisionEffect: 'supports',
      },
      {
        source: 'GC-MS / GC-O',
        batchId: 'S4',
        finding: '2 aroma findings; no critical off-note gate failure',
        benchmark: 'Off-note decision gate',
        decisionEffect: 'supports',
      },
      {
        source: 'Internal-standard QC',
        batchId: 'S4',
        replicateCount: 1,
        finding: 'Recovery 95.1%',
        benchmark: 'Pass range 85–110%',
        decisionEffect: 'supports',
      },
    ],
    confidenceCalculation: [
      { input: 'Trained-panel agreement', score: 88.8, weightPct: 45, contribution: 40.0 },
      { input: 'Instrument QC recovery', score: 96, weightPct: 20, contribution: 19.2 },
      { input: 'GC-MS/olfactometry coverage', score: 92, weightPct: 20, contribution: 18.4 },
      { input: 'Descriptor evidence coverage', score: 88, weightPct: 15, contribution: 13.2 },
    ],
    sensoryDescriptors: Object.entries(cata).map(([descriptor, count]) => ({
      descriptor,
      count,
      sampleSize: panelSize,
      percentage: (count / panelSize) * 100,
    })),
    dimensions: {
      hedonic: { measures: ['Overall liking 7.6/9', 'Flavour 7.6/9', 'Appearance 7.8/9'], agreement: 'Panel SD ±0.9', benchmark: 'Trained-panel reference 86/100' },
      texture: { measures: ['Creamy 8.4/10', 'Smooth 8.6/10', 'Grainy 1.8/10', 'Chalky 1.2/10'], agreement: 'Panel SD ±1.2', benchmark: 'Category readiness line 60/100' },
      cata: {
        measures: ['Cheese 13/14 (93%)', 'Butter 12/14 (86%)', 'Lactic acid 11/14 (79%)', 'Milk 11/14 (79%)', 'Nutty 8/14 (57%)'],
        agreement: 'Citation agreement ≥79% on top 4 descriptors',
        benchmark: 'Category-positive descriptor target',
      },
      emotional: { measures: ['Positive 4.4/5', 'Negative 0.8/5'], agreement: 'Panel SD ±0.7', benchmark: 'Net emotional valence +3.6' },
    },
  };
}

export function coconutCheddarContext(approvalStatus: ApprovalStatus = 'draft'): ReportContext {
  return buildReportContext({
    snapshot: coconutCheddarSnapshot(),
    decision: coconutCheddarDecision(),
    approvalStatus,
    reportVersion: 4,
    readinessThreshold: 60,
    augmentation: coconutCheddarAugmentation(),
  });
}
