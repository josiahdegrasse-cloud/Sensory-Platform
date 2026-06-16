import type { ConceptDraft, Question, WizardStep } from './types';
import type { AssignablePanelist } from '../../lib/assignments';
import { getAssignmentSummary } from '../../lib/assignments';

export interface ConceptReadinessItem {
  id: 'project' | 'brief' | 'visuals' | 'questions' | 'panelists';
  label: string;
  ready: boolean;
  detail: string;
  fixStep: Exclude<WizardStep, 'review' | 'launched'>;
}

export function getConceptReadiness({
  draft,
  questions,
  assignedPanelistIds,
  panelists,
}: {
  draft: ConceptDraft;
  questions: Question[];
  assignedPanelistIds: string[];
  panelists?: AssignablePanelist[];
}): ConceptReadinessItem[] {
  const projectReady = Boolean(draft.projectName.trim());
  const missingBriefFields = [
    !draft.name.trim() && 'concept name',
    !draft.category.trim() && 'category',
    !draft.description.trim() && 'description',
    !draft.productAppearance.trim() && 'product appearance',
    !draft.packageFormat.trim() && 'package format',
    !draft.targetMarket.trim() && 'target customer',
  ].filter(Boolean) as string[];
  const validImageCount = draft.marketingImages.filter(image => image.trim()).length;
  const validQuestionCount = questions.filter(question => question.text.trim()).length;
  const questionsReady = validQuestionCount > 0 && validQuestionCount === questions.length;
  const activeAssignedCount = panelists
    ? getAssignmentSummary('concept', { assignedPanelistIds }, panelists).activeAssignedIds.length
    : assignedPanelistIds.length;

  return [
    {
      id: 'project',
      label: 'Project',
      ready: projectReady,
      detail: projectReady ? draft.projectName.trim() : 'Add a project name in Concept.',
      fixStep: 'concept',
    },
    {
      id: 'brief',
      label: 'Concept brief',
      ready: missingBriefFields.length === 0,
      detail: missingBriefFields.length === 0
        ? 'Name, category, and description are ready.'
        : `Add ${missingBriefFields.join(', ')} in Concept.`,
      fixStep: 'concept',
    },
    {
      id: 'visuals',
      label: 'Concept visuals',
      ready: validImageCount > 0,
      detail: validImageCount > 0
        ? `${validImageCount} visual${validImageCount === 1 ? '' : 's'} selected.`
        : 'Select or add at least one concept visual.',
      fixStep: 'visuals',
    },
    {
      id: 'questions',
      label: 'Survey questions',
      ready: questionsReady,
      detail: questionsReady
        ? `${validQuestionCount} complete question${validQuestionCount === 1 ? '' : 's'} in the survey.`
        : validQuestionCount === 0
          ? 'Build a draft survey or add at least one complete question.'
          : 'Add text to every survey question or remove empty questions.',
      fixStep: 'survey',
    },
    {
      id: 'panelists',
      label: 'Panelists',
      ready: activeAssignedCount > 0,
      detail: activeAssignedCount > 0
        ? `${activeAssignedCount} active panelist${activeAssignedCount === 1 ? '' : 's'} assigned.`
        : assignedPanelistIds.length > 0
          ? 'The saved selections are inactive or archived. Assign at least one active panelist.'
          : 'Assign at least one active panelist.',
      fixStep: 'survey',
    },
  ];
}
