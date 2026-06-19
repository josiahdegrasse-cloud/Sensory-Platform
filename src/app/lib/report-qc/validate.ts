import { findUnsupportedClaims } from './claims';
import { findDuplicateParagraphs, lintText, type LintFinding } from './lint';
import type {
  ReportContext,
  ValidationFinding,
  ValidationResult,
} from './types';

// ════════════════════════════════════════════════════════════════════════════
// Deterministic validation (section 5). validateReportContext checks the
// structured input; validateGeneratedReport additionally checks rendered prose.
// Critical errors block PDF export.
// ════════════════════════════════════════════════════════════════════════════

function err(code: string, message: string, deduction: number, blocksExport = true): ValidationFinding {
  return { code, severity: 'error', message, deduction, blocksExport };
}
function warn(code: string, message: string, deduction: number): ValidationFinding {
  return { code, severity: 'warning', message, deduction, blocksExport: false };
}

export function validateReportContext(ctx: ReportContext): ValidationResult {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const knownEvidenceIds = new Set<string>(ctx.sourceEvidenceIds);

  // — claims must cite real bundle evidence —
  for (const claim of ctx.claims) {
    const unknown = claim.evidenceIds.filter(id => !knownEvidenceIds.has(id));
    if (claim.evidenceIds.length > 0 && unknown.length === claim.evidenceIds.length) {
      errors.push(err('missing-evidence-reference', `Claim "${claim.id}" cites only unknown evidence ids.`, 16));
    }
  }

  // — decision-label consistency —
  if (ctx.stage === 'commercialization_approval' && ctx.decision.launchAuthorization !== 'approved') {
    errors.push(err('contradictory-decision', 'Stage is commercialization_approval but launchAuthorization is not approved.', 26));
  }
  if (ctx.decision.launchAuthorization === 'approved' && ctx.gates.some(g => g.status !== 'pass')) {
    errors.push(err('approval-without-gates', 'Launch authorized while one or more gates are not passing.', 26));
  }
  if (ctx.stage === 'commercialization_approval' && ctx.gates.some(g => g.status !== 'pass')) {
    errors.push(err('approval-without-gates', 'Commercialization approval stage with unpassed gates.', 26));
  }
  if (/\bGO\b/.test(ctx.decision.stageDecision) && !ctx.decision.nextGate.trim()) {
    errors.push(err('go-without-gate', 'GO language present without a defined next gate.', 11));
  }

  // — title vs stage —
  if (ctx.stage !== 'commercialization_approval' && ctx.decision.launchAuthorization === 'approved') {
    errors.push(err('title-stage-mismatch', 'Report stage does not permit launch authorization.', 16));
  }

  // — evidence completeness —
  for (const dim of ctx.dimensions) {
    if (dim.sampleSize === null) {
      warnings.push(warn('missing-sample-size', `Dimension "${dim.label}" has no sample size.`, 4));
    }
    if (!dim.source.trim() || /saved sensory decision model/i.test(dim.source)) {
      warnings.push(warn('weak-evidence-source', `Dimension "${dim.label}" lacks an underlying evidence description.`, 4));
    }
  }

  // — confidence must carry a type/maturity —
  if (!ctx.decision.evidenceMaturity) {
    errors.push(err('confidence-without-type', 'Model confidence present without an evidence maturity.', 11));
  }

  // — consumer claims when concept n=0 —
  const unsupported = findUnsupportedClaims({ claims: ctx.claims, knownEvidenceIds, concept: ctx.concept });
  for (const v of unsupported) {
    errors.push(err('unsupported-claim', `${v.reason}`, 31));
  }

  // — limitations present —
  if (ctx.limitations.length === 0) {
    errors.push(err('missing-limitations', 'No limitations are listed.', 21, false));
  }

  // — concept visual must be directional —
  if (ctx.imageProvenance.attached && !ctx.imageProvenance.directionalDisclaimer) {
    errors.push(err('concept-visual-not-directional', 'Concept visual is not labeled directional.', 11));
  }

  // — actions: owners + completion criteria —
  for (const action of ctx.actions) {
    if (!action.owner) errors.push(err('action-without-owner', `Action "${action.workstream}" has no owner.`, 6));
    if (!action.completionEvidence.trim() || !action.passingThreshold.trim()) {
      errors.push(err('action-without-completion', `Action "${action.workstream}" has no completion criteria.`, 6));
    }
    if (!action.dueDate && !action.unscheduled) {
      warnings.push(warn('action-without-due-date', `Action "${action.workstream}" has no due date or unscheduled flag.`, 3));
    }
  }

  // — governance / traceability —
  if (!ctx.methodVersion.trim()) errors.push(err('missing-method-version', 'Missing method version.', 11, false));
  if (!ctx.decisionFingerprint.trim()) errors.push(err('missing-fingerprint', 'Missing decision fingerprint.', 11, false));
  if (!ctx.approvalStatus) errors.push(err('missing-approval-status', 'Missing approval status.', 11, false));

  const blocking = errors.some(e => e.blocksExport);
  return { errors, warnings, exportAllowed: !blocking };
}

// ── Generated-report validation (rendered prose) ────────────────────────────
export interface GeneratedSections {
  /** label → rendered text, in page order. */
  sections: Array<{ label: string; text: string }>;
}

export function validateGeneratedReport(ctx: ReportContext, generated: GeneratedSections): ValidationResult {
  const base = validateReportContext(ctx);
  const errors = [...base.errors];
  const warnings = [...base.warnings];

  const lintFindings: LintFinding[] = [];
  for (const section of generated.sections) {
    if (!section.text.trim()) {
      errors.push(err('empty-section', `Section "${section.label}" is empty.`, 16));
      continue;
    }
    lintFindings.push(...lintText(section.label, section.text));
  }
  lintFindings.push(...findDuplicateParagraphs(generated.sections));

  for (const finding of lintFindings) {
    if (finding.code === 'malformed-sentence' || finding.code === 'placeholder') {
      errors.push(err(finding.code, finding.message, 16));
    } else if (finding.code === 'duplicate-paragraph') {
      warnings.push(warn(finding.code, finding.message, 6));
    } else {
      warnings.push(warn(finding.code, finding.message, 4));
    }
  }

  const blocking = errors.some(e => e.blocksExport);
  return { errors, warnings, exportAllowed: !blocking };
}
