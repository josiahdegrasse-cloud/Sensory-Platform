import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { buildEvidenceBundleFromProfiles } from './report-evidence';

const baseInput = {
  projectId: 'S4',
  foodTypeSlug: 'cheese',
  createdBy: 'test-user',
  generatedAt: '2026-06-16T12:00:00.000Z',
  thresholds: { go: 75, stop: 45 },
};

describe('Evidence Bundle builder', () => {
  it('creates stable evidence IDs and a deterministic source-data version', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S4')!;
    const first = buildEvidenceBundleFromProfiles({ ...baseInput, profiles: [sample] });
    const second = buildEvidenceBundleFromProfiles({ ...baseInput, profiles: [sample] });

    expect(first.sourceDataVersion).toBe(second.sourceDataVersion);
    expect(first.id).toBe(second.id);
    expect(first.evidence.map(item => item.id)).toEqual(second.evidence.map(item => item.id));
    expect(first.evidence.some(item => item.id === 'sample.s4.issf-score')).toBe(true);
  });

  it('carries the underlying sensory profile (descriptors + panel size + measures)', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S4')!;
    const bundle = buildEvidenceBundleFromProfiles({ ...baseInput, profiles: [sample] });
    expect(bundle.sensoryProfile).toBeTruthy();
    expect(bundle.sensoryProfile!.panelSize).toBe(14);
    expect(bundle.sensoryProfile!.descriptors[0].count).toBeGreaterThan(0);
    // CATA measures express real descriptor frequencies, e.g. "Cheese 13/14 (93%)".
    expect(bundle.sensoryProfile!.dimensionMeasures.cata.join(' ')).toMatch(/\d+\/14/);
    expect(bundle.sensoryProfile!.dimensionMeasures.hedonic.join(' ')).toMatch(/Overall/);
    expect(bundle.commercialProfile?.sampleId).toBe('S4');
    expect(bundle.commercialProfile?.evidenceStatus).toBe('reference_demo');
    expect(bundle.commercialProfile?.actionPlan).toHaveLength(5);
  });

  it('versions and registers arbitrary instrumental parameters as first-class evidence', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S4')!;
    const instrumentalParameters = [{
      id: 'instrumental.s4.hardness-g',
      sampleId: 'S4',
      sampleName: sample.sampleName,
      key: 'hardness-g',
      label: 'Hardness',
      family: 'texture_rheology' as const,
      source: 'imported_parameter' as const,
      unit: 'g',
      mean: 1240,
      observationCount: 4,
      standardDeviation: 84,
      minimum: 1110,
      maximum: 1360,
      replicateValues: [1110, 1220, 1270, 1360],
      metadata: {
        dataType: 'continuous' as const,
        scaleType: 'ratio' as const,
        zeroMeaningful: true,
        direction: 'lower' as const,
        expectedMinimum: 1000,
        expectedMaximum: 1300,
        source: 'declared' as const,
      },
      chartPreference: 'box' as const,
      status: 'within_expected_range' as const,
    }];
    const withParameter = buildEvidenceBundleFromProfiles({ ...baseInput, profiles: [sample], instrumentalParameters });
    const withoutParameter = buildEvidenceBundleFromProfiles({ ...baseInput, profiles: [sample] });

    expect(withParameter.schemaVersion).toBe('evidence-bundle.v2');
    expect(withParameter.sourceDataVersion).not.toBe(withoutParameter.sourceDataVersion);
    expect(withParameter.instrumentalParameters).toEqual(instrumentalParameters);
    expect(withParameter.evidence).toContainEqual(expect.objectContaining({
      id: 'instrumental.s4.hardness-g',
      sourceType: 'imported_parameter',
      value: 1240,
      unit: 'g',
    }));
  });

  it('surfaces critical gate failures as STOP evidence', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S3')!;
    const bundle = buildEvidenceBundleFromProfiles({ ...baseInput, projectId: 'S3', profiles: [sample] });

    expect(bundle.deterministicCandidateDecision).toBe('STOP');
    expect(bundle.deterministicConfidence).toBe('low');
    expect(bundle.criticalAttributeResults.some(result => result.status === 'fail')).toBe(true);
    expect(bundle.evidence.some(item => item.evidenceType === 'critical_attribute' && item.isCritical)).toBe(true);
  });

  it('does not invent a decision when required sample data is missing', () => {
    const bundle = buildEvidenceBundleFromProfiles({ ...baseInput, projectId: 'missing-sample', profiles: [] });

    expect(bundle.deterministicCandidateDecision).toBe('INSUFFICIENT_DATA');
    expect(bundle.missingData.some(issue => issue.severity === 'critical')).toBe(true);
    expect(bundle.evidence.some(item => item.evidenceType === 'missing_data')).toBe(true);
  });

  it('lowers confidence when important analytical data is absent', () => {
    const sample = {
      ...ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S4')!,
      gcmsOlfactometry: [],
    };
    const bundle = buildEvidenceBundleFromProfiles({ ...baseInput, profiles: [sample] });

    expect(bundle.missingData.some(issue => issue.id === 'missing.s4.gcms')).toBe(true);
    expect(bundle.deterministicConfidence).not.toBe('high');
  });

  it('normalizes displayed confidence weights to 100 percent', () => {
    const sample = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S2')!;
    const bundle = buildEvidenceBundleFromProfiles({ ...baseInput, projectId: 'S2', profiles: [sample] });
    const rows = bundle.sensoryProfile!.confidenceCalculation;

    expect(rows.reduce((sum, row) => sum + row.weightPct, 0)).toBeCloseTo(100, 8);
    rows.forEach(row => expect(row.contribution).toBeCloseTo(row.score * row.weightPct / 100, 8));
  });
});
