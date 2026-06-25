import type { CommercializationReportRecord, ConceptTest, DecisionRecord } from './database';
import type { CommercializationReportSnapshot } from './commercialization-report';
import type { ReportReadiness } from './report-context-builder';

export interface ReportLibraryEntry {
  key: string;
  latest: CommercializationReportRecord;
  versions: CommercializationReportRecord[];
  snapshot: CommercializationReportSnapshot | null;
  productName: string;
  foodType: string;
  conceptName: string;
  decision: string;
  exportReady: boolean;
  approvalReady: boolean;
  blockers: string[];
  warnings: string[];
  evidenceProvenance: ReportReadiness['evidenceProvenance'];
  readiness?: ReportReadiness;
}

function asSnapshot(report: CommercializationReportRecord): CommercializationReportSnapshot | null {
  const snapshot = report.reportSnapshot as unknown as Partial<CommercializationReportSnapshot>;
  if (!snapshot?.product?.sampleName || !snapshot?.decision?.recordId) return null;
  return snapshot as CommercializationReportSnapshot;
}

export function buildReportLibrary(
  reports: CommercializationReportRecord[],
  decisions: DecisionRecord[],
  concepts: ConceptTest[],
  readinessByReportId: Record<string, ReportReadiness> = {},
): ReportLibraryEntry[] {
  const decisionsById = new Map(decisions.map(decision => [decision.id, decision]));
  const conceptsById = new Map(concepts.map(concept => [concept.id, concept]));
  const grouped = new Map<string, CommercializationReportRecord[]>();

  reports.forEach(report => {
    const key = `${report.decisionRecordId}:${report.conceptTestId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), report]);
  });

  return [...grouped.entries()]
    .map(([key, versions]) => {
      const sorted = [...versions].sort((a, b) => {
        if (a.version !== b.version) return b.version - a.version;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      const latest = sorted.find(report => report.status !== 'archived') ?? sorted[0];
      const snapshot = asSnapshot(latest);
      const decision = decisionsById.get(latest.decisionRecordId);
      const concept = conceptsById.get(latest.conceptTestId);
      const readiness = readinessByReportId[latest.id];

      return {
        key,
        latest,
        versions: sorted,
        snapshot,
        productName: snapshot?.product.sampleName ?? decision?.sampleName ?? latest.title,
        foodType: snapshot?.product.foodType ?? concept?.foodTypeSlug ?? 'Uncategorized',
        conceptName: snapshot?.concept.name ?? concept?.name ?? 'Concept not available',
        decision: snapshot?.decision.outcome ?? decision?.decision ?? 'Unknown',
        exportReady: readiness?.exportReady ?? false,
        approvalReady: readiness?.approvalReady ?? false,
        blockers: readiness?.blockers ?? (snapshot ? [] : ['Saved report snapshot is incomplete.']),
        warnings: readiness?.warnings ?? [],
        evidenceProvenance: readiness?.evidenceProvenance ?? { sensory: 'none', instrumental: 'none', concept: 'none', purchaseIntent: 'none' },
        readiness,
      };
    })
    .sort((a, b) => new Date(b.latest.updatedAt).getTime() - new Date(a.latest.updatedAt).getTime());
}

export function filterReportLibrary(
  entries: ReportLibraryEntry[],
  search: string,
  status: 'all' | CommercializationReportRecord['status'],
) {
  const query = search.trim().toLowerCase();
  return entries.filter(entry => {
    const matchesStatus = status === 'all'
      ? entry.latest.status !== 'archived'
      : entry.latest.status === status;
    const matchesSearch = !query || [
      entry.latest.title,
      entry.productName,
      entry.foodType,
      entry.conceptName,
    ].some(value => value.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });
}
