import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  fetchWorkspaceSettings: vi.fn(),
  fetchInstrumentalDataset: vi.fn(),
  fetchProducts: vi.fn(),
  fetchAllResponses: vi.fn(),
}));

vi.mock('./database', () => ({
  fetchWorkspaceSettings: dbMocks.fetchWorkspaceSettings,
  fetchInstrumentalDataset: dbMocks.fetchInstrumentalDataset,
  fetchProducts: dbMocks.fetchProducts,
  fetchAllResponses: dbMocks.fetchAllResponses,
}));

import { buildEvidenceBundle } from './report-evidence-source';

beforeEach(() => {
  dbMocks.fetchWorkspaceSettings.mockResolvedValue({
    decisionGoThreshold: 75,
    decisionStopThreshold: 45,
    decisionMinResponses: 12,
  });
  dbMocks.fetchInstrumentalDataset.mockResolvedValue({ eTongueData: [], gcmsData: {}, compositionData: {} });
  dbMocks.fetchProducts.mockResolvedValue([]);
  dbMocks.fetchAllResponses.mockResolvedValue([]);
});

describe('buildEvidenceBundle', () => {
  it('builds a deterministic bundle from a reference sample profile', async () => {
    const bundle = await buildEvidenceBundle('S4', 'tester');
    expect(bundle.projectId).toBe('S4');
    expect(bundle.schemaVersion).toBe('evidence-bundle.v1');
    expect(bundle.sampleSummaries.length).toBe(1);
    // Deterministic source-data version is stable across builds of the same data.
    const again = await buildEvidenceBundle('S4', 'tester');
    expect(again.sourceDataVersion).toBe(bundle.sourceDataVersion);
  });

  it('returns INSUFFICIENT_DATA when no profile exists for the project key', async () => {
    const bundle = await buildEvidenceBundle('does-not-exist', 'tester');
    expect(bundle.deterministicCandidateDecision).toBe('INSUFFICIENT_DATA');
    expect(bundle.missingData.some(issue => issue.severity === 'critical')).toBe(true);
  });
});
