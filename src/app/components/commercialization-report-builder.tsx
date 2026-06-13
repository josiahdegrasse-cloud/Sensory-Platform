import { useEffect, useMemo, useState } from 'react';
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
  useUpdateCommercializationReportStatus,
} from '../lib/hooks';
import { updateConceptImageReviewStatus, type WorkspaceSettings } from '../lib/database';
import { downloadCommercializationReportPdf } from '../utils/commercialization-report-export';
import { getConceptImageMode } from '../../../supabase/functions/_shared/concept-image-catalog.ts';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

export function CommercializationReportBuilder({
  decision,
  foodType,
  userId,
  settings,
}: {
  decision: GoStopTweakDecision;
  foodType: string;
  userId?: string;
  settings?: WorkspaceSettings;
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
  const { data: responses = [] } = useConceptTestResponses(conceptId);
  const { data: reports = [] } = useCommercializationReports();
  const createReport = useCreateCommercializationReport();
  const updateStatus = useUpdateCommercializationReportStatus();

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
    if (!conceptId && matchingConcepts.length > 0) setConceptId(matchingConcepts[0].id);
  }, [conceptId, matchingConcepts]);

  const generate = () => {
    if (!confirmedGo || !selectedConcept) return;
    const packagingImageUrl = selectedConcept.imageUrls[imageIndex] ?? '';
    const packagingImageId = selectedConcept.imageIds?.[imageIndex] ?? null;
    setSnapshot(buildCommercializationSnapshot({
      decisionRecord: confirmedGo,
      liveDecision: decision,
      concept: selectedConcept,
      responses,
      foodType,
      packagingImageId,
      packagingImageUrl,
      packagingImageMeta: selectedConcept.imageMeta?.[imageIndex] ?? null,
    }));
    setSavedReportId('');
    setSavedVersion(1);
    setSavedStatus('draft');
    setError('');
  };

  const updateNarrative = (key: keyof CommercializationReportSnapshot['narrative'], value: string) => {
    setSnapshot(current => current ? {
      ...current,
      narrative: { ...current.narrative, [key]: value },
    } : current);
  };

  const saveDraft = async () => {
    if (!snapshot || !confirmedGo || !selectedConcept || !userId) return;
    try {
      const report = await createReport.mutateAsync({
        decisionRecordId: confirmedGo.id,
        conceptTestId: selectedConcept.id,
        packagingImageId: snapshot.concept.packagingImageId,
        title: (settings?.defaultReportTitle || '{sample} commercialization report')
          .replace(/\{sample\}/g, decision.sampleName),
        reportSnapshot: snapshot as unknown as Record<string, unknown>,
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
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Commercialization report</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
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
                    <div className="mt-2 grid grid-cols-2 gap-2">
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
              <Button onClick={generate} disabled={!selectedConcept || selectedConcept.imageUrls.length === 0} className="w-full">
                <Sparkles className="size-4" />Generate evidence draft
              </Button>
            </div>

            <div className="space-y-4">
              {!snapshot ? (
                <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center">
                  <div className="max-w-sm">
                    <FileText className="mx-auto size-8 text-slate-400" />
                    <p className="mt-3 font-semibold text-slate-900">Select the approved packaging</p>
                    <p className="mt-1 text-sm text-slate-500">The report will combine the confirmed GO evidence with the linked concept panel results.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ['Decision', snapshot.decision.outcome],
                      ['ISSF score', snapshot.decision.issfScore.toFixed(1)],
                      ['Concept panel', String(snapshot.evidence.responseCount)],
                      ['Evidence strength', getEvidenceStrength(snapshot.evidence.responseCount)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">{label}</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                  {([
                    ['executiveSummary', 'Executive recommendation'],
                    ['whyLiked', 'Why panelists liked it'],
                    ['packagingRationale', 'Packaging rationale'],
                    ['launchRecommendation', 'Launch recommendation'],
                    ['claimCaution', 'Claims and limitations'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <Textarea className="mt-1 min-h-20" value={snapshot.narrative[key]} onChange={event => updateNarrative(key, event.target.value)} />
                    </div>
                  ))}
                  {error && <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
