import { convergenceData, calculateScreeningRiskScore, checkEscalationTriggers } from '../data/convergence-data';
import type { EnhancedSensoryProfile } from '../data/enhanced-sensory';
import { METHOD_COMPARISON, VALIDATION_DATASET } from '../data/validation-data';
import { calculateGoStopTweakDecision, type GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import {
  type BuildEvidenceBundleInput,
  type CategoryEvidenceResult,
  type ConfidenceLevel,
  type CriticalAttributeResult,
  type DecisionType,
  type EvidenceBundle,
  type EvidenceRecord,
  type MissingDataIssue,
  type QualityWarning,
  type SampleEvidenceSummary,
} from './report-evidence-types';

export type {
  BuildEvidenceBundleInput,
  CategoryEvidenceResult,
  ConfidenceLevel,
  CriticalAttributeResult,
  DecisionType,
  EvidenceBundle,
  EvidenceBundleRecord,
  EvidenceRecord,
  MissingDataIssue,
  QualityWarning,
  SampleEvidenceSummary,
} from './report-evidence-types';

const SCHEMA_VERSION = 'evidence-bundle.v1';
const DEFAULT_WEIGHTS = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value: unknown): string {
  const raw = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function evidenceId(parts: Array<string | number | null | undefined>) {
  return parts
    .filter(part => part !== null && part !== undefined && `${part}`.trim())
    .map(part => `${part}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('.');
}

function confidenceLevel(score: number, missingData: MissingDataIssue[], warnings: QualityWarning[]): ConfidenceLevel {
  if (missingData.some(issue => issue.severity === 'critical') || warnings.some(warning => warning.severity === 'critical')) return 'low';
  if (score >= 80 && missingData.length === 0 && warnings.every(warning => warning.severity === 'low')) return 'high';
  if (score >= 60 && !missingData.some(issue => issue.severity === 'high')) return 'medium';
  return 'low';
}

function toEvidence(record: Omit<EvidenceRecord, 'confidence'> & { confidence?: number }): EvidenceRecord {
  return { confidence: record.confidence ?? 1, ...record };
}

function validateProjectInputs(projectId: string, profiles: EnhancedSensoryProfile[]): MissingDataIssue[] {
  const issues: MissingDataIssue[] = [];
  if (!projectId.trim()) {
    issues.push({
      id: 'missing.project-id',
      title: 'Project key missing',
      description: 'An evidence bundle requires a stable project or sample key.',
      severity: 'critical',
    });
  }
  if (profiles.length === 0) {
    issues.push({
      id: 'missing.sample-profile',
      title: 'No analyzable sample profile',
      description: 'No sensory and instrumental sample profile was available for deterministic analysis.',
      severity: 'critical',
    });
  }
  profiles.forEach(profile => {
    if (Object.keys(profile.cata).length === 0) {
      issues.push({
        id: evidenceId(['missing', profile.sampleId, 'cata']),
        title: 'CATA data missing',
        description: `${profile.sampleName} has no CATA descriptor counts.`,
        severity: 'high',
        sampleId: profile.sampleId,
      });
    }
    if (profile.gcmsOlfactometry.length === 0) {
      issues.push({
        id: evidenceId(['missing', profile.sampleId, 'gcms']),
        title: 'GC-MS data missing',
        description: `${profile.sampleName} has no GC-MS / olfactometry records; aroma-risk confidence is reduced.`,
        severity: 'medium',
        sampleId: profile.sampleId,
      });
    }
    if (!Number.isFinite(profile.hedonic.overall) || profile.hedonic.overall <= 0) {
      issues.push({
        id: evidenceId(['missing', profile.sampleId, 'hedonic']),
        title: 'Hedonic data missing',
        description: `${profile.sampleName} has no usable overall hedonic score.`,
        severity: 'critical',
        sampleId: profile.sampleId,
      });
    }
  });
  return issues;
}

function calculateDecisions(input: BuildEvidenceBundleInput) {
  return input.profiles.map(profile => ({
    profile,
    decision: calculateGoStopTweakDecision(
      profile,
      DEFAULT_WEIGHTS,
      input.foodTypeSlug,
      input.thresholds,
    ),
  }));
}

function calculateScreeningAlignment() {
  return calculateScreeningRiskScore(convergenceData);
}

function calculateRankAgreement() {
  const total = convergenceData.reduce((sum, attr) => sum + attr.rankAgreement, 0);
  return convergenceData.length ? total / convergenceData.length : null;
}

function calculateRepeatability() {
  const total = convergenceData.reduce((sum, attr) => sum + attr.instrumentalRepeatability, 0);
  return convergenceData.length ? total / convergenceData.length : null;
}

function calculateSubstitutionIndex() {
  return METHOD_COMPARISON.accuracy;
}

function createEvidenceRecords(
  decisions: Array<{ profile: EnhancedSensoryProfile; decision: GoStopTweakDecision }>,
  missingData: MissingDataIssue[],
  qualityWarnings: QualityWarning[],
) {
  const records: EvidenceRecord[] = [];
  decisions.forEach(({ profile, decision }) => {
    records.push(toEvidence({
      id: evidenceId(['sample', profile.sampleId, 'decision']),
      evidenceType: 'metric',
      title: `${profile.sampleName} deterministic decision`,
      description: `${decision.decision} at ISSF ${decision.issfScore.toFixed(1)} with ${decision.confidenceScore.toFixed(0)}% confidence.`,
      value: decision.decision,
      sourceType: 'go-stop-tweak-engine',
      sourceId: decision.decisionFingerprint,
      sampleId: profile.sampleId,
      isCritical: true,
    }));
    records.push(toEvidence({
      id: evidenceId(['sample', profile.sampleId, 'issf-score']),
      evidenceType: 'metric',
      title: 'ISSF score',
      description: `Deterministic ISSF score for ${profile.sampleName}.`,
      value: Number(decision.issfScore.toFixed(1)),
      unit: '/100',
      sourceType: 'go-stop-tweak-engine',
      sourceId: decision.decisionFingerprint,
      sampleId: profile.sampleId,
      isCritical: true,
    }));
    records.push(toEvidence({
      id: evidenceId(['sample', profile.sampleId, 'confidence']),
      evidenceType: 'metric',
      title: 'Decision confidence',
      description: `Deterministic evidence confidence for ${profile.sampleName}.`,
      value: Number(decision.confidenceScore.toFixed(0)),
      unit: '%',
      sourceType: 'go-stop-tweak-engine',
      sourceId: decision.decisionFingerprint,
      sampleId: profile.sampleId,
      isCritical: true,
    }));
    Object.entries(decision.dimensionScores).forEach(([category, score]) => {
      records.push(toEvidence({
        id: evidenceId(['sample', profile.sampleId, 'dimension', category]),
        evidenceType: 'metric',
        title: `${category} score`,
        description: `${category} contribution to the deterministic decision.`,
        value: Number(score.toFixed(1)),
        unit: '/100',
        sourceType: 'go-stop-tweak-engine',
        sourceId: decision.decisionFingerprint,
        category,
        sampleId: profile.sampleId,
        isCritical: category === 'hedonic',
      }));
    });
    decision.gates.forEach(gate => {
      records.push(toEvidence({
        id: evidenceId(['sample', profile.sampleId, 'gate', gate.id]),
        evidenceType: 'critical_attribute',
        title: gate.label,
        description: `${gate.status.toUpperCase()}: ${gate.detail}`,
        value: gate.status,
        sourceType: 'go-stop-tweak-engine',
        sourceId: decision.decisionFingerprint,
        category: 'gate',
        sampleId: profile.sampleId,
        isCritical: gate.status === 'fail',
      }));
    });
    if (profile.trainedPanelReference) {
      records.push(toEvidence({
        id: evidenceId(['sample', profile.sampleId, 'trained-panel']),
        evidenceType: 'comparison',
        title: 'Trained panel reference',
        description: `Reference panel score ${profile.trainedPanelReference.overallQuality}; recommendation ${profile.trainedPanelReference.recommendation}.`,
        value: profile.trainedPanelReference.overallQuality,
        unit: '/100',
        sourceType: 'trained-panel-reference',
        sourceId: profile.sampleId,
        sampleId: profile.sampleId,
        isCritical: profile.trainedPanelReference.recommendation !== decision.decision,
      }));
    }
  });
  missingData.forEach(issue => {
    records.push(toEvidence({
      id: evidenceId(['missing-data', issue.id]),
      evidenceType: 'missing_data',
      title: issue.title,
      description: issue.description,
      sourceType: 'validation',
      sourceId: issue.id,
      sampleId: issue.sampleId,
      confidence: issue.severity === 'critical' ? 0.2 : 0.6,
      isCritical: issue.severity === 'critical',
    }));
  });
  qualityWarnings.forEach(warning => {
    records.push(toEvidence({
      id: evidenceId(['quality-warning', warning.id]),
      evidenceType: 'quality_warning',
      title: warning.title,
      description: warning.description,
      sourceType: 'validation',
      sourceId: warning.id,
      sampleId: warning.sampleId,
      confidence: warning.severity === 'critical' ? 0.3 : 0.7,
      isCritical: warning.severity === 'critical',
    }));
  });
  return records;
}

function deriveCandidateDecision(decisions: GoStopTweakDecision[], missingData: MissingDataIssue[]): DecisionType {
  if (missingData.some(issue => issue.severity === 'critical') || decisions.length === 0) return 'INSUFFICIENT_DATA';
  if (decisions.some(decision => decision.decision === 'STOP')) return 'STOP';
  if (decisions.some(decision => decision.decision === 'TWEAK')) return 'TWEAK';
  return 'GO';
}

function decisionReasons(
  candidate: DecisionType,
  decisions: GoStopTweakDecision[],
  missingData: MissingDataIssue[],
  qualityWarnings: QualityWarning[],
) {
  if (candidate === 'INSUFFICIENT_DATA') return missingData.map(issue => issue.description);
  const primary = decisions[0];
  return [
    primary ? `${primary.sampleName}: ${primary.decision} at ISSF ${primary.issfScore.toFixed(1)} with ${primary.confidenceScore.toFixed(0)}% confidence.` : '',
    ...decisions.flatMap(decision => decision.gates
      .filter(gate => gate.status !== 'pass')
      .map(gate => `${decision.sampleName} ${gate.label}: ${gate.status.toUpperCase()} (${gate.detail})`)),
    ...qualityWarnings.map(warning => warning.description),
  ].filter(Boolean);
}

function qualityWarningsFor(decisions: Array<{ profile: EnhancedSensoryProfile; decision: GoStopTweakDecision }>): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const triggers = checkEscalationTriggers(convergenceData);
  if (triggers.escalationRequired) {
    warnings.push({
      id: 'screening-alignment.escalation-trigger',
      title: 'Screening alignment escalation trigger',
      description: `${triggers.triggers.map(trigger => trigger.attribute).join(', ')} screening alignment is below the provisional 85% escalation threshold.`,
      severity: 'medium',
    });
  }
  decisions.forEach(({ profile, decision }) => {
    if (decision.confidenceScore < 70) {
      warnings.push({
        id: evidenceId(['confidence', profile.sampleId, 'below-70']),
        title: 'Low decision confidence',
        description: `${profile.sampleName} confidence is below 70%; trained-panel or additional panel evidence is recommended before external claims.`,
        severity: 'high',
        sampleId: profile.sampleId,
      });
    }
    decision.gates.filter(gate => gate.status === 'fail').forEach(gate => {
      warnings.push({
        id: evidenceId(['critical-gate', profile.sampleId, gate.id]),
        title: 'Critical gate failure',
        description: `${profile.sampleName} failed ${gate.label}: ${gate.detail}`,
        severity: 'critical',
        sampleId: profile.sampleId,
      });
    });
  });
  return warnings;
}

export function buildEvidenceBundleFromProfiles(input: BuildEvidenceBundleInput): EvidenceBundle {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const version = input.version ?? 1;
  const missingData = validateProjectInputs(input.projectId, input.profiles);
  const decisions = calculateDecisions(input);
  const qualityWarnings = qualityWarningsFor(decisions);
  const decisionList = decisions.map(item => item.decision);
  const candidate = deriveCandidateDecision(decisionList, missingData);
  const averageConfidence = decisionList.length
    ? decisionList.reduce((sum, decision) => sum + decision.confidenceScore, 0) / decisionList.length
    : 0;
  const sourceDataVersion = stableHash({
    schemaVersion: SCHEMA_VERSION,
    projectId: input.projectId,
    foodTypeSlug: input.foodTypeSlug,
    thresholds: input.thresholds,
    profiles: input.profiles,
    convergenceData,
    validation: VALIDATION_DATASET,
  });
  const sampleSummaries: SampleEvidenceSummary[] = decisions.map(({ profile, decision }) => ({
    sampleId: profile.sampleId,
    sampleName: profile.sampleName,
    decision: decision.decision,
    issfScore: Number(decision.issfScore.toFixed(1)),
    confidenceScore: Number(decision.confidenceScore.toFixed(0)),
    riskLevel: decision.riskLevel,
    methodVersion: decision.methodVersion,
    decisionFingerprint: decision.decisionFingerprint,
  }));
  const categoryResults: CategoryEvidenceResult[] = decisions.flatMap(({ profile, decision }) =>
    Object.entries(decision.dimensionScores).map(([category, score]) => ({
      sampleId: profile.sampleId,
      category: category as keyof GoStopTweakDecision['dimensionScores'],
      score: Number(score.toFixed(1)),
    })),
  );
  const criticalAttributeResults: CriticalAttributeResult[] = decisions.flatMap(({ profile, decision }) =>
    decision.gates.map(gate => ({ sampleId: profile.sampleId, ...gate })),
  );
  const evidence = createEvidenceRecords(decisions, missingData, qualityWarnings);

  return {
    id: `bundle_${sourceDataVersion}`,
    projectId: input.projectId,
    version,
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    sourceDataVersion,
    sampleSummaries,
    categoryResults,
    criticalAttributeResults,
    screeningAlignment: Number(calculateScreeningAlignment().toFixed(3)),
    rankAgreement: Number((calculateRankAgreement() ?? 0).toFixed(1)),
    repeatability: Number((calculateRepeatability() ?? 0).toFixed(3)),
    substitutionIndex: calculateSubstitutionIndex(),
    evidence,
    missingData,
    qualityWarnings,
    deterministicCandidateDecision: candidate,
    deterministicConfidence: confidenceLevel(averageConfidence, missingData, qualityWarnings),
    decisionReasons: decisionReasons(candidate, decisionList, missingData, qualityWarnings),
    createdBy: input.createdBy,
  };
}
