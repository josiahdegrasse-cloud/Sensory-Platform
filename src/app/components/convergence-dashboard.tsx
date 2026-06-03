import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { ChevronRight, Info, AlertCircle, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { 
  convergenceData, 
  calculateScreeningRiskScore, 
  checkEscalationTriggers,
  detectScreeningRisks,
  type ConvergenceAttribute 
} from "../data/convergence-data";

export function ConvergenceDashboard() {
  const navigate = useNavigate();
  const [selectedAttribute, setSelectedAttribute] = useState<ConvergenceAttribute | null>(null);

  // Calculate Screening Risk Score (higher = lower risk = escalation not needed)
  const screeningRiskScore = calculateScreeningRiskScore(convergenceData);
  
  // Check escalation triggers
  const escalationCheck = checkEscalationTriggers(convergenceData, 0.85);
  
  // Detect screening risks
  const screeningRisks = detectScreeningRisks(convergenceData);

  // Prepare scatter plot data
  const scatterData = convergenceData.map(attr => ({
    name: attr.attribute,
    instrumental: attr.instrumental,
    semiTrainedPanel: attr.semiTrainedPanel,
    escalationTrigger: attr.escalationTrigger,
    screeningAlignment: attr.screeningAlignment,
  }));

  // Determine escalation status based on trigger logic
  const escalationStatus = escalationCheck.escalationRequired ? 'required' : 'not-required';

  const getStatusColor = () => {
    if (escalationStatus === 'not-required') return 'text-emerald-700';
    return 'text-rose-700';
  };

  const getStatusBorder = () => {
    if (escalationStatus === 'not-required') return 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white';
    return 'border-rose-300 bg-gradient-to-br from-rose-50 to-white';
  };

  const getStatusBg = () => {
    if (escalationStatus === 'not-required') return 'bg-emerald-100';
    return 'bg-rose-100';
  };

  const getStatusIcon = () => {
    if (escalationStatus === 'not-required') return <CheckCircle2 className="size-7 text-emerald-600" />;
    return <XCircle className="size-7 text-rose-600" />;
  };

  const getStatusTitle = () => {
    if (escalationStatus === 'not-required') return 'text-emerald-900';
    return 'text-rose-900';
  };

  const getStatusText = () => {
    if (escalationStatus === 'not-required') return 'Screening Sufficient';
    return 'Escalation Required';
  };

  const getStatusDescription = () => {
    if (escalationStatus === 'not-required') {
      return 'All escalation-trigger attributes show acceptable screening alignment (≥85%). Hybrid screening (instrumental + semi-trained panel) is sufficient for early-stage validation.';
    }
    return 'One or more escalation-trigger attributes below threshold. Full trained panel escalation recommended to manage sensory risk.';
  };

  const getAlignmentBadge = (alignment: number) => {
    if (alignment >= 0.85) return 'bg-emerald-500/10 text-emerald-700 border-emerald-300';
    if (alignment >= 0.70) return 'bg-amber-500/10 text-amber-700 border-amber-300';
    return 'bg-rose-500/10 text-rose-700 border-rose-300';
  };

  const escalationTriggerAttrs = convergenceData.filter(attr => attr.escalationTrigger);
  const nonTriggerAttrs = convergenceData.filter(attr => !attr.escalationTrigger);

  return (
    <TooltipProvider>
    <div className="max-w-[1440px] mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-medium text-slate-900 mb-2">Hybrid Screening Escalation Dashboard</h1>
        <p className="text-slate-600">
          ISSF Decision Engine: Instrumental + Semi-Trained Panel Checkpoint → Full Trained Panel Escalation Logic
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Panel - Screening Alignment Scatter Plot */}
        <div className="col-span-8">
          <Card className="shadow-md border-slate-200 h-full flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Screening Agreement Analysis</CardTitle>
              <p className="text-sm text-slate-500 mt-1.5">
                Instrumental vs Semi-Trained Panel Ratings • 9 screening attributes • Diagonal = perfect agreement
              </p>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col">
              <ResponsiveContainer width="100%" height={420}>
                <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    type="number" 
                    dataKey="instrumental" 
                    domain={[0, 6]}
                    tick={{ fill: '#475569', fontSize: 12 }}
                    label={{ value: 'Instrumental Prediction', position: 'insideBottom', offset: -10, style: { fill: '#475569', fontWeight: 600 } }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="semiTrainedPanel" 
                    domain={[0, 6]}
                    tick={{ fill: '#475569', fontSize: 12 }}
                    label={{ value: 'Semi-Trained Panel Rating', angle: -90, position: 'insideLeft', style: { fill: '#475569', fontWeight: 600 } }}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border-2 border-slate-200 rounded-lg shadow-lg">
                            <div className="font-semibold text-slate-900 mb-1">{data.name}</div>
                            <div className="text-sm text-slate-600 space-y-0.5">
                              <div>Instrumental: {data.instrumental.toFixed(2)}</div>
                              <div>Semi-Trained Panel: {data.semiTrainedPanel.toFixed(2)}</div>
                              <div className="font-semibold pt-1 border-t border-slate-200 mt-1">
                                Screening Alignment: {(data.screeningAlignment * 100).toFixed(0)}%
                              </div>
                              {data.escalationTrigger && (
                                <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 text-xs mt-1">
                                  Escalation Trigger
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Perfect agreement diagonal line */}
                  <ReferenceLine 
                    segment={[{ x: 0, y: 0 }, { x: 6, y: 6 }]} 
                    stroke="#94a3b8" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{ value: 'Perfect Agreement', position: 'insideTopRight', fill: '#64748b', fontSize: 11 }}
                  />
                  <Scatter data={scatterData} fill="#3b82f6">
                    {scatterData.map((entry, index) => {
                      // Escalation trigger attributes in blue, non-triggers in gray
                      const color = entry.escalationTrigger ? '#3b82f6' : '#94a3b8';
                      // Larger circles for escalation triggers
                      const radius = entry.escalationTrigger ? 8 : 6;
                      return <Cell key={`cell-${index}`} fill={color} r={radius} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm font-semibold text-blue-900">Escalation Triggers</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{escalationTriggerAttrs.length}</div>
                  <div className="text-xs text-blue-700 mt-1">Must meet ≥85% alignment</div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">Non-Triggers</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{nonTriggerAttrs.length}</div>
                  <div className="text-xs text-slate-700 mt-1">Supporting attributes</div>
                </div>
              </div>

              <div className="mt-6 p-5 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-200">
                <div className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                  <Info className="size-5 flex-shrink-0 mt-0.5 text-blue-600" />
                  <div>
                    <strong className="text-slate-900">Hybrid Screening Model:</strong> This framework combines instrumental measurements with semi-trained panel checkpoints (Layer 1 + Layer 2) to determine when full trained panel escalation (Layer 3) is necessary. Points closer to the diagonal indicate better screening agreement. Escalation triggers (blue) require high alignment to avoid expensive trained panel validation.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Escalation Status & Risk Assessment */}
        <div className="col-span-4 space-y-6">
          {/* Escalation Decision Status */}
          <Card className={`shadow-lg border-2 ${getStatusBorder()}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5 mb-1">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm ${getStatusBg()}`}>
                  {getStatusIcon()}
                </div>
                <div>
                  <CardTitle className={`text-lg ${getStatusTitle()}`}>
                    Escalation Status
                  </CardTitle>
                  <p className={`text-xs mt-0.5 font-medium ${getStatusColor()}`}>
                    {getStatusText()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-4 p-4 bg-white border-2 border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-900">Screening Risk Score</span>
                  <UITooltip>
                    <TooltipTrigger>
                      <Info className="size-4 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Weighted risk assessment: 50% escalation-trigger alignment + 30% rank agreement + 20% instrumental reliability. Higher score = lower risk = escalation not needed.
                      </p>
                    </TooltipContent>
                  </UITooltip>
                </div>
                <div className="text-4xl font-bold text-slate-900 mb-3">{(screeningRiskScore * 100).toFixed(0)}%</div>
                <Progress 
                  value={screeningRiskScore * 100} 
                  className="h-3 mb-3" 
                />
                <p className="text-xs text-slate-700 leading-relaxed">
                  {getStatusDescription()}
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold text-sm py-4"
                onClick={() => navigate('/validation')}
              >
                View Escalation Logic
                <ChevronRight className="size-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Risk Assessment Summary */}
          <Card className="shadow-md border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-600" />
                Risk Assessment
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Screening gaps & escalation triggers
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Escalation Triggers */}
              <div>
                <div className="text-sm font-semibold text-slate-900 mb-2">Escalation Triggers</div>
                {escalationCheck.triggers.length === 0 ? (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-emerald-800">
                      All {escalationTriggerAttrs.length} escalation-trigger attributes meet threshold (≥85%)
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {escalationCheck.triggers.map((attr, idx) => (
                      <div key={idx} className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-rose-900">{attr.attribute}</span>
                          <Badge className="bg-rose-500/10 text-rose-700 border-rose-300 text-xs">
                            {(attr.screeningAlignment * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="text-xs text-rose-700 mt-1">Below alignment threshold</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Screening Risks */}
              {screeningRisks.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">Detected Risks</div>
                  <div className="space-y-1.5">
                    {screeningRisks.slice(0, 4).map((risk, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <AlertCircle className="size-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>{risk}</span>
                      </div>
                    ))}
                    {screeningRisks.length > 4 && (
                      <div className="text-xs text-slate-500 italic mt-2">
                        +{screeningRisks.length - 4} more risks detected
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Screening Metrics */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-sm font-semibold text-slate-900 mb-3">Screening Metrics</div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600">Avg Rank Agreement</span>
                    <span className="text-sm font-mono font-bold text-slate-900">
                      {(convergenceData.reduce((sum, attr) => sum + attr.rankAgreement, 0) / convergenceData.length).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600">Mean MAE</span>
                    <span className="text-sm font-mono font-bold text-slate-900">
                      {(convergenceData.reduce((sum, attr) => sum + attr.mae, 0) / convergenceData.length).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600">Instrumental Repeatability (σ)</span>
                    <span className="text-sm font-mono font-bold text-slate-900">
                      {(convergenceData.reduce((sum, attr) => sum + attr.instrumentalRepeatability, 0) / convergenceData.length).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section - Attribute Detail Table */}
        <div className="col-span-12">
          <Card className="shadow-md border-slate-200">
            <CardHeader>
              <div>
                <CardTitle className="text-xl">Screening Attribute Performance</CardTitle>
                <p className="text-sm text-slate-500 mt-1.5">
                  Per-attribute screening alignment, model consistency, and escalation trigger classification
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Attribute</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Escalation Trigger</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs">Source</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">r-value</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">MAE</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">RMSE</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Repeatability (σ)</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Alignment</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Escalation Trigger Attributes First */}
                    {escalationTriggerAttrs.map((attr, idx) => (
                      <tr 
                        key={idx} 
                        className="border-b border-slate-200 hover:bg-blue-50/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedAttribute(attr)}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900">{attr.attribute}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 text-xs font-bold">
                            Trigger
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{attr.source}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-900">{attr.correlationR.toFixed(3)}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-900">{attr.mae.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-900">{attr.rmse.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-900">{attr.instrumentalRepeatability.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge 
                            variant="outline" 
                            className={`font-semibold ${getAlignmentBadge(attr.screeningAlignment)}`}
                          >
                            {(attr.screeningAlignment * 100).toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {attr.screeningAlignment >= 0.85 ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-semibold">
                              Pass
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/10 text-rose-700 border-rose-300 font-semibold">
                              Trigger Escalation
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Non-Trigger Attributes */}
                    {nonTriggerAttrs.map((attr, idx) => (
                      <tr 
                        key={idx} 
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedAttribute(attr)}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900">{attr.attribute}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-300 text-xs">
                            Non-trigger
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{attr.source}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-900">{attr.correlationR.toFixed(3)}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-900">{attr.mae.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-900">{attr.rmse.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-900">{attr.instrumentalRepeatability.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge 
                            variant="outline" 
                            className={`font-semibold ${getAlignmentBadge(attr.screeningAlignment)}`}
                          >
                            {(attr.screeningAlignment * 100).toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {attr.screeningAlignment >= 0.85 ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-semibold">
                              Good
                            </Badge>
                          ) : attr.screeningAlignment >= 0.70 ? (
                            <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 font-semibold">
                              Moderate
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/10 text-rose-700 border-rose-300 font-semibold">
                              ✗ Weak
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-slate-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3 text-sm">
                  <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-slate-700">
                    <strong className="text-slate-900">Escalation Framework:</strong> Full trained panel escalation is required if ANY escalation-trigger attribute shows screening alignment &lt;85%. Escalation triggers are attributes critical for regulatory compliance, off-note detection, and product identity. Non-trigger attributes support overall quality assessment but do not mandate escalation. MAE measures agreement error between instrumental and semi-trained panel. Repeatability (σ) measures instrumental measurement stability.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Attribute Detail Dialog - Risk Focused */}
      <Dialog open={!!selectedAttribute} onOpenChange={(open) => !open && setSelectedAttribute(null)}>
        <DialogContent className="max-w-3xl">
          {selectedAttribute && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl">{selectedAttribute.attribute}</DialogTitle>
                  {selectedAttribute.escalationTrigger && (
                    <Badge className="bg-blue-500/10 text-blue-700 border-blue-300">
                      Escalation Trigger
                    </Badge>
                  )}
                </div>
                <DialogDescription>
                  {selectedAttribute.category} • {selectedAttribute.source}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                {/* Screening Agreement */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-3">Screening Agreement</div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-slate-600 mb-2">Instrumental Prediction</div>
                      <div className="text-4xl font-bold text-blue-900">{selectedAttribute.instrumental.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-2">Semi-Trained Panel Rating</div>
                      <div className="text-4xl font-bold text-slate-900">{selectedAttribute.semiTrainedPanel.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-300">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Agreement Error (MAE)</span>
                      <span className="font-mono font-bold text-slate-900">
                        {Math.abs(selectedAttribute.instrumental - selectedAttribute.semiTrainedPanel).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Screening Alignment</div>
                    <div className="text-3xl font-bold text-blue-900">{(selectedAttribute.screeningAlignment * 100).toFixed(0)}%</div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-xs text-purple-600 font-semibold mb-1">Model Consistency (r)</div>
                    <div className="text-3xl font-bold text-purple-900">{selectedAttribute.correlationR.toFixed(3)}</div>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="text-xs text-emerald-600 font-semibold mb-1">Rank Agreement</div>
                    <div className="text-3xl font-bold text-emerald-900">{selectedAttribute.rankAgreement}%</div>
                  </div>
                </div>

                {/* Statistical Metrics */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-3">Reliability Metrics</div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-slate-600 text-xs mb-1">MAE (Agreement Error)</div>
                      <div className="font-mono font-bold text-slate-900 text-lg">{selectedAttribute.mae.toFixed(3)}</div>
                      <div className="text-xs text-slate-500 mt-1">Lower is better</div>
                    </div>
                    <div>
                      <div className="text-slate-600 text-xs mb-1">RMSE</div>
                      <div className="font-mono font-bold text-slate-900 text-lg">{selectedAttribute.rmse.toFixed(3)}</div>
                      <div className="text-xs text-slate-500 mt-1">Prediction error</div>
                    </div>
                    <div>
                      <div className="text-slate-600 text-xs mb-1">Repeatability (σ)</div>
                      <div className="font-mono font-bold text-slate-900 text-lg">{selectedAttribute.instrumentalRepeatability.toFixed(3)}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {selectedAttribute.instrumentalRepeatability < 0.20 ? 'Stable' : selectedAttribute.instrumentalRepeatability < 0.30 ? 'Moderate' : 'Variable'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 95% Confidence Interval */}
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-sm font-semibold text-emerald-900 mb-3">95% Confidence Interval</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-xs text-emerald-700 mb-2">
                        Predicted range: {selectedAttribute.confidenceLower.toFixed(2)} – {selectedAttribute.confidenceUpper.toFixed(2)}
                      </div>
                      <div className="h-3 bg-emerald-200 rounded-full relative">
                        <div 
                          className="absolute h-full bg-emerald-500 rounded-full"
                          style={{
                            left: `${(selectedAttribute.confidenceLower / 6) * 100}%`,
                            width: `${((selectedAttribute.confidenceUpper - selectedAttribute.confidenceLower) / 6) * 100}%`
                          }}
                        />
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-600 rounded-full"
                          style={{ left: `${(selectedAttribute.instrumental / 6) * 100}%` }}
                          title="Instrumental prediction"
                        />
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-slate-900 rounded-full"
                          style={{ left: `${(selectedAttribute.semiTrainedPanel / 6) * 100}%` }}
                          title="Semi-trained panel"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-emerald-700 mt-1">
                        <span>0</span>
                        <span>6</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-600 rounded-full" />
                          <span className="text-slate-600">Instrumental</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-slate-900 rounded-full" />
                          <span className="text-slate-600">Semi-Trained Panel</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Escalation Decision */}
                <div className={`p-4 rounded-lg border-2 ${
                  selectedAttribute.escalationTrigger
                    ? (selectedAttribute.screeningAlignment >= 0.85 ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300')
                    : (selectedAttribute.screeningAlignment >= 0.85 ? 'bg-emerald-50 border-emerald-300' : 
                       selectedAttribute.screeningAlignment >= 0.70 ? 'bg-amber-50 border-amber-300' : 'bg-rose-50 border-rose-300')
                }`}>
                  <div className="text-sm font-semibold mb-2">
                    {selectedAttribute.escalationTrigger ? (
                      selectedAttribute.screeningAlignment >= 0.85 ? 'Escalation Not Required' : 'Escalation Triggered'
                    ) : (
                      selectedAttribute.screeningAlignment >= 0.85 ? 'Strong Alignment' :
                      selectedAttribute.screeningAlignment >= 0.70 ? 'Moderate Alignment' : 'Weak Alignment'
                    )}
                  </div>
                  <div className="text-xs text-slate-700">
                    {selectedAttribute.escalationTrigger ? (
                      selectedAttribute.screeningAlignment >= 0.85 
                        ? 'This escalation-trigger attribute meets the ≥85% threshold. Hybrid screening (instrumental + semi-trained panel) is sufficient.'
                        : 'This escalation-trigger attribute is below threshold. Full trained panel escalation recommended to manage sensory risk.'
                    ) : (
                      selectedAttribute.screeningAlignment >= 0.85 
                        ? 'Non-trigger attribute with strong screening alignment. Supports overall screening quality.'
                        : selectedAttribute.screeningAlignment >= 0.70
                        ? 'Non-trigger attribute with moderate alignment. Does not mandate escalation.'
                        : 'Non-trigger attribute with weak alignment. Consider for screening protocol improvement.'
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
