import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertCircle, BarChart3, ChevronDown, Download, Layers, Megaphone, Users,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { useFoodType, sampleMatchesFoodType } from '../contexts/food-type-context';
import { parseBatchSelection } from '../lib/project-identity';
import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from '../data/enhanced-sensory';
import {
  useAdminConceptTests,
  useConceptTestResponses,
  useDecisionRecords,
  useFormulationExperiments,
  useImportBatches,
  useInstrumentalDataset,
  useProducts,
  useWorkspaceSettings,
} from '../lib/hooks';
import { mergeAnalysisProfiles } from '../lib/analysis-dataset';
import {
  deriveInsightsEvidenceStrength,
  filterProjectConceptTests,
  filterProjectInstrumentSamples,
  filterProjectProducts,
} from '../lib/insights';
import { useProjectStatus } from '../lib/use-project-status';
import { assessSampleWorkflow, summarizeProjectReadiness } from '../lib/workflow-readiness';
import { useSurveyData } from '../lib/use-survey-data';
import { formatFoodTypeLabel } from '../lib/food-intelligence';
import { buildAllDataCSVRows, buildSampleCSVRows, downloadCsv } from '../utils/survey-csv-export';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { StageEmptyState } from './stage-empty-state';
import { ProjectReadinessSetupCard } from './project-readiness-setup-card';
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
import { TEMPORARY_CHEESE_PRODUCT } from '../data/demo/temporary-cheese-demo';
import { WorkflowPageHeader } from './workflow-page-header';
import { FormulationContextStrip } from './formulation-context-strip';
import { buildProductEvidenceSummary } from '../lib/product-evidence';
import { projectDecisionExperimentsPath, projectPath } from '../lib/project-journey-routes';

const INTENSITY_CHART_MAX = 5;

function toFivePointIntensity(value: number, sourceScale: 5 | 10) {
  const normalized = sourceScale === 10 ? value / 2 : value;
  return Math.max(0, Math.min(INTENSITY_CHART_MAX, normalized));
}

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
      // No instrument QC in a CSV import; the reference-blend merge backfills
      // the demo value only for demo-ID samples (see mergeAnalysisProfiles).
      istdRecovery: null,
      olfactometryFlowSplit: 'Imported CSV',
      cata: {},
      intensity: {},
      hedonic: { appearance: 0, flavour: 0, texture: 0, overall: 0 },
      emotions: { positive: 0, negative: 0 },
    };
  });
}

