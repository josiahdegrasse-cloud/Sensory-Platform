export * from './types';
export { determineReportStage, buildDecisionSemantics, stageHeadline, evidenceMaturity } from './stage';
export { buildReportContext } from './context';
export type { BuildContextInput, SensoryAugmentation, DimensionAugmentation } from './context';
export { findUnsupportedClaims, classifyStatement } from './claims';
export { lintText, findDuplicateParagraphs } from './lint';
export { validateReportContext, validateGeneratedReport, validateDimensionEvidenceConsistency } from './validate';
export type { GeneratedSections } from './validate';
export { scoreReportQuality } from './score';
export type { ScoreInputs, RenderDefect } from './score';
export { runQcPipeline } from './pipeline';
export type { QcPipelineInput, QcPipelineResult } from './pipeline';
export {
  validateVersion7ContextDefects,
  validateVersion7GeneratedDefects,
  validateVersion7RenderedDefects,
} from './version-7-regressions';
export type { RenderedReportInspection } from './version-7-regressions';
