import { runQcPipeline, type GeneratedSections, type ReportContext } from '../report-qc';
import type { ReportOrchestrationArtifacts } from './types';

export function mergeAgentAndDeterministicQc(input: {
  ctx: ReportContext;
  generated: GeneratedSections;
  artifacts: ReportOrchestrationArtifacts;
}) {
  const deterministic = runQcPipeline({ ctx: input.ctx, generated: input.generated });
  const criticalBlockers = [
    ...input.artifacts.state.deterministicBlockers,
    ...input.artifacts.defects
      .filter(defect => defect.severity === 'critical' && defect.status !== 'fixed')
      .map(defect => `${defect.category}: ${defect.description}`),
    ...deterministic.score.blockers,
  ];
  const warnings = [
    ...input.artifacts.state.agentWarnings,
    ...deterministic.score.warnings,
    ...deterministic.missingEvidence.map(item => `Missing evidence: ${item}`),
  ];
  return {
    deterministic,
    qc: {
      criticalBlockers: [...new Set(criticalBlockers)],
      warnings: [...new Set(warnings)],
      polishSuggestions: deterministic.score.recommendedFixes,
      qualityScore: input.artifacts.state.qualityScore ?? deterministic.score.totalScore,
    },
  };
}
