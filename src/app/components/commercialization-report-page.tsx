import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FilePenLine, FileText, History, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../contexts/auth-context';
import { useFoodType, sampleMatchesFoodType } from '../contexts/food-type-context';
import {
  DEFAULT_REPORT_ORGANIZATION_NAME,
  DEFAULT_REPORT_WORKSPACE_NAME,
  rebuildDecisionForCommercialization,
  resolveReportLogoUrl,
  type CommercializationReportSnapshot,
} from '../lib/commercialization-report';
import {
  useAdminConceptTests,
  useCommercializationReports,
  useDecisionRecords,
  useDecisionFreshness,
  useInstrumentalDataset,
  useProjectEvidenceBundle,
  useWorkspaceSettings,
} from '../lib/hooks';
import { workflowStagePath } from '../lib/project-journey-routes';
import { buildReportContextForWorkspace } from '../lib/report-context-builder';
import { conceptBelongsToProject } from '../lib/concept-project-scope';
import { reportBelongsToProject } from '../lib/report-project-scope';
import { TEMPORARY_CHEESE_DECISION, TEMPORARY_CHEESE_DEMO_LABEL } from '../data/demo/temporary-cheese-demo';
import { downloadCommercializationReportPdf } from '../utils/commercialization-report-export';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { CommercializationReportBuilder } from './commercialization-report-builder';
import { ReportAgentReviewPanel } from './report-agent-review-panel';
import { ReportApprovalBar } from './report-approval-bar';
import { ReportCoverHeader } from './commercialization-report-ui';
import { ReportPdfSectionsPanel } from './report-pdf-sections-panel';
import { ReportReadinessPanel } from './report-readiness-panel';
import { ReportNarrativePanel, ReportPdfPreviewPanel, ReportVersionsPanel } from './report-workspace-panels';
import { StageEmptyState } from './stage-empty-state';
import { WorkflowPageHeader } from './workflow-page-header';
import { FormulationContextStrip } from './formulation-context-strip';
import { WorkflowLoadingState, WorkflowQueryErrorState } from './workflow-loading-state';
import { ReportDataExportSheet } from './report-data-export-sheet';

type WorkspaceTab = 'report' | 'review' | 'narrative' | 'preview' | 'versions';

