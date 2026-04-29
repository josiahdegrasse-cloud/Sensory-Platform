import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Slider } from "./ui/slider";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

// Correlation matrix data
const correlationMatrix = [
  { instrumental: 'E-Tongue Sourness', sensory: 'Panel Sourness', r: 0.94, p: 0.001, significant: true, strength: 'Very Strong' },
  { instrumental: 'E-Tongue Bitterness', sensory: 'Panel Bitterness', r: 0.81, p: 0.008, significant: true, strength: 'Strong' },
  { instrumental: 'E-Tongue Umami', sensory: 'Panel Umami', r: 0.92, p: 0.002, significant: true, strength: 'Very Strong' },
  { instrumental: 'Salt Content', sensory: 'Panel Saltiness', r: 0.95, p: 0.001, significant: true, strength: 'Very Strong' },
  { instrumental: 'Fat Content', sensory: 'Panel Creaminess', r: 0.89, p: 0.004, significant: true, strength: 'Strong' },
  { instrumental: 'Protein + Yeast', sensory: 'Panel Cheesyness', r: 0.88, p: 0.005, significant: true, strength: 'Strong' },
];

export function ValidationLogic() {
  const [threshold, setThreshold] = useState([85]);

  const currentConvergence = 85; // From the data
  
  const getStatus = (conv: number, thresh: number) => {
    if (conv >= thresh) return 'sufficient';
    if (conv >= 70) return 'targeted';
    return 'borderline';
  };

  const status = getStatus(currentConvergence, threshold[0]);

  const getCorrelationColor = (r: number) => {
    const absR = Math.abs(r);
    if (absR >= 0.9) return 'bg-emerald-600 text-white';
    if (absR >= 0.8) return 'bg-emerald-500 text-white';
    if (absR >= 0.7) return 'bg-yellow-500 text-slate-900';
    if (absR >= 0.5) return 'bg-orange-400 text-white';
    return 'bg-slate-300 text-slate-800';
  };

  return (
    <TooltipProvider>
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-medium text-slate-900">Validation Logic</h1>
          <p className="text-slate-500 mt-1">
            Adjust threshold and view statistical correlations
          </p>
        </div>

        <div className="space-y-6">
          {/* Threshold Configuration */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
              <CardTitle className="text-xl">Threshold Configuration</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Adjust convergence threshold to see impact on substitution decision
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Convergence Threshold
                      </label>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300 font-bold text-base px-3 py-1">
                        {threshold[0]}%
                      </Badge>
                    </div>
                    <Slider
                      value={threshold}
                      onValueChange={setThreshold}
                      min={70}
                      max={95}
                      step={1}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>70% (Minimum)</span>
                      <span>95% (Maximum)</span>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Current Product Convergence:</span>
                        <span className="font-bold text-slate-900">{currentConvergence}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Your Threshold:</span>
                        <span className="font-bold text-slate-900">{threshold[0]}%</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-300">
                        <span className="text-slate-700 font-medium">Substitution Status:</span>
                        {status === 'sufficient' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-bold">
                            ✓ ISSF Sufficient
                          </Badge>
                        ) : status === 'targeted' ? (
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 font-bold">
                            ⚠ Targeted Improvement
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 font-bold">
                            ↻ Borderline - Retest
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-xl border-2 ${
                  status === 'sufficient' ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-300' :
                  status === 'targeted' ? 'bg-gradient-to-br from-amber-50 to-white border-amber-300' :
                  'bg-gradient-to-br from-rose-50 to-white border-rose-300'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    {status === 'sufficient' ? (
                      <CheckCircle2 className="size-8 text-emerald-600" />
                    ) : status === 'targeted' ? (
                      <AlertCircle className="size-8 text-amber-600" />
                    ) : (
                      <XCircle className="size-8 text-rose-600" />
                    )}
                    <div>
                      <h3 className={`font-semibold text-lg ${
                        status === 'sufficient' ? 'text-emerald-900' :
                        status === 'targeted' ? 'text-amber-900' :
                        'text-rose-900'
                      }`}>
                        {status === 'sufficient' ? 'ISSF Method Sufficient' :
                         status === 'targeted' ? 'Targeted Improvements' :
                         'Borderline - Needs Refinement'}
                      </h3>
                      <p className={`text-sm ${
                        status === 'sufficient' ? 'text-emerald-700' :
                        status === 'targeted' ? 'text-amber-700' :
                        'text-rose-700'
                      }`}>
                        {status === 'sufficient' ? 'Mixed panel methodology delivers reliable results' :
                         status === 'targeted' ? 'Some attributes need attention - retest after improvement' :
                         'Product below quality threshold - reformulate & re-evaluate'}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm text-slate-700 space-y-2">
                    {status === 'sufficient' && (
                      <>
                        <p>• Average convergence: {currentConvergence}%</p>
                        <p>• Critical attributes above 89%</p>
                        <p>• Mean absolute error: 0.26 units</p>
                      </>
                    )}
                    {status === 'targeted' && (
                      <>
                        <p>• Average convergence: {currentConvergence}% (borderline)</p>
                        <p>• Some attributes below 85% threshold</p>
                        <p>• Consider hybrid approach</p>
                      </>
                    )}
                    {status === 'borderline' && (
                      <>
                        <p>• Average convergence: {currentConvergence}% (below threshold)</p>
                        <p>• Reformulate and re-test with ISSF</p>
                        <p>• Mixed panel approach remains valid</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistical Transparency */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-slate-50 border-b border-slate-200">
              <CardTitle className="text-xl flex items-center gap-2">
                Statistical Correlations
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex">
                      <Info className="size-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Correlation matrix showing relationship strength between instrumental measurements and sensory panel responses
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Instrumental → Panel attribute correlations
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Instrumental Variable</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Sensory Variable</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">r-value</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">p-value</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Strength</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlationMatrix.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-700">{row.instrumental}</td>
                        <td className="py-3 px-4 text-slate-700">{row.sensory}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={`font-mono font-semibold ${getCorrelationColor(row.r)}`}>
                            {row.r.toFixed(3)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-xs text-slate-600">
                          {row.p.toFixed(3)}
                          {row.significant && <span className="text-emerald-600 ml-1">*</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className={
                            row.strength === 'Very Strong' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                            row.strength === 'Strong' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                            'bg-slate-50 text-slate-700 border-slate-300'
                          }>
                            {row.strength}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-blue-900">Model Type</div>
                    <div className="text-blue-700">Partial Least Squares Regression (PLSR)</div>
                  </div>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-purple-900">Validation</div>
                    <div className="text-purple-700">Leave-one-out cross-validation (n=10)</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border border-slate-200">
                <div className="flex items-start gap-3 text-sm">
                  <Info className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-slate-700">
                    <strong className="text-slate-900">Note:</strong> Correlations marked with * are statistically significant (p &lt; 0.05). 
                    Very strong correlations (r ≥ 0.90) indicate high predictive reliability for screening decisions.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}