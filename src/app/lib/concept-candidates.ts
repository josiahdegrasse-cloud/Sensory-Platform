import type { DecisionRecord } from './database';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { decisionRecordMatchesEvidence } from './decision-governance';

/** Calculated GO results may be presented in Concept Lab, but remain locked
 * until an audited decision record is created. */
export function findPendingConceptGoDecisions(
  calculated: readonly GoStopTweakDecision[],
  records: readonly DecisionRecord[],
  projectId: string | undefined,
) {
  return calculated
    .filter(decision => (
      decision.decision === 'GO'
      && decision.decisionStatus !== 'hold'
      && !records.some(record => decisionRecordMatchesEvidence(record, {
        sampleId: decision.sampleId,
        decisionFingerprint: decision.decisionFingerprint,
        projectId,
      }))
    ))
    .sort((a, b) => b.issfScore - a.issfScore);
}
