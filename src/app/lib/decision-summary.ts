import type {
  DecisionOutcome,
  GoStopTweakDecision,
} from '../utils/go-stop-tweak-engine';

export type DecisionConfidence = 'High' | 'Moderate' | 'Low';

export interface DecisionSummary {
  outcome: DecisionOutcome;
  headline: string;
  definition: string;
  confidence: DecisionConfidence;
  reasons: string[];
  risk: string;
  nextStep: string;
}

const OUTCOME_COPY: Record<DecisionOutcome, Pick<DecisionSummary, 'definition' | 'nextStep'>> = {
  GO: {
    definition: 'Advance this prototype to concept and commercialization planning.',
    nextStep: 'Confirm the decision, then continue to Concept Lab.',
  },
  TWEAK: {
    definition: 'Make a focused adjustment before advancing this prototype.',
    nextStep: 'Confirm the adjustment plan and schedule a retest.',
  },
  STOP: {
    definition: 'Do not advance this prototype in its current form.',
    nextStep: 'Confirm the rationale before planning a new formulation or closing the work.',
  },
};

function confidenceLabel(score: number): DecisionConfidence {
  if (score >= 85) return 'High';
  if (score >= 70) return 'Moderate';
  return 'Low';
}

export function buildDecisionSummary(decision: GoStopTweakDecision): DecisionSummary {
  const failedGate = decision.gates.find(gate => gate.status === 'fail');
  const watchedGate = decision.gates.find(gate => gate.status === 'watch');
  const unmeasuredGates = decision.gates.filter(gate => gate.status === 'not_measured');
  const reasons = [
    ...decision.details,
    failedGate?.detail,
    watchedGate?.detail,
    // Honest caveat: evidence that was never collected is surfaced, not hidden.
    unmeasuredGates.length > 0
      ? `Not measured: ${unmeasuredGates.map(gate => gate.label.toLowerCase()).join(', ')} — this call rests on panel evidence alone.`
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    outcome: decision.decision,
    headline: decision.recommendation,
    definition: OUTCOME_COPY[decision.decision].definition,
    confidence: confidenceLabel(decision.confidenceScore),
    reasons: [...new Set(reasons)].slice(0, 3),
    risk: failedGate?.detail
      ?? watchedGate?.detail
      ?? `${decision.riskLevel[0].toUpperCase()}${decision.riskLevel.slice(1)} implementation risk based on the current evidence.`,
    nextStep: OUTCOME_COPY[decision.decision].nextStep,
  };
}

export function formatDecisionNote(input: {
  outcome: DecisionOutcome;
  note: string;
  issue: string;
  adjustment: string;
  retest: boolean;
}) {
  const lines: string[] = [];
  if (input.outcome === 'TWEAK') {
    if (input.issue.trim()) lines.push(`Issue: ${input.issue.trim()}`);
    if (input.adjustment.trim()) lines.push(`Adjustment: ${input.adjustment.trim()}`);
    lines.push(`Retest: ${input.retest ? 'Required' : 'Not required'}`);
  }
  if (input.note.trim()) lines.push(`Admin note: ${input.note.trim()}`);
  return lines.join('\n');
}
