import { AlertTriangle, Check, CheckCircle2, ClipboardCheck, ShieldAlert, Upload, X } from 'lucide-react';
import { Link } from 'react-router';
import { buildDecisionSummary } from '../lib/decision-summary';
import type { DecisionGate, GoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ProductListItem, ProductListPanel } from './product-list';

type GateStatus = DecisionGate['status'];

const OUTCOME_STYLE = {
  GO: {
    surface: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-700 text-white',
    text: 'text-emerald-950',
  },
  TWEAK: {
    surface: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-600 text-white',
    text: 'text-amber-950',
  },
  STOP: {
    surface: 'border-rose-200 bg-rose-50',
    badge: 'bg-rose-700 text-white',
    text: 'text-rose-950',
  },
};

const STATUS_STYLE: Record<GateStatus, string> = {
  pass: 'bg-emerald-50 text-emerald-700',
  watch: 'bg-amber-50 text-amber-700',
  fail: 'bg-rose-50 text-rose-700',
};

function statusIcon(status: GateStatus) {
  if (status === 'pass') return Check;
  if (status === 'fail') return X;
  return AlertTriangle;
}

function prototypeSignal(decision: GoStopTweakDecision) {
  const openGate = decision.gates.find(gate => gate.status === 'fail')
    ?? decision.gates.find(gate => gate.status === 'watch');
  if (openGate) return openGate.label;

  const dimensions = Object.entries(decision.dimensionScores) as Array<
    [keyof GoStopTweakDecision['dimensionScores'], number]
  >;
  const strongest = dimensions.sort((a, b) => b[1] - a[1])[0];
  return strongest ? `Strongest: ${strongest[0]}` : 'No hard gates open';
}

function decisionCriteria(decision: GoStopTweakDecision): Array<{
  id: string;
  label: string;
  question: string;
  status: GateStatus;
  detail: string;
}> {
  const acceptance = decision.dimensionScores.hedonic;
  const productQuality = (decision.dimensionScores.texture + decision.dimensionScores.cata) / 2;
  const worstGate = decision.gates.find(gate => gate.status === 'fail')
    ?? decision.gates.find(gate => gate.status === 'watch');
  const defectStatus: GateStatus = decision.gates.some(gate => gate.status === 'fail')
    ? 'fail'
    : decision.gates.some(gate => gate.status === 'watch')
      ? 'watch'
      : 'pass';

  return [
    {
      id: 'acceptance',
      label: 'Consumer acceptance',
      question: 'Do people like the product enough to advance it?',
      status: acceptance >= 70 ? 'pass' : acceptance < 45 ? 'fail' : 'watch',
      detail: `Liking evidence scored ${acceptance.toFixed(0)}/100. ${acceptance >= 70 ? 'Acceptance supports advancement.' : 'Acceptance needs improvement before scale-up.'}`,
    },
    {
      id: 'quality',
      label: 'Product quality',
      question: 'Does the sensory profile meet the expected quality level?',
      status: productQuality >= 68 ? 'pass' : productQuality < 48 ? 'fail' : 'watch',
      detail: `Texture scored ${decision.dimensionScores.texture.toFixed(0)} and category fit scored ${decision.dimensionScores.cata.toFixed(0)}. ${productQuality >= 68 ? 'The combined quality signal is strong.' : 'At least one product-quality dimension is holding the result back.'}`,
    },
    {
      id: 'defects',
      label: 'Defect risk',
      question: 'Are any aroma or instrument-quality issues blocking the decision?',
      status: defectStatus,
      detail: worstGate?.detail ?? 'No aroma defect or instrument-quality gate is open.',
    },
    {
      id: 'confidence',
      label: 'Evidence confidence',
      question: 'Is the evidence strong enough to support this call?',
      status: decision.confidenceScore >= 72 ? 'pass' : 'watch',
      detail: `${decision.confidenceScore.toFixed(0)}% confidence. ${decision.confidenceScore >= 72 ? 'The evidence clears the GO confidence requirement.' : 'More responses or validation would reduce decision uncertainty.'}`,
    },
  ];
}

