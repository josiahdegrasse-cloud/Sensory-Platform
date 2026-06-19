import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, AlertTriangle, Check, Pencil, X } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ProjectStatusBadge } from './project-status-badge';
import { useUpdateImportBatchName } from '../lib/hooks';
import type { ProjectStatusSummary } from '../lib/project-status';

interface ProjectCardProps {
  projectId: string;
  status: ProjectStatusSummary;
  /** Command Center path for this project; the card title links to it. */
  projectPath?: string;
  onOpen?: () => void;
}

/**
 * Action-oriented summary of a single project / import batch. Answers:
 * what is this, where is it in the workflow, what needs attention, what's next.
 */
export function ProjectCard({ projectId, status, projectPath, onOpen }: ProjectCardProps) {
  const updateName = useUpdateImportBatchName();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(status.projectName);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) setDraftName(status.projectName);
  }, [editing, status.projectName]);

  const cancelRename = () => {
    setEditing(false);
    setDraftName(status.projectName);
    setError('');
  };

  const saveRename = async () => {
    const nextName = draftName.trim();
    if (!nextName || nextName === status.projectName || updateName.isPending) {
      if (!nextName) setError('Project name is required.');
      else setEditing(false);
      return;
    }
    setError('');
    try {
      await updateName.mutateAsync({ id: projectId, name: nextName });
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
    <Card className="border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
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
                <Button type="button" size="sm" variant="outline" onMouseDown={event => event.preventDefault()} onClick={() => void saveRename()} disabled={updateName.isPending}>
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
                  onDoubleClick={() => setEditing(true)}
                  className="min-w-0 truncate text-left text-xl font-semibold text-slate-950 decoration-slate-300 underline-offset-4 hover:underline"
                  title="Double-click to rename"
                >
                  {status.projectName}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 group-hover:opacity-100"
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
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700"
              >
                Open project
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <section className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">Status</p>
            <p className="text-sm font-semibold text-slate-900">{status.statusLabel}</p>
            <p className="text-xs leading-5 text-slate-500">{activeStage?.detail}</p>
          </section>

          <section className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500">Progress</p>
              <p className="text-xs font-semibold text-slate-400">{progressText}</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{ width: `${(completeStages / status.stages.length) * 100}%` }}
              />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {status.stages.map(stage => (
                <div key={stage.id} className="flex items-center gap-2 text-xs">
                  <span className={`size-2 rounded-full ${
                    stage.state === 'complete' ? 'bg-emerald-500'
                    : stage.state === 'current' ? 'bg-blue-600'
                    : stage.state === 'needs-review' ? 'bg-amber-500'
                    : 'bg-slate-200'
                  }`} aria-hidden />
                  <span className={stage.state === 'current' || stage.state === 'needs-review' ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                    {stage.label}
                  </span>
                </div>
              ))}
            </div>
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

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Next step</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-950">{status.nextAction.label}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-600">{status.nextAction.description}</p>
          </div>
          <Link
            to={status.nextAction.path}
            onClick={onOpen}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Continue <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="text-[11px] text-slate-400">Double-click the project name to rename it.</p>
      </CardContent>
    </Card>
  );
}
