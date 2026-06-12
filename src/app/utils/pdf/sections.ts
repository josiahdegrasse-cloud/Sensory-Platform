import {
  formatDecisionDimension,
  getEvidenceStrength,
  getEvidenceStrengthNote,
  type CommercializationReportSnapshot,
} from '../../lib/commercialization-report';
import type { GoStopTweakDecision } from '../go-stop-tweak-engine';
import {
  getConceptImageMode,
  getPromptStyle,
} from '../../../../supabase/functions/_shared/concept-image-catalog.ts';

export const AI_VISUAL_DISCLAIMER =
  'AI-generated concept visualization for directional testing. Final packaging requires design/legal review.';

/** "Packaging mockup · Premium natural" label for an AI-generated report visual, or null. */
export function packagingProvenanceLabel(snapshot: CommercializationReportSnapshot): string | null {
  if (!snapshot.concept.packagingImageAiGenerated) return null;
  const mode = getConceptImageMode(snapshot.concept.packagingImageMode).label;
  const style = snapshot.concept.packagingImagePromptStyle
    ? getPromptStyle(snapshot.concept.packagingImagePromptStyle).label
    : '';
  return style ? `${mode} · ${style}` : mode;
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
  /** PDF layout: navy/blue editorial (default) or the NFI cream/sage masthead. */
  reportTemplate?: 'standard' | 'editorial-sage';
}

export type EvidenceStrengthTone = 'established' | 'limited' | 'accent';

function strengthTone(responseCount: number): EvidenceStrengthTone {
  const strength = getEvidenceStrength(responseCount);
  if (strength === 'Established') return 'established';
  if (strength === 'Limited') return 'limited';
  return 'accent';
}

export interface CoverSectionData {
  organizationName: string;
  workspaceName: string;
  sampleName: string;
  foodType: string;
  decisionOutcome: string;
  strengthLabel: string;
  strengthTone: EvidenceStrengthTone;
  recommendedPath: string;
  generatedLabel: string;
  status: string;
  version: number;
  evidenceStrengthNote: string;
}

export function buildCoverData(input: CommercializationReportPdfInput): CoverSectionData {
  const { snapshot } = input;
  const strength = getEvidenceStrength(snapshot.evidence.responseCount);
  const generatedDate = new Date(snapshot.generatedAt);
  const generatedLabel = Number.isNaN(generatedDate.getTime())
    ? 'Date not available'
    : generatedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return {
    organizationName: input.organizationName || 'Food Platform',
    workspaceName: input.workspaceName,
    sampleName: snapshot.product.sampleName,
    foodType: snapshot.product.foodType,
    decisionOutcome: snapshot.decision.outcome,
    strengthLabel: `${strength} evidence`,
    strengthTone: strengthTone(snapshot.evidence.responseCount),
    recommendedPath: snapshot.narrative.launchRecommendation,
    generatedLabel,
    status: input.status,
    version: input.version,
    evidenceStrengthNote: getEvidenceStrengthNote(snapshot.evidence.responseCount),
  };
}

export interface TocEntry {
  number: string;
  title: string;
  detail: string;
}

export const TOC_ENTRIES: TocEntry[] = [
  { number: '1', title: 'Executive summary', detail: 'Decision, evidence strength, and the recommended path' },
  { number: '2', title: 'Product evidence', detail: 'Sensory dimensions, instrumental context, and decision rationale' },
  { number: '3', title: 'Concept and packaging', detail: 'Target market, positioning, panel evidence, and selected direction' },
  { number: '4', title: 'Commercialization plan', detail: 'Risks, mitigations, next actions, and approval boundaries' },
  { number: '5', title: 'Appendix and sources', detail: 'Method identifiers, report metadata, and evidence notes' },
];

export interface ExecutiveSummarySectionData {
  executiveSummary: string;
  highlights: string[];
  snapshotTiles: Array<[string, string]>;
  provenanceRows: string[][];
}

