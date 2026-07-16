import { describe, expect, it } from 'vitest';
import { buildProductEvidenceSummary } from './product-evidence';
import type { FormulationExperiment } from './database';

const strength = {
  level: 'Strong' as const,
  representative: true,
  note: 'Threshold reached.',
  factors: [],
};

describe('buildProductEvidenceSummary', () => {
  it('does not turn representative sensory evidence into market evidence', () => {
    const summary = buildProductEvidenceSummary({
      sampleName: 'Sample A',
      responseCount: 14,
      minimumResponses: 12,
      instrumentSources: 3,
      strength,
      keyStrength: 'Texture is strongest.',
      keyConcern: 'Flavour is weakest.',
      decision: null,
      formulationVersions: [],
      experiment: null,
    });

    expect(summary.state).toBe('ready_for_decision');
    expect(summary.doesNotSupport.join(' ')).toContain('Demand');
    expect(summary.headline).not.toContain('GO');
  });

  it('only exposes a completed experiment as reusable learning after approval', () => {
    const experiment = {
      id: 'experiment-1',
      name: 'Texture screen',
      lifecycle: 'complete',
      hypothesis: 'A stabiliser change may improve texture.',
      learningStatus: 'draft',
      learningSummary: 'Variant V1 improved texture under chilled conditions.',
      learningAppliesTo: ['Same chilled matrix'],
      learningLimitations: ['Not tested at ambient temperature'],
      arms: [],
      analysisSnapshot: null,
      winnerArmId: null,
    } as unknown as FormulationExperiment;

    const draft = buildProductEvidenceSummary({
      sampleName: 'Sample A',
      responseCount: 14,
      minimumResponses: 12,
      instrumentSources: 3,
      strength,
      keyStrength: 'Texture is strongest.',
      keyConcern: 'Flavour is weakest.',
      decision: null,
      formulationVersions: [],
      experiment,
    });
    expect(draft.state).toBe('capture_learning');

    const approved = buildProductEvidenceSummary({
      sampleName: 'Sample A',
      responseCount: 14,
      minimumResponses: 12,
      instrumentSources: 3,
      strength,
      keyStrength: 'Texture is strongest.',
      keyConcern: 'Flavour is weakest.',
      decision: null,
      formulationVersions: [],
      experiment: { ...experiment, learningStatus: 'approved' },
    });
    expect(approved.state).toBe('learning_approved');
  });
});
