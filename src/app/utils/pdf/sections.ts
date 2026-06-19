import {
  formatDecisionDimension,
  getDecisionQualifier,
  getEvidenceStrength,
  getEvidenceStrengthNote,
  type CommercializationReportSnapshot,
} from '../../lib/commercialization-report';
import {
  getConceptImageMode,
  getPromptStyle,
} from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import { stripEvidenceCitations } from '../../lib/report-evaluator';
import { stageHeadline, REPORT_STAGE_TITLE, type ReportContext } from '../../lib/report-qc';

export const AI_VISUAL_DISCLAIMER =
  'Directional concept visualization only. Final packaging requires design, claims, and legal approval.';

export interface CommercializationReportPdfInput {
  snapshot: CommercializationReportSnapshot;
  organizationName: string;
  workspaceName: string;
  reportFooter?: string;
  version: number;
  status: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  reportTemplate?: 'standard' | 'editorial-sage';
  /** Stage-aware QC context. When present, drives the headline, dashboard
   *  evidence, and conditional framing from the typed model. */
  reportContext?: ReportContext;
}

export type EvidenceStrengthTone = 'established' | 'limited' | 'accent';

export interface DecisionSnapshotData {
  productName: string;
  category: string;
  reportTitle: string;
  decision: string;
  conditional: boolean;
  readinessStage: string;
  decisionSubheading: string;
  coreStrength: string;
  mainWatchPoint: string;
  nextAction: string;
  organizationName: string;
  workspaceName: string;
  generatedLabel: string;
  status: string;
  version: number;
}

export interface ExecutiveReadoutData {
  decision: string;
  rationale: string;
  commercialImplication: string;
  nextMove: string;
}

export interface PerformanceMetric {
  label: string;
  value: string;
  score: number | null;
  evidence: string;
  implication: string;
}

export interface PerformanceDashboardData {
  intro: string;
  metrics: PerformanceMetric[];
  evidenceNote: string;
  definitions: string;
}

export interface CommercialInsight {
  title: string;
  evidence: string;
  commercialMeaning: string;
  action: string;
}

export interface CommercialInsightsData {
  intro: string;
  insights: CommercialInsight[];
}

export interface ConceptPackagingData {
  conceptName: string;
  conceptDescription: string;
  positioning: string;
  targetConsumer: string;
  pricePoint: string;
  packagingDirection: string;
  coreMessage: string;
  strategicFit: string;
  refinements: string[];
  packagingProvenance: string | null;
  packagingDisclaimer: string | null;
}

export interface PlanRow {
  workstream: string;
  currentRead: string;
  requiredAction: string;
  statusOwner: string;
}

export interface CommercializationPlanData {
  intro: string;
  rows: PlanRow[];
  decisionGate: string;
}

export interface RiskRow {
  category: string;
  risk: string;
  impact: string;
  mitigation: string;
  nextGate: string;
}

export interface RisksData {
  intro: string;
  rows: RiskRow[];
  claimsNote: string;
}

export interface AppendixData {
  intro: string;
  rows: string[][];
  approvalNote: string;
}

function strengthTone(responseCount: number): EvidenceStrengthTone {
  const strength = getEvidenceStrength(responseCount);
  if (strength === 'Established') return 'established';
  if (strength === 'Limited') return 'limited';
  return 'accent';
}