export function buildExecutiveSummarySection(input: CommercializationReportPdfInput): ExecutiveSummarySectionData {
  const { snapshot } = input;
  const strength = getEvidenceStrength(snapshot.evidence.responseCount);
  const responseCount = snapshot.evidence.responseCount;
  return {
    executiveSummary: snapshot.narrative.executiveSummary,
    highlights: [
      `Product tested: ${snapshot.product.sampleName} in the ${snapshot.product.foodType} category.`,
      `Evidence collected: saved sensory decision evidence and ${responseCount} concept response${responseCount === 1 ? '' : 's'}.`,
      `Decision result: ${snapshot.decision.outcome}, with an ISSF score of ${snapshot.decision.issfScore.toFixed(1)}.`,
      `Current concept direction: ${snapshot.concept.name}${snapshot.concept.targetMarket ? ` for ${snapshot.concept.targetMarket}` : ''}.`,
      `Recommended next step: ${responseCount < 30 ? 'continue buyer preparation while collecting broader concept validation.' : 'advance buyer review with claims and packaging approval.'}`,
    ],
    snapshotTiles: [
      ['Product', snapshot.product.sampleName],
      ['Category', snapshot.product.foodType],
      ['Decision', snapshot.decision.outcome],
      ['ISSF score', snapshot.decision.issfScore.toFixed(1)],
      ['Concept responses', String(responseCount)],
      ['Evidence strength', strength],
    ],
    provenanceRows: [
      ['Sensory decision evidence', 'Saved decision record', 'Deterministic ISSF dimensions and recommendation are tied to the saved product decision.'],
      ['Concept panel data', responseCount > 0 ? `Live responses (n=${responseCount})` : 'Not available', getEvidenceStrengthNote(responseCount)],
      ['Instrumental data', 'Not itemized in snapshot', 'Do not imply specific machine findings unless they are linked and shown in the source project.'],
      ['Reference/demo data', 'Not identified in snapshot', 'Any reference data must be labeled before client distribution.'],
      ['Generated narrative', 'Generated draft', 'Narrative explains saved evidence; it does not determine the GO decision.'],
      ['Administrative approval', input.status === 'approved' ? 'Approved' : 'Not approved', input.status === 'approved' ? 'This report version has been approved.' : 'Treat this report as a working draft or review copy.'],
    ],
  };
}

export interface ProductEvidenceSectionData {
  intro: string;
  dimensionBars: Array<{ label: string; value: number; interpretation: string }>;
  keyStrengths: string;
  watchPoints: string[] | null;
  watchPointsFallback: string;
  instrumentalNote: string;
  decisionTiles: [[string, string], [string, string], [string, string], [string, string]];
  decisionRecommendation: string;
  gates: NonNullable<GoStopTweakDecision['gates']>;
}

export function buildProductEvidenceSection(input: CommercializationReportPdfInput): ProductEvidenceSectionData {
  const { snapshot } = input;
  const strength = getEvidenceStrength(snapshot.evidence.responseCount);
  return {
    intro: 'The saved decision record summarizes sensory performance across four client-facing dimensions. Scores describe the tested product evidence; they are not consumer market-share estimates.',
    dimensionBars: Object.entries(snapshot.decision.dimensions).map(([dimension, score]) => ({
      label: formatDecisionDimension(dimension as keyof typeof snapshot.decision.dimensions),
      value: Number(score),
      interpretation: Number(score) >= 75
        ? 'Current evidence indicates a relative strength.'
        : Number(score) >= 60
          ? 'Current evidence is acceptable, with room to strengthen.'
          : 'This area should be reviewed before broader commercialization claims.',
    })),
    keyStrengths: snapshot.narrative.whyLiked,
    watchPoints: snapshot.decision.prescriptions.length > 0
      ? snapshot.decision.prescriptions.slice(0, 3).map(item => `${item.target}: ${item.action}`)
      : null,
    watchPointsFallback: 'No specific formulation watch points are stored in this report version. Review the source decision record before final handoff.',
    instrumentalNote: 'Specific instrumental or machine measurements are not itemized in this saved report snapshot. Review the linked project data before stating instrumental alignment or making measurement-specific claims.',
    decisionTiles: [
      ['Decision', snapshot.decision.outcome],
      ['ISSF score', snapshot.decision.issfScore.toFixed(1)],
      ['Model confidence', `${snapshot.decision.confidence.toFixed(0)}%`],
      ['Evidence strength', strength],
    ],
    decisionRecommendation: snapshot.decision.recommendation,
    gates: snapshot.decision.gates ?? [],
  };
}

export interface ConceptPackagingSectionData {
  conceptName: string;
  conceptDescription: string;
  positioning: string;
  targetConsumer: string;
  pricePoint: string;
  strengthTone: EvidenceStrengthTone;
  evidenceStrengthLabel: string;
  evidenceStrengthNote: string;
  recommendationItems: string[];
  /** Mode/style label when the selected visual is AI-generated, else null. */
  packagingProvenance: string | null;
  /** AI-visualization disclaimer when the selected visual is AI-generated, else null. */
  packagingDisclaimer: string | null;
}

export function buildConceptPackagingSection(input: CommercializationReportPdfInput): ConceptPackagingSectionData {
  const { snapshot } = input;
  const strength = getEvidenceStrength(snapshot.evidence.responseCount);
  return {
    conceptName: snapshot.concept.name || 'Concept direction not named',
    conceptDescription: snapshot.concept.description || 'No concept description is stored.',
    positioning: snapshot.concept.keyBenefits || 'Not specified.',
    targetConsumer: snapshot.concept.targetMarket || 'Not specified.',
    pricePoint: snapshot.concept.pricePoint || 'Not specified.',
    strengthTone: strengthTone(snapshot.evidence.responseCount),
    evidenceStrengthLabel: `${strength.toUpperCase()} CONCEPT EVIDENCE`,
    evidenceStrengthNote: getEvidenceStrengthNote(snapshot.evidence.responseCount),
    recommendationItems: [
      `Recommended path: ${snapshot.narrative.launchRecommendation}`,
      `Positioning: ${snapshot.concept.keyBenefits || snapshot.concept.description || 'Use the current tested concept direction.'}`,
      'Messaging: Lead with the tested product experience. Use lifestyle, nutrition, or health cues only when separately substantiated.',
      `Target consumer: ${snapshot.concept.targetMarket || 'Define and validate the priority buyer and consumer audience.'}`,
      `Packaging direction: ${snapshot.narrative.packagingRationale}`,
      `Evidence limitation: ${getEvidenceStrengthNote(snapshot.evidence.responseCount)}`,
    ],
    packagingProvenance: packagingProvenanceLabel(snapshot),
    packagingDisclaimer: snapshot.concept.packagingImageAiGenerated ? AI_VISUAL_DISCLAIMER : null,
  };
}

