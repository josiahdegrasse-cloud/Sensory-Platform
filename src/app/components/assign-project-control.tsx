import { useState } from 'react';
import { FolderPlus, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAssignBatchToProject, useCreateProject, useProjects } from '../lib/hooks';

interface AssignProjectControlProps {
  batchId: string;
  /** Food type FK of the batch — scopes the project list and is required to create one. */
  foodTypeId: string | null;
  /** Pre-fills the "new project" name input. */
  defaultName: string;
}

/**
 * Links an unassigned import batch to a real project — either an existing one
 * (same food type) or a newly-created one. Replaces the old disabled stub so the
 * project entity is actually reachable from the workflow.
 */
export function AssignProjectControl({ batchId, foodTypeId, defaultName }: AssignProjectControlProps) {
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const assign = useAssignBatchToProject();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState(defaultName);
  const [error, setError] = useState('');

  const candidates = projects.filter(
    project => project.status === 'active' && (!foodTypeId || project.foodTypeId === foodTypeId),
  );
  const busy = createProject.isPending || assign.isPending;

  const assignExisting = async (projectId: string) => {
    setError('');
    try {
      await assign.mutateAsync({ batchId, projectId });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign this batch.');
    }
  };

  const createAndAssign = async () => {
    const name = newName.trim();
    if (!name) { setError('Project name is required.'); return; }
    if (!foodTypeId) { setError('This batch has no food type, so a project cannot be created.'); return; }
    setError('');
    try {
      const project = await createProject.mutateAsync({ name, foodTypeId });
      await assign.mutateAsync({ batchId, projectId: project.id });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the project.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setNewName(defaultName); }}
        className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700"
      >
        <FolderPlus className="size-3" aria-hidden /> Assign project
      </button>
    );
  }

  return (
    <div className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assign to a project</span>
        <button type="button" onClick={() => { setOpen(false); setError(''); }} className="text-slate-400 hover:text-slate-700" aria-label="Cancel">
          <X className="size-3.5" />
        </button>
      </div>

      {candidates.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {candidates.map(project => (
            <button
              key={project.id}
              type="button"
              disabled={busy}
              onClick={() => void assignExisting(project.id)}
              className="block w-full truncate rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {project.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          value={newName}
          onChange={event => setNewName(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') void createAndAssign(); }}
          aria-label="New project name"
          placeholder="New project name"
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void createAndAssign()} title="Create project and assign this batch">
          <Check className="size-3.5" />
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-slate-400">Pick an existing project above, or type a name to create a new one.</p>
      {error && <p className="mt-1 text-[11px] font-semibold text-rose-600">{error}</p>}
    </div>
  );
}
