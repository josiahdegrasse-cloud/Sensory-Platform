import type { ConceptQuestion } from './database';

export type ConceptAnswer = string | number | string[];

export function isConceptAnswerMissing(value: ConceptAnswer | null | undefined): boolean {
  return value === undefined
    || value === null
    || (typeof value === 'string' && value.trim().length === 0)
    || (Array.isArray(value) && value.length === 0);
}

export function findUnansweredRequiredConceptQuestions(
  questions: readonly ConceptQuestion[],
  answers: Readonly<Record<string, ConceptAnswer>>,
): ConceptQuestion[] {
  return questions.filter(question => question.required && isConceptAnswerMissing(answers[question.id]));
}
