import type { NarrativeEvaluation } from './report-evaluator';

// A saved report is stale when the data it was built from no longer matches the
// current deterministic source-data fingerprint for the same project.
export function isReportStale(
  linkedSourceDataVersion: string | null | undefined,
  currentSourceDataVersion: string | null | undefined,
): boolean {
  if (!linkedSourceDataVersion || !currentSourceDataVersion) return false;
  return linkedSourceDataVersion !== currentSourceDataVersion;
}

export type ApprovalGate = { allowed: boolean; reason: string | null };

// Approval requires a backing evidence bundle, a non-mismatched deterministic
// decision, and — if AI narrative was used — a passing evaluator score.
export function canApproveReport(input: {
  hasEvidenceBundle: boolean;
  candidateDecision?: string | null;
  evaluation?: NarrativeEvaluation | null;
}): ApprovalGate {
  if (!input.hasEvidenceBundle) {
    return { allowed: false, reason: 'No evidence bundle is linked to this report.' };
  }
  // Block only on a real contradiction (STOP/TWEAK). INSUFFICIENT_DATA means the
  // deterministic engine has no opinion (e.g. sample outside the reference set) —
  // that should not block a human-confirmed GO.
  if (input.candidateDecision === 'STOP' || input.candidateDecision === 'TWEAK') {
    return { allowed: false, reason: `Deterministic engine reads the data as ${input.candidateDecision}, not GO.` };
  }
  if (input.evaluation && !input.evaluation.passed) {
    return { allowed: false, reason: `AI narrative quality is ${input.evaluation.score}/100 — resolve the flagged issues first.` };
  }
  return { allowed: true, reason: null };
}
