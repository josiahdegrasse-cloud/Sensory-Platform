import { useMemo, useState } from 'react';
import {
  AlertCircle, BarChart3, CheckSquare, ChevronDown, Download, FlaskConical, Heart,
  Layers, MessageCircle, Smile, TrendingUp, Users,
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
import { Card, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ProjectHeader } from './project-header';
import { DataProvenanceBadge } from './data-provenance-badge';
import { StageEmptyState } from './stage-empty-state';
import {
  InsightsExecutiveSummary,
  InsightsSectionHeader,
  RawDataAppendix,
} from './insights-ui';
import { CATATab, CommentsTab, EmotionalTab, HedonicTab, IntensityTab } from './survey-analysis-tabs';
import { AllSamplesComparisonView } from './all-samples-comparison';
import { MultiSampleAnalysis } from './multi-sample-analysis';
import { ConceptTestAnalysis } from './concept-test-analysis';

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
  const exportSampleCSV = () => {
    downloadCsv(
      buildSampleCSVRows(selectedData, selectedSample, usingLiveData, activeEmotions),
      `${selectedData.sampleId.toLowerCase()}-insights-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  return (
    <div className="space-y-6">
      <ProjectHeader />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Understand what the evidence says, how reliable it is, and what the project should do next.</p>
        </div>
        <Select value={selectedSample} onValueChange={setRequestedSample}>
          <SelectTrigger className="w-full bg-white sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            {projectSamples.map(sample => <SelectItem key={sample.sampleId} value={sample.sampleId}>{sample.sampleName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <InsightsExecutiveSummary
        sampleName={selectedData.sampleName}
        category={formatFoodTypeLabel(foodType)}
        projectName={status.projectName}
        panelResponses={liveResponseCount}
        conceptResponses={primaryConceptResponses.length}
        strength={strength}
        keyStrength={keyStrength}
        keyConcern={keyConcern}
        nextAction={nextAction}
      />

      {liveDataFetchFailed && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Live panel responses could not be loaded. Any reference charts below are for method orientation only.
        </div>
      )}

      <section className="space-y-4">
        <InsightsSectionHeader
          id="sensory-evidence"
          icon={Users}
          title="Sensory evidence"
          description="Panel perception, liking, descriptors, intensity, and emotional response for the selected sample."
          action={<DataProvenanceBadge provenance={usingLiveData ? 'live' : 'reference'} n={usingLiveData ? liveResponseCount : undefined} />}
        />
        {!usingLiveData && !usingReferenceData ? (
          <StageEmptyState icon={Users} headline="No sensory responses yet" body="Assign and send the questionnaire to collect live panel evidence for this sample." cta={{ label: 'Configure survey', to: '/admin' }} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [Heart, 'Average liking', `${averageHedonic.toFixed(1)}/9`],
                [CheckSquare, 'Top descriptor', activeCata[0]?.attribute ?? 'Not available'],
                [TrendingUp, 'Average intensity', `${averageIntensity.toFixed(1)}/${usingLiveData ? 5 : 10}`],
                [Smile, 'Emotional balance', emotionalBalance.toFixed(1)],
              ].map(([Icon, label, value]) => (
                <Card key={String(label)} className="border border-slate-200">
                  <CardContent className="flex items-center gap-3 py-4">
                    <Icon className="size-5 shrink-0 text-slate-500" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">{String(label)}</p>
                      <p className="mt-0.5 truncate text-lg font-bold text-slate-950">{String(value)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Tabs defaultValue="hedonic">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
                <TabsTrigger value="hedonic">Liking</TabsTrigger>
                <TabsTrigger value="cata">Descriptors</TabsTrigger>
                <TabsTrigger value="intensity">Intensity</TabsTrigger>
                <TabsTrigger value="emotional">Emotional</TabsTrigger>
              </TabsList>
              <TabsContent value="hedonic"><HedonicTab activeHedonicData={activeHedonic} activeAvgHedonic={averageHedonic.toFixed(1)} activePanelistN={panelN} usingLiveData={usingLiveData} /></TabsContent>
              <TabsContent value="cata"><CATATab activeCataAttributes={activeCata} activePanelistN={panelN} usingLiveData={usingLiveData} activeSampleId={selectedData.sampleId} /></TabsContent>
              <TabsContent value="intensity"><IntensityTab activeIntensityData={activeIntensity} activePanelistN={panelN} usingLiveData={usingLiveData} intensityMax={usingLiveData ? 5 : 10} /></TabsContent>
              <TabsContent value="emotional"><EmotionalTab activeEmotions={activeEmotions} activeEmotionalBalance={emotionalBalance.toFixed(1)} activePanelistN={panelN} usingLiveData={usingLiveData} /></TabsContent>
            </Tabs>
          </>
        )}
      </section>

      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
          <span>
            Explore detailed evidence
            <span className="ml-2 font-normal text-slate-500">Instrument data, comparisons, concepts, comments, and raw exports</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-slate-500" aria-hidden />
        </summary>
        <div className="space-y-8 border-t border-slate-100 p-5">
      <section className="space-y-4">
        <InsightsSectionHeader id="instrumental-evidence" icon={FlaskConical} title="Instrumental evidence" description="Imported machine measurements remain separate from panel perception and are interpreted only when linked to this sample." action={selectedInstrument && <DataProvenanceBadge provenance="imported" />} />
        {!selectedInstrument ? (
          <StageEmptyState icon={FlaskConical} headline="No linked instrumental record" body="Import or link instrument data before making machine-supported claims for this sample." cta={{ label: 'Import data', to: '/stage1' }} />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <MetricList title="E-tongue taste signals" items={[
                ['Sourness', selectedInstrument.sourness], ['Bitterness', selectedInstrument.bitterness],
                ['Saltiness', selectedInstrument.saltiness], ['Umami', selectedInstrument.umami], ['Sweetness', selectedInstrument.sweetness],
              ]} />
              <MetricList title="Composition" items={selectedComposition ? [
                ['Protein', `${selectedComposition.protein.toFixed(1)}%`], ['Fat', `${selectedComposition.fat.toFixed(1)}%`],
                ['Moisture', `${selectedComposition.moisture.toFixed(1)}%`], ['Salt', `${selectedComposition.saltContent.toFixed(2)}%`], ['pH', selectedComposition.pH.toFixed(2)],
              ] : []} />
              <MetricList title="Aroma compounds" items={selectedGcms.slice(0, 5).map(compound => [compound.name, `${compound.concentration.toFixed(1)} ppm`])} />
            </div>
            <p className="text-xs text-slate-500">
              {datasetsPresent} of 3 expected instrumental sources are linked to this sample.
              {!usingLiveData && ' Collect live sensory responses before claiming sensory and instrumental alignment.'}
            </p>
          </>
        )}
      </section>

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

function MetricList({ title, items }: { title: string; items: Array<[string, string | number]> }) {
  return (
    <Card className="border border-slate-200">
      <CardContent className="py-4">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Not available for this sample.</p>
        ) : (
          <dl className="mt-3 space-y-2">
            {items.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-sm font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
