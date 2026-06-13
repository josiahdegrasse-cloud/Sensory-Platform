import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FileText } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { useFoodType, sampleMatchesFoodType } from '../contexts/food-type-context';
import { useProjectStatus } from '../lib/use-project-status';
import { ProjectHeader } from './project-header';
import {
  useDecisionRecords, useInstrumentalDataset, useAdminConceptTests,
  useCommercializationReports, useConceptTestResponses, useWorkspaceSettings,
} from '../lib/hooks';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { useSurveyData } from '../lib/use-survey-data';
import { formatFoodTypeLabel } from '../lib/food-intelligence';
import {
  summarizeConceptResponses, type CommercializationReportSnapshot,
  DEFAULT_REPORT_ORGANIZATION_NAME, DEFAULT_REPORT_WORKSPACE_NAME,
  resolveReportLogoUrl,
} from '../lib/commercialization-report';
import { downloadCommercializationReportPdf } from '../utils/commercialization-report-export';
import type { SemanticTone } from '../lib/project-status';
import { ReportBrandStrip, ReportCoverHeader } from './commercialization-report-ui';
import { ReportApprovalBar } from './report-approval-bar';
import { ReportOverviewPanel } from './report-overview-panel';
import { ReportPdfSectionsPanel } from './report-pdf-sections-panel';
import { StageEmptyState } from './stage-empty-state';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import {
  ReportNarrativePanel, ReportPdfPreviewPanel, ReportVersionsPanel,
} from './report-workspace-panels';

/**
 * The Commercialization Report — the final stage of the project journey.
 * Pulls together the project's decision, instrumental data, sensory profile,
 * and concept-test evidence into a single launch-readiness document. Renders
 * a saved draft snapshot when one exists; otherwise assembles a live view
 * directly from the project's current decision/sample/concept records so the
 * page is useful from the moment a sample gets a GO.
 */
