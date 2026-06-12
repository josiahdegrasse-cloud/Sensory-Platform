export type AssignmentMode = 'open' | 'selected' | 'unassigned';
export type AssignableType = 'product' | 'concept';

export interface AssignablePanelist {
  id: string;
  status?: 'active' | 'inactive' | 'archived';
}

export interface AssignmentTarget {
  assignedPanelistIds?: string[];
}

export interface AssignmentSummary {
  mode: AssignmentMode;
  activeAssignedIds: string[];
  inactiveAssignedIds: string[];
  activePanelistCount: number;
  accessiblePanelistCount: number;
  ready: boolean;
  label: string;
}

export function getProductAssignmentMode(product: AssignmentTarget): AssignmentMode {
  return (product.assignedPanelistIds?.length ?? 0) > 0 ? 'selected' : 'open';
}

export function getConceptTestAssignmentMode(conceptTest: AssignmentTarget): AssignmentMode {
  return (conceptTest.assignedPanelistIds?.length ?? 0) > 0 ? 'selected' : 'unassigned';
}

export function filterAssignablePanelists<T extends AssignablePanelist>(panelists: T[]): T[] {
  return panelists.filter(panelist => panelist.status === undefined || panelist.status === 'active');
}

export function isPanelistAssignedToProduct(product: AssignmentTarget, panelistId: string): boolean {
  return getProductAssignmentMode(product) === 'open'
    || (product.assignedPanelistIds ?? []).includes(panelistId);
}

export function isPanelistAssignedToConceptTest(conceptTest: AssignmentTarget, panelistId: string): boolean {
  return getConceptTestAssignmentMode(conceptTest) === 'selected'
    && (conceptTest.assignedPanelistIds ?? []).includes(panelistId);
}

export function getAssignmentSummary(
  type: AssignableType,
  assignable: AssignmentTarget,
  panelists: AssignablePanelist[],
): AssignmentSummary {
  const activePanelists = filterAssignablePanelists(panelists);
  const activeIds = new Set(activePanelists.map(panelist => panelist.id));
  const assignedIds = assignable.assignedPanelistIds ?? [];
  const activeAssignedIds = assignedIds.filter(id => activeIds.has(id));
  const inactiveAssignedIds = assignedIds.filter(id => !activeIds.has(id));
  const mode = type === 'product'
    ? getProductAssignmentMode(assignable)
    : getConceptTestAssignmentMode(assignable);
  const accessiblePanelistCount = mode === 'open'
    ? activePanelists.length
    : activeAssignedIds.length;
  const ready = mode === 'open'
    ? activePanelists.length > 0
    : mode === 'selected' && activeAssignedIds.length > 0;

  return {
    mode,
    activeAssignedIds,
    inactiveAssignedIds,
    activePanelistCount: activePanelists.length,
    accessiblePanelistCount,
    ready,
    label: mode === 'open'
      ? `Open to all ${activePanelists.length} active panelist${activePanelists.length === 1 ? '' : 's'}`
      : mode === 'selected'
        ? `Assigned to ${activeAssignedIds.length} active panelist${activeAssignedIds.length === 1 ? '' : 's'}`
        : 'No panelists assigned',
  };
}
