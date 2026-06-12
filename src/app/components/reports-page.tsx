import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Archive, Download, FileText, FolderOpen, Search,
  ShieldCheck, Sparkles, Undo2,
} from 'lucide-react';
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
  useUpdateCommercializationReportStatus, useWorkspaceSettings,
} from '../lib/hooks';
import {
  DEFAULT_REPORT_ORGANIZATION_NAME, DEFAULT_REPORT_WORKSPACE_NAME,
} from '../lib/commercialization-report';
import { buildReportLibrary, filterReportLibrary } from '../lib/report-library';
import { downloadCommercializationReportPdf } from '../utils/commercialization-report-export';
import type { CommercializationReportRecord } from '../lib/database';
import type { SemanticTone } from '../lib/project-status';

const STATUS_OPTIONS = ['all', 'draft', 'review', 'approved', 'archived'] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];

const statusTone: Record<CommercializationReportRecord['status'], SemanticTone> = {
  draft: 'info',
  review: 'warning',
  approved: 'success',
  archived: 'neutral',
};

export function ReportsPage() {
  const { user } = useAuth();
  const { setSelection } = useFoodType();
  const { data: reports = [], isLoading } = useCommercializationReports();
  const { data: decisions = [] } = useDecisionRecords();
  const { data: concepts = [] } = useAdminConceptTests();
  const { data: settings } = useWorkspaceSettings();
  const updateStatus = useUpdateCommercializationReportStatus();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [exportingId, setExportingId] = useState('');
  const [error, setError] = useState('');

  const entries = useMemo(
    () => buildReportLibrary(reports, decisions, concepts),
    [reports, decisions, concepts],
  );
  const visibleEntries = useMemo(
    () => filterReportLibrary(entries, search, status),
    [entries, search, status],
  );
  const counts = useMemo(() => ({
    active: entries.filter(entry => entry.latest.status !== 'archived').length,
    review: entries.filter(entry => entry.latest.status === 'review').length,
    approved: entries.filter(entry => entry.latest.status === 'approved').length,
  }), [entries]);

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

  const download = async (entry: ReturnType<typeof buildReportLibrary>[number]) => {
    if (!entry.snapshot) return;
    setExportingId(entry.latest.id);
    setError('');
    try {
      await downloadCommercializationReportPdf({
        snapshot: entry.snapshot,
        organizationName: settings?.organizationName ?? DEFAULT_REPORT_ORGANIZATION_NAME,
        workspaceName: settings?.workspaceName ?? DEFAULT_REPORT_WORKSPACE_NAME,
        reportFooter: settings?.reportFooter,
        version: entry.latest.version,
        status: entry.latest.status,
        logoUrl: settings?.logoUrl,
        primaryColor: settings?.primaryColor,
        accentColor: settings?.accentColor,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to export the report.');
    } finally {
      setExportingId('');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Reports</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Review every saved client deliverable, manage approval, and download the latest branded PDF.
          </p>
        </div>
        <Link to="/decision">
          <Button><Sparkles className="size-4" />Build report</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-slate-200 py-4">
        <div><strong className="text-xl text-slate-950">{counts.active}</strong><span className="ml-2 text-sm text-slate-500">active reports</span></div>
        <div><strong className="text-xl text-amber-700">{counts.review}</strong><span className="ml-2 text-sm text-slate-500">awaiting review</span></div>
        <div><strong className="text-xl text-emerald-700">{counts.approved}</strong><span className="ml-2 text-sm text-slate-500">approved</span></div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
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
          <SelectTrigger className="bg-white sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(option => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'Active reports' : option === 'review' ? 'Ready for review' : option[0].toUpperCase() + option.slice(1)}
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
            <article key={entry.key} className={`p-5 ${index > 0 ? 'border-t border-slate-200' : ''}`}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="size-4 text-slate-400" />
                    <h2 className="truncate font-semibold text-slate-950">{entry.latest.title}</h2>
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
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/report?report=${entry.latest.id}`}
                    onClick={() => setSelection(entry.foodType, null)}
                  >
                    <Button size="sm" variant="outline"><FolderOpen className="size-4" />Open report</Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!entry.snapshot || exportingId === entry.latest.id}
                    onClick={() => download(entry)}
                  >
                    <Download className="size-4" />{exportingId === entry.latest.id ? 'Preparing…' : 'Download PDF'}
                  </Button>
                  {entry.latest.status === 'review' && (
                    <Link
                      to={`/report?report=${entry.latest.id}`}
                      onClick={() => setSelection(entry.foodType, null)}
                    >
                      <Button size="sm">Review report</Button>
                    </Link>
                  )}
                  {entry.latest.status === 'approved' && (
                    <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => changeStatus(entry.latest, 'draft')}>
                      <Undo2 className="size-4" />Reopen
                    </Button>
                  )}
                  {entry.latest.status !== 'archived' ? (
                    <Button size="sm" variant="ghost" disabled={updateStatus.isPending} onClick={() => changeStatus(entry.latest, 'archived')} title="Archive latest version">
                      <Archive className="size-4" />Archive
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={updateStatus.isPending} onClick={() => changeStatus(entry.latest, 'draft')}>
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
