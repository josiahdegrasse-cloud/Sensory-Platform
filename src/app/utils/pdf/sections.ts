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
import { stripLiteratureCitations } from '../../lib/report-agents/literature-citation-guard';
import type { LiteratureCitation } from '../../lib/report-agents/types';
import type { ReportContext } from '../../lib/report-qc';

export const AI_VISUAL_DISCLAIMER =
  'Directional concept visualization only. Final packaging requires design, claims, and legal approval.';

// PDF export can't render clickable [lit:Lx] markers, so both citation
// token schemes are stripped from narrative body text before it's printed
// (the References block on the appendix page carries the literature list
// instead — see buildAppendix below).
function cleanNarrativeText(text: string, citations: LiteratureCitation[] = []): string {
  const cleaned = stripLiteratureCitations(stripEvidenceCitations(text));
  const sourceWindows = citations.flatMap(citation => {
    const words = citation.excerpt.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    const windows: string[] = [];
    for (let index = 0; index <= words.length - 8; index += 5) windows.push(words.slice(index, index + 8).join(' '));
    return windows;
  });
  if (sourceWindows.length === 0) return cleaned;
  return cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter(sentence => {
      const normalized = sentence.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return !sourceWindows.some(window => normalized.includes(window));
    })
    .join(' ')
    .trim();
}

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
  issfScore: string;
  modelConfidence: string;
  conceptEvidence: string;
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

export interface DecisionBasisData {
  decision: string;
  issfScore: string;
  goThreshold: string;
  decisionMargin: string;
  evidenceStrength: string;
  evidenceStrengthDefinition: string;
  populations: Array<{ label: string; value: string; provenance: string }>;
  whatThisMeans: string;
  gates: Array<{ label: string; status: string; detail: string }>;
  limitations: string[];
  sensitivity: string[];
  managementDecision: string;
  reportStatus: string;
}

export interface PerformanceMetric {
  label: string;
  value: string;
  score: number | null;
  evidence: string;
  implication: string;
  explanation?: string;
  benchmark?: string | null;
  agreement?: string | null;
}

export interface PerformanceDashboardData {
  intro: string;
  metrics: PerformanceMetric[];
  readinessThreshold: number;
  evidenceNote: string;
  definitions: string;
}

export interface ScientificContextData {
  instrumentalAvailable: boolean;
  instrumentalIncludedInDecision: boolean;
  instrumentalNote: string;
  findings: Array<{
    source: string;
    finding: string;
    benchmark: string;
    decisionEffect: 'supports' | 'contradicts' | 'watch' | 'neutral';
    replicateCount: number | null;
  }>;
  parameters: Array<{
    id: string;
    label: string;
    family: string;
    value: number;
    unit: string;
    observationCount: number;
    standardDeviation: number | null;
    minimum: number | null;
    maximum: number | null;
    status: string;
  }>;
  parameterCount: number;
  benchmarkedParameterCount: number;
  guidance: Array<{
    title: string;
    guidance: string;
    citationIds: string[];
  }>;
  sources: Array<{
    id: string;
    title: string;
    authors: string;
    studyType: string;
    year: string;
    doi: string;
    evidenceRole: string;
  }>;
}

export interface ConsumerEvidenceData {
  responseCount: number;
  evidenceStrength: string;
  purchaseIntent: number | null;
  scaleMetrics: Array<{ question: string; average: number; count: number }>;
  descriptors: Array<{ label: string; percentage: number; count: number }>;
  comments: string[];
  boundary: string;
}

