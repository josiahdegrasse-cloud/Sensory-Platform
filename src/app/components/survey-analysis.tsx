import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { useAuth } from '../contexts/auth-context';
import { useFoodType, sampleMatchesFoodType, matchFoodType } from '../contexts/food-type-context';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from "../data/enhanced-sensory";
import { getSampleColor } from "../utils/sample-colors";
import { useInstrumentalDataset, useProducts } from "../lib/hooks";
import { mergeAnalysisProfiles } from "../lib/analysis-dataset";
import { formatFoodTypeLabel } from "../lib/food-intelligence";
import { useSurveyData } from "../lib/use-survey-data";
import { buildSampleCSVRows, buildAllDataCSVRows, downloadCsv } from "../utils/survey-csv-export";
import {
  Users, Heart, Smile, Frown, CheckSquare,
  TrendingUp, AlertCircle, Eye, EyeOff, Download, Layers, FlaskConical, ClipboardList, Megaphone, GitMerge
} from "lucide-react";
import { MultiSampleAnalysis } from "./multi-sample-analysis";
import { CATATab, IntensityTab, HedonicTab, CommentsTab, EmotionalTab } from "./survey-analysis-tabs";
import { AllSamplesComparisonView } from "./all-samples-comparison";
import { ConceptTestAnalysis } from "./concept-test-analysis";

const RESEARCH_PANEL_N = 14;

