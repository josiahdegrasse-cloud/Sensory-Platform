import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Save, ArrowLeft, Info, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { SAMPLES, CATA_ATTRIBUTES, ATTRIBUTE_LEXICON, ESSENSE_EMOTIONS, SAMPLE_PREP_PROTOCOL } from "../data/samples";
import { ENHANCED_SENSORY_DATA } from "../data/enhanced-sensory";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, Cell } from "recharts";

interface PanelistResponse {
  panelistId: string;
  sampleId: string;
  cataSelections: string[];
  hedonicAppearance: number;
  hedonicFlavour: number;
  hedonicTexture: number;
  hedonicOverall: number;
  emotions: Record<string, number>;
  comments: string;
  experienceLevel: string;
  sensoryTraining: string;
  confidence: string;
  testGroup: "informed" | "uninformed";
  timestamp: Date;
}

export function Stage2SemiTrained() {
  const [currentPanelist, setCurrentPanelist] = useState("P1");
  const [currentSample, setCurrentSample] = useState("S1");
  const [cataSelections, setCataSelections] = useState<string[]>([]);
  const [hedonicAppearance, setHedonicAppearance] = useState<number>(5);
  const [hedonicFlavour, setHedonicFlavour] = useState<number>(5);
  const [hedonicTexture, setHedonicTexture] = useState<number>(5);
  const [hedonicOverall, setHedonicOverall] = useState<number>(5);
  const [emotions, setEmotions] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [sensoryTraining, setSensoryTraining] = useState("");
  const [confidence, setConfidence] = useState("");
  const [testGroup, setTestGroup] = useState<"informed" | "uninformed">("uninformed");
  const [responses, setResponses] = useState<PanelistResponse[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const panelistIds = Array.from({ length: 14 }, (_, i) => `P${i + 1}`);
  const pbcaSamples = SAMPLES.filter(s => s.type === "pbca");

  const saveResponse = () => {
    const response: PanelistResponse = {
      panelistId: currentPanelist,
      sampleId: currentSample,
      cataSelections: [...cataSelections],
      hedonicAppearance,
      hedonicFlavour,
      hedonicTexture,
      hedonicOverall,
      emotions: { ...emotions },
      comments,
      experienceLevel,
      sensoryTraining,
      confidence,
      testGroup,
      timestamp: new Date(),
    };

    setResponses(prev => {
      const filtered = prev.filter(r => !(r.panelistId === currentPanelist && r.sampleId === currentSample));
      return [...filtered, response];
    });

    setCataSelections([]);
    setHedonicAppearance(5);
    setHedonicFlavour(5);
    setHedonicTexture(5);
    setHedonicOverall(5);
    setEmotions({});
    setComments("");

    const currentIdx = pbcaSamples.findIndex(s => s.id === currentSample);
    if (currentIdx < pbcaSamples.length - 1) {
      setCurrentSample(pbcaSamples[currentIdx + 1].id);
    }
  };

  const status = {
    total: panelistIds.length * pbcaSamples.length,
    completed: responses.length,
  };

  const getSampleSummary = (sampleId: string) => {
    const sampleResponses = responses.filter(r => r.sampleId === sampleId);
    if (sampleResponses.length === 0) return null;

    const avgHedonicAppearance = sampleResponses.reduce((sum, r) => sum + r.hedonicAppearance, 0) / sampleResponses.length;
    const avgHedonicFlavour = sampleResponses.reduce((sum, r) => sum + r.hedonicFlavour, 0) / sampleResponses.length;
    const avgHedonicTexture = sampleResponses.reduce((sum, r) => sum + r.hedonicTexture, 0) / sampleResponses.length;
    const avgHedonicOverall = sampleResponses.reduce((sum, r) => sum + r.hedonicOverall, 0) / sampleResponses.length;
    const cataFrequency: Record<string, number> = {};
    
    sampleResponses.forEach(r => {
      r.cataSelections.forEach(attr => {
        cataFrequency[attr] = (cataFrequency[attr] || 0) + 1;
      });
    });

    const topAttributes = Object.entries(cataFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    return { n: sampleResponses.length, avgHedonicAppearance: avgHedonicAppearance.toFixed(1), avgHedonicFlavour: avgHedonicFlavour.toFixed(1), avgHedonicTexture: avgHedonicTexture.toFixed(1), avgHedonicOverall: avgHedonicOverall.toFixed(1), topAttributes, cataFrequency };
  };

  // A/B Testing Analysis
  const getABComparison = () => {
    const informed = responses.filter(r => r.testGroup === "informed");
    const uninformed = responses.filter(r => r.testGroup === "uninformed");
    
    return {
      informed: {
        count: informed.length,
        avgCataCount: informed.length > 0 ? informed.reduce((sum, r) => sum + r.cataSelections.length, 0) / informed.length : 0,
        avgHedonicAppearance: informed.length > 0 ? informed.reduce((sum, r) => sum + r.hedonicAppearance, 0) / informed.length : 0,
        avgHedonicFlavour: informed.length > 0 ? informed.reduce((sum, r) => sum + r.hedonicFlavour, 0) / informed.length : 0,
        avgHedonicTexture: informed.length > 0 ? informed.reduce((sum, r) => sum + r.hedonicTexture, 0) / informed.length : 0,
        avgHedonicOverall: informed.length > 0 ? informed.reduce((sum, r) => sum + r.hedonicOverall, 0) / informed.length : 0,
      },
      uninformed: {
        count: uninformed.length,
        avgCataCount: uninformed.length > 0 ? uninformed.reduce((sum, r) => sum + r.cataSelections.length, 0) / uninformed.length : 0,
        avgHedonicAppearance: uninformed.length > 0 ? uninformed.reduce((sum, r) => sum + r.hedonicAppearance, 0) / uninformed.length : 0,
        avgHedonicFlavour: uninformed.length > 0 ? uninformed.reduce((sum, r) => sum + r.hedonicFlavour, 0) / uninformed.length : 0,
        avgHedonicTexture: uninformed.length > 0 ? uninformed.reduce((sum, r) => sum + r.hedonicTexture, 0) / uninformed.length : 0,
        avgHedonicOverall: uninformed.length > 0 ? uninformed.reduce((sum, r) => sum + r.hedonicOverall, 0) / uninformed.length : 0,
      }
    };
  };

  // Experience Level Analysis
  const getExperienceBreakdown = () => {
    const breakdown: Record<string, number> = {};
    responses.forEach(r => {
      breakdown[r.experienceLevel] = (breakdown[r.experienceLevel] || 0) + 1;
    });
    return Object.entries(breakdown).map(([level, count], index) => ({ 
      id: `exp-${index}`,
      level, 
      count 
    }));
  };

  // Correlation with instrumental data (mock ETongue correlation)
  const getInstrumentalCorrelation = (sampleId: string) => {
    const summary = getSampleSummary(sampleId);
    if (!summary) return null;

    // Mock correlation scores
    const mockCorrelations = {
      "S1": { saltiness: 0.87, umami: 0.72, sourness: 0.91 },
      "S3": { rancid: 0.89, cardboard: 0.78, sourness: 0.84 },
      "S5": { nutty: 0.92, umami: 0.88, sweetness: 0.76 },
      "S7": { fermented: 0.81, yeast: 0.73, sourness: 0.69 },
      "S12": { buttery: 0.94, caramel: 0.86, sweetness: 0.82 },
    };

    return mockCorrelations[sampleId as keyof typeof mockCorrelations] || null;
  };

  // Onboarding Screen
  if (!onboardingComplete) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Panelist Information</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Experience & Background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-semibold mb-2 block">Years of sensory evaluation experience</label>
              <div className="grid grid-cols-4 gap-2">
                {["0-1 years", "1-3 years", "3-5 years", "5+ years"].map(level => (
                  <button
                    key={level}
                    onClick={() => setExperienceLevel(level)}
                    className={`p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                      experienceLevel === level ? "border-blue-600 bg-blue-50" : "border-slate-300"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">Previous formal sensory panel participation</label>
              <div className="grid grid-cols-2 gap-2">
                {["Yes", "No"].map(option => (
                  <button
                    key={option}
                    onClick={() => setSensoryTraining(option)}
                    className={`p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                      sensoryTraining === option ? "border-blue-600 bg-blue-50" : "border-slate-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">Self-assessed confidence in flavor identification</label>
              <div className="grid grid-cols-3 gap-2">
                {["Low", "Medium", "High"].map(level => (
                  <button
                    key={level}
                    onClick={() => setConfidence(level)}
                    className={`p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                      confidence === level ? "border-blue-600 bg-blue-50" : "border-slate-300"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">A/B Test Group</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTestGroup("uninformed")}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    testGroup === "uninformed" ? "border-blue-600 bg-blue-50" : "border-slate-300"
                  }`}
                >
                  <div className="font-bold mb-1">Uninformed</div>
                  <div className="text-xs text-slate-600">No prior instrumental data</div>
                </button>
                <button
                  onClick={() => setTestGroup("informed")}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    testGroup === "informed" ? "border-blue-600 bg-blue-50" : "border-slate-300"
                  }`}
                >
                  <div className="font-bold mb-1">Informed</div>
                  <div className="text-xs text-slate-600">Briefed with E-tongue data</div>
                </button>
              </div>
            </div>

            <Button 
              onClick={() => setOnboardingComplete(true)}
              className="w-full py-6 text-lg"
              disabled={!experienceLevel || !sensoryTraining || !confidence}
            >
              Continue to Questionnaire
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSummary) {
    const abComparison = getABComparison();
    const experienceData = getExperienceBreakdown();

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Comprehensive Panel Analysis</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowRawData(!showRawData)} variant="outline">
              {showRawData ? "Hide" : "Show"} Raw Data
            </Button>
            <Button onClick={() => setShowSummary(false)} variant="outline">
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-4xl font-bold text-blue-600">{status.completed}</div>
              <div className="text-sm text-slate-600 mt-1">Total Evaluations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-4xl font-bold text-blue-600">{pbcaSamples.length}</div>
              <div className="text-sm text-slate-600 mt-1">Samples Evaluated</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-4xl font-bold text-blue-600">
                {responses.filter(r => r.comments.length > 0).length}
              </div>
              <div className="text-sm text-slate-600 mt-1">Qualitative Comments</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-4xl font-bold text-emerald-600">
                {Math.round((status.completed / status.total) * 100)}%
              </div>
              <div className="text-sm text-slate-600 mt-1">Progress</div>
            </CardContent>
          </Card>
        </div>

        {/* A/B Testing Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-blue-600" />
              A/B Testing: Informed vs Uninformed Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { 
                  id: 'cata',
                  metric: "Avg CATA Attributes", 
                  Informed: abComparison.informed.avgCataCount, 
                  Uninformed: abComparison.uninformed.avgCataCount 
                },
                { 
                  id: 'appearance',
                  metric: "Avg Hedonic Appearance", 
                  Informed: abComparison.informed.avgHedonicAppearance, 
                  Uninformed: abComparison.uninformed.avgHedonicAppearance 
                },
                { 
                  id: 'flavour',
                  metric: "Avg Hedonic Flavour", 
                  Informed: abComparison.informed.avgHedonicFlavour, 
                  Uninformed: abComparison.uninformed.avgHedonicFlavour 
                },
                { 
                  id: 'texture',
                  metric: "Avg Hedonic Texture", 
                  Informed: abComparison.informed.avgHedonicTexture, 
                  Uninformed: abComparison.uninformed.avgHedonicTexture 
                },
                { 
                  id: 'overall',
                  metric: "Avg Hedonic Overall", 
                  Informed: abComparison.informed.avgHedonicOverall, 
                  Uninformed: abComparison.uninformed.avgHedonicOverall 
                },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Informed" fill="#3b82f6" />
                <Bar dataKey="Uninformed" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="font-bold text-blue-900 mb-2">Informed Group (n={abComparison.informed.count})</div>
                <div className="text-sm text-slate-700">
                  Briefed with E-tongue instrumental data before evaluation
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900 mb-2">Uninformed Group (n={abComparison.uninformed.count})</div>
                <div className="text-sm text-slate-700">
                  No prior information, standard blind evaluation
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Experience Level Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Panelist Experience Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={experienceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sample Results with Instrumental Correlation */}
        <Card>
          <CardHeader>
            <CardTitle>Sample-by-Sample Results + Instrumental Correlation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {pbcaSamples.map(sample => {
                const summary = getSampleSummary(sample.id);
                const correlation = getInstrumentalCorrelation(sample.id);
                if (!summary) return null;

                return (
                  <div key={sample.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-bold text-slate-900 text-lg">{sample.name}</div>
                        <div className="text-sm text-slate-600">n = {summary.n} panelists</div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-blue-600">{summary.avgHedonicOverall}/9</div>
                        <div className="text-xs text-slate-600">Avg Hedonic</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Top CATA Attributes</h4>
                        <div className="flex flex-wrap gap-2">
                          {summary.topAttributes.map(([attr, count]) => (
                            <Badge key={attr} className="bg-blue-100 text-blue-900">
                              {attr} ({count}/{summary.n})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {correlation && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">Instrumental Correlation (r)</h4>
                          <div className="space-y-1">
                            {Object.entries(correlation).map(([attr, r]) => (
                              <div key={attr} className="flex items-center justify-between text-sm">
                                <span className="text-slate-700 capitalize">{attr}</span>
                                <Badge className={r > 0.85 ? "bg-emerald-600" : r > 0.70 ? "bg-blue-600" : "bg-amber-600"}>
                                  r = {r.toFixed(2)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* CATA Frequency Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>CATA Frequency Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b font-bold sticky left-0 bg-white">Attribute</th>
                    {pbcaSamples.map(s => (
                      <th key={s.id} className="p-2 border-b text-center font-bold">{s.id}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CATA_ATTRIBUTES.map(attr => (
                    <tr key={attr}>
                      <td className="p-2 border-b font-semibold sticky left-0 bg-white">{attr}</td>
                      {pbcaSamples.map(s => {
                        const count = responses.filter(r => r.sampleId === s.id && r.cataSelections.includes(attr)).length;
                        const total = responses.filter(r => r.sampleId === s.id).length;
                        const percentage = total > 0 ? (count / total) * 100 : 0;
                        
                        let bgColor = "bg-white";
                        if (percentage > 60) bgColor = "bg-rose-300";
                        else if (percentage > 40) bgColor = "bg-amber-300";
                        else if (percentage > 20) bgColor = "bg-blue-300";
                        else if (percentage > 0) bgColor = "bg-slate-200";

                        return (
                          <td key={s.id} className={`p-2 border-b text-center font-semibold ${bgColor}`}>
                            {total > 0 ? `${Math.round(percentage)}%` : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Qualitative Comments */}
        {showRawData && (
          <Card>
            <CardHeader>
              <CardTitle>Qualitative Comments (Raw Data)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {responses.filter(r => r.comments.length > 0).map((r, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{r.panelistId} - {r.sampleId}</span>
                      <span className="text-xs text-slate-500">{r.timestamp.toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 italic">"{r.comments}"</p>
                    <div className="flex gap-2 mt-2">
                      <Badge className="bg-purple-100 text-purple-900 text-xs">{r.experienceLevel}</Badge>
                      <Badge className="bg-blue-100 text-blue-900 text-xs">{r.testGroup}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Raw Response Data Table */}
        {showRawData && (
          <Card>
            <CardHeader>
              <CardTitle>Complete Raw Data Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2">
                      <th className="p-2 text-left">Panelist</th>
                      <th className="p-2 text-left">Sample</th>
                      <th className="p-2 text-left">CATA Count</th>
                      <th className="p-2 text-center">Hedonic Appearance</th>
                      <th className="p-2 text-center">Hedonic Flavour</th>
                      <th className="p-2 text-center">Hedonic Texture</th>
                      <th className="p-2 text-center">Hedonic Overall</th>
                      <th className="p-2 text-left">Experience</th>
                      <th className="p-2 text-left">Group</th>
                      <th className="p-2 text-left">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((r, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50">
                        <td className="p-2 font-semibold">{r.panelistId}</td>
                        <td className="p-2">{r.sampleId}</td>
                        <td className="p-2">{r.cataSelections.length}</td>
                        <td className="p-2 text-center font-bold">{r.hedonicAppearance}</td>
                        <td className="p-2 text-center font-bold">{r.hedonicFlavour}</td>
                        <td className="p-2 text-center font-bold">{r.hedonicTexture}</td>
                        <td className="p-2 text-center font-bold">{r.hedonicOverall}</td>
                        <td className="p-2 text-xs">{r.experienceLevel}</td>
                        <td className="p-2 text-xs">{r.testGroup}</td>
                        <td className="p-2 text-xs">{r.timestamp.toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Stage 2: Panel Questionnaire</h1>
        <Button onClick={() => setShowSummary(true)} variant="outline">
          View Analysis ({status.completed}/{status.total})
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold mb-2 block">Panelist</label>
          <select 
            value={currentPanelist}
            onChange={(e) => setCurrentPanelist(e.target.value)}
            className="w-full p-2 border-2 border-slate-300 rounded-lg"
          >
            {panelistIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold mb-2 block">Sample</label>
          <select 
            value={currentSample}
            onChange={(e) => setCurrentSample(e.target.value)}
            className="w-full p-2 border-2 border-slate-300 rounded-lg"
          >
            {pbcaSamples.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Test Group Indicator */}
      <Card className={testGroup === "informed" ? "border-2 border-blue-400 bg-blue-50" : "border-2 border-slate-300"}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900">Current Test Group: </span>
              <Badge className={testGroup === "informed" ? "bg-blue-600" : "bg-slate-600"}>
                {testGroup.toUpperCase()}
              </Badge>
            </div>
            {testGroup === "informed" && (
              <div className="text-sm text-slate-700">
                📊 Briefed with E-tongue data for this sample
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CATA with Tooltips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Select All Attributes You Perceive
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="size-4 text-slate-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">Hover over each attribute for lexicon definition</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-2">
            <TooltipProvider>
              {CATA_ATTRIBUTES.map(attr => (
                <Tooltip key={attr}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCataSelections(prev => 
                        prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
                      )}
                      className={`p-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                        cataSelections.includes(attr)
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-300 hover:border-blue-300"
                      }`}
                    >
                      {attr}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">{ATTRIBUTE_LEXICON[attr]}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Hedonic */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Liking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-9 gap-2">
            {[9, 8, 7, 6, 5, 4, 3, 2, 1].map(value => (
              <button
                key={value}
                onClick={() => setHedonicOverall(value)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  hedonicOverall === value
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-300 hover:border-blue-300"
                }`}
              >
                <div className="text-2xl font-bold">{value}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 text-center text-sm text-slate-600">
            9 = Like extremely | 5 = Neither | 1 = Dislike extremely
          </div>
        </CardContent>
      </Card>

      {/* Emotions */}
      <Card>
        <CardHeader>
          <CardTitle>Emotional Response (1-5)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {ESSENSE_EMOTIONS.map(({ emotion }) => (
              <div key={emotion} className="p-3 bg-slate-50 rounded-lg">
                <div className="font-semibold text-sm mb-2">{emotion}</div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      onClick={() => setEmotions(prev => ({ ...prev, [emotion]: value }))}
                      className={`flex-1 p-2 rounded border-2 transition-all ${
                        emotions[emotion] === value
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-300"
                      }`}
                    >
                      <span className="text-xs font-bold">{value}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Qualitative Comments */}
      <Card>
        <CardHeader>
          <CardTitle>Comments (Optional but Valuable)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Describe any unusual perceptions, off-notes, or unexpected interactions..."
            className="w-full p-3 border-2 border-slate-300 rounded-lg resize-none"
            rows={4}
          />
        </CardContent>
      </Card>

      <Button onClick={saveResponse} className="w-full py-6 text-lg" disabled={cataSelections.length === 0}>
        <Save className="size-5 mr-2" />
        Save & Continue
      </Button>
    </div>
  );
}