export interface PanelStudyProfileData {
  sensoryPopulation: string;
  conceptPopulation: string;
  profileCoverage: string;
  profileStatus: 'available' | 'partial' | 'missing';
  dimensions: Array<{
    key: string;
    label: string;
    knownCount: number;
    groups: Array<{ label: string; count: number; percentage: number }>;
    suppressedCount: number;
  }>;
  samplingBoundary: string;
  disclosureRule: string;
  provenance: string;
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

export interface MethodEvidenceData {
  methodLabel: string;
  rows: Array<[string, string, string, string]>;
  issfFormula: string;
  gateLogic: string;
  confidenceRows: Array<[string, string, string]>;
  instrumentalRows: Array<[string, string, string, string]>;
  instrumentalNote: string;
}

export interface ConceptPackagingData {
  conceptName: string;
  conceptDescription: string;
  positioning: string;
  targetConsumer: string;
  consumerNeed: string;
  usageOccasion: string;
  productPromise: string;
  reasonsToBelieve: string[];
  pricePoint: string;
  validationQuestions: string[];
  prohibitedClaims: string[];
  packagingDirection: string;
  coreMessage: string;
  strategicFit: string;
  refinements: string[];
  packagingProvenance: string | null;
  packagingDisclaimer: string | null;
  competitiveFrame: string;
  differentiation: string;
}

export interface PlanRow {
  workstream: string;
  rationale: string;
  protocol: string;
  completionEvidence: string;
  passingCriteria: string;
  owner: string;
  timing: string;
  budget: string;
  nextGate: string;
  sampleSizeRationale: string;
  failureDecision: string;
}

export interface CommercializationPlanData {
  intro: string;
  rows: PlanRow[];
  decisionGate: string;
}

export type ReadinessStatus = 'Ready' | 'In progress' | 'Pending' | 'Evidence gap' | 'Requires validation';

export interface ReadinessRow {
  area: string;
  status: ReadinessStatus;
  currentEvidence: string;
  decisionImpact: string;
  requiredEvidence: string;
}

export interface ProductReadinessData {
  intro: string;
  rows: ReadinessRow[];
  summary: string;
}

export interface CommercialReadinessData {
  intro: string;
  rows: ReadinessRow[];
  summary: string;
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
  permittedNow: string[];
  notPermitted: string[];
  releaseConditions: string[];
}

export interface ClaimsMatrixRow {
  claim: string;
  scope: 'Internal decision statement' | 'External claim';
  status: 'Supported' | 'Directional' | 'Blocked';
  evidence: string;
  permittedWording: string;
  requirement: string;
}

export interface ClaimsMatrixData {
  intro: string;
  rows: ClaimsMatrixRow[];
  reportStatus: string;
  releaseDecision: string;
}

export interface AppendixData {
  intro: string;
  rows: string[][];
  approvalNote: string;
  references: LiteratureCitation[];
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
    : generatedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
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
    hedonic: 'Acceptance supports moving the product into the next validation round.',
    texture: 'Texture is a strength to protect during scale-up.',
    cata: 'The sensory profile is recognizable and category-relevant.',
    emotional: 'Positive response supports the direction, but remains secondary evidence.',
  };
  const developing: Record<typeof key, string> = {
    hedonic: 'Acceptance is promising and should be confirmed in the next round.',
    texture: 'Texture is viable but should be monitored through scale-up.',
    cata: 'The sensory profile is promising but still developing.',
    emotional: 'Response is encouraging but not yet a lead claim.',
  };
  const weak: Record<typeof key, string> = {
    hedonic: 'Acceptance needs targeted formulation work before the product is placed in a high-stakes buyer test.',
    texture: 'Texture is a commercialization risk and should be optimized before packaging or claims are locked.',
    cata: 'Category-relevant descriptor agreement is weak; strengthen the sensory profile before locking the sensory story.',
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

function cleanLiteratureTitle(citation: LiteratureCitation) {
  const title = citation.title
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.(?:pdf|docx?|txt)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+\(\d+\)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return title || `Verified literature source ${citation.id}`;
}

function literatureMetadata(citation: LiteratureCitation) {
  const title = cleanLiteratureTitle(citation);
  const normalizedTitle = title.toLowerCase();
  if (normalizedTitle.includes('sensory evaluation of plant-based cheese') && normalizedTitle.includes('texture and mouthfeel')) {
    return {
      title,
      authors: 'Birke Rune, Clausen & Giacalone',
      year: '2026',
      doi: '10.1080/10408398.2025.2531220',
      studyType: 'Systematic review',
      evidenceRole: 'Higher-level methodological context',
    };
  }
  if (normalizedTitle.includes('sensory characterisation and consumer acceptance') && normalizedTitle.includes('swiss perspective')) {
    return {
      title,
      authors: 'Guggenbühl et al.',
      year: '2026',
      doi: '10.1016/j.foodqual.2025.105713',
      studyType: 'Category study',
      evidenceRole: 'Category and consumer context',
    };
  }
  if (normalizedTitle === 'issf technical review') {
    return {
      title,
      authors: 'New Food Innovation',
      year: '2026',
      doi: 'Internal method record',
      studyType: 'Technical/method source',
      evidenceRole: 'Method context',
    };
  }
  const metadataText = `${citation.title} ${citation.source}`;
  const year = metadataText.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? 'Not captured';
  const doi = metadataText.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i)?.[0] ?? 'Not captured';
  const lower = title.toLowerCase();
  const studyType = /systematic review|meta-analysis/.test(lower)
    ? 'Systematic review'
    : /review/.test(lower)
      ? 'Review'
      : /consumer|acceptance|perspective|characterisation|characterization/.test(lower)
        ? 'Category study'
        : /technical|method|framework/.test(lower)
          ? 'Technical/method source'
          : 'Classification unavailable';
  const evidenceRole = studyType === 'Systematic review'
    ? 'Higher-level methodological context'
    : studyType === 'Category study'
      ? 'Category and consumer context'
      : 'Method context';
  return { title, authors: 'Not captured', year, doi, studyType, evidenceRole };
}

function literatureGuidance(citations: LiteratureCitation[]): ScientificContextData['guidance'] {
  const candidates = citations.map(citation => {
    const searchable = `${citation.title} ${citation.excerpt}`.toLowerCase();
    if (/sample size|methodological flaw|sensory evaluation practice|panel design/.test(searchable)) {
      return {
        title: 'Study design and reporting',
        guidance: 'Document sample size, panel composition, and the sensory method before comparing results across studies.',
        citationIds: [citation.id],
      };
    }
    if (/texture|mouthfeel|firmness|creaminess|hydrocolloid|melt/.test(searchable)) {
      return {
        title: 'Texture and mouthfeel confirmation',
        guidance: 'Keep texture and mouthfeel measures in the pilot confirmation plan because structure strongly shapes the plant-based cheese experience.',
        citationIds: [citation.id],
      };
    }
    if (/consumer acceptance|consumer validation|familiar sensory|usage expectation|benchmark/.test(searchable)) {
      return {
        title: 'Target-consumer validation',
        guidance: 'Benchmark the correct product format and confirm positioning and usage cues with the intended consumer group.',
        citationIds: [citation.id],
      };
    }
    if (/cata|check-all-that-apply|descriptor|rapid sensory|integrat(?:e|ed|ing).*sensory/.test(searchable)) {
      return {
        title: 'Integrated sensory measurement',
        guidance: 'Combine descriptor profiling with intensity or liking measures instead of relying on a single sensory method.',
        citationIds: [citation.id],
      };
    }
    return {
      title: 'Method context for the next round',
      guidance: 'Use this source to shape the next validation round; it provides methodological context and is not product-specific proof.',
      citationIds: [citation.id],
    };
  });

  const merged = new Map<string, ScientificContextData['guidance'][number]>();
  candidates.forEach(candidate => {
    const existing = merged.get(candidate.title);
    if (existing) existing.citationIds.push(...candidate.citationIds);
    else merged.set(candidate.title, candidate);
  });
  return [...merged.values()].slice(0, 3);
}

function evidenceAssistGuidance(
  input: CommercializationReportPdfInput,
): ScientificContextData['guidance'] {
  const cards = input.snapshot.evidenceCards ?? [];
  const dimensions = input.reportContext?.dimensions ?? [];
  return cards
    .filter(card => card.claimPermission !== 'product_specific' && card.safeReportLanguage.trim())
    .map(card => {
      const searchTerms = [...card.appliesTo, card.topic]
        .flatMap(value => value.toLowerCase().split(/[^a-z0-9]+/))
        .filter(term => term.length >= 4);
      const relevantDimension = dimensions
        .filter(dimension => searchTerms.some(term => `${dimension.key} ${dimension.label}`.toLowerCase().includes(term)))
        .sort((left, right) => left.score - right.score)[0];
      const recommendation = card.safeReportLanguage.replace(/^[a-z]/, character => character.toUpperCase()).replace(/\s+$/, '');
      const projectRationale = relevantDimension
        ? relevantDimension.score < relevantDimension.threshold
          ? `${relevantDimension.label} is ${relevantDimension.score.toFixed(0)}/100, below the ${relevantDimension.threshold.toFixed(0)}/100 readiness line.`
          : `${relevantDimension.label} is ${relevantDimension.score.toFixed(0)}/100 and remains the closest relevant measure to the ${relevantDimension.threshold.toFixed(0)}/100 readiness line.`
        : card.evidenceUse === 'method_guidance'
          ? 'This will make the next study easier to compare, audit, and act on.'
          : 'This closes a named validation gap without treating external research as product proof.';
      return {
        title: card.topic.replace(/\b\w/g, character => character.toUpperCase()),
        guidance: `NFI recommends this as the next validation step: ${recommendation.replace(/[.]?$/, '.')} ${projectRationale}`,
        citationIds: [card.citationLabel ?? card.id],
      };
    })
    .slice(0, 3);
}

function primaryWatchPoint(snapshot: CommercializationReportSnapshot) {
  if (snapshot.evidence.provenance === 'synthetic') {
    return 'Replace the synthetic concept responses with a real target-panel study before interpreting concept or image preference.';
  }
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
  const qualifier = getDecisionQualifier(snapshot);
  const readinessThreshold = input.reportContext?.thresholds.readiness ?? 60;
  const productGateFailed = (snapshot.decision.gates ?? []).some(gate => gate.status === 'fail')
    || Object.values(snapshot.decision.dimensions).some(score => Number(score) < readinessThreshold);
  const launchPreparationApproved = snapshot.decision.outcome === 'GO' && !productGateFailed;
  const conceptCount = snapshot.evidence.responseCount;
  const category = /cashew.*cream cheese/i.test(`${snapshot.product.sampleName} ${snapshot.concept.name}`)
    ? 'Plant-based cream cheese'
    : snapshot.product.foodType;
  return {
    productName: snapshot.product.sampleName,
    category,
    reportTitle: launchPreparationApproved ? 'PRODUCT DECISION: GO' : 'PRODUCT DECISION REQUIRES REVIEW',
    decision: snapshot.decision.outcome,
    conditional: !launchPreparationApproved,
    readinessStage: launchPreparationApproved ? 'Approved for launch preparation · claims evidence limited' : 'Product review required',
    decisionSubheading: launchPreparationApproved
      ? 'The product clears the sensory decision gate and can proceed into launch preparation. Concept evidence is directional only and should not be used for demand, preference, purchase-intent, price, or final packaging claims.'
      : qualifier.caveatLine || 'Resolve the open product gate before launch preparation.',
    coreStrength: `${strengthLabel} (${Number(strengthScore).toFixed(0)}/100) is the strongest documented sensory result.`,
    mainWatchPoint: conceptCount < 30
      ? 'Concept evidence is directional only; consumer and market claims require broader validation.'
      : primaryWatchPoint(snapshot),
    nextAction: launchPreparationApproved
      ? 'Proceed with launch preparation. Confirm pilot-scale product performance, then build the claim-ready launch story through target-consumer validation, packaging approval, and claims/legal review.'
      : 'Resolve the failed product gate and repeat the sensory decision review.',
    issfScore: snapshot.decision.issfScore.toFixed(1),
    modelConfidence: `${snapshot.decision.confidence.toFixed(0)}/100`,
    conceptEvidence: `n=${conceptCount} · ${conceptCount < 30 ? 'directional only' : 'validated'}`,
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
  const ctx = input.reportContext;
  return {
    decision: ctx
      ? ctx.decision.stageDecision
      : snapshot.decision.outcome === 'GO'
        ? `${snapshot.product.sampleName} is approved for launch preparation.`
        : qualifier.conditional
          ? `${snapshot.product.sampleName} requires additional product validation before launch preparation.`
          : `${snapshot.product.sampleName} should advance into controlled commercialization preparation.`,
    // The DECISION block above and the final dashboard already carry the
    // conditional caveat; keep the rationale to the score facts to avoid repeating it.
    rationale: ctx
      ? `The sensory screening outcome is ${ctx.decision.sensoryOutcome}. ISSF is ${ctx.issfScore.toFixed(1)}/100 and evidence strength is ${(ctx.decision.modelConfidence * 100).toFixed(0)}/100, based on the documented coverage and quality inputs. ${strength} leads at ${Number(strengthScore).toFixed(0)}/100; ${watch} is the binding risk at ${Number(watchScore).toFixed(0)}/100.`
      : `The sensory GO decision is supported by an ISSF score of ${snapshot.decision.issfScore.toFixed(1)} and evidence strength of ${snapshot.decision.confidence.toFixed(0)}/100. ${strength} leads at ${Number(strengthScore).toFixed(0)}/100; ${watch} is the lowest dimension at ${Number(watchScore).toFixed(0)}/100.`,
    // Route the AI (or deterministic-fallback) executive recommendation into the
    // PDF — it was previously written but never rendered. Append the deterministic
    // implication so the lead-dimension guidance is preserved.
    commercialImplication: ctx
      ? `Product-screening evidence supports launch preparation. Concept evidence is directional at n=${ctx.concept.responseCount} and cannot yet support consumer-demand, preference, purchase-intent, price, or final packaging claims.`
      : `${cleanNarrativeText(snapshot.narrative.executiveSummary, snapshot.literatureCitations)} ${scoreImplication(strengthKey as keyof typeof snapshot.decision.dimensions, Number(strengthScore))}`.trim(),
    nextMove: ctx
      ? `${ctx.decision.nextGate}. Conditions: ${ctx.decision.conditions.join(' ')}`
      : `${cleanNarrativeText(snapshot.narrative.launchRecommendation, snapshot.literatureCitations)} In parallel, close the watch points and approval gates listed in the commercialization plan before external distribution.`,
  };
}

export function buildDecisionBasis(input: CommercializationReportPdfInput): DecisionBasisData {
  const { snapshot, reportContext: ctx } = input;
  const goThreshold = ctx?.thresholds.go ?? 75;
  const readiness = ctx?.thresholds.readiness ?? 60;
  const [weakestKey, weakestScore] = weakestDimension(snapshot);
  const sensoryN = ctx?.dimensions.find(item => item.sampleSize)?.sampleSize ?? null;
  const instrumentalCount = ctx?.instrumental.findings.length ?? 0;
  const limitations = ctx?.limitations.map(item => item.limitation) ?? [
    snapshot.evidence.provenance === 'synthetic'
      ? 'Concept and image-preference results are synthetic test data and provide no panel evidence.'
      : snapshot.evidence.responseCount < 30
      ? `Concept evidence is below the n>=30 operational threshold (current n=${snapshot.evidence.responseCount}).`
      : '',
    'External claims require claim-specific substantiation and approval.',
  ].filter(Boolean);
  return {
    decision: snapshot.decision.outcome,
    issfScore: snapshot.decision.issfScore.toFixed(1),
    goThreshold: goThreshold.toFixed(0),
    decisionMargin: `${snapshot.decision.issfScore >= goThreshold ? '+' : ''}${(snapshot.decision.issfScore - goThreshold).toFixed(1)} points versus the GO threshold`,
    evidenceStrength: `${snapshot.decision.confidence.toFixed(0)}/100`,
    evidenceStrengthDefinition: 'Evidence strength summarizes coverage and quality of the available decision inputs. It is not a calibrated probability that the decision is correct.',
    populations: [
      { label: 'Sensory evidence', value: sensoryN ? `n=${sensoryN}` : 'Sample size not captured', provenance: ctx?.dimensions[0]?.source ?? 'Saved sensory study' },
      {
        label: 'Concept evidence',
        value: `n=${snapshot.evidence.responseCount}`,
        provenance: snapshot.evidence.provenance === 'synthetic'
          ? 'Synthetic test data — not panel evidence'
          : snapshot.evidence.responseCount >= 30 ? 'Target-consumer evidence' : 'Directional only',
      },
      { label: 'Instrumental evidence', value: instrumentalCount ? `${instrumentalCount} finding${instrumentalCount === 1 ? '' : 's'}` : 'Not attached', provenance: ctx?.instrumental.includedInDecision ? 'Included in decision' : 'Context only or unavailable' },
    ],
    whatThisMeans: 'The product has cleared the internal product decision gate. The next question is not whether the tested sample can advance; it is whether the formula, packaging, claims, and commercial case can be validated for release.',
    gates: (snapshot.decision.gates ?? []).map(gate => ({ label: gate.label, status: gate.status, detail: gate.detail })),
    limitations: limitations.slice(0, 4),
    sensitivity: [
      `The current score is ${Math.abs(snapshot.decision.issfScore - goThreshold).toFixed(1)} points ${snapshot.decision.issfScore >= goThreshold ? 'above' : 'below'} the GO threshold.`,
      `${formatDecisionDimension(weakestKey as keyof typeof snapshot.decision.dimensions)} is the nearest sensory constraint at ${Number(weakestScore).toFixed(0)}/100, ${(Number(weakestScore) - readiness).toFixed(0)} points above the readiness line.`,
      `A critical product-gate failure, invalid evidence, ISSF below ${goThreshold.toFixed(0)}, or a required dimension below ${readiness.toFixed(0)} would require a new decision review.`,
    ],
    managementDecision: snapshot.decision.outcome === 'GO'
      ? 'Authorize controlled launch preparation and the named validation work. Do not authorize consumer, demand, price, packaging-preference, nutrition, health, or superiority claims at this stage.'
      : 'Do not authorize launch preparation until the documented decision blockers are resolved and the product is reviewed again.',
    reportStatus: input.status === 'approved' ? 'Approved report' : 'Draft for review',
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
          dim.population,
          dim.measures.length ? dim.measures.slice(0, 2).join(', ') : null,
        ].filter(Boolean).join(' · ')
      : 'Sensory screening result';
    return {
      label: formatDecisionDimension(key as keyof typeof snapshot.decision.dimensions),
      value: `${Number(score).toFixed(0)}/100`,
      score: Number(score),
      evidence,
      implication: scoreImplication(key as keyof typeof snapshot.decision.dimensions, Number(score)),
      explanation: dim
        ? dim.calculationExplanation
        : undefined,
      benchmark: dim?.benchmark,
      agreement: dim?.agreement,
    };
  });
  const purchaseIntent = snapshot.evidence.purchaseIntent;
  return {
    intro: 'The product cleared the sensory screen. These results explain why it should move forward and what still needs validation.',
    metrics: [
      ...dimensions,
      ...(purchaseIntent !== null ? [{
        label: 'Purchase intent',
        value: purchaseIntent.toFixed(1),
        score: null,
        evidence: `${snapshot.evidence.responseCount} concept response${snapshot.evidence.responseCount === 1 ? '' : 's'}`,
        implication: snapshot.evidence.provenance !== 'synthetic' && snapshot.evidence.responseCount >= 30
          ? 'Use as supporting buyer evidence after confirming the panel matches the target consumer.'
          : snapshot.evidence.provenance === 'synthetic'
            ? 'Test output only; replace with real panel evidence before interpreting purchase intent.'
            : 'Use only as a directional signal; repeat with a broader target panel before forecasting demand.',
      }] : []),
    ],
    readinessThreshold: reportContext?.thresholds.readiness ?? 60,
    evidenceNote: getEvidenceStrengthNote(snapshot.evidence.responseCount, snapshot.evidence.provenance),
    definitions: reportContext
      ? `Study basis: ${reportContext.dimensions[0]?.population ?? 'sensory panel not documented'}; concept test n=${snapshot.evidence.responseCount}. Scores are shown on a 0–100 scale. Evidence caveat: variability and agreement statistics were not included in this report snapshot and should be added to the next validation round.`
      : `Study basis: sensory screening plus concept test n=${snapshot.evidence.responseCount}. Scores are shown on a 0–100 scale. Evidence caveat: variability and agreement statistics were not included in this report snapshot and should be added to the next validation round.`,
  };
}