export function SurveyAnalysis() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const { user } = useAuth();
  const { foodType, subCategory } = useFoodType();
  const importBatchId = parseBatchSelection(subCategory);
  const status = useProjectStatus(foodType, importBatchId);
  const { data: importBatches = [] } = useImportBatches();
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
  const selectedProjectId = importBatchId
    ? importBatches.find(batch => batch.id === importBatchId)?.projectId ?? null
    : null;
  const effectiveProjectId = routeProjectId ?? selectedProjectId ?? undefined;
  const { data: formulationExperiments = [] } = useFormulationExperiments(effectiveProjectId);
  const projectProducts = useMemo(
    () => filterProjectProducts(products, projectSampleIds, foodType, importBatchId, selectedProjectId),
    [products, projectSampleIds, foodType, importBatchId, selectedProjectId],
  );
  // Same per-sample rollup Decision uses, so both pages agree on "where are
  // we" instead of Insights staying silent while Decision says something else.
  const insightsReadinessItems = useMemo(() => (
    projectInstrumentSamples.map(sample => assessSampleWorkflow({
      sample,
      product: projectProducts.find(product => product.sourceSampleId === sample.sampleId),
      responseCount: liveAggregations.find(item => item.sourceSampleId === sample.sampleId)?.n ?? 0,
      minimumResponses,
      hasGcms: (instrumentalDataset?.gcmsData[sample.sampleId]?.length ?? 0) > 0,
      hasComposition: Boolean(instrumentalDataset?.compositionData[sample.sampleId]),
    }))
  ), [instrumentalDataset, liveAggregations, minimumResponses, projectInstrumentSamples, projectProducts]);
  const projectReadiness = useMemo(() => summarizeProjectReadiness(insightsReadinessItems), [insightsReadinessItems]);
  const importedProfiles = useMemo(() => buildImportedProfiles(instrumentalDataset), [instrumentalDataset]);
  const mergedProfiles = useMemo(() => mergeAnalysisProfiles(ENHANCED_SENSORY_DATA, importedProfiles), [importedProfiles]);
  // A sample only earns a spot in the interactive view once it has real
  // evidence — either baked-in reference/demo data, or at least one live
  // response. Freshly imported machine samples with zero responses so far
  // stay out of the chart UI (which would otherwise be blank) and show up in
  // ProjectReadinessSetupCard's per-sample list instead, appearing here the
  // moment their first response comes in.
  const findLiveAggregationForSample = (sampleId: string, sampleName: string) => liveAggregations.find(aggregation =>
    aggregation.sourceSampleId === sampleId ||
    aggregation.productName.toLowerCase() === sampleName.toLowerCase() ||
    aggregation.productName.toLowerCase().includes(`(${sampleId.toLowerCase()})`)
  );
  const hasEvidence = (profile: EnhancedSensoryProfile) =>
    !projectSampleIds.has(profile.sampleId) // reference/demo profile, or out-of-project browsing
    || Boolean(findLiveAggregationForSample(profile.sampleId, profile.sampleName));
  const projectSamples = useMemo(() => {
    if (projectInstrumentSamples.length > 0) {
      return mergedProfiles.filter(profile => projectSampleIds.has(profile.sampleId) && hasEvidence(profile));
    }
    if (importBatchId) return [];
    return mergedProfiles.filter(profile => sampleMatchesFoodType(profile.sampleId, profile.sampleName) === foodType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectInstrumentSamples.length, projectSampleIds, mergedProfiles, importBatchId, foodType, liveAggregations]);

  const selectedSample = projectSamples.some(sample => sample.sampleId === requestedSample)
    ? requestedSample
    : projectSamples[0]?.sampleId ?? '';
  const selectedData = projectSamples.find(sample => sample.sampleId === selectedSample);
  const selectedInstrument = projectInstrumentSamples.find(sample => sample.sampleId === selectedSample);
  const matchingLiveData = selectedData ? findLiveAggregationForSample(selectedData.sampleId, selectedData.sampleName) : undefined;
  const usingLiveData = Boolean(matchingLiveData);
  const usingTemporaryDemo = matchingLiveData?.productId === TEMPORARY_CHEESE_PRODUCT.id;
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
  const selectedDecision = selectedData
    ? projectDecisions.find(decision => decision.sampleId === selectedData.sampleId) ?? null
    : null;
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
  if (user?.role !== 'admin') return null;

  if (!selectedData) {
    const activeLabel = foodType === 'all' ? 'selected food types' : formatFoodTypeLabel(foodType);

    // Samples were imported and are moving through the pipeline, just none
    // have live evidence yet — show the same setup/status page Decision uses
    // instead of a bare "nothing here" empty state (this only triggers when
    // every imported sample still has zero responses; the moment any one of
    // them gets a response it graduates into the interactive view above).
    if (projectInstrumentSamples.length > 0) {
      const awaitingResponses = projectReadiness.stage === 'awaiting-responses';
      return (
        <div className="space-y-6">
          <WorkflowPageHeader
            title="Insights"
            description={`Interpret panel and instrumental evidence for ${activeLabel}.`}
          />
          <ProjectReadinessSetupCard
            icon={BarChart3}
            headline={awaitingResponses ? 'Questionnaires are live — waiting on panelist responses' : 'Create questionnaires from the imported data first'}
            description={awaitingResponses
              ? `${projectReadiness.withQuestionnaire} questionnaire${projectReadiness.withQuestionnaire === 1 ? '' : 's'} ${projectReadiness.withQuestionnaire === 1 ? 'has' : 'have'} been sent to panelists. Each sample's charts appear here automatically as soon as its first responses come in.`
              : `${activeLabel} is in the platform. The next step is turning those imported machine samples into panelist questionnaires so Insights has evidence to interpret.`}
            stats={[
              { value: projectInstrumentSamples.length, label: 'machine samples imported' },
              { value: projectReadiness.withQuestionnaire, label: 'questionnaires sent' },
              { value: projectReadiness.totalResponses, label: 'responses collected' },
            ]}
            items={insightsReadinessItems}
            minimumResponses={minimumResponses}
            actions={awaitingResponses ? (
              <Button asChild>
                <Link to="/admin">Go to Studies</Link>
              </Button>
            ) : (
              <>
                <Button asChild>
                  <Link to="/stage1">Create questionnaires</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/admin">Review questionnaire setup</Link>
                </Button>
              </>
            )}
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Insights"
          description={`Interpret panel and instrumental evidence for ${activeLabel}.`}
        />
        <StageEmptyState
          icon={BarChart3}
          headline={`No analyzable samples for ${activeLabel}`}
          body="This project does not have panel or reference evidence available to interpret yet."
          cta={{ label: 'Open project overview', to: '/project' }}
          secondaryCta={{ label: 'Open Studies', to: '/admin' }}
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
    ? Object.entries(matchingLiveData.intensity).map(([attribute, value]) => ({
        id: `intensity-${attribute}`,
        attribute,
        value: toFivePointIntensity(value, 5),
        fullMark: INTENSITY_CHART_MAX,
      }))
    : Object.entries(selectedData.intensity).map(([attribute, value]) => ({
        id: `intensity-${attribute}`,
        attribute,
        value: toFivePointIntensity(value, 10),
        fullMark: INTENSITY_CHART_MAX,
      }));
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
  const strongestHedonic = [...activeHedonic].sort((a, b) => b.score - a.score)[0];
  const weakestHedonic = [...activeHedonic].sort((a, b) => a.score - b.score)[0];
  const keyStrength = usingLiveData
    ? strongestHedonic && strongestHedonic.score > 0
      ? `${strongestHedonic.category} is the strongest liking dimension at ${strongestHedonic.score.toFixed(1)}/9.`
      : activeCata[0] ? `${activeCata[0].attribute} is the most-selected descriptor.` : 'No clear sensory strength is established yet.'
    : datasetsPresent > 0
      ? `Machine evidence is linked for ${selectedData.sampleName}, but consumer preference has not been measured.`
      : `No live sensory or machine evidence is available for ${selectedData.sampleName}.`;
  const keyConcern = !usingLiveData
    ? `Collect at least ${minimumResponses} live panel responses before making liking, preference, or purchase claims.`
    : weakestHedonic && weakestHedonic.score < 6
      ? `${weakestHedonic.category} is the lowest liking dimension at ${weakestHedonic.score.toFixed(1)}/9.`
      : strength.note;
  const selectedFormulationVersions = instrumentalDataset?.formulationVersions?.[selectedData.sampleId] ?? [];
  const selectedExperiment = formulationExperiments.find(experiment => (
    projectDecisions.some(decision => (
      decision.id === experiment.decisionRecordId
      && decision.sampleId === selectedData.sampleId
    ))
  )) ?? null;
  const productEvidenceSummary = buildProductEvidenceSummary({
    sampleName: selectedData.sampleName,
    responseCount: liveResponseCount,
    minimumResponses,
    instrumentSources: datasetsPresent,
    strength,
    keyStrength,
    keyConcern,
    decision: selectedDecision,
    formulationVersions: selectedFormulationVersions,
    experiment: selectedExperiment,
  });
  const decisionHref = effectiveProjectId ? projectPath(effectiveProjectId, 'decision') : '/decision';
  const studiesHref = effectiveProjectId ? projectPath(effectiveProjectId, 'studies') : '/admin';
  const experimentSearch = selectedExperiment
    ? `?decision=${encodeURIComponent(selectedExperiment.decisionRecordId)}&experiment=${encodeURIComponent(selectedExperiment.id)}`
    : selectedDecision
      ? `?decision=${encodeURIComponent(selectedDecision.id)}`
      : '';
  const experimentHref = effectiveProjectId && (selectedExperiment || selectedDecision?.decision === 'TWEAK' || selectedDecision?.decision === 'STOP')
    ? projectDecisionExperimentsPath(effectiveProjectId, experimentSearch)
    : null;
  const nextActionHref = productEvidenceSummary.state === 'collecting'
    ? studiesHref
    : productEvidenceSummary.state.includes('experiment')
      || ['confirmation_required', 'capture_learning', 'learning_approved'].includes(productEvidenceSummary.state)
      ? experimentHref ?? decisionHref
      : decisionHref;

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
  const prototypeScores = projectSamples.map(sample => {
    const live = findLiveAggregationForSample(sample.sampleId, sample.sampleName);
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
        ? 'Highest current liking'
        : responseCount > 0 && responseCount < minimumResponses
          ? 'Needs more responses'
          : responseCount === 0
            ? 'No live panel evidence'
            : 'Panel evidence available',
      signalTone: isLeader ? 'success' : responseCount < minimumResponses ? 'warning' : 'neutral',
    };
  });
  const exportSampleCSV = () => {
    downloadCsv(
      buildSampleCSVRows(selectedData, selectedSample, usingLiveData, activeEmotions),
      `${selectedData.sampleId.toLowerCase()}-insights-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };
  const selectedConceptSummary = primaryConcept
    ? `${primaryConcept.name} · ${primaryConcept.category}${primaryConcept.projectName ? ` · ${primaryConcept.projectName}` : ''}`
    : 'No concept test linked yet';

  return (
    <div className="space-y-6">
      <WorkflowPageHeader
        title="Prototype results"
        description="Compare each prototype’s sensory performance and open the next workflow step when needed."
        actions={(
          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
          {projectSamples.length} prototype{projectSamples.length === 1 ? '' : 's'} · {prototypeOptions.reduce((total, prototype) => total + prototype.responseCount, 0)} live response{prototypeOptions.reduce((total, prototype) => total + prototype.responseCount, 0) === 1 ? '' : 's'}
          </span>
        )}
      />

      <FormulationContextStrip projectId={routeProjectId} sampleId={selectedData.sampleId} context="insights" />

      {usingTemporaryDemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Temporary cheese demo:</strong> the panel responses shown for {selectedData.sampleName} are synthetic preview data.
          Replace them with collected panel responses before using these findings externally.
        </div>
      )}

      {liveDataFetchFailed && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Live panel responses could not be loaded. Any reference charts below are for method orientation only.
        </div>
      )}

      <Tabs defaultValue="food-panel" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <TabsTrigger value="food-panel" className="flex-col items-start gap-0 rounded-xl px-4 py-3 text-left data-[state=active]:bg-blue-50 data-[state=active]:text-blue-800">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Users className="size-4" />
              Food panel results
            </span>
            <span className="mt-0.5 text-xs font-normal text-slate-500">What panelists think of the food</span>
          </TabsTrigger>
          <TabsTrigger value="concept-testing" className="flex-col items-start gap-0 rounded-xl px-4 py-3 text-left data-[state=active]:bg-blue-50 data-[state=active]:text-blue-800">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Megaphone className="size-4" />
              Concept testing
            </span>
            <span className="mt-0.5 text-xs font-normal text-slate-500">Feedback on the marketing concept</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="food-panel" className="space-y-4">
          <section className="space-y-4">
            <InsightsPrototypeWorkspace
              prototypes={prototypeOptions}
              selectedId={selectedSample}
              onSelect={setRequestedSample}
              panelResponses={liveResponseCount}
              instrumentSources={datasetsPresent}
              usingLiveData={usingLiveData}
              strength={strength}
              summary={productEvidenceSummary}
              nextActionHref={nextActionHref}
              experimentHref={experimentHref}
              likingContent={<HedonicTab activeHedonicData={activeHedonic} activeAvgHedonic={averageHedonic.toFixed(1)} activePanelistN={panelN} usingLiveData={usingLiveData} activeSampleId={selectedData.sampleId} activeSampleName={selectedData.sampleName} />}
              descriptorContent={<CATATab activeCataAttributes={activeCata} activePanelistN={panelN} usingLiveData={usingLiveData} activeSampleId={selectedData.sampleId} activeSampleName={selectedData.sampleName} />}
              intensityContent={<IntensityTab activeIntensityData={activeIntensity} activePanelistN={panelN} usingLiveData={usingLiveData} activeSampleId={selectedData.sampleId} activeSampleName={selectedData.sampleName} />}
              commentsContent={<CommentsTab usingLiveData={usingLiveData} matchingLiveData={matchingLiveData} commentsByProduct={commentsByProduct} />}
              comparisonContent={showComparison && (
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
            />
          </section>
        </TabsContent>

        <TabsContent value="concept-testing" className="space-y-4">
          <EvidencePathCard
            icon={Megaphone}
            label="Concept testing results"
            title={primaryConcept ? primaryConcept.name : 'No concept linked yet'}
            detail="Appeal, purchase intent, benefit preference, visual direction, and panelist concept language."
            metrics={[
              `${projectConcepts.length} concept test${projectConcepts.length === 1 ? '' : 's'}`,
              `${primaryConceptResponses.length} response${primaryConceptResponses.length === 1 ? '' : 's'}`,
              selectedConceptSummary,
            ]}
          />
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <InsightsSectionHeader
              id="concept-feedback"
              icon={Megaphone}
              title="Feedback from concept testing"
              description="Solely concept-level evidence: appeal, purchase intent, positioning, benefits, visuals, and comments."
            />
            <ConceptTestAnalysis projectTests={projectConcepts} minimumResponses={minimumResponses} />
          </section>
        </TabsContent>
      </Tabs>

      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
          <span>
            Methods and exports
            <span className="ml-2 font-normal text-slate-500">Provenance, thresholds, and downloadable project data</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-slate-500" aria-hidden />
        </summary>
        <div className="space-y-8 border-t border-slate-200 p-5">
      <RawDataAppendix>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Method and provenance</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              <li>Sensory source: {usingLiveData ? `${liveResponseCount} live panel responses` : 'reference/demo profile'}.</li>
              <li>Instrument sources: {datasetsPresent} of 3 available.</li>
              <li>Concept responses: {primaryConceptResponses.length}.</li>
              <li>Configured decision threshold: {minimumResponses} responses.</li>
              <li>Decision: {selectedDecision ? `${selectedDecision.decision}, ISSF ${selectedDecision.issfScore.toFixed(0)}` : 'not recorded'}.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Exports</h3>
            <p className="mt-1 text-sm text-slate-700">CSV exports contain raw and aggregated values. Provenance and evidence limitations should accompany any client-facing interpretation.</p>
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

function EvidencePathCard({
  icon: Icon,
  label,
  title,
  detail,
  metrics,
}: {
  icon: typeof Users;
  label: string;
  title: string;
  detail: string;
  metrics: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">{detail}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.map(metric => (
          <span key={metric} className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
            {metric}
          </span>
        ))}
      </div>
    </div>
  );
}
