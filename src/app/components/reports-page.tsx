import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle, Archive, ChevronDown, Download, FileText, FolderOpen, Search,
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
    className: 'border-slate-200 bg-slate-50 text-slate-600',
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
            : 'border-slate-200 bg-slate-50 text-slate-600'}
      >
        {statusLabel[entry.latest.status]}
      </Badge>
    </div>
  );
}

function VersionStack({ entry }: { entry: ReportLibraryEntry }) {
  if (entry.versions.length <= 1) return null;
  return (
    <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        {entry.versions.length} saved versions
      </summary>
      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {entry.versions.map(version => (
          <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">Version {version.version} · {statusLabel[version.status]}</span>
            <span className="text-slate-500">{new Date(version.updatedAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

const evidenceLabels: Record<keyof ReportReadiness['evidenceProvenance'], string> = {
  sensory: 'Sensory',
  instrumental: 'Instrumental',
  concept: 'Concept',
  purchaseIntent: 'Purchase intent',
};

const evidenceClassName: Record<ReportReadiness['evidenceProvenance'][keyof ReportReadiness['evidenceProvenance']], string> = {
  live: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  reference: 'border-orange-200 bg-orange-50 text-orange-700',
  none: 'border-slate-200 bg-slate-50 text-slate-500',
};

function EvidenceLedger({ entry }: { entry: ReportLibraryEntry }) {
  const liveCount = Object.values(entry.evidenceProvenance).filter(value => value === 'live').length;
  const referenceCount = Object.values(entry.evidenceProvenance).filter(value => value === 'reference').length;
  return (
    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <span className="flex items-center gap-1.5">
          Evidence ledger
          <ChevronDown className="size-3.5 text-slate-400" aria-hidden />
        </span>
        <span className="font-normal text-slate-500">
          {liveCount} live · {referenceCount} reference · {releaseCopy[entry.releaseStatus].label}
        </span>
      </summary>
      <div className="border-t border-slate-200 p-3">
        <p className="text-[11px] text-slate-500">{releaseCopy[entry.releaseStatus].detail}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(entry.evidenceProvenance) as Array<[keyof ReportReadiness['evidenceProvenance'], ReportReadiness['evidenceProvenance'][keyof ReportReadiness['evidenceProvenance']]]>).map(([key, value]) => (
            <div key={key} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] font-medium text-slate-500">{evidenceLabels[key]}</p>
              <Badge variant="outline" className={`mt-1 ${evidenceClassName[value]}`}>
                {value === 'live' ? 'Live' : value === 'reference' ? 'Reference/demo' : 'None'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
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
  const counts = useMemo(() => {
    const active = entries.filter(entry => entry.latest.status !== 'archived');
    return {
      active: active.length,
      clientReady: active.filter(entry => entry.releaseStatus === 'client_ready').length,
      internal: active.filter(entry => entry.releaseStatus === 'internal_draft').length,
      blocked: active.filter(entry => entry.releaseStatus === 'blocked').length,
      demo: active.filter(entry => entry.releaseStatus === 'demonstration_only').length,
    };
  }, [entries]);

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Report Vault</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            One row per client deliverable, with versions, approval state, evidence provenance, and export readiness kept together.
          </p>
        </div>
        <Button asChild><Link to="/decision"><Sparkles className="size-4" />Build report</Link></Button>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-slate-200 py-4">
        <div><strong className="text-xl text-slate-950">{counts.active}</strong><span className="ml-2 text-sm text-slate-500">active reports</span></div>
        <div><strong className="text-xl text-emerald-700">{counts.clientReady}</strong><span className="ml-2 text-sm text-slate-500">client-ready</span></div>
        <div><strong className="text-xl text-blue-700">{counts.internal}</strong><span className="ml-2 text-sm text-slate-500">internal drafts</span></div>
        <div><strong className="text-xl text-orange-700">{counts.demo}</strong><span className="ml-2 text-sm text-slate-500">demo only</span></div>
        <div><strong className="text-xl text-rose-700">{counts.blocked}</strong><span className="ml-2 text-sm text-slate-500">blocked</span></div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
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
          {[0, 1, 2].map(item => <div key={item} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <FolderOpen className="mx-auto size-9 text-slate-400" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">No reports match this view</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Saved versions appear here after a confirmed GO decision is paired with a concept and packaging direction.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visibleEntries.map((entry, index) => (
            <article key={entry.key} className={`p-4 sm:p-5 ${index > 0 ? 'border-t border-slate-200' : ''}`}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="size-4 text-slate-400" />
                    <h2 className="min-w-0 max-w-full break-words font-semibold text-slate-950 sm:truncate">{entry.displayTitle}</h2>
                    <ProjectStatusBadge
                      label={entry.latest.status === 'review' ? 'Ready for review' : entry.latest.status}
                      tone={statusTone[entry.latest.status]}
                      showIcon={false}
                    />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {entry.productName} · {entry.foodType} · {entry.conceptName}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
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
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to={`/report?report=${entry.latest.id}`}
                      onClick={() => setSelection(entry.foodType, null)}
                    >
                      <FolderOpen className="size-4" />Open report
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
                  ) : !readinessLoading[entry.latest.id] && (
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to={`/report?report=${entry.latest.id}`}
                        onClick={() => setSelection(entry.foodType, null)}
                      >
                        {entry.blockers.length ? 'Needs Review' : 'Open to Export'}
                      </Link>
                    </Button>
                  )}
                  {entry.latest.status === 'review' && (
                    <Button size="sm" asChild>
                      <Link
                        to={`/report?report=${entry.latest.id}`}
                        onClick={() => setSelection(entry.foodType, null)}
                      >
                        Review report
                      </Link>
                    </Button>
                  )}
                  {entry.latest.status === 'approved' && (
                    <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => changeStatus(entry.latest, 'draft')}>
                      <Undo2 className="size-4" />Reopen
                    </Button>
                  )}
                  {entry.latest.status !== 'archived' ? (
                    <Button size="sm" variant="ghost" disabled={updateStatus.isPending} onClick={() => changeStatus(entry.latest, 'archived')} title="Archive latest version" className="hidden sm:inline-flex">
                      <Archive className="size-4" />Archive
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
              <EvidenceLedger entry={entry} />
              <VersionStack entry={entry} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
