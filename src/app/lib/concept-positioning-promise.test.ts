import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import {
  buildEvidencePositioningPromise,
  buildInstrumentEvidenceSummary,
  buildPanelEvidenceSummary,
  topSuccessfulPanelSignals,
} from './concept-positioning-promise';

describe('buildEvidencePositioningPromise', () => {
  it('builds a detailed evidence-led positioning promise', () => {
    const promise = buildEvidencePositioningPromise({
      category: 'Plant-based cheese',
      sourceSampleName: 'Sample A',
      sensoryStrengths: ['creamy', 'buttery', 'melt 8.2/9'],
      panelEvidence: ['Butter CATA 11/14', 'Smooth intensity 7.2/10', 'hedonic overall 6.2/9'],
      instrumentEvidence: ['e-tongue Richness 5.2/10, Saltiness 4.2/10', 'GC-MS/O Diacetyl (buttery, GC-O 2.8/5, 3.2 ppm)'],
      issfScore: 84.2,
      confidence: 91,
      decisionRationale: 'Strong GO because panel liking and texture both cleared thresholds.',
      watchouts: ['Texture: protect melt during scale-up'],
    });

    expect(promise).toContain('Sample A');
    expect(promise).toContain('creamy, buttery, melt 8.2/9');
    expect(promise).toContain('Panel evidence behind the direction');
    expect(promise).toContain('Butter CATA 11/14');
    expect(promise).toContain('Instrument evidence to preserve');
    expect(promise).toContain('GC-MS/O Diacetyl');
    expect(promise).toContain('ISSF 84/100 at 91% confidence');
    expect(promise).toContain('Decision rationale');
    expect(promise).toContain('internal watch-outs');
    expect(promise).not.toContain('undefined');
  });

  it('uses useful fallback language when evidence details are thin', () => {
    const promise = buildEvidencePositioningPromise({
      category: 'Snack',
      sourceSampleName: '',
      sensoryStrengths: [],
    });

    expect(promise).toContain('the validated sample');
    expect(promise).toContain('the strongest snack sensory cues');
    expect(promise).toContain('unsupported claims');
  });

  it('extracts specific panel and instrument evidence from the successful source profile', () => {
    const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S4');
    expect(profile).toBeDefined();

    const strengths = topSuccessfulPanelSignals(profile!, 'cheese');
    const panelEvidence = buildPanelEvidenceSummary(profile!, 'cheese');
    const instrumentEvidence = buildInstrumentEvidenceSummary(profile!);

    expect(strengths).toEqual(['Cheese', 'Butter']);
    expect(panelEvidence).toContain('Cheese CATA 13/14');
    expect(panelEvidence).toContain('Butter CATA 12/14');
    expect(panelEvidence).toContain('Smooth intensity 8.6/10');
    expect(panelEvidence).toContain('emotion balance positive 4.4/5 vs negative 0.8/5');
    expect(instrumentEvidence).toContain('e-tongue Richness 5.4/10, Saltiness 4.1/10, Bitterness 3.6/10');
    expect(instrumentEvidence).toContain('GC-MS/O Diacetyl (buttery, GC-O 3.1/5, 3.6 ppm, 0.4x threshold); Benzaldehyde (nutty/almond, GC-O 1.8/5, 1.4 ppm)');
    expect(instrumentEvidence).toContain('ISTD recovery 95.1%');
  });
});