export function buildScientificContext(input: CommercializationReportPdfInput): ScientificContextData {
  const instrumental = input.reportContext?.instrumental;
  const citations = (input.snapshot.literatureCitations ?? []).slice(0, 5);
  const safeGuidance = evidenceAssistGuidance(input);
  const parameters = [...(instrumental?.parameters ?? [])]
    .sort((left, right) => {
      const leftOutside = left.status === 'below_expected_range' || left.status === 'above_expected_range';
      const rightOutside = right.status === 'below_expected_range' || right.status === 'above_expected_range';
      return Number(rightOutside) - Number(leftOutside)
        || right.observationCount - left.observationCount
        || left.label.localeCompare(right.label);
    })
    .map(parameter => ({
      id: parameter.id,
      label: parameter.label,
      family: parameter.family,
      value: parameter.mean,
      unit: parameter.unit,
      observationCount: parameter.observationCount,
      standardDeviation: parameter.standardDeviation ?? null,
      minimum: parameter.minimum ?? null,
      maximum: parameter.maximum ?? null,
      status: parameter.status,
    }));
  return {
    instrumentalAvailable: Boolean(instrumental?.available),
    instrumentalIncludedInDecision: Boolean(instrumental?.includedInDecision),
    instrumentalNote: !instrumental?.available
      ? instrumental?.absenceNote ?? 'No project instrumental dataset is attached to this saved report version.'
      : instrumental.absenceNote
        ?? (instrumental.includedInDecision
          ? 'Instrumental findings were included in the current product decision.'
          : 'Instrumental findings provide supporting context and did not independently determine the decision.'),
    findings: (instrumental?.findings ?? []).map(finding => ({
      source: finding.source,
      finding: finding.finding,
      benchmark: finding.benchmark,
      decisionEffect: finding.decisionEffect,
      replicateCount: finding.replicateCount ?? null,
    })),
    parameters,
    parameterCount: parameters.length,
    benchmarkedParameterCount: parameters.filter(parameter => parameter.status !== 'not_benchmarked').length,
    guidance: safeGuidance.length > 0 ? safeGuidance : literatureGuidance(citations),
    sources: citations.map(citation => ({ id: citation.id, ...literatureMetadata(citation) })),
  };
}

