import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  FileText, FileSpreadsheet, Presentation, Sparkles, GitMerge, FlaskConical,
  Users, AlertTriangle, ListChecks, Target, Lightbulb, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from '../contexts/auth-context';
import { useFoodType, sampleMatchesFoodType } from '../contexts/food-type-context';
import { useProjectStatus } from '../lib/use-project-status';
import { ProjectHeader } from './project-header';
import { ProjectStatusBadge, toneSolidClasses } from './project-status-badge';
import {
  useDecisionRecords, useInstrumentalDataset, useAdminConceptTests,
  useCommercializationReports, useConceptTestResponses, useWorkspaceSettings,
} from '../lib/hooks';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { formatFoodTypeLabel } from '../lib/food-intelligence';
import { summarizeConceptResponses, type CommercializationReportSnapshot } from '../lib/commercialization-report';
import { downloadCommercializationReportPdf } from '../utils/commercialization-report-export';
import type { SemanticTone } from '../lib/project-status';

function ReportSection({ title, icon: Icon, tone = 'neutral', children }: {
  title: string;
  icon: React.ElementType;
  tone?: SemanticTone;
  children: React.ReactNode;
}) {
  const iconToneClass: Record<SemanticTone, string> = {
    neutral: 'bg-slate-100 text-slate-600',
    info: 'bg-blue-50 text-blue-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    critical: 'bg-rose-50 text-rose-600',
    creative: 'bg-purple-50 text-purple-600',
  };
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="border-b border-slate-100 pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span className={`flex size-8 items-center justify-center rounded-lg ${iconToneClass[tone]}`}>
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3 text-sm text-slate-700">
        {children}
      </CardContent>
    </Card>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="text-lg font-bold text-slate-900">{value}</div>
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function ScoreBars({ entries }: { entries: Array<{ label: string; value: number; max?: number }> }) {
  return (
    <div className="space-y-1.5">
      {entries.map(({ label, value, max = 10 }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-xs capitalize text-slate-600">{label}</span>
          <div className="h-2 flex-1 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-700">{value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

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
  const importBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const status = useProjectStatus(foodType, importBatchId);

  const { data: decisionRecords = [] } = useDecisionRecords();
  const { data: instrumentalDataset } = useInstrumentalDataset(user?.role === 'admin');
  const { data: concepts = [] } = useAdminConceptTests();
  const { data: reports = [] } = useCommercializationReports();
  const { data: workspaceSettings } = useWorkspaceSettings();

  const [exporting, setExporting] = useState<'pdf' | null>(null);
  const [exportError, setExportError] = useState('');

  const sampleIds = useMemo(() => new Set(
    (instrumentalDataset?.eTongueData ?? [])
      .filter(sample => sample.type === foodType && (!importBatchId || sample.importBatchId === importBatchId))
      .map(sample => sample.sampleId)
  ), [instrumentalDataset, foodType, importBatchId]);

  const projectDecisions = useMemo(() => decisionRecords.filter(record =>
    sampleIds.has(record.sampleId) ||
    (!importBatchId && sampleMatchesFoodType(record.sampleId, record.sampleName) === foodType)
  ), [decisionRecords, sampleIds, importBatchId, foodType]);

  const latestDecision = projectDecisions[0] ?? null;
  const goDecision = projectDecisions.find(d => d.decision === 'GO') ?? null;
  const focusDecision = goDecision ?? latestDecision;

  const sample = useMemo(() => instrumentalDataset?.eTongueData.find(s => s.sampleId === focusDecision?.sampleId), [instrumentalDataset, focusDecision]);
  const composition = focusDecision ? instrumentalDataset?.compositionData[focusDecision.sampleId] : undefined;
  const compounds = focusDecision ? instrumentalDataset?.gcmsData[focusDecision.sampleId] ?? [] : [];
  const sensoryProfile = useMemo(() =>
    ENHANCED_SENSORY_DATA.find(p => p.sampleId === focusDecision?.sampleId), [focusDecision]);

  const projectConcept = useMemo(() => concepts.find(concept =>
    (concept.foodTypeSlug ? concept.foodTypeSlug === foodType : true) && concept.status !== 'archived'
  ) ?? null, [concepts, foodType]);
  const { data: conceptResponses = [] } = useConceptTestResponses(projectConcept?.id);
  const evidence = useMemo(() => projectConcept ? summarizeConceptResponses(projectConcept.questions, conceptResponses) : null, [projectConcept, conceptResponses]);

  const savedReport = useMemo(() => {
    if (!focusDecision) return null;
    return reports.find(report => report.decisionRecordId === focusDecision.id) ?? null;
  }, [reports, focusDecision]);
  const snapshot = (savedReport?.reportSnapshot as unknown as CommercializationReportSnapshot | undefined) ?? null;

  const foodTypeLabel = formatFoodTypeLabel(foodType);
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
        organizationName: workspaceSettings?.organizationName ?? 'New Food Innovation',
        workspaceName: workspaceSettings?.workspaceName ?? 'Sensory Analysis Workspace',
        reportFooter: workspaceSettings?.reportFooter,
        version: savedReport?.version ?? 1,
        status: savedReport?.status ?? 'draft',
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
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Commercialization Report</h1>
          <p className="text-sm text-slate-500 mt-1">
            The launch-ready document that closes the loop from raw data to a go-to-market decision.
          </p>
        </div>
        <Card className="border-dashed border-slate-300 bg-slate-50">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto size-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No decision recorded for {foodTypeLabel} yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              The commercialization report is generated from a confirmed decision. Review your insights and record a GO / TWEAK / STOP call first.
            </p>
            <Button asChild className="mt-4">
              <Link to="/decision">
                <GitMerge className="size-4" />
                Go to Decision review
              </Link>
            </Button>
          </CardContent>
        </Card>
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
      ? `Advance ${focusDecision.sampleName} and its concept packaging into buyer review, preserving decision fingerprint ${focusDecision.decisionFingerprint}.`
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

  return (
    <div className="space-y-6">
      <ProjectHeader />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Commercialization Report</h1>
          <p className="text-sm text-slate-500 mt-1">
            The launch-ready document that closes the loop from raw data to a go-to-market decision.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge label={`${focusDecision.decision} · ISSF ${focusDecision.issfScore.toFixed(0)}`} tone={decisionTone} />
          {savedReport && <ProjectStatusBadge label={`Draft v${savedReport.version} · ${savedReport.status}`} tone="info" />}
        </div>
      </div>

      {!snapshot && (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          <p>
            This is a live view assembled from the project's current decision, instrumental data, and concept evidence.
            {focusDecision.decision === 'GO' && (
              <> Open <Link to="/decision" className="font-semibold underline underline-offset-2">Decision review</Link> to generate and save a formal branded draft.</>
            )}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="ISSF score" value={focusDecision.issfScore.toFixed(0)} sub={`${focusDecision.confidence.toFixed(0)}% confidence`} />
        <MetricTile label="Decision" value={focusDecision.decision} sub={new Date(focusDecision.timestamp).toLocaleDateString()} />
        <MetricTile label="Concept evidence" value={String(evidence?.responseCount ?? 0)} sub={projectConcept ? projectConcept.name : 'No concept linked'} />
        <MetricTile label="Purchase intent" value={evidence?.purchaseIntent ? evidence.purchaseIntent.toFixed(1) : 'N/A'} sub="1–9 scale" />
      </div>

      {/* Executive Summary */}
      <ReportSection title="Executive Summary" icon={Target} tone={decisionTone}>
        <p>{executiveSummary}</p>
      </ReportSection>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Product Snapshot */}
        <ReportSection title="Product Snapshot" icon={FlaskConical} tone="info">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div><dt className="font-semibold text-slate-500">Sample</dt><dd className="text-slate-900">{focusDecision.sampleName}</dd></div>
            <div><dt className="font-semibold text-slate-500">Category</dt><dd className="text-slate-900">{foodTypeLabel}</dd></div>
            <div><dt className="font-semibold text-slate-500">Concept</dt><dd className="text-slate-900">{projectConcept?.name ?? '— not yet built —'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Target market</dt><dd className="text-slate-900">{projectConcept?.targetMarket || '—'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Price point</dt><dd className="text-slate-900">{projectConcept?.pricePoint || '—'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Method</dt><dd className="font-mono text-slate-900">{focusDecision.methodVersion}</dd></div>
          </dl>
          {projectConcept?.description && <p className="text-xs text-slate-600 border-t border-slate-100 pt-3">{projectConcept.description}</p>}
        </ReportSection>

        {/* Decision Rationale */}
        <ReportSection title="Decision Rationale" icon={GitMerge} tone={decisionTone}>
          <div className="flex items-center gap-2">
            <ProjectStatusBadge label={focusDecision.decision} tone={decisionTone} />
            <span className="text-xs text-slate-500">Recorded {new Date(focusDecision.timestamp).toLocaleString()} by {focusDecision.user}</span>
          </div>
          <p>{focusDecision.note || 'No additional rationale note was recorded with this decision.'}</p>
          <p className="text-xs text-slate-500 font-mono">Fingerprint: {focusDecision.decisionFingerprint}</p>
        </ReportSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sensory Summary */}
        <ReportSection title="Sensory Summary" icon={Sparkles} tone="creative">
          {sensoryProfile ? (
            <>
              <p className="text-xs text-slate-500">Hedonic averages (1–9 scale)</p>
              <ScoreBars max={9 as unknown as number} entries={Object.entries(sensoryProfile.hedonic).map(([label, value]) => ({ label, value: value as number, max: 9 }))} />
              <p className="text-xs text-slate-500 pt-1">Intensity ratings (0–10 scale)</p>
              <ScoreBars entries={Object.entries(sensoryProfile.intensity).slice(0, 5).map(([label, value]) => ({ label, value: value as number }))} />
            </>
          ) : (
            <p className="text-slate-500">No panel sensory profile is available for this sample yet.</p>
          )}
        </ReportSection>

        {/* Instrumental Summary */}
        <ReportSection title="Instrumental Summary" icon={ListChecks} tone="neutral">
          {sample ? (
            <>
              <p className="text-xs text-slate-500">E-tongue taste signals (0–10 scale)</p>
              <ScoreBars entries={[
                { label: 'sourness', value: sample.sourness },
                { label: 'bitterness', value: sample.bitterness },
                { label: 'saltiness', value: sample.saltiness },
                { label: 'umami', value: sample.umami },
                { label: 'sweetness', value: sample.sweetness },
              ]} />
              {composition && (
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <MetricTile label="Fat" value={`${composition.fat.toFixed(1)}%`} />
                  <MetricTile label="Protein" value={`${composition.protein.toFixed(1)}%`} />
                  <MetricTile label="Salt" value={`${composition.saltContent.toFixed(2)}%`} />
                </div>
              )}
              <p className="text-xs text-slate-500">{compounds.length} GC-MS compound{compounds.length === 1 ? '' : 's'} identified.</p>
            </>
          ) : (
            <p className="text-slate-500">No instrumental dataset is linked to this sample yet.</p>
          )}
        </ReportSection>
      </div>

      {/* Consumer Feedback */}
      <ReportSection title="Consumer Feedback" icon={Users} tone="info">
        {evidence && evidence.responseCount > 0 ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricTile label="Responses" value={String(evidence.responseCount)} />
              <MetricTile label="Purchase intent" value={evidence.purchaseIntent ? evidence.purchaseIntent.toFixed(1) : 'N/A'} sub="1–9 scale" />
              <MetricTile label="Top selection" value={evidence.topSelections[0]?.option ?? '—'} sub={evidence.topSelections[0] ? `${evidence.topSelections[0].percentage.toFixed(0)}% of panel` : undefined} />
            </div>
            {evidence.comments.length > 0 && (
              <ul className="space-y-1.5 border-t border-slate-100 pt-3">
                {evidence.comments.slice(0, 3).map((comment, i) => (
                  <li key={i} className="text-xs italic text-slate-600">"{comment}"</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500 pt-1">{whyLiked}</p>
          </>
        ) : (
          <p className="text-slate-500">
            {projectConcept ? 'No panelist responses have been collected for this concept yet.' : 'No concept test has been linked to this project — launch one from Concept Lab to gather consumer evidence.'}
          </p>
        )}
      </ReportSection>

      {/* Commercialization Narrative */}
      <ReportSection title="Commercialization Narrative" icon={Lightbulb} tone="creative">
        <p><strong className="text-slate-900">Why it resonates: </strong>{whyLiked}</p>
        <p><strong className="text-slate-900">Launch recommendation: </strong>{launchRecommendation}</p>
        {snapshot?.narrative.packagingRationale && (
          <p><strong className="text-slate-900">Packaging rationale: </strong>{snapshot.narrative.packagingRationale}</p>
        )}
      </ReportSection>

      {/* Risks */}
      <ReportSection title="Risks" icon={AlertTriangle} tone={risks.length > 0 ? 'warning' : 'success'}>
        {risks.length > 0 ? (
          <ul className="space-y-1.5">
            {risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-emerald-700">No outstanding risks were detected for this project.</p>
        )}
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{claimCaution}</p>
      </ReportSection>

      {/* Recommended Next Steps */}
      <ReportSection title="Recommended Next Steps" icon={ListChecks} tone="info">
        {nextSteps.length > 0 ? (
          <ol className="space-y-1.5 list-decimal pl-4">
            {nextSteps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        ) : (
          <p className="text-slate-500">No further actions are required — this project is ready for launch handoff.</p>
        )}
      </ReportSection>

      {/* Export */}
      <Card className="border border-slate-200 bg-white">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Download className="size-4" /></span>
            Export
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {exportError && <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{exportError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportPdf} disabled={!snapshot || exporting === 'pdf'} className={toneSolidClasses('info')}>
              <FileText className="size-4" />
              {exporting === 'pdf' ? 'Preparing PDF…' : 'Export PDF'}
            </Button>
            <Button variant="outline" disabled title="Excel export is coming soon">
              <FileSpreadsheet className="size-4" />
              Export Excel
            </Button>
            <Button variant="outline" disabled title="Slide deck export is coming soon">
              <Presentation className="size-4" />
              Export PPT
            </Button>
          </div>
          {!snapshot && (
            <p className="mt-2 text-xs text-slate-500">
              PDF export is available once a branded draft has been saved from the Decision page's commercialization report builder.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