export interface EvidenceRisk {
  risk: string;
  why: string;
  mitigation: string;
}

export function evidenceRisks(snapshot: CommercializationReportSnapshot): EvidenceRisk[] {
  const count = snapshot.evidence.responseCount;
  const risks: Array<EvidenceRisk | null> = [
    count < 30 ? {
      risk: count === 0 ? 'No concept validation' : 'Limited concept panel',
      why: getEvidenceStrengthNote(count),
      mitigation: 'Collect a broader, appropriately targeted response set before making representative consumer claims.',
    } : null,
    snapshot.evidence.purchaseIntent !== null && count < 30 ? {
      risk: 'Purchase intent may be overstated',
      why: `The ${snapshot.evidence.purchaseIntent.toFixed(1)} purchase-intent result is based on only ${count} response${count === 1 ? '' : 's'}.`,
      mitigation: 'Present the result as directional and repeat the measure with a larger panel.',
    } : null,
    !snapshot.concept.packagingImageUrl ? {
      risk: 'Packaging direction is incomplete',
      why: 'No selected packaging visual is stored with this report.',
      mitigation: 'Select and approve a packaging direction before buyer-facing distribution.',
    } : null,
    {
      risk: 'Claims require review',
      why: 'Sensory and concept findings do not independently substantiate broad health, nutrition, or market claims.',
      mitigation: 'Complete legal and commercial review for every external-facing claim.',
    },
  ];
  return risks.filter((risk): risk is EvidenceRisk => Boolean(risk));
}

export interface RisksNextStepsSectionData {
  risks: EvidenceRisk[];
  nextSteps: string[];
  appendixRows: string[][];
}

export function buildRisksNextStepsSection(input: CommercializationReportPdfInput): RisksNextStepsSectionData {
  const { snapshot } = input;
  return {
    risks: evidenceRisks(snapshot),
    nextSteps: [
      snapshot.evidence.responseCount < 30 ? 'Collect a larger, appropriately targeted concept response set.' : 'Confirm the panel design and segment results before making representative claims.',
      'Refine and approve packaging around the strongest validated concept direction.',
      'Prepare a buyer-facing product story led by taste and product experience.',
      'Review all claims, packaging copy, and supporting evidence for legal and commercial approval.',
      'Keep the saved decision record and source project data with the final approved report.',
    ],
    appendixRows: [
      ['Decision record ID', snapshot.decision.recordId],
      ['Decision fingerprint', snapshot.decision.fingerprint],
      ['Decision method', snapshot.decision.methodVersion],
      ['Report version', String(input.version)],
      ['Report status', input.status],
      ['Export timestamp', new Date().toISOString()],
      ['Concept response count', String(snapshot.evidence.responseCount)],
      ...(snapshot.concept.packagingImageAiGenerated
        ? [['Concept visual provenance', `${packagingProvenanceLabel(snapshot)} — ${AI_VISUAL_DISCLAIMER}`]]
        : []),
      ['Source data note', 'Technical identifiers are retained here for traceability and are intentionally excluded from the main recommendation.'],
    ],
  };
}

export interface ClosingSectionData {
  organizationName: string;
  intro: string;
  sourceNotes: string[];
  distributionMessage: string;
}

export function buildClosingSection(input: CommercializationReportPdfInput): ClosingSectionData {
  const { snapshot } = input;
  return {
    organizationName: input.organizationName,
    intro: `${input.organizationName} prepared this commercialization report in ${input.workspaceName}. The document combines saved product evidence, a traceable decision record, concept feedback, and the approved report narrative.`,
    sourceNotes: [
      'Sensory findings should be read with the stated panel size and provenance.',
      'Instrumental claims should be checked against the linked source project before external use.',
      `The decision is tied to method ${snapshot.decision.methodVersion} and the stored decision fingerprint.`,
      `Concept evidence includes ${snapshot.evidence.responseCount} saved response${snapshot.evidence.responseCount === 1 ? '' : 's'}.`,
      `This export represents report version ${input.version} with status ${input.status}.`,
    ],
    distributionMessage: input.status === 'approved'
      ? 'This version is approved. Confirm claims, recipient permissions, and any client-specific confidentiality requirements before distribution.'
      : 'This version is not approved. Treat it as a working document and complete administrative sign-off before client distribution.',
  };
}
