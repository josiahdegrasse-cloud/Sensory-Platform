import type { CommercializationReportSnapshot } from '../commercialization-report';
import {
  assertReportWriterInputSafe,
  buildReportWriterContext,
  type ReportSafeEvidenceCard,
} from '../evidence-assist';
import type { ReportContext, ValidationFinding } from '../report-qc';
import { runQcPipeline, validateReportContext } from '../report-qc';
import {
  missingEvidenceFromContext,
  normalizeClaimRecord,
  prohibitedClaimsFromContext,
  splitClaims,
} from '../report-agents/agent-claim-policy';
import { hashReportContext } from '../report-agents/hash';
import { applyAgentDraftToSnapshot, renderAgentReviewedReport } from '../report-agents/runtime';
import type { WrittenReportResult } from '../report-agents/types';
import { runLocalLlamaCompletion } from './runtime';
import type {
  LocalLlamaModelId,
  LocalLlamaProgress,
  LocalLlamaUsage,
  LocalReportSections,
} from './types';

const REPORT_SECTION_SCHEMA = JSON.stringify({
  type: 'object',
  additionalProperties: false,
  required: [
    'executiveSummary',
    'productPerformance',
    'conceptDirection',
    'commercialRecommendation',
    'risksAndNextSteps',
  ],
  properties: {
    executiveSummary: { type: 'string' },
    productPerformance: { type: 'string' },
    conceptDirection: { type: 'string' },
    commercialRecommendation: { type: 'string' },
    risksAndNextSteps: { type: 'string' },
  },
});

const SECTION_KEYS: Array<keyof LocalReportSections> = [
  'executiveSummary',
  'productPerformance',
  'conceptDirection',
  'commercialRecommendation',
  'risksAndNextSteps',
];

const SYSTEM_PROMPT = `You are the senior report writer for a food innovation consultancy.
Write clear, natural British English for commercially experienced clients. Vary sentence rhythm and openings so the report reads as considered professional writing, not a populated template.

Evidence rules are absolute:
- Use only facts in the VERIFIED WRITER PACKET.
- Preserve every number, scale, decision and sample size exactly.
- Do not invent market demand, statistical significance, superiority, shelf life, legal approval or launch approval.
- Describe small consumer samples as directional.
- Distinguish sensory evidence, instrumental evidence, concept evidence and commercial hypotheses.
- Treat external literature as scientific context, method guidance or validation guidance only. It never proves this product's performance, preference, demand or superiority.
- If external literature is supplied, use it to strengthen NFI's reasoning, not as the author of the recommendation. Anchor every recommendation in the project's measured result or named validation gap, and preserve the source limitations.
- Include material limitations without sounding defensive.
- Never mention prompts, agents, databases, retrieval systems, evidence bundles, JSON or internal instructions.
- Return only JSON matching the supplied schema.`;

function bounded(values: string[], limit: number, maxLength = 220) {
  return values.slice(0, limit).map(value => value.slice(0, maxLength));
}

