import { useMemo, useState } from 'react';
import {
  AlertCircle, BarChart3, ChevronDown, Download, Layers, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { useFoodType, sampleMatchesFoodType } from '../contexts/food-type-context';
import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from '../data/enhanced-sensory';
import {
  useAdminConceptTests,
  useConceptTestResponses,
  useDecisionRecords,
  useInstrumentalDataset,
  useProducts,
  useWorkspaceSettings,
} from '../lib/hooks';
import { mergeAnalysisProfiles } from '../lib/analysis-dataset';
import {
  deriveInsightsEvidenceStrength,
  deriveInsightsNextAction,
  filterProjectConceptTests,
  filterProjectInstrumentSamples,
  filterProjectProducts,
} from '../lib/insights';
import { useProjectStatus } from '../lib/use-project-status';
import { useSurveyData } from '../lib/use-survey-data';
import { formatFoodTypeLabel } from '../lib/food-intelligence';
import { buildAllDataCSVRows, buildSampleCSVRows, downloadCsv } from '../utils/survey-csv-export';
import { Button } from './ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ProjectHeader } from './project-header';
import { StageEmptyState } from './stage-empty-state';
import {
  InsightsSectionHeader,
  RawDataAppendix,
} from './insights-ui';
import { CATATab, CommentsTab, HedonicTab, IntensityTab } from './survey-analysis-tabs';
import { AllSamplesComparisonView } from './all-samples-comparison';
import { MultiSampleAnalysis } from './multi-sample-analysis';
import { ConceptTestAnalysis } from './concept-test-analysis';
import {
  InsightsPrototypeWorkspace,
  type InsightsPrototypeOption,
} from './insights-prototype-workspace';

function buildImportedProfiles(dataset: ReturnType<typeof useInstrumentalDataset>['data']): EnhancedSensoryProfile[] {
  return (dataset?.eTongueData ?? []).map(sample => {
    const composition = dataset?.compositionData[sample.sampleId];
    const compounds = dataset?.gcmsData[sample.sampleId] ?? [];
    return {
      sampleId: sample.sampleId,
      sampleName: sample.sampleName || sample.sampleId,
      taste: {
        sourness: sample.sourness, bitterness: sample.bitterness, astringency: 0,
        umami: sample.umami, saltiness: sample.saltiness, sweetness: sample.sweetness,
        astringencyAftertaste: 0, umamiAftertaste: sample.umami,
        bitternessAftertaste: sample.bitterness, richness: sample.umami,
      },
      composition: {
        salt: composition?.saltContent ?? 0, fat: composition?.fat ?? 0,
        protein: composition?.protein ?? 0,
        starchDryMatter: Math.max(0, 100 - ((composition?.moisture ?? 0) + (composition?.fat ?? 0) + (composition?.protein ?? 0))),
      },
      gcmsOlfactometry: compounds.map((compound, index) => ({
        retentionTime: index + 1, compound: compound.name, nistProbability: 0,
        peakArea: compound.concentration, odour: compound.aroma,
        odourIntensity: compound.threshold > 0 && compound.concentration > compound.threshold ? 5 : Math.min(5, Math.max(1, compound.concentration)),
        concentration: compound.concentration, threshold: compound.threshold,
      })),
      istdRecovery: 0,
      olfactometryFlowSplit: 'Imported CSV',
      cata: {},
      intensity: {},
      hedonic: { appearance: 0, flavour: 0, texture: 0, overall: 0 },
      emotions: { positive: 0, negative: 0 },
    };
  });
}

export function SurveyAnalysis() {
  const { user } = useAuth();
  const { foodType, subCategory } = useFoodType();
  const importBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const status = useProjectStatus(foodType, importBatchId);
  const { data: products = [] } = useProducts();
  const { data: instrumentalDataset } = useInstrumentalDataset(user?.role === 'admin');
  const { data: settings } = useWorkspaceSettings();
  const { data: decisions = [] } = useDecisionRecords();
  const { data: conceptTests = [] } = useAdminConceptTests();
  const {
    liveDataFetchFailed, multiSampleResponses, selectedMultiProduct,
    setSelectedMultiProduct, liveAggregations, commentsByProduct,
  } = useSurveyData();
  const [requestedSample, setRequestedSample] = useState('');

  const minimumResponses = settings?.decisionMinResponses ?? 12;
  const projectInstrumentSamples = useMemo(
    () => filterProjectInstrumentSamples(instrumentalDataset?.eTongueData ?? [], foodType, importBatchId),
    [instrumentalDataset?.eTongueData, foodType, importBatchId],
  );
  const projectSampleIds = useMemo(() => new Set(projectInstrumentSamples.map(sample => sample.sampleId)), [projectInstrumentSamples]);
  const projectProducts = useMemo(
    () => filterProjectProducts(products, projectSampleIds, foodType, importBatchId),
    [products, projectSampleIds, foodType, importBatchId],
  );
  const importedProfiles = useMemo(() => buildImportedProfiles(instrumentalDataset), [instrumentalDataset]);
  const mergedProfiles = useMemo(() => mergeAnalysisProfiles(ENHANCED_SENSORY_DATA, importedProfiles), [importedProfiles]);
  const projectSamples = useMemo(() => {
    if (projectInstrumentSamples.length > 0) {
      return mergedProfiles.filter(profile => projectSampleIds.has(profile.sampleId));
    }
    if (importBatchId) return [];
    return mergedProfiles.filter(profile => sampleMatchesFoodType(profile.sampleId, profile.sampleName) === foodType);
  }, [projectInstrumentSamples.length, projectSampleIds, mergedProfiles, importBatchId, foodType]);

  const selectedSample = projectSamples.some(sample => sample.sampleId === requestedSample)
    ? requestedSample
    : projectSamples[0]?.sampleId ?? '';
  const selectedData = projectSamples.find(sample => sample.sampleId === selectedSample);
  const selectedInstrument = projectInstrumentSamples.find(sample => sample.sampleId === selectedSample);
  const selectedProduct = projectProducts.find(product => product.sourceSampleId === selectedSample);
  const matchingLiveData = selectedData ? liveAggregations.find(aggregation =>
    aggregation.sourceSampleId === selectedData.sampleId ||
    aggregation.productName.toLowerCase() === selectedData.sampleName.toLowerCase() ||
    aggregation.productName.toLowerCase().includes(`(${selectedData.sampleId.toLowerCase()})`)
  ) : undefined;
  const usingLiveData = Boolean(matchingLiveData);
  const usingReferenceData = Boolean(selectedData && !selectedInstrument && !matchingLiveData);
  const liveResponseCount = matchingLiveData?.n ?? 0;

  const projectConcepts = useMemo(
    () => filterProjectConceptTests(conceptTests, { foodType, importBatchId, projectName: status.projectName }),
    [conceptTests, foodType, importBatchId, status.projectName],
  );
  const multiSampleProducts = projectProducts.filter(product => product.isMultiSample);
  const activeMultiSampleProduct = multiSampleProducts.some(product => product.id === selectedMultiProduct)
    ? selectedMultiProduct
    : multiSampleProducts[0]?.id ?? '';
  const primaryConcept = projectConcepts[0];
  const { data: primaryConceptResponses = [] } = useConceptTestResponses(primaryConcept?.id);
  const projectDecisions = decisions.filter(decision =>
    projectSampleIds.has(decision.sampleId) ||
    (!importBatchId && sampleMatchesFoodType(decision.sampleId, decision.sampleName) === foodType)
  );
  const latestDecision = projectDecisions[0] ?? null;
  const selectedGcms = selectedData ? instrumentalDataset?.gcmsData[selectedData.sampleId] ?? [] : [];
  const selectedComposition = selectedData ? instrumentalDataset?.compositionData[selectedData.sampleId] : undefined;
  const datasetsPresent = [selectedInstrument, selectedGcms.length > 0, selectedComposition].filter(Boolean).length;
  const strength = deriveInsightsEvidenceStrength({
    liveResponseCount,
    minimumResponses,
    liveDataFetchFailed,
    usesReferenceData: usingReferenceData,
    datasetsPresent,
    hasBlockingWarnings: status.warnings.length > 0,
  });
  const nextAction = deriveInsightsNextAction({
    fallback: status.nextAction,
    hasInstrumentData: Boolean(selectedInstrument),
    productCount: selectedProduct ? 1 : 0,
    liveResponseCount,
    minimumResponses,
    decision: latestDecision?.decision ?? null,
    conceptCount: projectConcepts.length,
    conceptResponseCount: primaryConceptResponses.length,
    reportStatus: status.reportStatus,
  });

  if (user?.role !== 'admin') return null;

  if (!selectedData) {
    const activeLabel = foodType === 'all' ? 'selected food types' : formatFoodTypeLabel(foodType);
    return (
      <div className="space-y-6">
        <ProjectHeader />
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Insights</h1>
          <p className="mt-1 text-sm text-slate-600">Interpret panel and instrumental evidence for {activeLabel}.</p>
        </div>
        <StageEmptyState
          icon={BarChart3}
          headline={`No analyzable samples for ${activeLabel}`}
          body="Import a machine dataset or create questionnaires for the active project before reviewing evidence."
          cta={{ label: 'Import instrumental data', to: '/stage1' }}
          secondaryCta={{ label: 'Configure questionnaires', to: '/admin' }}
        />
      </div>
    );
  }

  const activeCata = matchingLiveData
    ? Object.entries(matchingLiveData.cata).map(([attribute, count]) => ({
        id: `cata-${attribute}`, attribute, count, percentage: (count / matchingLiveData.n) * 100,
      })).sort((a, b) => b.count - a.count)
    : Object.entries(selectedData.cata).map(([attribute, count]) => ({
        id: `cata-${attribute}`, attribute, count, percentage: (count / 14) * 100,
      })).sort((a, b) => b.count - a.count);
  const activeIntensity = matchingLiveData
    ? Object.entries(matchingLiveData.intensity).map(([attribute, value]) => ({ id: `intensity-${attribute}`, attribute, value, fullMark: 5 }))
    : Object.entries(selectedData.intensity).map(([attribute, value]) => ({ id: `intensity-${attribute}`, attribute, value, fullMark: 10 }));
  const activeHedonic = matchingLiveData
    ? ['overall', 'appearance', 'aroma', 'flavor', 'texture'].map(category => ({
        id: `hedonic-${category}`, category: category === 'flavor' ? 'Flavour' : category[0].toUpperCase() + category.slice(1),
        score: matchingLiveData.hedonic[category] ?? 0, sd: matchingLiveData.hedonicSD[category] ?? 0,
      }))
    : [
        ['Appearance', selectedData.hedonic.appearance], ['Flavour', selectedData.hedonic.flavour],
        ['Texture', selectedData.hedonic.texture], ['Overall', selectedData.hedonic.overall],
      ].map(([category, score]) => ({ id: `hedonic-${category}`, category: String(category), score: Number(score), sd: 0.8 }));
  const activeEmotions = matchingLiveData?.emotions ?? selectedData.emotions;
  const panelN = matchingLiveData?.n ?? 14;
  const averageHedonic = activeHedonic.length
    ? activeHedonic.reduce((sum, item) => sum + item.score, 0) / activeHedonic.length
    : 0;
  const averageIntensity = activeIntensity.length
    ? activeIntensity.reduce((sum, item) => sum + item.value, 0) / activeIntensity.length
    : 0;
  const emotionalBalance = activeEmotions.positive - activeEmotions.negative;
  const strongestHedonic = [...activeHedonic].sort((a, b) => b.score - a.score)[0];
  const weakestHedonic = [...activeHedonic].sort((a, b) => a.score - b.score)[0];
  const keyStrength = usingLiveData
    ? strongestHedonic && strongestHedonic.score > 0
      ? `${strongestHedonic.category} is the strongest liking dimension at ${strongestHedonic.score.toFixed(1)}/9.`
      : activeCata[0] ? `${activeCata[0].attribute} is the most-selected descriptor.` : 'No clear sensory strength is established yet.'
    : 'Live panel evidence has not yet established a client-facing sensory strength.';
  const keyConcern = !usingLiveData
    ? 'Collect live panel responses before making product claims.'
    : weakestHedonic && weakestHedonic.score < 6
      ? `${weakestHedonic.category} is the lowest liking dimension at ${weakestHedonic.score.toFixed(1)}/9.`
      : strength.note;

  const comparisonProfiles = projectSamples.filter(sample =>
    liveAggregations.some(aggregation => aggregation.sourceSampleId === sample.sampleId) ||
    (!projectSampleIds.has(sample.sampleId) && sample.hedonic.overall > 0)
  );
  const allSamplesHedonic = comparisonProfiles.map(sample => {
    const live = liveAggregations.find(aggregation => aggregation.sourceSampleId === sample.sampleId);
    return {
      id: sample.sampleId,
      name: sample.sampleName,
      overall: live?.hedonic.overall ?? sample.hedonic.overall,
      flavour: live?.hedonic.flavor ?? sample.hedonic.flavour,
      texture: live?.hedonic.texture ?? sample.hedonic.texture,
      appearance: live?.hedonic.appearance ?? sample.hedonic.appearance,
    };
  });
  const showComparison = comparisonProfiles.length > 1 || multiSampleProducts.length > 0;
  const comments = matchingLiveData ? commentsByProduct[matchingLiveData.productId] ?? [] : [];
  const prototypeScores = projectSamples.map(sample => {
    const live = liveAggregations.find(aggregation =>
      aggregation.sourceSampleId === sample.sampleId ||
      aggregation.productName.toLowerCase() === sample.sampleName.toLowerCase() ||
      aggregation.productName.toLowerCase().includes(`(${sample.sampleId.toLowerCase()})`)
    );
    return {
      sample,
      live,
      score: live?.hedonic.overall ?? sample.hedonic.overall ?? 0,
    };
  });
  const rankedPrototypeIds = [...prototypeScores]
    .filter(item => (item.live?.n ?? 0) >= minimumResponses && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.sample.sampleId);
  const prototypeOptions: InsightsPrototypeOption[] = prototypeScores.map(({ sample, live, score }) => {
    const responseCount = live?.n ?? 0;
    const isLeader = rankedPrototypeIds[0] === sample.sampleId;
    const hasInstrument = projectSampleIds.has(sample.sampleId);
    const evidenceLabel = responseCount >= minimumResponses
      ? 'Strong evidence'
      : responseCount > 0
        ? 'Limited evidence'
        : hasInstrument
          ? 'Instrument only'
          : 'Reference profile';
    return {
      id: sample.sampleId,
      name: sample.sampleName,
      score,
      responseCount,
      evidenceLabel,
      signalLabel: isLeader
        ? 'Leading prototype'
        : responseCount > 0 && responseCount < minimumResponses
          ? 'Needs more responses'
          : responseCount === 0
            ? 'No live decision signal'
            : 'Review evidence',
      signalTone: isLeader ? 'success' : responseCount < minimumResponses ? 'warning' : 'neutral',
    };
  });
  const overviewEvidence = [
    {
      label: 'Panel coverage',
      detail: liveResponseCount >= minimumResponses
        ? `${liveResponseCount} responses exceeds the configured minimum of ${minimumResponses}.`
        : `${liveResponseCount} of ${minimumResponses} required responses are available.`,
      value: liveResponseCount >= minimumResponses ? 'Complete' : `${liveResponseCount}/${minimumResponses}`,
      complete: liveResponseCount >= minimumResponses,
      warning: liveResponseCount > 0 && liveResponseCount < minimumResponses,
    },
    {
      label: 'Sensory preference',
      detail: usingLiveData ? keyStrength : 'No live panel preference has been established for this prototype.',
      value: usingLiveData ? strength.level : 'Pending',
      complete: usingLiveData,
    },
    {
      label: 'Instrumental data',
      detail: `${datasetsPresent} of 3 expected machine sources are linked to this prototype.`,
      value: `${datasetsPresent}/3`,
      complete: datasetsPresent === 3,
    },
    {
      label: 'Open decision risk',
      detail: keyConcern,
      value: strength.representative ? 'Review' : 'Open',
      complete: strength.representative,
      warning: true,
    },
  ];
  const exportSampleCSV = () => {
    downloadCsv(
      buildSampleCSVRows(selectedData, selectedSample, usingLiveData, activeEmotions),
      `${selectedData.sampleId.toLowerCase()}-insights-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  return (
    <div className="space-y-6">
      <ProjectHeader />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Keep every prototype visible while investigating one in depth.</p>
        </div>
        <p className="text-xs font-semibold text-slate-500">
          {projectSamples.length} prototype{projectSamples.length === 1 ? '' : 's'} · {prototypeOptions.reduce((total, prototype) => total + prototype.responseCount, 0)} live responses
        </p>
      </div>

      <InsightsPrototypeWorkspace
        prototypes={prototypeOptions}
        selectedId={selectedSample}
        onSelect={setRequestedSample}
        panelResponses={liveResponseCount}
        instrumentSources={datasetsPresent}
        usingLiveData={usingLiveData}
        strength={strength}
        keyStrength={keyStrength}
        keyConcern={keyConcern}
        nextAction={nextAction}
        likingMetrics={activeHedonic.map(item => ({ label: item.category, score: item.score }))}
        descriptors={activeCata.map(item => ({ label: item.attribute, percentage: item.percentage }))}
        emotionalBalance={emotionalBalance}
        averageIntensity={averageIntensity}
        intensityMax={usingLiveData ? 5 : 10}
        comments={comments}
        overviewEvidence={overviewEvidence}
        likingContent={<HedonicTab activeHedonicData={activeHedonic} activeAvgHedonic={averageHedonic.toFixed(1)} activePanelistN={panelN} usingLiveData={usingLiveData} />}
        descriptorContent={<CATATab activeCataAttributes={activeCata} activePanelistN={panelN} usingLiveData={usingLiveData} activeSampleId={selectedData.sampleId} />}
        intensityContent={<IntensityTab activeIntensityData={activeIntensity} activePanelistN={panelN} usingLiveData={usingLiveData} intensityMax={usingLiveData ? 5 : 10} />}
        commentsContent={<CommentsTab usingLiveData={usingLiveData} matchingLiveData={matchingLiveData} commentsByProduct={commentsByProduct} />}
      />

      {liveDataFetchFailed && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Live panel responses could not be loaded. Any reference charts below are for method orientation only.
        </div>
      )}

      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
          <span>
            Explore detailed evidence
            <span className="ml-2 font-normal text-slate-500">Comparisons, concepts, method notes, and raw exports</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-slate-500" aria-hidden />
        </summary>
        <div className="space-y-8 border-t border-slate-100 p-5">
      {showComparison && (
        <section className="space-y-4">
          <InsightsSectionHeader id="sample-comparison" icon={Layers} title="Sample comparison" description="Compare only samples and multi-sample studies belonging to the active project." />
          {comparisonProfiles.length > 1 && (
            <AllSamplesComparisonView allSamplesHedonic={allSamplesHedonic} enhancedSensoryData={comparisonProfiles} usingLiveData={comparisonProfiles.every(sample => liveAggregations.some(aggregation => aggregation.sourceSampleId === sample.sampleId))} responseCount={liveResponseCount} />
          )}
          {multiSampleProducts.length > 0 && (
            <MultiSampleAnalysis
              multiSampleResponses={multiSampleResponses}
              multiSampleProducts={multiSampleProducts}
              selectedMultiProduct={activeMultiSampleProduct}
              setSelectedMultiProduct={setSelectedMultiProduct}
              minimumResponses={minimumResponses}
            />
          )}
        </section>
      )}

      <section className="space-y-4">
        <InsightsSectionHeader id="concept-feedback" icon={BarChart3} title="Concept feedback" description="Concept appeal, preference, purchase intent, and packaging direction scoped to this project." />
        <ConceptTestAnalysis projectTests={projectConcepts} minimumResponses={minimumResponses} />
      </section>

      <section className="space-y-4">
        <InsightsSectionHeader id="comments-themes" icon={MessageCircle} title="Comments and themes" description="Raw panelist language remains visible alongside clear response coverage." />
        <CommentsTab usingLiveData={usingLiveData} matchingLiveData={matchingLiveData} commentsByProduct={commentsByProduct} />
        {comments.length > 0 && (
          <p className="text-xs text-slate-500">
            {comments.length} open-text comment{comments.length === 1 ? '' : 's'} from {liveResponseCount} matched live responses.
            {comments.length < 3 && ' Too few comments to infer a recurring theme — use them to generate hypotheses, not claims.'}
          </p>
        )}
      </section>

      <RawDataAppendix>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Method and provenance</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li>Sensory source: {usingLiveData ? `${liveResponseCount} live panel responses` : 'reference/demo profile'}.</li>
              <li>Instrument sources: {datasetsPresent} of 3 available.</li>
              <li>Concept responses: {primaryConceptResponses.length}.</li>
              <li>Configured decision threshold: {minimumResponses} responses.</li>
              <li>Decision: {latestDecision ? `${latestDecision.decision}, ISSF ${latestDecision.issfScore.toFixed(0)}` : 'not recorded'}.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Exports</h3>
            <p className="mt-1 text-sm text-slate-600">CSV exports contain raw and aggregated values. Provenance and evidence limitations should accompany any client-facing interpretation.</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="mt-3"><Download className="size-4" />Export data</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={exportSampleCSV}>Current sample CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadCsv(buildAllDataCSVRows(liveAggregations), `panel-data-${new Date().toISOString().slice(0, 10)}.csv`)}>All live panel data CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </RawDataAppendix>
        </div>
      </details>
    </div>
  );
}
