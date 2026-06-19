import type { CommercializationReportSnapshot } from '../commercialization-report';
import { formatDecisionDimension } from '../commercialization-report';
import type { GoStopTweakDecision } from '../../utils/go-stop-tweak-engine';
import { buildDecisionSemantics, determineReportStage } from './stage';
import type {
  ClaimRecord,
  ConceptStrategy,
  DescriptorFrequency,
  DimensionEvidence,
  GateResult,
  PlanAction,
  ReportContext,
  ReportLimitation,
  RiskItem,
} from './types';

// ════════════════════════════════════════════════════════════════════════════
// Builds the canonical ReportContext from the existing snapshot + live decision.
// The caller supplies a SensoryAugmentation carrying the underlying evidence
// (panel size, per-dimension measures, descriptor frequencies, benchmarks) that
// the snapshot does not retain. Whatever is missing stays explicitly null and
// surfaces as a limitation — never invented.
// ════════════════════════════════════════════════════════════════════════════

export interface DimensionAugmentation {
  measures: string[];
  agreement: string | null;
  benchmark: string | null;
}

export interface SensoryAugmentation {
  panelSize: number | null;
  dimensions: Partial<Record<string, DimensionAugmentation>>;
  /** Trained/consumer-panel CATA descriptor citations behind the descriptor score. */
  sensoryDescriptors: DescriptorFrequency[];
  /** Real evidence ids present in the source bundle. */
  sourceEvidenceIds: string[];
}

export interface BuildContextInput {
  snapshot: CommercializationReportSnapshot;
  decision: GoStopTweakDecision;
  approvalStatus: 'draft' | 'in_review' | 'approved';
  reportVersion: number;
  readinessThreshold?: number;
  goThreshold?: number;
  stopThreshold?: number;
  /** True only when the claims/legal review gate has been signed off. */
  claimsApproved?: boolean;
  augmentation: SensoryAugmentation;
}

export function buildReportContext(input: BuildContextInput): ReportContext {
  const { snapshot, decision, augmentation } = input;
  const readiness = input.readinessThreshold ?? 60;
  const responseCount = snapshot.evidence.responseCount;

  const gates = buildGates(decision, snapshot, responseCount, input.approvalStatus, Boolean(input.claimsApproved));
  const weakest = Math.min(...Object.values(snapshot.decision.dimensions).map(Number));

  const stage = determineReportStage({
    sensoryOutcome: decision.decision,
    responseCount,
    gates,
    weakestDimensionScore: weakest,
    readinessThreshold: readiness,
    approvalStatus: input.approvalStatus,
  });

  const semantics = buildDecisionSemantics({
    sensoryOutcome: decision.decision,
    responseCount,
    gates,
    weakestDimensionScore: weakest,
    readinessThreshold: readiness,
    approvalStatus: input.approvalStatus,
    stage,
    modelConfidence: snapshot.decision.confidence / 100,
    defaultNextGate: 'Pilot-scale sensory confirmation and target-consumer concept validation',
  });

  const dimensions = buildDimensions(snapshot, augmentation, readiness);
  const limitations = buildLimitations(snapshot, dimensions, responseCount, weakest, readiness);
  const claims = buildClaims(snapshot, augmentation.sourceEvidenceIds);

  return {
    projectId: snapshot.decision.recordId,
    sampleId: snapshot.product.sampleId,
    sampleName: snapshot.product.sampleName,
    foodType: snapshot.product.foodType,
    stage,
    decision: semantics,
    issfScore: snapshot.decision.issfScore,
    dimensions,
    thresholds: { go: input.goThreshold ?? 75, stop: input.stopThreshold ?? 45, readiness },
    gates,
    concept: {
      responseCount,
      purchaseIntent: snapshot.evidence.purchaseIntent,
      descriptorFrequencies: snapshot.evidence.topSelections.map(item => ({
        descriptor: item.option,
        count: item.count,
        sampleSize: responseCount,
        percentage: item.percentage,
      })),
      representativeComments: snapshot.evidence.comments.slice(0, 3),
    },
    sourceEvidenceIds: augmentation.sourceEvidenceIds,
    methodVersion: snapshot.decision.methodVersion,
    decisionFingerprint: snapshot.decision.fingerprint,
    reportVersion: input.reportVersion,
    approvalStatus: input.approvalStatus,
    generatedAt: snapshot.generatedAt,
    imageProvenance: {
      attached: Boolean(snapshot.concept.packagingImageUrl),
      aiGenerated: Boolean(snapshot.concept.packagingImageAiGenerated),
      label: snapshot.concept.packagingImagePromptStyle ?? null,
      directionalDisclaimer: true,
    },
    risks: buildRisks(snapshot, responseCount),
    actions: buildActions(snapshot, decision, readiness),
    claims,
    limitations,
    conceptStrategy: buildConceptStrategy(snapshot, responseCount),
  };
}

