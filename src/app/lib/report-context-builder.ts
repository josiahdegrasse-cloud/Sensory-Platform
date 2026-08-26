import {
  buildCommercializationReportPdf,
  buildGeneratedReportSections,
  type CommercializationReportPdfInput,
} from '../utils/commercialization-report-export';
import {
  DEFAULT_REPORT_ORGANIZATION_NAME,
  DEFAULT_REPORT_WORKSPACE_NAME,
  resolveReportLogoUrl,
  type CommercializationReportSnapshot,
} from './commercialization-report';
import {
  buildReportContext,
  runQcPipeline,
  validateReportContext,
  type ApprovalStatus,
  type ReportContext,
  type SensoryAugmentation,
} from './report-qc';
import { buildEvidenceBundle } from './report-evidence-source';
import {
  fetchCommercializationReports,
  fetchDecisionRecords,
  fetchEvidenceBundles,
  fetchWorkspaceSettings,
  type CommercializationReportRecord,
  type DecisionRecord,
  type EvidenceBundleRecord,
  type WorkspaceSettings,
} from './database';
import type { EvidenceBundle } from './report-evidence-types';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';

export type ReportProvenance = 'live' | 'reference' | 'none';

export interface ReportReadiness {
  exportReady: boolean;
  approvalReady: boolean;
  blockers: string[];
  warnings: string[];
  evidenceProvenance: {
    sensory: ReportProvenance;
    instrumental: ReportProvenance;
    concept: ReportProvenance;
    purchaseIntent: ReportProvenance;
  };
  evidenceBundleStatus: 'linked' | 'rebuilt' | 'missing';
  sensoryStatus: string;
  instrumentalStatus: string;
  conceptStatus: string;
  purchaseIntentStatus: string;
  approvalBlockers: string[];
  exportBlockers: string[];
  qcWarnings: string[];
  agentStatus: 'not_run' | 'passed' | 'partial' | 'blocked' | 'stale';
}

export interface BuiltReportContext {
  report: CommercializationReportRecord;
  snapshot: CommercializationReportSnapshot;
  decisionRecord: DecisionRecord;
  evidenceBundle: EvidenceBundle | null;
  reportContext: ReportContext;
  readiness: ReportReadiness;
  pdfInput: CommercializationReportPdfInput & { reportContext: ReportContext };
}

export interface ReportContextBuildFailure {
  report?: CommercializationReportRecord | null;
  snapshot?: CommercializationReportSnapshot | null;
  blockers: string[];
  warnings: string[];
  readiness: ReportReadiness;
}

export type ReportContextBuildResult =
  | ({ ok: true } & BuiltReportContext)
  | ({ ok: false } & ReportContextBuildFailure);

export function canMutateReportVersion(report: CommercializationReportRecord): boolean {
  return report.status !== 'approved';
}

function emptyReadiness(blockers: string[] = [], warnings: string[] = []): ReportReadiness {
  return {
    exportReady: false,
    approvalReady: false,
    blockers,
    warnings,
    evidenceProvenance: { sensory: 'none', instrumental: 'none', concept: 'none', purchaseIntent: 'none' },
    evidenceBundleStatus: 'missing',
    sensoryStatus: 'No sensory context rebuilt',
    instrumentalStatus: 'No instrumental context rebuilt',
    conceptStatus: 'No concept context rebuilt',
    purchaseIntentStatus: 'No purchase-intent context rebuilt',
    approvalBlockers: blockers,
    exportBlockers: blockers,
    qcWarnings: warnings,
    agentStatus: 'not_run',
  };
}

export function isCommercializationSnapshot(value: unknown): value is CommercializationReportSnapshot {
  const snapshot = value as Partial<CommercializationReportSnapshot> | null;
  return Boolean(
    snapshot?.product?.sampleId
    && snapshot.product.sampleName
    && snapshot.decision?.recordId
    && snapshot.concept?.id
    && snapshot.narrative,
  );
}

export function decisionRecordToGoStopTweakDecision(
  decision: DecisionRecord,
  snapshot: CommercializationReportSnapshot,
): GoStopTweakDecision {
  return {
    sampleId: snapshot.product.sampleId,
    sampleName: snapshot.product.sampleName,
    issfScore: snapshot.decision.issfScore,
    confidenceScore: snapshot.decision.confidence,
    decision: decision.decision,
    recommendation: snapshot.decision.recommendation,
    riskLevel: 'medium',
    details: decision.note ? [decision.note] : [],
    dimensionScores: snapshot.decision.dimensions,
    gates: snapshot.decision.gates ?? [],
    prescriptions: snapshot.decision.prescriptions,
    decisionFingerprint: snapshot.decision.fingerprint || decision.decisionFingerprint,
    methodVersion: snapshot.decision.methodVersion || decision.methodVersion,
  };
}

