import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { buildEvidenceBundleFromProfiles } from './report-evidence';
import { interpretEvidenceBundle, validateClaims } from './report-decision-interpreter';

const baseInput = {
  foodTypeSlug: 'cheese',
  createdBy: 'test-user',
  generatedAt: '2026-06-16T12:00:00.000Z',
  thresholds: { go: 75, stop: 45 },
};

function bundleFor(sampleId: string) {
  const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === sampleId)!;
  return buildEvidenceBundleFromProfiles({ ...baseInput, projectId: sampleId, profiles: [profile] });
}

describe('interpretEvidenceBundle', () => {
  it('produces claims whose evidence ids all exist in the bundle', () => {
    const bundle = bundleFor('S4');
    const interpretation = interpretEvidenceBundle(bundle);
    expect(interpretation.claims.length).toBeGreaterThan(0);
    const result = validateClaims(bundle, interpretation.claims);
    expect(result.valid).toBe(true);
    expect(result.unknownEvidenceIds).toEqual([]);
  });

  it('marks a failing sample as cautionary and surfaces limitation claims', () => {
    const bundle = bundleFor('S3'); // S3 triggers a STOP/critical gate per the evidence test
    const interpretation = interpretEvidenceBundle(bundle);
    expect(interpretation.candidateDecision).toBe('STOP');
    expect(interpretation.claims.some(claim => claim.section === 'claimCaution')).toBe(true);
    expect(interpretation.claims.some(claim => claim.polarity === 'cautionary')).toBe(true);
  });

  it('flags claims that cite unknown evidence ids', () => {
    const bundle = bundleFor('S4');
    const tampered = [{ id: 'x', section: 'executiveSummary' as const, statement: 's', evidenceIds: ['does.not.exist'], polarity: 'supporting' as const }];
    const result = validateClaims(bundle, tampered);
    expect(result.valid).toBe(false);
    expect(result.unknownEvidenceIds).toContain('does.not.exist');
  });

  it('reports INSUFFICIENT_DATA with no profiles', () => {
    const bundle = buildEvidenceBundleFromProfiles({ ...baseInput, projectId: 'none', profiles: [] });
    const interpretation = interpretEvidenceBundle(bundle);
    expect(interpretation.candidateDecision).toBe('INSUFFICIENT_DATA');
    expect(interpretation.headline).toMatch(/insufficient/i);
  });
});
