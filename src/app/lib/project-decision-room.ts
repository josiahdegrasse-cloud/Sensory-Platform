import type {
  CommercializationReportRecord,
  ConceptTest,
  DecisionRecord,
  InstrumentalDataset,
} from './database';
import type { Product, QuestionnaireResponse } from '../data/survey-domain';
import type { FormulationExperiment } from './db/experiments';
import type { FormulationVersion } from './formulation-profile';
import type { ProjectWorkflowSummary, WorkflowStageStatus } from './workflow/workflow-types';
import { conceptBelongsToProject } from './concept-project-scope';
import { reportBelongsToProject } from './report-project-scope';

export type DecisionRoomLineageStatus = WorkflowStageStatus | 'not_applicable';

export interface DecisionRoomPrototype {
  key: string;
  instrumentalSampleId: string | null;
  importBatchId: string | null;
  sampleId: string;
  sampleName: string;
  decision: DecisionRecord | null;
  decisionFormulation: FormulationVersion | null;
  currentFormulation: FormulationVersion | null;
  experiment: FormulationExperiment | null;
  instrumentSourceCount: number;
  studyCount: number;
  responseCount: number;
  conceptCount: number;
  reportCount: number;
  supersededDecision: DecisionRecord | null;
}

export interface DecisionRoomLineageItem {
  id: string;
  label: string;
  scope: 'prototype' | 'project';
  status: DecisionRoomLineageStatus;
  artifact: string;
  detail: string;
  route: string;
}

export interface DecisionRoomEligibility {
  tone: 'success' | 'warning' | 'critical' | 'neutral';
  label: string;
  detail: string;
  blockers: string[];
  warnings: string[];
}

export interface DecisionRoomAction {
  label: string;
  description: string;
  route: string;
}