function bundlePayload(record: EvidenceBundleRecord | undefined): EvidenceBundle | null {
  return (record?.payload as unknown as EvidenceBundle | undefined) ?? null;
}

function evidenceBundleToAugmentation(
  bundle: EvidenceBundle | null,
  fallbackFoodType: string,
): SensoryAugmentation {
  const sp = bundle?.sensoryProfile ?? null;
  return {
    panelSize: sp?.panelSize ?? null,
    sourceEvidenceIds: bundle?.evidence.map(record => record.id) ?? [],
    sensoryDescriptors: (sp?.descriptors ?? []).map(descriptor => ({
      ...descriptor,
      sampleSize: sp?.panelSize ?? 0,
      percentage: sp?.panelSize ? descriptor.count / sp.panelSize * 100 : 0,
    })),
    dimensions: Object.fromEntries(
      Object.entries(sp?.dimensionMeasures ?? {}).map(([key, measures]) => [
        key,
        { measures, agreement: null, benchmark: null },
      ]),
    ),
    intensity: sp?.intensity,
    foodTypeSlug: sp?.foodTypeSlug ?? fallbackFoodType,
    instrumentalFindings: sp?.instrumentalFindings,
    instrumentalParameters: bundle?.instrumentalParameters ?? [],
    instrumentSignal: sp?.instrumentSignal,
    gatePenalty: sp?.gatePenalty,
    confidenceCalculation: sp?.confidenceCalculation,
  };
}

function approvalStatus(status: CommercializationReportRecord['status']): ApprovalStatus {
  if (status === 'approved') return 'approved';
  if (status === 'review') return 'in_review';
  return 'draft';
}

function provenanceFromContext(ctx: ReportContext): ReportReadiness['evidenceProvenance'] {
  const reference = /reference\/demo|reference-demo|synthetic concept responses/i.test(ctx.evidenceProvenance);
  return {
    sensory: reference ? 'reference' : ctx.dimensions.some(d => d.sampleSize && d.sampleSize > 0) ? 'live' : 'none',
    instrumental: ctx.instrumental.available ? 'live' : 'none',
    concept: ctx.concept.responseCount > 0 ? (reference ? 'reference' : 'live') : 'none',
    purchaseIntent: ctx.concept.purchaseIntent !== null ? (reference ? 'reference' : 'live') : 'none',
  };
}

export function buildReportReadiness(input: {
  report: CommercializationReportRecord;
  ctx?: ReportContext;
  evidenceBundle: EvidenceBundle | null;
  evidenceBundleStatus: ReportReadiness['evidenceBundleStatus'];
  exportBlockers?: string[];
  warnings?: string[];
}): ReportReadiness {
  if (!input.ctx) return emptyReadiness(input.exportBlockers ?? ['ReportContext could not be rebuilt.'], input.warnings);
  const generated = buildGeneratedReportSections({
    snapshot: input.report.reportSnapshot as unknown as CommercializationReportSnapshot,
    organizationName: DEFAULT_REPORT_ORGANIZATION_NAME,
    workspaceName: DEFAULT_REPORT_WORKSPACE_NAME,
    version: input.report.version,
    status: input.report.status,
    reportContext: input.ctx,
  });
  const qc = runQcPipeline({ ctx: input.ctx, generated });
  const contextValidation = validateReportContext(input.ctx);
  const exportBlockers = [
    ...(input.exportBlockers ?? []),
    ...qc.score.blockers,
    ...qc.reportValidation.errors.filter(error => error.blocksExport).map(error => `${error.code}: ${error.message}`),
  ];
  const approvalBlockers = [
    ...exportBlockers,
    ...qc.missingEvidence,
    ...contextValidation.errors.filter(error => error.blocksExport).map(error => `${error.code}: ${error.message}`),
  ];
  const provenance = provenanceFromContext(input.ctx);
  const agentReview = (input.report.reportSnapshot as unknown as CommercializationReportSnapshot).agentReview;
  const agentStatus = agentReview?.status ?? (agentReview ? 'partial' : 'not_run');
  return {
    exportReady: exportBlockers.length === 0 && qc.exportAllowed,
    approvalReady: input.report.status !== 'archived'
      && approvalBlockers.length === 0
      && provenance.sensory === 'live'
      && provenance.concept === 'live',
    blockers: [...new Set([...exportBlockers, ...approvalBlockers])],
    warnings: [...new Set([...(input.warnings ?? []), ...qc.score.warnings])],
    evidenceProvenance: provenance,
    evidenceBundleStatus: input.evidenceBundleStatus,
    sensoryStatus: provenance.sensory === 'live' ? `Live sensory evidence (${input.ctx.dimensions[0]?.population ?? 'panel documented'})` : provenance.sensory === 'reference' ? 'Reference/demo sensory evidence' : 'No sensory evidence',
    instrumentalStatus: input.ctx.instrumental.available ? 'Instrumental evidence included' : input.ctx.instrumental.absenceNote ?? 'No instrumental evidence',
    conceptStatus: input.ctx.concept.responseCount > 0
      ? provenance.concept === 'reference'
        ? `${input.ctx.concept.responseCount} synthetic concept responses (test only)`
        : `${input.ctx.concept.responseCount} concept responses`
      : 'Missing concept evidence',
    purchaseIntentStatus: input.ctx.concept.purchaseIntent !== null
      ? provenance.purchaseIntent === 'reference'
        ? `${input.ctx.concept.purchaseIntent.toFixed(1)}/9 synthetic purchase intent (test only)`
        : `${input.ctx.concept.purchaseIntent.toFixed(1)}/9 purchase intent`
      : 'Purchase intent not available',
    approvalBlockers: [...new Set(approvalBlockers)],
    exportBlockers: [...new Set(exportBlockers)],
    qcWarnings: qc.score.warnings,
    agentStatus: agentStatus === 'blocked' || agentStatus === 'passed' || agentStatus === 'partial' ? agentStatus : 'not_run',
  };
}

