import type { CommercializationReportRecord } from './database';

/**
 * Project routes are strict tenant-internal boundaries: a report with a
 * different or missing canonical project id must never appear in that project.
 * Legacy, projectless screens may continue to show the tenant-wide collection.
 */
export function reportBelongsToProject(
  report: Pick<CommercializationReportRecord, 'canonicalProjectId'>,
  projectId: string | null | undefined,
) {
  return !projectId || report.canonicalProjectId === projectId;
}

export function reportsForProject(
  reports: readonly CommercializationReportRecord[],
  projectId: string | null | undefined,
) {
  return reports.filter(report => reportBelongsToProject(report, projectId));
}
