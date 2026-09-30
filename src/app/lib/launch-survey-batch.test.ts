import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../data/survey-domain';
import { launchSurveyBatch } from './launch-survey-batch';

const products: Product[] = ['A', 'B'].map(id => ({ id, name: id, category: 'Cheddar', status: 'draft', createdDate: '' }));
function setup() {
  return { products, sections: ['comments'] as const as ['comments'], panelistIds: ['panelist'], sentIds: new Set<string>(),
    update: vi.fn().mockResolvedValue(undefined), assign: vi.fn().mockResolvedValue(undefined), onActivated: vi.fn() };
}
describe('batch survey launch', () => {
  it('saves selected sections and assignments before activating any survey', async () => {
    const input = setup();
    await launchSurveyBatch(input);
    expect(input.update.mock.calls).toEqual([
      ['A', { surveySections: ['comments'] }], ['B', { surveySections: ['comments'] }],
      ['A', { status: 'active' }], ['B', { status: 'active' }],
    ]);
    expect(input.assign).toHaveBeenCalledWith(['A', 'B'], ['panelist']);
    expect(input.assign.mock.invocationCallOrder[0]).toBeGreaterThan(input.update.mock.invocationCallOrder[1]);
    expect(input.assign.mock.invocationCallOrder[0]).toBeLessThan(input.update.mock.invocationCallOrder[2]);
  });
  it('does not activate surveys if assignment fails', async () => {
    const input = setup();
    input.assign.mockRejectedValue(new Error('Eligibility changed'));
    await expect(launchSurveyBatch(input)).rejects.toThrow('Eligibility changed');
    expect(input.update.mock.calls.every(([, patch]) => !patch.status)).toBe(true);
    expect(input.sentIds.size).toBe(0);
  });
  it('retries only remaining drafts after a partial launch', async () => {
    const input = setup();
    input.update.mockImplementation(async (id, patch) => {
      if (id === 'B' && patch.status === 'active') throw new Error('Network failure');
    });
    await expect(launchSurveyBatch(input)).rejects.toThrow('Network failure');
    expect([...input.sentIds]).toEqual(['A']);
    input.update.mockReset().mockResolvedValue(undefined);
    input.assign.mockClear();
    await launchSurveyBatch(input);
    expect(input.update.mock.calls.map(([id]) => id)).toEqual(['B', 'B']);
    expect(input.assign).toHaveBeenCalledWith(['B'], ['panelist']);
    expect([...input.sentIds]).toEqual(['A', 'B']);
  });
  it('rejects empty sections and non-drafts before writing', async () => {
    const input = setup();
    await expect(launchSurveyBatch({ ...input, sections: [] })).rejects.toThrow('Choose surveys');
    await expect(launchSurveyBatch({ ...input, products: [{ ...products[0], status: 'active' }] })).rejects.toThrow('no longer a draft');
    expect(input.update).not.toHaveBeenCalled();
  });
});