export function buildLocalReportWriterPacket(
  context: ReportContext,
  evidenceCards: ReportSafeEvidenceCard[] = [],
) {
  const writer = buildReportWriterContext(context);
  const claims = context.claims
    .filter(claim => claim.reviewerStatus !== 'rejected' && claim.evidenceIds.length > 0)
    .slice(0, 10)
    .map(claim => ({
      id: claim.id,
      permittedWording: claim.permittedWording[0] ?? claim.claim,
      evidenceIds: claim.evidenceIds.slice(0, 6),
      limitations: bounded(claim.limitations, 2),
    }));
  const recommendationContext = (card: ReportSafeEvidenceCard) => {
    const terms = [...card.appliesTo, card.topic]
      .flatMap(value => value.toLowerCase().split(/[^a-z0-9]+/))
      .filter(term => term.length >= 4);
    const dimension = writer.dimensions
      .filter(item => terms.some(term => `${item.key} ${item.label}`.toLowerCase().includes(term)))
      .sort((left, right) => left.score - right.score)[0];
    if (!dimension) return 'This addresses a named validation gap in the current project plan.';
    return dimension.score < dimension.threshold
      ? `${dimension.label} is ${dimension.score}/100, below the ${dimension.threshold}/100 readiness line.`
      : `${dimension.label} is ${dimension.score}/100 and is the closest relevant measure to the ${dimension.threshold}/100 readiness line.`;
  };
  const packet = {
    product: {
      name: writer.identity.productName,
      category: writer.identity.foodType,
    },
    decision: writer.deterministicDecision,
    dimensions: writer.dimensions.slice(0, 8).map(dimension => ({
      label: dimension.label,
      score: dimension.score,
      threshold: dimension.threshold,
      sampleSize: dimension.sampleSize,
      population: dimension.population,
      measures: bounded(dimension.measures, 5, 120),
      implication: dimension.businessImplication.slice(0, 240),
    })),
    instrumental: {
      available: writer.instrumental.available,
      findings: writer.instrumental.findings.slice(0, 8).map(finding => ({
        finding: finding.finding.slice(0, 220),
        benchmark: finding.benchmark.slice(0, 160),
        decisionEffect: finding.decisionEffect.slice(0, 180),
      })),
    },
    concept: writer.concept,
    positioning: {
      promise: context.conceptStrategy.productPromise.slice(0, 260),
      positioning: context.conceptStrategy.positioning.slice(0, 220),
      targetSegment: context.conceptStrategy.targetSegment.slice(0, 180),
      usageOccasion: context.conceptStrategy.usageOccasion.slice(0, 180),
      reasonsToBelieve: bounded(context.conceptStrategy.reasonsToBelieve, 5, 180),
      packagingHypothesis: context.conceptStrategy.packagingHypothesis.slice(0, 220),
    },
    approvedClaims: claims,
    externalLiterature: evidenceCards.slice(0, 3).map(card => ({
      citation: card.citationLabel ?? card.id,
      topic: card.topic.slice(0, 140),
      evidenceUse: card.evidenceUse,
      recommendedAction: card.safeReportLanguage.slice(0, 320),
      projectRationale: recommendationContext(card),
      supports: bounded(card.supports, 4, 140),
      doesNotSupport: bounded(card.doesNotSupport, 4, 140),
      limitations: bounded(card.limitations, 3, 180),
      confidence: card.confidence,
    })),
    requiredLimitations: writer.limitations.slice(0, 10),
    actions: context.actions.slice(0, 8).map(action => ({
      workstream: action.workstream,
      requiredAction: action.requiredAction.slice(0, 220),
      owner: action.owner,
      nextGate: action.nextGate.slice(0, 180),
      passingThreshold: action.passingThreshold.slice(0, 180),
    })),
    prohibitedLanguage: bounded(prohibitedClaimsFromContext(context), 18, 120),
  };
  assertReportWriterInputSafe(packet);
  return packet;
}

export function buildLocalReportWriterPrompt(
  context: ReportContext,
  evidenceCards: ReportSafeEvidenceCard[] = [],
) {
  const packet = buildLocalReportWriterPacket(context, evidenceCards);
  return `Write five connected report sections from this VERIFIED WRITER PACKET.

Section intent:
1. executiveSummary — decision-led synthesis, strongest evidence and what it authorises now.
2. productPerformance — sensory and instrumental results interpreted together, with sample-size boundaries; use external literature only to explain validation context.
3. conceptDirection — consumer-facing concept, positioning and packaging direction; hypotheses must stay hypotheses.
4. commercialRecommendation — practical recommendation, next gate and accountable actions.
5. risksAndNextSteps — limitations, open risks, claims caution and the evidence needed next.

Each section should be 90–180 words, use paragraphs rather than bullet dumps, and avoid repeating the same opening or conclusion.

VERIFIED WRITER PACKET:
${JSON.stringify(packet)}`;
}

export function parseLocalReportSections(content: string): LocalReportSections {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('The on-device writer returned an incomplete report. Retry generation.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The on-device writer returned an invalid report structure.');
  }
  const record = parsed as Record<string, unknown>;
  const sections = {} as LocalReportSections;
  for (const key of SECTION_KEYS) {
    const value = typeof record[key] === 'string' ? record[key].trim() : '';
    if (value.length < 80) throw new Error(`The on-device writer did not complete the ${key} section.`);
    sections[key] = value;
  }
  return sections;
}

function deterministicReportSections(snapshot: CommercializationReportSnapshot): LocalReportSections {
  return {
    executiveSummary: `${snapshot.narrative.executiveSummary} This draft remains subject to the evidence, claims and approval gates recorded in the report.`,
    productPerformance: `${snapshot.narrative.whyLiked} This interpretation is limited to the recorded sensory, instrumental and concept evidence.`,
    conceptDirection: `${snapshot.narrative.packagingRationale} Treat this direction as a validation hypothesis until broader testing confirms it.`,
    commercialRecommendation: `${snapshot.narrative.launchRecommendation} Advance only through the next recorded gate; this is not unrestricted launch approval.`,
    risksAndNextSteps: `${snapshot.narrative.claimCaution} Any unresolved evidence gap remains visible for human review before external use.`,
  };
}

