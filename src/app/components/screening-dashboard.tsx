import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, DollarSign, Clock, Info, TrendingUp } from "lucide-react";
import {
  evaluateEscalation,
  getTaskSummary,
  evaluateIntensityScaling,
  evaluateRankOrdering,
  evaluateOffNoteDetection,
  evaluateTextureProxy,
  type TaskStatus,
} from "../utils/task-evaluators";
import { samples } from "../data/sample-data";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";

export function ScreeningDashboard() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  const escalationDecision = evaluateEscalation();
  const taskSummary = getTaskSummary();
  const intensityResults = evaluateIntensityScaling();
  const rankResults = evaluateRankOrdering();
  const offNoteResult = evaluateOffNoteDetection();
  const textureResult = evaluateTextureProxy();
  
  const needsPanel = escalationDecision.escalationRequired;

  const getStatusBadgeColor = (status: TaskStatus) => {
    if (status === 'PASS') return 'bg-emerald-500/10 text-emerald-700 border-emerald-300';
    if (status === 'BORDERLINE') return 'bg-amber-500/10 text-amber-700 border-amber-300';
    return 'bg-rose-500/10 text-rose-700 border-rose-300';
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-medium text-slate-900 mb-2">
          Screening Escalation Decision
        </h1>
        <p className="text-lg text-slate-600">
          10 plant-based cheese samples • Instrumental + semi-trained panel evaluation
        </p>
      </div>

      {/* DECISION CARD - Clear but substantial */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-7">
          <Card className={`shadow-xl border-4 ${
            needsPanel 
              ? 'border-rose-400 bg-gradient-to-br from-rose-50 to-white'
              : 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-white'
          }`}>
            <CardContent className="pt-8 pb-8">
              <div className="flex items-start gap-6">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 ${
                  needsPanel ? 'bg-rose-100' : 'bg-emerald-100'
                }`}>
                  {needsPanel 
                    ? <XCircle className="size-12 text-rose-600" />
                    : <CheckCircle2 className="size-12 text-emerald-600" />
                  }
                </div>
                
                <div className="flex-1">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">
                      Escalation Decision
                    </div>
                    <h2 className={`text-4xl font-bold ${
                      needsPanel ? 'text-rose-900' : 'text-emerald-900'
                    }`}>
                      {needsPanel ? 'Full Panel Required' : 'Screening Sufficient'}
                    </h2>
                  </div>
                  
                  <div className="p-4 bg-white rounded-lg border-2 border-slate-200 mb-4">
                    <div className="text-sm font-semibold text-slate-900 mb-2">Decision Rationale</div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {escalationDecision.reason}
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-300">
                    <div className="text-sm font-semibold text-blue-900 mb-2">Recommended Action</div>
                    <p className="text-sm text-blue-800">
                      {escalationDecision.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Impact Summary */}
        <div className="col-span-5 space-y-4">
          <Card className="shadow-md border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Cost & Timeline Impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-lg border-2 border-slate-300">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <DollarSign className="size-5" />
                  <span className="text-sm font-semibold">Estimated Cost</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {needsPanel ? '$10k-$50k' : '$2k'}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {needsPanel ? 'Full trained panel required' : 'Screening only'}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border-2 border-slate-300">
                <div className="flex items-center gap-2 text-slate-600 mb-1">
                  <Clock className="size-5" />
                  <span className="text-sm font-semibold">Timeline</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {needsPanel ? '4-12 weeks' : '1 week'}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {needsPanel ? 'Panel recruitment + testing' : 'Current screening complete'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-200 bg-amber-50/30">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <Info className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700">
                  <strong className="text-slate-900">Context:</strong> This decision is based on evaluating 4 screening tasks across 10 samples. Each task tests whether instrumental + semi-trained panel data is reliable enough to avoid full trained panel escalation.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* TASK EVALUATION GRID - Shows the analysis */}
      <Card className="mb-8 shadow-lg border-slate-200">
        <CardHeader>
          <CardTitle className="text-2xl">Task-Level Evaluation</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            4 critical screening tasks evaluated across 10 samples
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Task 1: Intensity Scaling */}
            <div 
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                expandedSection === 'intensity' ? 'ring-2 ring-blue-400' : ''
              } ${
                taskSummary.intensityScaling.status === 'PASS' 
                  ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400'
                  : taskSummary.intensityScaling.status === 'BORDERLINE'
                  ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                  : 'bg-rose-50 border-rose-300 hover:border-rose-400'
              }`}
              onClick={() => setExpandedSection(expandedSection === 'intensity' ? null : 'intensity')}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {taskSummary.intensityScaling.status === 'PASS' 
                    ? <CheckCircle2 className="size-6 text-emerald-600" />
                    : taskSummary.intensityScaling.status === 'BORDERLINE'
                    ? <AlertTriangle className="size-6 text-amber-600" />
                    : <XCircle className="size-6 text-rose-600" />
                  }
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Intensity Scaling</h3>
                    <p className="text-sm text-slate-600">Measurement accuracy</p>
                  </div>
                </div>
                <Badge className={getStatusBadgeColor(taskSummary.intensityScaling.status)}>
                  {taskSummary.intensityScaling.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-600">Attributes Passing</div>
                  <div className="font-bold text-slate-900 text-lg">
                    {taskSummary.intensityScaling.passes}/{taskSummary.intensityScaling.total}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Avg MAE</div>
                  <div className="font-mono font-bold text-slate-900 text-lg">
                    {taskSummary.intensityScaling.metric}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-300">
                <p className="text-xs text-slate-700">
                  Compares instrumental predictions vs semi-trained panel ratings for taste/aroma intensity
                </p>
              </div>
            </div>

            {/* Task 2: Rank Ordering */}
            <div 
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                expandedSection === 'rank' ? 'ring-2 ring-blue-400' : ''
              } ${
                taskSummary.rankOrdering.status === 'PASS' 
                  ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400'
                  : taskSummary.rankOrdering.status === 'BORDERLINE'
                  ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                  : 'bg-rose-50 border-rose-300 hover:border-rose-400'
              }`}
              onClick={() => setExpandedSection(expandedSection === 'rank' ? null : 'rank')}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {taskSummary.rankOrdering.status === 'PASS' 
                    ? <CheckCircle2 className="size-6 text-emerald-600" />
                    : taskSummary.rankOrdering.status === 'BORDERLINE'
                    ? <AlertTriangle className="size-6 text-amber-600" />
                    : <XCircle className="size-6 text-rose-600" />
                  }
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Rank Ordering</h3>
                    <p className="text-sm text-slate-600">Comparison accuracy</p>
                  </div>
                </div>
                <Badge className={getStatusBadgeColor(taskSummary.rankOrdering.status)}>
                  {taskSummary.rankOrdering.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-600">Attributes Passing</div>
                  <div className="font-bold text-slate-900 text-lg">
                    {taskSummary.rankOrdering.passes}/{taskSummary.rankOrdering.total}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Avg Match Rate</div>
                  <div className="font-mono font-bold text-slate-900 text-lg">
                    {taskSummary.rankOrdering.metric}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-300">
                <p className="text-xs text-slate-700">
                  Tests if instruments correctly rank samples from strongest to weakest (45 pairwise comparisons)
                </p>
              </div>
            </div>

            {/* Task 3: Off-Note Detection - CRITICAL */}
            <div 
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                expandedSection === 'offnote' ? 'ring-2 ring-blue-400' : ''
              } ${
                taskSummary.offNoteDetection.status === 'PASS' 
                  ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400'
                  : 'bg-rose-50 border-rose-400 hover:border-rose-500'
              }`}
              onClick={() => setExpandedSection(expandedSection === 'offnote' ? null : 'offnote')}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {taskSummary.offNoteDetection.status === 'PASS' 
                    ? <CheckCircle2 className="size-6 text-emerald-600" />
                    : <XCircle className="size-6 text-rose-600" />
                  }
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Off-Note Detection</h3>
                    <p className="text-sm text-slate-600">Defect identification</p>
                  </div>
                </div>
                <Badge className={`${getStatusBadgeColor(taskSummary.offNoteDetection.status)} text-base px-3 py-1`}>
                  {taskSummary.offNoteDetection.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-600">Detection Status</div>
                  <div className="font-bold text-slate-900 text-lg">
                    {taskSummary.offNoteDetection.status === 'PASS' ? 'All Caught' : 'Misses Detected'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Missed Detections</div>
                  <div className="font-mono font-bold text-slate-900 text-lg">
                    {offNoteResult.missedDetections}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-rose-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-700 font-semibold">
                    CRITICAL: Rancid/unpleasant odors - regulatory and consumer acceptability concern
                  </p>
                </div>
              </div>
            </div>

            {/* Task 4: Texture Proxy */}
            <div 
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                expandedSection === 'texture' ? 'ring-2 ring-blue-400' : ''
              } ${
                taskSummary.textureProxy.status === 'PASS' 
                  ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400'
                  : taskSummary.textureProxy.status === 'BORDERLINE'
                  ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                  : 'bg-rose-50 border-rose-300 hover:border-rose-400'
              }`}
              onClick={() => setExpandedSection(expandedSection === 'texture' ? null : 'texture')}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {taskSummary.textureProxy.status === 'PASS' 
                    ? <CheckCircle2 className="size-6 text-emerald-600" />
                    : taskSummary.textureProxy.status === 'BORDERLINE'
                    ? <AlertTriangle className="size-6 text-amber-600" />
                    : <XCircle className="size-6 text-rose-600" />
                  }
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Texture Proxy</h3>
                    <p className="text-sm text-slate-600">Firmness prediction</p>
                  </div>
                </div>
                <Badge className={getStatusBadgeColor(taskSummary.textureProxy.status)}>
                  {taskSummary.textureProxy.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-600">Correlation</div>
                  <div className="font-mono font-bold text-slate-900 text-lg">
                    {taskSummary.textureProxy.metric}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">MAE</div>
                  <div className="font-mono font-bold text-slate-900 text-lg">
                    {textureResult.mae.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-300">
                <p className="text-xs text-slate-700">
                  Rheology firmness measurement vs perceived firmness by semi-trained panel
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-300">
            <div className="text-sm text-slate-600 mb-2">
              <strong className="text-slate-900">Click any task</strong> to see detailed analysis below
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EXPANDED ANALYSIS SECTIONS */}
      {expandedSection === 'offnote' && (
        <Card className="mb-8 shadow-lg border-rose-200 bg-rose-50/20">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="size-6 text-rose-600" />
              Off-Note Detection: Sample-by-Sample Analysis
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              GC-MS compound levels vs semi-trained panel flagging
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Sample</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">GC-MS Level<br/>(Short-Chain FA)</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Semi-Trained<br/>Detection</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Descriptor</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Agreement</th>
                  </tr>
                </thead>
                <tbody>
                  {offNoteResult.detections.map((det, idx) => {
                    const sample = samples.find(s => s.id === det.sampleId);
                    return (
                      <tr key={idx} className={`border-b border-slate-200 ${!det.agreement ? 'bg-rose-100' : ''}`}>
                        <td className="py-3 px-4 font-semibold text-slate-900">{det.sampleName}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={det.instrumentalLevel > 2.5 ? 'bg-rose-200 text-rose-900 font-bold' : 'bg-slate-100 text-slate-700'}>
                            {det.instrumentalLevel.toFixed(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {det.semiTrainedDetected ? (
                            <Badge className="bg-amber-200 text-amber-900 font-bold">YES</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600">NO</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-slate-700">
                          {sample?.semiTrained.offNoteDescriptor || '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {det.agreement ? (
                            <CheckCircle2 className="size-5 text-emerald-600 mx-auto" />
                          ) : (
                            <XCircle className="size-5 text-rose-600 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {offNoteResult.missedDetections > 0 && (
              <div className="mt-6 p-5 bg-rose-100 border-2 border-rose-400 rounded-xl">
                <div className="flex items-start gap-3">
                  <XCircle className="size-6 text-rose-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-rose-900 text-lg mb-2">Problem: Missed Detections</h4>
                    <div className="space-y-1 mb-3">
                      {offNoteResult.falseNegatives.map((msg, idx) => (
                        <div key={idx} className="text-sm text-rose-800">• {msg}</div>
                      ))}
                    </div>
                    <p className="text-sm text-slate-700 bg-white p-3 rounded-lg">
                      <strong>Why this matters:</strong> Semi-trained panelists detected rancid off-notes that GC-MS compound levels didn't predict accurately. This creates regulatory and consumer acceptability risk. Full trained panel required for proper off-note characterization.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-slate-700">
                <strong className="text-blue-900">Threshold logic:</strong> GC-MS short-chain fatty acid levels &gt;2.5 should predict rancid detection. When semi-trained panel detects off-notes but instrumental level is below threshold, we have a detection gap requiring expert evaluation.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {expandedSection === 'intensity' && (
        <Card className="mb-8 shadow-lg border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">Intensity Scaling: Attribute-by-Attribute Analysis</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Scatter plots comparing instrumental vs semi-trained panel (10 points per attribute)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {intensityResults.slice(0, 4).map((result, idx) => (
                <div key={`intensity-detail-${result.attribute}-${idx}`} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-900">{result.attribute}</h4>
                    <Badge className={getStatusBadgeColor(result.status)}>
                      {result.status}
                    </Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={200} key={`resp-container-${result.attribute}-${idx}`}>
                    <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }} id={`scatter-${result.attribute}-${idx}`}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        type="number" 
                        dataKey="instrumental" 
                        domain={[0, 6]}
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Instrumental', position: 'insideBottom', offset: -5, fontSize: 10 }}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="semiTrained" 
                        domain={[0, 6]}
                        tick={{ fontSize: 11 }}
                        label={{ value: 'Semi-Trained', angle: -90, position: 'insideLeft', fontSize: 10 }}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-2 border border-slate-200 rounded shadow-sm text-xs">
                                <div className="font-semibold">{data.sampleName}</div>
                                <div>Inst: {data.instrumental.toFixed(2)}</div>
                                <div>Semi: {data.semiTrained.toFixed(2)}</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter 
                        data={result.scatterData} 
                        fill="#3b82f6"
                        name={`intensity-${result.attribute}-scatter-${idx}`}
                        isAnimationActive={false}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 bg-white rounded">
                      <span className="text-slate-600">r:</span>
                      <span className="font-mono font-bold">{result.correlation.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded">
                      <span className="text-slate-600">MAE:</span>
                      <span className="font-mono font-bold">{result.mae.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-slate-700">
                <strong className="text-blue-900">Interpretation:</strong> Points closer to diagonal line = better agreement. MAE &lt;0.3 = PASS, 0.3-0.4 = BORDERLINE, &gt;0.4 = FAIL. Correlation (r) shows linear relationship strength.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {expandedSection === 'rank' && (
        <Card className="mb-8 shadow-lg border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">Rank Ordering: Pairwise Agreement</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              45 pairwise comparisons per attribute (10 samples = 45 pairs)
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={rankResults} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="attribute" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  label={{ value: '% Correct Rank Matches', angle: -90, position: 'insideLeft', fontSize: 13 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border-2 border-slate-200 rounded shadow-lg">
                          <div className="font-semibold text-slate-900 mb-1">{data.attribute}</div>
                          <div className="text-sm text-slate-600">
                            {data.correctMatches}/{data.totalComparisons} correct
                          </div>
                          <div className="text-sm font-bold text-slate-900">
                            {data.percentCorrect.toFixed(1)}%
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'PASS (80%)', fontSize: 11, fill: '#059669' }} />
                <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'FAIL (70%)', fontSize: 11, fill: '#d97706' }} />
                <Bar dataKey="percentCorrect" radius={[8, 8, 0, 0]}>
                  {rankResults.map((entry, index) => (
                    <Cell 
                      key={`rank-cell-${entry.attribute}-${index}`} 
                      fill={entry.status === 'PASS' ? '#10b981' : entry.status === 'BORDERLINE' ? '#f59e0b' : '#ef4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-slate-700">
                <strong className="text-blue-900">Interpretation:</strong> For each attribute, we compare all possible sample pairs (e.g., "Is Sample A stronger than Sample B?"). If instrumental and semi-trained panel agree on the ranking direction ≥80% of the time, the task passes. This tests whether instruments can reliably rank samples for formulation optimization decisions.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {expandedSection === 'texture' && (
        <Card className="mb-8 shadow-lg border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">Texture Proxy: Firmness Correlation</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Rheology measurement vs perceived firmness
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  type="number" 
                  dataKey="instrumental" 
                  domain={[0, 6]}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Rheology Firmness (Instrumental)', position: 'insideBottom', offset: -10, fontSize: 13 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="semiTrained" 
                  domain={[0, 6]}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Perceived Firmness (Semi-Trained)', angle: -90, position: 'insideLeft', fontSize: 13 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border-2 border-slate-200 rounded shadow-lg">
                          <div className="font-semibold text-slate-900 mb-1">{data.sampleName}</div>
                          <div className="text-sm text-slate-600">Rheology: {data.instrumental.toFixed(2)}</div>
                          <div className="text-sm text-slate-600">Perceived: {data.semiTrained.toFixed(2)}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  data={textureResult.scatterData} 
                  fill="#8b5cf6"
                  name="texture-firmness"
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-sm text-purple-600 font-semibold mb-1">Correlation (r)</div>
                <div className="text-3xl font-bold text-purple-900">{textureResult.correlation.toFixed(3)}</div>
                <div className="text-xs text-slate-600 mt-1">Target: r ≥ 0.75</div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-sm text-purple-600 font-semibold mb-1">MAE</div>
                <div className="text-3xl font-bold text-purple-900">{textureResult.mae.toFixed(3)}</div>
                <div className="text-xs text-slate-600 mt-1">Target: MAE ≤ 0.4</div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-slate-700">
                <strong className="text-blue-900">Interpretation:</strong> Rheology (texture analyzer) measures force/resistance. If this correlates well (r≥0.75) with what panelists perceive as firmness, it's a reliable proxy. Unlike taste/aroma, texture is often well-predicted by physical measurements.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}