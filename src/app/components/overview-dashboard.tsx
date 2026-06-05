import { Card, CardContent } from "./ui/card";
import { Link } from "react-router";
import {
  FlaskConical, BarChart3, GitMerge, Settings,
  Lightbulb, ChevronRight, Users, TrendingUp,
  FolderKanban, Sparkles,
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";

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
    label: "Configure Products",
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
      <Card className="h-full border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer group bg-white">
        <CardContent className="pt-5 pb-5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shadow-sm`}>
              <Icon className="size-5 text-white" />
            </div>
            {module.tag && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
                {module.tag}
              </span>
            )}
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">{module.label}</div>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{module.description}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-slate-800 mt-auto pt-2 transition-colors">
            Open <ChevronRight className="size-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function OverviewDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto space-y-7">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 px-7 py-7 shadow-sm">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute right-8 top-8 h-36 w-36 rounded-full border border-white/10" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70">
              <Sparkles className="size-3.5" />
              NFI sensory workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Build food evidence into panel-ready decisions.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
              Import machine testing, organize projects by food type, assign surveys, and turn response data into product direction.
            </p>
          </div>
          <div className="hidden shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-4 text-white/75 md:block">
            <FolderKanban className="mb-3 size-6" />
            <div className="text-sm font-semibold text-white">Project flow</div>
            <div className="mt-1 text-xs text-white/48">Food type, import, sample, survey</div>
          </div>
        </div>
      </div>

      {/* Two tracks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border border-emerald-200 bg-emerald-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
                <FlaskConical className="size-4 text-white" />
              </div>
              <div className="font-bold text-slate-900">R&D Track</div>
            </div>
            <p className="text-sm text-slate-600">
              Objective scoring, machine testing, and GO/TWEAK/STOP decisions for your formulation team.
            </p>
          </CardContent>
        </Card>
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                <TrendingUp className="size-4 text-white" />
              </div>
              <div className="font-bold text-slate-900">Marketing Track</div>
            </div>
            <p className="text-sm text-slate-600">
              Concept testing, consumer preference analysis, and innovation validation before launch.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module grid */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Start a workflow</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
