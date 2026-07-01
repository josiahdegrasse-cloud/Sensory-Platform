import { AlertTriangle, Clock } from 'lucide-react';
import type { EvidenceBundle } from '../lib/report-evidence-types';
import type { NarrativeEvaluation } from '../lib/report-evaluator';

// Reusable quality summary for a report: deterministic decision/confidence,
// evidence coverage, AI evaluator score, mismatch + staleness flags.
export function ReportQualityPanel({
  bundle,
  evaluation,
  stale = false,
}: {
  bundle: EvidenceBundle | null;
  evaluation?: NarrativeEvaluation | null;
  stale?: boolean;
}) {
  if (!bundle) return null;
  const mismatch = bundle.deterministicCandidateDecision !== 'INSUFFICIENT_DATA'
    && bundle.deterministicCandidateDecision !== 'GO';

  return (
    <div className={`rounded-md border p-4 ${mismatch || stale ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data evidence</span>
        <span className="text-sm text-slate-700">
          Candidate: <strong className="text-slate-900">{bundle.deterministicCandidateDecision}</strong>
        </span>
        <span className="text-sm text-slate-700">
          Confidence: <strong className="capitalize text-slate-900">{bundle.deterministicConfidence}</strong>
        </span>
        <span className="text-xs text-slate-500">
          {bundle.evidence.length} evidence · {bundle.missingData.length} missing · {bundle.qualityWarnings.length} warnings
        </span>
        {evaluation && (
          <span className={`text-xs font-semibold ${evaluation.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
            AI quality {evaluation.score}/100 · {evaluation.passed ? 'passed' : 'needs review'}
          </span>
        )}
      </div>

      {stale && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
          <Clock className="size-3.5" />
          The underlying data has changed since this report was built — regenerate before relying on it.
        </p>
      )}
      {mismatch && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="size-3.5" />
          The deterministic engine reads this data as <strong>{bundle.deterministicCandidateDecision}</strong>, not GO.
        </p>
      )}
      {bundle.qualityWarnings.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-700">
          {bundle.qualityWarnings.slice(0, 3).map(warning => <li key={warning.id}>• {warning.title}</li>)}
        </ul>
      )}
    </div>
  );
}
