import { Card, CardContent } from "./ui/card";
import { Link } from "react-router";
import {
  FlaskConical, BarChart3, GitMerge, Settings,
  Lightbulb, ChevronRight, FolderKanban, Plus, ArrowRight, FileText,
} from "lucide-react";
import { useFoodType } from "../contexts/food-type-context";
import { useWorkspaceSettings } from "../lib/hooks";
import { useProjectStatusList, type ProjectStatusListEntry } from "../lib/use-project-status";
import { ProjectCard } from "./project-card";
import { NextActionCard } from "./next-action-card";
import { ProjectStatusBadge, toneSolidClasses } from "./project-status-badge";
import { StageEmptyState } from "./stage-empty-state";

interface Module {
  path: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

// Stage tools, identified by icon + label only. Hue is reserved for status
// semantics (GO/TWEAK/STOP, complete/current/blocked), never feature identity.
const MODULES: Module[] = [
  {
    path: "/stage1",
    label: "Machine Testing",
    description: "Objective sensory data via E-Tongue and GC-O instrumentation",
    icon: FlaskConical,
  },
  {
    path: "/admin",
    label: "Configure",
    description: "Create products, customize attributes, and manage your panel",
    icon: Settings,
  },
  {
    path: "/survey-analysis",
    label: "Insights",
    description: "Interpret sensory, instrumental, comparison, and concept evidence",
    icon: BarChart3,
  },
  {
    path: "/decision",
    label: "Final Decision",
    description: "Integrated GO / TWEAK / STOP recommendation engine",
    icon: GitMerge,
  },
  {
    path: "/concept-testing",
    label: "Concept Testing",
    description: "Send product concepts to consumers, with AI-designed surveys and admin approval",
    icon: Lightbulb,
  },
  {
    path: "/reports",
    label: "Reports",
    description: "Review versions, approve deliverables, and download branded PDFs",
    icon: FileText,
  },
];

function ModuleCard({ module }: { module: Module }) {
  const Icon = module.icon;
  return (
    <Link to={module.path} className="block">
      <Card className="h-full border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group bg-white">
        <CardContent className="pt-5 pb-5 flex flex-col gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
            <Icon className="size-5 text-slate-600" aria-hidden />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{module.label}</div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{module.description}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-slate-700 mt-auto pt-1 transition-colors">
            Open <ChevronRight className="size-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

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
        <span className="ml-2 text-xs font-normal text-slate-400">
          {entries.length} project{entries.length === 1 ? '' : 's'} need{entries.length === 1 ? 's' : ''} a decision
        </span>
      </h2>
      <div className="space-y-2">
        {entries.slice(0, 3).map(entry => (
          <NextActionCard
            key={entry.batch.id}
            projectName={entry.status.projectName}
            action={entry.status.nextAction}
            projectPath={`/project/${entry.batch.id}`}
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
          <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-semibold">Project</th>
            <th className="px-3 py-2 font-semibold">Category</th>
            <th className="px-3 py-2 font-semibold">Workflow</th>
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
                  <Link to={`/project/${batch.id}`} onClick={() => onOpen(entry)} className="hover:text-blue-700 transition-colors">
                    {status.projectName}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-500">{status.foodTypeLabel}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    {status.stages.map(stage => (
                      <span
                        key={stage.id}
                        title={`${stage.label}: ${stage.detail}`}
                        className={`size-2 rounded-full ${
                          stage.state === 'complete' ? 'bg-emerald-500'
                          : stage.state === 'current' ? 'bg-blue-600'
                          : stage.state === 'needs-review' ? 'bg-amber-500'
                          : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
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
                <td className="px-3 py-2.5 text-slate-400">{new Date(batch.createdAt).toLocaleDateString()}</td>
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
    setSelection(entry.batch.foodTypeSlug, `batch:${entry.batch.id}`);

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sorted.map(entry => (
            <ProjectCard
              key={entry.batch.id}
              status={entry.status}
              projectPath={`/project/${entry.batch.id}`}
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
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
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
      body="Import an instrumental dataset to start your first project and begin the workflow."
      cta={{ label: 'Import data', to: '/stage1' }}
    />
  );
}

export function OverviewDashboard() {
  const { data: workspaceSettings } = useWorkspaceSettings();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
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
          to="/stage1"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="size-3.5" aria-hidden /> New project
        </Link>
      </div>

      {/* Active projects — the action-oriented home view */}
      <ActiveProjects />

      {/* Module grid — secondary navigation, kept for direct access */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Modules</h2>
          <p className="text-xs text-slate-400">Jump straight to a workflow stage</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {MODULES.map(m => <ModuleCard key={m.path} module={m} />)}
        </div>
      </div>
    </div>
  );
}