function generatedLabel(value: string) {
  const generatedDate = new Date(value);
  return Number.isNaN(generatedDate.getTime())
    ? 'Date not available'
    : generatedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function topDimension(snapshot: CommercializationReportSnapshot) {
  return Object.entries(snapshot.decision.dimensions)
    .sort(([, left], [, right]) => Number(right) - Number(left))[0];
}

function weakestDimension(snapshot: CommercializationReportSnapshot) {
  return Object.entries(snapshot.decision.dimensions)
    .sort(([, left], [, right]) => Number(left) - Number(right))[0];
}

function scoreImplication(key: keyof CommercializationReportSnapshot['decision']['dimensions'], score: number) {
  const strong: Record<typeof key, string> = {
    hedonic: 'Acceptance is strong enough to lead the buyer story with the product experience.',
    texture: 'Texture can be presented as a product advantage, provided scale-up preserves the tested profile.',
    cata: 'The sensory descriptor profile is distinctive and gives the product a clear, defensible sensory identity to build messaging around.',
    emotional: 'The product creates a positive response that can support an engaging, benefit-led story.',
  };
  const developing: Record<typeof key, string> = {
    hedonic: 'Acceptance supports continued development, but broader validation should precede a broad launch claim.',
    texture: 'Texture is viable but should be protected through formulation and scale-up controls.',
    cata: 'The sensory descriptor profile is taking shape but should stay focused and be confirmed in the next screen.',
    emotional: 'Emotional response is encouraging but should remain a supporting proof point.',
  };
  const weak: Record<typeof key, string> = {
    hedonic: 'Acceptance needs targeted formulation work before the product is placed in a high-stakes buyer test.',
    texture: 'Texture is a commercialization risk and should be optimized before packaging or claims are locked.',
    cata: 'The sensory descriptor profile is not yet distinctive; sharpen the product before locking the sensory story.',
    emotional: 'The product is not yet creating enough positive pull to anchor the commercial story.',
  };
  if (score >= 75) return strong[key];
  if (score >= 60) return developing[key];
  return weak[key];
}

function selectedDescriptors(snapshot: CommercializationReportSnapshot) {
  if (snapshot.evidence.topSelections.length > 0) {
    return snapshot.evidence.topSelections.slice(0, 3).map(item => item.option).join(', ');
  }
  return 'No concept descriptors captured';
}

function primaryWatchPoint(snapshot: CommercializationReportSnapshot) {
  const prescription = snapshot.decision.prescriptions[0];
  if (prescription) return `${prescription.target}: ${prescription.action}`;
  if (snapshot.evidence.responseCount < 30) {
    return `Concept evidence is based on ${snapshot.evidence.responseCount} response${snapshot.evidence.responseCount === 1 ? '' : 's'}; validate with a broader target panel.`;
  }
  return 'Protect the tested product profile during scale-up and complete claims review before external use.';
}

export function packagingProvenanceLabel(snapshot: CommercializationReportSnapshot): string | null {
  if (!snapshot.concept.packagingImageAiGenerated) return null;
  const mode = getConceptImageMode(snapshot.concept.packagingImageMode).label;
  const style = snapshot.concept.packagingImagePromptStyle
    ? getPromptStyle(snapshot.concept.packagingImagePromptStyle).label
    : '';
  return style ? `${mode} · ${style}` : mode;
}

export function buildDecisionSnapshot(input: CommercializationReportPdfInput): DecisionSnapshotData {
  const { snapshot } = input;
  const [strengthKey, strengthScore] = topDimension(snapshot);
  const strengthLabel = formatDecisionDimension(strengthKey as keyof typeof snapshot.decision.dimensions);
  const evidenceStrength = getEvidenceStrength(snapshot.evidence.responseCount);
  const qualifier = getDecisionQualifier(snapshot);
  const ctx = input.reportContext;
  // Stage-aware headline replaces the bare GO badge: a conditional advancement
  // must read as "advance to next gate", never as launch approval.
  const head = ctx ? stageHeadline(ctx.stage, ctx.decision.sensoryOutcome) : null;
  return {
    productName: snapshot.product.sampleName,
    category: snapshot.product.foodType,
    reportTitle: head ? head.headline : 'Commercialization Readiness Report',
    decision: head ? head.badge : snapshot.decision.outcome,
    conditional: ctx ? ctx.stage !== 'commercialization_approval' : qualifier.conditional,
    readinessStage: head && ctx
      ? `${REPORT_STAGE_TITLE[ctx.stage]} · ${evidenceStrength} evidence`
      : qualifier.conditional
        ? `${evidenceStrength} evidence · Conditional GO · Buyer preparation`
        : `${evidenceStrength} evidence · Buyer preparation`,
    decisionSubheading: head ? head.subheading : '',
    coreStrength: `${strengthLabel} (${Number(strengthScore).toFixed(0)}/100) gives the product a credible lead proof point.`,
    mainWatchPoint: primaryWatchPoint(snapshot),
    nextAction: stripEvidenceCitations(snapshot.narrative.launchRecommendation),
    organizationName: input.organizationName || 'Food Platform',
    workspaceName: input.workspaceName,
    generatedLabel: generatedLabel(snapshot.generatedAt),
    status: input.status,
    version: input.version,
  };
}

export function buildExecutiveReadout(input: CommercializationReportPdfInput): ExecutiveReadoutData {
  const { snapshot } = input;
  const [strengthKey, strengthScore] = topDimension(snapshot);
  const [watchKey, watchScore] = weakestDimension(snapshot);
  const strength = formatDecisionDimension(strengthKey as keyof typeof snapshot.decision.dimensions);
  const watch = formatDecisionDimension(watchKey as keyof typeof snapshot.decision.dimensions);
  const qualifier = getDecisionQualifier(snapshot);
  return {
    decision: qualifier.conditional
      ? `${snapshot.product.sampleName} should advance into controlled commercialization preparation, conditional on closing the items below before any external launch.`
      : `${snapshot.product.sampleName} should advance into controlled commercialization preparation.`,
    // The DECISION block above and the final dashboard already carry the
    // conditional caveat; keep the rationale to the score facts to avoid repeating it.
    rationale: `The saved GO decision is supported by an ISSF score of ${snapshot.decision.issfScore.toFixed(1)} and ${snapshot.decision.confidence.toFixed(0)}% model confidence. ${strength} leads at ${Number(strengthScore).toFixed(0)}/100; ${watch} is the lowest dimension at ${Number(watchScore).toFixed(0)}/100.`,
    // Route the AI (or deterministic-fallback) executive recommendation into the
    // PDF — it was previously written but never rendered. Append the deterministic
    // implication so the lead-dimension guidance is preserved.
    commercialImplication: `${stripEvidenceCitations(snapshot.narrative.executiveSummary)} ${scoreImplication(strengthKey as keyof typeof snapshot.decision.dimensions, Number(strengthScore))}`.trim(),
    nextMove: `${stripEvidenceCitations(snapshot.narrative.launchRecommendation)} In parallel, close the watch points and approval gates listed in the commercialization plan before external distribution.`,
  };
}

export function buildPerformanceDashboard(input: CommercializationReportPdfInput): PerformanceDashboardData {
  const { snapshot, reportContext } = input;
  const ctxByKey = new Map((reportContext?.dimensions ?? []).map(d => [d.key, d]));
  const dimensions = Object.entries(snapshot.decision.dimensions).map(([key, score]) => {
    const dim = ctxByKey.get(key);
    // When the typed context is present, cite the underlying evidence (sample
    // size + actual measures + benchmark) instead of "Saved sensory decision
    // model". The descriptor dimension shows its real descriptor frequencies.
    const evidence = dim
      ? [
          `Threshold ${dim.threshold}/100`,
          dim.sampleSize ? `n=${dim.sampleSize}` : null,
          dim.measures.length ? dim.measures.slice(0, 4).join(', ') : null,
          dim.benchmark ? `benchmark: ${dim.benchmark}` : null,
        ].filter(Boolean).join(' · ')
      : 'Saved sensory decision model';
    return {
      label: formatDecisionDimension(key as keyof typeof snapshot.decision.dimensions),
      value: `${Number(score).toFixed(0)}/100`,
      score: Number(score),
      evidence,
      implication: scoreImplication(key as keyof typeof snapshot.decision.dimensions, Number(score)),
    };
  });
  const purchaseIntent = snapshot.evidence.purchaseIntent;
  return {
    intro: 'Performance is shown as a commercial decision aid: each result states the evidence and the action or story it supports.',
    metrics: [
      ...dimensions,
      ...(purchaseIntent !== null ? [{
        label: 'Purchase intent',
        value: purchaseIntent.toFixed(1),
        score: null,
        evidence: `${snapshot.evidence.responseCount} concept response${snapshot.evidence.responseCount === 1 ? '' : 's'}`,
        implication: snapshot.evidence.responseCount >= 30
          ? 'Use as supporting buyer evidence after confirming the panel matches the target consumer.'
          : 'Use only as a directional signal; repeat with a broader target panel before forecasting demand.',
      }] : []),
    ],
    evidenceNote: getEvidenceStrengthNote(snapshot.evidence.responseCount),
    definitions:
      'All dimension scores are 0–100, higher is better. '
      + 'ISSF = Integrated Sensory Screening Framework, the composite suitability score behind the GO / TWEAK / STOP decision. '
      + 'Model confidence reflects how complete and consistent the sensory evidence is — not market demand. '
      + 'n = number of concept-test responses collected.',
  };
}

export function buildCommercialInsights(input: CommercializationReportPdfInput): CommercialInsightsData {
  const { snapshot } = input;
  const [strengthKey, strengthScore] = topDimension(snapshot);
  const [watchKey, watchScore] = weakestDimension(snapshot);
  const strengthLabel = formatDecisionDimension(strengthKey as keyof typeof snapshot.decision.dimensions);
  const watchLabel = formatDecisionDimension(watchKey as keyof typeof snapshot.decision.dimensions);
  const insights: CommercialInsight[] = [
    {
      title: `${strengthLabel} is the lead proof point`,
      evidence: `${strengthLabel} is the highest decision dimension at ${Number(strengthScore).toFixed(0)}/100.`,
      commercialMeaning: scoreImplication(strengthKey as keyof typeof snapshot.decision.dimensions, Number(strengthScore)),
      action: `Build the first buyer-facing message around ${strengthLabel.toLowerCase()} and preserve it through scale-up.`,
    },
    {
      title: `${watchLabel} sets the development agenda`,
      evidence: `${watchLabel} is the lowest dimension at ${Number(watchScore).toFixed(0)}/100.`,
      commercialMeaning: scoreImplication(watchKey as keyof typeof snapshot.decision.dimensions, Number(watchScore)),
      action: snapshot.decision.prescriptions[0]
        ? `${snapshot.decision.prescriptions[0].action} Recheck the dimension after the next prototype.`
        : 'Define a scale-up acceptance range and confirm the result in the next validation round.',
    },
    snapshot.evidence.topSelections.length > 0
      ? {
          title: 'Concept language can sharpen the product story',
          evidence: `The most-selected concept descriptors are: ${selectedDescriptors(snapshot)}.`,
          commercialMeaning: 'These words are more credible than invented marketing language because they reflect how panelists actually described the concept.',
          action: 'Use the strongest two or three terms in concept copy, then verify comprehension with the target audience.',
        }
      : {
          title: 'Capture concept descriptors to sharpen the product story',
          evidence: 'No concept descriptors have been captured yet (no concept responses recorded).',
          commercialMeaning: 'Without panelist-described language, buyer-facing copy would rely on invented marketing terms that the evidence does not support.',
          action: 'Add a check-all-that-apply descriptor question to the concept test and collect a target-consumer panel before locking copy.',
        },
    {
      title: 'Concept evidence should match the size of the claim',
      evidence: `${snapshot.evidence.responseCount} response${snapshot.evidence.responseCount === 1 ? '' : 's'} provide ${getEvidenceStrength(snapshot.evidence.responseCount).toLowerCase()} concept evidence.`,
      commercialMeaning: snapshot.evidence.responseCount >= 30
        ? 'The concept read can support buyer discussion, but representativeness still determines how broadly it can be generalized.'
        : 'The direction is useful for iteration, but it is not yet a demand forecast or representative consumer claim.',
      action: snapshot.evidence.responseCount >= 30
        ? 'Segment the results and document panel fit before externalizing the claim.'
        : 'Run a broader target-consumer validation before final packaging, volume assumptions, or demand claims.',
    },
  ];
  if (snapshot.evidence.purchaseIntent !== null) {
    insights.push({
      title: 'Purchase intent is a gate, not a forecast',
      evidence: `Average purchase intent is ${snapshot.evidence.purchaseIntent.toFixed(1)} from ${snapshot.evidence.responseCount} response${snapshot.evidence.responseCount === 1 ? '' : 's'}.`,
      commercialMeaning: 'The result can prioritize the next concept round, but panel size and composition limit forecasting value.',
      action: 'Repeat purchase intent with the defined target consumer and a realistic price/package stimulus.',
    });
  }
  return {
    intro: 'The strongest commercial conclusions from the current evidence, translated into decisions for product, design, and go-to-market teams.',
    insights: insights.slice(0, 5),
  };
}

export function buildConceptPackaging(input: CommercializationReportPdfInput): ConceptPackagingData {
  const { snapshot } = input;
  const hasVisual = Boolean(snapshot.concept.packagingImageUrl);
  return {
    conceptName: snapshot.concept.name || 'Concept direction not named',
    conceptDescription: snapshot.concept.description || 'No concept description is stored.',
    positioning: snapshot.concept.keyBenefits || snapshot.concept.description || 'Positioning requires definition.',
    targetConsumer: snapshot.concept.targetMarket || 'Priority consumer requires definition.',
    pricePoint: snapshot.concept.pricePoint || 'Price point requires validation.',
    packagingDirection: stripEvidenceCitations(snapshot.narrative.packagingRationale),
    coreMessage: stripEvidenceCitations(snapshot.narrative.whyLiked),
    strategicFit: hasVisual
      ? `The selected visual gives the ${snapshot.concept.name || 'concept'} direction a concrete shelf and buyer-review stimulus while keeping the product experience central.`
      : 'A selected visual is required to connect the product strategy to a credible shelf and buyer-review direction.',
    refinements: [
      'Confirm hierarchy, mandatory copy, and pack architecture with design.',
      'Validate price, format, and concept language with the priority consumer.',
      'Complete claims and legal review before any external or production use.',
      ...(hasVisual ? [] : ['Create and select a directional packaging visual.']),
    ],
    packagingProvenance: packagingProvenanceLabel(snapshot),
    packagingDisclaimer: snapshot.concept.packagingImageAiGenerated ? AI_VISUAL_DISCLAIMER : null,
  };
}

export function buildCommercializationPlan(input: CommercializationReportPdfInput): CommercializationPlanData {
  const { snapshot } = input;
  const prescription = snapshot.decision.prescriptions[0];
  const count = snapshot.evidence.responseCount;
  return {
    intro: 'The decision advances only when each workstream has a named owner, a clear deliverable, and evidence for the next gate.',
    rows: [
      ['Product formulation', prescription ? `GO with open action: ${prescription.target}` : 'GO formulation; no saved corrective prescription', prescription?.action || 'Lock the tested formula and define scale-up tolerances.', 'Open · R&D'],
      ['Sensory validation', `${snapshot.decision.issfScore.toFixed(1)} ISSF; ${snapshot.decision.confidence.toFixed(0)}% confidence`, 'Confirm the product at pilot scale against the saved decision profile.', 'Open · Sensory'],
      ['Texture optimization', `${snapshot.decision.dimensions.texture.toFixed(0)}/100 texture performance`, snapshot.decision.dimensions.texture >= 75 ? 'Protect texture through process and shelf-life checks.' : 'Run a focused texture optimization and repeat validation.', 'Open · R&D'],
      ['Packaging', snapshot.concept.packagingImageUrl ? 'Directional concept selected' : 'No selected concept visual', 'Finalize structure, hierarchy, materials, and production feasibility.', 'Open · Design'],
      ['Claims/legal review', 'No external claims approval stored', 'Substantiate and approve every sensory, nutrition, and benefit claim.', 'Open · Legal'],
      ['Buyer story', `${snapshot.concept.name || 'Concept'} with ${getEvidenceStrength(count).toLowerCase()} concept evidence`, 'Build a concise story around the strongest sensory proof point and target use case.', 'Open · Commercial'],
      ['Source data/provenance', 'Decision record and method are traceable', 'Attach source files, panel definition, and approval record to the final report.', 'Open · Project lead'],
    ].map(([workstream, currentRead, requiredAction, statusOwner]) => ({ workstream, currentRead, requiredAction, statusOwner })),
    decisionGate: count < 30
      ? 'Next gate: pilot-scale sensory confirmation plus broader target-consumer concept validation.'
      : 'Next gate: pilot-scale sensory confirmation plus cross-functional packaging, claims, and buyer-story approval.',
  };
}

export function buildRisks(input: CommercializationReportPdfInput): RisksData {
  const { snapshot } = input;
  const count = snapshot.evidence.responseCount;
  const productRisk = primaryWatchPoint(snapshot);
  return {
    intro: 'These are the issues most likely to change the commercial decision, weaken the buyer story, or delay launch readiness.',
    rows: [
      {
        category: 'Product risk',
        risk: productRisk,
        impact: 'A changed or inconsistent product experience could erode the evidence supporting the GO decision.',
        mitigation: 'Set pilot-scale acceptance ranges and repeat the critical sensory measures.',
        nextGate: 'Pilot validation',
      },
      {
        category: 'Concept/packaging risk',
        risk: snapshot.concept.packagingImageUrl ? 'Directional packaging may be mistaken for a finished pack.' : 'No packaging direction is selected.',
        impact: 'Buyer feedback may focus on unfinished design choices instead of the product proposition.',
        mitigation: 'Label the stimulus as directional and complete design refinement before external use.',
        nextGate: 'Design review',
      },
      {
        category: 'Claims risk',
        risk: 'Sensory and concept results do not independently substantiate broad benefit claims.',
        impact: 'Unsupported copy creates legal exposure and can undermine buyer confidence.',
        mitigation: 'Create a claim-by-claim evidence matrix and obtain legal approval.',
        nextGate: 'Claims approval',
      },
      {
        category: 'Evidence/source risk',
        risk: count < 30 ? `Concept read is based on ${count} response${count === 1 ? '' : 's'}.` : 'Panel representativeness is not documented in the report snapshot.',
        impact: 'Directional preference could be overstated as representative demand.',
        mitigation: 'Document panel fit and expand validation before making broad market claims.',
        nextGate: 'Evidence review',
      },
      {
        category: 'Execution risk',
        risk: 'Owners and completion dates are not stored in the report snapshot.',
        impact: 'Open actions can drift across R&D, design, legal, and commercial teams.',
        mitigation: 'Assign one accountable owner and due date to every plan row.',
        nextGate: 'Readiness review',
      },
    ],
    // Claims/limitations are legal-sensitive, so build this deterministically
    // from the actual gaps rather than the AI narrative (which can degrade to a
    // bare lead-in). Lists the concrete constraints a reviewer must clear.
    claimsNote: buildClaimsNote(snapshot),
  };
}

function buildClaimsNote(snapshot: CommercializationReportSnapshot): string {
  const [watchKey, watchScore] = weakestDimension(snapshot);
  const count = snapshot.evidence.responseCount;
  const parts: string[] = [
    count === 0
      ? 'No concept responses have been collected, so consumer preference and purchase-intent claims are unsupported.'
      : `Concept evidence (n=${count}) is directional and not yet representative of the target market.`,
  ];
  if (Number(watchScore) < 60) {
    parts.push(`${formatDecisionDimension(watchKey as keyof typeof snapshot.decision.dimensions)} (${Number(watchScore).toFixed(0)}/100) is below the readiness line and must be remediated before any performance claim.`);
  }
  parts.push('Substantiate every sensory, nutrition, and benefit claim against named evidence and complete legal review before external use.');
  return parts.join(' ');
}

export function buildAppendix(input: CommercializationReportPdfInput): AppendixData {
  const { snapshot } = input;
  return {
    intro: 'Traceability fields are retained here so the commercial story remains readable while every decision can still be audited.',
    rows: [
      ['Decision record ID', snapshot.decision.recordId],
      ['Decision fingerprint', snapshot.decision.fingerprint],
      ['Method ID', snapshot.decision.methodVersion],
      ['Report version', String(input.version)],
      ['Export timestamp', new Date().toISOString()],
      ['Concept visual provenance', snapshot.concept.packagingImageAiGenerated
        ? `${packagingProvenanceLabel(snapshot)} · AI-generated directional visual; prompt metadata is retained with the source project.`
        : snapshot.concept.packagingImageUrl ? 'User-supplied concept visual; source approval should be confirmed.' : 'No concept visual attached.'],
      ['Source data notes', `Saved sensory decision evidence plus ${snapshot.evidence.responseCount} concept response${snapshot.evidence.responseCount === 1 ? '' : 's'}. Instrumental measures are not itemized in this snapshot.`],
      ['Approval status', input.status],
    ],
    approvalNote: input.status === 'approved'
      ? 'Approved report version. Confirm recipient permissions and final claims before distribution.'
      : 'Working report version. Cross-functional approval is required before external distribution.',
  };
}

export const reportPageHeadings = [
  'Commercialization Readiness Report',
  'Executive Summary / Commercial Readout',
  'Product Performance Dashboard',
  'Key Commercial Insights',
  'Concept and Packaging Direction',
  'Commercialization Plan',
  'Risks and Watch Points',
  'Appendix / Source Record',
  'Report at a Glance',
] as const;

export const reportStrengthTone = strengthTone;