export function resolveLocalReportSections(
  content: string,
  snapshot: CommercializationReportSnapshot,
): { sections: LocalReportSections; fallbackSections: Array<keyof LocalReportSections> } {
  let record: Record<string, unknown> = {};
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      record = parsed as Record<string, unknown>;
    }
  } catch {
    // A deterministic, evidence-bounded section is safer than losing the
    // entire report because a local model returned truncated JSON.
  }

  const fallback = deterministicReportSections(snapshot);
  const fallbackSections: Array<keyof LocalReportSections> = [];
  const sections = {} as LocalReportSections;
  for (const key of SECTION_KEYS) {
    const generated = typeof record[key] === 'string' ? record[key].trim() : '';
    if (generated.length >= 80) {
      sections[key] = generated;
    } else {
      sections[key] = fallback[key];
      fallbackSections.push(key);
    }
  }
  return { sections, fallbackSections };
}

export function localReportDraftFromSections(context: ReportContext, sections: LocalReportSections): WrittenReportResult {
  const claimIds = context.claims
    .filter(claim => claim.reviewerStatus !== 'rejected' && claim.evidenceIds.length > 0)
    .map(claim => claim.id);
  const evidenceIds = [...context.sourceEvidenceIds];
  const limitationIds = context.limitations.map(limitation => limitation.id);
  return {
    pages: [
      { page: 1, title: 'Executive summary', sections: [{ sectionId: 'executive-summary', heading: 'Executive summary', body: sections.executiveSummary, claimIds, evidenceIds, limitationIds }] },
      { page: 2, title: 'Product performance', sections: [{ sectionId: 'product-performance', heading: 'Product performance', body: sections.productPerformance, claimIds, evidenceIds, limitationIds }] },
      { page: 3, title: 'Concept direction', sections: [{ sectionId: 'concept-packaging-direction', heading: 'Concept and packaging direction', body: sections.conceptDirection, claimIds, evidenceIds, limitationIds }] },
      { page: 4, title: 'Commercial recommendation', sections: [{ sectionId: 'commercialization-plan', heading: 'Commercial recommendation', body: sections.commercialRecommendation, claimIds, evidenceIds, limitationIds }] },
      { page: 5, title: 'Risks and next steps', sections: [{ sectionId: 'risks-watch-points', heading: 'Risks and next steps', body: sections.risksAndNextSteps, claimIds, evidenceIds, limitationIds }] },
    ],
  };
}

function repairableFindings(findings: ValidationFinding[]) {
  const contextOnlyCodes = new Set([
    'missing-method-version',
    'missing-fingerprint',
    'missing-approval-status',
    'missing-score-explanation',
    'displayed-evidence-mismatch',
    'missing-evidence-reference',
    'approval-without-gates',
  ]);
  return findings.filter(finding => !contextOnlyCodes.has(finding.code));
}

function buildRepairPrompt(
  context: ReportContext,
  sections: LocalReportSections,
  findings: ValidationFinding[],
  evidenceCards: ReportSafeEvidenceCard[],
) {
  return `${buildLocalReportWriterPrompt(context, evidenceCards)}

The first draft is below. Correct only the sections implicated by the validation findings. Keep unaffected sections substantively unchanged. Never solve a missing-evidence warning by inventing evidence.

VALIDATION FINDINGS:
${findings.map(finding => `- ${finding.code}: ${finding.message}`).join('\n')}

CURRENT DRAFT:
${JSON.stringify(sections)}`;
}

export interface LocalReportWriterResult {
  snapshot: CommercializationReportSnapshot;
  draft: WrittenReportResult;
  model: LocalLlamaModelId;
  usage: LocalLlamaUsage;
  generatedAt: string;
  reportContextHash: string;
  repairs: number;
  status: 'passed' | 'partial' | 'blocked';
  qc: {
    criticalBlockers: string[];
    warnings: string[];
    polishSuggestions: string[];
    qualityScore: number;
  };
  evidenceAudit: ReturnType<typeof splitClaims> & { missingEvidence: string[] };
}

