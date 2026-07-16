import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useFoodType, sampleMatchesFoodType, matchFoodType } from "../contexts/food-type-context";
import { parseBatchSelection } from "../lib/project-identity";
import { Button } from "./ui/button";
import { CheckCircle2, FileSpreadsheet, FileText, GitMerge, Megaphone } from "lucide-react";
import { ENHANCED_SENSORY_DATA, type EnhancedSensoryProfile } from "../data/enhanced-sensory";
import { DataProvenanceBadge } from "./data-provenance-badge";
import { useAuth } from "../contexts/auth-context";
import { insertDecisionRecord, saveEvidenceBundle } from "../lib/database";
import { formatFoodTypeLabel, getFoodTypeProfile } from "../lib/food-intelligence";
import { queryKeys, useDecisionRecords, useImportBatches, useInstrumentalDataset, useProducts, useWorkspaceSettings } from "../lib/hooks";
import { useSurveyData } from "../lib/use-survey-data";
import { calculateGoStopTweakDecision, type GoStopTweakDecision } from "../utils/go-stop-tweak-engine";
import { assessSampleWorkflow, summarizeProjectReadiness } from "../lib/workflow-readiness";
import { downloadDecisionReportExcel, downloadDecisionReportPdf } from "../utils/decision-report";
import { filterProjectInstrumentSamples } from "../lib/insights";
import {
  buildEvidencePositioningPromise,
  buildInstrumentEvidenceSummary,
  buildPanelEvidenceSummary,
  strongestHedonicSignals,
  topSuccessfulPanelSignals,
} from "../lib/concept-positioning-promise";
import { buildImportedSensoryProfiles } from "../lib/sensory-evidence-profile";
import { canConfirmDecisionOutcome, decisionRecordMatchesEvidence } from "../lib/decision-governance";
import { workflowStagePath } from "../lib/project-journey-routes";
import { DecisionReviewDialog } from "./decision-review-dialog";
import { DecisionReviewWorkspace } from "./decision-review-workspace";
import { TweakIntelligencePanel } from "./tweak-intelligence-panel";
import { WorkflowPageHeader } from "./workflow-page-header";
import { ProjectReadinessSetupCard } from "./project-readiness-setup-card";
import { FormulationContextStrip } from './formulation-context-strip';
import { buildEvidenceBundleFromProfiles } from '../lib/report-evidence';
import type { DecisionOutcome } from "../utils/go-stop-tweak-engine";
type SampleDecision = GoStopTweakDecision;
type ConfirmedSampleDecision = SampleDecision & {
  recordId?: string | null;
  parentDecisionId?: string | null;
  formulationVersionId?: string | null;
  evidenceBundleId?: string | null;
};

const DEFAULT_WEIGHTS = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };

function titleList(items: string[]) {
  return items.filter(Boolean).map(item => item.trim()).filter(Boolean).join(', ');
}

