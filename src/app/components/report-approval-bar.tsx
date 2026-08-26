import { useState } from 'react';
import { Check, Eye, Undo2 } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ProjectStatusBadge } from './project-status-badge';
import { DataProvenanceBadge } from './data-provenance-badge';
import { useAuth } from '../contexts/auth-context';
import {
  useApproveCommercializationReportClaims,
  useRevokeCommercializationReportClaims,
  useUpdateCommercializationReportStatus,
} from '../lib/hooks';
import type { CommercializationReportRecord } from '../lib/database';

/**
 * Lifecycle controls for a saved commercialization report:
 * draft → ready for review → approved (or back to draft). Approval is the
 * human gate that completes the project's Report stage, so it is blocked
 * while the report still leans on reference/demo data.
 */
export function ReportApprovalBar({ report, evidenceFingerprint, blockedReasons = [] }: {
  report: CommercializationReportRecord;
  evidenceFingerprint: string;
  /** Approval remains disabled until every computed release-readiness blocker is cleared. */
  blockedReasons?: string[];
}) {
  const { user } = useAuth();
  const updateStatus = useUpdateCommercializationReportStatus();
  const approveClaims = useApproveCommercializationReportClaims();
  const revokeClaims = useRevokeCommercializationReportClaims();
  const [claimsScope, setClaimsScope] = useState(report.claimsScope ?? '');
  const [error, setError] = useState('');

  const setReportStatus = (status: CommercializationReportRecord['status']) => {
    if (!user) return;
    setError('');
    updateStatus.mutate(
      { id: report.id, status, actorId: user.id },
      { onError: e => setError(e instanceof Error ? e.message : 'Could not update the report status.') },
    );
  };

  const claimsApprovalCurrent = Boolean(
    report.claimsApprovedAt
    && report.claimsEvidenceFingerprint === evidenceFingerprint,
  );
  const busy = updateStatus.isPending || approveClaims.isPending || revokeClaims.isPending;
  const approvalBlocked = blockedReasons.length > 0;
  const blockerDescriptionId = approvalBlocked ? `report-approval-blockers-${report.id}` : undefined;

  return (
    <div className="border-b border-slate-200 bg-white px-1 py-3 print:hidden">
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
          <span className="text-sm text-slate-600">
            v{report.version}
            {report.status === 'draft' && ' · Submit when the content and release checks are complete.'}
            {report.status === 'review' && ' · Approval locks this version as the project deliverable.'}
            {report.status === 'approved' && ' · Approved project deliverable.'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {report.status === 'draft' && (
            <Button size="sm" disabled={busy} onClick={() => setReportStatus('review')}>
              <Eye className="size-3.5 mr-1.5" aria-hidden />
              Submit for review
            </Button>
          )}
          {report.status === 'review' && (
            <>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReportStatus('draft')} className="text-slate-700">
                <Undo2 className="size-3.5 mr-1.5" aria-hidden />
                Return to draft
              </Button>
              <Button
                size="sm"
                disabled={busy || approvalBlocked}
                title={blockedReasons[0]}
                aria-describedby={blockerDescriptionId}
                onClick={() => setReportStatus('approved')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="size-3.5 mr-1.5" aria-hidden />
                Approve report
              </Button>
            </>
          )}
          {report.status === 'approved' && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReportStatus('draft')} className="text-slate-700">
              <Undo2 className="size-3.5 mr-1.5" aria-hidden />
              Reopen as draft
            </Button>
          )}
        </div>
      </div>
      {report.status === 'review' && (
        <div className={`mt-3 border px-3 py-3 text-sm ${claimsApprovalCurrent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
          {claimsApprovalCurrent ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-950">Claims/legal review recorded</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">{report.claimsScope}</p>
                <p className="mt-1 text-xs text-emerald-700">
                  Evidence {evidenceFingerprint.slice(0, 12)} · {report.claimsApprovedAt ? new Date(report.claimsApprovedAt).toLocaleString() : ''}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setError('');
                  revokeClaims.mutate(report.id, { onError: reason => setError(reason instanceof Error ? reason.message : 'Could not revoke claims approval.') });
                }}
              >
                Revoke claims approval
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <Label htmlFor={`claims-scope-${report.id}`}>Claims/legal review scope</Label>
                <Textarea
                  id={`claims-scope-${report.id}`}
                  value={claimsScope}
                  onChange={event => setClaimsScope(event.target.value)}
                  className="mt-1 min-h-20 bg-white"
                  placeholder="State which pack, product, nutrition, sustainability, or marketing claims were reviewed and for which market."
                />
                <p className="mt-1 text-xs text-slate-600">This sign-off is tied to evidence fingerprint {evidenceFingerprint.slice(0, 12)} and becomes stale if the evidence changes.</p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy || claimsScope.trim().length < 10 || !evidenceFingerprint}
                onClick={() => {
                  setError('');
                  approveClaims.mutate(
                    { id: report.id, scope: claimsScope.trim(), evidenceFingerprint },
                    { onError: reason => setError(reason instanceof Error ? reason.message : 'Could not record claims approval.') },
                  );
                }}
              >
                Record claims approval
              </Button>
            </div>
          )}
        </div>
      )}
      {report.status === 'review' && approvalBlocked && (
        <div id={blockerDescriptionId} className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">Approval is blocked until these release checks are complete:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {blockedReasons.map(reason => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
