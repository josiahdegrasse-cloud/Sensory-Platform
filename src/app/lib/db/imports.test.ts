import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: dbMocks.from,
  },
}));

import { fetchImportBatches } from './imports';

function queryResult(result: { data: unknown[] | null; error: { message: string } | null }) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

describe('fetchImportBatches', () => {
  beforeEach(() => {
    dbMocks.from.mockReset();
  });

  it('keeps live projects visible when optional metadata joins fail', async () => {
    dbMocks.from
      .mockReturnValueOnce(queryResult({
        data: null,
        error: { message: 'Could not find a relationship for profiles in the schema cache' },
      }))
      .mockReturnValueOnce(queryResult({
        data: [{
          id: 'batch-1',
          file_name: 'cheese-prototypes.csv',
          row_count: 2,
          recognized_columns: ['sample_id'],
          ignored_columns: [],
          detection_confidence: 0.98,
          status: 'active',
          imported_by: 'admin-1',
          imported_at: '2026-06-12T12:00:00.000Z',
          food_types: { slug: 'cheese', label: 'Cheese' },
        }],
        error: null,
      }));

    await expect(fetchImportBatches()).resolves.toEqual([
      expect.objectContaining({
        id: 'batch-1',
        fileName: 'cheese-prototypes.csv',
        foodTypeSlug: 'cheese',
        status: 'active',
        sampleCount: 2,
      }),
    ]);
    expect(dbMocks.from).toHaveBeenCalledTimes(2);
  });
});