function buildConceptSeedFromDecision(
  decision: ConfirmedSampleDecision,
  profile: EnhancedSensoryProfile | undefined,
  foodTypeSlug: string,
) {
  const effectiveFoodTypeSlug =
    foodTypeSlug === 'all' && profile
      ? sampleMatchesFoodType(profile.sampleId, profile.sampleName)
      : foodTypeSlug;
  const foodLabel = effectiveFoodTypeSlug !== 'all' ? formatFoodTypeLabel(effectiveFoodTypeSlug) : undefined;
  const foodProfile = getFoodTypeProfile(effectiveFoodTypeSlug);
  const likedSignals = profile
    ? [...topSuccessfulPanelSignals(profile, effectiveFoodTypeSlug), ...strongestHedonicSignals(profile)]
    : foodProfile.successMarkers.slice(0, 4);
  const marketCues = likedSignals.length ? titleList(likedSignals) : titleList(foodProfile.successMarkers.slice(0, 4));
  const category = foodLabel ?? foodProfile.label;
  const decisionWatchouts = decision.gates
    .filter(gate => gate.status === 'watch' || gate.status === 'fail')
    .map(gate => `${gate.label}: ${gate.detail}`)
    .slice(0, 2);

  return {
    name: decision.sampleName,
    category,
    description: buildEvidencePositioningPromise({
      category,
      sourceSampleName: decision.sampleName,
      sensoryStrengths: likedSignals,
      panelEvidence: profile ? buildPanelEvidenceSummary(profile, effectiveFoodTypeSlug) : [],
      instrumentEvidence: profile ? buildInstrumentEvidenceSummary(profile) : [],
      issfScore: decision.issfScore,
      confidence: decision.confidenceScore,
      decisionRationale: decision.recommendation,
      watchouts: decisionWatchouts,
    }),
    productAppearance: `Make ${decision.sampleName} look true to the ${category.toLowerCase()} category, with appetizing texture and visible cues for ${marketCues}.`,
    packageFormat: 'Retail-ready pack with clear product name, category recognition, and a believable serving suggestion.',
    targetMarket: /cashew.*cream cheese/i.test(decision.sampleName)
      ? 'Flexitarian and plant-curious shoppers looking for a familiar, creamy chilled spread.'
      : `${category} shoppers looking for a familiar product experience grounded in the validated sensory profile.`,
    targetOccasion: 'Everyday use occasion where the strongest liked cues are immediately relevant.',
    visualSetting: 'Clean retail or kitchen setting that makes the product quality easy to judge.',
    colorDirection: 'Use a commercial palette that supports the strongest liked sensory cues without overclaiming.',
    mustShow: `Product name, category cue, serving suggestion, and visual support for ${marketCues}.`,
    keyBenefits: marketCues,
    technicalChallenges: decisionWatchouts.join('\n'),
    sourceDecision: {
      id: decision.sampleId,
      sampleId: decision.sampleId,
      sampleName: decision.sampleName,
      issfScore: decision.issfScore,
      confidence: decision.confidenceScore,
      timestamp: new Date().toISOString(),
      likedSignals,
      formulationVersionId: decision.formulationVersionId ?? null,
      evidenceBundleId: decision.evidenceBundleId ?? null,
    },
  };
}

