import { supabase } from '../supabase';
import { asJson, dbError, fromJson } from './shared';
import type { Database } from './database.types';
import type { ExperimentAnalysisResult, ExperimentAnalysisMode } from '../experiment-analysis';

type Tables = Database['public']['Tables'];

export type FormulationExperimentLifecycle =
  | 'draft'
  | 'locked'
  | 'fielding'
  | 'analysis'
  | 'confirmation'
  | 'complete'
  | 'cancelled';

export type ExperimentLearningStatus = 'not_captured' | 'draft' | 'approved';

export interface FormulationExperimentArm {
  id: string;
  experimentId: string;
  code: string;
  label: string;
  armType: 'control' | 'variant';
  mechanism: string;
  changeDescription: string;
  formulationVersionId: string | null;
  sortOrder: number;
}

export interface FormulationExperimentTrial {
  id: string;
  experimentId: string;
  participantKey: string;
  sessionKey: string;
  batchCode: string | null;
  evaluatedAt: string;
  notes: string | null;
}

export interface FormulationExperimentEvaluation {
  id: string;
  experimentId: string;
  trialId: string;
  armId: string;
  primaryScore: number;
  overallLiking: number | null;
  categoryFitScore: number | null;
  secondaryScores: Record<string, number>;
  defectFlags: string[];
}

export interface FormulationExperiment {
  id: string;
  projectId: string;
  decisionRecordId: string;
  evidenceBundleId: string;
  formulationVersionId: string | null;
  name: string;
  lifecycle: FormulationExperimentLifecycle;
  measuredDriver: string;
  hypothesis: string;
  primaryOutcome: string;
  primaryScaleMin: number;
  primaryScaleMax: number;
  analysisMode: ExperimentAnalysisMode;
  bootstrapIterations: number;
  confidenceLevel: number;
  deterministicSeed: number;
  minimumN: number;
  uncertaintyMargin: number;
  servingProtocol: string;
  storageCheckpoints: string[];
  advancementGates: string[];
  analysisSnapshot: ExperimentAnalysisResult | null;
  winnerArmId: string | null;
  lockedAt: string | null;
  analyzedAt: string | null;
  confirmationCompletedAt: string | null;
  learningSummary: string | null;
  learningTags: string[];
  learningAppliesTo: string[];
  learningLimitations: string[];
  learningStatus: ExperimentLearningStatus;
  learningApprovedBy: string | null;
  learningApprovedAt: string | null;
  createdAt: string;
  updatedAt: string;
  arms: FormulationExperimentArm[];
  trials: FormulationExperimentTrial[];
  evaluations: FormulationExperimentEvaluation[];
}

export interface DecisionFreshness {
  allowed: boolean;
  reason: string | null;
  productEvidenceCurrent: boolean;
  formulationCurrent: boolean;
  literatureRefreshRequired: boolean;
  currentEvidenceBundleId: string | null;
  currentFormulationVersionId: string | null;
}

export interface ApprovedFormulationLearning {
  id: string;
  projectId: string;
  projectName: string;
  decisionRecordId: string;
  evidenceBundleId: string;
  formulationVersionId: string | null;
  experimentName: string;
  measuredDriver: string;
  hypothesis: string;
  primaryOutcome: string;
  summary: string;
  tags: string[];
  appliesTo: string[];
  limitations: string[];
  approvedAt: string;
  updatedAt: string;
}

function toArm(row: Tables['formulation_experiment_arms']['Row']): FormulationExperimentArm {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    code: row.code,
    label: row.label,
    armType: row.arm_type as FormulationExperimentArm['armType'],
    mechanism: row.mechanism,
    changeDescription: row.change_description,
    formulationVersionId: row.formulation_version_id,
    sortOrder: row.sort_order,
  };
}

function toTrial(row: Tables['formulation_experiment_trials']['Row']): FormulationExperimentTrial {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    participantKey: row.participant_key,
    sessionKey: row.session_key,
    batchCode: row.batch_code,
    evaluatedAt: row.evaluated_at,
    notes: row.notes,
  };
}

