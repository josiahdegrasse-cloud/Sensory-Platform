import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, AlertTriangle, Check, Pencil, X } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ProjectStatusBadge } from './project-status-badge';
import { ProjectWorkflowPath } from './project-workflow-path';
import { useRenameProject, useUpdateImportBatchName } from '../lib/hooks';
import type { ProjectStatusSummary } from '../lib/project-status';

interface ProjectCardProps {
  projectId: string;
  /** The real project id, when this batch is linked to one. Renames target the
   *  project's name; without it, renames fall back to the import batch name. */
  realProjectId?: string | null;
  status: ProjectStatusSummary;
  /** Command Center path for this project; the card title links to it. */
  projectPath?: string;
  onOpen?: () => void;
}

/**
 * Action-oriented summary of a single project / import batch. Answers:
 * what is this, where is it in the workflow, what needs attention, what's next.
 */
export function ProjectCard({ projectId, realProjectId, status, projectPath, onOpen }: ProjectCardProps) {
  const updateName = useUpdateImportBatchName();
  const renameProjectMutation = useRenameProject();
  const isRenaming = updateName.isPending || renameProjectMutation.isPending;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(status.projectName);
  const [error, setError] = useState('');

  // Seed the draft with the current name each time editing begins, so there's
  // no effect mirroring projectName into draftName.
  const startEditing = () => {
    setDraftName(status.projectName);
    setEditing(true);
  };

  const cancelRename = () => {
    setEditing(false);
    setDraftName(status.projectName);
    setError('');
  };

  const saveRename = async () => {
    const nextName = draftName.trim();
    if (!nextName || nextName === status.projectName || isRenaming) {
      if (!nextName) setError('Project name is required.');
      else setEditing(false);
      return;
    }
    setError('');
    try {
      // Linked to a real project → rename the project entity; otherwise fall back
      // to renaming the underlying import batch (legacy/unassigned).
      if (realProjectId) {
        await renameProjectMutation.mutateAsync({ id: realProjectId, name: nextName });
      } else {
        await updateName.mutateAsync({ id: projectId, name: nextName });
      }
      setEditing(false);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'Unable to rename this project.');
    }
  };

  const completeStages = status.stages.filter(stage => stage.state === 'complete').length;
  const activeStage = status.stages.find(stage => stage.state === 'current')
    ?? status.stages.find(stage => stage.state === 'needs-review')
    ?? status.stages.find(stage => stage.state === 'available')
    ?? status.stages[status.stages.length - 1];
  const progressText = `${completeStages} of ${status.stages.length} stages complete`;
  const responsesText = status.responseTarget > 0
    ? `${status.responseCompleted} / ${status.responseTarget} responses collected`
    : 'No response target yet';
  const evidenceText = status.issfScore !== null
    ? `ISSF ${status.issfScore.toFixed(0)} · ${status.confidence ?? 'Low'} confidence`
    : null;

  return (
    <Card className="border-slate-200 bg-white transition-colors hover:border-slate-200">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {editing ? (
              <div className="flex max-w-md items-center gap-2">
                <Input
                  value={draftName}
                  onChange={event => setDraftName(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') void saveRename();
                    if (event.key === 'Escape') cancelRename();
                  }}
                  onBlur={() => void saveRename()}
                  aria-label="Project name"
                  className="h-9 bg-white text-base font-semibold"
                />
                <Button type="button" size="sm" variant="outline" onMouseDown={event => event.preventDefault()} onClick={() => void saveRename()} disabled={isRenaming}>
                  <Check className="size-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" onMouseDown={event => event.preventDefault()} onClick={cancelRename}>
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="group flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onDoubleClick={startEditing}
                  className="min-w-0 truncate text-left text-xl font-semibold text-slate-900 decoration-slate-300 underline-offset-4 hover:underline"
                  title="Double-click to rename"
                >
                  {status.projectName}
                </button>
                <button
                  type="button"
                  onClick={startEditing}
                  className="rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-50 hover:text-slate-700 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] group-hover:opacity-100"
                  aria-label={`Rename ${status.projectName}`}
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <p className="text-sm text-slate-500">{status.foodTypeLabel} evaluation</p>
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ProjectStatusBadge label={status.statusLabel} tone={status.statusTone} />
            {projectPath && (
              <Link
                to={projectPath}
                onClick={onOpen}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-200 hover:text-slate-900"
              >
                Open project
              </Link>
            )}
          </div>
        </div>

        <section className="border-y border-slate-200 py-4" aria-label="Project progress">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Project path</p>
              <p className="mt-0.5 text-xs text-slate-500">From evidence intake to a client-ready report.</p>
            </div>
            <p className="shrink-0 text-xs font-semibold text-slate-500">{progressText}</p>
          </div>
          <ProjectWorkflowPath stages={status.stages} onNavigate={onOpen} />
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Current position</p>
            <p className="text-sm font-semibold text-slate-900">{status.statusLabel}</p>
            <p className="text-xs leading-5 text-slate-500">{activeStage?.detail}</p>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Evidence</p>
            <p className="text-sm font-semibold text-slate-900">{responsesText}</p>
            {evidenceText && <p className="text-xs leading-5 text-slate-500">{evidenceText}</p>}
          </section>
        </div>

        {status.warnings.length > 0 && (
          <div className="space-y-1">
            {status.warnings.map(warning => (
              <div key={warning} className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Next step</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{status.nextAction.label}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-700">{status.nextAction.description}</p>
          </div>
          <Link
            to={status.nextAction.path}
            onClick={onOpen}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Continue <ArrowRight className="size-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