export function buildConsumerEvidence(input: CommercializationReportPdfInput): ConsumerEvidenceData {
  const { evidence } = input.snapshot;
  return {
    responseCount: evidence.responseCount,
    evidenceStrength: getEvidenceStrength(evidence.responseCount, evidence.provenance),
    purchaseIntent: evidence.purchaseIntent,
    scaleMetrics: evidence.scaleMetrics.slice(0, 4),
    descriptors: evidence.topSelections.slice(0, 6).map(item => ({
      label: item.option,
      percentage: item.percentage,
      count: item.count,
    })),
    comments: evidence.comments.slice(0, 2),
    boundary: getEvidenceStrengthNote(evidence.responseCount, evidence.provenance),
  };
}

export function buildPanelStudyProfile(input: CommercializationReportPdfInput): PanelStudyProfileData {
  const profile = input.snapshot.panelDemographics;
  const conceptCount = input.snapshot.evidence.responseCount;
  const profileMatchesEvidence = Boolean(profile && profile.participantCount === conceptCount);
  const matched = profileMatchesEvidence ? profile?.matchedProfileCount ?? 0 : 0;
  const profileStatus = !profileMatchesEvidence || matched === 0
    ? 'missing'
    : (profile?.profileCoveragePercentage ?? 0) >= 80
      ? 'available'
      : 'partial';
  return {
    sensoryPopulation: input.reportContext?.dimensions[0]?.population ?? 'Sensory panel size not documented',
    conceptPopulation: `Concept respondents n=${conceptCount}`,
    profileCoverage: profileMatchesEvidence && profile
      ? `${profile.matchedProfileCount}/${profile.participantCount} respondent profiles (${profile.profileCoveragePercentage.toFixed(0)}%)`
      : profile
        ? `Profile summary n=${profile.participantCount} does not match concept evidence n=${conceptCount}`
        : 'Respondent profiles not attached',
    profileStatus,
    dimensions: profileMatchesEvidence ? profile?.dimensions ?? [] : [],
    samplingBoundary: profileMatchesEvidence
      ? profile?.representativenessNote
        ?? 'Respondent profiles were not attached to this report version. Demographic representativeness cannot be assessed.'
      : profile
        ? 'The saved demographic summary does not match the current concept-response population. Regenerate this report before interpreting panel composition.'
        : 'Respondent profiles were not attached to this report version. Demographic representativeness cannot be assessed.',
    disclosureRule: `Only aggregate demographics are shown. Cells below n=${profile?.minimumCellSize ?? 3} are suppressed and no participant identifiers are included.`,
    provenance: input.reportContext?.evidenceProvenance ?? input.snapshot.evidence.provenance ?? 'Not documented',
  };
}