function toEvaluation(row: Tables['formulation_experiment_evaluations']['Row']): FormulationExperimentEvaluation {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    trialId: row.trial_id,
    armId: row.arm_id,
    primaryScore: Number(row.primary_score),
    overallLiking: row.overall_liking === null ? null : Number(row.overall_liking),
    categoryFitScore: row.category_fit_score === null ? null : Number(row.category_fit_score),
    secondaryScores: fromJson<Record<string, number>>(row.secondary_scores) ?? {},
    defectFlags: row.defect_flags,
  };
}

function toExperiment(
  row: Tables['formulation_experiments']['Row'],
  arms: FormulationExperimentArm[],
  trials: FormulationExperimentTrial[],
  evaluations: FormulationExperimentEvaluation[],
): FormulationExperiment {
  return {
    id: row.id,
    projectId: row.project_id,
    decisionRecordId: row.decision_record_id,
    evidenceBundleId: row.evidence_bundle_id,
    formulationVersionId: row.formulation_version_id,
    name: row.name,
    lifecycle: row.lifecycle as FormulationExperimentLifecycle,
    measuredDriver: row.measured_driver,
    hypothesis: row.hypothesis,
    primaryOutcome: row.primary_outcome,
    primaryScaleMin: Number(row.primary_scale_min),
    primaryScaleMax: Number(row.primary_scale_max),
    analysisMode: row.analysis_mode as ExperimentAnalysisMode,
    bootstrapIterations: row.bootstrap_iterations,
    confidenceLevel: Number(row.confidence_level),
    deterministicSeed: row.deterministic_seed,
    minimumN: row.minimum_n,
    uncertaintyMargin: Number(row.uncertainty_margin),
    servingProtocol: row.serving_protocol,
    storageCheckpoints: fromJson<string[]>(row.storage_checkpoints) ?? [],
    advancementGates: fromJson<string[]>(row.advancement_gates) ?? [],
    analysisSnapshot: fromJson<ExperimentAnalysisResult | null>(row.analysis_snapshot),
    winnerArmId: row.winner_arm_id,
    lockedAt: row.locked_at,
    analyzedAt: row.analyzed_at,
    confirmationCompletedAt: row.confirmation_completed_at,
    learningSummary: row.learning_summary,
    learningTags: row.learning_tags,
    learningAppliesTo: row.learning_applies_to,
    learningLimitations: row.learning_limitations,
    learningStatus: row.learning_status as ExperimentLearningStatus,
    learningApprovedBy: row.learning_approved_by,
    learningApprovedAt: row.learning_approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    arms: arms.filter(arm => arm.experimentId === row.id).sort((left, right) => left.sortOrder - right.sortOrder),
    trials: trials.filter(trial => trial.experimentId === row.id),
    evaluations: evaluations.filter(evaluation => evaluation.experimentId === row.id),
  };
}

