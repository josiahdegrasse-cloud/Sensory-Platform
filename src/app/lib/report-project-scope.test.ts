import { describe, expect, it } from 'vitest';
import type { CommercializationReportRecord } from './database';
import { reportBelongsToProject, reportsForProject } from './report-project-scope';

function report(id: string, canonicalProjectId: string | null): CommercializationReportRecord {
  return { id, canonicalProjectId } as CommercializationReportRecord;
}

describe('report project scope', () => {
  const cashewReport = report('cashew-report', 'cashew-project');
  const mozzaReport = report('mozza-report', 'mozza-project');
  const legacy = report('legacy-projectless', null);

  it('shows only reports with the exact canonical project id on project routes', () => {
    expect(reportsForProject(
      [cashewReport, mozzaReport, legacy],
      'mozza-project',
    ).map(item => item.id)).toEqual(['mozza-report']);
  });

  it('does not treat a missing project id as a match for a canonical project', () => {
    expect(reportBelongsToProject(legacy, 'mozza-project')).toBe(false);
  });

  it('preserves tenant-wide legacy views when no project is active', () => {
    expect(reportsForProject([cashewReport, mozzaReport, legacy], undefined)).toHaveLength(3);
  });
});
