import { STATUS } from '../styles/tokens';
import { useState, useMemo } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useFoodType, sampleMatchesFoodType, matchFoodType } from "../contexts/food-type-context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp, Activity, Award, Zap, ClipboardCheck, GitMerge, Download, FileSpreadsheet, FileText, Megaphone, Settings2 } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from "recharts";
import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from "../data/enhanced-sensory";
import { DataProvenanceBadge } from "./data-provenance-badge";
import { DecisionLog } from "./decision-log";
import { useAuth } from "../contexts/auth-context";
import { insertDecisionRecord } from "../lib/database";
import { formatFoodTypeLabel } from "../lib/food-intelligence";
import { queryKeys, useDecisionRecords, useInstrumentalDataset, useProducts, useWorkspaceSettings } from "../lib/hooks";
import { useSurveyData } from "../lib/use-survey-data";
import { calculateGoStopTweakDecision, type GoStopTweakDecision } from "../utils/go-stop-tweak-engine";
import { assessSampleWorkflow } from "../lib/workflow-readiness";
import { downloadDecisionReportExcel, downloadDecisionReportPdf } from "../utils/decision-report";
import { filterProjectInstrumentSamples } from "../lib/insights";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { CommercializationReportBuilder } from "./commercialization-report-builder";
import { ProjectHeader } from "./project-header";
import { DecisionSummaryCard } from "./decision-summary-card";
import { DecisionReviewDialog } from "./decision-review-dialog";
import type { DecisionOutcome } from "../utils/go-stop-tweak-engine";

import { IssfGauge, PathToGoPanel } from "./stage4-panels";
type SampleDecision = GoStopTweakDecision;


