import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, CheckCircle2, Cpu, ExternalLink, PackageCheck, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import {
  buildCommercializationSnapshot,
  DEFAULT_REPORT_ORGANIZATION_NAME,
  DEFAULT_REPORT_WORKSPACE_NAME,
  resolveReportLogoUrl,
  type CommercializationReportSnapshot,
} from '../lib/commercialization-report';
import {
  useAdminConceptTests,
  useCommercializationReports,
  useConceptTestResponses,
  useCreateCommercializationReport,
  useDecisionFreshness,
  useDecisionRecords,
  useFormulationVersions,
  useProjectEvidenceBundle,
  useSaveEvidenceBundle,
} from '../lib/hooks';
import { updateConceptImageReviewStatus, type WorkspaceSettings } from '../lib/database';
import { buildReportContext, type SensoryAugmentation } from '../lib/report-qc';
import {
  inspectLocalLlamaCapability,
  LOCAL_LLAMA_MODELS,
  runLocalLlamaReportWriter,
  type LocalLlamaCapability,
  type LocalLlamaModelId,
} from '../lib/local-llama';
import { fetchReportGrounding, type ReportGrounding } from '../lib/evidence-assist';
import { openResearchSource } from '../lib/rag-client';
import { conceptBelongsToProject } from '../lib/concept-project-scope';
import { reportBelongsToProject } from '../lib/report-project-scope';
import { getConceptImageMode } from '../../../supabase/functions/_shared/concept-image-catalog.ts';
import { preferredConceptImageIndex } from './concept-testing/smart-defaults';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function CommercializationReportBuilder({
  decision,
  foodType,
  projectId,
  userId,
  settings,
  initiallyOpen = false,
  triggerLabel = 'Build report',
  onSaved,
}: {
  decision: GoStopTweakDecision;
  foodType: string;
  projectId?: string;
  userId?: string;
  settings?: WorkspaceSettings;
  initiallyOpen?: boolean;
  triggerLabel?: string;
  onSaved?: (reportId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [conceptId, setConceptId] = useState('');
  const [imageIndexOverride, setImageIndex] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState('');
  const [checkingLiterature, setCheckingLiterature] = useState(false);
  const [groundingReview, setGroundingReview] = useState<{
    key: string;
    grounding: ReportGrounding | null;
    warning: string;
  } | null>(null);
  const [capability, setCapability] = useState<LocalLlamaCapability | null>(null);
  const [modelId, setModelId] = useState<LocalLlamaModelId>(LOCAL_LLAMA_MODELS[0].id);
  const generationAbort = useRef<AbortController | null>(null);
  const literatureAbort = useRef<AbortController | null>(null);

  const { data: decisions = [] } = useDecisionRecords();
  const { data: concepts = [] } = useAdminConceptTests();
  const { data: reports = [] } = useCommercializationReports();
  const { data: formulationVersions = [] } = useFormulationVersions();
  const confirmedGo = decisions.find(record =>
    record.sampleId === decision.sampleId
    && record.decision === 'GO'
    && record.decisionFingerprint === decision.decisionFingerprint
    && (!projectId || record.projectId === projectId)
  );
  const matchingConcepts = useMemo(() => concepts.filter(concept =>
    conceptBelongsToProject(concept, projectId ?? confirmedGo?.projectId)
    && (concept.foodTypeSlug === foodType || concept.category.toLowerCase().includes(foodType.toLowerCase())),
  ), [concepts, confirmedGo?.projectId, foodType, projectId]);
  const governedConcepts = useMemo(() => matchingConcepts.filter(concept =>
    concept.decisionRecordId === confirmedGo?.id
  ), [confirmedGo?.id, matchingConcepts]);
  const effectiveConceptId = conceptId || governedConcepts[0]?.id || '';
  const selectedConcept = governedConcepts.find(concept => concept.id === effectiveConceptId);
  const responsesQuery = useConceptTestResponses(effectiveConceptId);
  const responses = useMemo(() => responsesQuery.data ?? [], [responsesQuery.data]);
  const evidenceQuery = useProjectEvidenceBundle(decision.sampleId, userId, open);
  const evidenceBundle = evidenceQuery.data ?? null;
  const { data: decisionFreshness } = useDecisionFreshness(confirmedGo?.id);
  const createReport = useCreateCommercializationReport();
  const saveBundle = useSaveEvidenceBundle();
  const imageIndex = imageIndexOverride
    ?? (selectedConcept ? preferredConceptImageIndex(selectedConcept.imageMeta, selectedConcept.imageUrls.length) : 0);
  const canOpen = decision.decision === 'GO' && Boolean(confirmedGo);
  const canGenerate = Boolean(
    confirmedGo
    && selectedConcept
    && selectedConcept.imageUrls.length > 0
    && responsesQuery.isSuccess
    && evidenceBundle
    && userId
    && decisionFreshness?.allowed === true
    && capability?.supported
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot open after async decision eligibility resolves
    if (initiallyOpen && canOpen) setOpen(true);
  }, [canOpen, initiallyOpen]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void inspectLocalLlamaCapability().then(result => {
      if (!active) return;
      setCapability(result);
      setModelId(result.recommendedModelId);
    });
    return () => { active = false; };
  }, [open]);

  const nextVersion = selectedConcept && confirmedGo
    ? Math.max(0, ...reports
        .filter(report => report.decisionRecordId === confirmedGo.id && report.conceptTestId === selectedConcept.id)
        .filter(report => reportBelongsToProject(report, projectId ?? confirmedGo.projectId))
        .map(report => report.version)) + 1
    : 1;
  const groundingReviewKey = [
    confirmedGo?.id ?? '',
    effectiveConceptId,
    evidenceBundle?.sourceDataVersion ?? '',
    responses.length,
  ].join(':');
  const reviewedGrounding = groundingReview?.key === groundingReviewKey ? groundingReview : null;

  const buildDraft = (): CommercializationReportSnapshot | null => {
    if (!confirmedGo || !selectedConcept) return null;
    return buildCommercializationSnapshot({
      decisionRecord: confirmedGo,
      liveDecision: decision,
      concept: selectedConcept,
      responses,
      foodType,
      packagingImageId: selectedConcept.imageIds?.[imageIndex] ?? null,
      packagingImageUrl: selectedConcept.imageUrls[imageIndex] ?? '',
      packagingImageMeta: selectedConcept.imageMeta?.[imageIndex] ?? null,
    });
  };

  const buildContext = (snapshot: CommercializationReportSnapshot) => {
    if (!evidenceBundle) return null;
    const sensory = evidenceBundle.sensoryProfile ?? null;
    const augmentation: SensoryAugmentation = {
      panelSize: sensory?.panelSize ?? null,
      sourceEvidenceIds: evidenceBundle.evidence.map(record => record.id),
      intensity: sensory?.intensity,
      foodTypeSlug: sensory?.foodTypeSlug ?? foodType,
      instrumentalFindings: sensory?.instrumentalFindings,
      instrumentSignal: sensory?.instrumentSignal,
      gatePenalty: sensory?.gatePenalty,
      confidenceCalculation: sensory?.confidenceCalculation,
      sensoryDescriptors: (sensory?.descriptors ?? []).map(descriptor => ({
        descriptor: descriptor.descriptor,
        count: descriptor.count,
        sampleSize: sensory?.panelSize ?? 0,
        percentage: sensory?.panelSize ? descriptor.count / sensory.panelSize * 100 : 0,
      })),
      dimensions: Object.fromEntries(
        Object.entries(sensory?.dimensionMeasures ?? {}).map(([key, measures]) => [
          key,
          { measures, agreement: null, benchmark: null },
        ]),
      ),
    };
    return buildReportContext({
      snapshot,
      decision,
      approvalStatus: 'draft',
      reportVersion: nextVersion,
      readinessThreshold: 60,
      augmentation,
      commercialProfile: evidenceBundle.commercialProfile,
    });
  };

  const prepareLiteratureReview = async () => {
    const draft = buildDraft();
    if (!draft) return;
    const reportContext = buildContext(draft);
    if (!reportContext) return;
    setCheckingLiterature(true);
    setError('');
    const abortController = new AbortController();
    literatureAbort.current = abortController;
    try {
      const grounding = await fetchReportGrounding(reportContext, { signal: abortController.signal });
      setGroundingReview({ key: groundingReviewKey, grounding, warning: '' });
    } catch {
      if (abortController.signal.aborted) return;
      setGroundingReview({
        key: groundingReviewKey,
        grounding: null,
        warning: 'Approved external literature could not be retrieved. You can continue with project evidence only.',
      });
    } finally {
      setCheckingLiterature(false);
      literatureAbort.current = null;
    }
  };

  const generateCompleteReport = async () => {
    if (!confirmedGo || !selectedConcept || !evidenceBundle || !userId) return;
    if (!reviewedGrounding) {
      await prepareLiteratureReview();
      return;
    }
    const draft = buildDraft();
    if (!draft) return;
    const reportContext = buildContext(draft);
    if (!reportContext) return;

    setGenerating(true);
    setError('');
    setGenerationProgress(0);
    setGenerationStatus('Preparing the verified evidence packet…');
    const abortController = new AbortController();
    generationAbort.current = abortController;
    try {
      const groundingStatus = reviewedGrounding.grounding?.status ?? 'unavailable';
      const groundingWarnings = reviewedGrounding.grounding?.warnings.length
        ? reviewedGrounding.grounding.warnings
        : reviewedGrounding.warning ? [reviewedGrounding.warning] : [];
      const evidenceCards = reviewedGrounding.grounding?.evidenceCards ?? [];
      const literatureCitations = reviewedGrounding.grounding?.literatureCitations ?? [];

      const groundedDraft: CommercializationReportSnapshot = {
        ...draft,
        literatureCitations,
        evidenceCards,
      };
      const reportInput = {
        snapshot: groundedDraft,
        organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
        workspaceName: settings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
        reportFooter: settings?.reportFooter,
        version: nextVersion,
        status: 'draft' as const,
        logoUrl: resolveReportLogoUrl(
          settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
          settings?.logoUrl,
        ),
        primaryColor: settings?.primaryColor,
        accentColor: settings?.accentColor,
        reportTemplate: settings?.reportTemplate,
        reportContext,
      };
      const localReport = await runLocalLlamaReportWriter({
        context: reportContext,
        snapshot: groundedDraft,
        reportInput,
        modelId,
        evidenceCards,
        signal: abortController.signal,
        onProgress: progress => {
          setGenerationStatus(progress.message);
          setGenerationProgress(progress.progress);
        },
      });
      const formulation = formulationVersions.find(version => version.id === confirmedGo.formulationVersionId)
        ?? formulationVersions.find(version => version.sampleId === decision.sampleId && version.isCurrent)
        ?? null;
      const verifiedIngredients = formulation?.ingredients.filter(ingredient => ingredient.reviewStatus === 'verified') ?? [];
      const formulationGaps = formulation ? [
        formulation.reviewStatus !== 'reviewed' ? 'Formulation profile needs human review.' : null,
        formulation.ingredients.some(ingredient => ingredient.reviewStatus === 'suggested') ? 'Ingredient classifications remain unverified.' : null,
        verifiedIngredients.some(ingredient => !ingredient.supplier) ? 'One or more ingredient suppliers are not recorded.' : null,
        verifiedIngredients.some(ingredient => !ingredient.specification) ? 'One or more ingredient specifications are not recorded.' : null,
      ].filter((gap): gap is string => Boolean(gap)) : ['No formulation snapshot is linked.'];
      const reportSnapshot: CommercializationReportSnapshot = {
        ...localReport.snapshot,
        formulation: formulation ? {
          versionId: formulation.id,
          versionNumber: formulation.versionNumber,
          fingerprint: formulation.fingerprint,
          reviewStatus: formulation.reviewStatus,
          exactStatement: formulation.reviewStatus === 'reviewed' ? formulation.exactStatement : undefined,
          reviewedIngredients: verifiedIngredients.map(ingredient => ingredient.canonicalName),
          verifiedAllergens: [...new Set(verifiedIngredients.flatMap(ingredient => ingredient.allergenTags))],
          readinessGaps: formulationGaps,
        } : undefined,
        literatureCitations,
        evidenceCards,
        agentReview: {
          mode: 'full_release_review',
          runTimestamp: localReport.generatedAt,
          reportContextHash: localReport.reportContextHash,
          status: localReport.status,
          exportStatus: localReport.status,
          qualityScore: localReport.qc.qualityScore,
          agentsRun: ['professional_report_writer', 'deterministic_qc'],
          criticalBlockers: localReport.qc.criticalBlockers,
          warnings: [...localReport.qc.warnings, ...groundingWarnings],
          polishSuggestions: localReport.qc.polishSuggestions,
          evidenceAudit: localReport.evidenceAudit as unknown as Record<string, unknown>,
          modelUsage: [{ engine: 'webllm', model: localReport.model, location: 'browser', costUsd: 0 }],
          estimatedCostUsd: 0,
          usage: [{
            role: 'professional_report_writer',
            model: `local:${localReport.model}`,
            inputTokens: localReport.usage.promptTokens,
            outputTokens: localReport.usage.completionTokens,
          }],
          artifacts: {
            engine: 'local_llama_webgpu',
            model: localReport.model,
            executionLocation: 'browser',
            externalModelCostUsd: 0,
            repairPasses: localReport.repairs,
            draft: localReport.draft,
            evidenceAssist: {
              status: groundingStatus,
              acceptedCount: evidenceCards.length,
              sourceCount: literatureCitations.length,
              warnings: groundingWarnings,
            },
          },
        },
      };

      setGenerationStatus('NFI is finalizing and saving the complete report...');
      let evidenceBundleId: string | null = null;
      try {
        const savedBundle = await saveBundle.mutateAsync({
          projectId: evidenceBundle.projectId,
          canonicalProjectId: confirmedGo.projectId,
          decisionRecordId: confirmedGo.id,
          formulationVersionId: confirmedGo.formulationVersionId,
          schemaVersion: evidenceBundle.schemaVersion,
          sourceDataVersion: evidenceBundle.sourceDataVersion,
          payload: evidenceBundle as unknown as Record<string, unknown>,
        });
        evidenceBundleId = savedBundle.id;
      } catch {
        evidenceBundleId = null;
      }

      const report = await createReport.mutateAsync({
        decisionRecordId: confirmedGo.id,
        conceptTestId: selectedConcept.id,
        packagingImageId: reportSnapshot.concept.packagingImageId,
        title: (settings?.defaultReportTitle || '{sample} commercialization report')
          .replace(/\{sample\}/g, decision.sampleName),
        reportSnapshot: reportSnapshot as unknown as Record<string, unknown>,
        evidenceBundleId,
        formulationVersionId: confirmedGo.formulationVersionId ?? selectedConcept.formulationVersionId ?? null,
      });
      if (reportSnapshot.concept.packagingImageId) {
        await updateConceptImageReviewStatus([reportSnapshot.concept.packagingImageId], 'approved').catch(() => {});
      }
      setGenerationStatus('Complete. Opening the report...');
      setGenerationProgress(1);
      setOpen(false);
      onSaved?.(report.id);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setError('Local report generation was cancelled. No report was saved.');
      } else {
        const detail = reason instanceof Error && !/llama/i.test(reason.message) ? reason.message : '';
        setError(detail || 'The on-device writer could not create the report.');
      }
      setGenerationStatus('');
      setGenerationProgress(0);
    } finally {
      setGenerating(false);
      generationAbort.current = null;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!canOpen}
        title={canOpen ? 'Generate commercialization report' : 'Confirm this GO decision before building a report'}
        onClick={() => setOpen(true)}
      >
        <PackageCheck className="size-4" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={value => !generating && !checkingLiterature && setOpen(value)}>
        <DialogContent className="!w-[calc(100vw-2rem)] !max-w-5xl overflow-hidden p-0 sm:!max-w-5xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
            <DialogTitle className="text-xl text-slate-900">Write commercialization report</DialogTitle>
            <DialogDescription className="max-w-3xl">
              Choose the concept and packaging direction. The report is written on this device and checked against the approved evidence before it is saved.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[min(78vh,760px)] overflow-y-auto lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-5 border-b border-slate-200 bg-slate-50 p-6 lg:border-b-0 lg:border-r">
              <div>
                <Label>Concept study</Label>
                <Select value={effectiveConceptId} onValueChange={value => { setConceptId(value); setImageIndex(null); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select concept" /></SelectTrigger>
                  <SelectContent>
                    {governedConcepts.map(concept => <SelectItem key={concept.id} value={concept.id}>{concept.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {governedConcepts.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">A concept linked to this confirmed GO decision is required.</p>
                )}
                {decisionFreshness && !decisionFreshness.allowed && (
                  <p className="mt-2 text-xs text-rose-700">{decisionFreshness.reason}</p>
                )}
              </div>

              {selectedConcept && (
                <div>
                  <Label>Packaging direction</Label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {selectedConcept.imageUrls.map((url, index) => {
                      const meta = selectedConcept.imageMeta?.[index];
                      return (
                        <button
                          type="button"
                          key={`${url}-${index}`}
                          onClick={() => setImageIndex(index)}
                          className={`overflow-hidden rounded-md border-2 text-left ${index === imageIndex ? 'border-blue-600' : 'border-slate-200'}`}
                        >
                          <img
                            src={url}
                            alt={meta ? `${getConceptImageMode(meta.mode).label} option ${index + 1}` : `Packaging option ${index + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="aspect-square w-full object-cover"
                          />
                          <div className="truncate bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600">
                            {meta ? getConceptImageMode(meta.mode).label : `Option ${index + 1}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </aside>

            <section className="flex min-h-[460px] flex-col p-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-slate-200 p-4">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <p className="mt-3 text-xs text-slate-500">Decision</p>
                  <p className="mt-1 font-semibold text-slate-900">GO · ISSF {decision.issfScore.toFixed(1)}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-4">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <p className="mt-3 text-xs text-slate-500">Evidence</p>
                  <p className="mt-1 font-semibold text-slate-900">{evidenceQuery.isLoading ? 'Loading...' : evidenceBundle ? 'Ready' : 'Unavailable'}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-4">
                  <Cpu className="size-4 text-blue-600" />
                  <p className="mt-3 text-xs text-slate-500">Local writer</p>
                  <p className={`mt-1 font-semibold ${capability?.supported ? 'text-slate-900' : 'text-amber-700'}`}>
                    {capability === null ? 'Checking device…' : capability.supported ? 'WebGPU ready' : 'Unavailable'}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 p-4">
                  <BookOpenCheck className="size-4 text-blue-600" />
                  <p className="mt-3 text-xs text-slate-500">External literature</p>
                  <p className="mt-1 font-semibold text-slate-900">Approved sources checked</p>
                </div>
              </div>

              {generationStatus && (
                <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" aria-live="polite">
                  <div className="flex items-center justify-between gap-3">
                    <span>{generationStatus}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{Math.round(generationProgress * 100)}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full rounded-full bg-blue-600 transition-[width] duration-200" style={{ width: `${generationProgress * 100}%` }} />
                  </div>
                </div>
              )}
              {reviewedGrounding && !generating && (
                <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">External literature review</p>
                  {reviewedGrounding.grounding?.status === 'included' ? (
                    <>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        These approved sources will provide scientific or validation context only. They will not be treated as proof about this product.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {reviewedGrounding.grounding.literatureCitations.map((citation, index) => (
                          <li key={citation.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                            <button
                              type="button"
                              onClick={() => void openResearchSource({
                                sourcePath: citation.sourcePath ?? '',
                                title: citation.title,
                                excerpt: citation.excerpt,
                              }).catch(() => setError('This article is not available from its saved source. Try again, or re-index it in the Literature Library.'))}
                              className="inline-flex items-start gap-1.5 text-left text-sm font-medium text-blue-800 hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                            >
                              <span>[{citation.id}] {citation.title}</span><ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            </button>
                            <p className="mt-0.5 text-xs text-slate-500">{reviewedGrounding.grounding?.evidenceCards[index]?.topic}</p>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-1 text-xs leading-5 text-amber-700">
                      {reviewedGrounding.warning || 'No matching approved source was found. The report will use project evidence only.'}
                    </p>
                  )}
                </div>
              )}
              {error && <p role="alert" className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

              <div className="mt-auto pt-6">
                <div className="flex gap-2">
                  {(generating || checkingLiterature) && (
                    <Button type="button" variant="outline" className="h-11" onClick={() => {
                      generationAbort.current?.abort();
                      literatureAbort.current?.abort();
                    }}>
                      <X className="size-4" />Cancel
                    </Button>
                  )}
                  <Button className="h-11 flex-1" disabled={!canGenerate || generating || checkingLiterature} onClick={() => void generateCompleteReport()}>
                    <Sparkles className="size-4" />
                    {checkingLiterature ? 'Checking literature…' : generating ? 'Writing report…' : reviewedGrounding ? 'Write report' : 'Review literature'}
                  </Button>
                </div>
                {!canGenerate && !generating && !checkingLiterature && (
                  <p className="mt-2 text-center text-xs text-slate-500">
                    {capability && !capability.supported
                      ? capability.reason
                      : 'Select a concept and packaging direction, then wait for the evidence and device check.'}
                  </p>
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
