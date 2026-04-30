import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend, Cell, LineChart, Line
} from "recharts";
import { ENHANCED_SENSORY_DATA } from "../data/enhanced-sensory";
import { ESSENSE25_EMOTIONS, type QuestionnaireResponse } from "../data/mock-users";
import { getSampleColor, SAMPLE_TYPE_LEGEND } from "../utils/sample-colors";
import { fetchAllResponses, fetchProducts } from "../lib/database";
import {
  Users, Heart, Smile, Frown, CheckSquare,
  TrendingUp, AlertCircle, Eye, EyeOff, Download, Layers, Target, Trophy
} from "lucide-react";

const RESEARCH_PANEL_N = 14;

interface LiveAggregation {
  productId: string;
  productName: string;
  n: number;
  cata: Record<string, number>;
  intensity: Record<string, number>;
  hedonic: Record<string, number>;
  emotions: { positive: number; negative: number };
}

export function SurveyAnalysis() {
  const [selectedSample, setSelectedSample] = useState<string>("S1");
  const [showAllSamples, setShowAllSamples] = useState(false);
  const [foodTypeFilter, setFoodTypeFilter] = useState<string>("all");
  const [analysisType, setAnalysisType] = useState<'single' | 'multi'>('single');
  const [multiSampleResponses, setMultiSampleResponses] = useState<any[]>([]);
  const [selectedMultiProduct, setSelectedMultiProduct] = useState<string>('');
  const [liveAggregations, setLiveAggregations] = useState<LiveAggregation[]>([]);

  // Single fetch — split into multi-sample responses and single-sample aggregations
  useEffect(() => {
    fetchAllResponses().then(allResponses => {
      // Multi-sample
      const multiResponses = allResponses.filter((r: any) => (r as any).sessionType === '3-sample-sequential');
      setMultiSampleResponses(multiResponses);
      if (multiResponses.length > 0 && !selectedMultiProduct) {
        setSelectedMultiProduct(multiResponses[0].productId);
      }

      // Single-sample aggregation
      const singleResponses = allResponses.filter((r: any) => !(r as any).sessionType);
    if (singleResponses.length === 0) return;

    const grouped = new Map<string, QuestionnaireResponse[]>();
    singleResponses.forEach(r => {
      if (!grouped.has(r.productId)) grouped.set(r.productId, []);
      grouped.get(r.productId)!.push(r);
    });

    const aggregations: LiveAggregation[] = [];
    grouped.forEach((resps, productId) => {
      const product = { name: productId };
      const n = resps.length;

      const cata: Record<string, number> = {};
      resps.forEach(r => {
        (r.cataAttributes || []).forEach(attr => { cata[attr] = (cata[attr] || 0) + 1; });
      });

      const intensityTotals: Record<string, { sum: number; count: number }> = {};
      resps.forEach(r => {
        Object.entries(r.intensityRatings || {}).forEach(([attr, val]) => {
          if (!intensityTotals[attr]) intensityTotals[attr] = { sum: 0, count: 0 };
          intensityTotals[attr].sum += Number(val);
          intensityTotals[attr].count += 1;
        });
      });

      const hedonicKeys = ['overall', 'appearance', 'aroma', 'flavor', 'texture'] as const;
      const hedonicSums: Record<string, number> = { overall: 0, appearance: 0, aroma: 0, flavor: 0, texture: 0 };
      resps.forEach(r => {
        hedonicKeys.forEach(k => { hedonicSums[k] += (r.hedonicScores as Record<string, number>)?.[k] || 0; });
      });

      let posSum = 0, negSum = 0;
      resps.forEach(r => {
        ESSENSE25_EMOTIONS.positive.forEach(e => { posSum += (r.emotionalProfile || {})[e] || 0; });
        ESSENSE25_EMOTIONS.negative.forEach(e => { negSum += (r.emotionalProfile || {})[e] || 0; });
      });

      aggregations.push({
        productId,
        productName: product?.name || productId,
        n,
        cata,
        intensity: Object.fromEntries(
          Object.entries(intensityTotals).map(([k, v]) => [k, v.sum / v.count])
        ),
        hedonic: Object.fromEntries(hedonicKeys.map(k => [k, hedonicSums[k] / n])),
        emotions: {
          positive: posSum / (n * ESSENSE25_EMOTIONS.positive.length),
          negative: negSum / (n * ESSENSE25_EMOTIONS.negative.length),
        },
      });
    });

      setLiveAggregations(aggregations);
    }).catch(console.error);
  }, []);

  // Get unique food types from samples
  const foodTypes = ["all", "Cheese", "Bread"];

  // Filter samples by food type
  const filteredSamples = foodTypeFilter === "all" 
    ? ENHANCED_SENSORY_DATA 
    : ENHANCED_SENSORY_DATA.filter(s => {
        // Add logic to filter by category if you have that data
        // For now, showing all for demonstration
        return true;
      });

  const selectedData = filteredSamples.find(s => s.sampleId === selectedSample);

  if (!selectedData) return null;

  // Calculate CATA frequencies across all attributes
  const cataAttributes = Object.entries(selectedData.cata)
    .map(([attr, count]) => ({
      id: `cata-${attr}`,
      attribute: attr,
      count: count,
      percentage: (count / 14) * 100 // 14 panelists
    }))
    .sort((a, b) => b.count - a.count);

  // Intensity ratings for radar chart
  const intensityData = Object.entries(selectedData.intensity).map(([key, value]) => ({
    id: `intensity-${key}`,
    attribute: key.replace(/([A-Z])/g, ' $1').trim(),
    value: value,
    fullMark: 10
  }));

  // Hedonic scores
  const hedonicData = [
    { id: 'hedonic-appearance', category: "Appearance", score: selectedData.hedonic.appearance },
    { id: 'hedonic-flavour', category: "Flavour", score: selectedData.hedonic.flavour },
    { id: 'hedonic-texture', category: "Texture", score: selectedData.hedonic.texture },
    { id: 'hedonic-overall', category: "Overall", score: selectedData.hedonic.overall }
  ];

  // All samples comparison for hedonic overall
  const allSamplesHedonic = ENHANCED_SENSORY_DATA.map(s => ({
    id: `all-hedonic-${s.sampleId}`,
    name: s.sampleName,
    overall: s.hedonic.overall,
    flavour: s.hedonic.flavour,
    texture: s.hedonic.texture,
    appearance: s.hedonic.appearance
  }));

  // Color coding for hedonic scores
  const getHedonicColor = (score: number) => {
    if (score >= 7) return "#10b981"; // emerald
    if (score >= 5) return "#f59e0b"; // amber
    return "#ef4444"; // rose
  };

  // Summary stats
  const avgHedonic = (hedonicData.reduce((sum, d) => sum + d.score, 0) / 4).toFixed(1);
  const avgIntensity = (Object.values(selectedData.intensity).reduce((sum, v) => sum + v, 0) / 
                        Object.keys(selectedData.intensity).length).toFixed(1);
  const topCataCount = cataAttributes.length > 0 ? cataAttributes[0].count : 0;
  const emotionalBalance = (selectedData.emotions.positive - selectedData.emotions.negative).toFixed(1);

  // Auto-match: if panelists have submitted responses for this exact product name, use that data
  const matchingLiveData = liveAggregations.find(
    a => a.productName.toLowerCase() === selectedData.sampleName.toLowerCase()
  );
  const usingLiveData = !!matchingLiveData;

  const activeCataAttributes = matchingLiveData
    ? Object.entries(matchingLiveData.cata)
        .map(([attr, count]) => ({
          id: `cata-${attr}`,
          attribute: attr,
          count,
          percentage: (count / matchingLiveData.n) * 100,
        }))
        .sort((a, b) => b.count - a.count)
    : cataAttributes;

  const activeIntensityData = matchingLiveData
    ? Object.entries(matchingLiveData.intensity).map(([key, value]) => ({
        id: `intensity-${key}`,
        attribute: key,
        value: Number(value),
        fullMark: 10,
      }))
    : intensityData;

  const activeHedonicData = matchingLiveData
    ? [
        { id: 'hedonic-overall',    category: 'Overall',    score: matchingLiveData.hedonic['overall'] ?? 0 },
        { id: 'hedonic-appearance', category: 'Appearance', score: matchingLiveData.hedonic['appearance'] ?? 0 },
        { id: 'hedonic-aroma',      category: 'Aroma',      score: matchingLiveData.hedonic['aroma'] ?? 0 },
        { id: 'hedonic-flavor',     category: 'Flavour',    score: matchingLiveData.hedonic['flavor'] ?? 0 },
        { id: 'hedonic-texture',    category: 'Texture',    score: matchingLiveData.hedonic['texture'] ?? 0 },
      ]
    : hedonicData;

  const activeEmotions    = matchingLiveData ? matchingLiveData.emotions : selectedData.emotions;
  const activePanelistN   = matchingLiveData ? matchingLiveData.n : RESEARCH_PANEL_N;
  const activeSampleId    = selectedData.sampleId;

  const activeAvgHedonic = (activeHedonicData.reduce((s, d) => s + d.score, 0) / activeHedonicData.length).toFixed(1);
  const activeAvgIntensity = activeIntensityData.length > 0
    ? (activeIntensityData.reduce((s, d) => s + d.value, 0) / activeIntensityData.length).toFixed(1)
    : '0.0';
  const activeTopCataCount     = activeCataAttributes.length > 0 ? activeCataAttributes[0].count : 0;
  const activeEmotionalBalance = (activeEmotions.positive - activeEmotions.negative).toFixed(1);

  const exportSampleCSV = () => {
    if (!selectedData) return;
    
    const headers = ['Attribute', 'Value', 'Type', 'Category'];
    const rows: string[] = [headers.join(',')];
    
    // CATA attributes
    Object.entries(selectedData.cata).forEach(([attr, count]) => {
      rows.push(`${attr},${count},CATA,CheckAllThatApply`);
    });
    
    // Intensity ratings
    Object.entries(selectedData.intensity).forEach(([attr, value]) => {
      rows.push(`${attr},${value},Intensity,Scale0to10`);
    });
    
    // Hedonic scores
    Object.entries(selectedData.hedonic).forEach(([attr, value]) => {
      rows.push(`${attr},${value},Hedonic,Scale1to9`);
    });
    
    // Emotions
    rows.push(`Positive,${activeEmotions.positive},Emotion,Balance`);
    rows.push(`Negative,${activeEmotions.negative},Emotion,Balance`);
    
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-${selectedSample}-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Get multi-sample products
  const [multiSampleProducts, setMultiSampleProducts] = useState<import('../data/mock-users').Product[]>([]);
  useEffect(() => {
    fetchProducts().then(all => setMultiSampleProducts(all.filter(p => p.isMultiSample))).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Survey Data Analysis</h1>
          <p className="text-slate-600 mt-2">
            {analysisType === 'single'
              ? `${usingLiveData ? 'Live panel responses' : 'E-Tongue + GC-MS + Semi-trained Panel'} (n=${activePanelistN}) — CATA, Intensity, Hedonic, Emotional`
              : 'Multi-sample comparative evaluations - Discrimination, Ranking, Preferences'}
          </p>
        </div>
        <div className="flex gap-2">
          {analysisType === 'single' && (
            <>
              <Button onClick={exportSampleCSV} variant="outline">
                <Download className="size-4 mr-2" />
                Export Sample CSV
              </Button>
              <Button
                onClick={() => setShowAllSamples(!showAllSamples)}
                variant="outline"
              >
                {showAllSamples ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
                {showAllSamples ? "Single Sample" : "All Samples"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Analysis Type Toggle */}
      <div className="grid grid-cols-2 gap-3 max-w-2xl">
        <button
          onClick={() => setAnalysisType('single')}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            analysisType === 'single'
              ? 'border-blue-600 bg-blue-50'
              : 'border-slate-200 hover:border-blue-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              analysisType === 'single' ? 'bg-blue-600' : 'bg-slate-200'
            }`}>
              <Users className={`size-5 ${analysisType === 'single' ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <div className="font-bold text-slate-900">Single-Sample Analysis</div>
              <p className="text-xs text-slate-600">CATA, Intensity, Hedonic, Emotions</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setAnalysisType('multi')}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            analysisType === 'multi'
              ? 'border-purple-600 bg-gradient-to-br from-purple-50 to-pink-50'
              : 'border-slate-200 hover:border-purple-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              analysisType === 'multi' ? 'bg-purple-600' : 'bg-slate-200'
            }`}>
              <Layers className={`size-5 ${analysisType === 'multi' ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <div className="font-bold text-slate-900">Multi-Sample Analysis</div>
              <p className="text-xs text-slate-600">Discrimination, Ranking, Comparison</p>
            </div>
          </div>
        </button>
      </div>

      {analysisType === 'single' && usingLiveData && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-800 font-medium">
            Showing live panel responses for <strong>{selectedData.sampleName}</strong> (n={matchingLiveData?.n})
          </span>
        </div>
      )}

      {analysisType === 'single' ? (
        <>
          {/* Food Type Filter Tabs */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">Filter:</span>
            <div className="flex gap-2">
              {foodTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setFoodTypeFilter(type)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    foodTypeFilter === type
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {type === "all" ? "All Products" : type}
                </button>
              ))}
            </div>
          </div>

      {/* Sample Selector */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 border-b">
          <CardTitle className="text-lg">Select Sample</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-2">
            {filteredSamples.map(sample => {
              const typeColor = getSampleColor(sample.sampleName);
              const isSelected = selectedSample === sample.sampleId;
              return (
                <button
                  key={sample.sampleId}
                  onClick={() => setSelectedSample(sample.sampleId)}
                  className="p-3 rounded-lg border-2 transition-all text-center"
                  style={{
                    borderColor: isSelected ? typeColor : '#e2e8f0',
                    backgroundColor: isSelected ? `${typeColor}18` : 'white',
                  }}
                >
                  <div className="font-bold text-slate-900 text-xs leading-tight">{sample.sampleName}</div>
                  <div className="text-xs mt-1 font-semibold" style={{ color: typeColor }}>
                    {sample.hedonic.overall.toFixed(1)}/9
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Heart className="size-8 text-rose-500" />
              <div>
                <div className="text-2xl font-bold text-slate-900">{activeAvgHedonic}</div>
                <div className="text-sm text-slate-600">Avg Hedonic</div>
                <div className="text-xs text-slate-500">1-9 scale</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckSquare className="size-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-slate-900">{activeTopCataCount}/{activePanelistN}</div>
                <div className="text-sm text-slate-600">Top CATA</div>
                <div className="text-xs text-slate-500">{activeCataAttributes[0]?.attribute || "N/A"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="size-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold text-slate-900">{activeAvgIntensity}</div>
                <div className="text-sm text-slate-600">Avg Intensity</div>
                <div className="text-xs text-slate-500">0-10 scale</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {parseFloat(activeEmotionalBalance) >= 0 ? (
                <Smile className="size-8 text-emerald-500" />
              ) : (
                <Frown className="size-8 text-amber-500" />
              )}
              <div>
                <div className="text-2xl font-bold text-slate-900">{activeEmotionalBalance}</div>
                <div className="text-sm text-slate-600">Emotion Balance</div>
                <div className="text-xs text-slate-500">Pos - Neg</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!showAllSamples ? (
        // Single Sample Detailed View
        <Tabs defaultValue="cata" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="cata">CATA Attributes</TabsTrigger>
            <TabsTrigger value="intensity">Intensity Ratings</TabsTrigger>
            <TabsTrigger value="hedonic">Hedonic Scores</TabsTrigger>
            <TabsTrigger value="emotional">Emotional Profile</TabsTrigger>
          </TabsList>

          {/* CATA Analysis */}
          <TabsContent value="cata">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="size-5 text-blue-600" />
                  Check-All-That-Apply (CATA) Results
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Frequency of attribute selection across {activePanelistN} {usingLiveData ? 'panelists (live)' : 'semi-trained panelists'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-3">Top Attributes (CATA)</h3>
                  <ResponsiveContainer width="100%" height={400} key={`cata-chart-container-${activeSampleId}`}>
                    <BarChart
                      data={activeCataAttributes}
                      layout="vertical"
                      margin={{ left: 100 }}
                      id={`cata-chart-${activeSampleId}`}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, activePanelistN]} />
                      <YAxis type="category" dataKey="attribute" width={90} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 shadow-lg rounded-lg border">
                                <p className="font-bold text-slate-900">{data.attribute}</p>
                                <p className="text-sm text-slate-700">Count: {data.count}/{activePanelistN}</p>
                                <p className="text-sm text-slate-700">Percentage: {data.percentage.toFixed(0)}%</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" isAnimationActive={false}>
                        {activeCataAttributes.map((entry) => (
                          <Cell
                            key={`cell-${entry.id}`}
                            fill={entry.count >= 10 ? "#10b981" : entry.count >= 7 ? "#3b82f6" : "#64748b"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                        <span className="text-sm font-semibold text-emerald-900">Strong Agreement (≥70%)</span>
                      </div>
                      <div className="text-xs text-emerald-700">
                        {activeCataAttributes.filter(a => a.count >= activePanelistN * 0.7).map(a => a.attribute).join(", ") || "None"}
                      </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <span className="text-sm font-semibold text-blue-900">Moderate (50–70%)</span>
                      </div>
                      <div className="text-xs text-blue-700">
                        {activeCataAttributes.filter(a => a.count >= activePanelistN * 0.5 && a.count < activePanelistN * 0.7).map(a => a.attribute).join(", ") || "None"}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                        <span className="text-sm font-semibold text-slate-900">Weak (&lt;50%)</span>
                      </div>
                      <div className="text-xs text-slate-700">
                        {activeCataAttributes.filter(a => a.count < activePanelistN * 0.5).map(a => a.attribute).join(", ") || "None"}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intensity Ratings */}
          <TabsContent value="intensity">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-purple-600" />
                  Sensory Intensity Ratings (0-10 scale)
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Mean intensity scores from {activePanelistN} {usingLiveData ? 'panelists (live)' : 'semi-trained panelists'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <ResponsiveContainer width="100%" height={350}>
                      <RadarChart data={activeIntensityData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="attribute" />
                        <PolarRadiusAxis angle={90} domain={[0, 10]} />
                        <Radar 
                          name="Intensity" 
                          dataKey="value" 
                          stroke="#8b5cf6" 
                          fill="#8b5cf6" 
                          fillOpacity={0.6} 
                        />
                        <RechartsTooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {activeIntensityData.map(({ attribute, value }) => {
                      const label = attribute.replace(/([A-Z])/g, ' $1').trim();
                      const color = value >= 7 ? "emerald" : value >= 4 ? "blue" : "slate";
                      return (
                        <div key={attribute} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize font-medium text-slate-700">{label}</span>
                            <Badge className={`bg-${color}-600 text-white`}>
                              {value.toFixed(1)}/10
                            </Badge>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-3">
                            <div
                              className={`bg-${color}-600 h-3 rounded-full transition-all`}
                              style={{ width: `${(value / 10) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-purple-900">
                      <strong>Panel Training:</strong> Semi-trained panelists completed 3-hour HFD (Human Factors Design) 
                      training on intensity rating calibration using reference standards.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hedonic Scores */}
          <TabsContent value="hedonic">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="size-5 text-rose-600" />
                  Hedonic Liking Scores (9-point scale)
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Consumer acceptance ratings: 1 = Dislike Extremely, 9 = Like Extremely
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={activeHedonicData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis domain={[0, 9]} />
                    <RechartsTooltip />
                    <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                      {activeHedonicData.map((entry) => (
                        <Cell key={`hedonic-bar-${entry.id}`} fill={getHedonicColor(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 grid grid-cols-4 gap-4">
                  {activeHedonicData.map(item => {
                    const color = item.score >= 7 ? "emerald" : item.score >= 5 ? "amber" : "rose";
                    const interpretation =
                      item.score >= 7 ? "Liked" :
                      item.score >= 5 ? "Neither like nor dislike" :
                      "Disliked";

                    return (
                      <div key={item.category} className={`p-4 bg-${color}-50 rounded-lg border border-${color}-200`}>
                        <div className={`text-xs text-${color}-700 mb-1`}>{item.category}</div>
                        <div className={`text-3xl font-bold text-${color}-900`}>{item.score.toFixed(1)}</div>
                        <div className={`text-xs text-${color}-600 mt-1`}>{interpretation}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Average Score:</span>
                      <span className="font-bold text-slate-900">{activeAvgHedonic}/9</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Highest Dimension:</span>
                      <span className="font-bold text-slate-900">
                        {activeHedonicData.reduce((max, item) => item.score > max.score ? item : max).category}
                        ({activeHedonicData.reduce((max, item) => item.score > max.score ? item : max).score.toFixed(1)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Lowest Dimension:</span>
                      <span className="font-bold text-slate-900">
                        {activeHedonicData.reduce((min, item) => item.score < min.score ? item : min).category}
                        ({activeHedonicData.reduce((min, item) => item.score < min.score ? item : min).score.toFixed(1)})
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Emotional Profile */}
          <TabsContent value="emotional">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-blue-600" />
                  Emotional Response Profile (EsSense25)
                </CardTitle>
                <p className="text-sm text-slate-600">
                  17 positive + 8 negative emotions rated on 0-5 scale
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-gradient-to-br from-emerald-50 to-white rounded-xl border-2 border-emerald-200">
                    <div className="flex items-center gap-3 mb-4">
                      <Smile className="size-10 text-emerald-600" />
                      <div>
                        <div className="text-sm text-emerald-700">Positive Emotions</div>
                        <div className="text-4xl font-bold text-emerald-900">
                          {activeEmotions.positive.toFixed(1)}
                        </div>
                        <div className="text-xs text-emerald-600">Average of 17 attributes</div>
                      </div>
                    </div>
                    <div className="text-xs text-emerald-700 space-y-1">
                      <p>Includes: Happy, Satisfied, Pleased, Contented, Good, Calm, Secure, Comfortable, 
                        Enthusiastic, Energetic, Active, Adventurous, Interested, Warm, Loving, Affectionate, Nostalgic</p>
                    </div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-rose-50 to-white rounded-xl border-2 border-rose-200">
                    <div className="flex items-center gap-3 mb-4">
                      <Frown className="size-10 text-rose-600" />
                      <div>
                        <div className="text-sm text-rose-700">Negative Emotions</div>
                        <div className="text-4xl font-bold text-rose-900">
                          {activeEmotions.negative.toFixed(1)}
                        </div>
                        <div className="text-xs text-rose-600">Average of 8 attributes</div>
                      </div>
                    </div>
                    <div className="text-xs text-rose-700 space-y-1">
                      <p>Includes: Worried, Disgusted, Bored, Aggressive, Guilty, Disappointed, 
                        Sad, Unpleasant</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-3">Emotional Balance Analysis</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-slate-600 mb-1">Net Emotional Score</div>
                      <div className="text-3xl font-bold text-slate-900">{activeEmotionalBalance}</div>
                      <div className="text-xs text-slate-500 mt-1">Positive - Negative</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600 mb-1">Interpretation</div>
                      <Badge className={parseFloat(activeEmotionalBalance) >= 2 ? "bg-emerald-600" :
                                       parseFloat(activeEmotionalBalance) >= 0 ? "bg-amber-600" : "bg-rose-600"}>
                        {parseFloat(activeEmotionalBalance) >= 2 ? "Highly Positive" :
                         parseFloat(activeEmotionalBalance) >= 0 ? "Neutral/Mixed" : "Negative"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600 mb-1">Consumer Readiness</div>
                      <Badge className={parseFloat(activeEmotionalBalance) >= 1.5 ? "bg-emerald-600" : "bg-amber-600"}>
                        {parseFloat(activeEmotionalBalance) >= 1.5 ? "Ready" : "Needs Work"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <strong>Method:</strong> EsSense25 profile adapted for plant-based cheese evaluation. 
                      Panelists rated emotional intensity triggered by sample consumption on 0-5 scale 
                      (0 = Not at all, 5 = Extremely).
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        // All Samples Comparison View
        <Card>
          <CardHeader>
            <CardTitle>All Samples: Hedonic Comparison</CardTitle>
            <p className="text-sm text-slate-600">
              Comparative view of all 14 samples across hedonic dimensions
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={allSamplesHedonic}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 9]} />
                <RechartsTooltip />
                <Legend />
                <Line key="line-overall" type="monotone" dataKey="overall" stroke="#8b5cf6" strokeWidth={2} name="Overall" />
                <Line key="line-flavour" type="monotone" dataKey="flavour" stroke="#3b82f6" strokeWidth={2} name="Flavour" />
                <Line key="line-texture" type="monotone" dataKey="texture" stroke="#10b981" strokeWidth={2} name="Texture" />
                <Line key="line-appearance" type="monotone" dataKey="appearance" stroke="#f59e0b" strokeWidth={2} name="Appearance" />
              </LineChart>
            </ResponsiveContainer>

            {/* Color legend */}
            <div className="mt-4 flex flex-wrap gap-3 px-1">
              {SAMPLE_TYPE_LEGEND.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-7 gap-3">
              {ENHANCED_SENSORY_DATA.map(sample => {
                const avgScore = (sample.hedonic.overall + sample.hedonic.flavour +
                                 sample.hedonic.texture + sample.hedonic.appearance) / 4;
                const typeColor = getSampleColor(sample.sampleName);
                return (
                  <div
                    key={sample.sampleId}
                    className="p-3 rounded-lg border-2 text-center"
                    style={{ borderColor: typeColor, backgroundColor: `${typeColor}18` }}
                  >
                    <div className="font-bold text-slate-900 text-xs mb-1 leading-tight">{sample.sampleName}</div>
                    <div className="text-2xl font-bold mt-1" style={{ color: typeColor }}>{avgScore.toFixed(1)}</div>
                    <div className="text-xs text-slate-500 mt-1">/ 9</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
        </>
      ) : (
        /* Multi-Sample Analysis Section */
        <MultiSampleAnalysis
          multiSampleResponses={multiSampleResponses}
          multiSampleProducts={multiSampleProducts}
          selectedMultiProduct={selectedMultiProduct}
          setSelectedMultiProduct={setSelectedMultiProduct}
        />
      )}
    </div>
  );
}

/* Multi-Sample Analysis Component */
function MultiSampleAnalysis({
  multiSampleResponses,
  multiSampleProducts,
  selectedMultiProduct,
  setSelectedMultiProduct
}: {
  multiSampleResponses: any[];
  multiSampleProducts: any[];
  selectedMultiProduct: string;
  setSelectedMultiProduct: (id: string) => void;
}) {
  const selectedProduct = multiSampleProducts.find(p => p.id === selectedMultiProduct);
  const productResponses = multiSampleResponses.filter(r => r.productId === selectedMultiProduct);

  if (productResponses.length === 0) {
    return (
      <Card className="border-2 border-slate-200">
        <CardContent className="pt-12 pb-12 text-center">
          <Layers className="size-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">No Multi-Sample Data Yet</h3>
          <p className="text-slate-600">
            Multi-sample evaluation responses will appear here once panelists complete them.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate discrimination accuracy
  const discriminationResults = productResponses.reduce((acc: any, response: any) => {
    const sample = response.differentSample;
    acc[sample] = (acc[sample] || 0) + 1;
    return acc;
  }, {});

  // Calculate ranking consensus
  const rankingData = productResponses.reduce((acc: any, response: any) => {
    response.ranking.forEach((sampleCode: string, position: number) => {
      if (!acc[sampleCode]) {
        acc[sampleCode] = { rank1: 0, rank2: 0, rank3: 0, total: 0 };
      }
      acc[sampleCode][`rank${position + 1}`]++;
      acc[sampleCode].total++;
    });
    return acc;
  }, {});

  const rankingChartData = Object.entries(rankingData).map(([code, data]: [string, any]) => ({
    id: `ranking-${code}`,
    sample: code,
    'Best (1st)': data.rank1,
    'Middle (2nd)': data.rank2,
    'Worst (3rd)': data.rank3
  }));

  // Average hedonic scores per sample
  const hedonicBySample = productResponses.reduce((acc: any, response: any) => {
    response.samples.forEach((sample: any) => {
      if (!acc[sample.sampleCode]) {
        acc[sample.sampleCode] = { scores: [], count: 0 };
      }
      acc[sample.sampleCode].scores.push(sample.hedonicScores.overall);
      acc[sample.sampleCode].count++;
    });
    return acc;
  }, {});

  const hedonicChartData = Object.entries(hedonicBySample).map(([code, data]: [string, any]) => ({
    id: `hedonic-sample-${code}`,
    sample: code,
    avgScore: (data.scores.reduce((a: number, b: number) => a + b, 0) / data.count).toFixed(2),
    count: data.count
  })).sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

  const exportMultiSampleCSV = () => {
    const headers = ['ResponseID', 'PanelistID', 'ProductID', 'SampleCode', 'Metric', 'Value'];
    const rows: string[] = [headers.join(',')];

    productResponses.forEach((response: any) => {
      // Discrimination
      rows.push(`${response.id},${response.userId},${response.productId},N/A,Discrimination,${response.differentSample}`);

      // Ranking
      response.ranking.forEach((code: string, idx: number) => {
        rows.push(`${response.id},${response.userId},${response.productId},${code},Ranking,${idx + 1}`);
      });

      // Sample data
      response.samples.forEach((sample: any) => {
        rows.push(`${response.id},${response.userId},${response.productId},${sample.sampleCode},HedonicOverall,${sample.hedonicScores.overall}`);
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-sample-${selectedProduct?.name || 'analysis'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Product Selector */}
      <Card className="border-2 border-purple-300">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="size-5 text-purple-600" />
                Select Multi-Sample Study
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">{productResponses.length} panelist responses</p>
            </div>
            <Button onClick={exportMultiSampleCSV} variant="outline">
              <Download className="size-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3">
            {multiSampleProducts.map(product => (
              <button
                key={product.id}
                onClick={() => setSelectedMultiProduct(product.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedMultiProduct === product.id
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <div className="font-bold text-slate-900">{product.name}</div>
                <div className="text-xs text-slate-600 mt-1">{product.category}</div>
                <div className="text-xs text-purple-700 mt-1 font-medium">
                  {multiSampleResponses.filter(r => r.productId === product.id).length} responses
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Discrimination Test Results */}
      <Card className="border-2 border-amber-300">
        <CardHeader className="bg-amber-50">
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5 text-amber-600" />
            Discrimination Test Results
          </CardTitle>
          <p className="text-sm text-slate-600">Which sample was identified as "different"</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(discriminationResults).map(([sampleCode, count]: [string, any]) => {
              const percentage = ((count / productResponses.length) * 100).toFixed(1);
              return (
                <div key={sampleCode} className="p-4 bg-amber-50 rounded-lg border-2 border-amber-200 text-center">
                  <div className="w-14 h-14 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-2">
                    {sampleCode}
                  </div>
                  <div className="text-3xl font-bold text-amber-900">{count}</div>
                  <div className="text-sm text-slate-600">({percentage}%)</div>
                  <div className="text-xs text-slate-500 mt-1">panelists selected</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preference Ranking */}
      <Card className="border-2 border-purple-300">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-purple-600" />
            Preference Ranking Distribution
          </CardTitle>
          <p className="text-sm text-slate-600">How panelists ranked each sample</p>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rankingChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sample" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Bar key="rank-best" dataKey="Best (1st)" fill="#10b981" />
              <Bar key="rank-middle" dataKey="Middle (2nd)" fill="#f59e0b" />
              <Bar key="rank-worst" dataKey="Worst (3rd)" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-3 gap-4">
            {rankingChartData.map((data: any) => {
              const bestCount = data['Best (1st)'];
              const total = bestCount + data['Middle (2nd)'] + data['Worst (3rd)'];
              const percentage = ((bestCount / total) * 100).toFixed(1);
              return (
                <div key={data.sample} className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg mx-auto mb-2">
                    {data.sample}
                  </div>
                  <div className="text-sm text-slate-600 mb-1">Ranked #1</div>
                  <div className="text-2xl font-bold text-purple-900">{percentage}%</div>
                  <div className="text-xs text-slate-500 mt-1">{bestCount}/{total} times</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Average Hedonic Scores */}
      <Card className="border-2 border-blue-300">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Heart className="size-5 text-blue-600" />
            Average Overall Liking by Sample
          </CardTitle>
          <p className="text-sm text-slate-600">Mean hedonic scores (1-9 scale)</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            {hedonicChartData.map((data: any) => {
              const score = parseFloat(data.avgScore);
              const color = score >= 7 ? 'emerald' : score >= 5 ? 'amber' : 'rose';
              return (
                <div key={data.sample} className={`p-4 bg-${color}-50 rounded-lg border-2 border-${color}-200 text-center`}>
                  <div className="w-14 h-14 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-2">
                    {data.sample}
                  </div>
                  <div className={`text-3xl font-bold text-${color}-900`}>{data.avgScore}</div>
                  <div className="text-xs text-slate-500 mt-1">n={data.count} responses</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}