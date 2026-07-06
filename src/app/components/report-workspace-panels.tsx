import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FilePlus2, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ProjectStatusBadge } from './project-status-badge';
import { useCreateCommercializationReport } from '../lib/hooks';
import {
  buildCommercializationReportPdf,
  downloadCommercializationReportPdf,
  type CommercializationReportPdfInput,
} from '../utils/commercialization-report-export';
import { canMutateReportVersion } from '../lib/report-context-builder';
import type { CommercializationReportRecord } from '../lib/database';
import type { CommercializationReportSnapshot } from '../lib/commercialization-report';

const narrativeFields = [
  ['executiveSummary', 'Executive recommendation'],
  ['whyLiked', 'Why panelists liked it'],
  ['packagingRationale', 'Packaging rationale'],
  ['launchRecommendation', 'Launch recommendation'],
  ['claimCaution', 'Claims and limitations'],
] as const;

export function ReportNarrativePanel({
  report,
  snapshot,
}: {
  report: CommercializationReportRecord;
  snapshot: CommercializationReportSnapshot;
}) {
  const createReport = useCreateCommercializationReport();
  const [draft, setDraft] = useState(snapshot.narrative);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const canMutate = canMutateReportVersion(report);

  const changed = useMemo(
    () => narrativeFields.some(([key]) => draft[key] !== snapshot.narrative[key]),
    [draft, snapshot],
  );

  const saveVersion = async () => {
    setError('');
    if (!canMutate) {
      setError('Approved report versions are locked. Reopen the report before making narrative changes.');
      return;
    }
    try {
      await createReport.mutateAsync({
        decisionRecordId: report.decisionRecordId,
        conceptTestId: report.conceptTestId,
        packagingImageId: report.packagingImageId,
        title: report.title,
        reportSnapshot: {
          ...snapshot,
          narrative: draft,
          generatedAt: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
      });
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the new report version.');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-semibold text-slate-900">Narrative editor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Changes create a new draft version. Approved versions remain unchanged for traceability.
          </p>
        </div>
        <ProjectStatusBadge label={`Editing from v${report.version}`} tone="info" showIcon={false} />
      </div>
      <div className="mt-5 space-y-4">
        {narrativeFields.map(([key, label]) => (
          <div key={key}>
            <Label htmlFor={`report-${key}`} className="text-sm">{label}</Label>
            <Textarea
              id={`report-${key}`}
              value={draft[key]}
              onChange={event => {
                setSaved(false);
                setDraft(current => ({ ...current, [key]: event.target.value }));
              }}
              readOnly={!canMutate}
              className="mt-1 min-h-24 bg-white"
            />
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      {saved && (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" />New draft version saved.
        </p>
      )}
      <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
        <Button disabled={!canMutate || !changed || createReport.isPending} onClick={saveVersion}>
          <FilePlus2 className="size-4" />{!canMutate ? 'Approved version locked' : createReport.isPending ? 'Saving version…' : 'Save new version'}
        </Button>
      </div>
    </div>
  );
}

export function ReportPdfPreviewPanel({ input }: { input: CommercializationReportPdfInput }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fittedPreviewUrl = previewUrl
    ? `${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`
    : '';

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    buildCommercializationReportPdf(input)
      .then(({ doc }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(doc.output('blob'));
        setPreviewUrl(objectUrl);
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to generate the PDF preview.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [input]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-900">PDF preview</h2>
          <p className="text-xs text-slate-500">Fit-to-page preview generated from this saved version and workspace branding.</p>
        </div>
        <Button variant="outline" onClick={() => downloadCommercializationReportPdf(input)}>
          <Download className="size-4" />Download PDF
        </Button>
      </div>
      {loading ? (
        <div className="flex min-h-[640px] items-center justify-center text-sm text-slate-500">Generating preview…</div>
      ) : error ? (
        <div className="flex min-h-80 items-center justify-center p-6 text-sm text-rose-700">{error}</div>
      ) : (
        <iframe
          title="Commercialization report PDF preview"
          src={fittedPreviewUrl}
          className="h-[calc(100vh-15rem)] min-h-[620px] w-full bg-slate-50"
        />
      )}
    </div>
  );
}

export function ReportVersionsPanel({
  reports,
  selectedId,
}: {
  reports: CommercializationReportRecord[];
  selectedId: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Version history</h2>
        <p className="text-sm text-slate-500">Each saved narrative revision remains available as an immutable snapshot.</p>
      </div>
      {reports.map(report => (
        <a
          key={report.id}
          href={`/report?report=${report.id}`}
          className={`flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0 hover:bg-slate-50 ${selectedId === report.id ? 'bg-slate-50' : ''}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Version {report.version}</p>
              <p className="text-xs text-slate-500">{new Date(report.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <ProjectStatusBadge
            label={report.status === 'review' ? 'Ready for review' : report.status}
            tone={report.status === 'approved' ? 'success' : report.status === 'review' ? 'warning' : report.status === 'archived' ? 'neutral' : 'info'}
            showIcon={false}
          />
        </a>
      ))}
    </div>
  );
}
