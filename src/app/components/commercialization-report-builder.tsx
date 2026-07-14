import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, PackageCheck, ShieldCheck, Sparkles } from 'lucide-react';
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
  useDecisionRecords,
  useProjectEvidenceBundle,
  useSaveEvidenceBundle,
} from '../lib/hooks';
import { updateConceptImageReviewStatus, type WorkspaceSettings } from '../lib/database';
import { buildReportContext, type SensoryAugmentation } from '../lib/report-qc';
import {
  createMeteredReportAgentRunner,
  estimateReportAgentCost,
  hasGeneratedReportDraft,
  runCommercializationReportOrchestrator,
} from '../lib/report-agents';
import { getConceptImageMode } from '../../../supabase/functions/_shared/concept-image-catalog.ts';
import { preferredConceptImageIndex } from './concept-testing/smart-defaults';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function CommercializationReportBuilder({
  decision,
  foodType,
  userId,
  settings,
  initiallyOpen = false,
  triggerLabel = 'Build report',
  onSaved,
}: {
  decision: GoStopTweakDecision;
  foodType: string;
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
  const [error, setError] = useState('');

  const { data: decisions = [] } = useDecisionRecords();
  const { data: concepts = [] } = useAdminConceptTests();
  const { data: reports = [] } = useCommercializationReports();
  const matchingConcepts = useMemo(() => concepts.filter(concept =>
    concept.foodTypeSlug === foodType || concept.category.toLowerCase().includes(foodType.toLowerCase()),
  ), [concepts, foodType]);
  const effectiveConceptId = conceptId || matchingConcepts[0]?.id || '';
  const selectedConcept = matchingConcepts.find(concept => concept.id === effectiveConceptId);
  const responsesQuery = useConceptTestResponses(effectiveConceptId);
  const responses = useMemo(() => responsesQuery.data ?? [], [responsesQuery.data]);
  const evidenceQuery = useProjectEvidenceBundle(decision.sampleId, userId, open);
  const evidenceBundle = evidenceQuery.data ?? null;
  const createReport = useCreateCommercializationReport();
  const saveBundle = useSaveEvidenceBundle();

  const confirmedGo = decisions.find(record =>
    record.sampleId === decision.sampleId
    && record.decision === 'GO'
    && record.decisionFingerprint === decision.decisionFingerprint,
  );
  const imageIndex = imageIndexOverride
    ?? (selectedConcept ? preferredConceptImageIndex(selectedConcept.imageMeta, selectedConcept.imageUrls.length) : 0);
  const canOpen = decision.decision === 'GO' && Boolean(confirmedGo);
  const canGenerate = Boolean(
    confirmedGo
    && selectedConcept
    && selectedConcept.imageUrls.length > 0
    && responsesQuery.isSuccess
    && evidenceBundle
    && userId,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot open after async decision eligibility resolves
    if (initiallyOpen && canOpen) setOpen(true);
  }, [canOpen, initiallyOpen]);

  const nextVersion = selectedConcept && confirmedGo
    ? Math.max(0, ...reports
        .filter(report => report.decisionRecordId === confirmedGo.id && report.conceptTestId === selectedConcept.id)
        .map(report => report.version)) + 1
    : 1;

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

  const generateCompleteReport = async () => {
    if (!confirmedGo || !selectedConcept || !evidenceBundle || !userId) return;
    const draft = buildDraft();
    if (!draft) return;
    const reportContext = buildContext(draft);
    if (!reportContext) return;

    setGenerating(true);
    setError('');
    setGenerationStatus('NFI is bringing together the product, sensory, instrumental, concept, and scientific evidence for your complete report...');
    const metered = createMeteredReportAgentRunner();
    try {
      const orchestrated = await runCommercializationReportOrchestrator({
        mode: 'full_release_review',
        reportInput: {
          snapshot: draft,
          organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
          workspaceName: settings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
          reportFooter: settings?.reportFooter,
          version: nextVersion,
          status: 'draft',
          logoUrl: resolveReportLogoUrl(
            settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
            settings?.logoUrl,
          ),
          primaryColor: settings?.primaryColor,
          accentColor: settings?.accentColor,
          reportTemplate: settings?.reportTemplate,
          reportContext,
        },
        runner: metered.runner,
      });
      if (!hasGeneratedReportDraft(orchestrated)) {
        throw new Error(orchestrated.qc.criticalBlockers[0] ?? 'The agent workflow stopped before the document could be drafted.');
      }
      const estimatedCostUsd = estimateReportAgentCost(metered.usage);
      const reportSnapshot: CommercializationReportSnapshot = {
        ...orchestrated.snapshot,
        literatureCitations: orchestrated.literatureCitations,
        evidenceCards: orchestrated.evidenceCards,
        agentReview: {
          mode: 'full_release_review',
          runTimestamp: orchestrated.generatedAt,
          reportContextHash: orchestrated.reportContextHash,
          status: orchestrated.status,
          exportStatus: orchestrated.status,
          qualityScore: orchestrated.qc.qualityScore,
          agentsRun: orchestrated.metadata.agentsRun,
          criticalBlockers: orchestrated.qc.criticalBlockers,
          warnings: orchestrated.qc.warnings,
          polishSuggestions: orchestrated.qc.polishSuggestions,
          evidenceAudit: orchestrated.evidenceAudit as unknown as Record<string, unknown>,
          modelUsage: metered.usage,
          estimatedCostUsd,
          usage: metered.usage.map(item => ({
            role: item.role,
            model: item.model,
            inputTokens: item.inputTokens,
            outputTokens: item.outputTokens,
          })),
          artifacts: orchestrated as unknown as Record<string, unknown>,
        },
      };

      setGenerationStatus('NFI is finalizing and saving the complete report...');
      let evidenceBundleId: string | null = null;
      try {
        const savedBundle = await saveBundle.mutateAsync({
          projectId: evidenceBundle.projectId,
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
      });
      if (reportSnapshot.concept.packagingImageId) {
        await updateConceptImageReviewStatus([reportSnapshot.concept.packagingImageId], 'approved').catch(() => {});
      }
      setGenerationStatus('Complete. Opening the report...');
      setOpen(false);
      onSaved?.(report.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The report workflow could not create the document.');
      setGenerationStatus('');
    } finally {
      setGenerating(false);
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
      <Dialog open={open} onOpenChange={value => !generating && setOpen(value)}>
        <DialogContent className="!w-[calc(100vw-2rem)] !max-w-5xl overflow-hidden p-0 sm:!max-w-5xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
            <DialogTitle className="text-xl text-slate-900">Generate complete report</DialogTitle>
            <DialogDescription className="max-w-3xl">
              Choose the concept and packaging direction. NFI will bring together the available evidence, draft and review the report, run quality checks, and save the complete document.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[min(78vh,760px)] overflow-y-auto lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-5 border-b border-slate-200 bg-slate-50 p-6 lg:border-b-0 lg:border-r">
              <div>
                <Label>Concept study</Label>
                <Select value={effectiveConceptId} onValueChange={value => { setConceptId(value); setImageIndex(null); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select concept" /></SelectTrigger>
                  <SelectContent>
                    {matchingConcepts.map(concept => <SelectItem key={concept.id} value={concept.id}>{concept.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {matchingConcepts.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">A matching {foodType} concept is required.</p>
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
              <div className="grid gap-3 sm:grid-cols-3">
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
                  <Bot className="size-4 text-blue-600" />
                  <p className="mt-3 text-xs text-slate-500">Concept responses</p>
                  <p className="mt-1 font-semibold text-slate-900">{responses.length}</p>
                </div>
              </div>

              <div className="mt-6 border-y border-slate-200 py-5">
                <h3 className="font-semibold text-slate-900">Complete agent workflow</h3>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p>Evidence and calculation audit</p>
                  <p>Sensory and instrumental review</p>
                  <p>Consumer and claims review</p>
                  <p>Professional writing and RAG citations</p>
                  <p>Editorial and visual quality review</p>
                  <p>Deterministic release QC</p>
                </div>
              </div>

              {generationStatus && (
                <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  {generationStatus}
                </div>
              )}
              {error && <p role="alert" className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

              <div className="mt-auto pt-6">
                <Button className="h-11 w-full" disabled={!canGenerate || generating} onClick={() => void generateCompleteReport()}>
                  <Sparkles className="size-4" />
                  {generating ? 'Generating complete report...' : 'Generate complete report'}
                </Button>
                {!canGenerate && !generating && (
                  <p className="mt-2 text-center text-xs text-slate-500">
                    Select a concept and packaging direction and wait for the current evidence to load.
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