export function Stage4Enhanced() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { foodType, subCategory, extraFoodTypes } = useFoodType();
  const { data: instrumentalDataset } = useInstrumentalDataset(user?.role === 'admin');
  const { data: importBatches = [] } = useImportBatches();
  const { data: products = [] } = useProducts();
  const { data: workspaceSettings } = useWorkspaceSettings();
  const { data: decisionRecords = [] } = useDecisionRecords();
  const { liveAggregations } = useSurveyData();
  const selectedBatchId = parseBatchSelection(subCategory);
  const [selectedSample, setSelectedSample] = useState<string>("");
  const [confirmPending, setConfirmPending] = useState(false);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [confirmedDecision, setConfirmedDecision] = useState<ConfirmedSampleDecision | null>(null);
  const [reportError, setReportError] = useState("");
  const [reportExporting, setReportExporting] = useState(false);
  const stopThreshold = workspaceSettings?.decisionStopThreshold ?? 45;
  const goThreshold = workspaceSettings?.decisionGoThreshold ?? 75;
  const minimumResponses = workspaceSettings?.decisionMinResponses ?? 12;
  const retestParentDecisionId = (location.state as { retestParentDecisionId?: string } | null)?.retestParentDecisionId ?? null;
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
  const selectedProjectId = selectedBatchId
    ? importBatches.find(batch => batch.id === selectedBatchId)?.projectId ?? null
    : null;
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
        const product = products.find(item =>
          item.sourceSampleId === sample.sampleId &&
          (
            !selectedBatchId ||
            item.sourceImportBatchId === selectedBatchId ||
            (selectedProjectId ? item.projectId === selectedProjectId : false)
          )
        );
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
  ), [instrumentalDataset, liveAggregations, minimumResponses, products, projectInstrumentSamples, selectedBatchId, selectedProjectId]);

  const liveSensoryData = useMemo<EnhancedSensoryProfile[]>(() => {
    const activeTypes = new Set(extraFoodTypes);
    const referenceProfiles = ENHANCED_SENSORY_DATA.filter(profile =>
      activeTypes.has(sampleMatchesFoodType(profile.sampleId, profile.sampleName))
    );
    const referenceIds = new Set(referenceProfiles.map(profile => profile.sampleId));
    const importedProfiles = buildImportedSensoryProfiles(
      instrumentalDataset,
      liveAggregations,
      { minimumResponses, excludeSampleIds: referenceIds },
    );
    return [...referenceProfiles, ...importedProfiles];
  }, [
    extraFoodTypes,
    instrumentalDataset,
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
          (!selectedBatchId || product.sourceImportBatchId === selectedBatchId || (selectedProjectId ? product.projectId === selectedProjectId : false))
        ).length;
    // Same rollup Insights uses, so both pages agree on what stage this
    // project is actually at instead of always assuming "nothing exists yet".
    const readiness = summarizeProjectReadiness(importedReadiness);
    const awaitingResponses = readiness.stage === 'awaiting-responses';

    return (
      <div className="space-y-6">
        <WorkflowPageHeader
          title="Final Decision"
          description={`Decision scoring will unlock after imported ${activeLabel} samples have questionnaire responses.`}
        />

        <ProjectReadinessSetupCard
          icon={GitMerge}
          headline={awaitingResponses ? 'Questionnaires are live — waiting on panelist responses' : 'Create questionnaires from the imported data first'}
          description={awaitingResponses
            ? `${readiness.withQuestionnaire} questionnaire${readiness.withQuestionnaire === 1 ? '' : 's'} ${readiness.withQuestionnaire === 1 ? 'has' : 'have'} been created and sent to panelists. ISSF scores a sample once it reaches ${minimumResponses} completed responses — ${readiness.totalResponses} response${readiness.totalResponses === 1 ? '' : 's'} collected so far.`
            : `${activeLabel} is in the platform. The next step is turning those imported machine samples into panelist questionnaires, then ISSF can score the responses.`}
          stats={[
            { value: importedSamples.length, label: 'machine samples ready' },
            { value: productCount, label: 'products configured' },
            { value: readiness.totalResponses, label: 'completed questionnaires' },
          ]}
          items={importedReadiness}
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
  const selectedProfile = selected
    ? filteredSensoryData.find(profile => profile.sampleId === selected.sampleId)
    : undefined;
  const selectedFoodType = selected
    ? instrumentalDataset?.eTongueData.find(item => item.sampleId === selected.sampleId)?.type
      ?? sampleMatchesFoodType(selected.sampleId, selected.sampleName)
    : foodType;
  const persistedDecisionRecord = selected
    ? decisionRecords.find(record => decisionRecordMatchesEvidence(record, {
        sampleId: selected.sampleId,
        decisionFingerprint: selected.decisionFingerprint,
        projectId: selectedProjectId,
      }))
    : null;
  const confirmedDecisionForSelection: ConfirmedSampleDecision | null = selected
    ? confirmedDecision?.sampleId === selected.sampleId &&
      confirmedDecision.decisionFingerprint === selected.decisionFingerprint
        ? confirmedDecision
        : persistedDecisionRecord
          ? {
              ...selected,
              decision: persistedDecisionRecord.decision,
              recordId: persistedDecisionRecord.id,
              parentDecisionId: persistedDecisionRecord.parentDecisionId,
              formulationVersionId: persistedDecisionRecord.formulationVersionId,
              evidenceBundleId: persistedDecisionRecord.evidenceBundleId,
            }
          : null
    : null;
  // Reference profiles come from the simulated demo dataset; everything else in
  // liveSensoryData is built from imports + live panel aggregations.
  const selectedIsReference = ENHANCED_SENSORY_DATA.some(p => p.sampleId === activeSelectedSample);

  return (
    <div className="space-y-6">
      <WorkflowPageHeader
        title="Decision Review"
        description="Review the recommendation, confirm the outcome, and move the project forward."
        status={selected ? <DataProvenanceBadge provenance={selectedIsReference ? 'reference' : 'live'} /> : null}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={reportExporting} onClick={() => exportReport('pdf', sampleDecisions)}>
              <FileText className="size-4" />
              {reportExporting ? 'Preparing...' : 'PDF'}
            </Button>
            <Button variant="outline" size="sm" disabled={reportExporting} onClick={() => exportReport('xlsx', sampleDecisions)}>
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
          </div>
        )}
      />
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
                The decision is locked. Continue to concept validation or open the report workspace to prepare the client deliverable.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={workflowStagePath(
                'report',
                routeProjectId,
                `?decision=${encodeURIComponent(confirmedDecisionForSelection.recordId ?? '')}&create=1`,
              )}>
                <FileText className="size-4" />
                Open report workspace
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800">
              <Link
                to={workflowStagePath('concept', routeProjectId)}
                state={{
                  conceptSeed: buildConceptSeedFromDecision(
                    confirmedDecisionForSelection,
                    filteredSensoryData.find(profile => profile.sampleId === confirmedDecisionForSelection.sampleId),
                    foodType,
                  ),
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
          <FormulationContextStrip projectId={routeProjectId} sampleId={selected.sampleId} context="decision" />
          <DecisionReviewWorkspace
            decisions={sampleDecisions}
            selected={selected}
            stopThreshold={stopThreshold}
            goThreshold={goThreshold}
            confirmedDecision={confirmedDecisionForSelection ?? null}
            intelligencePanel={(
              <TweakIntelligencePanel
                decision={selected}
                profile={selectedProfile}
                foodType={selectedFoodType}
                goThreshold={goThreshold}
                embedded
              />
            )}
            onSelect={setSelectedSample}
            onConfirm={() => setConfirmPending(true)}
          />

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
          if (!selected || !user?.id || decisionSaving || selected.decisionStatus === 'hold') return;
          if (!canConfirmDecisionOutcome(selected.decision, outcome)) {
            setDecisionError('A decision can only be confirmed as calculated or made more conservative.');
            return;
          }
          setDecisionSaving(true);
          setDecisionError("");
          try {
            if (!selectedProfile) throw new Error('The selected sample evidence is unavailable.');
            const currentFormulationVersionId = instrumentalDataset?.formulationVersions?.[selected.sampleId]
              ?.find(version => version.isCurrent)?.id ?? null;
            const evidencePayload = buildEvidenceBundleFromProfiles({
              projectId: selected.sampleId,
              profiles: [selectedProfile],
              foodTypeSlug: selectedFoodType,
              createdBy: user.id,
              thresholds: { go: goThreshold, stop: stopThreshold },
              minimumResponses,
            });
            const evidenceBundle = await saveEvidenceBundle({
              projectId: selected.sampleId,
              canonicalProjectId: selectedProjectId,
              formulationVersionId: currentFormulationVersionId,
              schemaVersion: evidencePayload.schemaVersion,
              sourceDataVersion: evidencePayload.sourceDataVersion,
              payload: evidencePayload as unknown as Record<string, unknown>,
            });
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
              projectId: selectedProjectId,
              parentDecisionId: retestParentDecisionId,
              formulationVersionId: currentFormulationVersionId,
              evidenceBundleId: evidenceBundle.id,
            });
            if (newDecisionId) {
              await saveEvidenceBundle({
                projectId: selected.sampleId,
                canonicalProjectId: selectedProjectId,
                decisionRecordId: newDecisionId,
                formulationVersionId: currentFormulationVersionId,
                schemaVersion: evidencePayload.schemaVersion,
                sourceDataVersion: evidencePayload.sourceDataVersion,
                payload: evidencePayload as unknown as Record<string, unknown>,
              });
            }
            await queryClient.invalidateQueries({ queryKey: queryKeys.decisionRecords });
            setConfirmedDecision({
              ...selected,
              decision: outcome,
              recordId: newDecisionId,
              parentDecisionId: retestParentDecisionId,
              formulationVersionId: currentFormulationVersionId,
              evidenceBundleId: evidenceBundle.id,
            });
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
