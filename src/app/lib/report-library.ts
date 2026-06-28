import type { CommercializationReportRecord, ConceptTest, DecisionRecord } from './database';
import type { CommercializationReportSnapshot } from './commercialization-report';
import type { ReportReadiness } from './report-context-builder';

export type ReportReleaseStatus = 'client_ready' | 'internal_draft' | 'demonstration_only' | 'blocked';

export interface ReportLibraryEntry {
  key: string;
  latest: CommercializationReportRecord;
  versions: CommercializationReportRecord[];
  snapshot: CommercializationReportSnapshot | null;
  displayTitle: string;
  templateTitle: string | null;
  productName: string;
  foodType: string;
  conceptName: string;
  decision: string;
  exportReady: boolean;
  approvalReady: boolean;
  blockers: string[];
  warnings: string[];
  evidenceProvenance: ReportReadiness['evidenceProvenance'];
  releaseStatus: ReportReleaseStatus;
  readiness?: ReportReadiness;
}

function asSnapshot(report: CommercializationReportRecord): CommercializationReportSnapshot | null {
  const snapshot = report.reportSnapshot as unknown as Partial<CommercializationReportSnapshot>;
  if (!snapshot?.product?.sampleName || !snapshot?.decision?.recordId) return null;
  return snapshot as CommercializationReportSnapshot;
}

function isTemplateLikeTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  return [
    'editorial sage',
    'cream masthead',
    'sage banners',
    'report template',
    'commercialization template',
  ].some(fragment => normalized.includes(fragment));
}

function buildDisplayTitle(input: {
  title: string;
  productName: string;
  conceptName: string;
}) {
  const title = input.title.trim();
  const productName = input.productName.trim();
  const conceptName = input.conceptName.trim();
  if (title && !isTemplateLikeTitle(title)) return title;
  if (productName) return `${productName} commercialization report`;
  if (conceptName && conceptName !== 'Concept not available') return `${conceptName} commercialization report`;
  return title || 'Commercialization report';
}

export function getReportReleaseStatus(input: {
  reportStatus: CommercializationReportRecord['status'];
  exportReady: boolean;
  approvalReady: boolean;
  blockers: string[];
  evidenceProvenance: ReportReadiness['evidenceProvenance'];
}): ReportReleaseStatus {
  const hasReferenceEvidence = Object.values(input.evidenceProvenance).some(value => value === 'reference');
  const hasMissingRequiredEvidence = input.evidenceProvenance.concept === 'none' || input.blockers.length > 0;

  if (hasReferenceEvidence) return 'demonstration_only';
  if (hasMissingRequiredEvidence || !input.exportReady) return 'blocked';
  if (input.reportStatus === 'approved' && input.approvalReady) return 'client_ready';
  return 'internal_draft';
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

      const exportReady = readiness?.exportReady ?? false;
      const approvalReady = readiness?.approvalReady ?? false;
      const blockers = readiness?.blockers ?? (snapshot ? [] : ['Saved report snapshot is incomplete.']);
      const evidenceProvenance = readiness?.evidenceProvenance ?? { sensory: 'none', instrumental: 'none', concept: 'none', purchaseIntent: 'none' };
      const productName = snapshot?.product.sampleName ?? decision?.sampleName ?? 'Product not linked';
      const conceptName = snapshot?.concept.name ?? concept?.name ?? 'Concept not available';
      const displayTitle = buildDisplayTitle({
        title: latest.title,
        productName,
        conceptName,
      });
      const templateTitle = isTemplateLikeTitle(latest.title) ? latest.title : null;

      return {
        key,
        latest,
        versions: sorted,
        snapshot,
        displayTitle,
        templateTitle,
        productName,
        foodType: snapshot?.product.foodType ?? concept?.foodTypeSlug ?? 'Uncategorized',
        conceptName,
        decision: snapshot?.decision.outcome ?? decision?.decision ?? 'Unknown',
        exportReady,
        approvalReady,
        blockers,
        warnings: readiness?.warnings ?? [],
        evidenceProvenance,
        releaseStatus: getReportReleaseStatus({
          reportStatus: latest.status,
          exportReady,
          approvalReady,
          blockers,
          evidenceProvenance,
        }),
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
      entry.displayTitle,
      entry.latest.title,
      entry.templateTitle ?? '',
      entry.productName,
      entry.foodType,
      entry.conceptName,
    ].some(value => value.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });
}
