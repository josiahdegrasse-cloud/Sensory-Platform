import { describe, expect, it } from 'vitest';
import type { ConceptQuestion } from './database';
import { findUnansweredRequiredConceptQuestions } from './concept-response-validation';

const question = (id: string, required: boolean, type: ConceptQuestion['type']): ConceptQuestion => ({
  id,
  required,
  type,
  text: id,
  category: 'appeal',
});

describe('concept response validation', () => {
  it('keeps an untouched scale unanswered instead of treating it as the midpoint', () => {
    const scale = question('appeal', true, 'scale');
    expect(findUnansweredRequiredConceptQuestions([scale], {})).toEqual([scale]);
    expect(findUnansweredRequiredConceptQuestions([scale], { appeal: 5 })).toEqual([]);
  });

  it('rejects blank required text and empty required selections', () => {
    const text = question('comment', true, 'open_text');
    const choices = question('choice', true, 'multiple_choice');
    expect(findUnansweredRequiredConceptQuestions(
      [text, choices],
      { comment: '   ', choice: [] },
    )).toEqual([text, choices]);
  });
});
