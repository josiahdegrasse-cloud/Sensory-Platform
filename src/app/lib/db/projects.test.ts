import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock('../supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

import { deleteProject } from './projects';

describe('project deletion', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.rpc.mockReset();
  });

  it('retires every import batch linked to a real project before deleting the project', async () => {
    const neq = vi.fn().mockResolvedValue({
      data: [{ id: 'batch-1' }, { id: 'batch-2' }],
      error: null,
    });
    const projectEq = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'import_batches') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ neq })) })) };
      }
      return { update: vi.fn(() => ({ eq: projectEq })) };
    });
    mocks.rpc.mockResolvedValue({ error: null });

    await deleteProject({ projectId: 'project-1', fallbackBatchId: 'batch-1' });

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'set_import_batch_status', {
      target_batch_id: 'batch-1',
      next_status: 'deleted',
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'set_import_batch_status', {
      target_batch_id: 'batch-2',
      next_status: 'deleted',
    });
    expect(projectEq).toHaveBeenCalledWith('id', 'project-1');
  });

  it('retires the backing import for a legacy project card', async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await deleteProject({ projectId: null, fallbackBatchId: 'legacy-batch' });

    expect(mocks.rpc).toHaveBeenCalledWith('set_import_batch_status', {
      target_batch_id: 'legacy-batch',
      next_status: 'deleted',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
