import { classifyStatement, findUnsupportedClaims } from './claims';
import { findDuplicateParagraphs, lintText, type LintFinding } from './lint';
import { isIssfReproduced } from './methodology';
import {
  validateVersion7ContextDefects,
  validateVersion7GeneratedDefects,
} from './version-7-regressions';
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

export function validateDimensionEvidenceConsistency(ctx: ReportContext): ValidationResult {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  for (const dim of ctx.dimensions) {
    if (!dim.calculationExplanation.trim()) {
      errors.push(err('missing-score-explanation', `${dim.label} has no calculation explanation.`, 16));
    }
    if (dim.measures.length === 0 || dim.rawMetrics.length === 0) {
      errors.push(err('displayed-evidence-mismatch', `${dim.label} does not display the evidence used in its score.`, 16));
    }
    if (dim.score < dim.threshold) {
      const visible = dim.rawMetrics.filter(metric => !metric.missing && typeof metric.value !== 'string');
      const allAppearPositive = visible.length > 0 && visible.every(metric => {
        const value = Number(metric.value);
        if (!Number.isFinite(value)) return false;
        if (metric.direction === 'lower_better') return value <= 3;
        if (metric.direction === 'ideal_range' && metric.targetRange) return value >= metric.targetRange[0] && value <= metric.targetRange[1];
        return metric.direction === 'higher_better' ? value >= 6 : false;
      });
      const explanationNamesPenalty = /\b(missing|penalt|not captured|ideal range|below|count as 0|weak)\b/i.test(dim.calculationExplanation);
      if (allAppearPositive && !explanationNamesPenalty) {
        errors.push(err('unexplained-score-evidence-contradiction', `${dim.label} is below threshold although all visible metrics appear positive.`, 26));
      }
    }
  }
  return { errors, warnings, exportAllowed: !errors.some(item => item.blocksExport) };
}

export function validateReportContext(ctx: ReportContext): ValidationResult {
  const errors: ValidationFinding[] = [];
  const warnings: ValidationFinding[] = [];
  const knownEvidenceIds = new Set<string>(ctx.sourceEvidenceIds);
  const dimensionValidation = validateDimensionEvidenceConsistency(ctx);
  errors.push(...dimensionValidation.errors);
  warnings.push(...dimensionValidation.warnings);
  errors.push(...validateVersion7ContextDefects(ctx));

  // — claims must cite real bundle evidence —
  for (const claim of ctx.claims) {
    const unknown = claim.evidenceIds.filter(id => !knownEvidenceIds.has(id));
    if (claim.evidenceIds.length > 0 && unknown.length === claim.evidenceIds.length) {
      errors.push(err('missing-evidence-reference', `Claim "${claim.id}" cites only unknown evidence ids.`, 16));
    }
    if (claim.evidenceIds.length === 0) {
      errors.push(err('missing-evidence-reference', `Claim "${claim.id}" has no evidence reference.`, 16));
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
  if (ctx.approvalStatus === 'approved' && /reference\/demo|reference-demo/i.test(ctx.evidenceProvenance)) {
    errors.push(err('reference-demo-approval', 'Reference/demo evidence cannot support external report approval.', 31));
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
  if (!isIssfReproduced(ctx.methodology)) {
    errors.push(err(
      'calculation-mismatch',
      `Displayed methodology reproduces ISSF ${ctx.methodology.reproducedIssf.toFixed(1)}, not stored ISSF ${ctx.methodology.storedIssf.toFixed(1)}.`,
      16,
    ));
  }
  if (ctx.decision.confidence.value !== null && ctx.methodology.confidenceCalculation.length === 0) {
    errors.push(err('missing-confidence-calculation', 'Model confidence is shown without its weighted inputs.', 11));
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
  if (ctx.imageProvenance.coverAttached && !ctx.imageProvenance.externalUseApproved) {
    errors.push(err(
      'report-cover-not-approved',
      'The attached portrait report cover has not been approved for external use.',
      11,
    ));
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
    const claimType = classifyStatement(section.text);
    if (ctx.concept.responseCount < 30
      && ['consumer_preference', 'purchase_demand', 'representative_acceptance', 'market_readiness'].includes(claimType)
      && !/\b(unvalidated|unsupported|hypothesis|directional only|not (?:a |yet )?|cannot|pending|too few|minimum n|n\s*=\s*\d+)\b/i.test(section.text)) {
      errors.push(err(
        'unsupported-consumer-language',
        `${section.label}: consumer or market conclusion is not bounded by concept evidence (concept responses n=${ctx.concept.responseCount}; minimum n=30).`,
        31,
      ));
    }
  }
  lintFindings.push(...findDuplicateParagraphs(generated.sections));

  const evidenceLeakageCodes = new Set([
    'absolute-file-path',
    'raw-rag-language',
    'internal-evidence-language',
    'backend-name',
    'raw-float',
  ]);
  for (const finding of lintFindings) {
    if (finding.code === 'malformed-sentence'
      || finding.code === 'placeholder'
      || finding.code.startsWith('raw-')
      || evidenceLeakageCodes.has(finding.code)) {
      errors.push(err(finding.code, finding.message, 16));
    } else if (finding.code === 'duplicate-paragraph') {
      warnings.push(warn(finding.code, finding.message, 6));
    } else {
      warnings.push(warn(finding.code, finding.message, 4));
    }
  }
  errors.push(...validateVersion7GeneratedDefects(ctx, generated));

  const blocking = errors.some(e => e.blocksExport);
  return { errors, warnings, exportAllowed: !blocking };
}