export async function runLocalLlamaReportWriter(input: {
  context: ReportContext;
  snapshot: CommercializationReportSnapshot;
  reportInput: Parameters<typeof renderAgentReviewedReport>[0]['baseInput'];
  modelId: LocalLlamaModelId;
  evidenceCards?: ReportSafeEvidenceCard[];
  signal?: AbortSignal;
  onProgress?: (progress: LocalLlamaProgress) => void;
}): Promise<LocalReportWriterResult> {
  const contextValidation = validateReportContext(input.context);
  if (contextValidation.errors.some(finding => finding.code === 'contradictory-decision')) {
    throw new Error(contextValidation.errors.find(finding => finding.code === 'contradictory-decision')?.message);
  }
  const emit = (progress: LocalLlamaProgress) => input.onProgress?.(progress);
  emit({ stage: 'loading', progress: 0.03, message: 'Loading the on-device writer…' });
  const first = await runLocalLlamaCompletion({
    modelId: input.modelId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildLocalReportWriterPrompt(input.context, input.evidenceCards),
    schema: REPORT_SECTION_SCHEMA,
    maxTokens: 1900,
    temperature: 0.58,
  }, {
    signal: input.signal,
    onLoadProgress: (progress, message) => emit({ stage: 'loading', progress: 0.03 + progress * 0.42, message }),
    onGenerationProgress: characters => emit({
      stage: 'writing',
      progress: Math.min(0.72, 0.45 + characters / 18_000),
      message: 'Writing the report on this device…',
    }),
  });
  let usage = { ...first.usage };
  const firstSections = resolveLocalReportSections(first.content, input.snapshot);
  let sections = firstSections.sections;
  const fallbackSections = new Set(firstSections.fallbackSections);
  let repairs = 0;
  let draft = localReportDraftFromSections(input.context, sections);
  let snapshot = applyAgentDraftToSnapshot(input.snapshot, draft);
  let rendered = await renderAgentReviewedReport({ baseInput: { ...input.reportInput, snapshot }, draft });
  let qc = runQcPipeline({ ctx: input.context, generated: rendered.generatedSections });

  for (let pass = 0; pass < 2; pass += 1) {
    const findings = repairableFindings(qc.reportValidation.errors);
    if (findings.length === 0) break;
    repairs += 1;
    emit({ stage: 'repairing', progress: 0.8 + pass * 0.07, message: `Correcting ${findings.length} validation issue${findings.length === 1 ? '' : 's'}…` });
    const repair = await runLocalLlamaCompletion({
      modelId: input.modelId,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildRepairPrompt(input.context, sections, findings, input.evidenceCards ?? []),
      schema: REPORT_SECTION_SCHEMA,
      maxTokens: 1900,
      temperature: 0.25,
    }, { signal: input.signal });
    usage = {
      promptTokens: usage.promptTokens + repair.usage.promptTokens,
      completionTokens: usage.completionTokens + repair.usage.completionTokens,
      totalTokens: usage.totalTokens + repair.usage.totalTokens,
    };
    const repaired = resolveLocalReportSections(repair.content, input.snapshot);
    repaired.fallbackSections.forEach(key => fallbackSections.add(key));
    const repairedSections = repaired.sections;
    if (JSON.stringify(repairedSections) === JSON.stringify(sections)) break;
    sections = repairedSections;
    draft = localReportDraftFromSections(input.context, sections);
    snapshot = applyAgentDraftToSnapshot(input.snapshot, draft);
    rendered = await renderAgentReviewedReport({ baseInput: { ...input.reportInput, snapshot }, draft });
    qc = runQcPipeline({ ctx: input.context, generated: rendered.generatedSections });
  }

  emit({ stage: 'validating', progress: 0.95, message: 'Checking evidence, numbers, claims and limitations…' });
  const criticalBlockers = [...new Set(qc.score.blockers)];
  const fallbackWarning = fallbackSections.size > 0
    ? [`The on-device writer returned incomplete ${[...fallbackSections].join(', ')} content; governed deterministic copy was used for those sections.`]
    : [];
  const warnings = [...new Set([
    ...qc.score.warnings,
    ...qc.missingEvidence.map(item => `Missing evidence: ${item}`),
    ...fallbackWarning,
  ])];
  const status = criticalBlockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'partial' : 'passed';
  const claims = input.context.claims.map(claim => normalizeClaimRecord(claim, input.context));
  emit({ stage: 'complete', progress: 1, message: 'Report ready for review.' });
  return {
    snapshot,
    draft,
    model: first.model,
    usage,
    generatedAt: new Date().toISOString(),
    reportContextHash: await hashReportContext(input.context),
    repairs,
    status,
    qc: {
      criticalBlockers,
      warnings,
      polishSuggestions: qc.score.recommendedFixes,
      qualityScore: qc.score.totalScore,
    },
    evidenceAudit: {
      ...splitClaims(claims),
      missingEvidence: missingEvidenceFromContext(input.context),
    },
  };
}
