import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { workflowStagePath } from '../lib/project-journey-routes';
import {
  AlertTriangle, Archive, Download, FileText, FolderOpen, Search,
  ShieldCheck, Sparkles, Undo2,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { ProjectStatusBadge } from './project-status-badge';
import { useAuth } from '../contexts/auth-context';
import { useFoodType } from '../contexts/food-type-context';
import {
  useAdminConceptTests, useCommercializationReports, useDecisionRecords,
  useUpdateCommercializationReportStatus,
} from '../lib/hooks';
import {
  buildReportLibrary,
  filterReportLibrary,
  type ReportLibraryEntry,
  type ReportReleaseStatus,
} from '../lib/report-library';
import {
  buildSavedReportExportContext,
  downloadSavedReportPdf,
  type ReportReadiness,
} from '../lib/report-context-builder';
import type { CommercializationReportRecord } from '../lib/database';
import type { SemanticTone } from '../lib/project-status';
import { WorkflowPageHeader } from './workflow-page-header';

const STATUS_OPTIONS = ['all', 'draft', 'review', 'approved', 'archived'] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];
const RELEASE_OPTIONS = ['all', 'client_ready', 'internal_draft', 'demonstration_only', 'blocked'] as const;
type ReleaseFilter = typeof RELEASE_OPTIONS[number];

const statusTone: Record<CommercializationReportRecord['status'], SemanticTone> = {
  draft: 'info',
  review: 'warning',
  approved: 'success',
  archived: 'neutral',
};

const statusLabel: Record<CommercializationReportRecord['status'], string> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  archived: 'Archived',
};

type VaultStatus = ReportReleaseStatus | 'checking';

const releaseCopy: Record<VaultStatus, { label: string; className: string; detail: string }> = {
  checking: {
    label: 'Checking',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    detail: 'Readiness context is being rebuilt.',
  },
  client_ready: {
    label: 'Client-ready',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    detail: 'Approved and eligible for external delivery.',
  },
  internal_draft: {
    label: 'Internal draft',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    detail: 'Exportable internally; approval is still pending.',
  },
  demonstration_only: {
    label: 'Demonstration only',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
    detail: 'Reference/demo evidence prevents external approval.',
  },
  blocked: {
    label: 'Blocked',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    detail: 'Resolve evidence or context blockers before export.',
  },
};

function displayReleaseStatus(entry: ReportLibraryEntry, loading: boolean): VaultStatus {
  return loading ? 'checking' : entry.releaseStatus;
}

