import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../supabase', () => ({
  supabase: { from: mocks.from },
}));

import { deleteConceptStudy } from './study-deletion';

describe('concept study deletion', () => {
  beforeEach(() => mocks.from.mockReset());

  it('deletes the selected concept study', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ delete: remove });

    await expect(deleteConceptStudy('study-1')).resolves.toBeUndefined();

    expect(mocks.from).toHaveBeenCalledWith('concept_tests');
    expect(eq).toHaveBeenCalledWith('id', 'study-1');
  });

  it('explains when a commercialization report protects the study', async () => {
    const eq = vi.fn().mockResolvedValue({
      error: { code: '23503', message: 'foreign key violation' },
    });
    mocks.from.mockReturnValue({ delete: vi.fn(() => ({ eq })) });

    await expect(deleteConceptStudy('study-1')).rejects.toThrow(/linked to a commercialization report/i);
  });
});
