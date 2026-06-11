import { useState } from 'react';
import { Check, Eye, Undo2 } from 'lucide-react';
import { Button } from './ui/button';
import { ProjectStatusBadge } from './project-status-badge';
import { DataProvenanceBadge } from './data-provenance-badge';
import { useAuth } from '../contexts/auth-context';
import { useUpdateCommercializationReportStatus } from '../lib/hooks';
import type { CommercializationReportRecord } from '../lib/database';

/**
 * Lifecycle controls for a saved commercialization report:
 * draft → ready for review → approved (or back to draft). Approval is the
 * human gate that completes the project's Report stage, so it is blocked
 * while the report still leans on reference/demo data.
 */
export function ReportApprovalBar({ report, blockedReason }: {
  report: CommercializationReportRecord;
  /** When set, approval is disabled and this reason is shown (e.g. reference data in evidence). */
  blockedReason?: string;
}) {
  const { user } = useAuth();
  const updateStatus = useUpdateCommercializationReportStatus();
  const [error, setError] = useState('');

  const setReportStatus = (status: CommercializationReportRecord['status']) => {
    if (!user) return;
    setError('');
    updateStatus.mutate(
      { id: report.id, status, actorId: user.id },
      { onError: e => setError(e instanceof Error ? e.message : 'Could not update the report status.') },
    );
  };

  const busy = updateStatus.isPending;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 print:hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {report.status === 'approved' ? (
            <DataProvenanceBadge
              provenance="approved"
              detail={report.approvedAt ? new Date(report.approvedAt).toLocaleDateString() : undefined}
            />
          ) : (
            <ProjectStatusBadge
              label={report.status === 'review' ? 'Ready for review' : 'Draft'}
              tone={report.status === 'review' ? 'warning' : 'info'}
            />
          )}
          <span className="text-xs text-slate-500">
            v{report.version}
            {report.status === 'draft' && ' — submit for review when the draft is ready for sign-off.'}
            {report.status === 'review' && ' — approving locks this report as the project deliverable.'}
            {report.status === 'approved' && ' — this report is the approved project deliverable.'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {report.status === 'draft' && (
            <Button size="sm" disabled={busy} onClick={() => setReportStatus('review')} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Eye className="size-3.5 mr-1.5" aria-hidden />
              Submit for review
            </Button>
          )}
          {report.status === 'review' && (
            <>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReportStatus('draft')} className="text-slate-600">
                <Undo2 className="size-3.5 mr-1.5" aria-hidden />
                Return to draft
              </Button>
              <Button
                size="sm"
                disabled={busy || Boolean(blockedReason)}
                title={blockedReason}
                onClick={() => setReportStatus('approved')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="size-3.5 mr-1.5" aria-hidden />
                Approve report
              </Button>
            </>
          )}
          {report.status === 'approved' && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReportStatus('draft')} className="text-slate-600">
              <Undo2 className="size-3.5 mr-1.5" aria-hidden />
              Reopen as draft
            </Button>
          )}
        </div>
      </div>
      {report.status === 'review' && blockedReason && (
        <p className="mt-2 text-xs text-amber-700">{blockedReason}</p>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