function buildGates(
  decision: GoStopTweakDecision,
  snapshot: CommercializationReportSnapshot,
  responseCount: number,
  approvalStatus: string,
  claimsApproved: boolean,
): GateResult[] {
  const sensoryGates: GateResult[] = (decision.gates ?? []).map(gate => ({
    id: `sensory.${gate.id}`,
    category: 'sensory',
    label: gate.label,
    status: gate.status === 'fail' ? 'fail' : gate.status === 'watch' ? 'pending' : 'pass',
    detail: gate.detail,
  }));
  return [
    ...sensoryGates,
    {
      id: 'consumer.concept-validation',
      category: 'consumer',
      label: 'Target-consumer concept validation',
      status: responseCount > 0 ? 'pass' : 'pending',
      detail: responseCount > 0 ? `${responseCount} concept responses collected.` : 'No concept responses collected (n=0).',
    },
    {
      id: 'claims.legal-approval',
      category: 'claims',
      label: 'Claims and legal approval',
      status: claimsApproved ? 'pass' : 'pending',
      detail: claimsApproved ? 'Claims approved by legal.' : 'No external claims approval on file.',
    },
    {
      id: 'approval.cross-functional',
      category: 'approval',
      label: 'Cross-functional report approval',
      status: approvalStatus === 'approved' ? 'pass' : 'pending',
      detail: `Report approval status: ${approvalStatus}.`,
    },
  ];
}

function buildDimensions(
  snapshot: CommercializationReportSnapshot,
  augmentation: SensoryAugmentation,
  readiness: number,
): DimensionEvidence[] {
  return Object.entries(snapshot.decision.dimensions).map(([key, score]) => {
    const aug = augmentation.dimensions[key];
    const numeric = Number(score);
    return {
      key,
      label: formatDecisionDimension(key as keyof GoStopTweakDecision['dimensionScores']),
      score: numeric,
      threshold: readiness,
      sampleSize: augmentation.panelSize,
      source: 'Trained/consumer sensory panel (ISSF method)',
      measures: aug?.measures ?? [],
      agreement: aug?.agreement ?? null,
      benchmark: aug?.benchmark ?? null,
      businessImplication: numeric >= readiness
        ? 'Meets the readiness line and can support the buyer story.'
        : 'Below the readiness line; remediate before locking packaging or claims.',
      limitation: aug?.measures?.length ? null : 'Underlying panel measures not itemized for this dimension.',
    };
  });
}

function buildLimitations(
  snapshot: CommercializationReportSnapshot,
  dimensions: DimensionEvidence[],
  responseCount: number,
  weakest: number,
  readiness: number,
): ReportLimitation[] {
  const limitations: ReportLimitation[] = [];
  if (responseCount === 0) {
    limitations.push({
      id: 'no-concept-evidence',
      limitation: 'Consumer preference and purchase-intent are unvalidated.',
      cause: 'No concept-test responses have been collected (n=0).',
    });
  }
  if (weakest < readiness) {
    const weak = dimensions.find(d => d.score === weakest);
    limitations.push({
      id: 'weak-dimension',
      limitation: `${weak?.label ?? 'A sensory dimension'} is below the ${readiness}/100 readiness line.`,
      cause: 'Sensory performance has not yet cleared the readiness threshold.',
    });
  }
  limitations.push({
    id: 'no-claims-approval',
    limitation: 'No external sensory, nutrition, or benefit claims are approved.',
    cause: 'Claims and legal review gate is still pending.',
  });
  if (!dimensions.every(d => d.sampleSize)) {
    limitations.push({
      id: 'panel-size-undocumented',
      limitation: 'Panel sample size is not documented for every dimension.',
      cause: 'Source panel metadata was not itemized in the saved snapshot.',
    });
  }
  return limitations;
}

