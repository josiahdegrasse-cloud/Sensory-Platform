import { Card, CardContent } from "./ui/card";
import { Link } from "react-router";
import { FlaskConical, Users, BarChart3, GitMerge, ChevronRight } from "lucide-react";
import { QualityStandardsCard } from "./quality-standards-card";
import { JargonTooltip } from "./jargon-tooltip";
import { useAuth } from "../contexts/auth-context";

export function OverviewDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">ISSF Evaluation Dashboard</h1>
        <p className="text-slate-600 mt-2">
          <JargonTooltip term="ISSF">Integrated Sensory Screening Framework</JargonTooltip> - 
          Fast GO/TWEAK/STOP decisions for plant-based cheese prototypes
        </p>
        <p className="text-sm text-emerald-700 mt-1 font-medium">
          ✓ <JargonTooltip term="Semi-trained Panel">Mixed Panel Approach</JargonTooltip>: 
          Semi-trained panelists + <JargonTooltip term="E-Tongue">E-Tongue</JargonTooltip> + 
          <JargonTooltip term="GC-MS"> GC-O</JargonTooltip> | 94% agreement (n=127) | r = 0.91
        </p>
      </div>

      {/* Quality Standards Reference */}
      <QualityStandardsCard compact={true} />

      {/* Workflow Steps */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">4-Step Evaluation Process</h2>
        <div className="grid grid-cols-4 gap-6">
          <Link to="/stage1">
            <Card className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer border-2 border-purple-200">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-purple-100 flex items-center justify-center">
                    <FlaskConical className="size-8 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">Step 1</div>
                    <div className="text-sm text-slate-600 mt-1">Machine Testing</div>
                    <div className="text-xs text-slate-500 mt-1">E-Tongue + GC-O</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/stage2">
            <Card className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer border-2 border-blue-200">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Users className="size-8 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">Step 2</div>
                    <div className="text-sm text-slate-600 mt-1">Panelist Forms</div>
                    <div className="text-xs text-slate-500 mt-1">Data Collection</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/survey-analysis">
            <Card className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer border-2 border-amber-200">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-amber-100 flex items-center justify-center">
                    <BarChart3 className="size-8 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">Step 3</div>
                    <div className="text-sm text-slate-600 mt-1">Analyze Results</div>
                    <div className="text-xs text-slate-500 mt-1">CATA + Hedonic</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/decision">
            <Card className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer border-2 border-emerald-200">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <GitMerge className="size-8 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">Step 4</div>
                    <div className="text-sm text-slate-600 mt-1">Final Decision</div>
                    <div className="text-xs text-slate-500 mt-1">GO/TWEAK/STOP</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Additional Features for Developers/Admins */}
      {(user?.role === 'developer' || user?.role === 'admin') && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">Additional Tools</h2>
          <div className="grid grid-cols-2 gap-6">
            <Link to="/dairy-comparison">
              <Card className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer border-2 border-blue-200">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <ChevronRight className="size-7 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-900">Dairy Comparison</div>
                      <div className="text-sm text-slate-600 mt-1">Compare to benchmarks & get formulation suggestions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin">
              <Card className="hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer border-2 border-purple-200">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Users className="size-7 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-900">Configure Products</div>
                      <div className="text-sm text-slate-600 mt-1">Create products & customize questionnaires</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}

      {/* How It Works */}
      <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-2 border-slate-200">
        <CardContent className="pt-6">
          <h3 className="font-bold text-slate-900 mb-4">How ISSF Works</h3>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-bold text-slate-700 mb-2">What We Measure:</h4>
              <ul className="space-y-1 text-slate-600">
                <li>✓ <strong>E-Tongue:</strong> 9 objective taste dimensions (sourness, umami, saltiness, etc.)</li>
                <li>✓ <strong>GC-Olfactometry:</strong> Chemical compounds + human smell perception</li>
                <li>✓ <strong>CATA Survey:</strong> Flavor attributes from semi-trained panelists</li>
                <li>✓ <strong>Hedonic Scores:</strong> Consumer liking (1-9 scale)</li>
                <li>✓ <strong>Emotions:</strong> Positive vs negative emotional response</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-700 mb-2">Decision Outcomes:</h4>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">GO:</span>
                  <span>Sample meets quality standards - ready for consumer testing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">TWEAK:</span>
                  <span>Promising but needs adjustments - reformulate and re-test</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 font-bold">STOP:</span>
                  <span>Critical defects detected - abandon this formulation</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}