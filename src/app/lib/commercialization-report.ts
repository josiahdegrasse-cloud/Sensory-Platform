import type { ConceptQuestion, ConceptResponse, ConceptTest, DecisionRecord } from './database';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import type { LiteratureCitation } from './report-agents/types';
import type { ReportSafeEvidenceCard } from './evidence-assist';
import type { EvidenceBundle } from './report-evidence-types';
import { NFI_LOGO_URL, NFI_ORGANIZATION_NAME } from './nfi-brand';

/** Default platform branding shown when no client/tenant profile is configured. */
export const DEFAULT_REPORT_ORGANIZATION_NAME = NFI_ORGANIZATION_NAME;
export const DEFAULT_REPORT_WORKSPACE_NAME = 'Sensory Analysis Workspace';
export const DEFAULT_REPORT_LOGO_URL = NFI_LOGO_URL;

export function resolveReportLogoUrl(
  organizationName: string,
  logoUrl?: string | null,
) {
  if (logoUrl) return logoUrl;
  return organizationName === DEFAULT_REPORT_ORGANIZATION_NAME
    ? DEFAULT_REPORT_LOGO_URL
    : null;
}

export interface ConceptEvidenceSummary {
  responseCount: number;
  scaleMetrics: Array<{ question: string; average: number; count: number }>;
  topSelections: Array<{ option: string; count: number; percentage: number }>;
  comments: string[];
  purchaseIntent: number | null;
}

export interface CommercializationReportSnapshot {
  product: {
    sampleId: string;
    sampleName: string;
    foodType: string;
  };
  decision: {
    recordId: string;
    outcome: 'GO';
    issfScore: number;
    confidence: number;
    recommendation: string;
    dimensions: GoStopTweakDecision['dimensionScores'];
    gates?: GoStopTweakDecision['gates'];
    prescriptions: GoStopTweakDecision['prescriptions'];
    methodVersion: string;
    fingerprint: string;
  };
  concept: {
    id: string;
    name: string;
    description: string;
    targetMarket: string;
    pricePoint: string;
    keyBenefits: string;
    packagingImageId: string | null;
    packagingImageUrl: string;
    // Provenance for the selected visual (absent on snapshots saved before the
    // professional image system, and on manually pasted image URLs).
    packagingImageMode?: string;
    packagingImagePromptStyle?: string;
    packagingImageAiGenerated?: boolean;
    reportCoverImageId?: string | null;
    reportCoverImageUrl?: string;
    reportCoverImageMode?: string;
    reportCoverImageSourceKind?: 'uploaded_reference' | 'reference_generated' | 'text_generated';
    reportCoverImageAiGenerated?: boolean;
    reportCoverApprovedForExternalUse?: boolean;
  };
  evidence: ConceptEvidenceSummary;
  formulation?: {
    versionId: string;
    versionNumber: number;
    fingerprint: string;
    reviewStatus: 'pending_review' | 'reviewed' | 'needs_revision';
    exactStatement?: string;
    reviewedIngredients: string[];
    verifiedAllergens: string[];
    readinessGaps: string[];
  };
  narrative: {
    executiveSummary: string;
    whyLiked: string;
    packagingRationale: string;
    launchRecommendation: string;
    claimCaution: string;
  };
  agentReview?: {
    mode: 'standard' | 'full' | 'quick_draft' | 'full_release_review';
    runAt?: string;
    runTimestamp?: string;
    reportContextHash: string;
    status?: 'passed' | 'partial' | 'blocked';
    exportStatus: string;
    qualityScore: number | null;
    agentsRun?: string[];
    criticalBlockers?: string[];
    warnings?: string[];
    polishSuggestions?: string[];
    evidenceAudit?: Record<string, unknown>;
    modelUsage?: unknown;
    estimatedCostUsd: number;
    usage: Array<{
      role: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
    }>;
    artifacts: Record<string, unknown>;
  };
  // Populated when the Report Release Review orchestrator ran with real
  // literature grounding. Must be carried through explicitly when saving —
  // see report-agent-review-panel.tsx's revisedSnapshot.
  literatureCitations?: LiteratureCitation[];
  /** Safe Evidence Assist guidance persisted with this report version. */
  evidenceCards?: ReportSafeEvidenceCard[];
  generatedAt: string;
}

/**
 * Replaces short-lived signed image URLs in an immutable report snapshot with
 * fresh URLs from the linked concept. Stored ids and approval provenance stay
 * unchanged; only transport URLs are refreshed for preview and export.
 */
