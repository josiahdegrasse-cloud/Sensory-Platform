import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  FolderKanban,
  ListChecks,
  Lock,
  TriangleAlert,
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { StageEmptyState } from './stage-empty-state';
import { useFoodType } from '../contexts/food-type-context';
import {
  useAdminConceptTests,
  useAuditEvents,
  useCommercializationReports,
  useDecisionRecords,
  useImportBatches,
  useInstrumentalDataset,
  useWorkspaceSettings,
} from '../lib/hooks';
import { ProjectStatusBadge, toneClasses, toneSolidClasses } from './project-status-badge';
import { NextActionCard } from './next-action-card';
import { ProductHistoryTimeline } from './product-history-timeline';
import { buildProductTimeline } from '../lib/product-history';
import { useProjectWorkflow } from '../lib/workflow/use-project-workflow';
import {
  workflowStatusLabel,
  workflowTone,
  workflowToneToSemanticTone,
} from '../lib/workflow/workflow-actions';
import type { AuditEventRecord } from '../lib/database';
import type { WorkflowStageSummary } from '../lib/workflow/workflow-types';

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-lg font-semibold text-slate-950">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function stageIcon(stage: WorkflowStageSummary) {
  if (stage.status === 'complete') return CheckCircle2;
  if (stage.status === 'blocked') return Lock;
  if (stage.status === 'needs_review') return TriangleAlert;
  if (stage.status === 'ready') return ClipboardCheck;
  if (stage.status === 'in_progress') return ListChecks;
  return Circle;
}

