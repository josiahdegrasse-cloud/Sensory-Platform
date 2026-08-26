import type { ReportContext } from '../report-qc';
import type {
  EvidenceAssistProductContext,
  EvidenceAssistRequest,
  ReportWriterContext,
} from './types';

export function buildEvidenceAssistProductContext(
  context: ReportContext,
  intendedReportSection = 'commercialization_report',
): EvidenceAssistProductContext {
  const defects = context.gates
    .filter(gate => gate.status === 'fail' || gate.status === 'pending')
    .map(gate => `${gate.label}: ${gate.detail}`);
  const openGates = context.gates
    .filter(gate => gate.status !== 'pass')
    .map(gate => `${gate.label}: ${gate.detail}`);
  const validationNeeds = context.actions.map(action => action.requiredAction).filter(Boolean);
  const claimsQuestions = context.claims
    .filter(claim => claim.reviewerStatus !== 'approved')
    .map(claim => claim.claim);
  const sensoryOutcome = context.decision.sensoryOutcome === 'INSUFFICIENT_DATA'
    ? 'TWEAK'
    : context.decision.sensoryOutcome;
  return {
    projectId: context.projectId,
    productId: context.sampleId,
    productName: context.sampleName,
    foodType: context.foodType,
    productCategory: context.foodType,
    decision: sensoryOutcome,
    issfScore: context.issfScore,
    dimensionScores: Object.fromEntries(context.dimensions.map(dimension => [dimension.key, dimension.score])),
    sensoryPanelN: Math.max(0, ...context.dimensions.map(dimension => dimension.sampleSize ?? 0)),
    conceptPanelN: context.concept.responseCount,
    instrumentalFindings: [
      ...context.instrumental.findings.map(finding => `${finding.source}: ${finding.finding}`),
      ...context.instrumental.parameters.slice(0, 12).map(parameter => (
        `${parameter.label}: ${parameter.mean}${parameter.unit ? ` ${parameter.unit}` : ''}; ${parameter.status.replace(/_/g, ' ')}`
      )),
    ],
    defects,
    openGates,
    currentDecisionReason: context.decision.conditions.join(' '),
    intendedReportSection,
    validationNeeds,
    claimsQuestions,
  };
}

export function buildEvidenceAssistRequest(
  context: ReportContext,
  intendedReportSection = 'commercialization_report',
): EvidenceAssistRequest {
  return { productContext: buildEvidenceAssistProductContext(context, intendedReportSection) };
}

export function buildReportWriterContext(context: ReportContext): ReportWriterContext {
  return {
    identity: {
      projectId: context.projectId,
      sampleId: context.sampleId,
      productName: context.sampleName,
      foodType: context.foodType,
    },
    deterministicDecision: {
      sensoryOutcome: context.decision.sensoryOutcome,
      stageDecision: context.decision.stageDecision,
      nextGate: context.decision.nextGate,
      conditions: [...context.decision.conditions],
      issfScore: context.issfScore,
    },
    dimensions: context.dimensions.map(dimension => ({
      key: dimension.key,
      label: dimension.label,
      score: dimension.score,
      threshold: dimension.threshold,
      sampleSize: dimension.sampleSize,
      population: dimension.population,
      measures: [...dimension.measures],
      businessImplication: dimension.businessImplication,
    })),
    instrumental: {
      available: context.instrumental.available,
      findings: context.instrumental.findings.map((finding, index) => ({
        id: `instrumental-${index + 1}`,
        finding: finding.finding,
        benchmark: finding.benchmark,
        decisionEffect: finding.decisionEffect,
      })),
      parameters: context.instrumental.parameters.map(parameter => ({
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
      })),
    },
    concept: {
      responseCount: context.concept.responseCount,
      evidenceStrength: context.concept.responseCount >= 30
        ? 'strong'
        : context.concept.responseCount > 0 ? 'directional' : 'missing',
      purchaseIntent: context.concept.purchaseIntent,
    },
    limitations: context.limitations.map(limitation => ({ ...limitation })),
    sourceEvidenceIds: [...context.sourceEvidenceIds],
  };
}
