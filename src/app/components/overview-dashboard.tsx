import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from "react-router";
import {
  FolderKanban, Plus, ArrowRight, Search, MoreHorizontal, Trash2,
} from "lucide-react";
import { useFoodType } from "../contexts/food-type-context";
import { encodeBatchSelection } from "../lib/project-identity";
import { projectPath } from "../lib/project-journey-routes";
import { useDeleteProject, useFormulationVersions, useWorkspaceSettings } from "../lib/hooks";
import { useProjectStatusList, type ProjectStatusListEntry } from "../lib/use-project-status";
import { ProjectCard } from "./project-card";
import { ProjectWorkflowPath } from "./project-workflow-path";
import { ProjectStatusBadge, toneSolidClasses } from "./project-status-badge";
import { StageEmptyState } from "./stage-empty-state";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/** Next actions a human must take (not "wait for panelists"): AI output or
 * data sitting in review, or a decision/report waiting on the admin. */
function needsHumanAttention(entry: ProjectStatusListEntry): boolean {
  return (
    entry.status.stages.some(stage => stage.state === 'needs-review') ||
    ['Review results', 'Review the report', 'Plan the tweak', 'Review the STOP rationale'].includes(entry.status.nextAction.label)
  );
}

function projectDataPath(entry: ProjectStatusListEntry): string {
  return projectPath(entry.batch.projectId ?? entry.batch.id, 'data');
}

