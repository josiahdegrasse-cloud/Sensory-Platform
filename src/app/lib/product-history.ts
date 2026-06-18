import type { ImportBatchRecord } from './db/imports';
import type { DecisionRecord } from './db/workspace';
import type { ConceptTest, CommercializationReportRecord } from './db/concepts';

export type ProductHistoryEventType =
  | 'import'
  | 'decision'
  | 'concept'
  | 'report';

export interface ProductHistoryEvent {
  id: string;
  type: ProductHistoryEventType;
  timestamp: string;
  label: string;
  detail: string;
  metadata: Record<string, unknown>;
}

export interface IssfStep {
  timestamp: string;
  score: number;
  decision: 'GO' | 'TWEAK' | 'STOP';
}

export interface ProductTimeline {
  sampleId: string;
  sampleName: string;
  events: ProductHistoryEvent[];
  issfProgression: IssfStep[];
}

function batchContainsSample(batch: ImportBatchRecord, sampleId: string): boolean {
  return batch.fileName.toLowerCase().includes(sampleId.toLowerCase());
}

export function buildProductTimeline(
  sampleId: string,
  sampleName: string,
  batches: ImportBatchRecord[],
  decisions: DecisionRecord[],
  concepts: ConceptTest[],
  reports: CommercializationReportRecord[],
): ProductTimeline {
  const events: ProductHistoryEvent[] = [];

  const sampleDecisions = decisions.filter(d => d.sampleId === sampleId);
  const decisionIds = new Set(sampleDecisions.map(d => d.id));

  // Import batches – linked by sampleId appearing in the batch file name
  // (best available linkage without a separate batch-sample join table)
  const sampleBatches = batches.filter(b => batchContainsSample(b, sampleId));
  for (const batch of sampleBatches) {
    events.push({
      id: `import-${batch.id}`,
      type: 'import',
      timestamp: batch.createdAt,
      label: batch.reformulationNotes ? 'Reformulation import' : 'Instrumental import',
      detail: batch.reformulationNotes
        ? `${batch.fileName} — ${batch.reformulationNotes}`
        : `${batch.fileName} · ${batch.sampleCount} sample${batch.sampleCount !== 1 ? 's' : ''}`,
      metadata: { batchId: batch.id, reformulationNotes: batch.reformulationNotes ?? null },
    });
  }

  // Decision records
  for (const dec of sampleDecisions) {
    events.push({
      id: `decision-${dec.id}`,
      type: 'decision',
      timestamp: dec.timestamp,
      label: `${dec.decision} decision`,
      detail: `ISSF ${dec.issfScore.toFixed(1)} · ${dec.note || 'No additional notes'}`,
      metadata: {
        decision: dec.decision,
        issfScore: dec.issfScore,
        confidence: dec.confidence,
        parentDecisionId: dec.parentDecisionId ?? null,
      },
    });
  }

  // Concept tests – linked by projectName or foodTypeSlug containing sampleId
  const linkedConcepts = concepts.filter(c =>
    (c.projectName?.toLowerCase().includes(sampleId.toLowerCase())) ||
    (c.foodTypeSlug?.toLowerCase().includes(sampleId.toLowerCase()))
  );
  for (const concept of linkedConcepts) {
    events.push({
      id: `concept-${concept.id}`,
      type: 'concept',
      timestamp: concept.launchedAt ?? concept.createdAt,
      label: `Concept test: ${concept.name}`,
      detail: `${concept.category} · ${concept.status}`,
      metadata: { conceptId: concept.id, status: concept.status, variantDimensions: concept.variantDimensions ?? null },
    });
  }

  // Reports – linked via decisionRecordId
  const linkedReports = reports.filter(r => decisionIds.has(r.decisionRecordId));
  for (const report of linkedReports) {
    events.push({
      id: `report-${report.id}`,
      type: 'report',
      timestamp: report.createdAt,
      label: `Commercialization report: ${report.title}`,
      detail: `v${report.version} · ${report.status}`,
      metadata: { reportId: report.id, status: report.status },
    });
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const issfProgression: IssfStep[] = sampleDecisions
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(d => ({ timestamp: d.timestamp, score: d.issfScore, decision: d.decision }));

  return { sampleId, sampleName, events, issfProgression };
}