function ReadinessBadges({
  entry,
  loading,
}: {
  entry: ReportLibraryEntry;
  loading: boolean;
}) {
  const isReferenceEvidence = Object.values(entry.evidenceProvenance).some(value => value === 'reference');
  const missingConceptEvidence = entry.evidenceProvenance.concept === 'none';
  const releaseStatus = displayReleaseStatus(entry, loading);
  const release = releaseCopy[releaseStatus];
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Badge variant="outline" className={release.className} title={release.detail}>
        {release.label}
      </Badge>
      {isReferenceEvidence && (
        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
          Demo/reference evidence
        </Badge>
      )}
      {missingConceptEvidence && (
        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
          Missing concept evidence
        </Badge>
      )}
      <Badge
        variant="outline"
        className={entry.latest.status === 'approved'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : entry.latest.status === 'review'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'}
      >
        {statusLabel[entry.latest.status]}
      </Badge>
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const { setSelection } = useFoodType();
  const { data: reports = [], isLoading } = useCommercializationReports();
  const { data: decisions = [] } = useDecisionRecords();
  const { data: concepts = [] } = useAdminConceptTests();
  const updateStatus = useUpdateCommercializationReportStatus();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [release, setRelease] = useState<ReleaseFilter>('all');
  const [exportingId, setExportingId] = useState('');
  const [readinessLoading, setReadinessLoading] = useState<Record<string, boolean>>({});
  const [readinessByReportId, setReadinessByReportId] = useState<Record<string, ReportReadiness>>({});
  const [error, setError] = useState('');

  const baseEntries = useMemo(
    () => buildReportLibrary(reports, decisions, concepts),
    [reports, decisions, concepts],
  );
  const reportIdsToCheck = useMemo(
    () => baseEntries.map(entry => entry.latest.id).join('|'),
    [baseEntries],
  );

  useEffect(() => {
    let active = true;
    const ids = baseEntries
      .map(entry => entry.latest.id)
      .filter(id => !readinessByReportId[id] && !readinessLoading[id]);

    ids.forEach(id => {
      setReadinessLoading(current => ({ ...current, [id]: true }));
      buildSavedReportExportContext(id)
        .then(result => {
          if (!active) return;
          setReadinessByReportId(current => ({ ...current, [id]: result.readiness }));
        })
        .catch(() => {
          if (!active) return;
          setReadinessByReportId(current => ({
            ...current,
            [id]: {
              exportReady: false,
              approvalReady: false,
              blockers: ['Saved report context needs review before export.'],
              warnings: [],
              evidenceProvenance: { sensory: 'none', instrumental: 'none', concept: 'none', purchaseIntent: 'none' },
              evidenceBundleStatus: 'missing',
              sensoryStatus: 'Needs review',
              instrumentalStatus: 'Needs review',
              conceptStatus: 'Needs review',
              purchaseIntentStatus: 'Needs review',
              approvalBlockers: ['Saved report context needs review before approval.'],
              exportBlockers: ['Saved report context needs review before export.'],
              qcWarnings: [],
              agentStatus: 'not_run',
            },
          }));
        })
        .finally(() => {
          if (active) setReadinessLoading(current => ({ ...current, [id]: false }));
        });
    });

    return () => { active = false; };
  }, [baseEntries, readinessByReportId, readinessLoading, reportIdsToCheck]);

  const entries = useMemo(
    () => buildReportLibrary(reports, decisions, concepts, readinessByReportId),
    [reports, decisions, concepts, readinessByReportId],
  );
  const visibleEntries = useMemo(
    () => filterReportLibrary(entries, search, status)
      .filter(entry => release === 'all' || entry.releaseStatus === release),
    [entries, release, search, status],
  );
  const changeStatus = (
    report: CommercializationReportRecord,
    nextStatus: CommercializationReportRecord['status'],
  ) => {
    if (!user) return;
    setError('');
    updateStatus.mutate(
      { id: report.id, status: nextStatus, actorId: user.id },
      { onError: reason => setError(reason instanceof Error ? reason.message : 'Unable to update the report.') },
    );
  };

  const download = async (entry: ReportLibraryEntry) => {
    setExportingId(entry.latest.id);
    setError('');
    try {
      const result = await downloadSavedReportPdf(entry.latest.id);
      setReadinessByReportId(current => ({ ...current, [entry.latest.id]: result.readiness }));
      if (!result.ok) {
        setError('This report needs review before PDF export. Open the report workspace to rebuild context and resolve blockers.');
      }
    } catch {
      setError('This report needs review before PDF export. Open the report workspace to rebuild context and resolve blockers.');
    } finally {
      setExportingId('');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <WorkflowPageHeader
        title="Reports"
        description="Open a deliverable, complete its release review, and export the approved client PDF."
        actions={<Button asChild><Link to={workflowStagePath('report', routeProjectId, '?create=1')}><Sparkles className="size-4" />New report</Link></Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-500" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search product, concept, or report title"
            className="bg-white pl-9"
          />
        </div>
        <Select value={status} onValueChange={value => setStatus(value as StatusFilter)}>
          <SelectTrigger aria-label="Filter by report status" className="bg-white lg:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(option => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'Active reports' : option === 'review' ? 'Ready for review' : option[0].toUpperCase() + option.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={release} onValueChange={value => setRelease(value as ReleaseFilter)}>
          <SelectTrigger aria-label="Filter by release readiness" className="bg-white lg:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RELEASE_OPTIONS.map(option => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'All readiness states' : releaseCopy[option].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(item => <div key={item} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white" />)}
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <FolderOpen className="mx-auto size-9 text-slate-500" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">No reports match this view</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Saved versions appear here after a confirmed GO decision is paired with a concept and packaging direction.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {visibleEntries.map((entry, index) => (
            <article key={entry.key} className={`p-4 sm:p-5 ${index > 0 ? 'border-t border-slate-200' : ''}`}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="size-4 text-slate-500" />
                    <h2 className="min-w-0 max-w-full break-words font-semibold text-slate-900 sm:truncate">{entry.displayTitle}</h2>
                    <ProjectStatusBadge
                      label={entry.latest.status === 'review' ? 'Ready for review' : entry.latest.status}
                      tone={statusTone[entry.latest.status]}
                      showIcon={false}
                    />
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {entry.productName} · {entry.foodType} · {entry.conceptName}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Version {entry.latest.version} of {entry.versions.length} · Updated {new Date(entry.latest.updatedAt).toLocaleDateString()} · {entry.decision} decision
                    {entry.templateTitle ? ` · Template: ${entry.templateTitle}` : ''}
                  </p>
                  <ReadinessBadges entry={entry} loading={Boolean(readinessLoading[entry.latest.id])} />
                  {entry.blockers.length > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="size-3.5" />
                      {entry.blockers[0]}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                  <Button size="sm" asChild>
                    <Link
                      to={workflowStagePath('report', routeProjectId, `?report=${entry.latest.id}`)}
                      onClick={() => setSelection(entry.foodType, null)}
                    >
                      <FolderOpen className="size-4" />
                      {entry.latest.status === 'review'
                        ? 'Review report'
                        : entry.releaseStatus === 'blocked' || entry.releaseStatus === 'demonstration_only'
                          ? 'Resolve blockers'
                          : 'Open report'}
                    </Link>
                  </Button>
                  {entry.exportReady ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={exportingId === entry.latest.id}
                      onClick={() => download(entry)}
                    >
                      <Download className="size-4" />{exportingId === entry.latest.id ? 'Preparing…' : 'Download PDF'}
                    </Button>
                  ) : null}
                  {entry.latest.status === 'approved' && (
                    <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => changeStatus(entry.latest, 'draft')}>
                      <Undo2 className="size-4" />Reopen
                    </Button>
                  )}
                  {entry.latest.status !== 'archived' ? (
                    <Button size="icon" variant="ghost" disabled={updateStatus.isPending} onClick={() => changeStatus(entry.latest, 'archived')} title="Archive latest version" aria-label="Archive latest version">
                      <Archive className="size-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={updateStatus.isPending} onClick={() => changeStatus(entry.latest, 'draft')} className="hidden sm:inline-flex">
                      <Undo2 className="size-4" />Restore
                    </Button>
                  )}
                </div>
              </div>
              {entry.latest.status === 'approved' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
                  <ShieldCheck className="size-3.5" />
                  Approved deliverable{entry.latest.approvedAt ? ` on ${new Date(entry.latest.approvedAt).toLocaleDateString()}` : ''}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