function ProjectTable({ entries, onOpen, onDeleteRequest }: {
  entries: ProjectStatusListEntry[];
  onOpen: (entry: ProjectStatusListEntry) => void;
  onDeleteRequest: (entry: ProjectStatusListEntry) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-semibold">Project</th>
            <th className="px-3 py-2 font-semibold">Category</th>
            <th className="min-w-[30rem] px-3 py-2 font-semibold">Workflow</th>
            <th className="px-3 py-2 font-semibold">Decision</th>
            <th className="px-3 py-2 font-semibold">Responses</th>
            <th className="px-3 py-2 font-semibold">Report</th>
            <th className="px-3 py-2 font-semibold">Imported</th>
            <th className="px-3 py-2 font-semibold sr-only">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map(entry => {
            const { batch, status } = entry;
            return (
              <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 font-bold text-slate-900">
                  <Link to={projectDataPath(entry)} onClick={() => onOpen(entry)} className="transition-colors hover:text-slate-900">
                    {status.projectName}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-500">{status.foodTypeLabel}</td>
                <td className="px-3 py-2.5">
                  <ProjectWorkflowPath stages={status.stages} compact onNavigate={() => onOpen(entry)} />
                </td>
                <td className="px-3 py-2.5">
                  <ProjectStatusBadge label={status.decisionStatus} tone={status.decisionTone} showIcon={false} />
                </td>
                <td className="px-3 py-2.5 text-slate-700">
                  {status.responseTarget > 0 ? `${status.responseCompleted}/${status.responseTarget}` : '—'}
                </td>
                <td className="px-3 py-2.5 text-slate-500 capitalize">
                  {status.reportStatus === 'not-ready' ? '—' : status.reportStatus}
                </td>
                <td className="px-3 py-2.5 text-slate-500">{new Date(batch.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <Link
                      to={status.nextAction.path}
                      onClick={() => onOpen(entry)}
                      title={status.nextAction.label}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors hover:opacity-90 ${toneSolidClasses(status.nextAction.tone)}`}
                    >
                      Go <ArrowRight className="size-3" />
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={`More actions for ${status.projectName}`}>
                          <MoreHorizontal className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem variant="destructive" onSelect={() => onDeleteRequest(entry)}>
                          <Trash2 className="size-4" aria-hidden />
                          Delete project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActiveProjects({ onNewProject }: { onNewProject: () => void }) {
  const { setSelection } = useFoodType();
  const projects = useProjectStatusList();
  const { data: formulationVersions = [] } = useFormulationVersions();
  const [query, setQuery] = useState('');
  const [formulationFilter, setFormulationFilter] = useState<'all' | 'reviewed' | 'needs-review'>('all');
  const [projectToDelete, setProjectToDelete] = useState<ProjectStatusListEntry | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const deleteProjectMutation = useDeleteProject();

  if (projects.length === 0) {
    return (
      <div>
        <ProjectSectionHeader count={0} query={query} onQueryChange={setQuery} formulationFilter={formulationFilter} onFilterChange={setFormulationFilter} />
        <ActiveProjectsEmptyState onNewProject={onNewProject} />
      </div>
    );
  }

  const open = (entry: ProjectStatusListEntry) =>
    setSelection(entry.batch.foodTypeSlug, encodeBatchSelection(entry.batch.id));

  const requestDelete = (entry: ProjectStatusListEntry) => {
    setProjectToDelete(entry);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  const closeDeleteDialog = () => {
    if (deleteProjectMutation.isPending) return;
    setProjectToDelete(null);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!projectToDelete || deleteConfirmation !== projectToDelete.status.projectName) return;
    setDeleteError('');
    try {
      await deleteProjectMutation.mutateAsync({
        projectId: projectToDelete.batch.projectId,
        fallbackBatchId: projectToDelete.batch.id,
      });
      setProjectToDelete(null);
      setDeleteConfirmation('');
      setDeleteError('');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this project.');
    }
  };

  // Needs-attention projects first, then most recently imported.
  const sorted = [...projects].sort((a, b) => {
    const attention = Number(needsHumanAttention(b)) - Number(needsHumanAttention(a));
    if (attention !== 0) return attention;
    return new Date(b.batch.createdAt).getTime() - new Date(a.batch.createdAt).getTime();
  });
  const visible = (() => {
    const normalized = query.trim().toLowerCase();
    return sorted.filter(entry => {
      const linkedVersions = formulationVersions.filter(version => (
        version.isCurrent
        && (version.importBatchId === entry.batch.id || version.projectId === entry.batch.projectId)
      ));
      const formulationMatches = formulationFilter === 'all'
        || (formulationFilter === 'reviewed' && linkedVersions.some(version => version.reviewStatus === 'reviewed'))
        || (formulationFilter === 'needs-review' && (
          linkedVersions.length === 0 || linkedVersions.some(version => version.reviewStatus !== 'reviewed')
        ));
      if (!formulationMatches) return false;
      if (!normalized) return true;
      const formulationText = linkedVersions.flatMap(version => [
        version.exactStatement,
        ...version.ingredients.flatMap(ingredient => [ingredient.suppliedName, ingredient.canonicalName, ingredient.functionalRole]),
      ]).join(' ');
      return [entry.status.projectName, entry.status.foodTypeLabel, formulationText]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  })();
  return (
    <div className="space-y-5">
      <ProjectSectionHeader count={projects.length} visibleCount={visible.length} query={query} onQueryChange={setQuery} formulationFilter={formulationFilter} onFilterChange={setFormulationFilter} />
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-bold text-slate-900">No projects match this formulation search</p>
          <p className="mt-1 text-xs text-slate-600">Try a project name, category, ingredient, functional role, or a different review filter.</p>
        </div>
      ) : visible.length > 8 ? (
        <ProjectTable entries={visible} onOpen={open} onDeleteRequest={requestDelete} />
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          {visible.map(entry => (
            <ProjectCard
              key={entry.batch.id}
              projectId={entry.batch.id}
              realProjectId={entry.batch.projectId}
              status={entry.status}
              projectPath={projectDataPath(entry)}
              onOpen={() => open(entry)}
              onDeleteRequest={() => requestDelete(entry)}
            />
          ))}
        </div>
      )}

      <Dialog open={Boolean(projectToDelete)} onOpenChange={open => !open && closeDeleteDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription className="leading-6 text-slate-600">
              This removes <strong className="font-semibold text-slate-900">{projectToDelete?.status.projectName}</strong> and its linked imports from the active workspace. Generated surveys from those imports will be deleted. This cannot be undone in the app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-project-confirmation">
              Type <strong>{projectToDelete?.status.projectName}</strong> to confirm
            </Label>
            <Input
              id="delete-project-confirmation"
              value={deleteConfirmation}
              onChange={event => setDeleteConfirmation(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && deleteConfirmation === projectToDelete?.status.projectName) void confirmDelete();
              }}
              autoComplete="off"
              disabled={deleteProjectMutation.isPending}
            />
          </div>

          {deleteError && <Alert variant="destructive"><AlertDescription>{deleteError}</AlertDescription></Alert>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={deleteProjectMutation.isPending}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={!projectToDelete || deleteConfirmation !== projectToDelete.status.projectName || deleteProjectMutation.isPending}
            >
              <Trash2 className="size-4" aria-hidden />
              {deleteProjectMutation.isPending ? 'Deleting…' : 'Delete project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectSectionHeader({
  count,
  visibleCount = count,
  query,
  onQueryChange,
  formulationFilter,
  onFilterChange,
}: {
  count: number;
  visibleCount?: number;
  query: string;
  onQueryChange: (value: string) => void;
  formulationFilter: 'all' | 'reviewed' | 'needs-review';
  onFilterChange: (value: 'all' | 'reviewed' | 'needs-review') => void;
}) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900">Live projects</h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <span className={`size-2 rounded-full ${count > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden />
          {visibleCount === count ? `${count} live` : `${visibleCount} of ${count}`}
        </span>
      </div>
      {count > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search projects and ingredients</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="Search projects, ingredients, or roles"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            value={formulationFilter}
            onChange={event => onFilterChange(event.target.value as 'all' | 'reviewed' | 'needs-review')}
            aria-label="Filter by formulation review status"
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All formulations</option>
            <option value="reviewed">Reviewed formulations</option>
            <option value="needs-review">Needs ingredient review</option>
          </select>
        </div>
      )}
    </div>
  );
}

function ActiveProjectsEmptyState({ onNewProject }: { onNewProject: () => void }) {
  return (
    <StageEmptyState
      icon={FolderKanban}
      headline="No live projects yet"
      body="Name a project and upload an instrumental CSV to begin the workflow."
      cta={{ label: 'Choose project CSV', onClick: onNewProject }}
    />
  );
}

export function OverviewDashboard() {
  const { data: workspaceSettings } = useWorkspaceSettings();
  const navigate = useNavigate();
  const newProjectFileRef = useRef<HTMLInputElement>(null);

  const chooseProjectCsv = () => newProjectFileRef.current?.click();

  const openProjectImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    navigate('/stage1?new=project', { state: { initialCsvFile: file } });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <input
        ref={newProjectFileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={openProjectImport}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* Header — tenant identity, never a hardcoded client name */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {workspaceSettings?.organizationName ?? 'Sensory Platform'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            One project, one continuous journey — from raw instrumental data to a commercialization report.
          </p>
        </div>
        <button
          type="button"
          onClick={chooseProjectCsv}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
        >
          <Plus className="size-3.5" aria-hidden /> New project
        </button>
      </div>

      {/* Active projects — the action-oriented home view */}
      <ActiveProjects onNewProject={chooseProjectCsv} />

    </div>
  );
}
