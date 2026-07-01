import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
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
import { parseBatchSelection, encodeBatchSelection, projectRoutePath } from '../lib/project-identity';
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
import { ProductHistoryTimeline } from './product-history-timeline';
import { buildProductTimeline } from '../lib/product-history';
import { useProjectWorkflow } from '../lib/workflow/use-project-workflow';
import {
  workflowStatusLabel,
  workflowTone,
  workflowToneToSemanticTone,
} from '../lib/workflow/workflow-actions';
import type { AuditEventRecord, ImportBatchRecord } from '../lib/database';
import type { WorkflowStageStatus, WorkflowStageSummary } from '../lib/workflow/workflow-types';

const STAGE_STATUS_ICONS: Record<WorkflowStageStatus, typeof CheckCircle2> = {
  complete: CheckCircle2,
  blocked: Lock,
  needs_review: TriangleAlert,
  ready: ClipboardCheck,
  in_progress: ListChecks,
  not_started: Circle,
};

function EvidenceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function uniqueItems(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function JourneyRail({
  stages,
  activeStageId,
}: {
  stages: WorkflowStageSummary[];
  activeStageId: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-1">
      <ol
        className="grid items-stretch gap-1"
        style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
      >
        {stages.map(stage => {
          const displayStatus = stage.id === 'concept' && stage.status === 'blocked' ? 'not_started' : stage.status;
          const tone = workflowToneToSemanticTone(workflowTone(displayStatus));
          const Icon = STAGE_STATUS_ICONS[displayStatus];
          const isActive = stage.id === activeStageId;
          return (
            <li key={stage.id} className="min-w-0">
              <Link
                to={stage.nextActionRoute}
                title={`${stage.label}: ${workflowStatusLabel(displayStatus)}`}
                className={`group flex h-full min-w-0 items-center justify-center gap-1.5 rounded-md border px-1.5 py-2 text-center text-[11px] font-semibold leading-tight transition-colors sm:px-2 sm:text-xs ${
                  isActive
                    ? 'border-transparent bg-slate-900 text-white'
                    : displayStatus === 'complete'
                      ? 'border-emerald-200 bg-white text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50'
                      : displayStatus === 'blocked'
                        ? 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-200 hover:text-slate-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-white hover:text-blue-900'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={`hidden size-5 shrink-0 items-center justify-center rounded-full border sm:flex ${toneClasses(tone)}`}>
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 truncate">{stage.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageTimelineItem({
  stage,
  active,
}: {
  stage: WorkflowStageSummary;
  active: boolean;
}) {
  const hideConceptBlockedState = stage.id === 'concept' && stage.status === 'blocked';
  const displayStatus = hideConceptBlockedState ? 'not_started' : stage.status;
  const displayBlockers = hideConceptBlockedState ? [] : stage.blockers;
  const displayDetail = hideConceptBlockedState ? 'No concept test has been created yet.' : stage.detail;
  const tone = workflowToneToSemanticTone(workflowTone(displayStatus));
  const Icon = STAGE_STATUS_ICONS[displayStatus];
  const canNavigate = displayStatus !== 'blocked' || stage.nextActionRoute;
  const shouldExpand = active || displayStatus === 'ready' || displayStatus === 'needs_review' || displayBlockers.length > 0 || stage.warnings.length > 0;
  const evidence = stage.completedItems.slice(0, 3);
  return (
    <article className={`rounded-lg border bg-white p-4 ${active ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${toneClasses(tone)}`}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900">{stage.label}</h3>
              <ProjectStatusBadge label={workflowStatusLabel(displayStatus)} tone={tone} showIcon={false} />
            </div>
            <p className="mt-1 text-sm text-slate-700">{displayDetail}</p>
            {!shouldExpand && evidence[0] && (
              <p className="mt-1 text-xs text-slate-500">{evidence[0]}</p>
            )}
          </div>
        </div>
        {canNavigate && (
          <Link
            to={stage.nextActionRoute}
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
              active
                ? toneSolidClasses(tone)
                : 'border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {stage.nextActionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      {shouldExpand && (
        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-3">
          {evidence.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700">Evidence</h4>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700">
                {evidence.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          {displayBlockers.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-rose-800">Gate</h4>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-700">
                {displayBlockers.slice(0, 2).map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          {stage.warnings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-800">Watch</h4>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-700">
                {stage.warnings.slice(0, 2).map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          {evidence.length === 0 && displayBlockers.length === 0 && stage.warnings.length === 0 && (
            <p className="text-xs text-slate-500">No project artifact has been saved for this stage yet.</p>
          )}
        </div>
      )}
    </article>
  );
}

function RecentActivity({ events, projectScoped }: { events: AuditEventRecord[]; projectScoped: boolean }) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Activity className="size-4 text-slate-500" aria-hidden />
            Recent activity
            {!projectScoped && <span className="text-[11px] font-normal text-slate-500">(workspace-wide)</span>}
          </h3>
          <Link to="/settings" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
            View audit log
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-slate-500">No tracked activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map(event => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
                <span className="min-w-0 truncate text-slate-700">
                  {event.eventType.replace(/[._-]+/g, ' ')}
                  {event.actorName && <span className="text-slate-500"> · {event.actorName}</span>}
                </span>
                <span className="shrink-0 text-slate-500">
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
      cta={{ label: 'Import data', to: '/stage1?new=project' }}
      secondaryCta={{ label: 'Back to overview', to: '/' }}
    />
  );
}

type ProjectQueueItem = {
  projectId: string;
  projectName: string;
  foodTypes: string[];
  latestBatchId: string;
  latestImportAt: string;
  batchCount: number;
  sampleCount: number;
};

/**
 * Shown on /project when no specific project/batch is in scope. Lists the live
 * (active) projects to choose from and is explicit about how many batches are
 * not yet linked to a project, rather than rendering a blank or stale page.
 */
function ProjectPicker({
  importBatches,
  onOpen,
}: {
  importBatches: ImportBatchRecord[];
  onOpen: (batch: ImportBatchRecord) => void;
}) {
  // One entry per real project (active batches that carry a project link),
  // keyed by projectId so a multi-batch project shows once via its latest batch.
  const projects = useMemo(() => {
    const byProject = new Map<string, ProjectQueueItem>();
    importBatches
      .filter(batch => batch.status === 'active' && batch.projectId)
      .forEach(batch => {
        const current = byProject.get(batch.projectId!);
        const latest = !current || new Date(batch.createdAt).getTime() > new Date(current.latestImportAt).getTime();
        byProject.set(batch.projectId!, {
          projectId: batch.projectId!,
          projectName: batch.projectName ?? batch.fileName.replace(/\.csv$/i, ''),
          foodTypes: uniqueItems([...(current?.foodTypes ?? []), batch.foodTypeSlug]),
          latestBatchId: latest ? batch.id : current.latestBatchId,
          latestImportAt: latest ? batch.createdAt : current.latestImportAt,
          batchCount: (current?.batchCount ?? 0) + 1,
          sampleCount: (current?.sampleCount ?? 0) + batch.sampleCount,
        });
      });
    return [...byProject.values()].sort((a, b) => new Date(b.latestImportAt).getTime() - new Date(a.latestImportAt).getTime());
  }, [importBatches]);

  const unassignedBatches = useMemo(
    () => importBatches
      .filter(batch => batch.status === 'active' && !batch.projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [importBatches],
  );
  const recentImportCount = useMemo(() => {
    const newestImportAt = Math.max(
      0,
      ...importBatches
        .filter(batch => batch.status === 'active')
        .map(batch => new Date(batch.createdAt).getTime()),
    );
    if (!newestImportAt) return 0;
    const sevenDaysAgo = newestImportAt - 7 * 24 * 60 * 60 * 1000;
    return importBatches.filter(batch => batch.status === 'active' && new Date(batch.createdAt).getTime() >= sevenDaysAgo).length;
  }, [importBatches]);

  if (projects.length === 0) return <NoProjectState />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Project command center</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-700">
            Start from a live project, or reconcile imported batches that are not yet linked to a project record.
          </p>
        </div>
        <Link
          to="/stage1?new=project"
          className="inline-flex w-fit items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Import data
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <EvidenceStat label="active projects" value={projects.length} />
        <EvidenceStat label="unlinked batches" value={unassignedBatches.length} />
        <EvidenceStat label="imports this week" value={recentImportCount} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Live project queue</h2>
          <p className="text-xs text-slate-500">Newest imports appear first so the next operational handoff is easy to find.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {projects.map(project => {
          const batch = importBatches.find(item => item.id === project.latestBatchId);
          return (
            <button
              key={project.projectId}
              type="button"
              onClick={() => batch && onOpen(batch)}
              className="group flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">{project.projectName}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {project.foodTypes.join(', ')} · {project.sampleCount} sample{project.sampleCount === 1 ? '' : 's'} · {project.batchCount} batch{project.batchCount === 1 ? '' : 'es'}
                </span>
                <span className="mt-2 block text-xs text-slate-500">
                  Latest import {new Date(project.latestImportAt).toLocaleDateString()}
                </span>
              </span>
              <ArrowLeft className="size-4 rotate-180 text-slate-300 transition-colors group-hover:text-blue-600" aria-hidden />
            </button>
          );
        })}
        </div>
      </section>

      {unassignedBatches.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-amber-950">Batch reconciliation</h2>
              <p className="mt-1 max-w-2xl text-sm text-amber-800">
                These active imports are usable as evidence, but they are not linked to a durable project record yet.
              </p>
            </div>
            <Link to="/stage1" className="inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">
              Review imports
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {unassignedBatches.slice(0, 6).map(batch => (
              <button
                key={batch.id}
                type="button"
                onClick={() => onOpen(batch)}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-left text-xs hover:bg-amber-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-amber-950">{batch.fileName.replace(/\.csv$/i, '')}</span>
                  <span className="mt-0.5 block text-amber-700">
                    {batch.foodTypeLabel} · {batch.sampleCount} sample{batch.sampleCount === 1 ? '' : 's'} · {new Date(batch.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-amber-700" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ProjectCommandCenter() {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { foodType, subCategory, setSelection } = useFoodType();
  const { data: importBatches = [] } = useImportBatches();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: auditEvents = [] } = useAuditEvents();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const { data: conceptTests = [] } = useAdminConceptTests();
  const { data: reports = [] } = useCommercializationReports();
  const { data: instrumentalDataset } = useInstrumentalDataset(true);
  const [selectedHistorySampleId, setSelectedHistorySampleId] = useState<string | null>(null);

  const routedProjectBatch = routeProjectId
    ? importBatches.find(batch => batch.projectId === routeProjectId && batch.status === 'active') ?? null
    : null;
  const legacyRoutedBatch = routeProjectId && !routedProjectBatch
    ? importBatches.find(batch => batch.id === routeProjectId) ?? null
    : null;
  const routedBatch = routedProjectBatch ?? legacyRoutedBatch;

  useEffect(() => {
    if (routedBatch && subCategory !== encodeBatchSelection(routedBatch.id)) {
      setSelection(routedBatch.foodTypeSlug, encodeBatchSelection(routedBatch.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routedBatch?.id]);

  const effectiveFoodType = routedBatch?.foodTypeSlug ?? (routeProjectId ? foodType : 'all');
  const effectiveBatchId = routedBatch?.id ?? (routeProjectId ? parseBatchSelection(subCategory) : null);
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

  if (!effectiveBatchId || !effectiveFoodType || effectiveFoodType === 'all') {
    return (
      <div className="mx-auto max-w-5xl">
        <ProjectPicker
          importBatches={importBatches}
          onOpen={batch => {
            setSelection(batch.foodTypeSlug, encodeBatchSelection(batch.id));
            navigate(projectRoutePath(batch));
          }}
        />
      </div>
    );
  }

  const contextLine = [
    workflow.foodTypeLabel,
    workspaceSettings?.organizationName,
    batch && `Imported ${new Date(batch.createdAt).toLocaleDateString()}`,
    batch && `${batch.sampleCount} sample${batch.sampleCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');
  const activeStageId = workflow.nextAction.stageId;
  const nextActionTone = workflowToneToSemanticTone(workflow.nextAction.tone);
  const gateStages = workflow.stages.filter(stage => stage.id === 'report');
  const gateBlockers = uniqueItems(gateStages.flatMap(stage => stage.blockers));
  const gateWarnings = uniqueItems(gateStages.flatMap(stage => stage.warnings));
  const readinessLine = workflow.latestDecision?.decision === 'GO'
    ? 'GO is confirmed. Concept and report work can move forward from the saved decision evidence.'
    : gateBlockers.length > 0
      ? 'Decision confirmation is the gate before report building.'
      : workflow.nextAction.description;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700">
              <ArrowLeft className="size-3.5" aria-hidden /> Overview
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{workflow.projectName}</h1>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-700">
              {contextLine || 'A guided overview of what exists and what to do next.'}
            </p>
            <p className="mt-4 max-w-2xl text-sm font-medium text-slate-700">{readinessLine}</p>
            <div className="mt-5">
              <JourneyRail stages={workflow.stages} activeStageId={activeStageId} />
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
              <ClipboardCheck className="size-4" />
              Next action
            </div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{workflow.nextAction.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">{workflow.nextAction.description}</p>
            <Link
              to={workflow.nextAction.route}
              className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${toneSolidClasses(nextActionTone)}`}
            >
              Continue
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <EvidenceStat label="samples" value={workflow.counts.importedSamples} />
          <EvidenceStat label="studies" value={workflow.counts.activeStudies} />
          <EvidenceStat label="responses" value={workflow.counts.responsesCollected} />
          <EvidenceStat label="decisions" value={workflow.counts.decisionsRecorded} />
          <EvidenceStat label="concepts" value={workflow.counts.conceptsActive} />
          <EvidenceStat label="reports" value={workflow.counts.reportsSaved} />
        </div>
      </section>

      {(gateBlockers.length > 0 || gateWarnings.length > 0) && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Lock className="size-4 text-slate-500" />
                Commercialization gates
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-700">
                Report building stays locked until the saved decision evidence supports it.
              </p>
            </div>
            <Link
              to={workflow.nextAction.route}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              {workflow.nextAction.label}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {gateBlockers.length > 0 && (
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 lg:grid-cols-2">
              {gateBlockers.slice(0, 2).map(item => (
                <li key={item} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
          {gateWarnings.length > 0 && (
            <ul className="mt-3 grid gap-2 text-sm text-amber-800 lg:grid-cols-2">
              {gateWarnings.slice(0, 2).map(item => (
                <li key={item} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Project journey</h2>
            <p className="text-sm text-slate-700">Completed evidence is compact. Open gates show the reason and the next action.</p>
          </div>
        </div>
        <div className="space-y-3">
          {workflow.stages.map(item => (
            <StageTimelineItem
              key={item.id}
              stage={item}
              active={item.id === activeStageId}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <RecentActivity events={projectEvents} projectScoped={projectScoped} />
        <Card className="rounded-lg border border-slate-200 bg-white lg:col-span-2">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Report readiness link</h2>
            </div>
            <p className="mt-2 text-sm text-slate-700">
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
