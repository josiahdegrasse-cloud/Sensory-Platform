import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useFoodType, sampleMatchesFoodType, matchFoodType } from "../contexts/food-type-context";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CheckCircle2, Download, FileSpreadsheet, FileText, GitMerge, Megaphone } from "lucide-react";
import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from "../data/enhanced-sensory";
import { DataProvenanceBadge } from "./data-provenance-badge";
import { DecisionLog } from "./decision-log";
import { useAuth } from "../contexts/auth-context";
import { insertDecisionRecord } from "../lib/database";
import { RETEST_PARENT_DECISION_KEY } from "./stage1-instrumental-data";
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
import { DecisionReviewDialog } from "./decision-review-dialog";
import { DecisionReviewWorkspace } from "./decision-review-workspace";
import type { DecisionOutcome } from "../utils/go-stop-tweak-engine";
type SampleDecision = GoStopTweakDecision;

const DEFAULT_WEIGHTS = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };

export function Stage4Enhanced() {
  const location = useLocation();
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
    return calculateGoStopTweakDecision(sample, DEFAULT_WEIGHTS, sampleFoodType, {
      go: goThreshold,
      stop: stopThreshold,
    });
  });

  const activeSelectedSample = sampleDecisions.some(decision => decision.sampleId === selectedSample)
    ? selectedSample
    : sampleDecisions[0]?.sampleId ?? '';
  const selected = sampleDecisions.find(d => d.sampleId === activeSelectedSample);
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
              initiallyOpen={Boolean((location.state as { openReport?: boolean } | null)?.openReport)}
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

      {selected && (
        <>
          <DecisionReviewWorkspace
            decisions={sampleDecisions}
            selected={selected}
            stopThreshold={stopThreshold}
            goThreshold={goThreshold}
            confirmedDecision={confirmedDecisionForSelection ?? null}
            onSelect={setSelectedSample}
            onConfirm={() => setConfirmPending(true)}
          />

          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
              <span>
                <span className="block text-sm font-semibold text-slate-900">Method and decision history</span>
                <span className="mt-0.5 block text-xs text-slate-500">Review calculation metadata and prior confirmations.</span>
              </span>
              <span className="text-xs font-semibold text-blue-700">Show details</span>
            </summary>
            <div className="space-y-5 border-t border-slate-100 p-5">
              <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Method version</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{selected.methodVersion}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Evidence fingerprint</dt>
                  <dd className="mt-1 font-mono text-xs font-semibold text-slate-900">{selected.decisionFingerprint}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Decision thresholds</dt>
                  <dd className="mt-1 font-semibold text-slate-900">STOP &lt; {stopThreshold}; GO ≥ {goThreshold}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Scoring profile</dt>
                  <dd className="mt-1 font-semibold text-slate-900">Workspace default weights</dd>
                </div>
              </dl>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAuditTrail(value => !value)}>
                {showAuditTrail ? 'Hide decision history' : 'View decision history'}
              </Button>
              {showAuditTrail && <DecisionLog refreshKey={logRefreshKey} />}
            </div>
          </details>
        </>
      )}

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
            const parentDecisionId = localStorage.getItem(RETEST_PARENT_DECISION_KEY) ?? undefined;
            const newDecisionId = await insertDecisionRecord({
              sampleId: selected.sampleId,
              sampleName: selected.sampleName,
              decision: outcome,
              issfScore: selected.issfScore,
              confidence: selected.confidenceScore,
              note,
              methodVersion: selected.methodVersion,
              decisionFingerprint: selected.decisionFingerprint,
              createdBy: user.id,
              parentDecisionId,
            });
            localStorage.removeItem(RETEST_PARENT_DECISION_KEY);
            if (newDecisionId && (outcome === 'TWEAK' || outcome === 'STOP')) {
              localStorage.setItem(RETEST_PARENT_DECISION_KEY, newDecisionId);
            }
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
