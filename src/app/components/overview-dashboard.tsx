import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Link } from "react-router";
import {
  FlaskConical, BarChart3, GitMerge, Settings,
  Lightbulb, Lock, ChevronRight, Users, TrendingUp,
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";

interface Module {
  path: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tier: 'basic' | 'pro' | 'both';
  locked?: boolean;
  tag?: string;
}

const MODULES: Module[] = [
  {
    path: "/stage1",
    label: "Machine Testing",
    description: "Objective sensory data via E-Tongue and GC-O instrumentation",
    icon: FlaskConical,
    color: "purple",
    tier: "both",
  },
  {
    path: "/survey-analysis",
    label: "Analyze Results",
    description: "CATA + hedonic scoring analysis across your panelist pool",
    icon: BarChart3,
    color: "amber",
    tier: "both",
  },
  {
    path: "/decision",
    label: "Final Decision",
    description: "Integrated GO / TWEAK / STOP recommendation engine",
    icon: GitMerge,
    color: "emerald",
    tier: "both",
  },
  {
    path: "/concept-testing",
    label: "Concept Testing",
    description: "Send product concepts to consumers — AI-designed 20–30 question surveys",
    icon: Lightbulb,
    color: "blue",
    tier: "pro",
    tag: "New",
  },
  {
    path: "/admin",
    label: "Configure Products",
    description: "Create products, customize attributes, and manage your panel",
    icon: Settings,
    color: "slate",
    tier: "both",
  },
];

const colorMap: Record<string, { bg: string; icon: string; border: string; badge: string }> = {
  purple: { bg: "bg-purple-50", icon: "bg-purple-600", border: "border-purple-200", badge: "text-purple-700 bg-purple-100" },
  amber:  { bg: "bg-amber-50",  icon: "bg-amber-600",  border: "border-amber-200",  badge: "text-amber-700 bg-amber-100"  },
  emerald:{ bg: "bg-emerald-50",icon: "bg-emerald-600",border: "border-emerald-200",badge: "text-emerald-700 bg-emerald-100"},
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-600",   border: "border-blue-200",   badge: "text-blue-700 bg-blue-100"   },
  slate:  { bg: "bg-slate-50",  icon: "bg-slate-600",  border: "border-slate-200",  badge: "text-slate-700 bg-slate-100" },
};

function ModuleCard({ module }: { module: Module }) {
  const c = colorMap[module.color];
  const Icon = module.icon;

  const inner = (
    <Card className={`h-full border-2 ${c.border} hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group`}>
      <CardContent className="pt-6 pb-6 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-xl ${c.icon} flex items-center justify-center shadow-sm`}>
            <Icon className="size-6 text-white" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {module.tag && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wide">
                {module.tag}
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
              module.tier === 'pro' ? 'bg-slate-900 text-white' : `${c.badge}`
            }`}>
              {module.tier === 'pro' ? 'Pro' : 'Basic+Pro'}
            </span>
          </div>
        </div>
        <div>
          <div className="text-base font-bold text-slate-900">{module.label}</div>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">{module.description}</p>
        </div>
        {module.locked ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-auto pt-2">
            <Lock className="size-3.5" />
            Upgrade to unlock
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-slate-700 mt-auto pt-2 transition-colors">
            Open <ChevronRight className="size-3.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (module.locked) return <div className="opacity-60 cursor-not-allowed">{inner}</div>;
  return <Link to={module.path} className="block">{inner}</Link>;
}

export function OverviewDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900">NFI Platform</h1>
        <p className="text-slate-500 mt-1.5 text-base">
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Modules</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-bold">Pro</span>
            unlocks all modules
          </div>
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
