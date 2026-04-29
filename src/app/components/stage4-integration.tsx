import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CheckCircle2, XCircle, AlertTriangle, DollarSign, Clock, TrendingUp, Eye, EyeOff } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell, BarChart, Bar } from "recharts";

interface IntegrationAnalysis {
  sampleId: string;
  sampleName: string;
  agreement: number;
  decision: "pass" | "escalate" | "warning";
  cost: number;
  timeline: string;
  details: string[];
  instrumentalPanel: {
    etongue: string;
    panelCata: string;
    correlation: number;
  }[];
  emotionalProfile: {
    positive: number;
    negative: number;
    hedonic: number;
  };
  qualitativeInsights: string[];
}

const MOCK_DATA: IntegrationAnalysis[] = [
  {
    sampleId: "S1",
    sampleName: "Sample 1",
    agreement: 87,
    decision: "pass",
    cost: 2000,
    timeline: "1 week",
    details: [
      "E-tongue low sourness (2.3) matches panel CATA 'sour' 1/14 (r=0.91)",
      "High saltiness (4.2) detected by 11/14 panelists (r=0.87)",
      "Emotional: Happy (3.8), Satisfied (4.1)",
    ],
    instrumentalPanel: [
      { etongue: "Saltiness 4.2", panelCata: "Salty 11/14", correlation: 0.87 },
      { etongue: "Umami 2.8", panelCata: "Savory 9/14", correlation: 0.72 },
      { etongue: "Sourness 2.3", panelCata: "Sour 1/14", correlation: 0.91 },
    ],
    emotionalProfile: { positive: 3.9, negative: 1.2, hedonic: 6.2 },
    qualitativeInsights: [
      "P3: 'Pleasant saltiness, reminds me of feta'",
      "P7: 'Clean flavor, no off-notes detected'",
    ]
  },
  {
    sampleId: "S3",
    sampleName: "Sample 3",
    agreement: 42,
    decision: "escalate",
    cost: 35000,
    timeline: "8 weeks",
    details: [
      "⚠ Butyric acid 12.4 ppm (threshold 8.0) - 'rancid' detected 9/14 (r=0.89)",
      "⚠ Hexanal 6.8 ppm - 'cardboard' detected 7/14 (r=0.78)",
      "⚠ High negative emotions: Disgusted (3.9), Worried (3.5)",
      "✗ Low hedonic (2.8/9) - requires expert analysis",
    ],
    instrumentalPanel: [
      { etongue: "Butyric acid 12.4ppm", panelCata: "Rancid 9/14", correlation: 0.89 },
      { etongue: "Hexanal 6.8ppm", panelCata: "Cardboard 7/14", correlation: 0.78 },
      { etongue: "Sourness 4.5", panelCata: "Sour 12/14", correlation: 0.84 },
    ],
    emotionalProfile: { positive: 1.8, negative: 3.7, hedonic: 2.8 },
    qualitativeInsights: [
      "P2: 'Strong rancid smell, unpleasant aftertaste'",
      "P8: 'Reminded me of spoiled milk'",
      "P11: 'Chemical-like flavor, couldn't finish sample'",
    ]
  },
  {
    sampleId: "S5",
    sampleName: "Sample 5",
    agreement: 78,
    decision: "pass",
    cost: 2000,
    timeline: "1 week",
    details: [
      "Umami (3.8) elevated - 'nutty' detected 10/14 (r=0.92)",
      "Sweetness (2.1) matches dairy reference (r=0.76)",
      "Emotional: Comfortable (3.7), Satisfied (3.5)",
    ],
    instrumentalPanel: [
      { etongue: "Umami 3.8", panelCata: "Nutty 10/14", correlation: 0.92 },
      { etongue: "Sweetness 2.1", panelCata: "Sweet 8/14", correlation: 0.76 },
    ],
    emotionalProfile: { positive: 3.6, negative: 1.5, hedonic: 6.8 },
    qualitativeInsights: [
      "P5: 'Nice cashew flavor, creamy texture'",
      "P12: 'Would buy this product'",
    ]
  },
  {
    sampleId: "S7",
    sampleName: "Sample 7",
    agreement: 65,
    decision: "warning",
    cost: 2000,
    timeline: "1 week + monitor",
    details: [
      "⚠ Acetaldehyde 8.1 ppm (threshold 3.5)",
      "Vocabulary gap: panelists mention 'yogurt-like' in comments",
      "Action: Add 'fermented' to CATA next cycle",
    ],
    instrumentalPanel: [
      { etongue: "Acetaldehyde 8.1ppm", panelCata: "Comments: 'yogurt'", correlation: 0.81 },
      { etongue: "Sourness 3.8", panelCata: "Tangy 10/14", correlation: 0.73 },
    ],
    emotionalProfile: { positive: 2.9, negative: 2.1, hedonic: 6.1 },
    qualitativeInsights: [
      "P4: 'Slightly yogurt-like flavor, not unpleasant'",
      "P9: 'Fermented note, similar to cultured dairy'",
    ]
  },
  {
    sampleId: "S12",
    sampleName: "Sample 12",
    agreement: 91,
    decision: "pass",
    cost: 2000,
    timeline: "1 week",
    details: [
      "Diacetyl 5.2 ppm - 'buttery' detected 12/14 (r=0.94)",
      "Vanillin 2.1 ppm - 'caramel' detected 8/14 (r=0.86)",
      "Emotional: Nostalgic (4.2), Happy (3.9)",
      "Hedonic high (7.4/9) - best performer",
    ],
    instrumentalPanel: [
      { etongue: "Diacetyl 5.2ppm", panelCata: "Buttery 12/14", correlation: 0.94 },
      { etongue: "Vanillin 2.1ppm", panelCata: "Caramel 8/14", correlation: 0.86 },
      { etongue: "Sweetness 2.2", panelCata: "Sweet 11/14", correlation: 0.82 },
    ],
    emotionalProfile: { positive: 4.1, negative: 1.1, hedonic: 7.4 },
    qualitativeInsights: [
      "P1: 'Best sample so far, reminds me of artisan cheese'",
      "P6: 'Rich buttery flavor, excellent mouthfeel'",
      "P13: 'This could compete with dairy options'",
    ]
  },
];

