import { Card, CardContent } from "./ui/card";
import { Link } from "react-router";
import {
  FlaskConical, BarChart3, GitMerge, Settings,
  Lightbulb, ChevronRight, Users, TrendingUp,
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

export function OverviewDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">NFI Platform</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sensory evaluation, consumer research, and concept testing — from R&D to market.
        </p>
      </div>

      {/* Two tracks */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
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
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
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
          <h2 className="text-lg font-bold text-slate-900">Modules</h2>
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
