import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, Check, CheckCircle2, ClipboardCheck, Minus, Upload, X } from 'lucide-react';
import { Link } from 'react-router';
import { buildDecisionSummary } from '../lib/decision-summary';
import { useFoodType } from '../contexts/food-type-context';
import { parseBatchSelection } from '../lib/project-identity';
import { projectPath } from '../lib/project-journey-routes';
import { useImportBatches } from '../lib/hooks';
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

// Prototype list order: strongest launch candidates first (GO → TWEAK → STOP),
// matching the STOP < TWEAK < GO decision scale; ties break on ISSF score.
const DECISION_RANK: Record<GoStopTweakDecision['decision'], number> = { GO: 0, TWEAK: 1, STOP: 2 };

const STATUS_STYLE: Record<GateStatus, string> = {
  pass: 'bg-emerald-50 text-emerald-700',
  watch: 'bg-amber-50 text-amber-700',
  fail: 'bg-rose-50 text-rose-700',
  // Evidence never collected (panel-only study) — neutral, not a pass.
  not_measured: 'bg-slate-100 text-slate-500',
};

function statusIcon(status: GateStatus) {
  if (status === 'pass') return Check;
  if (status === 'fail') return X;
  if (status === 'not_measured') return Minus;
  return AlertTriangle;
}

function statusBadgeLabel(status: GateStatus) {
  if (status === 'watch') return 'REVIEW';
  return status.replace('_', ' ').toUpperCase();
}

