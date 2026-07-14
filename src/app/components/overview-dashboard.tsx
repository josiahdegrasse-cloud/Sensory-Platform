import { Link } from "react-router";
import {
  FolderKanban, Plus, ArrowRight,
} from "lucide-react";
import { useFoodType } from "../contexts/food-type-context";
import { encodeBatchSelection, projectRoutePath } from "../lib/project-identity";
import { useWorkspaceSettings } from "../lib/hooks";
import { useProjectStatusList, type ProjectStatusListEntry } from "../lib/use-project-status";
import { ProjectCard } from "./project-card";
import { ProjectWorkflowPath } from "./project-workflow-path";
import { NextActionCard } from "./next-action-card";
import { ProjectStatusBadge, toneSolidClasses } from "./project-status-badge";
import { StageEmptyState } from "./stage-empty-state";

/** Next actions a human must take (not "wait for panelists"): AI output or
 * data sitting in review, or a decision/report waiting on the admin. */
function needsHumanAttention(entry: ProjectStatusListEntry): boolean {
  return (
    entry.status.stages.some(stage => stage.state === 'needs-review') ||
    ['Review results', 'Review the report', 'Plan the tweak', 'Review the STOP rationale'].includes(entry.status.nextAction.label)
  );
}

function AttentionRail({ entries, onOpen }: {
  entries: ProjectStatusListEntry[];
  onOpen: (entry: ProjectStatusListEntry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-slate-900">
        Waiting on you
        <span className="ml-2 text-xs font-normal text-slate-500">
          {entries.length} project{entries.length === 1 ? '' : 's'} need{entries.length === 1 ? 's' : ''} a decision
        </span>
      </h2>
      <div className="space-y-2">
        {entries.slice(0, 3).map(entry => (
          <NextActionCard
            key={entry.batch.id}
            projectName={entry.status.projectName}
            action={entry.status.nextAction}
            projectPath={projectRoutePath(entry.batch)}
            onNavigate={() => onOpen(entry)}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectTable({ entries, onOpen }: {
  entries: ProjectStatusListEntry[];
  onOpen: (entry: ProjectStatusListEntry) => void;
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
            <th className="px-3 py-2 font-semibold sr-only">Next action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map(entry => {
            const { batch, status } = entry;
            return (
              <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 font-bold text-slate-900">
                  <Link to={projectRoutePath(batch)} onClick={() => onOpen(entry)} className="transition-colors hover:text-slate-900">
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
                  <Link
                    to={status.nextAction.path}
                    onClick={() => onOpen(entry)}
                    title={status.nextAction.label}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors hover:opacity-90 ${toneSolidClasses(status.nextAction.tone)}`}
                  >
                    Go <ArrowRight className="size-3" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActiveProjects() {
  const { setSelection } = useFoodType();
  const projects = useProjectStatusList();

  if (projects.length === 0) {
    return (
      <div>
        <ProjectSectionHeader count={0} />
        <ActiveProjectsEmptyState />
      </div>
    );
  }

  const open = (entry: ProjectStatusListEntry) =>
    setSelection(entry.batch.foodTypeSlug, encodeBatchSelection(entry.batch.id));

  // Needs-attention projects first, then most recently imported.
  const sorted = [...projects].sort((a, b) => {
    const attention = Number(needsHumanAttention(b)) - Number(needsHumanAttention(a));
    if (attention !== 0) return attention;
    return new Date(b.batch.createdAt).getTime() - new Date(a.batch.createdAt).getTime();
  });
  const attention = sorted.filter(needsHumanAttention);

  return (
    <div className="space-y-5">
      <ProjectSectionHeader count={projects.length} />
      <AttentionRail entries={attention} onOpen={open} />
      {sorted.length > 8 ? (
        <ProjectTable entries={sorted} onOpen={open} />
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          {sorted.map(entry => (
            <ProjectCard
              key={entry.batch.id}
              projectId={entry.batch.id}
              realProjectId={entry.batch.projectId}
              status={entry.status}
              projectPath={projectRoutePath(entry.batch)}
              onOpen={() => open(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectSectionHeader({ count }: { count: number }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-lg font-bold text-slate-900">Live projects</h2>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <span className={`size-2 rounded-full ${count > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden />
        {count} live
      </span>
    </div>
  );
}

function ActiveProjectsEmptyState() {
  return (
    <StageEmptyState
      icon={FolderKanban}
      headline="No live projects yet"
      body="Name a project and upload an instrumental CSV to begin the workflow."
      cta={{ label: 'New project', to: '/stage1?new=project' }}
    />
  );
}

export function OverviewDashboard() {
  const { data: workspaceSettings } = useWorkspaceSettings();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
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
        <Link
          to="/stage1?new=project"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
        >
          <Plus className="size-3.5" aria-hidden /> New project
        </Link>
      </div>

      {/* Active projects — the action-oriented home view */}
      <ActiveProjects />

    </div>
  );
}
