import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  FolderKanban,
  Check,
  Pencil,
  X,
} from 'lucide-react';
import { StageEmptyState } from './stage-empty-state';
import { useFoodType } from '../contexts/food-type-context';
import { parseBatchSelection, encodeBatchSelection, projectRoutePath } from '../lib/project-identity';
import {
  useAdminConceptTests,
  useAuditEvents,
  useCommercializationReports,
  useDecisionRecords,
  useFormulationExperiments,
  useFormulationVersions,
  useImportBatches,
  useInstrumentalDataset,
  useProducts,
  useResponsesForProducts,
  useRenameProject,
  useUpdateImportBatchName,
  useWorkspaceSettings,
} from '../lib/hooks';
import { ProductHistoryTimeline } from './product-history-timeline';
import { buildProductTimeline } from '../lib/product-history';
import { useProjectWorkflow } from '../lib/workflow/use-project-workflow';
import type { ImportBatchRecord } from '../lib/database';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ProjectDecisionRoom } from './project-decision-room';
import {
  buildDecisionRoomLineage,
  buildDecisionRoomPrototypes,
  decisionRoomEligibility,
  decisionRoomNextAction,
} from '../lib/project-decision-room';
import { projectDecisionExperimentsPath, projectPath } from '../lib/project-journey-routes';
import { FormulationContextStrip } from './formulation-context-strip';

function EvidenceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
      <div className="text-xl font-semibold tabular-nums text-slate-950">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function uniqueItems(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function NoProjectState() {
  return (
    <StageEmptyState
      icon={FolderKanban}
      headline="No project selected"
      body="Choose a project from the project switcher or import instrumental data to start the workflow."
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
  const { data: products = [] } = useProducts();
  const { data: instrumentalDataset } = useInstrumentalDataset(true);
  const renameProject = useRenameProject();
  const updateImportBatchName = useUpdateImportBatchName();
  const [selectedHistorySampleId, setSelectedHistorySampleId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState('');
  const lastTitleTapAt = useRef(0);
  const renameInputRef = useRef<HTMLInputElement>(null);

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
  const projectScopeId = batch?.projectId ?? routedProjectBatch?.projectId ?? undefined;
  const { data: formulationVersions = [] } = useFormulationVersions(projectScopeId, Boolean(projectScopeId));
  const { data: formulationExperiments = [] } = useFormulationExperiments(projectScopeId);
  const isRenaming = renameProject.isPending || updateImportBatchName.isPending;

  useEffect(() => {
    if (!editingName) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingName]);

  const startRenaming = () => {
    setDraftName(workflow.projectName);
    setRenameError('');
    setEditingName(true);
  };

  const cancelRenaming = () => {
    setDraftName(workflow.projectName);
    setRenameError('');
    setEditingName(false);
  };

  const saveProjectName = async () => {
    const nextName = draftName.trim();
    if (isRenaming) return;
    if (!nextName) {
      setRenameError('Project name is required.');
      return;
    }
    if (nextName === workflow.projectName) {
      setEditingName(false);
      return;
    }

    setRenameError('');
    try {
      if (batch?.projectId) {
        await renameProject.mutateAsync({ id: batch.projectId, name: nextName });
      } else if (batch) {
        await updateImportBatchName.mutateAsync({ id: batch.id, name: nextName });
      } else {
        setRenameError('This project could not be identified.');
        return;
      }
      setEditingName(false);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'Unable to rename this project.');
    }
  };

  const projectBatches = useMemo(() => {
    if (projectScopeId) {
      return importBatches.filter(item => item.projectId === projectScopeId && item.status === 'active');
    }
    return batch ? [batch] : [];
  }, [batch, importBatches, projectScopeId]);
  const projectSamples = useMemo(() => {
    if (!instrumentalDataset) return [];
    const batchIds = new Set(projectBatches.map(item => item.id));
    return instrumentalDataset.eTongueData.filter(sample => sample.importBatchId && batchIds.has(sample.importBatchId));
  }, [instrumentalDataset, projectBatches]);
  const projectProductIds = useMemo(() => {
    const sampleIds = new Set(projectSamples.map(sample => sample.sampleId));
    const batchIds = new Set(projectBatches.map(item => item.id));
    return products
      .filter(product => (
        (projectScopeId ? product.projectId === projectScopeId : false)
        || (product.sourceImportBatchId ? batchIds.has(product.sourceImportBatchId) : false)
        || (product.sourceSampleId ? sampleIds.has(product.sourceSampleId) : false)
      ))
      .map(product => product.id);
  }, [products, projectBatches, projectSamples, projectScopeId]);
  const { data: responses = [] } = useResponsesForProducts(projectProductIds);
  const prototypes = useMemo(() => buildDecisionRoomPrototypes({
    samples: projectSamples,
    decisions: decisionRecords,
    formulations: formulationVersions,
    experiments: formulationExperiments,
    products,
    responses,
    concepts: conceptTests,
    reports,
    projectId: projectScopeId,
    dataset: instrumentalDataset,
  }), [conceptTests, decisionRecords, formulationExperiments, formulationVersions, instrumentalDataset, products, projectSamples, projectScopeId, reports, responses]);
  const selectedPrototypeKey = selectedHistorySampleId && prototypes.some(item => item.key === selectedHistorySampleId)
    ? selectedHistorySampleId
    : prototypes[0]?.key ?? null;
  const selectedPrototype = prototypes.find(item => item.key === selectedPrototypeKey) ?? null;
  const historySampleId = selectedPrototype?.sampleId ?? null;
  const historySampleName = selectedPrototype?.sampleName ?? historySampleId ?? '';
  const productTimeline = historySampleId
    ? buildProductTimeline(
      historySampleId,
      historySampleName,
      importBatches,
      decisionRecords,
      conceptTests,
      reports,
      {
        instrumentalSampleId: selectedPrototype?.instrumentalSampleId,
        importBatchId: selectedPrototype?.importBatchId,
        projectId: projectScopeId,
      },
    )
    : null;

  const scopeRouteId = projectScopeId ?? batch?.id ?? routeProjectId ?? '';
  const decisionRoomRoutes = useMemo(() => ({
    data: projectPath(scopeRouteId, 'data'),
    studies: projectPath(scopeRouteId, 'studies'),
    insights: projectPath(scopeRouteId, 'insights'),
    decision: projectPath(scopeRouteId, 'decision'),
    experiments: projectDecisionExperimentsPath(scopeRouteId),
    concept: projectPath(scopeRouteId, 'concept'),
    report: projectPath(scopeRouteId, 'report'),
  }), [scopeRouteId]);
  const eligibility = selectedPrototype ? decisionRoomEligibility(selectedPrototype) : null;
  const lineage = useMemo(() => selectedPrototype ? buildDecisionRoomLineage({
    prototype: selectedPrototype,
    workflow,
    routes: decisionRoomRoutes,
  }) : [], [decisionRoomRoutes, selectedPrototype, workflow]);
  const prototypeNextAction = selectedPrototype ? decisionRoomNextAction({
    prototype: selectedPrototype,
    workflow,
    routes: {
      data: decisionRoomRoutes.data,
      decision: decisionRoomRoutes.decision,
      experiments: decisionRoomRoutes.experiments,
    },
  }) : null;

  const { projectEvents, projectScoped } = useMemo(() => {
    const needles = [projectScopeId, ...projectBatches.map(item => item.id)].filter(Boolean) as string[];
    const matched = auditEvents.filter(event => {
      const haystack = `${event.entityId ?? ''} ${JSON.stringify(event.metadata)}`;
      return needles.some(needle => haystack.includes(needle));
    });
    return matched.length > 0
      ? { projectEvents: matched.slice(0, 5), projectScoped: true }
      : { projectEvents: auditEvents.slice(0, 5), projectScoped: false };
  }, [auditEvents, projectBatches, projectScopeId]);

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
    workspaceSettings?.organizationName,
    `${projectBatches.length} active batch${projectBatches.length === 1 ? '' : 'es'}`,
    `${prototypes.length} prototype${prototypes.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto max-w-[90rem] space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link to="/" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800">
            <ArrowLeft className="size-3.5" aria-hidden /> Projects
          </Link>
          <div className="mt-1">
            {editingName ? (
              <div className="flex max-w-xl items-center gap-2">
                <Input
                  ref={renameInputRef}
                  value={draftName}
                  onChange={event => setDraftName(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') void saveProjectName();
                    if (event.key === 'Escape') cancelRenaming();
                  }}
                  onBlur={() => void saveProjectName()}
                  aria-label="Project name"
                  aria-invalid={Boolean(renameError)}
                  className="h-12 bg-white text-2xl font-semibold tracking-tight"
                />
                <Button type="button" size="icon" variant="outline" onMouseDown={event => event.preventDefault()} onClick={() => void saveProjectName()} disabled={isRenaming} aria-label="Save project name">
                  <Check className="size-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onMouseDown={event => event.preventDefault()} onClick={cancelRenaming} aria-label="Cancel project rename">
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="group/name flex min-w-0 items-center gap-2">
                <h1 className="min-w-0 text-3xl font-semibold leading-tight tracking-tight text-slate-950">
                  <button
                    type="button"
                    onDoubleClick={startRenaming}
                    onPointerUp={event => {
                      if (event.pointerType !== 'touch') return;
                      const now = Date.now();
                      if (now - lastTitleTapAt.current < 400) startRenaming();
                      lastTitleTapAt.current = now;
                    }}
                    className="max-w-full truncate rounded-md text-left decoration-slate-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
                    title="Double-click or double-tap to rename"
                    aria-label={`${workflow.projectName}. Double-click or double-tap to rename.`}
                  >
                    {workflow.projectName}
                  </button>
                </h1>
                <button type="button" onClick={startRenaming} className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 sm:opacity-0 sm:group-hover/name:opacity-100 sm:focus:opacity-100" aria-label={`Rename ${workflow.projectName}`}>
                  <Pencil className="size-4" />
                </button>
              </div>
            )}
            {renameError && <p className="mt-1 text-xs font-semibold text-rose-700" role="alert">{renameError}</p>}
          </div>
          <p className="mt-1 text-sm text-slate-600">{contextLine}</p>
        </div>
      </header>

      <FormulationContextStrip projectId={projectScopeId} context="overview" prominent />

      <ProjectDecisionRoom
        prototypes={prototypes}
        selectedPrototype={selectedPrototype}
        onSelectPrototype={setSelectedHistorySampleId}
        lineage={lineage}
        eligibility={eligibility}
        nextAction={prototypeNextAction}
        projectEvents={projectEvents}
        projectScopedEvents={projectScoped}
        batchCount={projectBatches.length}
      />

      {productTimeline && productTimeline.events.length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 marker:text-slate-400">
            Full prototype history ({productTimeline.events.length} event{productTimeline.events.length === 1 ? '' : 's'})
          </summary>
          <div className="border-t border-slate-200 p-4">
            <ProductHistoryTimeline timeline={productTimeline} />
          </div>
        </details>
      )}
    </div>
  );
}
