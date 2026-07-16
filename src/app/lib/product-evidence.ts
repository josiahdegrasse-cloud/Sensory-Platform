import type { DecisionRecord, FormulationExperiment } from './database';
import type { FormulationVersion } from './formulation-profile';
import { compareFormulationVersions } from './formulation-profile';
import type { InsightsEvidenceStrength } from './insights';

export type ProductEvidenceState =
  | 'collecting'
  | 'ready_for_decision'
  | 'decision_recorded'
  | 'experiment_in_progress'
  | 'confirmation_required'
  | 'capture_learning'
  | 'learning_approved';

export interface ProductEvidenceSummary {
  state: ProductEvidenceState;
  stateLabel: string;
  headline: string;
  detail: string;
  supports: string[];
  doesNotSupport: string[];
  nextActionLabel: string;
  formulation: {
    current: FormulationVersion | null;
    previous: FormulationVersion | null;
    added: string[];
    removed: string[];
    reordered: string[];
  };
  experiment: {
    id: string;
    name: string;
    lifecycle: FormulationExperiment['lifecycle'];
    hypothesis: string;
    result: string;
    learningSummary: string | null;
    learningStatus: FormulationExperiment['learningStatus'];
    learningAppliesTo: string[];
    learningLimitations: string[];
  } | null;
}

function latestVersions(versions: FormulationVersion[]) {
  return [...versions].sort((left, right) => right.versionNumber - left.versionNumber);
}

function experimentResult(experiment: FormulationExperiment) {
  const analysis = experiment.analysisSnapshot;
  const winnerId = experiment.winnerArmId ?? analysis?.recommendedWinnerArmId;
  const winnerArm = experiment.arms.find(arm => arm.id === winnerId);
  const winnerAnalysis = analysis?.arms.find(arm => arm.armId === winnerId);
  if (!analysis || !winnerArm || !winnerAnalysis) {
    return experiment.lifecycle === 'complete'
      ? 'The experiment is complete, but no variant cleared the recorded advancement gates.'
      : 'Performance results will appear after the predeclared analysis is saved.';
  }
  const interval = winnerAnalysis.confidenceInterval;
  return `${winnerArm.code} ${winnerArm.label} improved the primary outcome by ${winnerAnalysis.liftVersusControl.toFixed(1)} points versus C0 (${interval[0].toFixed(1)} to ${interval[1].toFixed(1)} interval; n=${winnerAnalysis.n}).`;
}

export function buildProductEvidenceSummary(input: {
  sampleName: string;
  responseCount: number;
  minimumResponses: number;
  instrumentSources: number;
  strength: InsightsEvidenceStrength;
  keyStrength: string;
  keyConcern: string;
  decision: DecisionRecord | null;
  formulationVersions: FormulationVersion[];
  experiment: FormulationExperiment | null;
}): ProductEvidenceSummary {
  const versions = latestVersions(input.formulationVersions);
  const current = versions.find(version => version.isCurrent) ?? versions[0] ?? null;
  const previous = current
    ? versions.find(version => version.id !== current.id && version.versionNumber < current.versionNumber) ?? null
    : null;
  const comparison = current
    ? compareFormulationVersions(current, previous)
    : { added: [], removed: [], reordered: [] };

  let state: ProductEvidenceState = 'collecting';
  let stateLabel = 'Collecting evidence';
  let headline = `${input.sampleName} does not yet have enough live panel evidence for decision review.`;
  let detail = input.strength.note;
  let nextActionLabel = 'Continue response collection';

  if (input.experiment?.learningStatus === 'approved') {
    state = 'learning_approved';
    stateLabel = 'Learning approved';
    headline = `${input.sampleName} has a completed experiment and an approved reusable learning record.`;
    detail = 'The lesson remains linked to its formulation, control, variants, participant outcomes, analysis, applicability, and limitations.';
    nextActionLabel = 'Review experiment learning';
  } else if (input.experiment?.lifecycle === 'complete') {
    state = 'capture_learning';
    stateLabel = 'Capture learning';
    headline = `${input.sampleName} completed its controlled experiment. Record the bounded lesson before reusing the result elsewhere.`;
    detail = experimentResult(input.experiment);
    nextActionLabel = 'Capture experiment learning';
  } else if (input.experiment?.lifecycle === 'confirmation') {
    state = 'confirmation_required';
    stateLabel = 'Confirmation required';
    headline = `${input.sampleName} has a candidate winner that still needs a fresh confirmation batch.`;
    detail = experimentResult(input.experiment);
    nextActionLabel = 'Complete confirmation';
  } else if (input.experiment && ['locked', 'fielding', 'analysis'].includes(input.experiment.lifecycle)) {
    state = 'experiment_in_progress';
    stateLabel = 'Experiment in progress';
    headline = `${input.sampleName} is in a controlled formulation experiment.`;
    detail = `${input.experiment.name}: ${input.experiment.hypothesis}`;
    nextActionLabel = 'Open formulation experiment';
  } else if (input.decision) {
    state = 'decision_recorded';
    stateLabel = `${input.decision.decision} recorded`;
    headline = `${input.sampleName} has a confirmed ${input.decision.decision} decision at ISSF ${input.decision.issfScore.toFixed(1)}.`;
    detail = input.decision.note || 'The decision is tied to the recorded evidence and formulation snapshot.';
    nextActionLabel = input.decision.decision === 'GO' ? 'Review confirmed decision' : 'Build controlled experiment';
  } else if (input.strength.representative && input.responseCount >= input.minimumResponses) {
    state = 'ready_for_decision';
    stateLabel = 'Ready for decision review';
    headline = `${input.sampleName} has reached the configured evidence threshold.`;
    detail = 'Review the evidence boundaries and record a product-specific GO, TWEAK, or STOP decision.';
    nextActionLabel = 'Review decision';
  }

  const supports = [
    input.keyStrength,
    input.responseCount > 0
      ? `${input.responseCount} live panel response${input.responseCount === 1 ? ' is' : 's are'} linked to this exact sample.`
      : 'No live panel response record is linked yet.',
    `${input.instrumentSources} of 3 expected instrumental sources are linked.`,
  ];
  const doesNotSupport = [
    !input.strength.representative
      ? 'Representative consumer preference, demand, purchase-intent, or market-readiness claims.'
      : 'Demand, sales, or purchase-intent claims without separate concept or market evidence.',
    input.decision?.decision === 'GO'
      ? 'Commercial success or broad market superiority; GO is a product decision, not a sales forecast.'
      : 'Commercialization readiness until a product-specific GO decision is confirmed.',
    input.experiment?.lifecycle === 'complete'
      ? 'Transfer to other formulations outside the recorded applicability and limitations.'
      : 'A causal ingredient-to-performance conclusion without a completed controlled experiment.',
  ];

  return {
    state,
    stateLabel,
    headline,
    detail,
    supports,
    doesNotSupport,
    nextActionLabel,
    formulation: {
      current,
      previous,
      ...comparison,
    },
    experiment: input.experiment ? {
      id: input.experiment.id,
      name: input.experiment.name,
      lifecycle: input.experiment.lifecycle,
      hypothesis: input.experiment.hypothesis,
      result: experimentResult(input.experiment),
      learningSummary: input.experiment.learningSummary,
      learningStatus: input.experiment.learningStatus,
      learningAppliesTo: input.experiment.learningAppliesTo,
      learningLimitations: input.experiment.learningLimitations,
    } : null,
  };
}