export function CommercializationReportPage() {
  const { user } = useAuth();
  const { foodType, subCategory } = useFoodType();
  const [searchParams] = useSearchParams();
  const importBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const status = useProjectStatus(foodType, importBatchId);

  const { data: decisionRecords = [] } = useDecisionRecords();
  const { data: instrumentalDataset } = useInstrumentalDataset(user?.role === 'admin');
  const { data: concepts = [] } = useAdminConceptTests();
  const { data: reports = [] } = useCommercializationReports();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { liveAggregations } = useSurveyData();

  const [exporting, setExporting] = useState<'pdf' | null>(null);
  const [exportError, setExportError] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState('overview');
  const requestedReport = reports.find(report => report.id === searchParams.get('report')) ?? null;
  const requestedSnapshot = requestedReport?.reportSnapshot as unknown as CommercializationReportSnapshot | undefined;
  const effectiveFoodType = requestedSnapshot?.product.foodType ?? foodType;

  const sampleIds = useMemo(() => new Set(
    (instrumentalDataset?.eTongueData ?? [])
      .filter(sample => sample.type === effectiveFoodType && (!importBatchId || sample.importBatchId === importBatchId))
      .map(sample => sample.sampleId)
  ), [instrumentalDataset, effectiveFoodType, importBatchId]);

  const projectDecisions = useMemo(() => decisionRecords.filter(record =>
    sampleIds.has(record.sampleId) ||
    (!importBatchId && sampleMatchesFoodType(record.sampleId, record.sampleName) === effectiveFoodType)
  ), [decisionRecords, sampleIds, importBatchId, effectiveFoodType]);

  const latestDecision = projectDecisions[0] ?? null;
  const goDecision = projectDecisions.find(d => d.decision === 'GO') ?? null;
  const requestedDecision = requestedReport
    ? decisionRecords.find(decision => decision.id === requestedReport.decisionRecordId) ?? null
    : null;
  const focusDecision = requestedDecision ?? goDecision ?? latestDecision;

  const sample = useMemo(() => instrumentalDataset?.eTongueData.find(s => s.sampleId === focusDecision?.sampleId), [instrumentalDataset, focusDecision]);
  const composition = focusDecision ? instrumentalDataset?.compositionData[focusDecision.sampleId] : undefined;
  const compounds = focusDecision ? instrumentalDataset?.gcmsData[focusDecision.sampleId] ?? [] : [];
  const sensoryProfile = useMemo(() =>
    ENHANCED_SENSORY_DATA.find(p => p.sampleId === focusDecision?.sampleId), [focusDecision]);
  const matchingLiveSensory = useMemo(() => {
    if (!focusDecision) return undefined;
    return liveAggregations.find(a =>
      a.sourceSampleId === focusDecision.sampleId ||
      a.productName.toLowerCase() === focusDecision.sampleName.toLowerCase() ||
      a.productName.toLowerCase().includes(`(${focusDecision.sampleId.toLowerCase()})`)
    );
  }, [liveAggregations, focusDecision]);

  const projectConcept = useMemo(() => (
    requestedReport
      ? concepts.find(concept => concept.id === requestedReport.conceptTestId)
      : concepts.find(concept =>
          (concept.foodTypeSlug ? concept.foodTypeSlug === effectiveFoodType : true) && concept.status !== 'archived'
        )
  ) ?? null, [concepts, effectiveFoodType, requestedReport]);
  const { data: conceptResponses = [] } = useConceptTestResponses(projectConcept?.id);
  const evidence = useMemo(() => projectConcept ? summarizeConceptResponses(projectConcept.questions, conceptResponses) : null, [projectConcept, conceptResponses]);

  const savedReport = useMemo(() => {
    if (requestedReport) return requestedReport;
    if (!focusDecision) return null;
    return reports.find(report => report.decisionRecordId === focusDecision.id) ?? null;
  }, [reports, focusDecision, requestedReport]);
  const snapshot = (savedReport?.reportSnapshot as unknown as CommercializationReportSnapshot | undefined) ?? null;

  const foodTypeLabel = formatFoodTypeLabel(effectiveFoodType);
  const decisionTone: SemanticTone = !focusDecision ? 'neutral'
    : focusDecision.decision === 'GO' ? 'success'
    : focusDecision.decision === 'TWEAK' ? 'warning' : 'critical';

  const exportPdf = async () => {
    if (!snapshot) return;
    setExportError('');
    setExporting('pdf');
    try {
      await downloadCommercializationReportPdf({
        snapshot,
        organizationName: workspaceSettings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
        workspaceName: workspaceSettings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
        reportFooter: workspaceSettings?.reportFooter,
        version: savedReport?.version ?? 1,
        status: savedReport?.status ?? 'draft',
        logoUrl: resolveReportLogoUrl(
          workspaceSettings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
          workspaceSettings?.logoUrl,
        ),
        primaryColor: workspaceSettings?.primaryColor,
        accentColor: workspaceSettings?.accentColor,
        reportTemplate: workspaceSettings?.reportTemplate,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Unable to export the report.');
    } finally {
      setExporting(null);
    }
  };

  if (!focusDecision) {
    return (
      <div className="space-y-6">
        <ProjectHeader />
        <ReportBrandStrip settings={workspaceSettings} />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Commercialization Report</h1>
          <p className="text-sm text-slate-500 mt-1">
            The launch-ready document that closes the loop from raw data to a go-to-market decision.
          </p>
        </div>
        <StageEmptyState
          icon={FileText}
          locked
          headline={`No decision recorded for ${foodTypeLabel} yet`}
          body="The report builds itself from your evidence. It unlocks once a GO / TWEAK / STOP decision is logged — review your insights and make the call first."
          cta={{ label: 'Go to Decision review', to: '/decision' }}
        />
      </div>
    );
  }

  const executiveSummary = snapshot?.narrative.executiveSummary ?? (
    focusDecision.decision === 'GO'
      ? `${focusDecision.sampleName} earned a confirmed GO decision with an ISSF score of ${focusDecision.issfScore.toFixed(0)} and ${focusDecision.confidence.toFixed(0)}% confidence. ${
          projectConcept ? `The ${projectConcept.name} concept has been evaluated by ${evidence?.responseCount ?? 0} panelist${(evidence?.responseCount ?? 0) === 1 ? '' : 's'}.` : 'A concept test has not been launched for this sample yet.'
        }`
      : `${focusDecision.sampleName} currently sits at a ${focusDecision.decision} decision (ISSF ${focusDecision.issfScore.toFixed(0)}, ${focusDecision.confidence.toFixed(0)}% confidence). Commercialization narrative will be available once a sample in this project receives a confirmed GO.`
  );

  const launchRecommendation = snapshot?.narrative.launchRecommendation ?? (
    focusDecision.decision === 'GO'
      ? `Advance ${focusDecision.sampleName} and its concept packaging into buyer review. This recommendation is tied to the saved decision record for this product.`
      : `Address the issues raised in the Decision review before drafting a launch narrative for ${focusDecision.sampleName}.`
  );
  const claimCaution = snapshot?.narrative.claimCaution
    ?? 'Findings reflect this panel and sample set. Broader consumer or commercial claims require representative validation and legal review.';
  const whyLiked = snapshot?.narrative.whyLiked ?? (
    evidence && evidence.topSelections.length > 0
      ? `Panelists most often selected ${evidence.topSelections.slice(0, 3).map(s => s.option).join(', ')} when describing this concept.`
      : 'Concept-level consumer language will appear here once panel responses are collected.'
  );

  const risks: string[] = [
    ...status.warnings,
    ...(focusDecision.decision !== 'GO' ? [`${focusDecision.sampleName} has not reached a GO decision — commercialization claims should not proceed until it does.`] : []),
    ...(!projectConcept ? ['No concept test is linked to this project yet — consumer-facing claims have not been validated.'] : []),
    ...(evidence && evidence.responseCount > 0 && evidence.responseCount < 30 ? [`Concept evidence is based on a small panel (n=${evidence.responseCount}) — treat purchase-intent figures as directional.`] : []),
    ...(!matchingLiveSensory && sensoryProfile ? ['Sensory evidence for this sample is based on reference/demo data, not live panelist responses — collect live responses before using this report as a client deliverable.'] : []),
  ];

  const nextSteps: string[] = snapshot
    ? [snapshot.narrative.packagingRationale, snapshot.narrative.launchRecommendation]
    : [
        focusDecision.decision === 'GO' && !projectConcept ? 'Build a concept test in Concept Lab to gather consumer-facing evidence.' : '',
        focusDecision.decision === 'GO' && projectConcept && (evidence?.responseCount ?? 0) === 0 ? 'Launch the concept test to start collecting panelist responses.' : '',
        focusDecision.decision === 'GO' && projectConcept && (evidence?.responseCount ?? 0) > 0 ? 'Select approved packaging and draft the formal report from the Decision page.' : '',
        focusDecision.decision === 'TWEAK' ? 'Apply the recommended formulation tweaks and resubmit for a follow-up decision.' : '',
        focusDecision.decision === 'STOP' ? 'Review the STOP rationale and scope a reformulation before retesting.' : '',
      ].filter(Boolean);

  const executiveHighlights: string[] = [
    `${focusDecision.decision} decision · ISSF ${focusDecision.issfScore.toFixed(0)} · ${focusDecision.confidence.toFixed(0)}% confidence`,
    evidence && evidence.responseCount > 0
      ? `${evidence.responseCount} concept panelist${evidence.responseCount === 1 ? '' : 's'} evaluated this direction${evidence.purchaseIntent !== null ? `, averaging ${evidence.purchaseIntent.toFixed(1)}/9 purchase intent` : ''}.`
      : 'Concept panel evidence has not been collected yet.',
    ...(evidence?.topSelections[0] ? [`Top consumer signal: "${evidence.topSelections[0].option}" (${evidence.topSelections[0].percentage.toFixed(0)}% of panel).`] : []),
    ...(risks.length > 0 ? [risks[0]] : []),
  ];

  const sensoryProvenance: 'live' | 'reference' | 'none' = matchingLiveSensory ? 'live' : sensoryProfile ? 'reference' : 'none';
  const reportVersions = savedReport
    ? reports
        .filter(report =>
          report.decisionRecordId === savedReport.decisionRecordId
          && report.conceptTestId === savedReport.conceptTestId
        )
        .sort((a, b) => b.version - a.version)
    : [];
  const pdfInput = snapshot && savedReport ? {
    snapshot,
    organizationName: workspaceSettings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
    workspaceName: workspaceSettings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
    reportFooter: workspaceSettings?.reportFooter,
    version: savedReport.version,
    status: savedReport.status,
    logoUrl: resolveReportLogoUrl(
      workspaceSettings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
      workspaceSettings?.logoUrl,
    ),
    primaryColor: workspaceSettings?.primaryColor,
    accentColor: workspaceSettings?.accentColor,
    reportTemplate: workspaceSettings?.reportTemplate,
  } : null;

  return (
    <div className="space-y-6">
      <ProjectHeader />

      <ReportCoverHeader
        settings={workspaceSettings}
        sampleName={focusDecision.sampleName}
        foodTypeLabel={foodTypeLabel}
        decision={focusDecision.decision}
        issfScore={focusDecision.issfScore}
        confidence={focusDecision.confidence}
        decisionTone={decisionTone}
        timestamp={focusDecision.timestamp}
        draftLabel={savedReport ? `Draft v${savedReport.version} · ${savedReport.status}` : undefined}
      />

      {savedReport && savedReport.status !== 'archived' && (
        <ReportApprovalBar
          report={savedReport}
          blockedReason={sensoryProvenance === 'reference'
            ? 'This report still uses reference/demo sensory data. Collect live panel responses before approving it as a client deliverable.'
            : undefined}
        />
      )}

      {savedReport && snapshot && (
        <Tabs value={workspaceTab} onValueChange={setWorkspaceTab}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
            <TabsTrigger value="overview" className="flex-none px-4">Overview</TabsTrigger>
            <TabsTrigger value="narrative" className="flex-none px-4">Edit narrative</TabsTrigger>
            <TabsTrigger value="sections" className="flex-none px-4">PDF sections</TabsTrigger>
            <TabsTrigger value="preview" className="flex-none px-4">PDF preview</TabsTrigger>
            <TabsTrigger value="versions" className="flex-none px-4">Versions ({reportVersions.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {workspaceTab === 'narrative' && savedReport && snapshot && (
        <ReportNarrativePanel key={savedReport.id} report={savedReport} snapshot={snapshot} />
      )}
      {workspaceTab === 'sections' && pdfInput && (
        <ReportPdfSectionsPanel key={`${savedReport?.id}:${workspaceSettings?.updatedAt ?? ''}`} input={pdfInput} />
      )}
      {workspaceTab === 'preview' && pdfInput && (
        <ReportPdfPreviewPanel key={`${savedReport?.id}:${workspaceSettings?.updatedAt ?? ''}`} input={pdfInput} />
      )}
      {workspaceTab === 'versions' && savedReport && (
        <ReportVersionsPanel reports={reportVersions} selectedId={savedReport.id} />
      )}

      <div className={workspaceTab === 'overview' ? 'contents' : 'hidden'}>
        <ReportOverviewPanel
          snapshot={snapshot}
          focusDecision={focusDecision}
          decisionTone={decisionTone}
          foodTypeLabel={foodTypeLabel}
          sensoryProvenance={sensoryProvenance}
          matchingLiveSensory={matchingLiveSensory}
          sample={sample}
          evidence={evidence}
          projectConcept={projectConcept}
          sensoryProfile={sensoryProfile}
          composition={composition}
          compounds={compounds}
          executiveSummary={executiveSummary}
          executiveHighlights={executiveHighlights}
          whyLiked={whyLiked}
          launchRecommendation={launchRecommendation}
          claimCaution={claimCaution}
          risks={risks}
          nextSteps={nextSteps}
          savedReport={savedReport}
          exportPdf={exportPdf}
          exporting={exporting}
          exportError={exportError}
        />
      </div>
    </div>
  );
}
