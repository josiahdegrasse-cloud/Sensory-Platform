import { Card, CardContent } from "./ui/card";
import { Link } from "react-router";
import {
  FlaskConical, BarChart3, GitMerge, Settings,
  Lightbulb, ChevronRight, Users, FolderKanban,
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useFoodType } from "../contexts/food-type-context";
import { useProjectStatusList } from "../lib/use-project-status";
import { ProjectCard } from "./project-card";
import { NextActionCard } from "./next-action-card";

interface Module {
  path: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tag?: string;
}

const MODULES: Module[] = [
  {
    path: "/stage1",
    label: "Machine Testing",
    description: "Objective sensory data via E-Tongue and GC-O instrumentation",
    icon: FlaskConical,
    color: "purple",
  },
  {
    path: "/survey-analysis",
    label: "Analyze Results",
    description: "CATA + hedonic scoring analysis across your panelist pool",
    icon: BarChart3,
    color: "amber",
  },
  {
    path: "/decision",
    label: "Final Decision",
    description: "Integrated GO / TWEAK / STOP recommendation engine",
    icon: GitMerge,
    color: "emerald",
  },
  {
    path: "/concept-testing",
    label: "Concept Testing",
    description: "Send product concepts to consumers — AI-designed 20–30 question surveys",
    icon: Lightbulb,
    color: "blue",
    tag: "New",
  },
  {
    path: "/admin",
    label: "Configure",
    description: "Create products, customize attributes, and manage your panel",
    icon: Settings,
    color: "slate",
  },
];

const iconColorMap: Record<string, string> = {
  purple: "bg-purple-600",
  amber:  "bg-amber-600",
  emerald:"bg-emerald-600",
  blue:   "bg-blue-600",
  slate:  "bg-slate-600",
};

function ModuleCard({ module }: { module: Module }) {
  const iconBg = iconColorMap[module.color];
  const Icon = module.icon;

  return (
    <Link to={module.path} className="block">
      <Card className="h-full border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer group bg-white">
        <CardContent className="pt-6 pb-6 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shadow-sm`}>
              <Icon className="size-6 text-white" />
            </div>
            {module.tag && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wide">
                {module.tag}
              </span>
            )}
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">{module.label}</div>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{module.description}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-slate-700 mt-auto pt-2 transition-colors">
            Open <ChevronRight className="size-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ActiveProjects() {
  const { setSelection } = useFoodType();
  const projects = useProjectStatusList();

  if (projects.length === 0) {
    return (
      <ActiveProjectsEmptyState />
    );
  }

  const featured = projects[0];

  return (
    <div className="space-y-4">
      <NextActionCard
        projectName={featured.status.projectName}
        action={featured.status.nextAction}
        onNavigate={() => setSelection(featured.batch.foodTypeSlug, `batch:${featured.batch.id}`)}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {projects.map(({ batch, status }) => (
          <ProjectCard
            key={batch.id}
            status={status}
            onOpen={() => setSelection(batch.foodTypeSlug, `batch:${batch.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function ActiveProjectsEmptyState() {
  return (
    <Card className="border border-dashed border-slate-300 bg-slate-50">
      <CardContent className="py-10 text-center">
        <FolderKanban className="size-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No active projects yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Import an instrumental dataset to start your first project — the journey from raw data to a commercialization decision begins there.
        </p>
        <Link to="/stage1" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900">
          Import data <ChevronRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

export function OverviewDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">NFI Platform</h1>
        <p className="text-sm text-slate-500 mt-1">
          One project, one continuous journey — from raw instrumental data to a commercialization decision.
        </p>
      </div>

      {/* Active projects — the action-oriented home view */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Your projects</h2>
          <p className="text-xs text-slate-400">What's in motion, what needs attention, what to click next</p>
        </div>
        <ActiveProjects />
      </div>

      {/* Module grid — secondary navigation, kept for direct access */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Modules</h2>
          <p className="text-xs text-slate-400">Jump straight to a workflow stage</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {MODULES.map(m => <ModuleCard key={m.path} module={m} />)}
        </div>
      </div>

      {/* Panelist section */}
      {user?.role === 'admin' && (
        <Card className="border border-slate-200 bg-slate-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                <Users className="size-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-900">Panel Capacity</div>
                <p className="text-sm text-slate-500">
                  Send evaluations to up to 100 panelists. Panelists access their questionnaires at <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border">/panelist</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