function decisionScoreBand(score: number, stopThreshold: number, goThreshold: number) {
  if (score < stopThreshold) return 'STOP';
  if (score >= goThreshold) return 'GO';
  return 'TWEAK';
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
  badgeLabel?: string;
}> {
  const acceptance = decision.dimensionScores.hedonic;
  const weakestDimension = (Object.entries(decision.dimensionScores) as Array<
    [keyof GoStopTweakDecision['dimensionScores'], number]
  >).sort((a, b) => a[1] - b[1])[0]?.[0];
  const worstGate = decision.gates.find(gate => gate.status === 'fail')
    ?? decision.gates.find(gate => gate.status === 'watch');
  const defectStatus: GateStatus = decision.gates.some(gate => gate.status === 'fail')
    ? 'fail'
    : decision.gates.some(gate => gate.status === 'watch')
      ? 'watch'
      : decision.gates.length > 0 && decision.gates.every(gate => gate.status === 'not_measured')
        ? 'not_measured'
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
      id: 'texture',
      label: 'Texture',
      question: 'Is the product texture strong enough to advance without another formula pass?',
      status: decision.dimensionScores.texture >= 72 ? 'pass' : decision.dimensionScores.texture < 55 ? 'fail' : 'watch',
      badgeLabel: decision.dimensionScores.texture >= 72 ? undefined : 'FOCUS',
      detail: decision.dimensionScores.texture >= 72
        ? `Texture scored ${decision.dimensionScores.texture.toFixed(0)}/100. The texture signal is strong enough for advancement.`
        : weakestDimension === 'texture'
          ? `Texture scored ${decision.dimensionScores.texture.toFixed(0)}/100 and is the weakest measured dimension. Diagnose the responsible texture cues before choosing a formula intervention.`
          : `Texture scored ${decision.dimensionScores.texture.toFixed(0)}/100. It is a secondary signal, not yet a proven cause of the weaker ${weakestDimension === 'cata' ? 'category-fit' : 'decision'} result.`,
    },
    {
      id: 'category-fit',
      label: 'Category fit',
      question: 'Does the product read like the intended category?',
      status: decision.dimensionScores.cata >= 68 ? 'pass' : decision.dimensionScores.cata < 50 ? 'fail' : 'watch',
      detail: decision.dimensionScores.cata >= 68
        ? `Category fit scored ${decision.dimensionScores.cata.toFixed(0)}/100. Panel descriptors support the intended product category.`
        : `Category fit scored ${decision.dimensionScores.cata.toFixed(0)}/100. Confirm whether formulation, the benchmark, or the study lexicon caused the weak signal before selecting an intervention.`,
    },
    {
      id: 'defects',
      label: 'Defect risk',
      question: 'Are any aroma or instrument-quality issues blocking the decision?',
      status: defectStatus,
      detail: worstGate?.detail ?? (defectStatus === 'not_measured'
        ? 'Aroma and instrument-quality evidence was not collected for this study; this call rests on panel evidence alone.'
        : 'No aroma defect or instrument-quality gate is open.'),
    },
    {
      id: 'confidence',
      label: 'Evidence strength',
      question: 'Is the evidence strong enough to support this call?',
      status: decision.confidenceScore >= 72 ? 'pass' : 'watch',
      detail: `${decision.confidenceScore.toFixed(0)}% screening evidence strength. ${decision.confidenceScore >= 72 ? 'This supports the current formulation decision; it does not establish concept or commercialization readiness.' : 'More responses or validation would strengthen this formulation evidence set.'}`,
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision threshold</p>
        <p className="text-xs font-semibold text-slate-700">{distance}</p>
      </div>
      <div className="relative pt-2">
        <div className="flex h-1 overflow-hidden rounded-full">
          <span className="bg-rose-300" style={{ width: `${stopThreshold}%` }} />
          <span className="bg-amber-300" style={{ width: `${goThreshold - stopThreshold}%` }} />
          <span className="bg-emerald-300" style={{ width: `${100 - goThreshold}%` }} />
        </div>
        <span
          className="absolute top-0 h-3 w-1 rounded-full bg-slate-950"
          style={{ left: `${marker}%`, transform: 'translateX(-50%)' }}
        />
        <div className="mt-1 grid grid-cols-3 text-[10px] font-medium text-slate-500">
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
  intelligencePanel,
  onSelect,
  onConfirm,
}: {
  decisions: GoStopTweakDecision[];
  selected: GoStopTweakDecision;
  stopThreshold: number;
  goThreshold: number;
  confirmedDecision: (GoStopTweakDecision & { recordId?: string | null }) | null;
  intelligencePanel?: ReactNode;
  onSelect: (sampleId: string) => void;
  onConfirm: () => void;
}) {
  const orderedDecisions = useMemo(
    () => [...decisions].sort(
      (a, b) => DECISION_RANK[a.decision] - DECISION_RANK[b.decision] || b.issfScore - a.issfScore,
    ),
    [decisions],
  );
  const summary = buildDecisionSummary(selected);
  const outcomeStyle = OUTCOME_STYLE[selected.decision];
  const criteria = decisionCriteria(selected);
  const primaryPrescription = selected.prescriptions[0];
  const scoreBand = decisionScoreBand(selected.issfScore, stopThreshold, goThreshold);
  const hardStopGate = selected.decision === 'STOP' && scoreBand !== 'STOP'
    ? selected.gates.find(gate => gate.status === 'fail') ?? null
    : null;
  const decisionGap = selected.issfScore >= goThreshold
    ? `${(selected.issfScore - goThreshold).toFixed(1)} points above GO`
    : `${(goThreshold - selected.issfScore).toFixed(1)} points short of GO`;
  const pointsToGo = goThreshold - selected.issfScore;
  const decisionGapBadge = selected.issfScore >= goThreshold
    ? 'CLEARED'
    : pointsToGo <= 5
      ? 'CLOSE'
      : pointsToGo <= 10
        ? 'MODERATE GAP'
        : 'MATERIAL GAP';
  const evidenceCriteria = [
    ...criteria,
    {
      id: 'decision-gap',
      label: selected.decision === 'GO' ? 'Decision margin' : 'Decision gap',
      question: selected.decision === 'GO' ? 'How much room does the prototype have above GO?' : 'What closes the gap to GO?',
      status: selected.issfScore >= goThreshold ? 'pass' as const : 'watch' as const,
      badgeLabel: decisionGapBadge,
      detail: selected.decision === 'GO'
        ? `${decisionGap}. Protect the current sensory profile and revalidate after process or ingredient changes.`
        : primaryPrescription
          ? `${decisionGap}. ${primaryPrescription.target}: ${primaryPrescription.action}`
          : `${decisionGap}. Address the failed criteria, then collect a new evidence set before reconsidering this prototype.`,
    },
  ];
  const parentDecisionId = confirmedDecision?.recordId ?? null;
  const { subCategory } = useFoodType();
  const selectedBatchId = parseBatchSelection(subCategory);
  const { data: importBatches = [] } = useImportBatches();
  const selectedBatch = selectedBatchId ? importBatches.find(batch => batch.id === selectedBatchId) : null;
  const retestPath = selectedBatch
    ? projectPath(selectedBatch.projectId ?? selectedBatch.id, 'data', `?retest=${encodeURIComponent(parentDecisionId ?? selected.sampleId)}`)
    : `/stage1?retest=${encodeURIComponent(parentDecisionId ?? selected.sampleId)}`;
  const retestState = {
    retestImport: {
      sampleId: selected.sampleId,
      sampleName: selected.sampleName,
      decision: selected.decision,
      target: primaryPrescription?.target,
      action: primaryPrescription?.action,
      parentDecisionId,
    },
  };

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
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 lg:hidden"
        >
          {orderedDecisions.map(decision => (
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
            {orderedDecisions.map(decision => {
              const active = decision.sampleId === selected.sampleId;
              const badgeClass = OUTCOME_STYLE[decision.decision].badge;
              return (
                <ProductListItem
                  key={decision.sampleId}
                  active={active}
                  onClick={() => onSelect(decision.sampleId)}
                  title={decision.sampleName}
                  meta={`ISSF ${decision.issfScore.toFixed(0)} · ${decision.confidenceScore.toFixed(0)}% evidence`}
                  badge={(
                    <Badge className={`${badgeClass} shrink-0 border-0 text-[11px] shadow-none`}>
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
        <header className={`border-b px-4 py-3 ${outcomeStyle.surface}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={outcomeStyle.badge}>{selected.decision}</Badge>
                <span className="text-xs font-semibold text-slate-700">{summary.confidence} screening evidence</span>
                {selected.decisionStatus === 'hold' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Evidence hold
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-700">{scoreBand} score band</span>
                {hardStopGate && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Hard STOP gate
                  </span>
                )}
                {confirmedDecision && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Confirmed
                  </span>
                )}
              </div>
              <h2 className={`mt-1 text-base font-bold sm:text-lg ${outcomeStyle.text}`}>{selected.sampleName}</h2>
              <p className="mt-0.5 max-w-3xl text-sm leading-5 text-slate-700">{selected.recommendation}</p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-medium text-slate-500">ISSF score</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{selected.issfScore.toFixed(1)}</p>
            </div>
          </div>
        </header>

          <div className="space-y-3 p-4">
          <ThresholdTrack score={selected.issfScore} stopThreshold={stopThreshold} goThreshold={goThreshold} />

          {hardStopGate && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">
              <span className="font-semibold">STOP triggered by hard gate, not the score band.</span>{' '}
              ISSF is in the {scoreBand} band, but {hardStopGate.label.toLowerCase()} failed: {hardStopGate.detail}
            </div>
          )}

          <section aria-labelledby="decision-evidence-heading" className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-2.5">
              <h3 id="decision-evidence-heading" className="text-sm font-semibold text-slate-900">Decision evidence details</h3>
              <p className="mt-0.5 text-xs text-slate-500">Acceptance, texture, category fit, defects, confidence, and decision gap.</p>
            </div>
            <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
              {evidenceCriteria.map((criterion, index) => {
                const Icon = statusIcon(criterion.status);
                return (
                  <div
                    key={criterion.id}
                    className={`flex gap-2.5 px-3 py-2.5 ${index > 1 ? 'md:border-t md:border-slate-100' : ''}`}
                  >
                    <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${STATUS_STYLE[criterion.status]}`}>
                      <Icon className="size-3" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{criterion.label}</p>
                        <Badge className={`${STATUS_STYLE[criterion.status]} border-0 px-1.5 py-0 text-[10px] leading-5 shadow-none`}>
                          {criterion.badgeLabel ?? statusBadgeLabel(criterion.status)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600">{criterion.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {selected.decision !== 'GO' && intelligencePanel}
        </div>

        <div className="px-5 pb-5">
          <footer className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Decision actions</p>
              <p className="mt-1 text-xs text-slate-500">
                {confirmedDecision ? `${confirmedDecision.decision} is saved for this evidence version.` : 'Confirm this decision before resubmitting test data.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={selected.decisionStatus === 'hold'} onClick={onConfirm} className="bg-blue-700 text-white hover:bg-blue-800">
                <ClipboardCheck className="size-4" />
                {confirmedDecision ? 'Review confirmation' : `Confirm ${selected.decision}`}
              </Button>
              {selected.decision !== 'GO' && (
                parentDecisionId ? (
                  <Button asChild variant="outline">
                    <Link to={retestPath} state={retestState}>
                      <Upload className="size-4" />
                      Resubmit testing
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    <Upload className="size-4" />
                    Resubmit testing
                  </Button>
                )
              )}
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
