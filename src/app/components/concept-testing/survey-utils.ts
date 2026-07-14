import type { Question } from './types';

const CATEGORY_TARGETS: Record<Question['category'], number> = {
  appeal: 5,
  purchase: 3,
  price: 2,
  usage: 2,
  attributes: 5,
  demographics: 1,
};

const CATEGORY_ORDER: Question['category'][] = [
  'appeal',
  'purchase',
  'price',
  'usage',
  'attributes',
  'demographics',
];

export function selectBalancedQuestions(
  tailored: Question[],
  templates: Question[],
): Question[] {
  const selected: Question[] = [];
  const selectedIds = new Set<string>();

  CATEGORY_ORDER.forEach(category => {
    const candidates = [...tailored, ...templates].filter(question => question.category === category);
    const required = candidates.filter(question => question.required);
    const optional = candidates.filter(question => !question.required);

    [...required, ...optional].slice(0, CATEGORY_TARGETS[category]).forEach(question => {
      if (selectedIds.has(question.id)) return;
      selected.push(question);
      selectedIds.add(question.id);
    });
  });

  return selected;
}

export function estimateQuestionSeconds(question: Question): number {
  const optionCount = question.options?.length ?? 0;
  switch (question.type) {
    case 'scale':
      return 20;
    case 'multiple_choice':
      return 22 + optionCount * 2;
    case 'open_text':
      return 70;
    case 'ranking':
      return 30 + optionCount * 4;
    case 'image_choice':
      return 25;
  }
}

export function estimateSurveySeconds(questions: Question[]): number {
  return questions.reduce((total, question) => total + estimateQuestionSeconds(question), 0);
}

export function formatSurveyDuration(seconds: number): string {
  if (seconds <= 0) return 'Not available';
  if (seconds < 60) return 'Less than 1 minute';

  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes <= 2) return `About ${minutes} minute${minutes === 1 ? '' : 's'}`;

  const lower = Math.max(1, Math.floor(minutes * 0.85));
  const upper = Math.max(lower + 1, Math.ceil(minutes * 1.15));
  return `About ${lower}-${upper} minutes`;
}