function StageCard({ stage }: { stage: WorkflowStageSummary }) {
  const tone = workflowToneToSemanticTone(workflowTone(stage.status));
  const Icon = stageIcon(stage);
  const canNavigate = stage.status !== 'blocked' || stage.nextActionRoute;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${toneClasses(tone)}`}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-950">{stage.label}</h3>
            <p className="mt-1 text-sm text-slate-600">{stage.detail}</p>
          </div>
        </div>
        <ProjectStatusBadge label={workflowStatusLabel(stage.status)} tone={tone} showIcon={false} />
      </div>

      {(stage.completedItems.length > 0 || stage.blockers.length > 0 || stage.warnings.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Exists</p>
            {stage.completedItems.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">Nothing recorded yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {stage.completedItems.slice(0, 3).map(item => <li key={item}>• {item}</li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Blocked by</p>
            {stage.blockers.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">No blockers.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs text-rose-700">
                {stage.blockers.slice(0, 3).map(item => <li key={item}>• {item}</li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Watch</p>
            {stage.warnings.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">No warnings.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs text-amber-700">
                {stage.warnings.slice(0, 3).map(item => <li key={item}>• {item}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
        {canNavigate ? (
          <Link
            to={stage.nextActionRoute}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            {stage.nextActionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">
            {stage.nextActionLabel}
          </span>
        )}
      </div>
    </article>
  );
}

function RecentActivity({ events, projectScoped }: { events: AuditEventRecord[]; projectScoped: boolean }) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Activity className="size-4 text-slate-400" aria-hidden />
            Recent activity
            {!projectScoped && <span className="text-[11px] font-normal text-slate-400">(workspace-wide)</span>}
          </h3>
          <Link to="/settings" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
            View audit log
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-slate-400">No tracked activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map(event => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
                <span className="min-w-0 truncate text-slate-700">
                  {event.eventType.replace(/[._-]+/g, ' ')}
                  {event.actorName && <span className="text-slate-400"> · {event.actorName}</span>}
                </span>
                <span className="shrink-0 text-slate-400">
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NoProjectState() {
  return (
    <StageEmptyState
      icon={FolderKanban}
      headline="No project selected"
      body="Pick a project from the sidebar or import instrumental data to start the workflow."
      cta={{ label: 'Import data', to: '/stage1' }}
      secondaryCta={{ label: 'Back to dashboard', to: '/' }}
    />
  );
}

export function ProjectCommandCenter() {
  const { batchId } = useParams<{ batchId: string }>();
  const { foodType, subCategory, setSelection } = useFoodType();
  const { data: importBatches = [] } = useImportBatches();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: auditEvents = [] } = useAuditEvents();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const { data: conceptTests = [] } = useAdminConceptTests();
  const { data: reports = [] } = useCommercializationReports();
  const { data: instrumentalDataset } = useInstrumentalDataset(true);
  const [selectedHistorySampleId, setSelectedHistorySampleId] = useState<string | null>(null);

  const routedBatch = batchId ? importBatches.find(batch => batch.id === batchId) ?? null : null;

  useEffect(() => {
    if (routedBatch && subCategory !== `batch:${routedBatch.id}`) {
      setSelection(routedBatch.foodTypeSlug, `batch:${routedBatch.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routedBatch?.id]);

  const effectiveFoodType = routedBatch?.foodTypeSlug ?? foodType;
  const effectiveBatchId = routedBatch?.id
    ?? (subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null);
  const workflow = useProjectWorkflow(effectiveFoodType, effectiveBatchId);
  const batch = routedBatch ?? (effectiveBatchId ? importBatches.find(item => item.id === effectiveBatchId) ?? null : null);

  const batchSamples = useMemo(() => {
    if (!effectiveBatchId || !instrumentalDataset) return [];
    return instrumentalDataset.eTongueData.filter(sample => sample.importBatchId === effectiveBatchId);
  }, [effectiveBatchId, instrumentalDataset]);

  const historySampleId = selectedHistorySampleId ?? batchSamples[0]?.sampleId ?? null;
  const historySampleName = batchSamples.find(sample => sample.sampleId === historySampleId)?.sampleName ?? historySampleId ?? '';
  const productTimeline = useMemo(() => {
    if (!historySampleId) return null;
    return buildProductTimeline(
      historySampleId,
      historySampleName,
      importBatches,
      decisionRecords,
      conceptTests,
      reports,
    );
  }, [conceptTests, decisionRecords, historySampleId, historySampleName, importBatches, reports]);

  const { projectEvents, projectScoped } = useMemo(() => {
    const needles = [effectiveBatchId, workflow.projectName, effectiveFoodType].filter(Boolean) as string[];
    const matched = auditEvents.filter(event => {
      const haystack = `${event.entityId ?? ''} ${JSON.stringify(event.metadata)}`;
      return needles.some(needle => haystack.includes(needle));
    });
    return matched.length > 0
      ? { projectEvents: matched.slice(0, 5), projectScoped: true }
      : { projectEvents: auditEvents.slice(0, 5), projectScoped: false };
  }, [auditEvents, effectiveBatchId, effectiveFoodType, workflow.projectName]);

  if (!effectiveFoodType || effectiveFoodType === 'all') {
    return (
      <div className="mx-auto max-w-5xl">
        <NoProjectState />
      </div>
    );
  }

  const contextLine = [
    workflow.foodTypeLabel,
    workspaceSettings?.organizationName,
    batch && `Imported ${new Date(batch.createdAt).toLocaleDateString()}`,
    batch && `${batch.sampleCount} sample${batch.sampleCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');
  const overallTone = workflowToneToSemanticTone(workflow.overallTone);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700">
          <ArrowLeft className="size-3.5" aria-hidden /> All projects
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-950">{workflow.projectName}</h1>
          <ProjectStatusBadge label={workflow.overallStatusLabel} tone={overallTone} />
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {contextLine || 'A guided overview of what exists, what is blocked, and what to do next.'}
        </p>
      </div>

      <NextActionCard
        projectName={workflow.projectName}
        action={{
          label: workflow.nextAction.label,
          description: workflow.nextAction.description,
          path: workflow.nextAction.route,
          tone: workflowToneToSemanticTone(workflow.nextAction.tone),
        }}
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <CountCell label="samples" value={workflow.counts.importedSamples} />
        <CountCell label="studies" value={workflow.counts.activeStudies} />
        <CountCell label="responses" value={workflow.counts.responsesCollected} />
        <CountCell label="decisions" value={workflow.counts.decisionsRecorded} />
        <CountCell label="concepts" value={workflow.counts.conceptsActive} />
        <CountCell label="reports" value={workflow.counts.reportsSaved} />
      </div>

      {(workflow.blockers.length > 0 || workflow.warnings.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-900">
              <TriangleAlert className="size-4" /> Blockers
            </h2>
            {workflow.blockers.length === 0 ? (
              <p className="mt-2 text-sm text-rose-700">No blockers.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-rose-800">
                {workflow.blockers.slice(0, 5).map(item => <li key={item}>• {item}</li>)}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <TriangleAlert className="size-4" /> Warnings
            </h2>
            {workflow.warnings.length === 0 ? (
              <p className="mt-2 text-sm text-amber-700">No warnings.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {workflow.warnings.slice(0, 5).map(item => <li key={item}>• {item}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Workflow stages</h2>
            <p className="text-sm text-slate-500">Data → Studies → Responses → Insights → Decision → Concept → Report.</p>
          </div>
          <Link
            to={workflow.nextAction.route}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-90 ${toneSolidClasses(workflowToneToSemanticTone(workflow.nextAction.tone))}`}
          >
            {workflow.nextAction.label}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-4">
          {workflow.stages.map(item => <StageCard key={item.id} stage={item} />)}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <RecentActivity events={projectEvents} projectScoped={projectScoped} />
        <Card className="border border-slate-200 bg-white lg:col-span-2">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-950">Report readiness link</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              The Report stage uses the saved-report context builder, so strict PDF export readiness,
              reference/demo evidence, missing concept evidence, and approval blockers are reflected here.
            </p>
          </CardContent>
        </Card>
      </div>

      {productTimeline && (
        <div className="space-y-3">
          {batchSamples.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">Sample</span>
              <select
                value={historySampleId ?? ''}
                onChange={event => setSelectedHistorySampleId(event.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {batchSamples.map(sample => (
                  <option key={sample.sampleId} value={sample.sampleId}>
                    {sample.sampleName ?? sample.sampleId}
                  </option>
                ))}
              </select>
            </div>
          )}
          <ProductHistoryTimeline timeline={productTimeline} />
        </div>
      )}
    </div>
  );
}
