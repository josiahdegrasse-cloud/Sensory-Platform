import type { ConceptDraft, Question, WizardStep } from './types';
import type { AssignablePanelist } from '../../lib/assignments';
import { getAssignmentSummary } from '../../lib/assignments';
import { scoreStudyQuality, type StudyQualityScore } from './study-quality-scorer';

export interface ConceptReadinessItem {
  id: 'project' | 'brief' | 'visuals' | 'questions' | 'panelists';
  label: string;
  ready: boolean;
  detail: string;
  fixStep: Exclude<WizardStep, 'review' | 'launched'>;
}

export interface ConceptReadinessResult {
  items: ConceptReadinessItem[];
  studyQuality: StudyQualityScore;
}

export function getConceptReadiness({
  draft,
  questions,
  assignedPanelistIds,
  panelists,
  targetPanelSize,
  requireApprovedVisuals = false,
}: {
  draft: ConceptDraft;
  questions: Question[];
  assignedPanelistIds: string[];
  panelists?: AssignablePanelist[];
  targetPanelSize?: number;
  requireApprovedVisuals?: boolean;
}): ConceptReadinessResult {
  const projectReady = Boolean(draft.projectName.trim());
  const missingBriefFields = [
    !draft.name.trim() && 'concept name',
    !draft.category.trim() && 'category',
    !draft.description.trim() && 'description',
  ].filter(Boolean) as string[];
  const validImageCount = draft.marketingImages.filter(image => image.trim()).length;
  const approvedImageCount = draft.marketingImages.reduce((count, image, index) => {
    if (!image.trim()) return count;
    return draft.marketingImageReviews[index]?.status === 'approved' ? count + 1 : count;
  }, 0);
  const visualsReady = requireApprovedVisuals ? approvedImageCount > 0 && approvedImageCount === validImageCount : validImageCount > 0;
  const validQuestionCount = questions.filter(question => question.text.trim()).length;
  const questionsReady = validQuestionCount > 0 && validQuestionCount === questions.length;
  const activeAssignedCount = panelists
    ? getAssignmentSummary('concept', { assignedPanelistIds }, panelists).activeAssignedIds.length
    : assignedPanelistIds.length;

  const items: ConceptReadinessItem[] = [
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
        ? 'Name, category, and positioning promise are ready.'
        : `Add ${missingBriefFields.join(', ')} in Concept.`,
      fixStep: 'concept',
    },
    {
      id: 'visuals',
      label: 'Concept visuals',
      ready: visualsReady,
      detail: validImageCount > 0
        ? requireApprovedVisuals
          ? `${approvedImageCount}/${validImageCount} selected visual${validImageCount === 1 ? '' : 's'} approved for panelist use.`
          : `${validImageCount} visual${validImageCount === 1 ? '' : 's'} selected.`
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
      fixStep: 'panel',
    },
  ];

  const studyQuality = scoreStudyQuality(
    draft,
    questions,
    activeAssignedCount,
    targetPanelSize ?? 24,
  );

  return { items, studyQuality };
}
