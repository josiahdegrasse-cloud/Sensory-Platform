import type { ConceptQuestion, ConceptResponse, ConceptTest } from './database';

export const SYNTHETIC_CONCEPT_RESPONSE_COUNT = 36;

const SYNTHETIC_COMMENTS = [
  'The visual feels clear and credible, with a strong product cue.',
  'The pack stands out, although the main benefit could be easier to find.',
  'This looks appropriate for an everyday purchase and the format is easy to understand.',
  'The visual direction is appealing, but I would want more proof behind the product claims.',
  'The design feels modern and the product itself remains the main focus.',
  'The concept is easy to understand; price and pack size would influence my final choice.',
];

function clampScale(value: number) {
  return Math.max(1, Math.min(9, Math.round(value)));
}

function scaleAnswer(question: ConceptQuestion, responseIndex: number) {
  const category = question.category.toLowerCase();
  const base = category.includes('appeal')
    ? 8
    : category.includes('purchase')
      ? 7
      : category.includes('price')
        ? 6
        : 7;
  const imageAdjustment = question.imageIndex === undefined
    ? 0
    : Math.max(-2, 1 - question.imageIndex);
  const variation = [-1, 0, 0, 1, 0, -1][responseIndex % 6];
  return clampScale(base + imageAdjustment + variation);
}

function multipleChoiceAnswer(question: ConceptQuestion, responseIndex: number): string | string[] {
  const options = question.options ?? [];
  if (options.length === 0) return '';
  const primaryIndex = responseIndex % 5 === 0
    ? Math.min(1, options.length - 1)
    : 0;
  if (!question.text.toLowerCase().includes('select all')) return options[primaryIndex];
  const secondaryIndex = (primaryIndex + 1 + (responseIndex % Math.max(1, options.length - 1))) % options.length;
  return [...new Set([options[primaryIndex], options[secondaryIndex]])];
}

function rankingAnswer(question: ConceptQuestion, responseIndex: number) {
  const options = [...(question.options ?? [])];
  if (options.length < 2 || responseIndex % 4 !== 0) return options;
  return [options[1], options[0], ...options.slice(2)];
}

function imageChoiceAnswer(imageUrls: string[], responseIndex: number) {
  if (imageUrls.length === 0) return '';
  const position = responseIndex % 20;
  if (position < 11 || imageUrls.length === 1) return imageUrls[0];
  if (position < 17 || imageUrls.length === 2) return imageUrls[1];
  return imageUrls[2 + (responseIndex % Math.max(1, imageUrls.length - 2))];
}

function answerQuestion(
  question: ConceptQuestion,
  imageUrls: string[],
  responseIndex: number,
): string | number | string[] {
  switch (question.type) {
    case 'scale':
      return scaleAnswer(question, responseIndex);
    case 'multiple_choice':
      return multipleChoiceAnswer(question, responseIndex);
    case 'ranking':
      return rankingAnswer(question, responseIndex);
    case 'image_choice':
      return imageChoiceAnswer(imageUrls, responseIndex);
    case 'open_text':
      return SYNTHETIC_COMMENTS[responseIndex % SYNTHETIC_COMMENTS.length];
  }
}

/**
 * Builds deterministic, in-memory responses for exercising concept-result and
 * report-generation paths. These records are never inserted into Supabase.
 */
export function buildSyntheticConceptResponses(
  concept: Pick<ConceptTest, 'id' | 'questions' | 'imageUrls'>,
  responseCount = SYNTHETIC_CONCEPT_RESPONSE_COUNT,
): ConceptResponse[] {
  const safeCount = Math.max(1, Math.floor(responseCount));
  return Array.from({ length: safeCount }, (_, responseIndex) => ({
    id: `synthetic-concept-response-${concept.id}-${responseIndex + 1}`,
    userId: `synthetic-panelist-${responseIndex + 1}`,
    conceptTestId: concept.id,
    answers: Object.fromEntries(concept.questions.map(question => [
      question.id,
      answerQuestion(question, concept.imageUrls, responseIndex),
    ])),
    createdAt: new Date(Date.UTC(2026, 7, 20, 9, responseIndex)).toISOString(),
  }));
}

export function isSyntheticConceptResponse(response: Pick<ConceptResponse, 'id'>) {
  return response.id.startsWith('synthetic-concept-response-');
}
