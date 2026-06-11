import type { ReactNode } from 'react';
import { RefreshCw, X, Check, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { DataProvenanceBadge } from './data-provenance-badge';
import type { ConfidenceLevel } from '../lib/project-status';

export type AIReviewState = 'draft' | 'edited' | 'approved';

interface AIReviewCardProps {
  /** What the AI produced, e.g. "Survey questions" or "Detected food category". */
  title: string;
  /** Plain-language inputs the AI worked from. Always shown — it's the trust feature. */
  sources: string[];
  /** Optional qualitative confidence with the facts behind it. */
  confidence?: ConfidenceLevel | null;
  confidenceBasis?: string;
  /** Inline cautions when inputs were thin or assumptions were made. */
  warnings?: string[];
  state: AIReviewState;
  /** Shown next to the approved badge, e.g. the approver's name. */
  approvedDetail?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onReject?: () => void;
  onApprove?: () => void;
  approveLabel?: string;
  /** The generated content, editable in place — editing is the primary interaction. */
  children: ReactNode;
  className?: string;
}

/**
 * The platform's single pattern for AI output awaiting a human decision:
 * provenance header, the data it used, warnings, the content itself
 * (editable in place), and a fixed Regenerate / Reject / Approve action row.
 * AI output is born a draft and stays visibly a draft until approved.
 */
export function AIReviewCard({
  title, sources, confidence, confidenceBasis, warnings = [],
  state, approvedDetail, onRegenerate, regenerating, onReject, onApprove,
  approveLabel = 'Approve', children, className,
}: AIReviewCardProps) {
  const approved = state === 'approved';
  return (
    <Card className={`border ${approved ? 'border-slate-200' : 'border-violet-200'} bg-white ${className ?? ''}`}>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              {approved ? (
                <DataProvenanceBadge provenance="approved" detail={approvedDetail} />
              ) : (
                <DataProvenanceBadge provenance="ai-draft" detail={state === 'edited' ? 'edited' : undefined} />
              )}
              {confidence && (
                <span
                  title={confidenceBasis}
                  className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  {confidence} confidence
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Based on: {sources.join(' · ')}
            </p>
          </div>
        </div>

        {warnings.map(warning => (
          <div key={warning} className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>{warning}</span>
          </div>
        ))}

        {children}

        {!approved && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              {onRegenerate && (
                <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={regenerating} className="text-slate-600">
                  <RefreshCw className={`size-3.5 mr-1.5 ${regenerating ? 'animate-spin' : ''}`} aria-hidden />
                  {regenerating ? 'Regenerating…' : 'Regenerate'}
                </Button>
              )}
              {onReject && (
                <Button variant="ghost" size="sm" onClick={onReject} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                  <X className="size-3.5 mr-1.5" aria-hidden />
                  Reject
                </Button>
              )}
            </div>
            {onApprove && (
              <Button size="sm" onClick={onApprove} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Check className="size-3.5 mr-1.5" aria-hidden />
                {approveLabel}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
