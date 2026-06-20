import type { CommercializationReportSnapshot } from '../commercialization-report';
import { formatDecisionDimension } from '../commercialization-report';
import type { GoStopTweakDecision } from '../../utils/go-stop-tweak-engine';
import { buildDecisionSemantics, determineReportStage, stageDecisionCode } from './stage';
import { buildMethodology, buildTextureBreakdown } from './methodology';
import type {
  ApprovalStatus,
  ClaimRecord,
  ConceptStrategy,
  DescriptorFrequency,
  DimensionEvidence,
  GateResult,
  InstrumentalEvidence,
  InstrumentalFinding,
  PlanAction,
  ReportContext,
  ReportLimitation,
  RiskItem,
} from './types';
import type { CommercializationProjectProfile } from '../report-evidence-types';

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
  /** Raw intensity attributes (0–10) — used to explain the texture composite. */
  intensity?: Record<string, number>;
  foodTypeSlug?: string;
  /** Instrumental findings, when the decision snapshot includes them. */
  instrumentalFindings?: InstrumentalFinding[];
  instrumentSignal?: number | null;
  gatePenalty?: number;
  confidenceCalculation?: ReportContext['methodology']['confidenceCalculation'];
}

export interface BuildContextInput {
  snapshot: CommercializationReportSnapshot;
  decision: GoStopTweakDecision;
  approvalStatus: ApprovalStatus;
  reportVersion: number;
  readinessThreshold?: number;
  goThreshold?: number;
  stopThreshold?: number;
  /** True only when the claims/legal review gate has been signed off. */
  claimsApproved?: boolean;
  augmentation: SensoryAugmentation;
  commercialProfile?: CommercializationProjectProfile | null;
}

export function buildReportContext(input: BuildContextInput): ReportContext {
  const { snapshot, decision, augmentation } = input;
  const readiness = input.readinessThreshold ?? 60;
  const responseCount = snapshot.evidence.responseCount;

  const gates = buildGates(decision, snapshot, responseCount, input.approvalStatus, Boolean(input.claimsApproved));
  const weakest = Math.min(...Object.values(snapshot.decision.dimensions).map(Number));

  const thresholds = { go: input.goThreshold ?? 75, stop: input.stopThreshold ?? 45, readiness };
  const stageInputs = {
    sensoryOutcome: decision.decision,
    responseCount,
    gates,
    weakestDimensionScore: weakest,
    readinessThreshold: readiness,
    approvalStatus: input.approvalStatus,
  };
  const stage = determineReportStage(stageInputs);
  const code = stageDecisionCode(stageInputs);

  const dimensions = buildDimensions(snapshot, augmentation, readiness);
  const weakestDim = dimensions.find(d => d.score === weakest);
  const confidenceBasis = [
    `Sensory panel n=${augmentation.panelSize ?? 'unknown'}`,
    'Dimension-score completeness across sensory acceptance, texture, descriptor profile, and emotional response',
    'Critical sensory gate outcomes (off-note, instrument QC)',
  ];
  const conditions = buildConditions(dimensions, responseCount, readiness);

  const semantics = buildDecisionSemantics({
    ...stageInputs,
    modelConfidence: snapshot.decision.confidence / 100,
    confidenceBasis,
    methodId: snapshot.decision.methodVersion,
    defaultNextGate: 'Pilot-scale sensory confirmation and target-consumer concept validation',
    conditions,
  });

  const methodology = buildMethodology({
    dimensions: snapshot.decision.dimensions,
    storedIssf: snapshot.decision.issfScore,
    methodId: snapshot.decision.methodVersion,
    methodVersion: snapshot.decision.methodVersion,
    thresholds,
    confidenceBasis,
    weakestDimensionLabel: weakestDim?.label ?? 'A sensory dimension',
    weakestScore: weakest,
    instrumentSignal: augmentation.instrumentSignal ?? null,
    gatePenalty: augmentation.gatePenalty ?? 0,
    confidenceCalculation: augmentation.confidenceCalculation ?? [],
  });

  const instrumental = buildInstrumental(augmentation.instrumentalFindings ?? []);
  const limitations = buildLimitations(snapshot, dimensions, responseCount, weakest, readiness, instrumental, input.commercialProfile);
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
    thresholds,
    gates,
    methodology,
    instrumental,
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
    evidenceProvenance: input.commercialProfile?.evidenceLabel ?? 'Evidence provenance is inherited from the linked source records.',
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
    risks: buildRisks(snapshot, responseCount, input.commercialProfile),
    actions: buildActions(snapshot, decision, readiness, input.commercialProfile),
    claims,
    limitations,
    conceptStrategy: buildConceptStrategy(snapshot, responseCount, input.commercialProfile),
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
  const population = augmentation.panelSize ? `Sensory panel n=${augmentation.panelSize}` : 'Sensory panel (n not documented)';
  const intensity = augmentation.intensity ?? {};
  const foodTypeSlug = augmentation.foodTypeSlug ?? 'cheese';

  return Object.entries(snapshot.decision.dimensions).map(([key, score]) => {
    const aug = augmentation.dimensions[key];
    const numeric = Number(score);
    // Texture gets a real calculation explanation showing the missing positive
    // cues that drag the composite below the readiness line.
    const texture = key === 'texture' ? buildTextureBreakdown(intensity, foodTypeSlug, numeric, readiness) : null;
    const calculationExplanation = texture
      ? texture.explanation
      : `${formatDecisionDimension(key as keyof GoStopTweakDecision['dimensionScores'])} scores ${numeric}/100 (threshold ${readiness}) from the panel measures shown.`;

    return {
      key,
      label: formatDecisionDimension(key as keyof GoStopTweakDecision['dimensionScores']),
      score: numeric,
      threshold: readiness,
      sampleSize: augmentation.panelSize,
      population,
      source: 'Trained sensory panel (ISSF method)',
      measures: aug?.measures ?? [],
      rawMetrics: texture ? texture.rawMetrics : (aug?.measures ?? []).map(m => ({ label: m, value: m })),
      calculationExplanation,
      agreement: aug?.agreement ?? null,
      benchmark: aug?.benchmark ?? null,
      businessImplication: numeric >= readiness
        ? 'Meets the readiness line and supports continued sensory development.'
        : 'Below the readiness line; capture the missing measures and remediate before locking packaging or claims.',
      limitation: aug?.measures?.length ? null : 'Underlying panel measures not itemized for this dimension.',
    };
  });
}