export function Stage4Integration() {
  const [selectedSample, setSelectedSample] = useState<string>("S3");
  const [showRawData, setShowRawData] = useState(false);
  const [showQualitative, setShowQualitative] = useState(false);
  const selected = MOCK_DATA.find(d => d.sampleId === selectedSample);

  const stats = {
    passed: MOCK_DATA.filter(d => d.decision === "pass").length,
    escalated: MOCK_DATA.filter(d => d.decision === "escalate").length,
    warnings: MOCK_DATA.filter(d => d.decision === "warning").length,
    totalCost: MOCK_DATA.reduce((sum, d) => sum + d.cost, 0),
    savings: (MOCK_DATA.length * 35000) - MOCK_DATA.reduce((sum, d) => sum + d.cost, 0),
    avgAgreement: Math.round(MOCK_DATA.reduce((sum, d) => sum + d.agreement, 0) / MOCK_DATA.length),
  };

  // Calculate overall correlation
  const avgCorrelation = MOCK_DATA.reduce((sum, sample) => {
    const sampleAvg = sample.instrumentalPanel.reduce((s, ip) => s + ip.correlation, 0) / sample.instrumentalPanel.length;
    return sum + sampleAvg;
  }, 0) / MOCK_DATA.length;

  const getDecisionIcon = (decision: string) => {
    if (decision === "pass") return <CheckCircle2 className="size-6 text-emerald-600" />;
    if (decision === "escalate") return <XCircle className="size-6 text-rose-600" />;
    return <AlertTriangle className="size-6 text-amber-600" />;
  };

  const getDecisionBadge = (decision: string) => {
    if (decision === "pass") return <Badge className="bg-emerald-600 text-white">Pass</Badge>;
    if (decision === "escalate") return <Badge className="bg-rose-600 text-white">Escalate</Badge>;
    return <Badge className="bg-amber-600 text-white">Warning</Badge>;
  };

  // Scatter plot data for Agreement vs Cost
  const costAgreementData = MOCK_DATA.map(d => ({
    sample: d.sampleName,
    agreement: d.agreement,
    cost: d.cost,
    decision: d.decision,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Stage 4: Integration & Decision</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowQualitative(!showQualitative)} variant="outline" size="sm">
            {showQualitative ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
            Qualitative
          </Button>
          <Button onClick={() => setShowRawData(!showRawData)} variant="outline" size="sm">
            {showRawData ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
            Raw Data
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-600">{stats.passed}</div>
            <div className="text-sm text-slate-600 mt-1">Passed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-rose-600">{stats.escalated}</div>
            <div className="text-sm text-slate-600 mt-1">Escalated</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-600">{stats.warnings}</div>
            <div className="text-sm text-slate-600 mt-1">Warnings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{stats.avgAgreement}%</div>
            <div className="text-sm text-slate-600 mt-1">Avg Agreement</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-slate-900">${(stats.totalCost/1000).toFixed(0)}k</div>
            <div className="text-sm text-slate-600 mt-1">Total Cost</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">${(stats.savings/1000).toFixed(0)}k</div>
            <div className="text-sm text-slate-600 mt-1">Saved</div>
          </CardContent>
        </Card>
      </div>

      {/* Agreement vs Cost Scatter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-blue-600" />
            Agreement Score vs Decision Cost
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="agreement" name="Agreement %" domain={[0, 100]} />
              <YAxis type="number" dataKey="cost" name="Cost ($)" domain={[0, 40000]} />
              <RechartsTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 shadow-xl rounded-lg border">
                        <p className="font-bold">{data.sample}</p>
                        <p className="text-sm">Agreement: {data.agreement}%</p>
                        <p className="text-sm">Cost: ${data.cost.toLocaleString()}</p>
                        <p className="text-sm capitalize">Decision: {data.decision}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="Samples" data={costAgreementData} fill="#3b82f6">
                {costAgreementData.map((entry, index) => {
                  let color = "#10b981"; // pass
                  if (entry.decision === "escalate") color = "#ef4444";
                  if (entry.decision === "warning") color = "#f59e0b";
                  return <Cell key={`cost-cell-${entry.sample}-${index}`} fill={color} />;
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-slate-700">
              <strong>Insight:</strong> Samples with &gt;70% agreement qualify for low-cost screening ($2k). 
              Only critical failures (&lt;50% agreement) escalate to full trained panels ($35k).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Instrumental-Panel Correlation Evidence */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Instrumental ↔ Panel Correlation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-center mb-4">
                <div className="text-6xl font-bold text-emerald-600">r = {avgCorrelation.toFixed(2)}</div>
                <div className="text-sm text-slate-600 mt-2">Average Pearson Correlation</div>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-sm text-slate-700">
                  <strong>Strong positive correlation</strong> between E-tongue/GC-MS measurements and 
                  semi-trained panel CATA responses validates the ISSF methodology as a credible replacement 
                  for expensive trained panels in screening contexts.
                </p>
              </div>
            </div>
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={MOCK_DATA.map(d => ({
                  sample: d.sampleId,
                  avgCorrelation: d.instrumentalPanel.reduce((s, ip) => s + ip.correlation, 0) / d.instrumentalPanel.length
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sample" />
                  <YAxis domain={[0, 1]} />
                  <RechartsTooltip />
                  <Bar dataKey="avgCorrelation" fill="#10b981" name="Avg r" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-6">
        {/* Sample List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Samples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {MOCK_DATA.map(sample => (
                <button
                  key={sample.sampleId}
                  onClick={() => setSelectedSample(sample.sampleId)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedSample === sample.sampleId
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{sample.sampleName}</span>
                    {getDecisionIcon(sample.decision)}
                  </div>
                  <div className="text-xs text-slate-600">{sample.agreement}% agreement</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="col-span-3 space-y-6">
          {selected && (
            <>
              <Card className={`border-2 ${
                selected.decision === "pass" ? "border-emerald-400 bg-emerald-50" :
                selected.decision === "warning" ? "border-amber-400 bg-amber-50" :
                "border-rose-400 bg-rose-50"
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selected.sampleName}</h2>
                      <div className="mt-2">{getDecisionBadge(selected.decision)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-5xl font-bold text-slate-900">{selected.agreement}%</div>
                      <div className="text-sm text-slate-600">Agreement</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200 mb-4">
                    <h3 className="font-bold text-slate-900 mb-2">Integration Summary</h3>
                    <ul className="space-y-2">
                      {selected.details.map((detail, idx) => (
                        <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="text-slate-400">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Instrumental-Panel Correlation Table */}
                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-3">Instrumental ↔ Panel Correlation</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">E-Tongue / GC-MS</th>
                          <th className="text-left p-2">Panel CATA Response</th>
                          <th className="text-center p-2">Correlation (r)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.instrumentalPanel.map((ip, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2 font-semibold">{ip.etongue}</td>
                            <td className="p-2">{ip.panelCata}</td>
                            <td className="p-2 text-center">
                              <Badge className={ip.correlation > 0.85 ? "bg-emerald-600" : ip.correlation > 0.70 ? "bg-blue-600" : "bg-amber-600"}>
                                {ip.correlation.toFixed(2)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Emotional Profile */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Emotional Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="text-3xl font-bold text-emerald-600">{selected.emotionalProfile.positive.toFixed(1)}</div>
                      <div className="text-sm text-slate-600 mt-1">Avg Positive Emotions</div>
                    </div>
                    <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
                      <div className="text-3xl font-bold text-rose-600">{selected.emotionalProfile.negative.toFixed(1)}</div>
                      <div className="text-sm text-slate-600 mt-1">Avg Negative Emotions</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-3xl font-bold text-blue-600">{selected.emotionalProfile.hedonic.toFixed(1)}/9</div>
                      <div className="text-sm text-slate-600 mt-1">Hedonic Liking</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Qualitative Insights */}
              {showQualitative && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Qualitative Insights (Panelist Comments)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selected.qualitativeInsights.map((insight, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-sm text-slate-700 italic">"{insight.split(': ')[1]}"</p>
                          <p className="text-xs text-slate-500 mt-1">— {insight.split(':')[0]}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cost Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="size-5" />
                      Cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">${selected.cost.toLocaleString()}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      vs. $35,000 full panel
                    </div>
                    {selected.decision !== "escalate" && (
                      <div className="mt-3 p-3 bg-emerald-100 rounded-lg">
                        <div className="text-sm font-bold text-emerald-900">
                          ${(35000 - selected.cost).toLocaleString()} saved ({Math.round(((35000 - selected.cost) / 35000) * 100)}%)
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="size-5" />
                      Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">{selected.timeline}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      vs. 8 weeks full panel
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Raw Data Export */}
      {showRawData && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Raw Integration Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2">
                    <th className="p-2 text-left">Sample</th>
                    <th className="p-2 text-center">Agreement %</th>
                    <th className="p-2 text-center">Avg r</th>
                    <th className="p-2 text-center">Hedonic</th>
                    <th className="p-2 text-center">Pos. Emotion</th>
                    <th className="p-2 text-center">Neg. Emotion</th>
                    <th className="p-2 text-left">Decision</th>
                    <th className="p-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_DATA.map((sample) => {
                    const avgR = sample.instrumentalPanel.reduce((s, ip) => s + ip.correlation, 0) / sample.instrumentalPanel.length;
                    return (
                      <tr key={sample.sampleId} className="border-b hover:bg-slate-50">
                        <td className="p-2 font-bold">{sample.sampleName}</td>
                        <td className="p-2 text-center">{sample.agreement}%</td>
                        <td className="p-2 text-center font-semibold">{avgR.toFixed(2)}</td>
                        <td className="p-2 text-center">{sample.emotionalProfile.hedonic}</td>
                        <td className="p-2 text-center text-emerald-600 font-semibold">{sample.emotionalProfile.positive}</td>
                        <td className="p-2 text-center text-rose-600 font-semibold">{sample.emotionalProfile.negative}</td>
                        <td className="p-2">
                          <Badge className={
                            sample.decision === "pass" ? "bg-emerald-600" :
                            sample.decision === "warning" ? "bg-amber-600" :
                            "bg-rose-600"
                          }>
                            {sample.decision}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-bold">${sample.cost.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}