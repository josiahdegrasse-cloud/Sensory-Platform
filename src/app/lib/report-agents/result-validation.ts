import type {
  ReportAgentOutputMap,
  ReportAgentPacketMap,
  ReportAgentRole,
} from './types';

const PROTECTED_OUTPUT_KEYS = new Set([
  'approvalStatus',
  'launchAuthorization',
  'stageDecisionCode',
  'reportContextHash',
  'reportFingerprint',
  'issfScore',
  'sampleSize',
  'gateOutcome',
  'rawEvidence',
]);

const REQUIRED_ARRAYS: Partial<Record<ReportAgentRole, string[]>> = {
  evidence_auditor: ['claims', 'blockers', 'warnings'],
  calculation_auditor: ['verifiedCalculations', 'unexplainedCalculations', 'numericalConflicts', 'blockers', 'warnings'],
  scientific_skeptic: ['criticalChallenges', 'alternativeInterpretations', 'missingMethodDisclosures', 'blockers'],
  decision_consistency_auditor: ['decisionStatements', 'blockers', 'warnings'],
  commercial_strategist: ['supportedCommercialConclusions', 'reasonsToBelieve', 'conceptTestObjectives', 'prohibitedExternalClaims'],
  action_plan_engineer: ['immediateActions', 'laterActions', 'readinessGaps'],
  professional_report_writer: ['pages'],
  editorial_reviewer: ['revisedSections', 'unresolvedIssues', 'blockers'],
  client_red_team: ['trustRisks', 'likelyClientQuestions', 'ambiguousStatements'],
  visual_qa_reviewer: ['pageResults', 'blockers', 'warnings'],
  final_independent_judge: ['appliedCaps', 'blockers'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findProtectedKey(value: unknown, path = 'output'): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findProtectedKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (PROTECTED_OUTPUT_KEYS.has(key)) return `${path}.${key}`;
    const found = findProtectedKey(nested, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function collectEvidenceIds(value: unknown, ids: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach(item => collectEvidenceIds(item, ids));
  } else if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if ((key === 'evidenceIds' || key === 'supportingEvidenceIds') && Array.isArray(nested)) {
        nested.forEach(id => { if (typeof id === 'string') ids.push(id); });
      } else {
        collectEvidenceIds(nested, ids);
      }
    }
  }
  return ids;
}

export function validateAgentResult<R extends ReportAgentRole>(input: {
  role: R;
  packet: ReportAgentPacketMap[R];
  output: unknown;
  allowedEvidenceIds: string[];
}): ReportAgentOutputMap[R] {
  if (!isRecord(input.output)) throw new Error(`${input.role} returned a non-object result.`);

  const protectedPath = findProtectedKey(input.output);
  if (protectedPath) {
    throw new Error(`${input.role} attempted to return protected field ${protectedPath}.`);
  }

  for (const field of REQUIRED_ARRAYS[input.role] ?? []) {
    if (!Array.isArray(input.output[field])) {
      throw new Error(`${input.role} result is missing required array "${field}".`);
    }
  }

  const allowed = new Set(input.allowedEvidenceIds);
  const unknownIds = collectEvidenceIds(input.output).filter(id => !allowed.has(id));
  if (unknownIds.length > 0) {
    throw new Error(`${input.role} cited unauthorized evidence id(s): ${[...new Set(unknownIds)].join(', ')}.`);
  }

  if (input.role === 'evidence_auditor') {
    const packet = input.packet as ReportAgentPacketMap['evidence_auditor'];
    const knownClaims = new Set(packet.claims.map(claim => claim.id));
    const output = input.output as unknown as ReportAgentOutputMap['evidence_auditor'];
    const unknownClaims = output.claims.filter(claim => !knownClaims.has(claim.claimId));
    if (unknownClaims.length > 0) {
      throw new Error(`evidence_auditor returned unknown claim id(s): ${unknownClaims.map(claim => claim.claimId).join(', ')}.`);
    }
  }

  if (input.role === 'commercial_strategist') {
    const output = input.output as unknown as ReportAgentOutputMap['commercial_strategist'];
    if (output.priceHypothesis
      && (!output.priceHypothesis.source.trim() || !output.priceHypothesis.validationRequired)) {
      throw new Error('commercial_strategist price hypotheses require a source and validationRequired=true.');
    }
  }

  if (input.role === 'action_plan_engineer') {
    const packet = input.packet as ReportAgentPacketMap['action_plan_engineer'];
    const output = input.output as unknown as ReportAgentOutputMap['action_plan_engineer'];
    const storedOwners = new Set(packet.storedActions.map(action => action.owner).filter(Boolean));
    const inventedOwners = output.immediateActions
      .map(action => action.accountableOwner)
      .filter((owner): owner is string => Boolean(owner) && !storedOwners.has(owner));
    const storedDates = new Set(packet.storedActions.map(action => action.dueDate).filter(Boolean));
    const inventedDates = output.immediateActions
      .map(action => action.dueDate)
      .filter((date): date is string => Boolean(date) && !storedDates.has(date));
    if (inventedOwners.length > 0 || inventedDates.length > 0) {
      throw new Error('action_plan_engineer invented an owner or due date not present in the stored action inputs.');
    }
  }

  return input.output as unknown as ReportAgentOutputMap[R];
}