function SetupFact({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${ok ? 'text-slate-900' : 'text-amber-700'}`}>{value}</p>
    </div>
  );
}

export function CommercializationReportPage() {
  const { user } = useAuth();
  const { foodType } = useFoodType();
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('report');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const decisionsQuery = useDecisionRecords();
  const reportsQuery = useCommercializationReports();
  const conceptsQuery = useAdminConceptTests();
  const instrumentalQuery = useInstrumentalDataset(user?.role === 'admin');
  const settingsQuery = useWorkspaceSettings();
  const { data: decisions = [] } = decisionsQuery;
  const { data: reports = [] } = reportsQuery;
  const { data: concepts = [] } = conceptsQuery;
  const { data: instrumentalDataset } = instrumentalQuery;
  const { data: settings } = settingsQuery;

  const requestedReport = reports.find(report => (
    report.id === searchParams.get('report')
    && reportBelongsToProject(report, routeProjectId)
    && (!routeProjectId
      || decisions.some(decision => decision.id === report.decisionRecordId && decision.projectId === routeProjectId))
  )) ?? null;
  const requestedDecisionId = searchParams.get('decision');
  const requestedDecision = decisions.find(decision => (
    decision.id === (requestedReport?.decisionRecordId ?? requestedDecisionId)
    && (!routeProjectId || decision.projectId === routeProjectId)
  )) ?? null;
  const currentSampleIds = useMemo(() => new Set(
    (instrumentalDataset?.eTongueData ?? [])
      .filter(sample => sample.type === foodType)
      .map(sample => sample.sampleId),
  ), [foodType, instrumentalDataset]);
  const projectGoDecisions = useMemo(() => decisions.filter(decision =>
    decision.decision === 'GO'
    && Boolean(decision.evidenceBundleId)
    && (!routeProjectId || decision.projectId === routeProjectId)
    && (currentSampleIds.has(decision.sampleId) || sampleMatchesFoodType(decision.sampleId, decision.sampleName) === foodType),
  ), [currentSampleIds, decisions, foodType, routeProjectId]);
  const focusDecision = requestedDecision ?? projectGoDecisions[0] ?? null;
  const { data: decisionFreshness } = useDecisionFreshness(focusDecision?.id);
  const { data: evidenceBundle, isLoading: evidenceLoading } = useProjectEvidenceBundle(
    focusDecision?.sampleId,
    user?.id,
    Boolean(focusDecision),
  );

  const matchingConcepts = useMemo(() => concepts.filter(concept =>
    concept.status !== 'archived'
    && conceptBelongsToProject(concept, routeProjectId)
    && concept.decisionRecordId === focusDecision?.id
    && (concept.foodTypeSlug === foodType || concept.category.toLowerCase().includes(foodType.toLowerCase())),
  ), [concepts, focusDecision?.id, foodType, routeProjectId]);
  const selectedConcept = requestedReport
    ? concepts.find(concept => concept.id === requestedReport.conceptTestId && conceptBelongsToProject(concept, routeProjectId)) ?? null
    : matchingConcepts[0] ?? null;
  const createMode = searchParams.get('create') === '1';
  const savedReport = requestedReport ?? (!createMode && focusDecision
    ? reports.find(report => (
        report.decisionRecordId === focusDecision.id
        && report.status !== 'archived'
        && reportBelongsToProject(report, routeProjectId)
      )) ?? null
    : null);
  const snapshot = savedReport?.reportSnapshot as unknown as CommercializationReportSnapshot | undefined;
  const reportDecision = focusDecision && evidenceBundle
    ? rebuildDecisionForCommercialization(focusDecision, evidenceBundle)
    : null;

  const reportVersions = savedReport
    ? reports
        .filter(report => (
          report.decisionRecordId === savedReport.decisionRecordId
          && report.conceptTestId === savedReport.conceptTestId
          && reportBelongsToProject(report, routeProjectId)
        ))
        .sort((left, right) => right.version - left.version)
    : [];
  const reportContextBuild = useMemo(() => {
    if (!savedReport || !snapshot || !focusDecision) return null;
    return buildReportContextForWorkspace({
      report: savedReport,
      snapshot,
      decisionRecord: focusDecision,
      evidenceBundle: evidenceBundle ?? null,
      evidenceBundleStatus: savedReport.evidenceBundleId ? 'linked' : 'rebuilt',
    });
  }, [evidenceBundle, focusDecision, savedReport, snapshot]);
  const reportContext = reportContextBuild?.reportContext ?? undefined;
  const readiness = reportContextBuild?.readiness;
  const pdfInput = savedReport && snapshot ? {
    snapshot,
    organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
    workspaceName: settings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
    reportFooter: settings?.reportFooter,
    version: savedReport.version,
    status: savedReport.status,
    logoUrl: resolveReportLogoUrl(settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME, settings?.logoUrl),
    primaryColor: settings?.primaryColor,
    accentColor: settings?.accentColor,
    reportTemplate: settings?.reportTemplate,
    reportContext,
  } : null;
  const usingDemoEvidence = focusDecision?.id === TEMPORARY_CHEESE_DECISION.id
    || selectedConcept?.approvalNotes === TEMPORARY_CHEESE_DEMO_LABEL
    || evidenceBundle?.commercialProfile?.evidenceStatus === 'reference_demo';

  const openSavedReport = (reportId: string) => {
    setWorkspaceTab('report');
    navigate(workflowStagePath('report', routeProjectId, `?report=${encodeURIComponent(reportId)}`));
  };
  const libraryPath = workflowStagePath('report', routeProjectId);
  const downloadPdf = async () => {
    if (!pdfInput || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      await downloadCommercializationReportPdf(pdfInput);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : 'Unable to download this report version.');
    } finally {
      setExporting(false);
    }
  };

  const reportSourceQueries = [decisionsQuery, reportsQuery, conceptsQuery, instrumentalQuery, settingsQuery];
  if (reportSourceQueries.some(query => query.isLoading)) {
    return <WorkflowLoadingState title="Loading report evidence" />;
  }
  if (reportSourceQueries.some(query => query.isError)) {
    return (
      <WorkflowQueryErrorState
        projectName="the selected project"
        checked="confirmed decisions, concepts, saved reports, and instrumental evidence"
        onRetry={() => reportSourceQueries.forEach(query => void query.refetch())}
      />
    );
  }

  if (!focusDecision) {
    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Commercialization report"
          description="Prepare the client deliverable after a GO decision has been confirmed."
          actions={<Button asChild variant="outline"><Link to={workflowStagePath('report', routeProjectId)}><ArrowLeft className="size-4" />Reports</Link></Button>}
        />
        <FormulationContextStrip projectId={routeProjectId} context="report" />
        <StageEmptyState
          icon={FileText}
          locked
          headline="A confirmed GO decision is required"
          body="Review the product evidence and confirm the decision before creating a commercialization report."
          cta={{ label: 'Open Decision review', to: workflowStagePath('decision', routeProjectId) }}
        />
      </div>
    );
  }

  if (decisionFreshness && !decisionFreshness.allowed) {
    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Commercialization report"
          description="The prior GO decision no longer matches the current product evidence."
          actions={<Button asChild variant="outline"><Link to={workflowStagePath('report', routeProjectId)}><ArrowLeft className="size-4" />Reports</Link></Button>}
        />
        <StageEmptyState
          icon={ShieldCheck}
          locked
          headline="Re-confirm the product decision"
          body={decisionFreshness.reason ?? 'Product evidence changed after the linked GO decision.'}
          cta={{ label: 'Open Decision review', to: workflowStagePath('decision', routeProjectId) }}
        />
      </div>
    );
  }

  if (!savedReport || !snapshot) {
    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Create commercialization report"
          description="Confirm the source decision and concept direction, then create a structured client report."
          actions={<Button asChild variant="outline"><Link to={libraryPath}><ArrowLeft className="size-4" />Reports</Link></Button>}
        />

        <FormulationContextStrip projectId={routeProjectId} sampleId={focusDecision.sampleId} context="report" />

        <section className="border-y border-slate-200 bg-white py-5">
          <div className="grid gap-5 md:grid-cols-3">
            <SetupFact label="Confirmed decision" value={`${focusDecision.sampleName} · GO · ISSF ${focusDecision.issfScore.toFixed(1)}`} ok />
            <SetupFact label="Concept evidence" value={selectedConcept ? selectedConcept.name : 'Concept required'} ok={Boolean(selectedConcept)} />
            <SetupFact label="Report evidence" value={evidenceLoading ? 'Building current evidence...' : evidenceBundle ? 'Current evidence ready' : 'Evidence unavailable'} ok={Boolean(evidenceBundle)} />
          </div>
        </section>

        {!selectedConcept ? (
          <StageEmptyState
            icon={FileText}
            headline="Create or link a concept before reporting"
            body="The commercialization report needs a product concept and packaging direction linked to this GO decision."
            cta={{ label: 'Open Concept Lab', to: workflowStagePath('concept', routeProjectId) }}
          />
        ) : reportDecision ? (
          <section className="border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-slate-900">Prepare version 1</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choose the concept and packaging direction, review the evidence boundaries, and save the first version. The finished report opens here immediately after saving.
                </p>
              </div>
              <CommercializationReportBuilder
                decision={reportDecision}
                foodType={foodType}
                projectId={routeProjectId}
                userId={user?.id}
                settings={settings}
                initiallyOpen={createMode}
                triggerLabel="Generate report"
                onSaved={openSavedReport}
              />
            </div>
          </section>
        ) : (
          <div className="border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Building the current evidence package for this decision...
          </div>
        )}
      </div>
    );
  }

  const approvalBlocker = snapshot.agentReview?.criticalBlockers?.[0]
    ?? (usingDemoEvidence ? 'This version uses demo/reference evidence and cannot be released as a client deliverable.' : undefined);

  return (
    <div className="space-y-5">
      <ReportCoverHeader
        settings={settings}
        sampleName={focusDecision.sampleName}
        foodTypeLabel={snapshot.product.foodType}
        decision={focusDecision.decision}
        issfScore={focusDecision.issfScore}
        confidence={focusDecision.confidence}
        decisionTone="success"
        timestamp={focusDecision.timestamp}
        draftLabel={`Version ${savedReport.version} · ${savedReport.status}`}
        actions={(
          <>
            <Button asChild variant="ghost" size="sm"><Link to={libraryPath}><ArrowLeft className="size-4" />Reports</Link></Button>
            {reportDecision && (
              <CommercializationReportBuilder
                decision={reportDecision}
                foodType={foodType}
                projectId={routeProjectId}
                userId={user?.id}
                settings={settings}
                triggerLabel="Generate new version"
                onSaved={openSavedReport}
              />
            )}
            <ReportDataExportSheet
              report={savedReport}
              snapshot={snapshot}
              decision={focusDecision}
              concept={selectedConcept}
              instrumentalDataset={instrumentalDataset}
              evidenceBundle={evidenceBundle ?? null}
              settings={settings}
              projectId={routeProjectId}
              initiallyOpen={searchParams.get('export') === 'data'}
            />
            <Button size="sm" onClick={() => void downloadPdf()} disabled={exporting}>
              <Download className="size-4" />{exporting ? 'Preparing...' : 'Download PDF'}
            </Button>
          </>
        )}
      />

      <FormulationContextStrip
        projectId={routeProjectId}
        sampleId={focusDecision.sampleId}
        formulationVersionId={savedReport.formulationVersionId ?? focusDecision.formulationVersionId}
        context="report"
      />

      {exportError && <p role="alert" className="text-sm text-rose-700">{exportError}</p>}

      {usingDemoEvidence && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p><strong>Demonstration report.</strong> The workflow and layout are fully functional, but reference evidence must be replaced before client release.</p>
        </div>
      )}

      {snapshot.formulation && (
        <section className="border-y border-slate-200 bg-white py-4" aria-label="Saved formulation traceability">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved formulation traceability</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                Version {snapshot.formulation.versionNumber} · {snapshot.formulation.reviewStatus.replace('_', ' ')}
              </p>
              <p className="mt-1 text-xs text-slate-600">Fingerprint {snapshot.formulation.fingerprint.slice(0, 12)} · {snapshot.formulation.reviewedIngredients.length} reviewed ingredients</p>
            </div>
            <div className="max-w-2xl text-xs leading-5 text-slate-700">
              <p><strong className="text-slate-900">Verified allergens:</strong> {snapshot.formulation.verifiedAllergens.join(', ') || 'None recorded'}</p>
              <p><strong className="text-slate-900">Readiness gaps:</strong> {snapshot.formulation.readinessGaps.join(' ') || 'No formulation gaps recorded.'}</p>
            </div>
          </div>
        </section>
      )}

      <ReportApprovalBar report={savedReport} blockedReason={approvalBlocker} />

      <Tabs value={workspaceTab} onValueChange={value => setWorkspaceTab(value as WorkspaceTab)}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-1">
          <TabsTrigger value="report" className="flex-none px-4"><FileText className="mr-2 size-4" />Report</TabsTrigger>
          <TabsTrigger value="review" className="flex-none px-4"><CheckCircle2 className="mr-2 size-4" />Release review</TabsTrigger>
          <TabsTrigger value="preview" className="flex-none px-4"><FileText className="mr-2 size-4" />PDF preview</TabsTrigger>
          <TabsTrigger value="narrative" className="flex-none px-4"><FilePenLine className="mr-2 size-4" />Edit content</TabsTrigger>
          <TabsTrigger value="versions" className="flex-none px-4"><History className="mr-2 size-4" />History ({reportVersions.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {workspaceTab === 'report' && pdfInput && <ReportPdfSectionsPanel input={pdfInput} />}
      {workspaceTab === 'review' && pdfInput && reportContext && (
        <div className="space-y-4">
          {readiness && <ReportReadinessPanel readiness={readiness} />}
          <ReportAgentReviewPanel input={{ ...pdfInput, reportContext }} />
        </div>
      )}
      {workspaceTab === 'narrative' && <ReportNarrativePanel key={savedReport.id} report={savedReport} snapshot={snapshot} />}
      {workspaceTab === 'preview' && pdfInput && <ReportPdfPreviewPanel input={pdfInput} />}
      {workspaceTab === 'versions' && (
        <ReportVersionsPanel
          reports={reportVersions}
          selectedId={savedReport.id}
          reportHref={reportId => workflowStagePath('report', routeProjectId, `?report=${encodeURIComponent(reportId)}`)}
        />
      )}
    </div>
  );
}
