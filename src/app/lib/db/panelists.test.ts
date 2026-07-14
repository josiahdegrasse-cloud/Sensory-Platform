import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
    from: vi.fn(),
  },
}));

import { completePanelistProfile, invitePanelistAccount, panelistShippingAddress } from './panelists';

describe('panelist account workflow', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.invoke.mockReset();
  });

  it('formats a complete shipping address without blank lines', () => {
    expect(panelistShippingAddress({
      addressLine1: '12 Market Street',
      addressLine2: null,
      city: 'Leeds',
      region: 'West Yorkshire',
      postalCode: 'LS1 1AA',
      country: 'United Kingdom',
    })).toBe('12 Market Street\nLeeds, West Yorkshire\nLS1 1AA\nUnited Kingdom');
  });

  it('sends only the invited email and profile route to the invitation function', async () => {
    mocks.invoke.mockResolvedValue({ data: { invited: true }, error: null });
    await invitePanelistAccount(' Panelist@Example.com ', 'https://sensory.example/panelist/profile');
    expect(mocks.invoke).toHaveBeenCalledWith('invite-panelist', {
      body: {
        email: 'panelist@example.com',
        redirectTo: 'https://sensory.example/panelist/profile',
      },
    });
  });

  it('writes shipping details through the constrained profile RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await completePanelistProfile({
      name: 'Avery Johnson',
      phone: '+44 7700 900123',
      addressLine1: '12 Market Street',
      city: 'Leeds',
      postalCode: 'LS1 1AA',
      country: 'United Kingdom',
      consentVersion: 'v1',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('complete_panelist_profile', expect.objectContaining({
      p_name: 'Avery Johnson',
      p_phone: '+44 7700 900123',
      p_address_line_1: '12 Market Street',
      p_postal_code: 'LS1 1AA',
      p_country: 'United Kingdom',
      p_consent_version: 'v1',
    }));
  });
});
