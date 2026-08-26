import { describe, expect, it } from 'vitest';
import { clearPrivateQueryState, queryClient } from './query-client';

describe('private query cache isolation', () => {
  it('removes cached tenant data when the authenticated subject changes', async () => {
    queryClient.setQueryData(['products'], [{ id: 'tenant-a-product' }]);
    queryClient.setQueryData(['allResponses'], [{ id: 'tenant-a-response' }]);

    await clearPrivateQueryState();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
