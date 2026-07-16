export type ExperimentAnalysisMode = 'paired' | 'independent';

export interface ExperimentArmInput {
  id: string;
  code: string;
  label: string;
  armType: 'control' | 'variant';
}

export interface ExperimentEvaluationInput {
  armId: string;
  participantKey: string;
  primaryScore: number;
}

export interface ExperimentArmAnalysis {
  armId: string;
  code: string;
  label: string;
  n: number;
  mean: number;
  liftVersusControl: number;
  confidenceInterval: [number, number];
  probabilityOfImprovement: number;
  minimumNMet: boolean;
  clearsUncertaintyMargin: boolean;
}

export interface ExperimentAnalysisResult {
  method: 'deterministic-bootstrap-v1';
  mode: ExperimentAnalysisMode;
  iterations: number;
  confidenceLevel: number;
  seed: number;
  controlArmId: string;
  arms: ExperimentArmAnalysis[];
  recommendedWinnerArmId: string | null;
  warnings: string[];
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(sorted: number[], probability: number) {
  if (!sorted.length) return 0;
  const position = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * probability));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function resampledMean(values: number[], random: () => number) {
  if (!values.length) return 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    total += values[Math.floor(random() * values.length)];
  }
  return total / values.length;
}

function independentDifferences(
  controlValues: number[],
  variantValues: number[],
  iterations: number,
  random: () => number,
) {
  return Array.from({ length: iterations }, () => (
    resampledMean(variantValues, random) - resampledMean(controlValues, random)
  ));
}

function pairedDifferences(
  controlByParticipant: Map<string, number>,
  variantByParticipant: Map<string, number>,
  iterations: number,
  random: () => number,
) {
  const differences = [...variantByParticipant.entries()]
    .filter(([participant]) => controlByParticipant.has(participant))
    .map(([participant, value]) => value - (controlByParticipant.get(participant) ?? 0));
  return {
    participantCount: differences.length,
    bootstraps: Array.from({ length: iterations }, () => resampledMean(differences, random)),
  };
}

export function analyzeFormulationExperiment(input: {
  arms: ExperimentArmInput[];
  evaluations: ExperimentEvaluationInput[];
  mode: ExperimentAnalysisMode;
  iterations?: number;
  confidenceLevel?: number;
  seed?: number;
  minimumN: number;
  uncertaintyMargin: number;
}): ExperimentAnalysisResult {
  const iterations = Math.max(1000, Math.min(100000, input.iterations ?? 10000));
  const confidenceLevel = Math.max(0.8, Math.min(0.999, input.confidenceLevel ?? 0.95));
  const seed = input.seed ?? 20260716;
  const control = input.arms.find(arm => arm.armType === 'control' || arm.code === 'C0');
  if (!control) throw new Error('Experiment analysis requires one C0 control arm.');

  const random = seededRandom(seed);
  const valuesByArm = new Map(input.arms.map(arm => [
    arm.id,
    input.evaluations
      .filter(evaluation => evaluation.armId === arm.id && Number.isFinite(evaluation.primaryScore))
      .map(evaluation => evaluation.primaryScore),
  ]));
  const valuesByParticipant = new Map(input.arms.map(arm => [
    arm.id,
    new Map(
      input.evaluations
        .filter(evaluation => evaluation.armId === arm.id && Number.isFinite(evaluation.primaryScore))
        .map(evaluation => [evaluation.participantKey, evaluation.primaryScore]),
    ),
  ]));
  const controlValues = valuesByArm.get(control.id) ?? [];
  const controlMean = mean(controlValues);
  const alpha = (1 - confidenceLevel) / 2;
  const warnings: string[] = [];

  if (controlValues.length < input.minimumN) {
    warnings.push(`C0 has n=${controlValues.length}; the predeclared minimum is n=${input.minimumN}.`);
  }

  const arms = input.arms.map(arm => {
    const values = valuesByArm.get(arm.id) ?? [];
    if (arm.id === control.id) {
      return {
        armId: arm.id,
        code: arm.code,
        label: arm.label,
        n: values.length,
        mean: controlMean,
        liftVersusControl: 0,
        confidenceInterval: [0, 0] as [number, number],
        probabilityOfImprovement: 0.5,
        minimumNMet: values.length >= input.minimumN,
        clearsUncertaintyMargin: true,
      };
    }

    let bootstraps: number[];
    let effectiveN = values.length;
    if (input.mode === 'paired') {
      const paired = pairedDifferences(
        valuesByParticipant.get(control.id) ?? new Map(),
        valuesByParticipant.get(arm.id) ?? new Map(),
        iterations,
        random,
      );
      bootstraps = paired.bootstraps;
      effectiveN = paired.participantCount;
      if (effectiveN < values.length) {
        warnings.push(`${arm.code} has ${effectiveN} matched C0 pairs from ${values.length} recorded evaluations.`);
      }
    } else {
      bootstraps = independentDifferences(controlValues, values, iterations, random);
    }

    const sorted = [...bootstraps].sort((left, right) => left - right);
    const interval: [number, number] = [
      percentile(sorted, alpha),
      percentile(sorted, 1 - alpha),
    ];
    const lift = input.mode === 'paired'
      ? mean(
          [...(valuesByParticipant.get(arm.id) ?? new Map()).entries()]
            .filter(([participant]) => valuesByParticipant.get(control.id)?.has(participant))
            .map(([participant, value]) => value - (valuesByParticipant.get(control.id)?.get(participant) ?? 0)),
        )
      : mean(values) - controlMean;

    return {
      armId: arm.id,
      code: arm.code,
      label: arm.label,
      n: effectiveN,
      mean: mean(values),
      liftVersusControl: lift,
      confidenceInterval: interval,
      probabilityOfImprovement: bootstraps.filter(value => value > 0).length / Math.max(1, bootstraps.length),
      minimumNMet: effectiveN >= input.minimumN && controlValues.length >= input.minimumN,
      clearsUncertaintyMargin: interval[0] > input.uncertaintyMargin,
    };
  });

  const recommendedWinner = arms
    .filter(arm => arm.armId !== control.id && arm.minimumNMet && arm.clearsUncertaintyMargin)
    .sort((left, right) => (
      right.liftVersusControl - left.liftVersusControl
      || right.probabilityOfImprovement - left.probabilityOfImprovement
    ))[0] ?? null;

  if (!recommendedWinner) {
    warnings.push('No variant currently clears both the minimum sample size and uncertainty-margin gates.');
  }

  return {
    method: 'deterministic-bootstrap-v1',
    mode: input.mode,
    iterations,
    confidenceLevel,
    seed,
    controlArmId: control.id,
    arms,
    recommendedWinnerArmId: recommendedWinner?.armId ?? null,
    warnings,
  };
}
