import { scoreReportQuality, type RenderDefect } from './score';
import type { GeneratedSections } from './validate';
import { validateGeneratedReport, validateReportContext } from './validate';
import type { QualityScore, ReportContext, ValidationResult } from './types';

// ════════════════════════════════════════════════════════════════════════════
// Multi-pass QC pipeline (section 7). The deterministic audit passes (5, 6, 7,
// 9, 10) are implemented here; the generative passes (1–4, 8) are produced
// upstream (deterministic snapshot + AI narrative) and fed in as the rendered
// sections. The pipeline never weakens evidence rules to raise the score and
// never invents missing evidence — it reports what blocks a higher grade.
// ════════════════════════════════════════════════════════════════════════════

export interface QcPipelineInput {
  ctx: ReportContext;
  generated: GeneratedSections;
  renderDefects?: RenderDefect[];
}

export interface QcPipelineResult {
  contextValidation: ValidationResult;
  reportValidation: ValidationResult;
  score: QualityScore;
  /** Critical errors block PDF export. */
  exportAllowed: boolean;
  /** Stage-appropriate completeness: true when no fixable blocker remains. */
  complete: boolean;
  /** Missing source evidence that prevents commercialization approval. */
  missingEvidence: string[];
  qualityReport: MachineReadableQualityReport;
}

export interface MachineReadableQualityReport {
  sample: string;
  reportStage: ReportContext['stage'];
  launchAuthorization: string;
  modelConfidence: number;
  evidenceMaturity: string;
  conceptResponses: number;
  approvalStatus: string;
  totalScore: number;
  clientReady: boolean;
  exportAllowed: boolean;
  categoryScores: QualityScore['categoryScores'];
  blockers: string[];
  warnings: string[];
  recommendedFixes: string[];
  missingEvidence: string[];
  blockedUnsupportedClaims: string[];
}

export function runQcPipeline(input: QcPipelineInput): QcPipelineResult {
  // Pass 5: evidence audit (context) + Pass 6/7: rendered-report audit.
  const contextValidation = validateReportContext(input.ctx);
  const reportValidation = validateGeneratedReport(input.ctx, input.generated);

  // Pass 9 (render defects) + Pass 10: scoring.
  const score = scoreReportQuality({
    ctx: input.ctx,
    validation: reportValidation,
    renderDefects: input.renderDefects,
  });

  const missingEvidence = collectMissingEvidence(input.ctx);
  const exportAllowed = reportValidation.exportAllowed && !(input.renderDefects ?? []).some(d => d.blocksExport);
  const complete = score.blockers.length === 0;

  const qualityReport: MachineReadableQualityReport = {
    sample: input.ctx.sampleName,
    reportStage: input.ctx.stage,
    launchAuthorization: input.ctx.decision.launchAuthorization,
    modelConfidence: input.ctx.decision.modelConfidence,
    evidenceMaturity: input.ctx.decision.evidenceMaturity,
    conceptResponses: input.ctx.concept.responseCount,
    approvalStatus: input.ctx.approvalStatus,
    totalScore: score.totalScore,
    clientReady: score.clientReady,
    exportAllowed,
    categoryScores: score.categoryScores,
    blockers: score.blockers,
    warnings: score.warnings,
    recommendedFixes: score.recommendedFixes,
    missingEvidence,
    blockedUnsupportedClaims: input.ctx.claims
      .filter(claim => claim.evidenceIds.length === 0 || claim.reviewerStatus === 'rejected')
      .map(claim => claim.claim),
  };

  return { contextValidation, reportValidation, score, exportAllowed, complete, missingEvidence, qualityReport };
}

// Lists source-evidence gaps that genuinely prevent commercialization approval —
// these are not fixable by editing prose; they require collecting more data.
function collectMissingEvidence(ctx: ReportContext): string[] {
  const missing: string[] = [];
  if (ctx.concept.responseCount === 0) missing.push('Concept-test responses (n=0): consumer preference and purchase intent cannot be validated.');
  const weak = ctx.dimensions.filter(d => d.score < ctx.thresholds.readiness);
  for (const dim of weak) missing.push(`${dim.label} (${dim.score}/100) is below the ${ctx.thresholds.readiness}/100 readiness line.`);
  if (ctx.gates.some(g => g.category === 'claims' && g.status !== 'pass')) missing.push('Claims and legal approval not on file.');
  if (!ctx.dimensions.every(d => d.sampleSize)) missing.push('Panel sample sizes are not documented for every dimension.');
  return missing;
}
