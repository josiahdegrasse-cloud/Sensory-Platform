import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileCheck2, FileText, PackageCheck, Sparkles } from 'lucide-react';
import type { GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import {
  buildCommercializationSnapshot,
  getEvidenceStrength,
  type CommercializationReportSnapshot,
  DEFAULT_REPORT_ORGANIZATION_NAME, DEFAULT_REPORT_WORKSPACE_NAME,
  resolveReportLogoUrl,
} from '../lib/commercialization-report';
import {
  useAdminConceptTests,
  useCommercializationReports,
  useConceptTestResponses,
  useCreateCommercializationReport,
  useDecisionRecords,
  useGenerateReportNarrative,
  useProjectEvidenceBundle,
  useSaveEvidenceBundle,
  useUpdateCommercializationReportStatus,
} from '../lib/hooks';
import { buildReportPlan } from '../lib/report-plan';
import { evaluateNarrative, type NarrativeEvaluation } from '../lib/report-evaluator';
import { updateConceptImageReviewStatus, type WorkspaceSettings } from '../lib/database';
import { downloadCommercializationReportPdf } from '../utils/commercialization-report-export';
import { getConceptImageMode } from '../../../supabase/functions/_shared/concept-image-catalog.ts';
import { preferredConceptImageIndex } from './concept-testing/smart-defaults';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

export function CommercializationReportBuilder({
  decision,
  foodType,
  userId,
  settings,
  initiallyOpen = false,
}: {
  decision: GoStopTweakDecision;
  foodType: string;
  userId?: string;
  settings?: WorkspaceSettings;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [conceptId, setConceptId] = useState('');
  const [imageIndex, setImageIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<CommercializationReportSnapshot | null>(null);
  const [savedReportId, setSavedReportId] = useState('');
  const [savedVersion, setSavedVersion] = useState(1);
  const [savedStatus, setSavedStatus] = useState('draft');
  const [error, setError] = useState('');
  const { data: decisions = [] } = useDecisionRecords();
  const { data: concepts = [] } = useAdminConceptTests();
  const responsesQuery = useConceptTestResponses(conceptId);
  const responses = useMemo(() => responsesQuery.data ?? [], [responsesQuery.data]);
  const { data: reports = [] } = useCommercializationReports();
  const createReport = useCreateCommercializationReport();
  const updateStatus = useUpdateCommercializationReportStatus();
  const saveBundle = useSaveEvidenceBundle();
  const generateNarrative = useGenerateReportNarrative();
  const [aiEval, setAiEval] = useState<NarrativeEvaluation | null>(null);
  const [aiError, setAiError] = useState('');
  // Deterministic evidence bundle for the GO sample — drives the data-evidence
  // panel and is persisted + linked to the report on save.
  const evidenceQuery = useProjectEvidenceBundle(decision.sampleId, userId, open);
  const evidenceBundle = evidenceQuery.data ?? null;
  const evidenceMismatch = !!evidenceBundle
    && evidenceBundle.deterministicCandidateDecision !== 'INSUFFICIENT_DATA'
    && evidenceBundle.deterministicCandidateDecision !== 'GO';

  // AI narrative (beta): evidence-constrained generation with one bounded revision
  // pass. The deterministic narrative remains the default/fallback.
  const generateAiNarrative = async () => {
    if (!evidenceBundle || !snapshot) return;
    setAiError('');
    setAiEval(null);
    const plan = buildReportPlan(evidenceBundle);
    const evidence = evidenceBundle.evidence.map(record => ({
      id: record.id, title: record.title, description: record.description,
    }));
    const request = {
      plan: {
        headline: plan.headline,
        candidateDecision: plan.candidateDecision,
        confidence: plan.confidence,
        sections: plan.sections.map(section => ({
          key: section.key,
          title: section.title,
          guidance: section.guidance,
          evidenceIds: section.evidenceIds,
          evidenceBacked: section.evidenceBacked,
          claimStatements: section.claims.map(claim => claim.statement),
        })),
      },
      evidence,
    };
    try {
      let result = await generateNarrative.mutateAsync(request);
      let evaluation = evaluateNarrative({ plan, sections: result.sections, bundle: evidenceBundle });
      // One bounded revision pass when the first draft fails the quality gate.
      if (!evaluation.passed && evaluation.issues.length > 0) {
        result = await generateNarrative.mutateAsync({ ...request, revisionIssues: evaluation.issues });
        evaluation = evaluateNarrative({ plan, sections: result.sections, bundle: evidenceBundle });
      }
      // Merge non-empty AI sections into the editable narrative.
      setSnapshot(current => {
        if (!current) return current;
        const narrative = { ...current.narrative };
        (Object.keys(narrative) as (keyof typeof narrative)[]).forEach(key => {
          const text = result.sections[key];
          if (typeof text === 'string' && text.trim()) narrative[key] = text.trim();
        });
        return { ...current, narrative };
      });
      setAiEval(evaluation);
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : 'AI narrative generation failed.');
    }
  };

  const confirmedGo = decisions.find(record =>
    record.sampleId === decision.sampleId
    && record.decision === 'GO'
    && record.decisionFingerprint === decision.decisionFingerprint
  );
  const matchingConcepts = useMemo(() => concepts.filter(concept =>
    concept.foodTypeSlug === foodType || concept.category.toLowerCase().includes(foodType.toLowerCase())
  ), [concepts, foodType]);
  const selectedConcept = matchingConcepts.find(concept => concept.id === conceptId);
  const selectedReport = reports.find(report => report.id === savedReportId);
  const reportVersions = reports.filter(report =>
    report.decisionRecordId === confirmedGo?.id && report.conceptTestId === conceptId
  );
  const canOpen = decision.decision === 'GO' && !!confirmedGo;

  useEffect(() => {
    if (conceptId || matchingConcepts.length === 0) return;
    setConceptId(matchingConcepts[0].id);
    setImageIndex(preferredConceptImageIndex(
      matchingConcepts[0].imageMeta,
      matchingConcepts[0].imageUrls.length,
    ));
  }, [conceptId, matchingConcepts]);

  useEffect(() => {
    if (initiallyOpen && canOpen) setOpen(true);
  }, [canOpen, initiallyOpen]);

  const buildDraft = useCallback(() => {
    if (!confirmedGo || !selectedConcept) return;
    const packagingImageUrl = selectedConcept.imageUrls[imageIndex] ?? '';
    const packagingImageId = selectedConcept.imageIds?.[imageIndex] ?? null;
    return buildCommercializationSnapshot({
      decisionRecord: confirmedGo,
      liveDecision: decision,
      concept: selectedConcept,
      responses,
      foodType,
      packagingImageId,
      packagingImageUrl,
      packagingImageMeta: selectedConcept.imageMeta?.[imageIndex] ?? null,
    });
  }, [confirmedGo, decision, foodType, imageIndex, responses, selectedConcept]);

  const generate = () => {
    const draft = buildDraft();
    if (!draft) return;
    setSnapshot(draft);
    setSavedReportId('');
    setSavedVersion(1);
    setSavedStatus('draft');
    setError('');
  };

  useEffect(() => {
    if (!open || snapshot || !responsesQuery.isSuccess || !selectedConcept || selectedConcept.imageUrls.length === 0) return;
    const draft = buildDraft();
    if (draft) setSnapshot(draft);
  }, [buildDraft, open, responsesQuery.isSuccess, selectedConcept, snapshot]);

  const updateNarrative = (key: keyof CommercializationReportSnapshot['narrative'], value: string) => {
    setSnapshot(current => current ? {
      ...current,
      narrative: { ...current.narrative, [key]: value },
    } : current);
  };

  const saveDraft = async () => {
    if (!snapshot || !confirmedGo || !selectedConcept || !userId) return;
    try {
      // Persist the deterministic evidence bundle (idempotent server-side) and
      // link it to the report. Non-fatal: a bundle failure must not block saving.
      let evidenceBundleId: string | null = null;
      if (evidenceBundle) {
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
      }
      const report = await createReport.mutateAsync({
        decisionRecordId: confirmedGo.id,
        conceptTestId: selectedConcept.id,
        packagingImageId: snapshot.concept.packagingImageId,
        title: (settings?.defaultReportTitle || '{sample} commercialization report')
          .replace(/\{sample\}/g, decision.sampleName),
        reportSnapshot: snapshot as unknown as Record<string, unknown>,
        evidenceBundleId,
      });
      setSavedReportId(report.id);
      setSavedVersion(report.version);
      setSavedStatus(report.status);
      if (snapshot.concept.packagingImageId) {
        // Using an image in a saved report promotes it to approved; the report
        // itself is already saved, so a status failure should not block here.
        await updateConceptImageReviewStatus([snapshot.concept.packagingImageId], 'approved').catch(() => {});
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the report.');
    }
  };

  const approve = async () => {
    if (!savedReportId || !userId) return;
    try {
      await updateStatus.mutateAsync({ id: savedReportId, status: 'approved', actorId: userId });
      setSavedStatus('approved');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to approve the report.');
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!canOpen}
        title={canOpen ? 'Build commercialization report' : 'Confirm this GO decision before building a report'}
        onClick={() => setOpen(true)}
      >
        <PackageCheck className="size-4" />
        Build launch report
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[min(94vh,920px)] !w-[calc(100vw-2rem)] !max-w-[1440px] sm:!max-w-[1440px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
            <DialogTitle className="text-xl text-slate-950">Commercialization report</DialogTitle>
            <DialogDescription className="max-w-3xl">
              Select the concept and packaging, review the evidence narrative, then save and export the client-ready report.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] lg:overflow-hidden">
            <aside className="space-y-5 border-b border-slate-200 bg-slate-50/70 p-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
              <div>
                <Label>Concept study</Label>
                <Select value={conceptId} onValueChange={value => { setConceptId(value); setImageIndex(0); setSnapshot(null); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select concept" /></SelectTrigger>
                  <SelectContent>
                    {matchingConcepts.map(concept => <SelectItem key={concept.id} value={concept.id}>{concept.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {matchingConcepts.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">Launch a matching {foodType} concept study before building this report.</p>
                )}
              </div>
              {selectedConcept && (
                <>
                  <div>
                    <Label>Packaging direction</Label>
                    <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-3">
                      {selectedConcept.imageUrls.map((url, index) => {
                        const meta = selectedConcept.imageMeta?.[index];
                        return (
                          <button
                            type="button"
                            key={`${url}-${index}`}
                            onClick={() => { setImageIndex(index); setSnapshot(null); }}
                            className={`overflow-hidden rounded-md border-2 text-left ${index === imageIndex ? 'border-blue-600' : 'border-slate-200'}`}
                          >
                            <div className="relative">
                              <img
                                src={url}
                                alt={meta ? `${getConceptImageMode(meta.mode).label} option ${index + 1}` : `Packaging option ${index + 1}`}
                                className="aspect-square w-full object-cover"
                              />
                              {meta?.reviewStatus === 'approved' && (
                                <span className="absolute top-1 right-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">APPROVED</span>
                              )}
                            </div>
                            {meta && (
                              <div className="truncate bg-white px-1.5 py-1 text-[10px] font-medium text-slate-500">
                                {getConceptImageMode(meta.mode).label} · AI draft
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <strong className="text-slate-900">{responses.length}</strong> concept response{responses.length === 1 ? '' : 's'} will be included.
                  </div>
                  {reportVersions.length > 0 && (
                    <div>
                      <Label>Saved versions</Label>
                      <div className="mt-2 space-y-1">
                        {reportVersions.map(report => (
                          <button
                            type="button"
                            key={report.id}
                            onClick={() => {
                              const stored = report.reportSnapshot as unknown as CommercializationReportSnapshot;
                              const currentImageIndex = selectedConcept.imageIds?.findIndex(id => id === stored.concept.packagingImageId) ?? -1;
                              setSnapshot({
                                ...stored,
                                concept: {
                                  ...stored.concept,
                                  packagingImageUrl: currentImageIndex >= 0
                                    ? selectedConcept.imageUrls[currentImageIndex] ?? stored.concept.packagingImageUrl
                                    : stored.concept.packagingImageUrl,
                                },
                              });
                              setSavedReportId(report.id);
                              setSavedVersion(report.version);
                              setSavedStatus(report.status);
                            }}
                            className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-xs hover:bg-slate-50"
                          >
                            <span className="font-semibold text-slate-800">Version {report.version}</span>
                            <span className="capitalize text-slate-500">{report.status}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <Button onClick={generate} disabled={!selectedConcept || selectedConcept.imageUrls.length === 0} className="h-10 w-full">
                <Sparkles className="size-4" />Generate evidence draft
              </Button>
            </aside>

            <section className="min-h-0 space-y-5 p-6 lg:overflow-y-auto">
              {!snapshot ? (
                <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 text-center">
                  <div className="max-w-sm">
                    <FileText className="mx-auto size-8 text-slate-400" />
                    <p className="mt-3 font-semibold text-slate-900">Select the approved packaging</p>
                    <p className="mt-1 text-sm text-slate-500">The report will combine the confirmed GO evidence with the linked concept panel results.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                    {[
                      ['Decision', snapshot.decision.outcome],
                      ['ISSF score', snapshot.decision.issfScore.toFixed(1)],
                      ['Concept panel', String(snapshot.evidence.responseCount)],
                      ['Evidence strength', getEvidenceStrength(snapshot.evidence.responseCount)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-slate-200 bg-white p-4">
                        <div className="text-xs text-slate-500">{label}</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                  {evidenceBundle && (
                    <div className={`rounded-md border p-4 ${evidenceMismatch ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data evidence</span>
                        <span className="text-sm text-slate-700">
                          Deterministic candidate: <strong className="text-slate-900">{evidenceBundle.deterministicCandidateDecision}</strong>
                        </span>
                        <span className="text-sm text-slate-700">
                          Confidence: <strong className="capitalize text-slate-900">{evidenceBundle.deterministicConfidence}</strong>
                        </span>
                        <span className="text-xs text-slate-500">
                          {evidenceBundle.evidence.length} evidence records · {evidenceBundle.missingData.length} missing · {evidenceBundle.qualityWarnings.length} warnings
                        </span>
                      </div>
                      {evidenceMismatch && (
                        <p className="mt-2 text-xs leading-5 text-amber-800">
                          The deterministic engine reads this data as <strong>{evidenceBundle.deterministicCandidateDecision}</strong>, not GO.
                          Confirm the human GO decision still holds before publishing client-facing claims.
                        </p>
                      )}
                      {evidenceBundle.qualityWarnings.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                          {evidenceBundle.qualityWarnings.slice(0, 3).map(warning => (
                            <li key={warning.id}>• {warning.title}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!evidenceBundle || generateNarrative.isPending}
                      onClick={generateAiNarrative}
                      title={evidenceBundle ? 'Draft the narrative from the evidence bundle with AI' : 'No evidence bundle available for this sample'}
                    >
                      <Sparkles className="size-4" />
                      {generateNarrative.isPending ? 'Drafting…' : 'Draft with AI (beta)'}
                    </Button>
                    <span className="text-xs text-slate-500">
                      AI writes each section using only the cited evidence. Review before saving.
                    </span>
                    {aiEval && (
                      <span className={`text-xs font-semibold ${aiEval.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                        Quality {aiEval.score}/100 · {aiEval.passed ? 'passed' : 'needs review'}
                      </span>
                    )}
                  </div>
                  {aiError && <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{aiError}</p>}
                  {aiEval && aiEval.issues.length > 0 && (
                    <ul className="space-y-0.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      {aiEval.issues.slice(0, 5).map((issue, index) => <li key={index}>• {issue}</li>)}
                    </ul>
                  )}
                  <div className="grid gap-4 xl:grid-cols-2">
                    {([
                      ['executiveSummary', 'Executive recommendation', 'xl:col-span-2 min-h-28'],
                      ['whyLiked', 'Why panelists liked it', 'min-h-32'],
                      ['packagingRationale', 'Packaging rationale', 'min-h-32'],
                      ['launchRecommendation', 'Launch recommendation', 'min-h-32'],
                      ['claimCaution', 'Claims and limitations', 'min-h-32'],
                    ] as const).map(([key, label, heightClass]) => (
                      <div key={key}>
                        <Label>{label}</Label>
                        <Textarea
                          className={`mt-1 resize-y leading-6 ${heightClass}`}
                          value={snapshot.narrative[key]}
                          onChange={event => updateNarrative(key, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  {error && <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
                  <div className="sticky bottom-0 -mx-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
                    <Button variant="outline" onClick={saveDraft} disabled={createReport.isPending}>
                      <FileCheck2 className="size-4" />{createReport.isPending ? 'Saving...' : 'Save new version'}
                    </Button>
                    <Button variant="outline" onClick={approve} disabled={!savedReportId || savedStatus === 'approved'}>
                      <CheckCircle2 className="size-4" />Approve report
                    </Button>
                    <Button
                      disabled={!savedReportId}
                      onClick={() => downloadCommercializationReportPdf({
                        snapshot,
                        organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
                        workspaceName: settings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
                        reportFooter: settings?.reportFooter,
                        version: selectedReport?.version ?? savedVersion,
                        status: selectedReport?.status ?? savedStatus,
                        logoUrl: resolveReportLogoUrl(
                          settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
                          settings?.logoUrl,
                        ),
                        primaryColor: settings?.primaryColor,
                        accentColor: settings?.accentColor,
                        reportTemplate: settings?.reportTemplate,
                      })}
                    >
                      <FileText className="size-4" />Download branded PDF
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
