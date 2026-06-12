import { describe, expect, it } from 'vitest';
import type { Question } from './types';
import {
  estimateQuestionSeconds,
  estimateSurveySeconds,
  formatSurveyDuration,
  selectBalancedQuestions,
} from './survey-utils';

const question = (
  id: string,
  category: Question['category'],
  required = false,
  type: Question['type'] = 'scale',
): Question => ({
  id,
  category,
  required,
  type,
  text: id,
  options: type === 'multiple_choice' ? ['A', 'B', 'C'] : undefined,
});

describe('selectBalancedQuestions', () => {
  it('keeps all relevant categories represented within category targets', () => {
    const tailored = [
      question('appeal-required', 'appeal', true),
      question('purchase-required', 'purchase', true),
      question('price', 'price'),
      question('usage', 'usage'),
      question('attributes', 'attributes'),
      question('demographics', 'demographics'),
    ];
    const templates = Array.from({ length: 10 }, (_, index) =>
      question(`attribute-${index}`, 'attributes', index < 2),
    );

    const result = selectBalancedQuestions(tailored, templates);
    const categories = new Set(result.map(item => item.category));

    expect(categories).toEqual(new Set([
      'appeal', 'purchase', 'price', 'usage', 'attributes', 'demographics',
    ]));
    expect(result.filter(item => item.category === 'attributes')).toHaveLength(5);
    expect(result[0].id).toBe('appeal-required');
  });

  it('prioritizes required questions within each category', () => {
    const templates = [
      question('optional-1', 'appeal'),
      question('optional-2', 'appeal'),
      question('optional-3', 'appeal'),
      question('optional-4', 'appeal'),
      question('required', 'appeal', true),
    ];

    expect(selectBalancedQuestions([], templates).map(item => item.id)).toContain('required');
  });
});

describe('survey duration helpers', () => {
  it('estimates time from question type and option count', () => {
    const multipleChoice = question('choice', 'purchase', true, 'multiple_choice');
    expect(estimateQuestionSeconds(multipleChoice)).toBe(28);
    expect(estimateSurveySeconds([
      question('scale', 'appeal', true),
      multipleChoice,
      question('open', 'attributes', false, 'open_text'),
    ])).toBe(118);
  });

  it('formats completion time as a clear range', () => {
    expect(formatSurveyDuration(0)).toBe('Not available');
    expect(formatSurveyDuration(45)).toBe('Less than 1 minute');
    expect(formatSurveyDuration(600)).toBe('About 8-12 minutes');
  });
});
