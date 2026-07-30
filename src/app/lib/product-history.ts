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

export function buildProductTimeline(
  sampleId: string,
  sampleName: string,
  batches: ImportBatchRecord[],
  decisions: DecisionRecord[],
  concepts: ConceptTest[],
  reports: CommercializationReportRecord[],
  scope?: {
    instrumentalSampleId?: string | null;
    importBatchId?: string | null;
    projectId?: string | null;
  },
): ProductTimeline {
  const events: ProductHistoryEvent[] = [];

  const sampleDecisions = decisions.filter(decision => {
    if (scope?.instrumentalSampleId && decision.instrumentalSampleId) {
      return decision.instrumentalSampleId === scope.instrumentalSampleId;
    }
    if (decision.instrumentalSampleId) return false;
    return decision.sampleId === sampleId
      && (!scope?.projectId || decision.projectId === scope.projectId);
  });
  const decisionIds = new Set(sampleDecisions.map(d => d.id));

  // The selected instrumental sample owns its import batch. Do not infer
  // lineage from a filename or a repeated text sample ID.
  const sampleBatches = scope?.importBatchId
    ? batches.filter(batch => batch.id === scope.importBatchId)
    : [];
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

  // Concepts are linked only through an authoritative decision or a report
  // that preserves both the decision and concept ids. Names are never lineage.
  const reportConceptIds = new Set(
    reports.filter(report => decisionIds.has(report.decisionRecordId)).map(report => report.conceptTestId),
  );
  const linkedConcepts = concepts.filter(concept =>
    (concept.decisionRecordId ? decisionIds.has(concept.decisionRecordId) : false)
    || reportConceptIds.has(concept.id),
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
