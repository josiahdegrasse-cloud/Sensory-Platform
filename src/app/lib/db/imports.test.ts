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

import { createSurveysForImportBatch, fetchImportBatches, fetchInstrumentalDataset, insertInstrumentalImport, updateIngredientStatement } from './imports';

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

  it('returns generic measurement formulations without fake e-tongue values', async () => {
    dbMocks.from.mockImplementation((table: string) => {
      if (table === 'instrumental_samples') {
        const query = {
          eq: vi.fn(() => query),
          order: vi.fn().mockResolvedValue({
            data: [{
              id: 'sample-row-1', sample_id: 'Cheddar ref', sample_name: 'Cheddar ref', category: 'Cheese',
              ingredient_statement: null, ingredient_statement_source: 'csv_import', ingredient_statement_updated_at: null,
              food_types: { slug: 'cheese', status: 'active' }, import_batches: { id: 'batch-1', status: 'active' },
              e_tongue_measurements: [], gcms_compounds: [], composition_profiles: [],
              instrumental_measurement_profiles: [{
                metrics: [{ key: 'fat', label: 'Fat', unit: '%', mean: 25.892, observationCount: 15 }],
              }],
            }],
            error: null,
          }),
        };
        return { select: vi.fn(() => query) };
      }
      if (table === 'formulation_versions') {
        return { select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(fetchInstrumentalDataset()).resolves.toMatchObject({
      eTongueData: [{
        sampleId: 'Cheddar ref',
        hasETongueData: false,
        measurements: [{ key: 'fat', label: 'Fat', unit: '%', mean: 25.892, observationCount: 15 }],
      }],
    });
  });

  it('keeps imports data-only until an administrator sends surveys', async () => {
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
      if (table === 'formulation_versions') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await insertInstrumentalImport({
      fileName: 'aroma-samples.csv',
      rowCount: 2,
      recognizedColumns: ['sampleId', 'compound'],
      ignoredColumns: [],
      detection: { slug: 'cheese', label: 'Cheese', confidence: 0.9, evidence: [], aliases: [], modifiers: [] },
      eTongueData: [],
      gcmsData: {
        A1: [{ name: 'Diacetyl', concentration: 2, aroma: 'buttery', threshold: 1 }],
      },
      compositionData: {
        A2: { protein: 3, fat: 12, moisture: 45, pH: 6.2, saltContent: 1.1, calciumMg: 40 },
      },
      ingredientStatements: {
        A1: { text: 'Water, cashew, cultures, salt', source: 'csv_import', updatedAt: null },
      },
    });

    expect(dbMocks.rpc).toHaveBeenCalledWith('set_formulation_profile', expect.objectContaining({
      target_import_batch_id: 'batch-1',
      target_sample_id: 'A1',
      target_statement: 'Water, cashew, cultures, salt',
      target_source: 'csv_import',
      target_ingredients: expect.arrayContaining([
        expect.objectContaining({ suppliedName: 'Water', position: 1 }),
      ]),
    }));

    expect(insertedRows).toEqual([]);
  });

  it('creates unassigned private drafts before exact-sample allergen verification', async () => {
    const insertedRows: Array<Record<string, unknown>> = [];
    dbMocks.from.mockImplementation((table: string) => {
      if (table === 'import_batches') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'batch-1', project_id: 'project-1', food_types: { label: 'Chocolate' } },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === 'instrumental_samples') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { sample_id: 'CHOC-1', sample_name: 'Dark control', category: 'Dark chocolate', project_id: 'project-1' },
                { sample_id: 'CHOC-2', sample_name: 'Oat prototype', category: 'Milk-style chocolate', project_id: 'project-1' },
              ],
              error: null,
            }),
          })),
        };
      }
      if (table === 'products') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          insert: vi.fn((rows: Array<Record<string, unknown>>) => {
            insertedRows.push(...rows);
            return {
              select: vi.fn().mockResolvedValue({
                data: rows.map((row, index) => ({ id: `survey-${index + 1}`, name: row.name })),
                error: null,
              }),
            };
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(createSurveysForImportBatch({
      batchId: 'batch-1',
      surveySections: ['cata', 'hedonic', 'comments'],
      customAttributes: ['Cocoa', 'Roasted', 'Bitter'],
    })).resolves.toEqual({
      createdCount: 2,
      surveyIds: ['survey-1', 'survey-2'],
      surveyNames: ['Dark control', 'Oat prototype'],
    });

    expect(insertedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Dark control',
        status: 'draft',
        survey_sections: ['cata', 'hedonic', 'comments'],
        assigned_panelist_ids: [],
        source_import_batch_id: 'batch-1',
        source_sample_id: 'CHOC-1',
        project_id: 'project-1',
      }),
    ]));
  });

  it('saves a manual ingredient statement without normalizing its internal wording or order', async () => {
    dbMocks.rpc.mockResolvedValue({ data: 'formulation-version-1', error: null });
    dbMocks.from.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    await updateIngredientStatement({
      importBatchId: 'batch-1',
      sampleId: 'A1',
      statement: '  Water, Pea Protein (12%), Salt; Cultures  ',
    });

    expect(dbMocks.rpc).toHaveBeenCalledWith('set_formulation_profile', expect.objectContaining({
      target_statement: 'Water, Pea Protein (12%), Salt; Cultures',
      target_source: 'manual',
      target_ingredients: expect.arrayContaining([
        expect.objectContaining({ suppliedName: 'Pea Protein (12%)', percentage: 12 }),
      ]),
    }));
  });
});
