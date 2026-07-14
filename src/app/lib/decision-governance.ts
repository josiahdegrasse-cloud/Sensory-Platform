import type { DecisionOutcome } from '../utils/go-stop-tweak-engine';

const OUTCOME_RANK: Record<DecisionOutcome, number> = { GO: 0, TWEAK: 1, STOP: 2 };

/** Human review may preserve or lower a calculated outcome, never promote it. */
export function canConfirmDecisionOutcome(
  calculated: DecisionOutcome,
  confirmed: DecisionOutcome,
) {
  return OUTCOME_RANK[confirmed] >= OUTCOME_RANK[calculated];
}

export function decisionRecordMatchesEvidence(
  record: { sampleId: string; decisionFingerprint: string; projectId?: string | null },
  evidence: { sampleId: string; decisionFingerprint: string; projectId?: string | null },
) {
  return record.sampleId === evidence.sampleId &&
    record.decisionFingerprint === evidence.decisionFingerprint &&
    (evidence.projectId ? record.projectId === evidence.projectId : !record.projectId);
}
