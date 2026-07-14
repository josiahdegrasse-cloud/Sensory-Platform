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
  useInstrumentalDataset,
  useProjectEvidenceBundle,
  useWorkspaceSettings,
} from '../lib/hooks';
import { workflowStagePath } from '../lib/project-journey-routes';
import { buildReportContextForWorkspace } from '../lib/report-context-builder';
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

type WorkspaceTab = 'report' | 'review' | 'narrative' | 'preview' | 'versions';

function SetupFact({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="border-l-2 border-slate-200 pl-3">
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

  const { data: decisions = [], isLoading: decisionsLoading } = useDecisionRecords();
  const { data: reports = [] } = useCommercializationReports();
  const { data: concepts = [] } = useAdminConceptTests();
  const { data: instrumentalDataset } = useInstrumentalDataset(user?.role === 'admin');
  const { data: settings } = useWorkspaceSettings();

  const requestedReport = reports.find(report => report.id === searchParams.get('report')) ?? null;
  const requestedDecisionId = searchParams.get('decision');
  const requestedDecision = decisions.find(decision => decision.id === (requestedReport?.decisionRecordId ?? requestedDecisionId)) ?? null;
  const currentSampleIds = useMemo(() => new Set(
    (instrumentalDataset?.eTongueData ?? [])
      .filter(sample => sample.type === foodType)
      .map(sample => sample.sampleId),
  ), [foodType, instrumentalDataset]);
  const projectGoDecisions = useMemo(() => decisions.filter(decision =>
    decision.decision === 'GO'
    && (currentSampleIds.has(decision.sampleId) || sampleMatchesFoodType(decision.sampleId, decision.sampleName) === foodType),
  ), [currentSampleIds, decisions, foodType]);
  const focusDecision = requestedDecision ?? projectGoDecisions[0] ?? null;
  const { data: evidenceBundle, isLoading: evidenceLoading } = useProjectEvidenceBundle(
    focusDecision?.sampleId,
    user?.id,
    Boolean(focusDecision),
  );

  const matchingConcepts = useMemo(() => concepts.filter(concept =>
    concept.status !== 'archived'
    && (concept.foodTypeSlug === foodType || concept.category.toLowerCase().includes(foodType.toLowerCase())),
  ), [concepts, foodType]);
  const selectedConcept = requestedReport
    ? concepts.find(concept => concept.id === requestedReport.conceptTestId) ?? null
    : matchingConcepts[0] ?? null;
  const createMode = searchParams.get('create') === '1';
  const savedReport = requestedReport ?? (!createMode && focusDecision
    ? reports.find(report => report.decisionRecordId === focusDecision.id && report.status !== 'archived') ?? null
    : null);
  const snapshot = savedReport?.reportSnapshot as unknown as CommercializationReportSnapshot | undefined;
  const reportDecision = focusDecision && evidenceBundle
    ? rebuildDecisionForCommercialization(focusDecision, evidenceBundle)
    : null;

  const reportVersions = savedReport
    ? reports
        .filter(report => report.decisionRecordId === savedReport.decisionRecordId && report.conceptTestId === savedReport.conceptTestId)
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

  if (decisionsLoading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading report workspace...</div>;
  }

  if (!focusDecision) {
    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Commercialization report"
          description="Prepare the client deliverable after a GO decision has been confirmed."
          actions={<Button asChild variant="outline"><Link to={workflowStagePath('report', routeProjectId)}><ArrowLeft className="size-4" />Reports</Link></Button>}
        />
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

  if (!savedReport || !snapshot) {
    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Create commercialization report"
          description="Confirm the source decision and concept direction, then create a structured client report."
          actions={<Button asChild variant="outline"><Link to={libraryPath}><ArrowLeft className="size-4" />Reports</Link></Button>}
        />

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
                userId={user?.id}
                settings={settings}
                triggerLabel="Generate new version"
                onSaved={openSavedReport}
              />
            )}
            <Button size="sm" onClick={() => void downloadPdf()} disabled={exporting}>
              <Download className="size-4" />{exporting ? 'Preparing...' : 'Download PDF'}
            </Button>
          </>
        )}
      />

      {exportError && <p role="alert" className="text-sm text-rose-700">{exportError}</p>}

      {usingDemoEvidence && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p><strong>Demonstration report.</strong> The workflow and layout are fully functional, but reference evidence must be replaced before client release.</p>
        </div>
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
