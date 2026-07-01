import { useState } from 'react';
import type { DecisionOutcome, GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { formatDecisionNote } from '../lib/decision-summary';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import { cn } from './ui/utils';

const OUTCOMES: Array<{ value: DecisionOutcome; label: string }> = [
  { value: 'GO', label: 'GO' },
  { value: 'TWEAK', label: 'TWEAK' },
  { value: 'STOP', label: 'STOP' },
];

const OUTCOME_TEXT_CLASSES: Record<DecisionOutcome, string> = {
  GO: 'text-emerald-700',
  TWEAK: 'text-amber-700',
  STOP: 'text-rose-700',
};

const OUTCOME_ACTIVE_CLASSES: Record<DecisionOutcome, string> = {
  GO: 'bg-emerald-600 text-white hover:bg-emerald-700',
  TWEAK: 'bg-amber-500 text-white hover:bg-amber-600',
  STOP: 'bg-rose-600 text-white hover:bg-rose-700',
};

export function DecisionReviewDialog({
  open,
  decision,
  saving,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  decision: GoStopTweakDecision | null;
  saving: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (outcome: DecisionOutcome, note: string) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<DecisionOutcome>(decision?.decision ?? 'TWEAK');
  const [overriding, setOverriding] = useState(false);
  const [issue, setIssue] = useState(decision?.prescriptions[0]?.target ?? '');
  const [adjustment, setAdjustment] = useState(decision?.prescriptions[0]?.action ?? '');
  const [retest, setRetest] = useState(decision?.decision === 'TWEAK');
  const [note, setNote] = useState('');

  if (!decision) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm the decision</DialogTitle>
          <DialogDescription>
            {decision.sampleName} · ISSF {decision.issfScore.toFixed(1)}/100. Saving creates an audit record; it does not change the underlying score.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Outcome</p>
            <p className={cn('mt-0.5 text-lg font-bold', OUTCOME_TEXT_CLASSES[outcome])}>{outcome}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setOverriding(value => !value)}>
            {overriding ? 'Cancel change' : 'Change outcome'}
          </Button>
        </div>

        {overriding && (
          <div className="flex gap-2">
            {OUTCOMES.map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => { setOutcome(item.value); setOverriding(false); }}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-colors',
                  outcome === item.value
                    ? OUTCOME_ACTIVE_CLASSES[item.value]
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {outcome === 'TWEAK' && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-950">
              Adjustment plan <span className="font-normal text-amber-700">(optional)</span>
            </p>
            <label htmlFor="decision-issue" className="block text-xs font-semibold text-slate-700">
              Issue to address
              <Textarea id="decision-issue" className="mt-1 bg-white" rows={2} value={issue} onChange={event => setIssue(event.target.value)} />
            </label>
            <label htmlFor="decision-adjustment" className="block text-xs font-semibold text-slate-700">
              Planned adjustment
              <Textarea id="decision-adjustment" className="mt-1 bg-white" rows={2} value={adjustment} onChange={event => setAdjustment(event.target.value)} />
            </label>
            <label htmlFor="decision-retest" className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input id="decision-retest" type="checkbox" checked={retest} onChange={event => setRetest(event.target.checked)} />
              Retest after the adjustment
            </label>
          </div>
        )}

        <label htmlFor="decision-note" className="block text-xs font-semibold text-slate-700">
          Administrative note <span className="font-normal text-slate-500">(optional)</span>
          <Textarea id="decision-note" className="mt-1" rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Add rationale, approvals, or a batch reference." />
        </label>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            className="bg-blue-700 text-white hover:bg-blue-800"
            disabled={saving}
            onClick={() => onConfirm(outcome, formatDecisionNote({ outcome, note, issue, adjustment, retest }))}
          >
            {saving ? 'Saving...' : `Confirm ${outcome}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
