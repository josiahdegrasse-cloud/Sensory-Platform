import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    rpc: dbMocks.rpc,
  },
}));

import {
  claimPanelistKit,
  fetchPanelistKitInvite,
  fetchPanelistKitInviteByManualCode,
  fetchPanelistKits,
  generatePanelistKits,
  reportPanelistKitIssue,
  updatePanelistKitFulfillment,
} from './panelist-kits';

describe('panelist kit data access', () => {
  beforeEach(() => {
    dbMocks.rpc.mockReset();
  });

  it('maps generated kit rows and preserves the one-time token', async () => {
    dbMocks.rpc.mockResolvedValue({
      data: [{
        id: 'kit-1',
        token: 'secret-token',
        kit_code: 'KIT-001',
        manual_code: 'NFI-8F2K1A3B',
        sample_code: '123',
        product_id: 'product-1',
        assigned_product_ids: ['product-1', 'product-2'],
        status: 'generated',
        expires_at: null,
        response_deadline: '2026-07-01',
        handling_instructions: 'Keep chilled.',
        recipient_name: 'Avery Panelist',
        recipient_email: 'avery@example.com',
        recipient_address: '12 Market Street\nLeeds LS1 1AA',
        claimed_by: 'panelist-1',
        created_at: '2026-06-28T12:00:00.000Z',
      }],
      error: null,
    });

    await expect(generatePanelistKits({
      productId: 'product-1',
      kitCount: 1,
      responseDeadline: '2026-07-01',
      handlingInstructions: 'Keep chilled.',
      recipients: [{ name: 'Avery Panelist', email: 'avery@example.com', address: '12 Market Street\nLeeds LS1 1AA' }],
      assignedProductIds: ['product-1', 'product-2'],
      panelistIds: ['panelist-1'],
    })).resolves.toEqual([expect.objectContaining({
      id: 'kit-1',
      token: 'secret-token',
      kitCode: 'KIT-001',
      manualCode: 'NFI-8F2K1A3B',
      sampleCode: '123',
      assignedProductIds: ['product-1', 'product-2'],
      responseDeadline: '2026-07-01',
      handlingInstructions: 'Keep chilled.',
      recipientName: 'Avery Panelist',
      recipientEmail: 'avery@example.com',
      recipientAddress: '12 Market Street\nLeeds LS1 1AA',
      assignedPanelistId: 'panelist-1',
    })]);

    expect(dbMocks.rpc).toHaveBeenCalledWith('generate_panelist_kits', expect.objectContaining({
      target_product_id: 'product-1',
      kit_count: 1,
      p_recipients: [{ name: 'Avery Panelist', email: 'avery@example.com', address: '12 Market Street\nLeeds LS1 1AA' }],
      p_assigned_product_ids: ['product-1', 'product-2'],
      p_panelist_ids: ['panelist-1'],
    }));
  });

  it('returns an empty kit list when the migration is not applied yet', async () => {
    dbMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Could not find the function list_panelist_kits in the schema cache' },
    });

    await expect(fetchPanelistKits('product-1')).resolves.toEqual([]);
  });

  it('retries the legacy generate function for one-task boxes when the box-pass RPC signature is not cached', async () => {
    dbMocks.rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Could not find the function public.generate_panelist_kits(kit_count, p_assigned_product_ids, p_expires_at, p_handling_instructions, p_recipients, p_response_deadline, target_product_id) in the schema cache',
        },
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'kit-1',
          token: 'secret-token',
          kit_code: 'KIT-001',
          manual_code: 'NFI-8F2K1A3B',
          sample_code: '123',
          product_id: 'product-1',
          status: 'generated',
          expires_at: null,
          response_deadline: null,
          handling_instructions: '',
          recipient_name: 'Avery Panelist',
          recipient_email: null,
          created_at: '2026-06-28T12:00:00.000Z',
        }],
        error: null,
      });

    await expect(generatePanelistKits({
      productId: 'product-1',
      kitCount: 1,
      assignedProductIds: ['product-1'],
    })).resolves.toEqual([expect.objectContaining({
      kitCode: 'KIT-001',
      assignedProductIds: ['product-1'],
    })]);

    expect(dbMocks.rpc).toHaveBeenNthCalledWith(1, 'generate_panelist_kits', expect.objectContaining({
      p_assigned_product_ids: ['product-1'],
    }));
    expect(dbMocks.rpc).toHaveBeenNthCalledWith(2, 'generate_panelist_kits', expect.not.objectContaining({
      p_assigned_product_ids: expect.anything(),
    }));
  });

  it('explains that the box-pass migration is required when assigning multiple tasks', async () => {
    dbMocks.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Could not find the function public.generate_panelist_kits(kit_count, p_assigned_product_ids, p_expires_at, p_handling_instructions, p_recipients, p_response_deadline, target_product_id) in the schema cache',
      },
    });

    await expect(generatePanelistKits({
      productId: 'product-1',
      kitCount: 1,
      assignedProductIds: ['product-1', 'product-2'],
    })).rejects.toThrow(/box-pass migration/i);
  });

  it('maps admin kit rows with fielding metadata', async () => {
    dbMocks.rpc.mockResolvedValue({
      data: [{
        id: 'kit-1',
        kit_code: 'KIT-001',
        manual_code: 'NFI-8F2K1A3B',
        sample_code: '123',
        product_id: 'product-1',
        assigned_product_ids: ['product-1', 'product-2'],
        assigned_product_count: 2,
        completed_product_count: '1',
        product_name: 'Cheddar trial',
        calculated_status: 'shipped',
        stored_status: 'shipped',
        expires_at: null,
        response_deadline: '2026-07-01',
        handling_instructions: 'Keep chilled.',
        recipient_name: 'Avery Panelist',
        recipient_email: 'avery@example.com',
        recipient_address: '12 Market Street\nLeeds LS1 1AA',
        printed_at: '2026-06-28T12:00:00.000Z',
        packed_at: '2026-06-28T13:00:00.000Z',
        shipped_at: '2026-06-28T14:00:00.000Z',
        tracking_number: 'TRACK-1',
        issue_type: 'damaged',
        issue_note: 'Box crushed.',
        issue_status: 'open',
        issue_reported_at: '2026-06-29T12:00:00.000Z',
        voided_at: null,
        void_reason: null,
        replacement_for_kit_id: null,
        claimed_by: 'user-1',
        claimed_panelist_name: 'Avery Panelist',
        claimed_at: '2026-06-29T13:00:00.000Z',
        started_at: null,
        submitted_at: null,
        reminder_count: '2',
        created_at: '2026-06-28T12:00:00.000Z',
      }],
      error: null,
    });

    await expect(fetchPanelistKits('product-1')).resolves.toEqual([expect.objectContaining({
      kitCode: 'KIT-001',
      manualCode: 'NFI-8F2K1A3B',
      calculatedStatus: 'shipped',
      assignedProductCount: 2,
      completedProductCount: 1,
      trackingNumber: 'TRACK-1',
      issueStatus: 'open',
      reminderCount: 2,
      recipientAddress: '12 Market Street\nLeeds LS1 1AA',
    })]);
  });

  it('maps a public invite token lookup', async () => {
    dbMocks.rpc.mockResolvedValue({
      data: [{
        org_id: 'org-1',
        assigned_product_count: 2,
        product_name: 'Cheddar trial',
        product_category: 'Cheese',
        is_multi_sample: false,
        sample_code: '123',
        kit_code: 'KIT-001',
        calculated_status: 'claimed',
        expires_at: null,
        response_deadline: null,
        handling_instructions: '',
        issue_type: 'damaged',
        issue_status: 'open',
        claimed_by_current_user: true,
      }],
      error: null,
    });

    await expect(fetchPanelistKitInvite('token')).resolves.toEqual(expect.objectContaining({
      orgId: 'org-1',
      productName: 'Cheddar trial',
      kitCode: 'KIT-001',
      manualCode: null,
      assignedProductIds: [],
      assignedProductCount: 2,
      calculatedStatus: 'claimed',
      issueNote: null,
      claimedBy: null,
      claimedByCurrentUser: true,
    }));
  });

  it('looks up and claims kits by manual code', async () => {
    dbMocks.rpc
      .mockResolvedValueOnce({
        data: [{
          org_id: 'org-1',
          assigned_product_count: 2,
          product_name: 'Cheddar trial',
          product_category: 'Cheese',
          is_multi_sample: false,
          sample_code: '123',
          kit_code: 'KIT-001',
          calculated_status: 'generated',
          expires_at: null,
          response_deadline: null,
          handling_instructions: '',
          issue_type: null,
          issue_status: 'none',
          claimed_by_current_user: false,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'kit-1',
          org_id: 'org-1',
          product_id: 'product-1',
          assigned_product_ids: ['product-1', 'product-2'],
          assigned_product_count: 2,
          product_name: 'Cheddar trial',
          product_category: 'Cheese',
          is_multi_sample: false,
          sample_code: '123',
          kit_code: 'KIT-001',
          manual_code: 'NFI-8F2K1A3B',
          calculated_status: 'claimed',
          expires_at: null,
          response_deadline: null,
          handling_instructions: '',
          issue_type: null,
          issue_status: 'none',
          claimed_by_current_user: true,
        }],
        error: null,
      });

    await expect(fetchPanelistKitInviteByManualCode('NFI-8F2K1A3B')).resolves.toEqual(expect.objectContaining({
      manualCode: null,
      assignedProductIds: [],
      claimedByCurrentUser: false,
    }));
    expect(dbMocks.rpc).toHaveBeenCalledWith('get_panelist_kit_by_manual_code', { p_manual_code: 'NFI-8F2K1A3B' });

    await expect(claimPanelistKit({ manualCode: 'NFI-8F2K1A3B' })).resolves.toEqual(expect.objectContaining({
      manualCode: 'NFI-8F2K1A3B',
      assignedProductIds: ['product-1', 'product-2'],
      claimedByCurrentUser: true,
    }));
    expect(dbMocks.rpc).toHaveBeenCalledWith('claim_panelist_kit', {
      p_token: null,
      p_manual_code: 'NFI-8F2K1A3B',
    });
  });

  it('sends fielding operation RPC arguments', async () => {
    dbMocks.rpc.mockResolvedValue({ data: null, error: null });

    await updatePanelistKitFulfillment({ kitId: 'kit-1', status: 'shipped', trackingNumber: 'TRACK-1' });
    expect(dbMocks.rpc).toHaveBeenCalledWith('update_panelist_kit_fulfillment', {
      target_kit_id: 'kit-1',
      p_status: 'shipped',
      p_tracking_number: 'TRACK-1',
    });

    await reportPanelistKitIssue({
      manualCode: 'NFI-8F2K1A3B',
      issueType: 'damaged',
      issueNote: 'Box crushed.',
    });
    expect(dbMocks.rpc).toHaveBeenCalledWith('report_panelist_kit_issue', {
      p_token: null,
      p_manual_code: 'NFI-8F2K1A3B',
      p_issue_type: 'damaged',
      p_issue_note: 'Box crushed.',
    });
  });
});