// Conditions attached to a conditional advancement — each is a concrete gate.
function buildConditions(dimensions: DimensionEvidence[], responseCount: number, readiness: number): string[] {
  const conditions: string[] = [];
  const weak = dimensions.filter(d => d.score < readiness);
  for (const dim of weak) {
    conditions.push(`Bring ${dim.label} to >=${readiness}/100 at pilot scale and revalidate.`);
  }
  if (responseCount === 0) conditions.push('Collect target-consumer concept evidence before any consumer or market claim.');
  conditions.push('Obtain claims/legal approval before external distribution.');
  return conditions;
}

function buildInstrumental(findings: InstrumentalFinding[]): InstrumentalEvidence {
  if (findings.length === 0) {
    return {
      available: false,
      includedInDecision: false,
      findings: [],
      absenceNote: 'No instrumental evidence was included in this decision snapshot. The recommendation is based on sensory evidence only; instrumental confirmation (e-tongue, GC-MS, GC-O) is a pilot-stage requirement.',
    };
  }
  return { available: true, includedInDecision: true, findings, absenceNote: null };
}

function buildLimitations(
  snapshot: CommercializationReportSnapshot,
  dimensions: DimensionEvidence[],
  responseCount: number,
  weakest: number,
  readiness: number,
  instrumental: InstrumentalEvidence,
  profile?: CommercializationProjectProfile | null,
): ReportLimitation[] {
  const limitations: ReportLimitation[] = [];
  if (profile?.evidenceStatus === 'reference_demo') {
    limitations.push({
      id: 'reference-demo-evidence',
      limitation: 'This report includes reference/demo evidence and is not eligible for external approval.',
      cause: profile.evidenceLabel,
    });
  }
  if (responseCount === 0) {
    limitations.push({
      id: 'no-concept-evidence',
      limitation: 'Consumer preference and purchase-intent are unvalidated.',
      cause: 'No concept-test responses have been collected (concept-test n=0).',
    });
  }
  if (!instrumental.includedInDecision) {
    limitations.push({
      id: 'no-instrumental-evidence',
      limitation: 'No instrumental evidence is included in this decision snapshot.',
      cause: 'The recommendation rests on sensory evidence only; instrumental confirmation is pending.',
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

function buildRisks(
  snapshot: CommercializationReportSnapshot,
  responseCount: number,
  profile?: CommercializationProjectProfile | null,
): RiskItem[] {
  if (profile) {
    return profile.development.technicalRisks.map((risk, index) => ({
      category: index === 0 ? 'Product risk' : index === 1 ? 'Validation risk' : 'Evidence risk',
      risk,
      impact: index === 0
        ? 'The current stage decision remains conditional until the texture basis is completed and revalidated.'
        : 'The open evidence gap prevents launch authorization and limits external claims.',
      mitigation: profile.actionPlan[index]?.action ?? 'Collect the missing evidence and repeat cross-functional review.',
      nextGate: profile.actionPlan[index]?.nextGate ?? 'Evidence review',
    }));
  }
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
  profile?: CommercializationProjectProfile | null,
): PlanAction[] {
  if (profile) {
    return profile.actionPlan.map(item => ({
      workstream: item.workstream,
      owner: item.owner,
      dueDate: item.dueDate,
      unscheduled: item.dueDate === null,
      requiredAction: item.action,
      completionEvidence: item.completionEvidence,
      passingThreshold: item.passingCriteria,
      nextGate: item.nextGate,
      status: `Open - ${item.priority} priority - ${item.team}`,
    }));
  }
  const prescription = decision.prescriptions[0];
  return [
    {
      workstream: 'Texture optimization',
      owner: 'Not assigned — readiness gap',
      dueDate: null,
      unscheduled: true,
      requiredAction: prescription?.action ?? 'Run a focused texture optimization and repeat validation.',
      completionEvidence: 'Pilot-scale sensory retest',
      passingThreshold: `Texture score >=${readiness}/100, no critical gate failures, sensory panel n>=18`,
      nextGate: 'Pilot validation',
      status: 'Open',
    },
    {
      workstream: 'Concept validation',
      owner: 'Not assigned — readiness gap',
      dueDate: null,
      unscheduled: true,
      requiredAction: 'Run a target-consumer concept test with a check-all-that-apply descriptor question.',
      completionEvidence: 'Concept-test response set',
      passingThreshold: 'Concept test n>=30 target-consumer responses with documented panel fit',
      nextGate: 'Evidence review',
      status: 'Open',
    },
    {
      workstream: 'Claims and legal review',
      owner: 'Not assigned — readiness gap',
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

function buildConceptStrategy(
  snapshot: CommercializationReportSnapshot,
  responseCount: number,
  profile?: CommercializationProjectProfile | null,
): ConceptStrategy {
  if (profile) {
    const hypothesis = profile.conceptHypothesis;
    return {
      hypothesisOnly: responseCount === 0,
      positioning: `Hypothesis - ${hypothesis.positioning}`,
      targetSegment: hypothesis.targetSegment,
      consumerNeed: hypothesis.consumerNeed,
      usageOccasion: hypothesis.usageOccasion,
      productPromise: hypothesis.productPromise,
      reasonsToBelieve: hypothesis.reasonsToBelieve,
      priceHypothesis: responseCount === 0
        ? `Hypothesis — ${hypothesis.priceHypothesis} Validation required; no willingness-to-pay evidence has been collected.`
        : hypothesis.priceHypothesis,
      packagingHypothesis: hypothesis.packagingHypothesis,
      unknowns: profile.claimsBoundary.prohibitedUntilValidated,
      conceptTestObjective: hypothesis.validationQuestions.join(' '),
      prohibitedClaims: profile.claimsBoundary.prohibitedUntilValidated,
      visualProvenance: snapshot.concept.packagingImageAiGenerated
        ? 'AI-generated directional visual; not final artwork.'
        : 'No approved final concept visual is attached.',
    };
  }
  const concept = snapshot.concept;
  const hypothesisLabel = responseCount === 0 ? 'Hypothesis — ' : '';
  const target = concept.targetMarket?.trim();
  return {
    hypothesisOnly: responseCount === 0,
    positioning: `${hypothesisLabel}For flexitarian buyers seeking a familiar plant-based cheddar for everyday cooking, ${concept.name || snapshot.product.sampleName} proposes recognizable cheddar-category sensory cues from a coconut-based format; the reason to believe is the trained sensory profile, not consumer validation.`,
    targetSegment: `${hypothesisLabel}${target ? `${target} flexitarian shoppers` : 'Flexitarian shoppers'} who buy plant-based alternatives but prioritize familiar cheddar cues and cooking versatility.`,
    consumerNeed: `${hypothesisLabel}A plant-based cheese option that feels familiar enough for routine cooking without implying validated consumer preference.`,
    usageOccasion: `${hypothesisLabel}Everyday melting, sandwiches, and simple cooked meals; validate the most relevant occasion in concept testing.`,
    productPromise: `${hypothesisLabel}${concept.keyBenefits || 'Familiar cheddar-category character in a coconut-based format.'}`,
    reasonsToBelieve: ['Sensory screening outcome GO at the documented ISSF score.', 'High panel agreement on cheddar-category descriptors.'],
    priceHypothesis: `${hypothesisLabel}${concept.pricePoint || 'Test an explicit price range against category alternatives.'}`,
    packagingHypothesis: concept.packagingImageUrl
      ? `${hypothesisLabel}Use the directional visual to communicate plant-based cheddar clearly while avoiding any implication that texture performance or claims are finalized.`
      : `${hypothesisLabel}Develop a directional visual that communicates plant-based cheddar and everyday use without overpromising texture.`,
    unknowns: ['Consumer preference', 'Purchase intent', 'Price acceptance', 'Representativeness'],
    conceptTestObjective: 'Validate preference, descriptor comprehension, and price acceptance with the target consumer.',
    prohibitedClaims: ['consumer preference', 'purchase demand', 'market readiness', 'representative acceptance'],
    visualProvenance: concept.packagingImageAiGenerated ? 'AI-generated directional visual; not final artwork.' : 'No concept visual attached.',
  };
}