export function Stage4Enhanced() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { foodType, subCategory, extraFoodTypes } = useFoodType();
  const { data: instrumentalDataset } = useInstrumentalDataset(user?.role === 'admin');
  const { data: products = [] } = useProducts();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const { liveAggregations } = useSurveyData();
  const selectedBatchId = subCategory?.startsWith('batch:') ? subCategory.replace('batch:', '') : null;
  const [selectedSample, setSelectedSample] = useState<string>("");
  const [showRawData, setShowRawData] = useState(false);
  const [showQualitative, setShowQualitative] = useState(false);
  const [showWeightConfig, setShowWeightConfig] = useState(false);
  const [weights, setWeights] = useState({ hedonic: 30, texture: 25, cata: 25, emotional: 15 });
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const [confirmPending, setConfirmPending] = useState(false);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [confirmedDecision, setConfirmedDecision] = useState<SampleDecision | null>(null);
  const [reportError, setReportError] = useState("");
  const [reportExporting, setReportExporting] = useState(false);
  const stopThreshold = workspaceSettings?.decisionStopThreshold ?? 52;
  const goThreshold = workspaceSettings?.decisionGoThreshold ?? 76;
  const minimumResponses = workspaceSettings?.decisionMinResponses ?? 12;
  const projectInstrumentSamples = useMemo(
    () => filterProjectInstrumentSamples(
      instrumentalDataset?.eTongueData ?? [],
      foodType,
      selectedBatchId,
    ),
    [foodType, instrumentalDataset?.eTongueData, selectedBatchId],
  );
  const projectSampleIds = useMemo(
    () => new Set(projectInstrumentSamples.map(sample => sample.sampleId)),
    [projectInstrumentSamples],
  );
  const reportOptions = (decisions: SampleDecision[]) => ({
    foodType: formatFoodTypeLabel(foodType),
    decisions,
    organizationName: workspaceSettings?.organizationName ?? 'New Food Innovation',
    workspaceName: workspaceSettings?.workspaceName ?? 'Sensory Analysis Workspace',
    reportFooter: workspaceSettings?.reportFooter,
    goThreshold,
    stopThreshold,
  });
  const exportReport = async (format: 'pdf' | 'xlsx', decisions: SampleDecision[]) => {
    setReportError('');
    setReportExporting(true);
    try {
      if (format === 'pdf') await downloadDecisionReportPdf(reportOptions(decisions));
      else await downloadDecisionReportExcel(reportOptions(decisions));
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Unable to create the report.');
    } finally {
      setReportExporting(false);
    }
  };
  const importedReadiness = useMemo(() => (
    projectInstrumentSamples
      .map(sample => {
        const product = products.find(item => item.sourceSampleId === sample.sampleId);
        const aggregation = liveAggregations.find(item => item.sourceSampleId === sample.sampleId);
        return assessSampleWorkflow({
          sample,
          product,
          responseCount: aggregation?.n ?? 0,
          minimumResponses,
          hasGcms: (instrumentalDataset?.gcmsData[sample.sampleId]?.length ?? 0) > 0,
          hasComposition: Boolean(instrumentalDataset?.compositionData[sample.sampleId]),
        });
      })
  ), [instrumentalDataset, liveAggregations, minimumResponses, products, projectInstrumentSamples]);

  const liveSensoryData = useMemo<EnhancedSensoryProfile[]>(() => {
    const activeTypes = new Set(extraFoodTypes);
    const referenceProfiles = ENHANCED_SENSORY_DATA.filter(profile =>
      activeTypes.has(sampleMatchesFoodType(profile.sampleId, profile.sampleName))
    );
    const referenceIds = new Set(referenceProfiles.map(profile => profile.sampleId));
    const importedProfiles = (instrumentalDataset?.eTongueData ?? []).flatMap(sample => {
      if (referenceIds.has(sample.sampleId)) return [];
      const aggregation = liveAggregations.find(item => item.sourceSampleId === sample.sampleId);
      if (!aggregation || aggregation.n < minimumResponses) return [];
      const composition = instrumentalDataset?.compositionData[sample.sampleId];
      const compounds = instrumentalDataset?.gcmsData[sample.sampleId] ?? [];
      return [{
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
          starchDryMatter: Math.max(0, 100 - (
            (composition?.moisture ?? 0) +
            (composition?.fat ?? 0) +
            (composition?.protein ?? 0)
          )),
        },
        gcmsOlfactometry: compounds.map((compound, index) => ({
          retentionTime: index + 1,
          compound: compound.name,
          nistProbability: 0,
          peakArea: compound.concentration,
          odour: compound.aroma,
          odourIntensity: compound.threshold > 0 && compound.concentration > compound.threshold
            ? 5
            : Math.min(5, Math.max(1, compound.concentration)),
          concentration: compound.concentration,
          threshold: compound.threshold,
        })),
        istdRecovery: 90,
        olfactometryFlowSplit: 'Imported CSV',
        cata: aggregation.cata,
        intensity: aggregation.intensity,
        hedonic: {
          appearance: aggregation.hedonic.appearance ?? 0,
          flavour: aggregation.hedonic.flavor ?? 0,
          texture: aggregation.hedonic.texture ?? 0,
          overall: aggregation.hedonic.overall ?? 0,
        },
        emotions: aggregation.emotions,
      }];
    });
    return [...referenceProfiles, ...importedProfiles];
  }, [
    extraFoodTypes,
    instrumentalDataset?.compositionData,
    instrumentalDataset?.eTongueData,
    instrumentalDataset?.gcmsData,
    liveAggregations,
    minimumResponses,
  ]);

  const filteredSensoryData = liveSensoryData.filter(s => {
    const importedSample = instrumentalDataset?.eTongueData.find(sample => sample.sampleId === s.sampleId);
    const ft = importedSample?.type ?? sampleMatchesFoodType(s.sampleId, s.sampleName);
    if (foodType !== 'all' && ft !== foodType) return false;
    if (selectedBatchId && !projectSampleIds.has(s.sampleId)) return false;
    if (subCategory && !selectedBatchId && !s.sampleName.toLowerCase().includes(subCategory.toLowerCase())) return false;
    return true;
  });

  if (filteredSensoryData.length === 0) {
    const activeLabel = foodType === 'all' ? 'selected food types' : formatFoodTypeLabel(foodType);
    const importedSamples = selectedBatchId
      ? projectInstrumentSamples
      : (instrumentalDataset?.eTongueData ?? []).filter(sample => foodType === 'all' || sample.type === foodType);
    const activeProducts = products.filter(product => product.status !== 'archived');
    const productCount = foodType === 'all'
      ? activeProducts.length
      : activeProducts.filter(product =>
          matchFoodType(product.category) === foodType &&
          (!selectedBatchId || product.sourceImportBatchId === selectedBatchId)
        ).length;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Final Decision</h1>
          <p className="text-sm text-slate-500 mt-1">
            Decision scoring will unlock after imported {activeLabel} samples have questionnaire responses.
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-amber-50">
                  <GitMerge className="size-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Create questionnaires from the imported data first</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {activeLabel} is in the platform. The next step is turning those imported machine samples into panelist questionnaires, then ISSF can score the responses.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">{importedSamples.length}</div>
                  <div className="text-sm text-slate-500">machine samples ready</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">{productCount}</div>
                  <div className="text-sm text-slate-500">products configured</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-2xl font-bold text-slate-900">0</div>
                  <div className="text-sm text-slate-500">completed questionnaires</div>
                </div>
              </div>

              {importedReadiness.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
                  {importedReadiness.map(item => (
                    <div key={item.sampleId} className="border-b border-slate-100 p-4 last:border-b-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">{item.sampleName}</div>
                          <div className="text-xs text-slate-500">{item.sampleId}</div>
                        </div>
                        <Badge variant="outline" className={item.decisionReady
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'}>
                          {item.decisionReady ? 'Decision ready' : `${item.responseCount}/${minimumResponses} responses`}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.stages.map(stage => (
                          <span
                            key={stage.id}
                            title={stage.detail}
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              stage.state === 'complete'
                                ? 'bg-emerald-50 text-emerald-700'
                                : stage.state === 'current'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {stage.label}
                          </span>
                        ))}
                      </div>
                      {item.blockers.length > 0 && (
                        <p className="mt-3 text-sm text-slate-600">{item.blockers[0]}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/stage1">Create questionnaires</Link>
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

  const sampleDecisions: SampleDecision[] = filteredSensoryData.map(sample => {
    const sampleFoodType = instrumentalDataset?.eTongueData.find(item => item.sampleId === sample.sampleId)?.type
      ?? sampleMatchesFoodType(sample.sampleId, sample.sampleName);
    return calculateGoStopTweakDecision(sample, weights, sampleFoodType, {
      go: goThreshold,
      stop: stopThreshold,
    });
  });

  const activeSelectedSample = sampleDecisions.some(decision => decision.sampleId === selectedSample)
    ? selectedSample
    : sampleDecisions[0]?.sampleId ?? '';
  const selected = sampleDecisions.find(d => d.sampleId === activeSelectedSample);
  const selectedSensory = liveSensoryData.find(s => s.sampleId === activeSelectedSample);
  const persistedDecisionRecord = selected
    ? decisionRecords.find(record =>
        record.sampleId === selected.sampleId &&
        record.decisionFingerprint === selected.decisionFingerprint
      )
    : null;
  const confirmedDecisionForSelection = selected && (
    confirmedDecision?.sampleId === selected.sampleId &&
    confirmedDecision.decisionFingerprint === selected.decisionFingerprint
      ? confirmedDecision
      : persistedDecisionRecord
        ? { ...selected, decision: persistedDecisionRecord.decision }
        : null
  );
  // Reference profiles come from the simulated demo dataset; everything else in
  // liveSensoryData is built from imports + live panel aggregations.
  const selectedIsReference = ENHANCED_SENSORY_DATA.some(p => p.sampleId === activeSelectedSample);

  // Stats
  const stats = {
    go: sampleDecisions.filter(d => d.decision === "GO").length,
    tweak: sampleDecisions.filter(d => d.decision === "TWEAK").length,
    stop: sampleDecisions.filter(d => d.decision === "STOP").length,
    avgConfidence: Math.round(sampleDecisions.reduce((sum, d) => sum + d.confidenceScore, 0) / sampleDecisions.length),
    lowRisk: sampleDecisions.filter(d => d.riskLevel === "low").length,
  };

  const getDecisionIcon = (decision: string) => {
    if (decision === "GO") return (
      <span className="flex items-center gap-1">
        <span className="font-bold text-emerald-600">▲</span>
        <CheckCircle2 className="size-5 text-emerald-600" />
      </span>
    );
    if (decision === "STOP") return (
      <span className="flex items-center gap-1">
        <span className="font-bold text-rose-600">■</span>
        <XCircle className="size-5 text-rose-600" />
      </span>
    );
    return (
      <span className="flex items-center gap-1">
        <span className="font-bold text-amber-600">◆</span>
        <AlertTriangle className="size-5 text-amber-600" />
      </span>
    );
  };

  // Scatter data: ISSF Score vs Hedonic
  const scatterData = sampleDecisions.map((d, index) => {
    const sensory = liveSensoryData.find(s => s.sampleId === d.sampleId);
    return {
      id: `scatter-${d.sampleId}-${index}`,
      sampleId: d.sampleId,
      name: `${d.sampleName}-${index}`,
      sample: d.sampleName,
      issf: d.issfScore,
      hedonic: sensory ? sensory.hedonic.overall : 0,
      decision: d.decision,
    };
  });

  return (
    <div className="space-y-6">
      <ProjectHeader />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Decision Review</h1>
            {selected && (
              <DataProvenanceBadge provenance={selectedIsReference ? 'reference' : 'live'} />
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">Review the recommendation, confirm the outcome, and move the project forward.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={reportExporting}>
                <Download className="size-4 mr-2" />
                {reportExporting ? 'Preparing report...' : 'Export report'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => exportReport('pdf', sampleDecisions)}>
                <FileText className="size-4" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportReport('xlsx', sampleDecisions)}>
                <FileSpreadsheet className="size-4" />
                Download Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {reportError && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{reportError}</p>
      )}
      {confirmedDecisionForSelection?.decision === 'GO' && (
        <div className="flex flex-col gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-semibold text-emerald-950">
                {confirmedDecisionForSelection.sampleName} is confirmed for commercialization.
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                Build the branded launch report now, or continue into packaging and marketing concept development.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CommercializationReportBuilder
              decision={confirmedDecisionForSelection}
              foodType={foodType}
              userId={user?.id}
              settings={workspaceSettings}
            />
            <Button asChild size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800">
              <Link
                to="/concept-testing"
                state={{
                  conceptSeed: {
                    name: confirmedDecisionForSelection.sampleName,
                    category: foodType !== 'all' ? formatFoodTypeLabel(foodType) : undefined,
                    description: `A new product concept inspired by ${confirmedDecisionForSelection.sampleName}, which received a confirmed GO decision for commercialization.`,
                    sourceDecision: {
                      id: confirmedDecisionForSelection.sampleId,
                      sampleName: confirmedDecisionForSelection.sampleName,
                      issfScore: confirmedDecisionForSelection.issfScore,
                      confidence: confirmedDecisionForSelection.confidenceScore,
                      timestamp: new Date().toISOString(),
                    },
                  },
                }}
              >
                <Megaphone className="size-4" />
                Open Concept Lab
              </Link>
            </Button>
          </div>
        </div>
      )}

      {confirmedDecisionForSelection?.decision === 'TWEAK' && (
        <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-950">
                {confirmedDecisionForSelection.sampleName} needs an adjustment before it can advance.
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Make the planned adjustment, then import a retest batch to confirm the change worked.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="bg-amber-600 text-white hover:bg-amber-700">
            <Link to="/stage1">
              <GitMerge className="size-4" />
              Import retest data
            </Link>
          </Button>
        </div>
      )}

      {confirmedDecisionForSelection?.decision === 'STOP' && (
        <div className="flex flex-col gap-4 rounded-lg border border-rose-200 bg-rose-50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 size-5 shrink-0 text-rose-700" />
            <div>
              <p className="font-semibold text-rose-950">
                {confirmedDecisionForSelection.sampleName} will not advance to commercialization.
              </p>
              <p className="mt-1 text-sm text-rose-800">
                Review the gate failures above, or start a new formulation with imported data.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="border-rose-300 text-rose-800 hover:bg-rose-100">
            <Link to="/stage1">
              <GitMerge className="size-4" />
              Start a new formulation
            </Link>
          </Button>
        </div>
      )}

      {selected && (
        <DecisionSummaryCard
          decision={selected}
          action={(
            <Button onClick={() => setConfirmPending(true)} className="bg-blue-700 text-white hover:bg-blue-800">
              <ClipboardCheck className="size-4" />
              Confirm outcome
            </Button>
          )}
        />
      )}


      {/* Prototype selection and supporting evidence */}
      <div className="grid grid-cols-4 gap-6">
        {/* Sample List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prototypes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[1200px] overflow-y-auto">
              {sampleDecisions.map(sample => (
                <button
                  key={sample.sampleId}
                  onClick={() => setSelectedSample(sample.sampleId)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    activeSelectedSample === sample.sampleId
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">{sample.sampleName}</span>
                    {getDecisionIcon(sample.decision)}
                  </div>
                  <div className="text-xs text-slate-600">{sample.issfScore.toFixed(0)}/100</div>
                  <div className="text-xs text-slate-500">±{sample.confidenceScore.toFixed(0)}%</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="col-span-3 space-y-6">
          {selected && selectedSensory && (
            <>
              <details className="rounded-lg border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                  <span>
                    <span className="block text-sm font-bold text-slate-900">Supporting evidence</span>
                    <span className="mt-0.5 block text-xs text-slate-500">Decision gates, score path, prescriptions, and sensory profile</span>
                  </span>
                  <span className="text-xs font-semibold text-blue-700">Review details</span>
                </summary>
              <Card className="rounded-none border-x-0 border-b-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Supporting evidence</p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">{selected.sampleName}</h2>
                    </div>
                    <IssfGauge
                      score={selected.issfScore}
                      confidence={selected.confidenceScore}
                      stopThreshold={stopThreshold}
                      goThreshold={goThreshold}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200 mb-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <GitMerge className="size-5 text-slate-600" />
                        Decision Gates
                      </h3>
                      <span className="text-xs text-slate-500">Hard gates override weighted score</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {selected.gates.map(gate => (
                        <div
                          key={gate.id}
                          className={`rounded-lg border p-3 ${
                            gate.status === 'pass'
                              ? 'border-emerald-200 bg-emerald-50'
                              : gate.status === 'watch'
                                ? 'border-amber-200 bg-amber-50'
                                : 'border-rose-200 bg-rose-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{gate.label}</p>
                            <Badge className={
                              gate.status === 'pass'
                                ? 'bg-emerald-600'
                                : gate.status === 'watch'
                                  ? 'bg-amber-600'
                                  : 'bg-rose-600'
                            }>
                              {gate.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{gate.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200 mb-4">
                    <h3 className="font-bold text-slate-900 mb-2">Key Findings</h3>
                    <ul className="space-y-2">
                      {selected.details.map((detail, idx) => (
                        <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="text-slate-400">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selected.prescriptions.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border-2 border-amber-200 mb-4">
                      <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Zap className="size-4 text-amber-600" />
                        Tweak Prescription
                      </h3>
                      <div className="space-y-3">
                        {selected.prescriptions.map(prescription => (
                          <div key={`${prescription.priority}-${prescription.target}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-slate-900">
                                {prescription.priority}. {prescription.target}
                              </p>
                              <Badge className="bg-amber-600">+{prescription.expectedLift.toFixed(0)} possible pts</Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-700">{prescription.action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <PathToGoPanel
                    selected={selected}
                    selectedSensory={selectedSensory}
                    weights={weights}
                    goThreshold={goThreshold}
                  />

                  {/* Multi-dimensional profile */}
                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-3">Sensory Profile</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-600 mb-2">Taste (E-Tongue)</div>
                        <div className="space-y-1">
                          {Object.entries(selectedSensory.taste).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="capitalize text-slate-700">{key}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-purple-600 h-2 rounded-full" 
                                    style={{ width: `${(value / 10) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-slate-600 w-8 text-right">{value.toFixed(1)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-600 mb-2">Texture (Panelist Intensity)</div>
                        <div className="space-y-1">
                          {Object.entries(selectedSensory.intensity).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className="capitalize text-slate-700">{key}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${(value / 10) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-slate-600 w-8 text-right">{value.toFixed(1)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </details>

              {/* Qualitative Insights */}
              {showQualitative && selectedSensory.trainedPanelReference && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="size-5 text-amber-600" />
                      Validation: Trained Panel Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-xs text-blue-700 mb-1">ISSF Score</div>
                        <div className="text-3xl font-bold text-blue-900">{selected.issfScore.toFixed(1)}</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-xs text-purple-700 mb-1">Trained Panel Score</div>
                        <div className="text-3xl font-bold text-purple-900">{selectedSensory.trainedPanelReference.overallQuality}</div>
                      </div>
                      <div className={`p-4 rounded-lg border ${
                        Math.abs(selected.issfScore - selectedSensory.trainedPanelReference.overallQuality) < 10 ?
                        "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
                      }`}>
                        <div className="text-xs text-slate-700 mb-1">Difference (Δ)</div>
                        <div className="text-3xl font-bold text-slate-900">
                          {Math.abs(selected.issfScore - selectedSensory.trainedPanelReference.overallQuality).toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-700">
                        <strong>Agreement:</strong> {selected.decision === selectedSensory.trainedPanelReference.recommendation ? 
                          <span className="text-emerald-600"><CheckCircle2 className="size-3.5 inline mr-1" />Both methods agree: {selected.decision}</span> :
                          <span className="text-amber-600">△ ISSF: {selected.decision} | Trained: {selectedSensory.trainedPanelReference.recommendation}</span>
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Raw Data */}
              {showRawData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Raw Instrumental Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 p-4 rounded-lg font-mono text-xs">
                      <pre>{JSON.stringify(selectedSensory, null, 2)}</pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
          <Settings2 className="size-4 text-slate-500" />
          Supporting analysis and method settings
          <span className="font-normal text-slate-500">Batch comparison, score weights, validation, raw data, and audit history</span>
        </summary>
        <div className="space-y-6 border-t border-slate-100 p-5">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowWeightConfig(!showWeightConfig)} variant="outline" size="sm">Score weights</Button>
            <Button onClick={() => setShowQualitative(!showQualitative)} variant="outline" size="sm">Validation</Button>
            <Button onClick={() => setShowRawData(!showRawData)} variant="outline" size="sm">Raw data</Button>
            <Button onClick={() => setShowAuditTrail(v => !v)} variant="outline" size="sm">Audit trail</Button>
          </div>
      {/* Weight Configuration */}
      {showWeightConfig && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-blue-600" />
              ISSF Score Weights
              <span className="ml-auto text-xs text-slate-500 font-normal">
                Total: <span className={
                  weights.hedonic + weights.texture + weights.cata + weights.emotional === 95
                    ? 'text-emerald-600 font-bold'
                    : 'text-amber-600 font-bold'
                }>{weights.hedonic + weights.texture + weights.cata + weights.emotional}%</span>
                {' '}before instrument-signal calibration
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-6">
              {([
                { key: 'hedonic', label: 'Hedonic Score', color: 'rose' },
                { key: 'texture', label: 'Texture Quality', color: 'blue' },
                { key: 'cata', label: 'CATA Attributes', color: 'purple' },
                { key: 'emotional', label: 'Emotional Profile', color: 'emerald' },
              ] as const).map(({ key, label, color }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">{label}</label>
                    <span className={`text-lg font-bold text-${color}-600`}>{weights[key]}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={95}
                    step={5}
                    value={weights[key]}
                    onChange={e => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>0%</span>
                    <span>95%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Default: Hedonic 30%, Texture 25%, CATA 25%, Emotional 15%. The engine then blends machine signal and applies hard GC-O/QC gates.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWeights({ hedonic: 30, texture: 25, cata: 25, emotional: 15 })}
              >
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Decision Summary */}
      <Card className="shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-800">Batch Decision Summary</span>
            <span className="text-xs text-slate-500">{sampleDecisions.length} prototypes analyzed</span>
          </div>
          <div className="flex rounded-lg overflow-hidden h-9 shadow-inner">
            {stats.go > 0 && (
              <button
                type="button"
                className="bg-emerald-500 flex items-center justify-center text-white text-sm font-bold gap-1 transition-all cursor-pointer hover:bg-emerald-600"
                style={{ width: `${(stats.go / sampleDecisions.length) * 100}%` }}
                title="Select first GO sample"
                aria-label={`Select first GO sample (${stats.go} of ${sampleDecisions.length})`}
                onClick={() => {
                  const first = sampleDecisions.find(d => d.decision === "GO");
                  if (first) setSelectedSample(first.sampleId);
                }}
              >
                ▲ {stats.go}
              </button>
            )}
            {stats.tweak > 0 && (
              <button
                type="button"
                className="bg-amber-500 flex items-center justify-center text-white text-sm font-bold gap-1 transition-all cursor-pointer hover:bg-amber-600"
                style={{ width: `${(stats.tweak / sampleDecisions.length) * 100}%` }}
                title="Select first TWEAK sample"
                aria-label={`Select first TWEAK sample (${stats.tweak} of ${sampleDecisions.length})`}
                onClick={() => {
                  const first = sampleDecisions.find(d => d.decision === "TWEAK");
                  if (first) setSelectedSample(first.sampleId);
                }}
              >
                ◆ {stats.tweak}
              </button>
            )}
            {stats.stop > 0 && (
              <button
                type="button"
                className="bg-rose-500 flex items-center justify-center text-white text-sm font-bold gap-1 transition-all cursor-pointer hover:bg-rose-600"
                style={{ width: `${(stats.stop / sampleDecisions.length) * 100}%` }}
                title="Select first STOP sample"
                aria-label={`Select first STOP sample (${stats.stop} of ${sampleDecisions.length})`}
                onClick={() => {
                  const first = sampleDecisions.find(d => d.decision === "STOP");
                  if (first) setSelectedSample(first.sampleId);
                }}
              >
                ■ {stats.stop}
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{stats.go}</div>
              <div className="text-xs text-slate-500 mt-0.5">GO</div>
              <div className="text-xs text-slate-400">advance now</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{stats.tweak}</div>
              <div className="text-xs text-slate-500 mt-0.5">TWEAK</div>
              <div className="text-xs text-slate-400">minor fix</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-600">{stats.stop}</div>
              <div className="text-xs text-slate-500 mt-0.5">STOP</div>
              <div className="text-xs text-slate-400">reformulate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.avgConfidence}%</div>
              <div className="text-xs text-slate-500 mt-0.5">Confidence</div>
              <div className="text-xs text-slate-400">avg certainty</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ISSF Score vs Hedonic */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-blue-600" />
            ISSF Score vs. Hedonic Liking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350} key="issf-hedonic-container">
            <ScatterChart 
              margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
              id="issf-hedonic-scatter"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <ReferenceArea x1={0} x2={52} y1={0} y2={9} fill="#fecaca" fillOpacity={0.25} />
              <ReferenceArea x1={52} x2={76} y1={0} y2={9} fill="#fde68a" fillOpacity={0.25} />
              <ReferenceArea x1={76} x2={100} y1={0} y2={9} fill="#a7f3d0" fillOpacity={0.25} />
              <ReferenceLine x={52} stroke={STATUS.stop} strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "STOP", position: "insideTopLeft", fill: "#b91c1c", fontSize: 10 }} />
              <ReferenceLine x={76} stroke={STATUS.go} strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "GO", position: "insideTopRight", fill: "#065f46", fontSize: 10 }} />
              <XAxis
                type="number" 
                dataKey="issf" 
                name="ISSF Score" 
                domain={[0, 100]}
                label={{ value: 'ISSF Score (0-100)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                type="number" 
                dataKey="hedonic" 
                name="Hedonic" 
                domain={[0, 9]}
                label={{ value: 'Hedonic Liking (1-9)', angle: -90, position: 'insideLeft' }}
              />
              <RechartsTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 shadow-xl rounded-lg border border-slate-200">
                        <p className="font-bold text-slate-900">{data.sample}</p>
                        <p className="text-sm text-slate-700">ISSF: {data.issf.toFixed(1)}</p>
                        <p className="text-sm text-slate-700">Hedonic: {data.hedonic.toFixed(1)}/9</p>
                        <p className="text-sm font-bold capitalize">{data.decision}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter
                key="scatter-issf-hedonic"
                data={scatterData}
                dataKey="issf"
                isAnimationActive={false}
                style={{ cursor: 'pointer' }}
                shape={(props: { cx?: number; cy?: number; payload?: SampleDecision & { id?: string; sample?: string } }) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: SampleDecision & { id?: string; sample?: string } };
                  const isSelected = payload.sampleId === activeSelectedSample;
                  let color: string = STATUS.go;
                  if (payload.decision === "STOP") color = STATUS.stop;
                  if (payload.decision === "TWEAK") color = STATUS.tweak;
                  const s = isSelected ? 9 : 6;
                  const shapeKey = `shape-${payload.id || payload.sample}`;
                  const handleClick = () => setSelectedSample(payload.sampleId);
                  if (payload.decision === "GO") {
                    return (
                      <g key={shapeKey} onClick={handleClick} style={{ cursor: 'pointer' }}>
                        {isSelected && <circle cx={cx} cy={cy} r={15} fill="none" stroke={STATUS.selected} strokeWidth={2.5} />}
                        <polygon points={`${cx},${cy - s} ${cx + s * 0.9},${cy + s * 0.5} ${cx - s * 0.9},${cy + s * 0.5}`} fill={color} stroke="#fff" strokeWidth={1} />
                      </g>
                    );
                  }
                  if (payload.decision === "STOP") {
                    return (
                      <g key={shapeKey} onClick={handleClick} style={{ cursor: 'pointer' }}>
                        {isSelected && <circle cx={cx} cy={cy} r={13} fill="none" stroke={STATUS.selected} strokeWidth={2.5} />}
                        <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} fill={color} stroke="#fff" strokeWidth={1} />
                      </g>
                    );
                  }
                  return (
                    <g key={shapeKey} onClick={handleClick} style={{ cursor: 'pointer' }}>
                      {isSelected && <circle cx={cx} cy={cy} r={14} fill="none" stroke={STATUS.selected} strokeWidth={2.5} />}
                      <polygon points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`} fill={color} stroke="#fff" strokeWidth={1} />
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-slate-700">GO ({stats.go})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500"></div>
              <span className="text-sm text-slate-700">TWEAK ({stats.tweak})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-rose-500"></div>
              <span className="text-sm text-slate-700">STOP ({stats.stop})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit trail panel */}
      {showAuditTrail && <DecisionLog refreshKey={logRefreshKey} />}
        </div>
      </details>

      <DecisionReviewDialog
        key={`${selected?.sampleId ?? 'none'}-${confirmPending ? 'open' : 'closed'}`}
        open={confirmPending}
        decision={selected ?? null}
        saving={decisionSaving}
        error={decisionError}
        onOpenChange={open => {
          setConfirmPending(open);
          if (!open) setDecisionError("");
        }}
        onConfirm={async (outcome: DecisionOutcome, note: string) => {
          if (!selected || !user?.id || decisionSaving) return;
          setDecisionSaving(true);
          setDecisionError("");
          try {
            await insertDecisionRecord({
              sampleId: selected.sampleId,
              sampleName: selected.sampleName,
              decision: outcome,
              issfScore: selected.issfScore,
              confidence: selected.confidenceScore,
              note,
              methodVersion: selected.methodVersion,
              decisionFingerprint: selected.decisionFingerprint,
              createdBy: user.id,
            });
            await queryClient.invalidateQueries({ queryKey: queryKeys.decisionRecords });
            setLogRefreshKey(key => key + 1);
            setConfirmedDecision({ ...selected, decision: outcome });
            setConfirmPending(false);
          } catch (error) {
            setDecisionError(error instanceof Error ? error.message : "Unable to save this decision.");
          } finally {
            setDecisionSaving(false);
          }
        }}
      />
    </div>
  );
}
