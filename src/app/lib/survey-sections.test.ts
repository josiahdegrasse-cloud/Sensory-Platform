import { describe, expect, it } from 'vitest';
import { DEFAULT_SURVEY_SECTIONS, mergeSurveyAttributes, normalizeSurveySections, toggleSurveySection } from './survey-sections';

describe('survey section configuration', () => {
  it('keeps the established full questionnaire for legacy products', () => {
    expect(normalizeSurveySections(undefined)).toEqual(DEFAULT_SURVEY_SECTIONS);
  });

  it('adds CATA automatically when intensity is selected', () => {
    expect(toggleSurveySection(['hedonic'], 'intensity')).toEqual(['cata', 'intensity', 'hedonic']);
  });

  it('removes dependent intensity when CATA is removed', () => {
    expect(toggleSurveySection(['cata', 'intensity', 'hedonic'], 'cata')).toEqual(['hedonic']);
  });

  it('adds comma-separated custom attributes without case-insensitive duplicates', () => {
    expect(mergeSurveyAttributes(
      ['Cocoa'],
      'smoky, cocoa, Nutty\nCaramel',
      ['Cocoa', 'Nutty'],
    )).toEqual(['Cocoa', 'smoky', 'Nutty', 'Caramel']);
  });
});
