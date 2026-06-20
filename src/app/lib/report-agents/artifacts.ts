import type {
  EvidenceAuditResult,
  ReportClaimLineage,
  WrittenReportResult,
} from './types';

export function buildClaimLineage(input: {
  draft: WrittenReportResult;
  evidenceAudit: EvidenceAuditResult;
  reportFingerprint: string;
  editorialReviewed: boolean;
  redTeamReviewed: boolean;
  finalJudgeReviewed: boolean;
}): ReportClaimLineage[] {
  const auditByClaim = new Map(input.evidenceAudit.claims.map(claim => [claim.claimId, claim]));
  return input.draft.pages.flatMap(page => page.sections.flatMap(section =>
    section.claimIds.map(claimId => {
      const audit = auditByClaim.get(claimId);
      const reviewerAgents: ReportClaimLineage['reviewerAgents'] = ['evidence_auditor'];
      if (input.editorialReviewed) reviewerAgents.push('editorial_reviewer');
      if (input.redTeamReviewed) reviewerAgents.push('client_red_team');
      if (input.finalJudgeReviewed) reviewerAgents.push('final_independent_judge');
      return {
        claimId,
        sectionId: section.sectionId,
        evidenceIds: audit?.supportingEvidenceIds ?? section.evidenceIds,
        generatingAgent: 'professional_report_writer',
        reviewerAgents,
        approvalState: audit?.status === 'unsupported'
          ? 'rejected'
          : audit?.status === 'supported' || audit?.status === 'directional'
            ? 'approved'
            : 'unreviewed',
        reportFingerprint: input.reportFingerprint,
      };
    }),
  ));
}

export function serializeReportAgentArtifacts(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