export async function buildReportContextFromRecords(input: {
  report: CommercializationReportRecord;
  decisionRecord: DecisionRecord | null | undefined;
  evidenceBundle: EvidenceBundle | null;
  evidenceBundleStatus: ReportReadiness['evidenceBundleStatus'];
  settings?: WorkspaceSettings | null;
}): Promise<ReportContextBuildResult> {
  const snapshot = input.report.reportSnapshot as unknown;
  if (!isCommercializationSnapshot(snapshot)) {
    const blockers = ['Saved report snapshot is missing required commercialization fields.'];
    return { ok: false, report: input.report, snapshot: null, blockers, warnings: [], readiness: emptyReadiness(blockers) };
  }
  if (!input.decisionRecord) {
    const blockers = ['Linked decision record could not be found.'];
    return { ok: false, report: input.report, snapshot, blockers, warnings: [], readiness: emptyReadiness(blockers) };
  }
  if (input.decisionRecord.decision !== 'GO' || snapshot.decision.outcome !== 'GO') {
    const blockers = ['Formal commercialization report export requires a confirmed GO decision.'];
    return { ok: false, report: input.report, snapshot, blockers, warnings: [], readiness: emptyReadiness(blockers) };
  }
  if (!input.evidenceBundle) {
    const blockers = ['Evidence bundle is missing; rebuild report evidence before export.'];
    return { ok: false, report: input.report, snapshot, blockers, warnings: [], readiness: emptyReadiness(blockers) };
  }

  const liveDecision = decisionRecordToGoStopTweakDecision(input.decisionRecord, snapshot);
  const reportContext = buildReportContext({
    snapshot,
    decision: liveDecision,
    approvalStatus: approvalStatus(input.report.status),
    claimsApproved: Boolean(
      input.report.claimsApprovedAt
      && input.report.claimsEvidenceFingerprint === snapshot.decision.fingerprint
    ),
    reportVersion: input.report.version,
    readinessThreshold: 60,
    augmentation: evidenceBundleToAugmentation(input.evidenceBundle, snapshot.product.foodType),
    commercialProfile: input.evidenceBundle.commercialProfile,
  });
  const readiness = buildReportReadiness({
    report: input.report,
    ctx: reportContext,
    evidenceBundle: input.evidenceBundle,
    evidenceBundleStatus: input.evidenceBundleStatus,
  });
  const settings = input.settings ?? await fetchWorkspaceSettings();
  const pdfInput = {
    snapshot,
    organizationName: settings.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
    workspaceName: settings.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
    reportFooter: settings.reportFooter,
    version: input.report.version,
    status: input.report.status,
    logoUrl: resolveReportLogoUrl(settings.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME, settings.logoUrl),
    primaryColor: settings.primaryColor,
    accentColor: settings.accentColor,
    reportTemplate: settings.reportTemplate,
    reportContext,
  } satisfies CommercializationReportPdfInput & { reportContext: ReportContext };
  return {
    ok: true,
    report: input.report,
    snapshot,
    decisionRecord: input.decisionRecord,
    evidenceBundle: input.evidenceBundle,
    reportContext,
    readiness,
    pdfInput,
  };
}

