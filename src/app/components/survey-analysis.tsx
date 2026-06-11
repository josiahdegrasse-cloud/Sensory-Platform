import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { useAuth } from '../contexts/auth-context';
import { useFoodType, sampleMatchesFoodType, matchFoodType } from '../contexts/food-type-context';
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from "../data/enhanced-sensory";
import { getSampleColor, SAMPLE_TYPE_LEGEND } from "../utils/sample-colors";
import { useInstrumentalDataset, useProducts } from "../lib/hooks";
import { mergeAnalysisProfiles } from "../lib/analysis-dataset";
import { formatFoodTypeLabel } from "../lib/food-intelligence";
import { useSurveyData } from "../lib/use-survey-data";
import { buildSampleCSVRows, buildAllDataCSVRows, downloadCsv } from "../utils/survey-csv-export";
import {
  Users, Heart, Smile, Frown, CheckSquare,
  TrendingUp, AlertCircle, Download, Layers, FlaskConical, ClipboardList, Megaphone, GitMerge, ChevronDown
} from "lucide-react";
import { MultiSampleAnalysis } from "./multi-sample-analysis";
import { CATATab, IntensityTab, HedonicTab, CommentsTab, EmotionalTab } from "./survey-analysis-tabs";
import { AllSamplesComparisonView } from "./all-samples-comparison";
import { ConceptTestAnalysis } from "./concept-test-analysis";
import { ProjectHeader } from "./project-header";
import { DataProvenanceBadge } from "./data-provenance-badge";
import { ANALYSIS_ACCENT } from "../styles/tokens";

const RESEARCH_PANEL_N = 14;

const ANALYSIS_TYPES = [
  { id: 'single' as const, icon: Users,     label: 'Single-Sample Analysis', desc: 'CATA, Intensity, Hedonic, Emotions',        color: ANALYSIS_ACCENT.single },
  { id: 'multi' as const,  icon: Layers,    label: 'Multi-Sample Analysis',  desc: 'Discrimination, Ranking, Comparison',       color: ANALYSIS_ACCENT.multi },
  { id: 'concept' as const, icon: Megaphone, label: 'Concept Tests',         desc: 'Appeal, Visual preference, Purchase intent', color: ANALYSIS_ACCENT.concept },
];

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
  );
}

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
        <ProjectHeader />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Insights</h1>
          <p className="text-sm text-slate-500 mt-1">
            Understand how instrumental data and panelist perception align for {activeLabel}.
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
                  <Link to="/admin">
                    <ClipboardList className="size-4" />
                    Create questionnaires from your samples
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/stage1">
                    <FlaskConical className="size-4" />
                    Import more machine data
                  </Link>
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
      <ProjectHeader />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Analyze Results</h1>
            {analysisType === 'single' && (
              <DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={activePanelistN} />
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {analysisType === 'single'
              ? 'CATA, Intensity, Hedonic, Emotional'
              : analysisType === 'multi'
                ? 'Multi-sample comparative evaluations — Discrimination, Ranking, Preferences'
                : 'Concept test panelist feedback — Appeal, Visual preference, Purchase intent'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {analysisType === 'single' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="size-4 mr-2" />
                  Export
                  <ChevronDown className="size-4 ml-1 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportSampleCSV}>
                  Current sample (CSV)
                </DropdownMenuItem>
                {user?.role === 'admin' && (
                  <DropdownMenuItem onClick={exportAllDataCSV}>
                    All panel data (CSV)
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
            <Link to="/decision">
              <GitMerge className="size-4 mr-2" />
              Move forward & write report
            </Link>
          </Button>
        </div>
      </div>

      {/* Step 1 — Analysis type */}
      <div className="space-y-3">
        <SectionHeading>Analysis type</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl">
          {ANALYSIS_TYPES.map(({ id, icon: Icon, label, desc, color }) => {
            const isActive = analysisType === id;
            return (
              <button
                key={id}
                onClick={() => setAnalysisType(id)}
                aria-pressed={isActive}
                className="p-4 rounded-lg border-2 transition-all text-left hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                style={{
                  borderColor: isActive ? color : '#e2e8f0',
                  backgroundColor: isActive ? `${color}12` : 'white',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                    style={{ backgroundColor: isActive ? color : '#f1f5f9' }}
                  >
                    <Icon className="size-5" style={{ color: isActive ? 'white' : '#64748b' }} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{label}</div>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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

      {analysisType === 'single' ? (
        <>
          {/* Step 2 — Sample selector */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading>Sample ({filteredSamples.length})</SectionHeading>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {SAMPLE_TYPE_LEGEND
                  .filter(t => filteredSamples.some(s => getSampleColor(s.sampleName) === t.color))
                  .map(t => (
                    <span key={t.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.label}
                    </span>
                  ))}
              </div>
            </div>
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {filteredSamples.map(sample => {
                    const typeColor = getSampleColor(sample.sampleName);
                    const isSelected = selectedSample === sample.sampleId;
                    return (
                      <button
                        key={sample.sampleId}
                        onClick={() => setSelectedSample(sample.sampleId)}
                        aria-pressed={isSelected}
                        className="flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all text-left hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        style={{
                          borderColor: isSelected ? typeColor : '#e2e8f0',
                          backgroundColor: isSelected ? `${typeColor}14` : 'white',
                        }}
                      >
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: typeColor }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-slate-900 leading-tight">{sample.sampleName}</span>
                          <span className="text-xs font-semibold" style={{ color: typeColor }}>
                            {sample.hedonic.overall.toFixed(1)}<span className="text-slate-400 font-normal">/9</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

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

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading>{showAllSamples ? 'Compare all samples' : 'Detailed results'}</SectionHeading>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm" role="group" aria-label="Result view">
                <button
                  onClick={() => setShowAllSamples(false)}
                  aria-pressed={!showAllSamples}
                  className={`rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    !showAllSamples ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  This sample
                </button>
                <button
                  onClick={() => setShowAllSamples(true)}
                  aria-pressed={showAllSamples}
                  className={`rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    showAllSamples ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Compare all
                </button>
              </div>
            </div>

          {!showAllSamples ? (
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
          </div>
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