export function SurveyAnalysis() {
  const { user } = useAuth();
  const { data: allProducts = [] } = useProducts();
  const { data: instrumentalDataset } = useInstrumentalDataset(user?.role === 'admin');
  const {
    liveDataFetchFailed,
    multiSampleResponses,
    selectedMultiProduct,
    setSelectedMultiProduct,
    liveAggregations,
    commentsByProduct,
  } = useSurveyData();

  const { foodType, subCategory } = useFoodType();
  const [selectedSample, setSelectedSample] = useState<string>("S1");
  const [showAllSamples, setShowAllSamples] = useState(false);
  const [analysisType, setAnalysisType] = useState<'single' | 'multi' | 'concept'>('single');
  const importedSensoryData: EnhancedSensoryProfile[] = useMemo(() => (instrumentalDataset?.eTongueData ?? [])
    .map(sample => {
      const composition = instrumentalDataset?.compositionData?.[sample.sampleId];
      const compounds = instrumentalDataset?.gcmsData?.[sample.sampleId] ?? [];
      return {
        sampleId: sample.sampleId,
        sampleName: sample.sampleName || sample.sampleId,
        taste: {
          sourness: sample.sourness,
          bitterness: sample.bitterness,
          astringency: 0,
          umami: sample.umami,
          saltiness: sample.saltiness,
          sweetness: sample.sweetness,
          astringencyAftertaste: 0,
          umamiAftertaste: sample.umami,
          bitternessAftertaste: sample.bitterness,
          richness: sample.umami,
        },
        composition: {
          salt: composition?.saltContent ?? 0,
          fat: composition?.fat ?? 0,
          protein: composition?.protein ?? 0,
          starchDryMatter: Math.max(0, 100 - ((composition?.moisture ?? 0) + (composition?.fat ?? 0) + (composition?.protein ?? 0))),
        },
        gcmsOlfactometry: compounds.map((compound, index) => ({
          retentionTime: index + 1,
          compound: compound.name,
          nistProbability: 0,
          peakArea: compound.concentration,
          odour: compound.aroma,
          odourIntensity: compound.threshold > 0 && compound.concentration > compound.threshold ? 5 : Math.min(5, Math.max(1, compound.concentration)),
          concentration: compound.concentration,
          threshold: compound.threshold,
        })),
        istdRecovery: 0,
        olfactometryFlowSplit: 'Imported CSV',
        cata: {},
        intensity: {
          Sourness: sample.sourness,
          Bitterness: sample.bitterness,
          Saltiness: sample.saltiness,
          Umami: sample.umami,
          Sweetness: sample.sweetness,
        },
        hedonic: { appearance: 0, flavour: 0, texture: 0, overall: 0 },
        emotions: { positive: 0, negative: 0 },
      };
    }), [instrumentalDataset?.compositionData, instrumentalDataset?.eTongueData, instrumentalDataset?.gcmsData]);
  const allSensoryData = useMemo(
    () => mergeAnalysisProfiles(ENHANCED_SENSORY_DATA, importedSensoryData),
    [importedSensoryData],
  );

  // Auto-select first sample in filtered set when food type changes
  useEffect(() => {
    const filtered = allSensoryData.filter(s => {
      const importedSample = instrumentalDataset?.eTongueData.find(sample => sample.sampleId === s.sampleId);
      const importedType = importedSample?.type;
      const ft = importedType ?? sampleMatchesFoodType(s.sampleId, s.sampleName);
      if (foodType !== 'all' && ft !== foodType) return false;
      if (subCategory?.startsWith('batch:')) return importedSample?.importBatchId === subCategory.replace('batch:', '');
      if (subCategory && !s.sampleName.toLowerCase().includes(subCategory.toLowerCase())) return false;
      return true;
    });
    if (filtered.length > 0 && !filtered.find(s => s.sampleId === selectedSample)) {
      setSelectedSample(filtered[0].sampleId);
    }
  }, [allSensoryData, foodType, instrumentalDataset?.eTongueData, selectedSample, subCategory]);

  // All hooks called — safe to guard here
  if (user?.role !== 'admin') return null;

  const filteredSamples = allSensoryData.filter(s => {
    const importedSample = instrumentalDataset?.eTongueData.find(sample => sample.sampleId === s.sampleId);
    const importedType = importedSample?.type;
    const ft = importedType ?? sampleMatchesFoodType(s.sampleId, s.sampleName);
    if (foodType !== 'all' && ft !== foodType) return false;
    if (subCategory?.startsWith('batch:')) return importedSample?.importBatchId === subCategory.replace('batch:', '');
    if (subCategory && !s.sampleName.toLowerCase().includes(subCategory.toLowerCase())) return false;
    return true;
  });

  const selectedData = filteredSamples.find(s => s.sampleId === selectedSample);

  if (!selectedData) {
    const activeLabel = foodType === 'all' ? 'selected food types' : formatFoodTypeLabel(foodType);
    const importedSamples = (instrumentalDataset?.eTongueData ?? []).filter(sample =>
      (foodType === 'all' ? true : sample.type === foodType) &&
      (subCategory?.startsWith('batch:') ? sample.importBatchId === subCategory.replace('batch:', '') : true)
    );
    const activeProducts = allProducts.filter(product => {
      if (product.status === 'archived') return false;
      if (foodType === 'all') return true;
      if (subCategory?.startsWith('batch:')) return product.sourceImportBatchId === subCategory.replace('batch:', '');
      return matchFoodType(product.category) === foodType;
    });

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analyze Results</h1>
          <p className="text-sm text-slate-500 mt-1">
            Questionnaire results for {activeLabel}.
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-blue-50">
                  <ClipboardList className="size-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Create questionnaires from the imported {activeLabel} data</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    The CSV import is the starting point. Turn those machine samples into questionnaire-ready products, then panelist submissions will populate these charts.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">{importedSamples.length}</div>
                  <div className="text-sm text-slate-500">machine samples</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">{activeProducts.length}</div>
                  <div className="text-sm text-slate-500">configured products</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">0</div>
                  <div className="text-sm text-slate-500">completed questionnaires</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/stage1">
                    <FlaskConical className="size-4" />
                    Create questionnaires
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/admin">Review questionnaire setup</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate CATA frequencies across all attributes
  const cataAttributes = Object.entries(selectedData.cata)
    .map(([attr, count]) => ({
      id: `cata-${attr}`,
      attribute: attr,
      count: count,
      percentage: (count / RESEARCH_PANEL_N) * 100
    }))
    .sort((a, b) => b.count - a.count);

  // Intensity ratings for radar chart
  const intensityData = Object.entries(selectedData.intensity).map(([key, value]) => ({
    id: `intensity-${key}`,
    attribute: key.replace(/([A-Z])/g, ' $1').trim(),
    value: value,
    fullMark: 10
  }));

  // Hedonic scores (sd = 0.8 placeholder for static mock data)
  const hedonicData = [
    { id: 'hedonic-appearance', category: "Appearance", score: selectedData.hedonic.appearance, sd: 0.8 },
    { id: 'hedonic-flavour', category: "Flavour", score: selectedData.hedonic.flavour, sd: 0.8 },
    { id: 'hedonic-texture', category: "Texture", score: selectedData.hedonic.texture, sd: 0.8 },
    { id: 'hedonic-overall', category: "Overall", score: selectedData.hedonic.overall, sd: 0.8 }
  ];

  // All samples comparison for hedonic overall
  const allSamplesHedonic = allSensoryData.map(s => ({
    id: `all-hedonic-${s.sampleId}`,
    name: s.sampleName,
    overall: s.hedonic.overall,
    flavour: s.hedonic.flavour,
    texture: s.hedonic.texture,
    appearance: s.hedonic.appearance
  }));

  // Auto-match: if panelists have submitted responses for this exact product name, use that data
  const matchingLiveData = liveAggregations.find(
    a => a.sourceSampleId === selectedData.sampleId ||
      a.productName.toLowerCase() === selectedData.sampleName.toLowerCase() ||
      a.productName.toLowerCase().includes(`(${selectedData.sampleId.toLowerCase()})`)
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

  const intensityMax = usingLiveData ? 5 : 10;
  const activeIntensityData = matchingLiveData
    ? Object.entries(matchingLiveData.intensity).map(([key, value]) => ({
        id: `intensity-${key}`,
        attribute: key,
        value: Number(value),
        fullMark: 5,
      }))
    : intensityData;

  const activeHedonicData = matchingLiveData
    ? [
        { id: 'hedonic-overall',    category: 'Overall',    score: matchingLiveData.hedonic['overall'] ?? 0,    sd: matchingLiveData.hedonicSD['overall'] ?? 0 },
        { id: 'hedonic-appearance', category: 'Appearance', score: matchingLiveData.hedonic['appearance'] ?? 0, sd: matchingLiveData.hedonicSD['appearance'] ?? 0 },
        { id: 'hedonic-aroma',      category: 'Aroma',      score: matchingLiveData.hedonic['aroma'] ?? 0,      sd: matchingLiveData.hedonicSD['aroma'] ?? 0 },
        { id: 'hedonic-flavor',     category: 'Flavour',    score: matchingLiveData.hedonic['flavor'] ?? 0,     sd: matchingLiveData.hedonicSD['flavor'] ?? 0 },
        { id: 'hedonic-texture',    category: 'Texture',    score: matchingLiveData.hedonic['texture'] ?? 0,    sd: matchingLiveData.hedonicSD['texture'] ?? 0 },
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
  const importedSelectedSample = instrumentalDataset?.eTongueData.find(sample => sample.sampleId === selectedData.sampleId);
  const hasMachineData = !!importedSelectedSample || importedSensoryData.some(sample => sample.sampleId === selectedData.sampleId);
  const sourceStatus = usingLiveData && hasMachineData
    ? 'Machine data joined with live panel responses'
    : usingLiveData
      ? 'Live panel responses'
      : hasMachineData
        ? 'Imported machine data, waiting for panel responses'
        : 'Reference dataset';

  const exportSampleCSV = () => {
    if (!selectedData) return;
    const csv = buildSampleCSVRows(selectedData, selectedSample, usingLiveData, activeEmotions);
    downloadCsv(csv, `sample-${selectedSample}-data-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportAllDataCSV = () => {
    const csv = buildAllDataCSVRows(liveAggregations);
    downloadCsv(csv, `issf-full-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const multiSampleProducts = allProducts.filter(p => {
    if (!p.isMultiSample) return false;
    if (foodType === 'all') return true;
    if (matchFoodType(p.category) !== foodType) return false;
    if (subCategory?.startsWith('batch:')) return p.sourceImportBatchId === subCategory.replace('batch:', '');
    if (subCategory && p.category !== subCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analyze Results</h1>
          <p className="text-sm text-slate-500 mt-1">
            {analysisType === 'single'
              ? `${usingLiveData ? 'Live panel responses' : 'E-Tongue + GC-MS + Semi-trained Panel'} (n=${activePanelistN}) — CATA, Intensity, Hedonic, Emotional`
              : analysisType === 'multi'
                ? 'Multi-sample comparative evaluations - Discrimination, Ranking, Preferences'
                : 'Concept test panelist feedback - Appeal, Visual preference, Purchase intent'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
            <Link to="/decision">
              <GitMerge className="size-4 mr-2" />
              Move forward & write report
            </Link>
          </Button>
          {analysisType === 'single' && (
            <>
              <Button onClick={exportSampleCSV} variant="outline">
                <Download className="size-4 mr-2" />
                Export Sample CSV
              </Button>
              {user?.role === 'admin' && (
                <Button onClick={exportAllDataCSV} variant="outline">
                  <Download className="size-4 mr-2" />
                  Export All Data
                </Button>
              )}
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

      {analysisType === 'single' && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Data source</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{sourceStatus}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Machine sample</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {hasMachineData ? selectedData.sampleId : 'Reference only'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Panel responses</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {usingLiveData ? `${activePanelistN} submitted` : 'Not submitted yet'}
            </p>
          </div>
        </div>
      )}

      {/* Analysis Type Toggle */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl">
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

        <button
          onClick={() => setAnalysisType('concept')}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            analysisType === 'concept'
              ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50'
              : 'border-slate-200 hover:border-orange-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              analysisType === 'concept' ? 'bg-orange-500' : 'bg-slate-200'
            }`}>
              <Megaphone className={`size-5 ${analysisType === 'concept' ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <div className="font-bold text-slate-900">Concept Tests</div>
              <p className="text-xs text-slate-600">Appeal, Visual preference, Purchase intent</p>
            </div>
          </div>
        </button>
      </div>

      {liveDataFetchFailed && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-300 rounded-lg text-sm">
          <AlertCircle className="size-4 text-rose-600 shrink-0" />
          <span className="text-rose-800 font-medium">
            Could not load live panel responses. Charts are showing <strong>simulated research data only</strong>. Do not export for client use until this is resolved.
          </span>
        </div>
      )}

      {analysisType === 'single' && usingLiveData && !liveDataFetchFailed && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-800 font-medium">
            Showing live panel responses for <strong>{selectedData.sampleName}</strong> (n={matchingLiveData?.n})
          </span>
        </div>
      )}

      {analysisType === 'single' && !usingLiveData && !liveDataFetchFailed && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm">
          <AlertCircle className="size-4 text-amber-600 shrink-0" />
          <span className="text-amber-800">
            <strong>Simulated data:</strong> No live panel responses matched this sample. Charts show E-Tongue / GC-MS / semi-trained panel benchmarks — not real panelist submissions.
          </span>
        </div>
      )}

      {analysisType === 'single' ? (
        <>
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="cata">CATA Attributes</TabsTrigger>
            <TabsTrigger value="intensity">Intensity Ratings</TabsTrigger>
            <TabsTrigger value="hedonic">Hedonic Scores</TabsTrigger>
            <TabsTrigger value="emotional">Emotional Profile</TabsTrigger>
            <TabsTrigger value="comments">
              Comments
              {usingLiveData && matchingLiveData && (commentsByProduct[matchingLiveData.productId]?.length ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-blue-600 text-white rounded-full">
                  {commentsByProduct[matchingLiveData.productId].length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <CATATab
            activeCataAttributes={activeCataAttributes}
            activePanelistN={activePanelistN}
            usingLiveData={usingLiveData}
            activeSampleId={activeSampleId}
          />
          <IntensityTab
            activeIntensityData={activeIntensityData}
            activePanelistN={activePanelistN}
            usingLiveData={usingLiveData}
            intensityMax={intensityMax}
          />
          <HedonicTab
            activeHedonicData={activeHedonicData}
            activeAvgHedonic={activeAvgHedonic}
            activePanelistN={activePanelistN}
          />
          <CommentsTab
            usingLiveData={usingLiveData}
            matchingLiveData={matchingLiveData}
            commentsByProduct={commentsByProduct}
          />
          <EmotionalTab
            activeEmotions={activeEmotions}
            activeEmotionalBalance={activeEmotionalBalance}
          />
        </Tabs>
      ) : (
        <AllSamplesComparisonView
          allSamplesHedonic={allSamplesHedonic}
          enhancedSensoryData={allSensoryData}
        />
      )}
        </>
      ) : analysisType === 'multi' ? (
        /* Multi-Sample Analysis Section */
        <MultiSampleAnalysis
          multiSampleResponses={multiSampleResponses}
          multiSampleProducts={multiSampleProducts}
          selectedMultiProduct={selectedMultiProduct}
          setSelectedMultiProduct={setSelectedMultiProduct}
        />
      ) : (
        /* Concept Test Analysis Section */
        <ConceptTestAnalysis />
      )}
    </div>
  );
}
