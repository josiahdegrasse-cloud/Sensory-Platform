import { describe, expect, it } from 'vitest';
import {
  filterAssignablePanelists,
  getAssignmentSummary,
  getConceptTestAssignmentMode,
  getProductAssignmentMode,
  isPanelistAssignedToConceptTest,
  isPanelistAssignedToProduct,
} from './assignments';

const panelists = [
  { id: 'active-1', status: 'active' as const },
  { id: 'inactive-1', status: 'inactive' as const },
  { id: 'archived-1', status: 'archived' as const },
];

describe('assignment semantics', () => {
  it('maps empty product and concept assignments to unassigned', () => {
    expect(getProductAssignmentMode({ assignedPanelistIds: [] })).toBe('unassigned');
    expect(getConceptTestAssignmentMode({ assignedPanelistIds: [] })).toBe('unassigned');
  });

  it('preserves product and concept panelist visibility rules', () => {
    expect(isPanelistAssignedToProduct({ assignedPanelistIds: [] }, 'active-1')).toBe(false);
    expect(isPanelistAssignedToProduct({ assignedPanelistIds: ['active-1'] }, 'active-1')).toBe(true);
    expect(isPanelistAssignedToProduct({ assignedPanelistIds: ['active-1'] }, 'other')).toBe(false);
    expect(isPanelistAssignedToConceptTest({ assignedPanelistIds: [] }, 'active-1')).toBe(false);
    expect(isPanelistAssignedToConceptTest({ assignedPanelistIds: ['active-1'] }, 'active-1')).toBe(true);
  });

  it('filters inactive and archived panelists from new assignments', () => {
    expect(filterAssignablePanelists(panelists).map(panelist => panelist.id)).toEqual(['active-1']);
  });

  it('reports inactive legacy assignments without deleting them', () => {
    const summary = getAssignmentSummary(
      'product',
      { assignedPanelistIds: ['active-1', 'inactive-1'] },
      panelists,
    );

    expect(summary.mode).toBe('selected');
    expect(summary.activeAssignedIds).toEqual(['active-1']);
    expect(summary.inactiveAssignedIds).toEqual(['inactive-1']);
    expect(summary.ready).toBe(true);
  });

  it('requires at least one active selected panelist for access', () => {
    expect(getAssignmentSummary('product', { assignedPanelistIds: [] }, panelists).ready).toBe(false);
    expect(getAssignmentSummary('concept', { assignedPanelistIds: ['inactive-1'] }, panelists).ready).toBe(false);
    expect(getAssignmentSummary('product', { assignedPanelistIds: [] }, []).ready).toBe(false);
  });
});