export function refreshCommercializationSnapshotImageUrls(
  snapshot: CommercializationReportSnapshot,
  report: { packagingImageId?: string | null; coverImageId?: string | null },
  concept?: {
    imageIds?: string[];
    imageUrls: string[];
    reportCoverImageId?: string | null;
    reportCoverImageUrl?: string;
  } | null,
): CommercializationReportSnapshot {
  if (!concept) return snapshot;
  const packagingIndex = report.packagingImageId
    ? (concept.imageIds ?? []).indexOf(report.packagingImageId)
    : -1;
  const packagingImageUrl = packagingIndex >= 0
    ? concept.imageUrls[packagingIndex] || snapshot.concept.packagingImageUrl
    : snapshot.concept.packagingImageUrl;
  const reportCoverImageUrl = report.coverImageId
    && concept.reportCoverImageId === report.coverImageId
    && concept.reportCoverImageUrl
    ? concept.reportCoverImageUrl
    : snapshot.concept.reportCoverImageUrl;
  return {
    ...snapshot,
    concept: {
      ...snapshot.concept,
      packagingImageUrl,
      reportCoverImageUrl,
    },
  };
}

export type EvidenceStrength = 'Limited' | 'Directional' | 'Developing' | 'Established';

export function getEvidenceStrength(responseCount: number): EvidenceStrength {
  if (responseCount < 5) return 'Limited';
  if (responseCount < 15) return 'Directional';
  if (responseCount < 30) return 'Developing';
  return 'Established';
}

export function getEvidenceStrengthNote(responseCount: number) {
  if (responseCount === 0) {
    return 'No concept responses are available. Concept preference and purchase intent have not been validated.';
  }
  if (responseCount === 1) {
    return 'Limited concept evidence: only 1 panelist response is available. Treat concept preference as directional, not representative.';
  }
  if (responseCount < 30) {
    return `Concept evidence is based on ${responseCount} panelist responses. Treat preference and purchase-intent findings as directional until a broader panel is collected.`;
  }
  return `Concept evidence includes ${responseCount} panelist responses. Confirm the sample design is representative before making broad market claims.`;
}

const DIMENSION_LABELS: Record<keyof GoStopTweakDecision['dimensionScores'], string> = {
  hedonic: 'Overall sensory acceptance',
  texture: 'Texture performance',
  // CATA = the trained/consumer sensory panel's check-all-that-apply descriptor
  // profile. Deliberately NOT "panelist-selected descriptors" — that phrasing
  // collided with concept-test descriptors and made a sensory score look like it
  // came from concept responses that may not exist.
  cata: 'Sensory descriptor profile',
  emotional: 'Positive emotional response indicators',
};

export function formatDecisionDimension(dimension: keyof GoStopTweakDecision['dimensionScores']) {
  return DIMENSION_LABELS[dimension];
}

/** A dimension at or below this score is a launch blocker, not a footnote. */
export const WEAK_DIMENSION_THRESHOLD = 60;

export interface DecisionQualifier {
  /** True when the GO carries material caveats that belong next to the badge. */
  conditional: boolean;
  /** Reasons, each a clause suitable for joining into a sentence. */
  caveats: string[];
  /** Rendered caveat sentence, empty when not conditional. */
  caveatLine: string;
}

// A GO decision can coexist with a failing dimension or zero concept evidence.
// Surfacing that tension next to the badge is the difference between an honest
// readout and one that oversells confidence the data does not support.
export function getDecisionQualifier(
  snapshot: Pick<CommercializationReportSnapshot, 'decision' | 'evidence'>,
): DecisionQualifier {
  const caveats: string[] = [];
  const weak = Object.entries(snapshot.decision.dimensions)
    .filter(([, score]) => Number(score) < WEAK_DIMENSION_THRESHOLD)
    .map(([key]) => formatDecisionDimension(key as keyof GoStopTweakDecision['dimensionScores']));
  if (weak.length > 0) {
    caveats.push(
      `${weak.join(' and ')} ${weak.length === 1 ? 'is' : 'are'} below the ${WEAK_DIMENSION_THRESHOLD}/100 readiness line and must be remediated before launch`,
    );
  }
  if (snapshot.evidence.responseCount === 0) {
    caveats.push('the decision rests on sensory data only — no concept validation has been collected (n=0)');
  }
  const conditional = caveats.length > 0;
  return {
    conditional,
    caveats,
    caveatLine: conditional ? `Conditional GO — ${caveats.join('; ')}.` : '',
  };
}

