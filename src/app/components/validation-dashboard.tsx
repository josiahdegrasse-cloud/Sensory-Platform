import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp, Award, Target } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LineChart, Line, BarChart, Bar, ReferenceLine } from "recharts";
import { VALIDATION_DATASET, METHOD_COMPARISON, COST_ANALYSIS, USE_CASE_BOUNDARIES, PANELIST_CALIBRATION, INTER_RATER_STATS } from "../data/validation-data";

export function ValidationDashboard() {
  // Calculate confusion matrix
  const confusionMatrix = {
    truePositive: VALIDATION_DATASET.filter(v => v.issfDecision === "GO" && v.trainedPanelDecision === "GO").length,
    falsePositive: VALIDATION_DATASET.filter(v => v.issfDecision === "GO" && v.trainedPanelDecision !== "GO").length,
    trueNegative: VALIDATION_DATASET.filter(v => v.issfDecision === "STOP" && v.trainedPanelDecision === "STOP").length,
    falseNegative: VALIDATION_DATASET.filter(v => v.issfDecision === "STOP" && v.trainedPanelDecision !== "STOP").length,
    tweakMatch: VALIDATION_DATASET.filter(v => v.issfDecision === "TWEAK" && v.trainedPanelDecision === "TWEAK").length,
  };

  // Regression data
  const regressionData = VALIDATION_DATASET.map(v => ({
    issf: v.issfScore,
    trained: v.trainedPanelScore,
    agreement: v.agreement,
    sampleId: v.sampleId
  }));

  // Calculate R² line
  const minScore = 0;
  const maxScore = 100;
  const slope = METHOD_COMPARISON.pearsonR;
  const intercept = 50 - (slope * 50); // Approximate intercept
  
  const regressionLine = [
    { issf: minScore, trained: slope * minScore + intercept },
    { issf: maxScore, trained: slope * maxScore + intercept }
  ];

  // Panel calibration stats
  const avgCalibration = PANELIST_CALIBRATION.reduce((sum, p) => sum + p.attributeAgreement, 0) / PANELIST_CALIBRATION.length;
  const calibratedCount = PANELIST_CALIBRATION.filter(p => p.status === "calibrated").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Validation & Performance</h1>
        <p className="text-slate-600 mt-2">127 prototypes tested with both ISSF and Trained Panel (Jan 2024 - Mar 2026)</p>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-600">{(METHOD_COMPARISON.accuracy * 100).toFixed(0)}%</div>
            <div className="text-sm text-slate-600 mt-1">Accuracy</div>
            <div className="text-xs text-slate-500 mt-1">{VALIDATION_DATASET.filter(v => v.agreement).length}/127</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{METHOD_COMPARISON.pearsonR.toFixed(2)}</div>
            <div className="text-sm text-slate-600 mt-1">Correlation (r)</div>
            <div className="text-xs text-slate-500 mt-1">R² = {METHOD_COMPARISON.rSquared.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-purple-600">{(METHOD_COMPARISON.sensitivity * 100).toFixed(0)}%</div>
            <div className="text-sm text-slate-600 mt-1">Sensitivity</div>
            <div className="text-xs text-slate-500 mt-1">True GO rate</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-600">{(METHOD_COMPARISON.specificity * 100).toFixed(0)}%</div>
            <div className="text-sm text-slate-600 mt-1">Specificity</div>
            <div className="text-xs text-slate-500 mt-1">True STOP rate</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-600">${(COST_ANALYSIS.totalSavings / 1000000).toFixed(2)}M</div>
            <div className="text-sm text-slate-600 mt-1">Cost Savings</div>
            <div className="text-xs text-slate-500 mt-1">{(COST_ANALYSIS.savingsPercentage * 100).toFixed(0)}% reduction</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-900">{METHOD_COMPARISON.rmse.toFixed(1)}</div>
            <div className="text-sm text-slate-600 mt-1">RMSE</div>
            <div className="text-xs text-slate-500 mt-1">±{METHOD_COMPARISON.mae.toFixed(1)} MAE</div>
          </CardContent>
        </Card>
      </div>

      {/* Regression Plot: ISSF vs Trained Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-blue-600" />
            ISSF Score vs. Trained Panel Score (n=127)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-slate-700">Agreement (n={VALIDATION_DATASET.filter(v => v.agreement).length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <span className="text-slate-700">Disagreement (n={VALIDATION_DATASET.filter(v => !v.agreement).length})</span>
            </div>
            <Badge className="bg-blue-600">r = {METHOD_COMPARISON.pearsonR.toFixed(3)}, R² = {METHOD_COMPARISON.rSquared.toFixed(3)}</Badge>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="issf" 
                name="ISSF Score" 
                domain={[0, 100]}
                label={{ value: 'ISSF Score', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                type="number" 
                dataKey="trained" 
                name="Trained Panel Score" 
                domain={[0, 100]}
                label={{ value: 'Trained Panel Score', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 shadow-xl rounded-lg border border-slate-200">
                        <p className="font-bold text-slate-900">{data.sampleId}</p>
                        <p className="text-sm text-slate-700">ISSF: {data.issf.toFixed(1)}</p>
                        <p className="text-sm text-slate-700">Trained: {data.trained.toFixed(1)}</p>
                        <p className="text-sm text-slate-700">
                          {data.agreement ? 
                            <span className="text-emerald-600">✓ Agreement</span> : 
                            <span className="text-rose-600">✗ Disagreement</span>
                          }
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={regressionData}>
                {regressionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.agreement ? "#10b981" : "#f43f5e"} />
                ))}
              </Scatter>
              <Line 
                data={regressionLine} 
                type="monotone" 
                dataKey="trained" 
                stroke="#3b82f6" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                legendType="line"
                name={`Best Fit: y = ${slope.toFixed(2)}x + ${intercept.toFixed(1)}`}
              />
              <ReferenceLine 
                segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} 
                stroke="#94a3b8" 
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Confusion Matrix & Classification Metrics */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5 text-purple-600" />
              Classification Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Confusion Matrix Visualization */}
              <div>
                <div className="text-sm font-bold text-slate-700 mb-3">Confusion Matrix</div>
                <div className="grid grid-cols-3 gap-2">
                  <div></div>
                  <div className="text-xs font-bold text-center text-slate-600">Predicted GO</div>
                  <div className="text-xs font-bold text-center text-slate-600">Predicted STOP</div>
                  
                  <div className="text-xs font-bold text-slate-600 flex items-center">Actual GO</div>
                  <div className="bg-emerald-100 p-3 rounded text-center">
                    <div className="text-2xl font-bold text-emerald-700">{confusionMatrix.truePositive}</div>
                    <div className="text-xs text-slate-600">True Positive</div>
                  </div>
                  <div className="bg-rose-100 p-3 rounded text-center">
                    <div className="text-2xl font-bold text-rose-700">{confusionMatrix.falseNegative}</div>
                    <div className="text-xs text-slate-600">False Negative</div>
                  </div>
                  
                  <div className="text-xs font-bold text-slate-600 flex items-center">Actual STOP</div>
                  <div className="bg-amber-100 p-3 rounded text-center">
                    <div className="text-2xl font-bold text-amber-700">{confusionMatrix.falsePositive}</div>
                    <div className="text-xs text-slate-600">False Positive</div>
                  </div>
                  <div className="bg-emerald-100 p-3 rounded text-center">
                    <div className="text-2xl font-bold text-emerald-700">{confusionMatrix.trueNegative}</div>
                    <div className="text-xs text-slate-600">True Negative</div>
                  </div>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded">
                  <div className="text-xs text-slate-600">PPV (Precision)</div>
                  <div className="text-xl font-bold text-slate-900">{(METHOD_COMPARISON.ppv * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-slate-50 p-3 rounded">
                  <div className="text-xs text-slate-600">NPV</div>
                  <div className="text-xl font-bold text-slate-900">{(METHOD_COMPARISON.npv * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-slate-50 p-3 rounded">
                  <div className="text-xs text-slate-600">F1 Score</div>
                  <div className="text-xl font-bold text-slate-900">{METHOD_COMPARISON.f1Score.toFixed(3)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded">
                  <div className="text-xs text-slate-600">TWEAK Matches</div>
                  <div className="text-xl font-bold text-slate-900">{confusionMatrix.tweakMatch}/11</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel Calibration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5 text-amber-600" />
              Panel Calibration Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 p-3 rounded">
                  <div className="text-xs text-slate-600">Calibrated Panelists</div>
                  <div className="text-2xl font-bold text-emerald-700">{calibratedCount}/14</div>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-xs text-slate-600">Avg Agreement</div>
                  <div className="text-2xl font-bold text-blue-700">{(avgCalibration * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-purple-50 p-3 rounded">
                  <div className="text-xs text-slate-600">Cronbach's α</div>
                  <div className="text-2xl font-bold text-purple-700">{INTER_RATER_STATS.cronbachAlpha.toFixed(2)}</div>
                </div>
                <div className="bg-orange-50 p-3 rounded">
                  <div className="text-xs text-slate-600">ICC</div>
                  <div className="text-2xl font-bold text-orange-700">{INTER_RATER_STATS.icc.toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded">
                <div className="text-xs font-bold text-slate-700 mb-2">Top Performers</div>
                <div className="space-y-2">
                  {PANELIST_CALIBRATION
                    .sort((a, b) => b.attributeAgreement - a.attributeAgreement)
                    .slice(0, 5)
                    .map(p => (
                      <div key={p.panelistId} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-emerald-600 h-2 rounded-full" 
                              style={{ width: `${p.attributeAgreement * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-slate-600 w-12 text-right">{(p.attributeAgreement * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Use Case Boundaries */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="size-5" />
              {USE_CASE_BOUNDARIES.safeForISFF.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {USE_CASE_BOUNDARIES.safeForISFF.criteria.map((criterion, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-emerald-900">
                  <CheckCircle2 className="size-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <Badge className="bg-emerald-700 text-white">
                {USE_CASE_BOUNDARIES.safeForISFF.historicalAccuracy}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-rose-200 bg-rose-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-900">
              <AlertTriangle className="size-5" />
              {USE_CASE_BOUNDARIES.requireTrainedPanel.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {USE_CASE_BOUNDARIES.requireTrainedPanel.criteria.map((criterion, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-rose-900">
                  <XCircle className="size-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-rose-200">
              <Badge className="bg-rose-700 text-white">
                {USE_CASE_BOUNDARIES.requireTrainedPanel.historicalAccuracy}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Impact */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Financial Impact Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-blue-700 mb-1">Total Prototypes</div>
              <div className="text-3xl font-bold text-blue-900">{COST_ANALYSIS.totalPrototypesTested}</div>
            </div>
            <div>
              <div className="text-xs text-blue-700 mb-1">ISSF Only Cost</div>
              <div className="text-3xl font-bold text-blue-900">${(COST_ANALYSIS.issfCost / 1000).toFixed(0)}k</div>
            </div>
            <div>
              <div className="text-xs text-blue-700 mb-1">All Trained Panel Cost</div>
              <div className="text-3xl font-bold text-rose-900">${(COST_ANALYSIS.trainedPanelCost / 1000000).toFixed(2)}M</div>
            </div>
            <div>
              <div className="text-xs text-emerald-700 mb-1">Total Savings</div>
              <div className="text-3xl font-bold text-emerald-900">${(COST_ANALYSIS.totalSavings / 1000000).toFixed(2)}M</div>
              <div className="text-xs text-emerald-700 mt-1">{(COST_ANALYSIS.savingsPercentage * 100).toFixed(0)}% reduction</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200 text-sm text-blue-900">
            <p><strong>Strategy:</strong> Use ISSF for initial screening (120/127 samples), escalate only high-risk cases to trained panel (7 samples). Avg time savings: <strong>{COST_ANALYSIS.avgTimeSavings}</strong> per prototype.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
