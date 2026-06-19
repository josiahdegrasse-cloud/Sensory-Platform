import type { EvidenceBundle, EvidenceRecord } from './report-evidence-types';

// Narrative sections, mirroring CommercializationReportSnapshot['narrative'] keys.
export type ReportSectionKey =
  | 'executiveSummary'
  | 'whyLiked'
  | 'packagingRationale'
  | 'launchRecommendation'
  | 'claimCaution';

export const REPORT_SECTION_KEYS: ReportSectionKey[] = [
  'executiveSummary',
  'whyLiked',
  'packagingRationale',
  'launchRecommendation',
  'claimCaution',
];

export type ReportClaim = {
  id: string;
  section: ReportSectionKey;
  statement: string;
  /** Evidence record ids backing this claim — every id MUST exist in the bundle. */
  evidenceIds: string[];
  polarity: 'supporting' | 'cautionary';
};

export type DecisionInterpretation = {
  projectId: string;
  candidateDecision: EvidenceBundle['deterministicCandidateDecision'];
  confidence: EvidenceBundle['deterministicConfidence'];
  headline: string;
  claims: ReportClaim[];
};

function ids(records: EvidenceRecord[]): string[] {
  return records.map(record => record.id);
}

// Build claims straight from the bundle's own evidence records so every cited id
// is guaranteed to exist (no slug reconstruction / drift).
export function interpretEvidenceBundle(bundle: EvidenceBundle): DecisionInterpretation {
  const claims: ReportClaim[] = [];
  const evidence = bundle.evidence;
  const bySample = (sampleId: string | null | undefined) =>
    evidence.filter(record => record.sampleId === sampleId);

  // ── Executive summary: one claim per sample's deterministic decision ──
  bundle.sampleSummaries.forEach(sample => {
    const decisionRecords = bySample(sample.sampleId).filter(record =>
      record.evidenceType === 'metric'
      && (record.id.endsWith('.decision') || record.id.endsWith('.issf-score') || record.id.endsWith('.confidence')),
    );
    if (decisionRecords.length === 0) return;
    claims.push({
      id: `claim.exec.${sample.sampleId}`,
      section: 'executiveSummary',
      statement: `${sample.sampleName}: ${sample.decision}${sample.issfScore != null ? ` at ISSF ${sample.issfScore}` : ''}${sample.confidenceScore != null ? ` (${sample.confidenceScore}% confidence)` : ''}.`,
      evidenceIds: ids(decisionRecords),
      polarity: sample.decision === 'GO' ? 'supporting' : 'cautionary',
    });
  });

  // ── Why panelists liked it: positive dimension + trained-panel evidence ──
  const likeRecords = evidence.filter(record =>
    (record.evidenceType === 'metric' && record.category != null && record.id.includes('.dimension.'))
    || record.evidenceType === 'comparison',
  );
  if (likeRecords.length > 0) {
    claims.push({
      id: 'claim.why.dimensions',
      section: 'whyLiked',
      statement: 'Dimension-level scores and any trained-panel reference support the consumer response.',
      evidenceIds: ids(likeRecords),
      polarity: 'supporting',
    });
  }

  // ── Launch recommendation: the overall candidate decision ──
  const launchRecords = evidence.filter(record =>
    record.evidenceType === 'metric' && record.id.endsWith('.decision'),
  );
  if (launchRecords.length > 0) {
    claims.push({
      id: 'claim.launch.decision',
      section: 'launchRecommendation',
      statement: `Deterministic candidate decision across samples is ${bundle.deterministicCandidateDecision} at ${bundle.deterministicConfidence} confidence.`,
      evidenceIds: ids(launchRecords),
      polarity: bundle.deterministicCandidateDecision === 'GO' ? 'supporting' : 'cautionary',
    });
  }

  // ── Claims & limitations: gate failures, missing data, quality warnings ──
  const cautionRecords = evidence.filter(record =>
    record.evidenceType === 'missing_data'
    || record.evidenceType === 'quality_warning'
    || (record.evidenceType === 'critical_attribute' && record.isCritical),
  );
  if (cautionRecords.length > 0) {
    claims.push({
      id: 'claim.caution.limits',
      section: 'claimCaution',
      statement: 'The following gaps and warnings constrain external claims and must be disclosed.',
      evidenceIds: ids(cautionRecords),
      polarity: 'cautionary',
    });
  }

  const headline = bundle.deterministicCandidateDecision === 'INSUFFICIENT_DATA'
    ? 'Insufficient deterministic evidence for a launch claim.'
    : `Deterministic engine reads the data as ${bundle.deterministicCandidateDecision} (${bundle.deterministicConfidence} confidence).`;

  return {
    projectId: bundle.projectId,
    candidateDecision: bundle.deterministicCandidateDecision,
    confidence: bundle.deterministicConfidence,
    headline,
    claims,
  };
}

// Rejects any claim referencing an evidence id that does not exist in the bundle.
export function validateClaims(
  bundle: EvidenceBundle,
  claims: ReportClaim[],
): { valid: boolean; unknownEvidenceIds: string[]; emptyClaimIds: string[] } {
  const known = new Set(bundle.evidence.map(record => record.id));
  const unknown = new Set<string>();
  const emptyClaimIds: string[] = [];
  claims.forEach(claim => {
    if (claim.evidenceIds.length === 0) emptyClaimIds.push(claim.id);
    claim.evidenceIds.forEach(id => { if (!known.has(id)) unknown.add(id); });
  });
  return {
    valid: unknown.size === 0 && emptyClaimIds.length === 0,
    unknownEvidenceIds: [...unknown],
    emptyClaimIds,
  };
}