export function buildMethodEvidence(input: CommercializationReportPdfInput): MethodEvidenceData {
  const ctx = input.reportContext;
  if (!ctx) {
    return {
      methodLabel: input.snapshot.decision.methodVersion,
      rows: [],
      issfFormula: 'Method details unavailable in this report snapshot.',
      gateLogic: 'Gate details unavailable.',
      confidenceRows: [],
      instrumentalRows: [],
      instrumentalNote: 'No instrumental evidence detail was supplied to the report builder.',
    };
  }
  return {
    methodLabel: ctx.methodology.methodId === ctx.methodology.methodVersion
      ? ctx.methodology.methodId
      : `${ctx.methodology.methodId} / ${ctx.methodology.methodVersion}`,
    rows: ctx.methodology.contributions.map(row => [
      row.dimension,
      row.score.toFixed(1),
      `${row.weightPct.toFixed(1)}%`,
      row.contribution.toFixed(1),
    ]),
    issfFormula: ctx.methodology.formula,
    gateLogic: ctx.methodology.conditionalReason,
    confidenceRows: ctx.methodology.confidenceCalculation.map(row => [
      row.input,
      `${row.score.toFixed(1)} × ${row.weightPct.toFixed(0)}%`,
      row.contribution.toFixed(1),
    ]),
    instrumentalRows: ctx.instrumental.findings.map(row => [
      row.source,
      row.finding,
      row.benchmark,
      row.decisionEffect,
    ]),
    instrumentalNote: ctx.instrumental.absenceNote ?? 'Instrumental findings are itemized below and are included in the decision snapshot.',
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
    snapshot.evidence.provenance !== 'synthetic' && snapshot.evidence.responseCount >= 30 && snapshot.evidence.topSelections.length > 0
      ? {
          title: 'Concept language can sharpen the product story',
          evidence: `The most-selected concept descriptors are: ${selectedDescriptors(snapshot)}.`,
          commercialMeaning: 'These words are more credible than invented marketing language because they reflect how panelists actually described the concept.',
          action: 'Use the strongest two or three terms in concept copy, then verify comprehension with the target audience.',
        }
      : snapshot.evidence.responseCount > 0
        ? {
            title: 'Concept response is not yet interpretable',
            evidence: `${snapshot.evidence.responseCount} concept response${snapshot.evidence.responseCount === 1 ? '' : 's'} ${snapshot.evidence.responseCount === 1 ? 'is' : 'are'} logged; selected terms are not reported as findings at this sample size.`,
            commercialMeaning: 'Do not use the selected terms as marketing language or evidence of consumer preference until a broader target-consumer test is complete.',
            action: 'Collect at least 30 target-consumer responses before interpreting descriptor frequency, purchase intent, or price feedback.',
          }
        : {
            title: 'Capture concept descriptors to sharpen the product story',
            evidence: 'No concept descriptors have been captured yet (no concept responses recorded).',
            commercialMeaning: 'Without panelist-described language, buyer-facing copy would rely on invented marketing terms that the evidence does not support.',
            action: 'Add a check-all-that-apply descriptor question to the concept test and collect a target-consumer panel before locking copy.',
          },
    {
      title: 'Keep concept conclusions proportional to the study',
      evidence: snapshot.evidence.provenance === 'synthetic'
        ? `${snapshot.evidence.responseCount} synthetic responses exercise the report workflow but provide no panel evidence.`
        : `${snapshot.evidence.responseCount} response${snapshot.evidence.responseCount === 1 ? '' : 's'} provide ${getEvidenceStrength(snapshot.evidence.responseCount, snapshot.evidence.provenance).toLowerCase()} concept evidence.`,
      commercialMeaning: snapshot.evidence.provenance !== 'synthetic' && snapshot.evidence.responseCount >= 30
        ? 'The concept read can support buyer discussion, but representativeness still determines how broadly it can be generalized.'
        : snapshot.evidence.provenance === 'synthetic'
          ? 'Use this output to test layout and calculations only, then replace it with a real study.'
          : 'The direction is useful for iteration, but it is not yet a demand forecast or representative consumer claim.',
      action: snapshot.evidence.provenance !== 'synthetic' && snapshot.evidence.responseCount >= 30
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

function clientHypothesis(value: string | undefined, fallback: string) {
  const cleaned = (value ?? '')
    .replace(/^Hypothesis\s*[—-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\.\s+(seeking|looking|wanting)\b/i, '. They are $1')
    .trim();
  return cleaned || fallback;
}

function conciseReason(value: string) {
  return value
    .replace(/^Hypothesis\s*[—-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim();
}

export function buildConceptPackaging(input: CommercializationReportPdfInput): ConceptPackagingData {
  const { snapshot } = input;
  const strategy = input.reportContext?.conceptStrategy;
  const hasVisual = Boolean(snapshot.concept.packagingImageUrl);
  const isCashewCreamCheese = /cashew.*cream cheese/i.test(`${snapshot.product.sampleName} ${snapshot.concept.name}`);
  const positioning = isCashewCreamCheese
    ? `${snapshot.product.sampleName} is positioned as a cashew-based soft cream cheese alternative built around smooth, creamy, spreadable texture and mild cheese character. This remains a positioning hypothesis until broader target-consumer validation is complete.`
    : clientHypothesis(
        strategy?.positioning,
        `${snapshot.product.sampleName} is a familiar ${snapshot.product.foodType.toLowerCase()} proposition built around the strongest validated sensory cues.`,
      );
  const consumerNeed = isCashewCreamCheese
    ? 'A plant-based soft cheese alternative that spreads cleanly and feels familiar in chilled use.'
    : clientHypothesis(
        strategy?.consumerNeed,
        `A credible ${snapshot.product.foodType.toLowerCase()} option that feels familiar and easy to use.`,
      );
  const usageOccasion = isCashewCreamCheese
    ? 'Bagels, crackers, dips, sandwiches, and other chilled spread occasions. Validate the highest-priority occasion in concept testing.'
    : clientHypothesis(strategy?.usageOccasion, 'Define and validate the lead usage occasion.');
  const reasonsToBelieve = isCashewCreamCheese ? [
    `The product cleared the internal sensory screen at ISSF ${snapshot.decision.issfScore.toFixed(1)}.`,
    'The sensory profile supports smooth, creamy, spreadable texture and mild cheese character.',
    (snapshot.decision.gates ?? []).some(gate => gate.status === 'fail')
      ? 'A critical product gate remains open and must be resolved.'
      : 'No critical product gate is open in the current evidence set.',
  ] : (strategy?.reasonsToBelieve ?? [
    `Sensory screening returned ${snapshot.decision.outcome} at ISSF ${snapshot.decision.issfScore.toFixed(1)}.`,
    `${formatDecisionDimension(topDimension(snapshot)[0] as keyof typeof snapshot.decision.dimensions)} is the strongest result.`,
  ]);
  return {
    conceptName: snapshot.concept.name || 'Concept direction not named',
    conceptDescription: positioning,
    positioning,
    targetConsumer: isCashewCreamCheese
      ? 'Flexitarian and plant-curious shoppers looking for a familiar, creamy chilled spread.'
      : clientHypothesis(snapshot.concept.targetMarket || strategy?.targetSegment, 'Priority shoppers in the category; refine the segment in concept validation.'),
    consumerNeed,
    usageOccasion,
    productPromise: isCashewCreamCheese ? 'Smooth, creamy, familiar plant-based cream cheese.' : consumerNeed,
    reasonsToBelieve: reasonsToBelieve.map(conciseReason).filter(Boolean).slice(0, 3),
    pricePoint: snapshot.concept.pricePoint
      ? `Test ${snapshot.concept.pricePoint} against category alternatives.`
      : 'Price remains to be tested against category alternatives.',
    validationQuestions: isCashewCreamCheese ? [
      'Validate whether target consumers recognize the product as a cashew-based soft cream cheese alternative, understand the usage occasion, find the packaging appealing, and accept the proposed price. Do not use preference, demand, price, or purchase-intent claims until the broader concept test is complete.',
    ] : strategy ? [
      conciseReason(strategy.conceptTestObjective),
      `Does the pack clearly communicate the ${snapshot.product.foodType} proposition?`,
      'Which usage occasion and price feel most credible?',
    ] : [],
    prohibitedClaims: strategy?.prohibitedClaims ?? [],
    packagingDirection: `Use the selected pack as a directional stimulus. Prioritize the product name, category cue, key ingredient, and an appetizing serving suggestion; final design and claims remain subject to validation.`,
    coreMessage: consumerNeed,
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
    competitiveFrame: 'Named benchmark or competitor products are not captured in this report version. Select category alternatives before testing differentiation, price, or shelf communication.',
    differentiation: isCashewCreamCheese
      ? 'Current evidence supports smooth, creamy, spreadable texture and mild cheese character. Superiority, distinctiveness, and preference versus competitors are not established.'
      : 'The strongest sensory cues define the working proposition; competitive superiority remains unvalidated.',
  };
}

export function buildCommercializationPlan(input: CommercializationReportPdfInput): CommercializationPlanData {
  const { snapshot, reportContext: ctx } = input;
  const count = snapshot.evidence.responseCount;
  const findAction = (pattern: RegExp) => ctx?.actions.find(action => pattern.test(action.workstream));
  const productAction = findAction(/pilot|texture|manufactur|shelf|product/i);
  const commercialAction = findAction(/concept|consumer|commercial|price|compet|economic/i);
  const approvalAction = findAction(/pack|claim|legal|regulat|approval/i);
  const actionTiming = (action: typeof productAction, fallback: string) => action?.dueDate
    ? new Date(action.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : fallback;
  const accountableFunction = (action: typeof productAction, fallback: string) => {
    const owner = action?.owner?.trim();
    return owner && !/not assigned|readiness gap/i.test(owner)
      ? owner
      : fallback;
  };
  const rows = [
    {
      workstream: 'Pilot manufacturing and product confirmation',
      rationale: 'Confirm repeatability and sensory consistency after scale-up.',
      protocol: 'Run representative pilot batches; repeat the critical sensory and instrumental measures; confirm process settings, yield, variability, and finished-product specifications.',
      completionEvidence: 'Approved pilot-batch record and QC report.',
      passingCriteria: 'Agreed sensory, quality, yield, and process criteria pass on representative pilot batches.',
      owner: accountableFunction(productAction, 'Product + Quality'),
      timing: actionTiming(productAction, 'Next pilot cycle'),
      budget: 'Not yet costed',
      nextGate: 'Pilot validation',
      sampleSizeRationale: '',
      failureDecision: 'Hold release, correct the failure, and repeat the affected validation.',
    },
    {
      workstream: 'Consumer, competition, price, and commercial economics',
      rationale: 'Market proof and economics remain unvalidated.',
      protocol: 'Run a powered target-consumer study; benchmark alternatives; test proposition and price; model product, pack, logistics, margin, trade spend, and launch investment.',
      completionEvidence: 'Consumer dataset, benchmark, price architecture, and approved economics model.',
      passingCriteria: `Concept n>=30${count >= 30 ? ' (met)' : ''} with documented panel fit; approved benchmark, price, margin, and launch scenarios.`,
      owner: accountableFunction(commercialAction, 'Insights + Commercial'),
      timing: actionTiming(commercialAction, 'Before buyer review'),
      budget: 'Not yet costed',
      nextGate: 'Investment review',
      sampleSizeRationale: 'Use at least 30 matched consumers for a directional read; use a powered sample for pricing, forecasting, or investment decisions.',
      failureDecision: 'Revise the proposition, price, economics, or channel and repeat the failed gate.',
    },
    {
      workstream: 'Packaging, regulatory, claims, and launch approval',
      rationale: 'The final pack and external statements require approval.',
      protocol: 'Validate pack and line performance; approve ingredients, allergens, nutrition, naming, labeling, and claims; complete launch review.',
      completionEvidence: 'Approved pack, line trial, label, claims matrix, and launch record.',
      passingCriteria: 'Pack tests pass; regulatory, legal, quality, and commercial approve release.',
      owner: accountableFunction(approvalAction, 'Packaging + Regulatory'),
      timing: actionTiming(approvalAction, 'Before external release'),
      budget: 'Not yet costed',
      nextGate: 'Launch approval',
      sampleSizeRationale: '',
      failureDecision: 'Do not release the affected element until corrected and approved.',
    },
  ];
  return {
    intro: 'Three programs close the remaining product, commercial, packaging, regulatory, and approval gaps.',
    rows,
    decisionGate: 'Move from launch preparation to launch execution only after pilot approval, commercial investment review, and packaging/regulatory launch approval.',
  };
}

export function buildProductReadiness(input: CommercializationReportPdfInput): ProductReadinessData {
  const { snapshot, reportContext: ctx } = input;
  const sensoryN = ctx?.dimensions.find(item => item.sampleSize)?.sampleSize ?? null;
  const instrumentalCount = ctx?.instrumental.findings.length ?? 0;
  return {
    intro: 'Product readiness separates the validated product evidence from the technical work still required for a repeatable, compliant launch product.',
    rows: [
      {
        area: 'Sensory performance',
        status: snapshot.decision.outcome === 'GO' ? 'Ready' : 'Pending',
        currentEvidence: `ISSF ${snapshot.decision.issfScore.toFixed(1)}; sensory panel ${sensoryN ? `n=${sensoryN}` : 'size not documented'}.`,
        decisionImpact: 'Supports controlled launch preparation for the tested product.',
        requiredEvidence: 'Repeat the critical sensory measures on the pilot-scale product.',
      },
      {
        area: 'Instrumental confirmation',
        status: instrumentalCount > 0 ? 'Ready' : 'Evidence gap',
        currentEvidence: instrumentalCount > 0 ? `${instrumentalCount} decision finding${instrumentalCount === 1 ? '' : 's'} recorded.` : 'No project instrumental findings are attached.',
        decisionImpact: instrumentalCount > 0 ? 'Supports the current product decision.' : 'Product consistency cannot be triangulated instrumentally.',
        requiredEvidence: instrumentalCount > 0 ? 'Repeat against pilot-scale specifications and QC ranges.' : 'Define instrumental specifications and collect project measurements.',
      },
      {
        area: 'Pilot manufacturing',
        status: 'Pending',
        currentEvidence: 'No validated pilot-batch or process-capability record is included.',
        decisionImpact: 'Scale-up could change texture, flavour, yield, or batch consistency.',
        requiredEvidence: 'Pilot batch record, process window, yield, variability, and release specifications.',
      },
      {
        area: 'Packaging compatibility',
        status: snapshot.concept.packagingImageUrl ? 'In progress' : 'Evidence gap',
        currentEvidence: snapshot.concept.packagingImageUrl ? 'A directional visual exists; technical pack performance is untested.' : 'No packaging direction or technical specification is attached.',
        decisionImpact: 'Seal integrity, product protection, fill performance, and chilled-life compatibility remain unknown.',
        requiredEvidence: 'Pack specification, line trial, seal/leak testing, compatibility, and transport validation.',
      },
      {
        area: 'Regulatory, labeling, and nutrition',
        status: 'Pending',
        currentEvidence: 'No signed ingredient, allergen, nutrition, naming, label, or claims review is included.',
        decisionImpact: 'Final label copy and nutrition or benefit claims cannot be released.',
        requiredEvidence: 'Approved ingredient list, allergen assessment, nutrition panel, legal name, and label review.',
      },
    ],
    summary: 'The tested product is ready for controlled launch preparation. Production release still requires pilot reproducibility, packaging validation, and regulatory approval.',
  };
}

export function buildCommercialReadiness(input: CommercializationReportPdfInput): CommercialReadinessData {
  const { snapshot } = input;
  const conceptN = snapshot.evidence.responseCount;
  const hasPrice = Boolean(snapshot.concept.pricePoint?.trim());
  return {
    intro: 'Commercial readiness shows which parts of the buyer and market case are supported, which remain hypotheses, and what must be quantified before launch investment.',
    rows: [
      {
        area: 'Positioning and proposition',
        status: 'In progress',
        currentEvidence: 'A product-specific positioning, target consumer, promise, and usage hypothesis are defined.',
        decisionImpact: 'Provides a coherent direction for concept and buyer testing.',
        requiredEvidence: 'Confirm clarity, relevance, distinctiveness, and priority occasion with target consumers.',
      },
      {
        area: 'Target-consumer validation',
        status: conceptN >= 30 ? 'In progress' : 'Requires validation',
        currentEvidence: `Concept test n=${conceptN}${conceptN < 30 ? '; insufficient for representative interpretation' : '; operational minimum reached'}.`,
        decisionImpact: conceptN < 30 ? 'Preference, demand, packaging, price, and purchase-intent conclusions remain unavailable.' : 'Directional consumer interpretation is available; representativeness still requires review.',
        requiredEvidence: 'Powered target-consumer study with documented panel fit, stimuli, measures, and analysis plan.',
      },
      {
        area: 'Competitive benchmark',
        status: 'Evidence gap',
        currentEvidence: 'Named products, price points, pack formats, and sensory benchmarks are not included.',
        decisionImpact: 'Differentiation and superiority cannot be established.',
        requiredEvidence: 'Select direct alternatives and compare sensory performance, proposition, price, pack, and claims.',
      },
      {
        area: 'Price architecture',
        status: hasPrice ? 'In progress' : 'Evidence gap',
        currentEvidence: hasPrice ? `Working price hypothesis: ${snapshot.concept.pricePoint}.` : 'No tested price or pack-price architecture is recorded.',
        decisionImpact: 'Price acceptance and value perception are not established.',
        requiredEvidence: 'Test price, pack size, value perception, and willingness to buy against category alternatives.',
      },
      {
        area: 'Unit economics',
        status: 'Evidence gap',
        currentEvidence: 'COGS, yield, packaging cost, logistics, trade terms, margin, and investment are not captured.',
        decisionImpact: 'Commercial viability and funding requirement cannot be calculated.',
        requiredEvidence: 'Costed bill of materials, conversion cost, landed cost, target margin, trade spend, and launch budget.',
      },
      {
        area: 'Channel and buyer strategy',
        status: 'Evidence gap',
        currentEvidence: 'Priority channel, buyer requirements, distribution model, and launch account are not documented.',
        decisionImpact: 'The route to shelf and buyer proof package remain undefined.',
        requiredEvidence: 'Select priority channel and accounts; document buyer criteria, distribution, merchandising, and launch timing.',
      },
      {
        area: 'Demand and launch forecast',
        status: 'Evidence gap',
        currentEvidence: 'No representative demand evidence, rate-of-sale assumption, or volume forecast is included.',
        decisionImpact: 'Revenue, capacity, working-capital, and launch-volume decisions cannot be authorized.',
        requiredEvidence: 'Build scenarios from validated demand inputs, distribution assumptions, rate of sale, repeat, and capacity.',
      },
    ],
    summary: 'Commercial development can continue, but investment approval requires a validated consumer case, competitive and price evidence, unit economics, a defined channel, and a documented launch forecast.',
  };
}

export function buildClaimsMatrix(input: CommercializationReportPdfInput): ClaimsMatrixData {
  const { snapshot } = input;
  const sensoryN = input.reportContext?.dimensions.find(item => item.sampleSize)?.sampleSize ?? null;
  const conceptN = snapshot.evidence.responseCount;
  const sensoryBasis = sensoryN ? `Sensory panel n=${sensoryN}` : 'Sensory panel size not documented';
  const testedConditions = 'Limited to the tested product and study conditions.';
  const directionalRequirement = `Complete target-consumer validation at n>=30 with documented panel fit.`;
  return {
    intro: 'Current release boundary: The product may be described as approved for launch preparation based on the tested sensory screen. Consumer preference, demand, price acceptance, purchase intent, packaging preference, nutrition, health, or superiority claims are not available until validated and approved.',
    rows: [
      {
        claim: 'Product advancement decision',
        scope: 'Internal decision statement',
        status: 'Supported',
        evidence: `GO at ISSF ${snapshot.decision.issfScore.toFixed(1)}; ${sensoryBasis}.`,
        permittedWording: 'Approved to proceed into launch preparation.',
        requirement: testedConditions,
      },
      {
        claim: 'Tested sensory results',
        scope: 'Internal decision statement',
        status: 'Supported',
        evidence: `Acceptance ${snapshot.decision.dimensions.hedonic.toFixed(0)}/100; texture ${snapshot.decision.dimensions.texture.toFixed(0)}/100.`,
        permittedWording: 'Report the measured results with sample size and study basis.',
        requirement: 'Repeat at pilot scale before production-performance claims.',
      },
      {
        claim: 'Consumer demand, price, and purchase intent',
        scope: 'External claim',
        status: conceptN >= 30 ? 'Directional' : 'Blocked',
        evidence: conceptN > 0 ? `Concept and purchase-intent observations exist at n=${conceptN}; market and price representativeness are not established.` : 'No concept, price, or purchase-intent evidence is available.',
        permittedWording: conceptN >= 30 ? 'Directional target-consumer response with the tested price stimulus and panel definition.' : 'No external demand, price-acceptance, or purchase-intent wording.',
        requirement: `${directionalRequirement} Use a realistic price and pack stimulus.`,
      },
      {
        claim: 'Packaging preference',
        scope: 'External claim',
        status: 'Blocked',
        evidence: 'The selected visual is a directional concept stimulus, not approved final artwork.',
        permittedWording: 'Directional packaging hypothesis for research use only.',
        requirement: 'Complete packaging validation, design approval, and legal review.',
      },
      {
        claim: 'Nutrition, health, or superiority benefits',
        scope: 'External claim',
        status: 'Blocked',
        evidence: 'No claim-specific substantiation is included in this report.',
        permittedWording: 'None until substantiated and approved.',
        requirement: 'Create a claim-specific evidence file and obtain legal approval.',
      },
    ],
    reportStatus: input.status === 'approved' ? 'Approved report' : 'Draft for review',
    releaseDecision: input.status === 'approved'
      ? 'Internal decision statements may be used within their documented evidence boundary. External marketing claims still require claim-specific substantiation and approval.'
      : 'External distribution is pending report approval. No external marketing claim is authorized until its specific evidence and approval requirement is complete.',
  };
}

export function buildRisks(input: CommercializationReportPdfInput): RisksData {
  const { snapshot, reportContext: ctx } = input;
  const count = snapshot.evidence.responseCount;
  const productRisk = snapshot.decision.prescriptions[0]?.action
    ?? `Protect texture performance (${snapshot.decision.dimensions.texture.toFixed(0)}/100), flavour stability, and batch consistency through pilot processing.`;
  return {
    intro: 'These are the issues most likely to change the commercial decision, weaken the buyer story, or delay launch readiness.',
    rows: [
      {
        category: 'Product risk',
        risk: productRisk,
        impact: 'A changed or inconsistent product experience could invalidate the current sensory screening outcome.',
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
        risk: 'Owners and completion dates are not assigned in the current report.',
        impact: 'Open actions can drift across R&D, design, legal, and commercial teams.',
        mitigation: 'Assign one accountable owner and due date to every plan row.',
        nextGate: 'Readiness review',
      },
    ],
    // Claims/limitations are legal-sensitive, so build this deterministically
    // from the actual gaps rather than the AI narrative (which can degrade to a
    // bare lead-in). Lists the concrete constraints a reviewer must clear.
    claimsNote: buildClaimsNote(snapshot),
    permittedNow: [
      `Product decision: ${snapshot.decision.outcome} for launch preparation at ISSF ${snapshot.decision.issfScore.toFixed(1)}.`,
      `The tested texture result is ${snapshot.decision.dimensions.texture.toFixed(0)}/100.`,
      'Results describe the tested product and study conditions only.',
    ],
    notPermitted: [
      ...(count < 30 ? [
        'Consumer preference',
        'Purchase demand',
        'Price acceptance',
        'Representative market response',
        'Packaging preference',
        'Validated purchase intent',
      ] : []),
    ],
    releaseConditions: ctx
      ? [...ctx.decision.conditions, `Cross-functional approval status must move from ${ctx.decision.approvalStatus} to approved.`]
      : [
          'Confirm the tested product profile at pilot scale.',
          'Complete target-consumer concept validation with at least 30 responses.',
          'Complete claims, legal, and cross-functional approval.',
        ],
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
  const ctx = input.reportContext;
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
      ['Evidence populations', ctx
        ? `${ctx.dimensions[0]?.population ?? 'Sensory panel not documented'}; concept test n=${ctx.concept.responseCount}; ${ctx.instrumental.findings.length} instrumental finding${ctx.instrumental.findings.length === 1 ? '' : 's'} recorded. Replicate counts are stated per instrumental source where available.`
        : `Concept test n=${snapshot.evidence.responseCount}.`],
      ['Evidence provenance', ctx?.evidenceProvenance ?? 'Not documented.'],
      ['Instrumental evidence', ctx?.instrumental.absenceNote ?? (ctx?.instrumental.findings.map(item => `${item.source}: ${item.finding}`).join(' | ') || 'Not itemized.')],
      ['Measured parameter register', ctx?.instrumental.parameters.length
        ? ctx.instrumental.parameters.map(parameter => `${parameter.label}=${parameter.mean}${parameter.unit ? ` ${parameter.unit}` : ''} (${parameter.observationCount || 'unspecified'} observations; ${parameter.status.replace(/_/g, ' ')})`).join(' | ')
        : 'No measured parameters attached.'],
      ['AI provenance', ctx?.imageProvenance.aiGenerated ? 'AI-generated concept visual labeled directional; prompt metadata retained with source project.' : 'No AI-generated report visual used.'],
      ['Conditions', ctx?.decision.conditions.join(' | ') ?? 'Not recorded.'],
      ['Approval status', input.status],
    ],
    approvalNote: input.status === 'approved'
      ? `Approved report version. Launch authorization: ${ctx?.decision.launchAuthorization ?? 'not documented'}. Confirm recipient permissions and final claims before distribution.`
      : 'Working report version. Cross-functional approval is required before external distribution.',
    references: snapshot.literatureCitations ?? [],
  };
}

export const reportPageHeadings = [
  'PRODUCT DECISION: GO',
  'Decision basis, evidence strength, and product gates',
  'Sensory performance against the readiness line',
  'Instrumental evidence, scientific guidance, and product risk',
  'Product readiness: sensory GO, technical checks pending',
  'The proposition is defined; market proof and economics remain open',
  'Three workstreams convert product GO into launch readiness',
  'Claims release status by evidence level',
] as const;

export const reportStrengthTone = strengthTone;