export async function fetchFormulationExperiments(projectId: string): Promise<FormulationExperiment[]> {
  const { data: experimentRows, error } = await supabase
    .from('formulation_experiments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  const ids = (experimentRows ?? []).map(row => row.id);
  if (!ids.length) return [];

  const [armsResult, trialsResult, evaluationsResult] = await Promise.all([
    supabase.from('formulation_experiment_arms').select('*').in('experiment_id', ids),
    supabase.from('formulation_experiment_trials').select('*').in('experiment_id', ids),
    supabase.from('formulation_experiment_evaluations').select('*').in('experiment_id', ids),
  ]);
  if (armsResult.error) throw dbError(armsResult.error);
  if (trialsResult.error) throw dbError(trialsResult.error);
  if (evaluationsResult.error) throw dbError(evaluationsResult.error);

  const arms = (armsResult.data ?? []).map(toArm);
  const trials = (trialsResult.data ?? []).map(toTrial);
  const evaluations = (evaluationsResult.data ?? []).map(toEvaluation);
  return (experimentRows ?? []).map(row => toExperiment(row, arms, trials, evaluations));
}

export async function fetchApprovedFormulationLearnings(): Promise<ApprovedFormulationLearning[]> {
  const { data, error } = await supabase
    .from('approved_formulation_learnings')
    .select('*')
    .order('learning_approved_at', { ascending: false });
  if (error) throw dbError(error);

  return (data ?? []).flatMap(row => {
    if (
      !row.id
      || !row.project_id
      || !row.project_name
      || !row.decision_record_id
      || !row.evidence_bundle_id
      || !row.experiment_name
      || !row.measured_driver
      || !row.hypothesis
      || !row.primary_outcome
      || !row.learning_summary
      || !row.learning_approved_at
      || !row.updated_at
    ) return [];

    return [{
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      decisionRecordId: row.decision_record_id,
      evidenceBundleId: row.evidence_bundle_id,
      formulationVersionId: row.formulation_version_id,
      experimentName: row.experiment_name,
      measuredDriver: row.measured_driver,
      hypothesis: row.hypothesis,
      primaryOutcome: row.primary_outcome,
      summary: row.learning_summary,
      tags: row.learning_tags ?? [],
      appliesTo: row.learning_applies_to ?? [],
      limitations: row.learning_limitations ?? [],
      approvedAt: row.learning_approved_at,
      updatedAt: row.updated_at,
    }];
  });
}

export async function createFormulationExperiment(input: {
  projectId: string;
  decisionRecordId: string;
  name: string;
  measuredDriver: string;
  hypothesis: string;
  primaryOutcome: string;
  analysisMode: ExperimentAnalysisMode;
  minimumN: number;
  uncertaintyMargin: number;
  advancementGates: string[];
}) {
  const { data, error } = await supabase.rpc('create_formulation_experiment', {
    target_project_id: input.projectId,
    target_decision_record_id: input.decisionRecordId,
    target_name: input.name,
    target_measured_driver: input.measuredDriver,
    target_hypothesis: input.hypothesis,
    target_primary_outcome: input.primaryOutcome,
    target_analysis_mode: input.analysisMode,
    target_minimum_n: input.minimumN,
    target_uncertainty_margin: input.uncertaintyMargin,
    target_advancement_gates: asJson(input.advancementGates),
  });
  if (error) throw dbError(error);
  return data.id;
}

export async function updateFormulationExperimentDraft(input: {
  id: string;
  name: string;
  measuredDriver: string;
  hypothesis: string;
  primaryOutcome: string;
  analysisMode: ExperimentAnalysisMode;
  minimumN: number;
  uncertaintyMargin: number;
  servingProtocol: string;
  storageCheckpoints: string[];
  advancementGates: string[];
}) {
  const { error } = await supabase
    .from('formulation_experiments')
    .update({
      name: input.name.trim(),
      measured_driver: input.measuredDriver.trim(),
      hypothesis: input.hypothesis.trim(),
      primary_outcome: input.primaryOutcome.trim(),
      analysis_mode: input.analysisMode,
      minimum_n: input.minimumN,
      uncertainty_margin: input.uncertaintyMargin,
      serving_protocol: input.servingProtocol.trim(),
      storage_checkpoints: asJson(input.storageCheckpoints),
      advancement_gates: asJson(input.advancementGates),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('lifecycle', 'draft');
  if (error) throw dbError(error);
}

export async function addFormulationExperimentArm(input: {
  experimentId: string;
  label: string;
  mechanism: string;
  changeDescription: string;
}) {
  const { data, error } = await supabase.rpc('add_formulation_experiment_arm', {
    target_experiment_id: input.experimentId,
    target_label: input.label,
    target_mechanism: input.mechanism,
    target_change_description: input.changeDescription,
  });
  if (error) throw dbError(error);
  return data.id;
}

export async function deleteFormulationExperimentArm(armId: string) {
  const { error } = await supabase
    .from('formulation_experiment_arms')
    .delete()
    .eq('id', armId)
    .eq('arm_type', 'variant');
  if (error) throw dbError(error);
}

export async function lockFormulationExperiment(experimentId: string) {
  const { error } = await supabase.rpc('lock_formulation_experiment', {
    target_experiment_id: experimentId,
  });
  if (error) throw dbError(error);
}

export async function advanceFormulationExperiment(input: {
  experimentId: string;
  lifecycle: Exclude<FormulationExperimentLifecycle, 'draft' | 'locked'>;
  analysisSnapshot?: ExperimentAnalysisResult | null;
  winnerArmId?: string | null;
}) {
  const { error } = await supabase.rpc('advance_formulation_experiment', {
    target_experiment_id: input.experimentId,
    target_lifecycle: input.lifecycle,
    target_analysis_snapshot: input.analysisSnapshot ? asJson(input.analysisSnapshot) : undefined,
    target_winner_arm_id: input.winnerArmId ?? undefined,
  });
  if (error) throw dbError(error);
}

export async function recordFormulationEvaluation(input: {
  experimentId: string;
  participantKey: string;
  sessionKey?: string;
  batchCode?: string;
  armId: string;
  primaryScore: number;
  overallLiking?: number | null;
  categoryFitScore?: number | null;
  defectFlags?: string[];
}) {
  const { data: trial, error: trialError } = await supabase
    .from('formulation_experiment_trials')
    .upsert({
      experiment_id: input.experimentId,
      participant_key: input.participantKey.trim(),
      session_key: input.sessionKey?.trim() || '1',
      batch_code: input.batchCode?.trim() || null,
    }, { onConflict: 'experiment_id,participant_key,session_key' })
    .select()
    .single();
  if (trialError) throw dbError(trialError);

  const { error } = await supabase
    .from('formulation_experiment_evaluations')
    .upsert({
      experiment_id: input.experimentId,
      trial_id: trial.id,
      arm_id: input.armId,
      primary_score: input.primaryScore,
      overall_liking: input.overallLiking ?? null,
      category_fit_score: input.categoryFitScore ?? null,
      defect_flags: input.defectFlags ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'trial_id,arm_id' });
  if (error) throw dbError(error);
}

export async function saveFormulationExperimentLearning(input: {
  experimentId: string;
  summary: string;
  tags: string[];
  appliesTo: string[];
  limitations: string[];
  status: Exclude<ExperimentLearningStatus, 'not_captured'>;
}) {
  const { error } = await supabase.rpc('save_formulation_experiment_learning', {
    target_experiment_id: input.experimentId,
    target_summary: input.summary,
    target_tags: input.tags,
    target_applies_to: input.appliesTo,
    target_limitations: input.limitations,
    target_status: input.status,
  });
  if (error) throw dbError(error);
}

export async function fetchDecisionFreshness(decisionRecordId: string): Promise<DecisionFreshness> {
  const { data, error } = await supabase.rpc('get_decision_freshness', {
    target_decision_record_id: decisionRecordId,
  });
  if (error) throw dbError(error);
  const row = data?.[0];
  return {
    allowed: Boolean(row?.allowed),
    reason: row?.reason ?? null,
    productEvidenceCurrent: Boolean(row?.product_evidence_current),
    formulationCurrent: Boolean(row?.formulation_current),
    literatureRefreshRequired: Boolean(row?.literature_refresh_required),
    currentEvidenceBundleId: row?.current_evidence_bundle_id ?? null,
    currentFormulationVersionId: row?.current_formulation_version_id ?? null,
  };
}

export async function markDecisionResearchRefreshed(input: {
  decisionRecordId: string;
  researchFingerprint?: string | null;
}) {
  const { error } = await supabase.rpc('mark_decision_research_refreshed', {
    target_decision_record_id: input.decisionRecordId,
    target_research_fingerprint: input.researchFingerprint ?? undefined,
  });
  if (error) throw dbError(error);
}