function newestFirst<T extends { timestamp: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function currentFormulationForSample(
  sample: InstrumentalDataset['eTongueData'][number],
  formulations: FormulationVersion[],
): FormulationVersion | null {
  const matching = formulations.filter(item => sample.instrumentalSampleId
    ? item.instrumentalSampleId === sample.instrumentalSampleId
    : item.sampleId === sample.sampleId);
  return matching.find(item => item.isCurrent)
    ?? [...matching].sort((a, b) => b.versionNumber - a.versionNumber)[0]
    ?? null;
}

export function buildDecisionRoomPrototypes(input: {
  samples: InstrumentalDataset['eTongueData'];
  decisions: DecisionRecord[];
  formulations: FormulationVersion[];
  experiments: FormulationExperiment[];
  products?: Product[];
  responses?: QuestionnaireResponse[];
  concepts?: ConceptTest[];
  reports?: CommercializationReportRecord[];
  projectId?: string | null;
  dataset?: InstrumentalDataset;
}): DecisionRoomPrototype[] {
  const sampleIdFrequency = input.samples.reduce<Map<string, number>>((counts, sample) => {
    counts.set(sample.sampleId, (counts.get(sample.sampleId) ?? 0) + 1);
    return counts;
  }, new Map());
  const responsesByProduct = (input.responses ?? []).reduce<Map<string, number>>((counts, response) => {
    counts.set(response.productId, (counts.get(response.productId) ?? 0) + 1);
    return counts;
  }, new Map());

  return input.samples.map(sample => {
    const instrumentalSampleId = sample.instrumentalSampleId ?? null;
    const textFallbackIsSafe = sampleIdFrequency.get(sample.sampleId) === 1;
    const sampleDecisions = newestFirst(input.decisions.filter(decision => {
      if (instrumentalSampleId && decision.instrumentalSampleId) {
        return decision.instrumentalSampleId === instrumentalSampleId;
      }
      if (decision.instrumentalSampleId) return false;
      if (input.projectId && decision.projectId !== input.projectId) return false;
      return textFallbackIsSafe && decision.sampleId === sample.sampleId;
    }));
    const decision = sampleDecisions[0] ?? null;
    const decisionFormulation = decision?.formulationVersionId
      ? input.formulations.find(item => item.id === decision.formulationVersionId) ?? null
      : null;
    const experiment = decision
      ? [...input.experiments]
        .filter(item => item.decisionRecordId === decision.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
      : null;
    const instrumentSourceCount = [
      true,
      (input.dataset?.gcmsData[sample.sampleId]?.length ?? 0) > 0,
      Boolean(input.dataset?.compositionData[sample.sampleId]),
    ].filter(Boolean).length;
    const studies = (input.products ?? []).filter(product =>
      instrumentalSampleId && product.instrumentalSampleId
        ? product.instrumentalSampleId === instrumentalSampleId
        : !product.instrumentalSampleId
          && product.sourceImportBatchId === sample.importBatchId
          && product.sourceSampleId === sample.sampleId);
    const responseCount = studies.reduce((total, study) => total + (responsesByProduct.get(study.id) ?? 0), 0);
    const prototypeDecisionIds = new Set(sampleDecisions.map(item => item.id));
    const prototypeReports = (input.reports ?? []).filter(report =>
      reportBelongsToProject(report, input.projectId)
      && prototypeDecisionIds.has(report.decisionRecordId));
    const reportConceptIds = new Set(prototypeReports.map(report => report.conceptTestId));
    const concepts = (input.concepts ?? []).filter(concept =>
      conceptBelongsToProject(concept, input.projectId)
      && ((concept.decisionRecordId ? prototypeDecisionIds.has(concept.decisionRecordId) : false)
        || reportConceptIds.has(concept.id)));

    return {
      key: instrumentalSampleId ?? `${sample.importBatchId ?? 'unbatched'}:${sample.sampleId}`,
      instrumentalSampleId,
      importBatchId: sample.importBatchId ?? null,
      sampleId: sample.sampleId,
      sampleName: sample.sampleName ?? sample.sampleId,
      decision,
      decisionFormulation,
      currentFormulation: currentFormulationForSample(sample, input.formulations),
      experiment,
      instrumentSourceCount,
      studyCount: studies.length,
      responseCount,
      conceptCount: concepts.length,
      reportCount: prototypeReports.length,
      supersededDecision: sampleDecisions[1] ?? null,
    };
  });
}

export function decisionRoomEligibility(prototype: DecisionRoomPrototype): DecisionRoomEligibility {
  const decision = prototype.decision;
  if (!decision) {
    return {
      tone: 'neutral',
      label: 'Decision required',
      detail: 'Confirm a GO, TWEAK, or STOP decision before downstream work can begin.',
      blockers: ['No confirmed decision is linked to this prototype.'],
      warnings: [],
    };
  }

  if (decision.decision === 'STOP') {
    return {
      tone: 'critical',
      label: 'Downstream work blocked',
      detail: 'The confirmed STOP decision prevents experiment, concept, and report advancement.',
      blockers: ['A new evidence set and superseding decision are required to advance.'],
      warnings: [],
    };
  }

  if (decision.decision === 'TWEAK') {
    const blockers = [
      !decision.formulationVersionId ? 'The decision is not linked to a versioned formulation.' : null,
      !decision.evidenceBundleId ? 'The decision is not linked to an immutable evidence bundle.' : null,
    ].filter((item): item is string => Boolean(item));
    return blockers.length > 0
      ? {
          tone: 'warning',
          label: 'Experiment setup blocked',
          detail: 'Close the decision-linkage gaps before building a controlled formulation experiment.',
          blockers,
          warnings: [],
        }
      : {
          tone: 'success',
          label: prototype.experiment ? 'Controlled experiment active' : 'Eligible for controlled experiment',
          detail: prototype.experiment
            ? 'The TWEAK decision is linked to the evidence and formulation used by the experiment.'
            : 'The confirmed TWEAK decision has the formulation and evidence snapshots required for experiment design.',
          blockers: [],
          warnings: [],
        };
  }

  const warnings = !decision.formulationVersionId
    ? ['The GO decision does not preserve a versioned formulation snapshot.']
    : [];
  return {
    tone: 'success',
    label: 'Eligible for concept and report work',
    detail: 'A confirmed GO decision unlocks downstream concept and commercialization-report work.',
    blockers: [],
    warnings,
  };
}

function projectStage(workflow: ProjectWorkflowSummary, id: string) {
  return workflow.stages.find(stage => stage.id === id);
}

export function buildDecisionRoomLineage(input: {
  prototype: DecisionRoomPrototype;
  workflow: ProjectWorkflowSummary;
  routes: {
    data: string;
    studies: string;
    insights: string;
    decision: string;
    experiments: string;
    concept: string;
    report: string;
  };
}): DecisionRoomLineageItem[] {
  const { prototype, workflow, routes } = input;
  const studies = projectStage(workflow, 'studies');
  const decision = prototype.decision;
  const formulationStatus: DecisionRoomLineageStatus = prototype.decisionFormulation
    ? 'complete'
    : prototype.currentFormulation
      ? 'needs_review'
      : decision?.decision === 'TWEAK'
        ? 'blocked'
        : 'not_started';
  const experimentStatus: DecisionRoomLineageStatus = decision?.decision === 'TWEAK'
    ? prototype.experiment?.lifecycle === 'complete'
      ? 'complete'
      : prototype.experiment
        ? 'in_progress'
        : decision.formulationVersionId && decision.evidenceBundleId
          ? 'ready'
          : 'blocked'
    : 'not_applicable';

  return [
    {
      id: 'data', label: 'Imported sample', scope: 'prototype', status: 'complete',
      artifact: prototype.sampleId, detail: `${prototype.instrumentSourceCount}/3 expected machine sources linked`, route: routes.data,
    },
    {
      id: 'formulation', label: 'Formulation', scope: 'prototype', status: formulationStatus,
      artifact: prototype.decisionFormulation
        ? `v${prototype.decisionFormulation.versionNumber} · decision snapshot`
        : prototype.currentFormulation
          ? `v${prototype.currentFormulation.versionNumber} · not linked to decision`
          : 'No versioned formulation',
      detail: prototype.decisionFormulation
        ? 'The exact formulation evaluated by the decision is preserved.'
        : 'Link the exact formulation before using ingredient or process mechanisms.',
      route: routes.data,
    },
    {
      id: 'studies', label: 'Study', scope: 'prototype', status: prototype.studyCount > 0 ? 'complete' : 'not_started',
      artifact: prototype.studyCount > 0
        ? `${prototype.studyCount} prototype-linked stud${prototype.studyCount === 1 ? 'y' : 'ies'}`
        : 'No prototype-linked study',
      detail: prototype.studyCount > 0
        ? 'Linked through the canonical instrumental sample record.'
        : studies?.detail ?? 'No study record is available.',
      route: routes.studies,
    },
    {
      id: 'responses', label: 'Responses', scope: 'prototype', status: prototype.responseCount > 0 ? 'complete' : prototype.studyCount > 0 ? 'in_progress' : 'not_started',
      artifact: `${prototype.responseCount} prototype-linked response${prototype.responseCount === 1 ? '' : 's'}`,
      detail: prototype.studyCount > 0
        ? `Counted only from the ${prototype.studyCount} linked stud${prototype.studyCount === 1 ? 'y' : 'ies'}.`
        : 'A linked study is required before responses can be attributed to this prototype.',
      route: routes.insights,
    },
    {
      id: 'decision', label: 'Decision', scope: 'prototype', status: decision ? 'complete' : 'ready',
      artifact: decision ? `${decision.decision} · ISSF ${decision.issfScore.toFixed(1)}` : 'No confirmed decision',
      detail: decision ? `Evidence strength ${decision.confidence.toFixed(0)}% · ${new Date(decision.timestamp).toLocaleDateString()}` : 'Review the evidence and confirm an outcome.',
      route: routes.decision,
    },
    {
      id: 'experiment', label: 'Experiment', scope: 'prototype', status: experimentStatus,
      artifact: prototype.experiment?.name ?? (experimentStatus === 'not_applicable' ? 'Not required by current decision' : 'No experiment linked'),
      detail: prototype.experiment
        ? `Lifecycle: ${prototype.experiment.lifecycle.replace(/_/g, ' ')}`
        : decision?.decision === 'TWEAK' ? 'A controlled experiment is the next formulation gate.' : 'Experiments are created from confirmed TWEAK decisions.',
      route: routes.experiments,
    },
    {
      id: 'concept', label: 'Concept', scope: 'prototype', status: prototype.conceptCount > 0 ? 'complete' : decision?.decision === 'GO' ? 'ready' : 'blocked',
      artifact: prototype.conceptCount > 0
        ? `${prototype.conceptCount} concept${prototype.conceptCount === 1 ? '' : 's'} linked`
        : 'No linked concept',
      detail: prototype.conceptCount > 0
        ? 'Linked through the authoritative decision or its saved report.'
        : decision?.decision === 'GO'
          ? 'GO makes this prototype eligible; no prototype-linked concept record was found.'
          : 'A confirmed GO is required before concept testing.',
      route: routes.concept,
    },
    {
      id: 'report', label: 'Report', scope: 'prototype', status: prototype.reportCount > 0 ? 'complete' : decision?.decision === 'GO' ? 'ready' : 'blocked',
      artifact: prototype.reportCount > 0
        ? `${prototype.reportCount} saved report version${prototype.reportCount === 1 ? '' : 's'}`
        : 'No linked report',
      detail: prototype.reportCount > 0 ? 'Linked directly through the authoritative decision.' : 'Report work begins from the confirmed GO decision.',
      route: routes.report,
    },
  ];
}

export function decisionRoomNextAction(input: {
  prototype: DecisionRoomPrototype;
  workflow: ProjectWorkflowSummary;
  routes: { data: string; decision: string; experiments: string };
}): DecisionRoomAction {
  const decision = input.prototype.decision;
  if (!decision) {
    return {
      label: 'Review prototype decision',
      description: 'Review the evidence for this prototype and confirm GO, TWEAK, or STOP.',
      route: input.routes.decision,
    };
  }
  if (decision.decision === 'TWEAK' && !decision.formulationVersionId) {
    return {
      label: 'Link versioned formulation',
      description: 'Preserve the exact ingredient statement evaluated by this decision before selecting a mechanism to test.',
      route: input.routes.data,
    };
  }
  if (decision.decision === 'TWEAK' && !decision.evidenceBundleId) {
    return {
      label: 'Refresh decision evidence',
      description: 'Create the immutable evidence bundle required to build a controlled experiment.',
      route: input.routes.decision,
    };
  }
  if (decision.decision === 'TWEAK') {
    return {
      label: input.prototype.experiment ? 'Open controlled experiment' : 'Build controlled experiment',
      description: input.prototype.experiment
        ? 'Continue the linked control-plus-variant experiment and record its next gate.'
        : 'Design the control-plus-variant study from the confirmed driver, evidence bundle, and formulation snapshot.',
      route: input.routes.experiments,
    };
  }
  if (decision.decision === 'STOP') {
    return {
      label: 'Review STOP decision',
      description: 'Document the closure or collect a new evidence set before creating a superseding decision.',
      route: input.routes.decision,
    };
  }
  return {
    label: input.workflow.nextAction.label,
    description: input.workflow.nextAction.description,
    route: input.workflow.nextAction.route,
  };
}
