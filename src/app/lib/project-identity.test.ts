import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseBatchSelection,
  encodeBatchSelection,
  computeFallbackProjectName,
  resolveProjectIdentity,
} from './project-identity';

/**
 * Minimal fluent stub of the supabase query builder. Each table maps to a single
 * canned `{ data, error }` returned by both terminal methods (`maybeSingle` and
 * `limit`); a given test only exercises one terminal per table.
 */
function mockClient(responses: Record<string, { data: unknown; error: unknown }>): SupabaseClient {
  const make = (table: string) => {
    const resp = responses[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => Promise.resolve(resp),
      maybeSingle: () => Promise.resolve(resp),
    };
    return builder;
  };
  return { from: (t: string) => make(t) } as unknown as SupabaseClient;
}

describe('parseBatchSelection / encodeBatchSelection', () => {
  it('parses a batch: selection', () => {
    expect(parseBatchSelection('batch:abc-123')).toBe('abc-123');
  });
  it('returns null for non-batch / empty / null input', () => {
    expect(parseBatchSelection(null)).toBeNull();
    expect(parseBatchSelection(undefined)).toBeNull();
    expect(parseBatchSelection('cheese')).toBeNull();
    expect(parseBatchSelection('batch:')).toBeNull();
  });
  it('round-trips with encodeBatchSelection', () => {
    expect(parseBatchSelection(encodeBatchSelection('xyz'))).toBe('xyz');
  });
});

describe('computeFallbackProjectName', () => {
  it('uses the file name sans .csv', () => {
    expect(computeFallbackProjectName('Cheese June.csv', 'cheese')).toBe('Cheese June');
  });
  it('falls back to "{FoodType} Project" when no file name', () => {
    expect(computeFallbackProjectName('', 'cheese')).toBe('Cheese Project');
    expect(computeFallbackProjectName(null, 'bread')).toBe('Bread Project');
  });
});

describe('resolveProjectIdentity', () => {
  it('resolves a batch that belongs to a real project', async () => {
    const supabase = mockClient({
      import_batches: { data: { id: 'b1', project_id: 'p1', file_name: 'Cheese June', status: 'active', food_type_id: 'ft1', food_types: { slug: 'cheese' } }, error: null },
      projects: { data: { id: 'p1', name: 'Cheese — June 2026', status: 'active', food_type_id: 'ft1', food_types: { slug: 'cheese' } }, error: null },
    });
    const identity = await resolveProjectIdentity(supabase, { batchId: 'b1' });
    expect(identity.projectId).toBe('p1');
    expect(identity.projectName).toBe('Cheese — June 2026');
    expect(identity.activeBatchId).toBe('b1');
    expect(identity.foodTypeSlug).toBe('cheese');
    expect(identity.status).toBe('active');
  });

  it('returns an unassigned identity for a batch with no project (legacy/dead)', async () => {
    const supabase = mockClient({
      import_batches: { data: { id: 'b2', project_id: null, file_name: 'sample_plant_based_meat.csv', status: 'deleted', food_type_id: 'ft2', food_types: { slug: 'meat' } }, error: null },
    });
    const identity = await resolveProjectIdentity(supabase, { batchId: 'b2' });
    expect(identity.projectId).toBeNull();
    expect(identity.status).toBe('unassigned');
    expect(identity.projectName).toBe('sample_plant_based_meat');
    expect(identity.activeBatchId).toBe('b2');
    expect(identity.foodTypeSlug).toBe('meat');
  });

  it('resolves a directly-passed projectId and finds its most recent batch', async () => {
    const supabase = mockClient({
      projects: { data: { id: 'p1', name: 'Bread — June 2026', status: 'active', food_type_id: 'ft3', food_types: [{ slug: 'bread' }] }, error: null },
      import_batches: { data: [{ id: 'b9' }], error: null },
    });
    const identity = await resolveProjectIdentity(supabase, { projectId: 'p1' });
    expect(identity.projectId).toBe('p1');
    expect(identity.projectName).toBe('Bread — June 2026');
    expect(identity.activeBatchId).toBe('b9');
    expect(identity.foodTypeSlug).toBe('bread'); // array-embed form handled
  });

  it('returns a safe unassigned identity for an invalid/missing id', async () => {
    const supabase = mockClient({
      import_batches: { data: null, error: null },
      projects: { data: null, error: null },
    });
    const missingBatch = await resolveProjectIdentity(supabase, { batchId: 'nope' });
    expect(missingBatch.projectId).toBeNull();
    expect(missingBatch.status).toBe('unassigned');
    expect(missingBatch.activeBatchId).toBeNull();

    const nothing = await resolveProjectIdentity(supabase, {});
    expect(nothing.projectId).toBeNull();
    expect(nothing.status).toBe('unassigned');
    expect(nothing.projectName).toBe('No project selected');
  });
});
