import { describe, expect, it } from 'vitest';
import { buildSyntheticConceptResponses, isSyntheticConceptResponse } from './concept-response-preview';

const concept = {
  id: 'concept-1',
  imageUrls: ['https://example.com/one.png', 'https://example.com/two.png', 'https://example.com/three.png'],
  questions: [
    { id: 'appeal', text: 'Overall appeal', type: 'scale' as const, required: true, category: 'appeal' },
    { id: 'benefits', text: 'Select all benefits', type: 'multiple_choice' as const, options: ['Clear', 'Premium', 'Natural'], required: true, category: 'attributes' },
    { id: 'rank', text: 'Rank the messages', type: 'ranking' as const, options: ['Taste', 'Price', 'Nutrition'], required: true, category: 'attributes' },
    { id: 'image', text: 'Pick the best visual', type: 'image_choice' as const, required: true, category: 'appeal' },
    { id: 'comment', text: 'What stands out?', type: 'open_text' as const, required: false, category: 'appeal' },
  ],
};

describe('synthetic concept responses', () => {
  it('creates a report-ready response set covering every concept question type', () => {
    const responses = buildSyntheticConceptResponses(concept);

    expect(responses).toHaveLength(36);
    expect(responses.every(isSyntheticConceptResponse)).toBe(true);
    expect(responses.every(response => Object.keys(response.answers).length === concept.questions.length)).toBe(true);
    expect(responses.every(response => concept.imageUrls.includes(String(response.answers.image)))).toBe(true);
    expect(responses[0].answers.benefits).toBeInstanceOf(Array);
    expect(responses[0].answers.rank).toHaveLength(3);
    expect(responses[0].answers.comment).toMatch(/visual|pack|design|concept/i);
  });

  it('creates a clear but non-unanimous leading concept image', () => {
    const responses = buildSyntheticConceptResponses(concept);
    const counts = responses.reduce<Record<string, number>>((totals, response) => {
      const image = String(response.answers.image);
      totals[image] = (totals[image] ?? 0) + 1;
      return totals;
    }, {});

    expect(counts[concept.imageUrls[0]]).toBeGreaterThan(counts[concept.imageUrls[1]]);
    expect(counts[concept.imageUrls[1]]).toBeGreaterThan(0);
    expect(counts[concept.imageUrls[2]]).toBeGreaterThan(0);
  });

  it('is deterministic so repeated report tests receive identical evidence', () => {
    expect(buildSyntheticConceptResponses(concept)).toEqual(buildSyntheticConceptResponses(concept));
  });
});