function ThresholdTrack({ score, stopThreshold, goThreshold }: {
  score: number;
  stopThreshold: number;
  goThreshold: number;
}) {
  const marker = Math.max(1, Math.min(99, score));
  const distance = score >= goThreshold
    ? `${(score - goThreshold).toFixed(1)} points above GO`
    : `${(goThreshold - score).toFixed(1)} points to GO`;

  return (
    <div aria-label={`ISSF score ${score.toFixed(1)} out of 100. ${distance}.`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Decision threshold</p>
          <p className="mt-0.5 text-xs text-slate-500">{distance}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-slate-950">{score.toFixed(1)}</p>
      </div>
      <div className="relative pt-3">
        <div className="flex h-2 overflow-hidden rounded-full">
          <span className="bg-rose-300" style={{ width: `${stopThreshold}%` }} />
          <span className="bg-amber-300" style={{ width: `${goThreshold - stopThreshold}%` }} />
          <span className="bg-emerald-300" style={{ width: `${100 - goThreshold}%` }} />
        </div>
        <span
          className="absolute top-0 h-4 w-1 rounded-full bg-slate-950"
          style={{ left: `${marker}%`, transform: 'translateX(-50%)' }}
        />
        <div className="mt-2 grid grid-cols-3 text-[11px] font-medium text-slate-500">
          <span>STOP &lt; {stopThreshold}</span>
          <span className="text-center">TWEAK</span>
          <span className="text-right">GO ≥ {goThreshold}</span>
        </div>
      </div>
    </div>
  );
}

export function DecisionReviewWorkspace({
  decisions,
  selected,
  stopThreshold,
  goThreshold,
  confirmedDecision,
  onSelect,
  onConfirm,
}: {
  decisions: GoStopTweakDecision[];
  selected: GoStopTweakDecision;
  stopThreshold: number;
  goThreshold: number;
  confirmedDecision: (GoStopTweakDecision & { recordId?: string | null }) | null;
  onSelect: (sampleId: string) => void;
  onConfirm: () => void;
}) {
  const summary = buildDecisionSummary(selected);
  const outcomeStyle = OUTCOME_STYLE[selected.decision];
  const criteria = decisionCriteria(selected);
  const primaryPrescription = selected.prescriptions[0];
  const parentDecisionId = confirmedDecision?.recordId ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside aria-label="Prototype selection" className="self-start lg:sticky lg:top-24">
        <label htmlFor="decision-prototype" className="text-sm font-semibold text-slate-900 lg:hidden">
          Prototype
        </label>
        <select
          id="decision-prototype"
          value={selected.sampleId}
          onChange={event => onSelect(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 lg:hidden"
        >
          {decisions.map(decision => (
            <option key={decision.sampleId} value={decision.sampleId}>
              {decision.sampleName} · {decision.decision} · {decision.issfScore.toFixed(0)}
            </option>
          ))}
        </select>

        <ProductListPanel
          title="Prototypes"
          description={`${decisions.length} ready for review`}
          className="hidden lg:block"
          listLabel="Decision prototypes"
        >
            {decisions.map(decision => {
              const active = decision.sampleId === selected.sampleId;
              const badgeClass = OUTCOME_STYLE[decision.decision].badge;
              return (
                <ProductListItem
                  key={decision.sampleId}
                  active={active}
                  onClick={() => onSelect(decision.sampleId)}
                  title={decision.sampleName}
                  meta={`ISSF ${decision.issfScore.toFixed(0)} · ${decision.confidenceScore.toFixed(0)}% confidence`}
                  badge={(
                    <Badge className={`${badgeClass} shrink-0 border-0 text-[10px] shadow-none`}>
                      {decision.decision}
                    </Badge>
                  )}
                  signal={prototypeSignal(decision)}
                  signalTone={decision.decision === 'GO' ? 'success' : decision.decision === 'TWEAK' ? 'warning' : 'critical'}
                />
              );
            })}
        </ProductListPanel>
      </aside>

      <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className={`border-b p-6 ${outcomeStyle.surface}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={outcomeStyle.badge}>{selected.decision}</Badge>
                <span className="text-xs font-semibold text-slate-600">{summary.confidence} confidence</span>
                {confirmedDecision && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Confirmed
                  </span>
                )}
              </div>
              <h2 className={`mt-4 text-xl font-bold ${outcomeStyle.text}`}>{selected.sampleName}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{selected.recommendation}</p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-medium text-slate-500">ISSF score</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-950">{selected.issfScore.toFixed(1)}</p>
            </div>
          </div>
        </header>

        <div className="space-y-8 p-6">
          <ThresholdTrack score={selected.issfScore} stopThreshold={stopThreshold} goThreshold={goThreshold} />

          <section aria-labelledby="decisive-evidence-heading">
            <div className="mb-4">
              <h3 id="decisive-evidence-heading" className="text-base font-semibold text-slate-900">Decisive evidence</h3>
              <p className="mt-1 text-sm text-slate-600">The four questions that determine whether this prototype advances.</p>
            </div>
            <div className="divide-y divide-slate-100 border-y border-slate-200">
              {criteria.map(criterion => {
                const Icon = statusIcon(criterion.status);
                return (
                  <div key={criterion.id} className="grid gap-3 py-4 sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:items-start">
                    <span className={`flex size-7 items-center justify-center rounded-full ${STATUS_STYLE[criterion.status]}`}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{criterion.label}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{criterion.question}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{criterion.detail}</p>
                    </div>
                    <Badge className={`${STATUS_STYLE[criterion.status]} w-fit border-0 shadow-none`}>
                      {criterion.status === 'watch' ? 'REVIEW' : criterion.status.toUpperCase()}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="decision-change-heading" className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-slate-600" aria-hidden />
              <div className="min-w-0">
                <h3 id="decision-change-heading" className="text-base font-semibold text-slate-900">
                  {selected.decision === 'GO' ? 'What protects this decision?' : 'What changes this decision?'}
                </h3>
                {selected.decision === 'GO' ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-slate-900">Maintain the current sensory profile during scale-up.</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      Revalidate the product after process or ingredient changes. A new defect signal, lower liking, or confidence below 72% would reopen the decision.
                    </p>
                  </>
                ) : primaryPrescription ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{primaryPrescription.target}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{primaryPrescription.action}</p>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                      Estimated improvement: up to {primaryPrescription.expectedLift.toFixed(0)} ISSF points. Retest before advancing.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Address the failed decision criteria, then collect a new evidence set before reconsidering this prototype.
                  </p>
                )}
                {selected.decision !== 'GO' && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {selected.decision === 'STOP' ? 'Test a reformulation' : 'Confirm the adjustment'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      Use a follow-up import for this exact item so the next decision compares the adjusted batch against the issue that blocked advancement.
                    </p>
                    <ol className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <li className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        <span className="block font-semibold text-slate-900">1. Make the change</span>
                        {primaryPrescription?.action ?? 'Document the reformulation before retesting.'}
                      </li>
                      <li className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        <span className="block font-semibold text-slate-900">2. Import retest data</span>
                        New CSV data will be labeled for {selected.sampleName}.
                      </li>
                      <li className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        <span className="block font-semibold text-slate-900">3. Re-run decision</span>
                        Return here to confirm GO, TWEAK, or STOP on the new evidence.
                      </li>
                    </ol>
                    {parentDecisionId ? (
                      <Button asChild size="sm" className="mt-3 bg-slate-900 text-white hover:bg-slate-700">
                        <Link
                          to="/stage1"
                          state={{
                            retestImport: {
                              sampleId: selected.sampleId,
                              sampleName: selected.sampleName,
                              decision: selected.decision,
                              target: primaryPrescription?.target,
                              action: primaryPrescription?.action,
                              parentDecisionId,
                            },
                          }}
                        >
                          <Upload className="size-4" />
                          {selected.decision === 'STOP'
                            ? `Import reformulation for ${selected.sampleName}`
                            : `Import retest for ${selected.sampleName}`}
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" disabled className="mt-3">
                        Confirm {selected.decision} before importing retest data
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <footer className="flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {confirmedDecision ? `${confirmedDecision.decision} is saved for this evidence version.` : `Ready to confirm ${selected.decision}?`}
              </p>
              <p className="mt-1 text-xs text-slate-500">You can record an intentional override in the confirmation dialog.</p>
            </div>
            <Button onClick={onConfirm} className="bg-blue-700 text-white hover:bg-blue-800">
              <ClipboardCheck className="size-4" />
              {confirmedDecision ? 'Review confirmation' : `Confirm ${selected.decision}`}
            </Button>
          </footer>
        </div>
      </article>
    </div>
  );
}
