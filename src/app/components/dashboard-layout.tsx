import { Outlet, Link, useLocation } from "react-router";
import { Badge } from "./ui/badge";
import { productMetadata } from "../data/mock-data";
import { 
  LayoutDashboard, 
  Settings,
  DollarSign, 
  AlertCircle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function DashboardLayout() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Convergence Dashboard", icon: LayoutDashboard },
    { path: "/validation", label: "Validation Logic", icon: Settings },
    { path: "/cost", label: "Cost Impact", icon: DollarSign },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">ISSF-Lite Validation Prototype</h1>
              <p className="text-sm text-slate-500 mt-0.5">Integrated Sensory Substitution Framework – Cheese Screening</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-medium">
                Overall Convergence: 85%
              </Badge>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-medium">
                🟢 ISSF Sufficient
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Sub Navigation */}
      <nav className="border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-[1600px] mx-auto px-8">
          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all relative
                    ${active 
                      ? 'text-blue-700 bg-blue-50/50' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }
                  `}
                >
                  <Icon className="size-4" />
                  {item.label}
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-[1600px] mx-auto px-8 py-8">
        <Outlet />
      </main>

      {/* Footer with Uncertainty Notice */}
      <footer className="border-t border-slate-200 bg-white px-8 py-6 mt-12">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-start gap-3 text-sm text-slate-600">
            <AlertCircle className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-slate-900">Validation Framework Notice:</strong> ISSF-Lite provides screening-level substitution validation, not full sensory replacement. 
              Predictions are model-based (PLSR) with inherent uncertainty. All metrics include confidence intervals and error margins for transparency. 
              Substitution eligibility is determined by convergence thresholds (≥85% recommended). This tool supports early-stage R&D screening decisions—final validation may require trained sensory panels.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}