function buildClaims(snapshot: CommercializationReportSnapshot, sourceEvidenceIds: string[]): ClaimRecord[] {
  const sample = snapshot.product.sampleId;
  const decisionId = `sample.${sample.toLowerCase()}.decision`;
  const issfId = `sample.${sample.toLowerCase()}.issf-score`;
  const has = (id: string) => sourceEvidenceIds.includes(id);
  return [
    {
      id: 'claim.sensory-go',
      claim: `${snapshot.product.sampleName} achieved a sensory GO at ISSF ${snapshot.decision.issfScore.toFixed(1)}.`,
      claimType: 'sensory',
      evidenceIds: [decisionId, issfId].filter(has),
      confidence: snapshot.decision.confidence / 100,
      permittedWording: ['sensory GO', 'meets the sensory screening threshold'],
      prohibitedWording: ['consumer-approved', 'market-ready', 'best-in-class'],
      limitations: ['Sensory screening only; not a consumer or market claim.'],
      reviewerStatus: 'unreviewed',
    },
  ];
}

function buildRisks(snapshot: CommercializationReportSnapshot, responseCount: number): RiskItem[] {
  return [
    {
      category: 'Product risk',
      risk: snapshot.decision.prescriptions[0]?.action ?? 'Protect the tested product profile during scale-up.',
      impact: 'A changed product experience could erode the evidence supporting the decision.',
      mitigation: 'Set pilot-scale acceptance ranges and repeat the critical sensory measures.',
      nextGate: 'Pilot validation',
    },
    {
      category: 'Evidence/source risk',
      risk: `Concept read is based on ${responseCount} response${responseCount === 1 ? '' : 's'}.`,
      impact: 'Directional preference could be overstated as representative demand.',
      mitigation: 'Document panel fit and expand validation before broad market claims.',
      nextGate: 'Evidence review',
    },
  ];
}

function buildActions(
  snapshot: CommercializationReportSnapshot,
  decision: GoStopTweakDecision,
  readiness: number,
): PlanAction[] {
  const prescription = decision.prescriptions[0];
  return [
    {
      workstream: 'Texture optimization',
      owner: 'R&D',
      dueDate: null,
      unscheduled: true,
      requiredAction: prescription?.action ?? 'Run a focused texture optimization and repeat validation.',
      completionEvidence: 'Pilot-scale sensory retest',
      passingThreshold: `Texture score ≥${readiness}/100, no critical gate failures, n≥18`,
      nextGate: 'Pilot validation',
      status: 'Open',
    },
    {
      workstream: 'Concept validation',
      owner: 'Commercial',
      dueDate: null,
      unscheduled: true,
      requiredAction: 'Run a target-consumer concept test with a check-all-that-apply descriptor question.',
      completionEvidence: 'Concept-test response set',
      passingThreshold: 'n≥30 target-consumer responses with documented panel fit',
      nextGate: 'Evidence review',
      status: 'Open',
    },
    {
      workstream: 'Claims and legal review',
      owner: 'Legal',
      dueDate: null,
      unscheduled: true,
      requiredAction: 'Substantiate and approve every sensory, nutrition, and benefit claim.',
      completionEvidence: 'Signed claim-by-claim evidence matrix',
      passingThreshold: 'All external claims approved by legal',
      nextGate: 'Claims approval',
      status: 'Open',
    },
  ];
}

function buildConceptStrategy(snapshot: CommercializationReportSnapshot, responseCount: number): ConceptStrategy {
  const concept = snapshot.concept;
  return {
    hypothesisOnly: responseCount === 0,
    positioning: concept.description || 'Positioning hypothesis requires definition.',
    targetSegment: concept.targetMarket || 'Target segment not yet defined.',
    consumerNeed: 'Consumer need is a hypothesis pending concept validation.',
    usageOccasion: 'Usage occasion is a hypothesis pending concept validation.',
    productPromise: concept.keyBenefits || 'Product promise requires definition.',
    reasonsToBelieve: ['Sensory GO result from the saved decision model.'],
    priceHypothesis: concept.pricePoint || 'Price hypothesis requires validation.',
    packagingHypothesis: concept.packagingImageUrl ? 'Directional packaging selected; structure and claims unconfirmed.' : 'No packaging direction selected.',
    unknowns: ['Consumer preference', 'Purchase intent', 'Price acceptance', 'Representativeness'],
    conceptTestObjective: 'Validate preference, descriptor comprehension, and price acceptance with the target consumer.',
    prohibitedClaims: ['consumer preference', 'purchase demand', 'market readiness', 'representative acceptance'],
    visualProvenance: concept.packagingImageAiGenerated ? 'AI-generated directional visual; not final artwork.' : 'No concept visual attached.',
  };
}
