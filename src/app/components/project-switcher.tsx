import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ListFilter,
  Plus,
  Settings2,
  Unlink,
} from 'lucide-react';
import { useFoodType } from '../contexts/food-type-context';
import { useDecisionRecords, useImportBatches, useProjects } from '../lib/hooks';
import { encodeBatchSelection, parseBatchSelection } from '../lib/project-identity';
import { currentPathToJourneyStep, projectPath } from '../lib/project-journey-routes';
import { getLatestDecisionByProject, groupProjectsForSwitcher } from '../lib/project-switcher';
import type { ImportBatchRecord, ProjectRecord } from '../lib/database';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const decisionStyles = {
  GO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TWEAK: 'border-amber-200 bg-amber-50 text-amber-800',
  STOP: 'border-rose-200 bg-rose-50 text-rose-700',
} as const;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export function ProjectSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const { foodType, subCategory, setSelection } = useFoodType();
  const { data: projects = [] } = useProjects();
  const { data: batches = [] } = useImportBatches();
  const { data: decisions = [] } = useDecisionRecords();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const selectedBatchId = parseBatchSelection(subCategory);
  const selectedBatch = selectedBatchId
    ? batches.find(batch => batch.id === selectedBatchId) ?? null
    : null;
  const routeProjectId = location.pathname.match(/^\/project\/([^/]+)/)?.[1] ?? null;
  const selectedProjectId = routeProjectId ?? selectedBatch?.projectId ?? null;
  const selectedProject = selectedProjectId
    ? projects.find(project => project.id === selectedProjectId) ?? null
    : null;
  const groups = useMemo(() => groupProjectsForSwitcher(projects), [projects]);
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach(project => {
      const key = project.name.trim().toLocaleLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [projects]);
  const latestDecisions = useMemo(() => getLatestDecisionByProject(decisions), [decisions]);
  const unassignedBatches = useMemo(
    () => batches.filter(batch => batch.status === 'active' && !batch.projectId),
    [batches],
  );

  const selectedName = selectedProject?.name
    ?? selectedBatch?.projectName
    ?? (selectedBatch ? selectedBatch.fileName.replace(/\.csv$/i, '') : 'Choose a project');
  const selectedFoodType = selectedProject?.foodTypeLabel
    ?? selectedBatch?.foodTypeLabel
    ?? 'Project workspace';
  const selectedDecision = selectedProject ? latestDecisions.get(selectedProject.id) : undefined;
  const journeyStep = currentPathToJourneyStep(location.pathname) ?? 'overview';
  const projectSearch = location.pathname.startsWith('/project/') ? location.search : '';

  const goToProject = (project: ProjectRecord) => {
    const linkedBatch = batches.find(batch => batch.projectId === project.id && batch.status === 'active')
      ?? batches.find(batch => batch.projectId === project.id);
    setSelection(
      project.foodTypeSlug ?? linkedBatch?.foodTypeSlug ?? foodType,
      linkedBatch ? encodeBatchSelection(linkedBatch.id) : null,
    );
    navigate(projectPath(project.id, journeyStep, projectSearch));
    setOpen(false);
  };

  const goToUnassignedBatch = (batch: ImportBatchRecord) => {
    setSelection(batch.foodTypeSlug, encodeBatchSelection(batch.id));
    navigate(projectPath(batch.id, journeyStep, projectSearch));
    setOpen(false);
  };

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const renderProject = (project: ProjectRecord) => {
    const decision = latestDecisions.get(project.id);
    const selected = project.id === selectedProjectId;
    const duplicateName = (duplicateNames.get(project.name.trim().toLocaleLowerCase()) ?? 0) > 1;
    return (
      <CommandItem
        key={project.id}
        value={`${project.name} ${project.foodTypeLabel ?? ''} ${decision ?? ''} ${project.id}`}
        onSelect={() => goToProject(project)}
        className="min-h-14 gap-3 rounded-md px-3 py-2"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <FolderKanban className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">{project.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {project.foodTypeLabel ?? 'Unlabelled food type'} · Started {dateLabel(project.startedAt)}
            {duplicateName ? ` · ID ${project.id.slice(0, 6)}` : ''}
          </span>
        </span>
        {decision && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${decisionStyles[decision]}`}>
            {decision}
          </span>
        )}
        {selected && <Check className="size-4 text-[var(--brand)]" />}
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="project-switcher-trigger"
          aria-label={`Current project: ${selectedName}. Switch project`}
          className="flex min-w-0 max-w-[12rem] items-center gap-2 rounded-md border border-[var(--brand-border)] bg-white px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--brand-soft)] sm:max-w-[20rem]"
        >
          <FolderKanban className="size-4 shrink-0 text-[var(--brand)]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-slate-900 sm:text-sm">{selectedName}</span>
            <span className="hidden truncate text-[11px] text-slate-500 sm:block">
              {selectedFoodType}{selectedDecision ? ` · ${selectedDecision}` : ''}
            </span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        data-testid="project-switcher-content"
        className="w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-lg border-slate-200 p-0 shadow-xl"
      >
        <Command>
          <div className="border-b border-slate-200 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Switch project</p>
            <p className="mt-0.5 text-xs text-slate-500">The current workflow step will be preserved.</p>
          </div>
          <CommandInput placeholder="Search projects…" />
          <CommandList className="max-h-[min(28rem,60vh)]">
            <CommandEmpty>No matching projects found.</CommandEmpty>
            {groups.recent.length > 0 && (
              <CommandGroup heading="Recent projects">
                {groups.recent.map(renderProject)}
              </CommandGroup>
            )}
            {groups.remaining.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Active projects">
                  {groups.remaining.map(renderProject)}
                </CommandGroup>
              </>
            )}
            {unassignedBatches.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Needs assignment">
                  {unassignedBatches.map(batch => (
                    <CommandItem
                      key={batch.id}
                      value={`${batch.projectName ?? batch.fileName} ${batch.foodTypeLabel} needs assignment`}
                      onSelect={() => goToUnassignedBatch(batch)}
                      className="min-h-12 gap-3 rounded-md px-3 py-2"
                    >
                      <Unlink className="size-4 text-amber-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-800">
                          {batch.projectName ?? batch.fileName.replace(/\.csv$/i, '')}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{batch.foodTypeLabel} · Unassigned import</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {groups.archived.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup forceMount heading="Archive">
                  <CommandItem
                    forceMount
                    value="show archived projects"
                    onSelect={() => setShowArchived(value => !value)}
                    className="min-h-10 rounded-md px-3"
                  >
                    <Archive className="size-4 text-slate-500" />
                    <span className="flex-1">Archived projects</span>
                    <span className="text-xs text-slate-500">{groups.archived.length}</span>
                    <ChevronRight className={`size-4 text-slate-500 transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                  </CommandItem>
                  {showArchived && groups.archived.map(renderProject)}
                </CommandGroup>
              </>
            )}
          </CommandList>
          <div className="grid grid-cols-3 gap-1 border-t border-slate-200 bg-slate-50 p-2">
            <button type="button" onClick={() => goTo('/')} className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-slate-700 hover:bg-white">
              <ListFilter className="size-3.5" /> All projects
            </button>
            <button type="button" onClick={() => goTo('/stage1')} className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-slate-700 hover:bg-white">
              <Plus className="size-3.5" /> Add project
            </button>
            <button type="button" onClick={() => goTo('/admin?tab=imports')} className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-slate-700 hover:bg-white">
              <Settings2 className="size-3.5" /> Data hygiene
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
