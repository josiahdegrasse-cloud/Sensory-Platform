import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: dbMocks.from,
    rpc: dbMocks.rpc,
  },
}));

import { fetchImportBatches, insertInstrumentalImport } from './imports';

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
    dbMocks.rpc.mockReset();
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

  it('creates missing surveys from parsed CSV samples when saved samples are not returned', async () => {
    const insertedRows: unknown[] = [];
    dbMocks.rpc.mockResolvedValue({ data: 'batch-1', error: null });
    dbMocks.from.mockImplementation((table: string) => {
      if (table === 'workspace_settings') {
        return {
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { auto_create_surveys_from_imports: true, require_import_review: false },
              error: null,
            }),
          })),
        };
      }
      if (table === 'import_batches') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'batch-1', project_id: 'project-1' },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === 'products') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          insert: vi.fn(rows => {
            insertedRows.push(...rows);
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'instrumental_samples') {
        return {
          select: vi.fn((columns: string) => {
            if (columns.includes('import_batches')) {
              const query = {
                eq: vi.fn(() => query),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
              return query;
            }
            if (columns.includes('sample_name')) {
              return {
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }
            throw new Error(`Unexpected instrumental sample select ${columns}`);
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await insertInstrumentalImport({
      fileName: 'aroma-samples.csv',
      rowCount: 2,
      recognizedColumns: ['sampleId', 'compound'],
      ignoredColumns: [],
      detection: { slug: 'cheese', label: 'Cheese', confidence: 0.9, evidence: [], aliases: [] },
      eTongueData: [],
      gcmsData: {
        A1: [{ name: 'Diacetyl', concentration: 2, aroma: 'buttery', threshold: 1 }],
      },
      compositionData: {
        A2: { protein: 3, fat: 12, moisture: 45, pH: 6.2, saltContent: 1.1, calciumMg: 40 },
      },
    });

    expect(insertedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'A1',
        source_import_batch_id: 'batch-1',
        source_sample_id: 'A1',
        project_id: 'project-1',
        status: 'active',
      }),
      expect.objectContaining({
        name: 'A2',
        source_import_batch_id: 'batch-1',
        source_sample_id: 'A2',
        project_id: 'project-1',
        status: 'active',
      }),
    ]));
  });
});
