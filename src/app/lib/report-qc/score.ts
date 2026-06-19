import type {
  QualityCategory,
  QualityScore,
  ReportContext,
  ValidationResult,
} from './types';
import { QUALITY_WEIGHTS } from './types';

// ════════════════════════════════════════════════════════════════════════════
// 100-point quality rubric (section 6). Category scores start at full weight and
// lose points per finding mapped to that category; hard caps bound the total for
// specific defect classes. A report is client_ready only when every gate passes.
// ════════════════════════════════════════════════════════════════════════════

// Maps a validation finding code to the rubric category it degrades.
const CODE_CATEGORY: Record<string, QualityCategory> = {
  'contradictory-decision': 'decisionClarity',
  'approval-without-gates': 'decisionClarity',
  'go-without-gate': 'decisionClarity',
  'title-stage-mismatch': 'decisionClarity',
  'confidence-without-type': 'decisionClarity',
  'missing-sample-size': 'evidenceCompleteness',
  'weak-evidence-source': 'evidenceCompleteness',
  'empty-section': 'evidenceCompleteness',
  'unsupported-claim': 'claimSupport',
  'missing-evidence-reference': 'claimSupport',
  'missing-limitations': 'claimSupport',
  'concept-visual-not-directional': 'claimSupport',
  'action-without-owner': 'actionability',
  'action-without-completion': 'actionability',
  'action-without-due-date': 'actionability',
  'malformed-sentence': 'writingQuality',
  'raw-deterministic': 'writingQuality',
  'raw-evidence-bundle': 'writingQuality',
  'raw-saved-model': 'writingQuality',
  'raw-snapshot': 'writingQuality',
  'raw-scoreimpl': 'writingQuality',
  'vague-praise': 'writingQuality',
  'undefined-acronym': 'writingQuality',
  'placeholder': 'writingQuality',
  'duplicate-paragraph': 'writingQuality',
  'missing-method-version': 'governance',
  'missing-fingerprint': 'governance',
  'missing-approval-status': 'governance',
};

export interface RenderDefect {
  message: string;
  blocksExport: boolean;
}

export interface ScoreInputs {
  ctx: ReportContext;
  validation: ValidationResult;
  /** Layout/rendering defects from the visual audit (section 9 / pass 9). */
  renderDefects?: RenderDefect[];
}

export function scoreReportQuality(input: ScoreInputs): QualityScore {
  const categoryScores = { ...QUALITY_WEIGHTS } as Record<QualityCategory, number>;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const recommendedFixes: string[] = [];

  const all = [...input.validation.errors, ...input.validation.warnings];
  for (const finding of all) {
    const category = CODE_CATEGORY[finding.code];
    if (category) {
      categoryScores[category] = Math.max(0, categoryScores[category] - finding.deduction);
    }
    if (finding.severity === 'error') {
      blockers.push(`${finding.code}: ${finding.message}`);
      recommendedFixes.push(`Resolve ${finding.code}: ${finding.message}`);
    } else {
      warnings.push(`${finding.code}: ${finding.message}`);
    }
  }

  for (const defect of input.renderDefects ?? []) {
    categoryScores.visualReadability = Math.max(0, categoryScores.visualReadability - 3);
    if (defect.blocksExport) blockers.push(`render: ${defect.message}`);
    else warnings.push(`render: ${defect.message}`);
  }

  let total = (Object.keys(categoryScores) as QualityCategory[])
    .reduce((sum, key) => sum + categoryScores[key], 0);

  // — hard caps —
  const codes = new Set(all.map(f => f.code));
  const cap = (limit: number) => { total = Math.min(total, limit); };
  if (codes.has('missing-sample-size') || codes.has('weak-evidence-source')) cap(79);
  if (codes.has('contradictory-decision') || codes.has('approval-without-gates') || codes.has('title-stage-mismatch')) cap(74);
  if (codes.has('unsupported-claim')) cap(69);
  if (codes.has('empty-section') || codes.has('malformed-sentence')) cap(84);
  if (codes.has('missing-limitations')) cap(79);
  if (codes.has('missing-approval-status')) cap(89);
  const criticalRender = (input.renderDefects ?? []).some(d => d.blocksExport);
  if (criticalRender) { cap(0); blockers.push('Critical rendering defect — export blocked.'); }

  total = Math.max(0, Math.round(total));

  const stageComplete = input.ctx.stage === 'commercialization_approval'
    ? input.ctx.gates.every(g => g.status === 'pass')
    : true;
  const hasUnsupported = codes.has('unsupported-claim');
  const clientReady =
    total >= 95
    && blockers.length === 0
    && !hasUnsupported
    && input.ctx.approvalStatus === 'approved'
    && stageComplete;

  return { totalScore: total, categoryScores, blockers, warnings, recommendedFixes, clientReady };
}
