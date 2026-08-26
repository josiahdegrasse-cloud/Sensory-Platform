import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: { from: mocks.from },
}));

import { insertResponseBatch } from './responses';

describe('insertResponseBatch', () => {
  beforeEach(() => mocks.from.mockReset());

  it('writes every sample in one atomic insert with consecutive run numbers', async () => {
    const insertedRows: Array<Record<string, unknown>> = [];
    const latestRunQuery = {
      eq: vi.fn(() => latestRunQuery),
      order: vi.fn(() => latestRunQuery),
      limit: vi.fn().mockResolvedValue({ data: [{ run_number: 3 }] }),
    };
    mocks.from
      .mockReturnValueOnce({ select: vi.fn(() => latestRunQuery) })
      .mockReturnValueOnce({
        insert: vi.fn((rows: Array<Record<string, unknown>>) => {
          insertedRows.push(...rows);
          return {
            select: vi.fn().mockResolvedValue({
              data: rows.map((row, index) => ({
                ...row,
                id: `response-${index + 1}`,
                created_at: '2026-08-19T10:00:00.000Z',
              })),
              error: null,
            }),
          };
        }),
      });

    const responses = ['101', '202', '303'].map(sampleCode => ({
      userId: 'panelist-1',
      productId: 'study-1',
      cataAttributes: ['Creamy'],
      intensityRatings: { Creamy: 6 },
      hedonicScores: { overall: 7 },
      emotionalProfile: {},
      sampleCode,
      sessionType: '3-sample-sequential',
    }));

    await expect(insertResponseBatch(responses)).resolves.toHaveLength(3);
    expect(insertedRows.map(row => row.run_number)).toEqual([4, 5, 6]);
    expect(new Set(insertedRows.map(row => row.response_session_id)).size).toBe(1);
    expect(insertedRows.map(row => row.sample_ordinal)).toEqual([1, 2, 3]);
    expect(insertedRows.map(row => row.sample_code)).toEqual(['101', '202', '303']);
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it('rejects mixed panelists or studies before writing', async () => {
    await expect(insertResponseBatch([
      {
        userId: 'panelist-1', productId: 'study-1', cataAttributes: [], intensityRatings: {}, hedonicScores: {}, emotionalProfile: {},
      },
      {
        userId: 'panelist-2', productId: 'study-1', cataAttributes: [], intensityRatings: {}, hedonicScores: {}, emotionalProfile: {},
      },
    ])).rejects.toThrow(/one panelist and one study/i);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
