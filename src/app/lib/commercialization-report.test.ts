import { describe, expect, it } from 'vitest';
import { summarizeConceptResponses } from './commercialization-report';

describe('commercialization report evidence', () => {
  it('summarizes scale, selection, purchase, and comment answers', () => {
    const questions = [
      { id: 'appeal', text: 'Overall appeal', type: 'scale', required: true, category: 'appeal' },
      { id: 'purchase', text: 'Purchase intent', type: 'scale', required: true, category: 'purchase' },
      { id: 'attrs', text: 'Select all', type: 'multiple_choice', required: true, category: 'attributes' },
      { id: 'comment', text: 'Why?', type: 'open_text', required: false, category: 'appeal' },
    ] as const;
    const responses = [
      { id: '1', userId: 'u1', conceptTestId: 'c1', createdAt: '', answers: { appeal: 8, purchase: 7, attrs: ['Premium', 'Fresh'], comment: 'Looks credible' } },
      { id: '2', userId: 'u2', conceptTestId: 'c1', createdAt: '', answers: { appeal: 6, purchase: 5, attrs: ['Premium'], comment: 'Clear flavor cue' } },
    ];
    const result = summarizeConceptResponses([...questions], responses);
    expect(result.responseCount).toBe(2);
    expect(result.scaleMetrics[0].average).toBe(7);
    expect(result.topSelections[0]).toMatchObject({ option: 'Premium', count: 2, percentage: 100 });
    expect(result.purchaseIntent).toBe(6);
    expect(result.comments).toHaveLength(2);
  });
});
