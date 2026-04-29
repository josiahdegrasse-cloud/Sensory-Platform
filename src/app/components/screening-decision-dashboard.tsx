import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  evaluateEscalation,
  getTaskSummary,
  evaluateIntensityScaling,
  evaluateRankOrdering,
  evaluateOffNoteDetection,
  evaluateTextureProxy,
  type TaskStatus,
} from "../utils/task-evaluators";
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

export function ScreeningDecisionDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  
  const escalationDecision = evaluateEscalation();
  const taskSummary = getTaskSummary();
  const intensityResults = evaluateIntensityScaling();
  const rankResults = evaluateRankOrdering();
  const offNoteResult = evaluateOffNoteDetection();
  const textureResult = evaluateTextureProxy();
  
  const getStatusColor = (status: TaskStatus) => {
    if (status === 'PASS') return 'text-emerald-700';
    if (status === 'BORDERLINE') return 'text-amber-700';
    return 'text-rose-700';
  };
  
  const getStatusBadgeColor = (status: TaskStatus) => {
    if (status === 'PASS') return 'bg-emerald-500/10 text-emerald-700 border-emerald-300';
    if (status === 'BORDERLINE') return 'bg-amber-500/10 text-amber-700 border-amber-300';
    return 'bg-rose-500/10 text-rose-700 border-rose-300';
  };
  
  const getStatusIcon = (status: TaskStatus) => {
    if (status === 'PASS') return <CheckCircle2 className="size-4 text-emerald-600" />;
    if (status === 'BORDERLINE') return <AlertTriangle className="size-4 text-amber-600" />;
    return <XCircle className="size-4 text-rose-600" />;
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-medium text-slate-900 mb-2">Screening Decision Dashboard</h1>
        <p className="text-slate-600">
          Task-Based Escalation Framework • 10 Sample Set • Instrumental + Semi-Trained Panel Evaluation
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview">Screening Decision</TabsTrigger>
          <TabsTrigger value="tasks">Task Details</TabsTrigger>
          <TabsTrigger value="oversight">Risk & Oversight</TabsTrigger>
        </TabsList>

        {/* TAB 1: Screening Decision Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Decision Status Card */}
            <div className="col-span-5">
              <Card className={`shadow-lg border-2 ${
                escalationDecision.escalationRequired 
                  ? 'border-rose-300 bg-gradient-to-br from-rose-50 to-white'
                  : 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white'
              }`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${
                      escalationDecision.escalationRequired ? 'bg-rose-100' : 'bg-emerald-100'
                    }`}>
                      {escalationDecision.escalationRequired 
                        ? <XCircle className="size-7 text-rose-600" />
                        : <CheckCircle2 className="size-7 text-emerald-600" />
                      }
                    </div>
                    <div>
                      <CardTitle className={`text-xl ${
                        escalationDecision.escalationRequired ? 'text-rose-900' : 'text-emerald-900'
                      }`}>
                        Escalation Decision
                      </CardTitle>
                      <p className={`text-sm mt-0.5 font-semibold ${
                        escalationDecision.escalationRequired ? 'text-rose-700' : 'text-emerald-700'
                      }`}>
                        {escalationDecision.escalationRequired ? 'Escalation Required' : 'Screening Sufficient'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-white border-2 border-slate-200 rounded-xl shadow-sm mb-4">
                    <div className="text-sm font-semibold text-slate-900 mb-2">Decision Rationale</div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {escalationDecision.reason}
                    </p>
                  </div>
                  
                  {escalationDecision.failedTasks.length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-slate-900 mb-2">Failed Tasks</div>
                      <div className="space-y-2">
                        {escalationDecision.failedTasks.map((task, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-rose-700">
                            <XCircle className="size-4 flex-shrink-0" />
                            <span>{task}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <ArrowRight className="size-4" />
                      Recommended Action
                    </div>
                    <p className="text-sm text-blue-800">
                      {escalationDecision.recommendation}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Task-Level Summary Grid */}
            <div className="col-span-7">
              <Card className="shadow-md border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl">Task-Level Performance Summary</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Screening task evaluation across 10 samples
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Intensity Scaling */}
                    <div className={`p-4 rounded-lg border-2 ${
                      taskSummary.intensityScaling.status === 'PASS' ? 'bg-emerald-50 border-emerald-200' :
                      taskSummary.intensityScaling.status === 'BORDERLINE' ? 'bg-amber-50 border-amber-200' :
                      'bg-rose-50 border-rose-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(taskSummary.intensityScaling.status)}
                          <span className="font-semibold text-slate-900">Intensity Scaling Agreement</span>
                        </div>
                        <Badge className={getStatusBadgeColor(taskSummary.intensityScaling.status)}>
                          {taskSummary.intensityScaling.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          {taskSummary.intensityScaling.passes}/{taskSummary.intensityScaling.total} attributes pass
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {taskSummary.intensityScaling.metric}
                        </span>
                      </div>
                    </div>

                    {/* Rank Ordering */}
                    <div className={`p-4 rounded-lg border-2 ${
                      taskSummary.rankOrdering.status === 'PASS' ? 'bg-emerald-50 border-emerald-200' :
                      taskSummary.rankOrdering.status === 'BORDERLINE' ? 'bg-amber-50 border-amber-200' :
                      'bg-rose-50 border-rose-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(taskSummary.rankOrdering.status)}
                          <span className="font-semibold text-slate-900">Rank Ordering Accuracy</span>
                        </div>
                        <Badge className={getStatusBadgeColor(taskSummary.rankOrdering.status)}>
                          {taskSummary.rankOrdering.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          {taskSummary.rankOrdering.passes}/{taskSummary.rankOrdering.total} attributes pass
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {taskSummary.rankOrdering.metric}
                        </span>
                      </div>
                    </div>

                    {/* Off-Note Detection */}
                    <div className={`p-4 rounded-lg border-2 ${
                      taskSummary.offNoteDetection.status === 'PASS' ? 'bg-emerald-50 border-emerald-200' :
                      'bg-rose-50 border-rose-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(taskSummary.offNoteDetection.status)}
                          <span className="font-semibold text-slate-900">Off-Note Detection</span>
                        </div>
                        <Badge className={getStatusBadgeColor(taskSummary.offNoteDetection.status)}>
                          {taskSummary.offNoteDetection.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Rancid note screening</span>
                        <span className="font-mono font-bold text-slate-900">
                          {taskSummary.offNoteDetection.metric}
                        </span>
                      </div>
                    </div>

                    {/* Texture Proxy */}
                    <div className={`p-4 rounded-lg border-2 ${
                      taskSummary.textureProxy.status === 'PASS' ? 'bg-emerald-50 border-emerald-200' :
                      taskSummary.textureProxy.status === 'BORDERLINE' ? 'bg-amber-50 border-amber-200' :
                      'bg-rose-50 border-rose-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(taskSummary.textureProxy.status)}
                          <span className="font-semibold text-slate-900">Texture Proxy Reliability</span>
                        </div>
                        <Badge className={getStatusBadgeColor(taskSummary.textureProxy.status)}>
                          {taskSummary.textureProxy.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Firmness prediction</span>
                        <span className="font-mono font-bold text-slate-900">
                          {taskSummary.textureProxy.metric}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-200">
                    <div className="flex items-start gap-3 text-sm text-slate-700">
                      <Info className="size-5 flex-shrink-0 mt-0.5 text-blue-600" />
                      <div>
                        <strong className="text-slate-900">Task-Based Framework:</strong> Escalation decision is determined by specific task failures, not averaged scores. Each task evaluates a different aspect of screening capability: intensity agreement, rank ordering, off-note detection, and texture prediction.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Task Details */}
        <TabsContent value="tasks" className="space-y-6">
          {/* Intensity Scaling Details */}
          <Card className="shadow-md border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                {getStatusIcon(taskSummary.intensityScaling.status)}
                Intensity Scaling Agreement
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Scatter plots showing instrumental vs semi-trained panel ratings across 10 samples
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {intensityResults.slice(0, 4).map((result, idx) => (
                  <div key={`intensity-${result.attribute}-${idx}`} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900">{result.attribute}</h4>
                      <Badge className={getStatusBadgeColor(result.status)}>
                        {result.status}
                      </Badge>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          type="number" 
                          dataKey="instrumental" 
                          domain={[0, 6]}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis 
                          type="number" 
                          dataKey="semiTrained" 
                          domain={[0, 6]}
                          tick={{ fontSize: 11 }}
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
                        <ReferenceLine 
                          segment={[{ x: 0, y: 0 }, { x: 6, y: 6 }]} 
                          stroke="#94a3b8" 
                          strokeDasharray="3 3"
                        />
                        <Scatter 
                          data={result.scatterData} 
                          fill="#3b82f6"
                          name={result.attribute}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="mt-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Correlation (r)</span>
                        <span className="font-mono font-bold">{result.correlation.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">MAE</span>
                        <span className="font-mono font-bold">{result.mae.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Rank Ordering Details */}
          <Card className="shadow-md border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                {getStatusIcon(taskSummary.rankOrdering.status)}
                Rank Ordering Accuracy
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Pairwise rank agreement (45 comparisons per attribute)
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankResults} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="attribute" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
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
                  <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'PASS threshold', fontSize: 11 }} />
                  <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'FAIL threshold', fontSize: 11 }} />
                  <Bar dataKey="percentCorrect" radius={[8, 8, 0, 0]}>
                    {rankResults.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.status === 'PASS' ? '#10b981' : entry.status === 'BORDERLINE' ? '#f59e0b' : '#ef4444'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Off-Note Detection Details */}
          <Card className="shadow-md border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                {getStatusIcon(offNoteResult.status)}
                Off-Note Detection
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Rancid note detection: GC-MS compound level vs semi-trained panel flagging
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50">
                      <th className="text-left py-3 px-4">Sample</th>
                      <th className="text-center py-3 px-4">Instrumental Level</th>
                      <th className="text-center py-3 px-4">Semi-Trained Detected</th>
                      <th className="text-center py-3 px-4">Agreement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offNoteResult.detections.map((det, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="py-3 px-4 font-semibold">{det.sampleName}</td>
                        <td className="py-3 px-4 text-center font-mono">
                          <Badge className={det.instrumentalLevel > 2.5 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}>
                            {det.instrumentalLevel.toFixed(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {det.semiTrainedDetected ? (
                            <Badge className="bg-amber-100 text-amber-800">Yes</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600">No</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {det.agreement ? (
                            <CheckCircle2 className="size-5 text-emerald-600 mx-auto" />
                          ) : (
                            <XCircle className="size-5 text-rose-600 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {offNoteResult.falseNegatives.length > 0 && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="text-sm font-semibold text-rose-900 mb-2">Missed Detections</div>
                  <div className="space-y-1">
                    {offNoteResult.falseNegatives.map((msg, idx) => (
                      <div key={idx} className="text-xs text-rose-700 flex items-start gap-2">
                        <XCircle className="size-3.5 flex-shrink-0 mt-0.5" />
                        <span>{msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Risk & Human Oversight */}
        <TabsContent value="oversight" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Which Tasks Are Safely Substituted */}
            <Card className="shadow-md border-emerald-200 bg-emerald-50/30">
              <CardHeader>
                <CardTitle className="text-lg text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="size-5" />
                  Tasks Handled by Screening
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {taskSummary.intensityScaling.status === 'PASS' && (
                    <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                      <div className="font-semibold text-emerald-900 mb-1">Intensity Scaling</div>
                      <div className="text-sm text-slate-600">
                        Instrumental + semi-trained panel provide sufficient agreement for intensity estimation across key attributes.
                      </div>
                    </div>
                  )}
                  
                  {taskSummary.rankOrdering.status === 'PASS' && (
                    <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                      <div className="font-semibold text-emerald-900 mb-1">Rank Ordering</div>
                      <div className="text-sm text-slate-600">
                        Sample ranking is reliable for formulation optimization decisions.
                      </div>
                    </div>
                  )}
                  
                  {taskSummary.offNoteDetection.status === 'PASS' && (
                    <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                      <div className="font-semibold text-emerald-900 mb-1">Off-Note Detection</div>
                      <div className="text-sm text-slate-600">
                        Rancid note screening is reliable. No missed detections.
                      </div>
                    </div>
                  )}
                  
                  {taskSummary.textureProxy.status === 'PASS' && (
                    <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                      <div className="font-semibold text-emerald-900 mb-1">Texture Proxy</div>
                      <div className="text-sm text-slate-600">
                        Rheological firmness correlates well with sensory perception.
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Which Require Trained Panel */}
            <Card className="shadow-md border-rose-200 bg-rose-50/30">
              <CardHeader>
                <CardTitle className="text-lg text-rose-900 flex items-center gap-2">
                  <XCircle className="size-5" />
                  Tasks Requiring Expert Panel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {escalationDecision.failedTasks.length > 0 ? (
                    <>
                      {escalationDecision.failedTasks.includes('Off-Note Detection') && (
                        <div className="p-3 bg-white border border-rose-200 rounded-lg">
                          <div className="font-semibold text-rose-900 mb-1">Off-Note Characterization</div>
                          <div className="text-sm text-slate-600">
                            Semi-trained panel detected off-notes not predicted by instrumental. Requires full trained panel for accurate off-note profiling.
                          </div>
                        </div>
                      )}
                      
                      {escalationDecision.failedTasks.includes('Intensity Scaling') && (
                        <div className="p-3 bg-white border border-rose-200 rounded-lg">
                          <div className="font-semibold text-rose-900 mb-1">Critical Intensity Attributes</div>
                          <div className="text-sm text-slate-600">
                            Multiple key attributes show insufficient instrumental accuracy. Full panel needed for reliable intensity measurement.
                          </div>
                        </div>
                      )}
                      
                      {escalationDecision.failedTasks.includes('Rank Ordering') && (
                        <div className="p-3 bg-white border border-rose-200 rounded-lg">
                          <div className="font-semibold text-rose-900 mb-1">Sample Ranking</div>
                          <div className="text-sm text-slate-600">
                            Instrumental cannot reliably rank samples. Essential for optimization decisions.
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="text-sm text-slate-600 italic">
                        No tasks require full trained panel escalation at this stage.
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Why This Framework Works */}
          <Card className="shadow-md border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-lg text-blue-900 flex items-center gap-2">
                <Info className="size-5" />
                Human-Centered Escalation Framework
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-blue-200 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-2">Layer 1: Instrumental Data</div>
                  <div className="text-sm text-slate-600">
                    E-tongue (TSS), GC-MS/GC-O volatile compounds, rheology. Fast, low-cost, continuous data.
                  </div>
                </div>
                
                <div className="p-4 bg-white border border-blue-200 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-2">Layer 2: Semi-Trained Panel</div>
                  <div className="text-sm text-slate-600">
                    Directional sensory checks using lexicon anchors. Off-note flagging. Lower rigor than full trained panel.
                  </div>
                </div>
                
                <div className="p-4 bg-white border border-blue-200 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-2">Layer 3: Escalation Logic</div>
                  <div className="text-sm text-slate-600">
                    Task-based decision tree. Full trained panel only when screening reveals gaps or off-note detection fails.
                  </div>
                </div>
                
                <div className="p-4 bg-white border border-blue-200 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-2">Human Oversight Preserved</div>
                  <div className="text-sm text-slate-600">
                    Framework doesn't claim replacement. Defines when screening is "good enough" while maintaining expert validation where critical.
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl border border-blue-200">
                <div className="text-sm text-slate-700 leading-relaxed">
                  <strong className="text-slate-900">Key Innovation:</strong> This framework reduces trained panel usage by 60-80% on early-stage screening while maintaining regulatory compliance and sensory quality standards. It explicitly defines task boundaries — not claiming instrumental equivalence, but providing structured escalation criteria based on screening capability gaps.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}