function questionById(questions: ConceptQuestion[]) {
  return new Map(questions.map(question => [question.id, question]));
}

export function summarizeConceptResponses(
  questions: ConceptQuestion[],
  responses: ConceptResponse[],
): ConceptEvidenceSummary {
  const byId = questionById(questions);
  const scales = new Map<string, number[]>();
  const selections = new Map<string, number>();
  const comments: string[] = [];
  const purchaseScores: number[] = [];

  responses.forEach(response => {
    Object.entries(response.answers).forEach(([questionId, answer]) => {
      const question = byId.get(questionId);
      if (!question) return;
      if (typeof answer === 'number') {
        const values = scales.get(question.text) ?? [];
        values.push(answer);
        scales.set(question.text, values);
        if (question.category === 'purchase') purchaseScores.push(answer);
      } else if (Array.isArray(answer)) {
        answer.forEach(option => selections.set(option, (selections.get(option) ?? 0) + 1));
      } else if (question.type === 'open_text' && answer.trim()) {
        comments.push(answer.trim());
      } else if (answer.trim()) {
        selections.set(answer, (selections.get(answer) ?? 0) + 1);
      }
    });
  });

  return {
    responseCount: responses.length,
    scaleMetrics: [...scales.entries()]
      .map(([question, values]) => ({
        question,
        average: values.reduce((sum, value) => sum + value, 0) / values.length,
        count: values.length,
      }))
      .sort((a, b) => b.average - a.average),
    topSelections: [...selections.entries()]
      .map(([option, count]) => ({
        option,
        count,
        percentage: responses.length ? (count / responses.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    comments: comments.slice(0, 12),
    purchaseIntent: purchaseScores.length
      ? purchaseScores.reduce((sum, value) => sum + value, 0) / purchaseScores.length
      : null,
  };
}

/**
 * Rehydrates the decision detail needed by report generation from durable
 * records. Decision confirmation stores the audit identity and headline
 * scores; the evidence bundle stores the dimension and gate calculations.
 * Keeping this bridge here lets the report workspace work after a refresh
 * without copying transient state out of the Decision page.
 */
export function rebuildDecisionForCommercialization(
  record: DecisionRecord,
  bundle: EvidenceBundle,
): GoStopTweakDecision | null {
  if (record.decision !== 'GO') return null;

  const categories = bundle.categoryResults.filter(result => result.sampleId === record.sampleId);
  const scoreFor = (category: keyof GoStopTweakDecision['dimensionScores']) =>
    categories.find(result => result.category === category)?.score ?? record.issfScore;
  const sample = bundle.sampleSummaries.find(summary => summary.sampleId === record.sampleId);
  const gates = bundle.criticalAttributeResults
    .filter(result => result.sampleId === record.sampleId)
    .map(result => ({
      id: result.id,
      label: result.label,
      status: result.status,
      detail: result.detail,
      impact: result.impact,
    }));
  const watchPoints = gates
    .filter(gate => gate.status === 'watch' || gate.status === 'fail')
    .map((gate, index) => ({
      priority: index + 1,
      target: gate.label,
      action: gate.detail,
      expectedLift: Math.max(0, Math.abs(gate.impact)),
    }));
  const recommendation = record.note.trim()
    || bundle.decisionReasons.join(' ')
    || `Advance ${record.sampleName} into controlled commercialization preparation.`;

  return {
    sampleId: record.sampleId,
    sampleName: record.sampleName,
    issfScore: record.issfScore,
    confidenceScore: record.confidence,
    decision: 'GO',
    decisionStatus: 'ready',
    blockingReasons: [],
    recommendation,
    riskLevel: sample?.riskLevel ?? (gates.some(gate => gate.status === 'fail') ? 'high' : gates.some(gate => gate.status === 'watch') ? 'medium' : 'low'),
    details: bundle.decisionReasons,
    dimensionScores: {
      hedonic: scoreFor('hedonic'),
      texture: scoreFor('texture'),
      cata: scoreFor('cata'),
      emotional: scoreFor('emotional'),
    },
    gates,
    prescriptions: watchPoints,
    decisionFingerprint: record.decisionFingerprint,
    methodVersion: record.methodVersion,
  };
}

export function buildCommercializationSnapshot(input: {
  decisionRecord: DecisionRecord;
  liveDecision: GoStopTweakDecision;
  concept: ConceptTest;
  responses: ConceptResponse[];
  foodType: string;
  packagingImageId: string | null;
  packagingImageUrl: string;
  packagingImageMeta?: { mode: string; promptStyle: string } | null;
  reportCoverImageId?: string | null;
  reportCoverImageUrl?: string;
  reportCoverImageMeta?: {
    mode: string;
    sourceKind: 'uploaded_reference' | 'reference_generated' | 'text_generated';
    approvedForExternalUse: boolean;
  } | null;
}): CommercializationReportSnapshot {
  if (input.decisionRecord.decision !== 'GO' || input.liveDecision.decision !== 'GO') {
    throw new Error('Commercialization reports require a confirmed GO decision.');
  }
  const evidence = summarizeConceptResponses(input.concept.questions, input.responses);
  const strongestDimensions = Object.entries(input.liveDecision.dimensionScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([name, score]) => `${formatDecisionDimension(name as keyof GoStopTweakDecision['dimensionScores'])} (${score.toFixed(0)})`);
  const likedSignals = [
    ...evidence.topSelections.slice(0, 3).map(item => item.option),
    ...strongestDimensions,
  ];

  return {
    product: {
      sampleId: input.liveDecision.sampleId,
      sampleName: input.liveDecision.sampleName,
      foodType: input.foodType,
    },
    decision: {
      recordId: input.decisionRecord.id,
      outcome: 'GO',
      issfScore: input.liveDecision.issfScore,
      confidence: input.liveDecision.confidenceScore,
      recommendation: input.liveDecision.recommendation,
      dimensions: input.liveDecision.dimensionScores,
      gates: input.liveDecision.gates,
      prescriptions: input.liveDecision.prescriptions,
      methodVersion: input.liveDecision.methodVersion,
      fingerprint: input.liveDecision.decisionFingerprint,
    },
    concept: {
      id: input.concept.id,
      name: input.concept.name,
      description: input.concept.description,
      targetMarket: input.concept.targetMarket,
      pricePoint: input.concept.pricePoint,
      keyBenefits: input.concept.keyBenefits,
      packagingImageId: input.packagingImageId,
      packagingImageUrl: input.packagingImageUrl,
      packagingImageMode: input.packagingImageMeta?.mode,
      packagingImagePromptStyle: input.packagingImageMeta?.promptStyle,
      // An image with stored generation metadata is AI-generated; a manually
      // pasted URL has no metadata and gets no AI provenance note.
      packagingImageAiGenerated: Boolean(input.packagingImageMeta),
      reportCoverImageId: input.reportCoverImageId ?? null,
      reportCoverImageUrl: input.reportCoverImageUrl ?? '',
      reportCoverImageMode: input.reportCoverImageMeta?.mode,
      reportCoverImageSourceKind: input.reportCoverImageMeta?.sourceKind,
      reportCoverImageAiGenerated: Boolean(
        input.reportCoverImageMeta
        && input.reportCoverImageMeta.sourceKind !== 'uploaded_reference'
      ),
      reportCoverApprovedForExternalUse: Boolean(input.reportCoverImageMeta?.approvedForExternalUse),
    },
    evidence,
    narrative: {
      executiveSummary: `${input.liveDecision.sampleName} has a confirmed GO recommendation, with an ISSF score of ${input.liveDecision.issfScore.toFixed(1)}. The linked ${input.concept.name} concept was evaluated by ${evidence.responseCount} panelist${evidence.responseCount === 1 ? '' : 's'}. ${getEvidenceStrengthNote(evidence.responseCount)}`,
      whyLiked: likedSignals.length
        ? `The strongest available signals are ${likedSignals.join(', ')}. These findings combine the confirmed sensory dimensions with language selected during concept evaluation.`
        : `The formulation achieved a GO decision through its sensory performance. Additional concept responses will strengthen the consumer-language evidence.`,
      packagingRationale: input.packagingImageUrl
        ? `The selected packaging expresses the current concept positioning for ${input.concept.targetMarket || 'the target market'} and is the recommended lead visual for the next review round.`
        : 'A packaging visual must be selected before this report can be approved.',
      launchRecommendation: `Advance ${input.liveDecision.sampleName} and the selected packaging into buyer review. This recommendation is tied to the confirmed GO decision for this product, while broader concept validation continues.`,
      claimCaution: `${getEvidenceStrengthNote(evidence.responseCount)} Broader consumer, nutrition, or commercial claims require representative validation and legal review.`,
    },
    generatedAt: new Date().toISOString(),
  };
}
