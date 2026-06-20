import type { ReportContext, ValidationResult } from '../report-qc';
import type {
  ClientRedTeamResult,
  FinalJudgeResult,
  HumanApprovalRecord,
  ReportExportStatus,
  VisualQAResult,
} from './types';

export interface ExportAuthorization {
  allowed: boolean;
  status: ReportExportStatus;
  deterministicBlockers: string[];
  requiredHumanApprovals: HumanApprovalRecord['approvalScope'][];
  reportFingerprint: string;
}

export function authorizeReportExport(input: {
  context: ReportContext;
  deterministicValidation: ValidationResult;
  visualQa?: VisualQAResult;
  redTeam?: ClientRedTeamResult;
  finalJudge?: FinalJudgeResult;
  authoritativeQualityScore?: number;
  humanApprovals?: HumanApprovalRecord[];
}): ExportAuthorization {
  const deterministicBlockers = input.deterministicValidation.errors
    .filter(finding => finding.blocksExport)
    .map(finding => `${finding.code}: ${finding.message}`);
  deterministicBlockers.push(...(input.visualQa?.blockers ?? []).map(item => `visual-qa: ${item}`));
  const criticalVisualIssues = input.visualQa?.pageResults.flatMap(page =>
    page.issues
      .filter(issue => issue.severity === 'critical')
      .map(issue => `visual-qa page ${page.page}: ${issue.description}`),
  ) ?? [];
  deterministicBlockers.push(...criticalVisualIssues);
  deterministicBlockers.push(...(input.finalJudge?.blockers ?? []).map(item => `final-judge: ${item}`));

  if (input.redTeam?.releaseRecommendation === 'blocked') {
    deterministicBlockers.push('client-red-team: release recommendation is block.');
  }
  deterministicBlockers.push(...(input.redTeam?.trustRisks ?? [])
    .filter(risk => risk.severity === 'critical')
    .map(risk => `client-red-team page ${risk.page}: ${risk.issue}`));
  if (input.authoritativeQualityScore !== undefined && input.authoritativeQualityScore < 97) {
    deterministicBlockers.push(`deterministic-quality-score: ${input.authoritativeQualityScore}/100 is below 97.`);
  }

  const referenceDemo = /reference\/demo|reference-demo/i.test(input.context.evidenceProvenance);
  const requiredHumanApprovals: HumanApprovalRecord['approvalScope'][] = ['external_distribution'];
  if (input.context.gates.some(gate => gate.category === 'claims')) {
    requiredHumanApprovals.push('legal_or_regulated_claims');
  }
  if (input.context.decision.launchAuthorization === 'approved') {
    requiredHumanApprovals.push('launch_authorization');
  }

  if (deterministicBlockers.length > 0) {
    return {
      allowed: false,
      status: 'blocked',
      deterministicBlockers,
      requiredHumanApprovals,
      reportFingerprint: input.context.decisionFingerprint,
    };
  }

  if (referenceDemo) {
    return {
      allowed: true,
      status: 'demonstration_only',
      deterministicBlockers: [],
      requiredHumanApprovals,
      reportFingerprint: input.context.decisionFingerprint,
    };
  }

  const approvals = input.humanApprovals ?? [];
  const approvedScopes = new Set(
    approvals
      .filter(approval => approval.reportFingerprint === input.context.decisionFingerprint)
      .map(approval => approval.approvalScope),
  );
  const missingApprovals = requiredHumanApprovals.filter(scope => !approvedScopes.has(scope));
  if (missingApprovals.length > 0) {
    return {
      allowed: true,
      status: 'internal_only',
      deterministicBlockers: [],
      requiredHumanApprovals: missingApprovals,
      reportFingerprint: input.context.decisionFingerprint,
    };
  }

  return {
    allowed: true,
    status: 'client_ready',
    deterministicBlockers: [],
    requiredHumanApprovals: [],
    reportFingerprint: input.context.decisionFingerprint,
  };
}