export function buildReportContextForWorkspace(input: {
  report: CommercializationReportRecord;
  snapshot: CommercializationReportSnapshot;
  decisionRecord: DecisionRecord;
  evidenceBundle: EvidenceBundle | null;
  evidenceBundleStatus?: ReportReadiness['evidenceBundleStatus'];
}): { reportContext: ReportContext | null; readiness: ReportReadiness } {
  if (!input.evidenceBundle) {
    const blockers = ['Evidence bundle is missing; rebuild report evidence before export.'];
    return { reportContext: null, readiness: emptyReadiness(blockers) };
  }
  const liveDecision = decisionRecordToGoStopTweakDecision(input.decisionRecord, input.snapshot);
  const reportContext = buildReportContext({
    snapshot: input.snapshot,
    decision: liveDecision,
    approvalStatus: approvalStatus(input.report.status),
    claimsApproved: Boolean(
      input.report.claimsApprovedAt
      && input.report.claimsEvidenceFingerprint === input.snapshot.decision.fingerprint
    ),
    reportVersion: input.report.version,
    readinessThreshold: 60,
    augmentation: evidenceBundleToAugmentation(input.evidenceBundle, input.snapshot.product.foodType),
    commercialProfile: input.evidenceBundle.commercialProfile,
  });
  return {
    reportContext,
    readiness: buildReportReadiness({
      report: input.report,
      ctx: reportContext,
      evidenceBundle: input.evidenceBundle,
      evidenceBundleStatus: input.evidenceBundleStatus ?? 'rebuilt',
    }),
  };
}

export async function buildSavedReportExportContext(reportId: string): Promise<ReportContextBuildResult> {
  const [reports, decisions, settings] = await Promise.all([
    fetchCommercializationReports(),
    fetchDecisionRecords(500),
    fetchWorkspaceSettings(),
  ]);
  const report = reports.find(item => item.id === reportId) ?? null;
  if (!report) {
    const blockers = ['Saved report could not be found.'];
    return { ok: false, report: null, snapshot: null, blockers, warnings: [], readiness: emptyReadiness(blockers) };
  }
  const snapshot = report.reportSnapshot as unknown;
  if (!isCommercializationSnapshot(snapshot)) {
    const blockers = ['Saved report snapshot is missing required commercialization fields.'];
    return { ok: false, report, snapshot: null, blockers, warnings: [], readiness: emptyReadiness(blockers) };
  }
  let evidenceBundle: EvidenceBundle | null;
  let evidenceBundleStatus: ReportReadiness['evidenceBundleStatus'];
  try {
    const evidenceRecords = await fetchEvidenceBundles(snapshot.product.sampleId);
    const linked = report.evidenceBundleId
      ? evidenceRecords.find(bundle => bundle.id === report.evidenceBundleId)
      : undefined;
    const fallback = evidenceRecords[0];
    evidenceBundle = bundlePayload(linked ?? fallback);
    evidenceBundleStatus = linked ? 'linked' : fallback ? 'rebuilt' : 'missing';
    if (!evidenceBundle) {
      evidenceBundle = await buildEvidenceBundle(snapshot.product.sampleId, report.createdBy);
      evidenceBundleStatus = 'rebuilt';
    }
  } catch {
    const blockers = ['Evidence context could not be rebuilt from the saved report records.'];
    return { ok: false, report, snapshot, blockers, warnings: [], readiness: emptyReadiness(blockers) };
  }
  return buildReportContextFromRecords({
    report,
    decisionRecord: decisions.find(decision => decision.id === report.decisionRecordId),
    evidenceBundle,
    evidenceBundleStatus,
    settings,
  });
}

export async function downloadSavedReportPdf(reportId: string): Promise<ReportContextBuildResult> {
  const result = await buildSavedReportExportContext(reportId);
  if (!result.ok) return result;
  const { doc, qc, filename } = await buildCommercializationReportPdf(result.pdfInput);
  if (qc && !qc.exportAllowed) {
    const blockers = qc.score.blockers.length ? qc.score.blockers : ['Report quality control blocked export.'];
    return {
      ok: false,
      report: result.report,
      snapshot: result.snapshot,
      blockers,
      warnings: qc.score.warnings,
      readiness: { ...result.readiness, exportReady: false, exportBlockers: blockers, blockers },
    };
  }
  doc.save(filename);
  return result;
}
