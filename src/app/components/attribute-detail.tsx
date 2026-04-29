import { useParams, useNavigate } from "react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { 
  convergenceData, 
  getAttributeContributions, 
  historicalValidation,
  iterationMetrics 
} from "../data/mock-data";
import { ArrowLeft, TrendingUp, AlertTriangle } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function AttributeDetail() {
  const { attributeName } = useParams<{ attributeName: string }>();
  const navigate = useNavigate();

  const attributeData = convergenceData.find(
    (attr) => attr.attribute === attributeName
  );

  if (!attributeData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-medium text-slate-900 mb-2">Attribute not found</h2>
          <Button onClick={() => navigate('/')}>Return to Overview</Button>
        </div>
      </div>
    );
  }

  const contributions = getAttributeContributions(attributeName || '');

  const getContributionColor = (type: string) => {
    switch (type) {
      case 'E-Tongue':
        return '#3b82f6';
      case 'Chemical':
        return '#8b5cf6';
      case 'Panel':
        return '#10b981';
      default:
        return '#94a3b8';
    }
  };

  const getConvergenceColor = (convergence: number) => {
    if (convergence >= 0.85) return 'text-emerald-700';
    if (convergence >= 0.70) return 'text-amber-700';
    return 'text-rose-700';
  };

  const getConvergenceBadge = (convergence: number) => {
    if (convergence >= 0.85) return 'bg-emerald-500/10 text-emerald-700 border-emerald-300';
    if (convergence >= 0.70) return 'bg-amber-500/10 text-amber-700 border-amber-300';
    return 'bg-rose-500/10 text-rose-700 border-rose-300';
  };

  // Prepare contribution chart data
  const contributionChartData = contributions.map((c) => ({
    source: c.source,
    contribution: c.contribution * 100,
    type: c.type,
  }));

  return (
    <TooltipProvider>
      <div className="max-w-[1440px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Overview
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-medium text-slate-900">{attributeName}</h1>
              <p className="text-slate-500 mt-1">Detailed convergence analysis and contribution breakdown</p>
            </div>
            <Badge 
              variant="outline" 
              className={`px-4 py-2 text-sm ${getConvergenceBadge(attributeData.convergence)}`}
            >
              Convergence: {(attributeData.convergence * 100).toFixed(0)}%
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Predicted Values & Intervals */}
          <div className="col-span-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Intensity Prediction</CardTitle>
                <p className="text-sm text-slate-500">With confidence intervals</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">E-Tongue (TS-5000Z)</div>
                    <div className="text-3xl font-medium text-blue-700">
                      {attributeData.eTongue.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">mV units</div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-1">Panel (Predicted)</div>
                    <div className="text-3xl font-medium text-green-700">
                      {attributeData.panelPredicted.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">1-9 intensity scale</div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-1">Dairy Benchmark</div>
                    <div className="text-3xl font-medium text-slate-600">
                      {attributeData.dairyBenchmark.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Reference standard</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Correlation (r)</span>
                    <span className="font-medium">{attributeData.correlationR.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Deviation from benchmark</span>
                    <span className={`font-medium ${attributeData.deviation > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {attributeData.deviation > 0 ? '+' : ''}{attributeData.deviation.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Convergence status</span>
                    <span className={`font-medium ${getConvergenceColor(attributeData.convergence)}`}>
                      {attributeData.convergence >= 0.85 ? 'High' : attributeData.convergence >= 0.70 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>

                {Math.abs(attributeData.deviation) > 1.0 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                    <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>High deviation flagged:</strong> Consider trained panel validation for this attribute.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Contribution Breakdown */}
          <div className="col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contribution Breakdown</CardTitle>
                <p className="text-sm text-slate-500">
                  Multi-stream contribution to {attributeName} prediction
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={contributionChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} unit="%" />
                    <YAxis dataKey="source" type="category" width={180} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                    />
                    <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                      {contributionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getContributionColor(entry.type)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  {contributions.map((c, idx) => (
                    <div key={idx} className="p-3 border border-slate-200 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-3 h-3 rounded" 
                          style={{ backgroundColor: getContributionColor(c.type) }}
                        />
                        <div className="text-xs font-medium text-slate-700">{c.type}</div>
                      </div>
                      <div className="text-sm font-medium mb-1">{c.source}</div>
                      <div className="text-lg font-medium text-slate-900">
                        {(c.contribution * 100).toFixed(1)}%
                      </div>
                      {c.note && (
                        <div className="text-xs text-slate-500 mt-2">{c.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Historical ISSF Validation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5" />
                  Historical ISSF Accuracy
                </CardTitle>
                <p className="text-sm text-slate-500">
                  ISSF predictions vs. trained panel benchmarks (n=10 PBCA samples)
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      dataKey="issfPredicted" 
                      name="ISSF Predicted"
                      domain={[0, 5]}
                      label={{ value: 'ISSF Predicted', position: 'insideBottom', offset: -5, fontSize: 12 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="trainedPanel" 
                      name="Trained Panel"
                      domain={[0, 5]}
                      label={{ value: 'Trained Panel (Gold Standard)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                    />
                    <ZAxis range={[60, 60]} />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => value.toFixed(2)}
                    />
                    <ReferenceLine 
                      segment={[{ x: 0, y: 0 }, { x: 5, y: 5 }]} 
                      stroke="#94a3b8" 
                      strokeDasharray="5 5"
                      label={{ value: 'Perfect alignment', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }}
                    />
                    <Scatter 
                      name="PBCA Samples" 
                      data={historicalValidation} 
                      fill="#3b82f6"
                      fillOpacity={0.6}
                    />
                  </ScatterChart>
                </ResponsiveContainer>

                <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600">
                  <strong>Interpretation:</strong> Points closer to the diagonal dashed line indicate higher ISSF accuracy. 
                  Mean absolute error (MAE) across 10 PBCA samples: <span className="font-mono font-medium text-slate-900">0.17</span> units. 
                  This demonstrates ISSF screening-level reliability.
                </div>
              </CardContent>
            </Card>

            {/* Iterative Improvements */}
            <Card>
              <CardHeader>
                <CardTitle>Iterative Protocol Improvements</CardTitle>
                <p className="text-sm text-slate-500">
                  Convergence improvement across 3 cycles
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={iterationMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="cycle" />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="consistency" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Data Consistency"
                      dot={{ r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="convergence" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Convergence"
                      dot={{ r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="vocabularyAlignment" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      name="Vocabulary Alignment"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2 bg-blue-50 rounded border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-0.5 bg-blue-600 rounded" />
                      <span className="font-medium text-blue-900">Consistency</span>
                    </div>
                    <div className="text-blue-700">72% → 91% (+19%)</div>
                  </div>
                  <div className="p-2 bg-green-50 rounded border border-green-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-0.5 bg-green-600 rounded" />
                      <span className="font-medium text-green-900">Convergence</span>
                    </div>
                    <div className="text-green-700">78% → 87% (+9%)</div>
                  </div>
                  <div className="p-2 bg-purple-50 rounded border border-purple-100">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-0.5 bg-purple-600 rounded" />
                      <span className="font-medium text-purple-900">Vocabulary</span>
                    </div>
                    <div className="text-purple-700">68% → 87% (+19%)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
