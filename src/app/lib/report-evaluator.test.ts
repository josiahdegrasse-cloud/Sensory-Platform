import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { buildEvidenceBundleFromProfiles } from './report-evidence';
import { buildReportPlan } from './report-plan';
import { evaluateNarrative } from './report-evaluator';

function planFor(sampleId: string) {
  const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === sampleId)!;
  const bundle = buildEvidenceBundleFromProfiles({
    projectId: sampleId,
    profiles: [profile],
    foodTypeSlug: 'cheese',
    createdBy: 'test-user',
    generatedAt: '2026-06-16T12:00:00.000Z',
    thresholds: { go: 75, stop: 45 },
  });
  return { bundle, plan: buildReportPlan(bundle) };
}

describe('evaluateNarrative', () => {
  it('passes when evidence-backed sections cite valid, in-scope ids', () => {
    const { bundle, plan } = planFor('S4');
    const sections: Record<string, string> = {};
    plan.sections.forEach(section => {
      sections[section.key] = section.evidenceBacked && section.evidenceIds.length > 0
        ? `Summary. [evidence:${section.evidenceIds[0]}]`
        : 'Concept-driven packaging note.';
    });
    const evaluation = evaluateNarrative({ plan, sections, bundle });
    expect(evaluation.passed).toBe(true);
    expect(evaluation.issues).toEqual([]);
    expect(evaluation.score).toBe(100);
  });

  it('fails and lists issues when a section cites an unknown id', () => {
    const { bundle, plan } = planFor('S4');
    const sections: Record<string, string> = {};
    plan.sections.forEach(section => { sections[section.key] = ''; });
    const exec = plan.sections.find(s => s.key === 'executiveSummary')!;
    sections.executiveSummary = `Claim. [evidence:${exec.evidenceIds[0]}] [evidence:totally.fake.id]`;
    const evaluation = evaluateNarrative({ plan, sections, bundle });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(i => i.includes('totally.fake.id'))).toBe(true);
  });

  it('flags a launch claim that contradicts a STOP candidate decision', () => {
    const { bundle, plan } = planFor('S3'); // STOP
    const sections: Record<string, string> = {};
    plan.sections.forEach(section => {
      sections[section.key] = section.evidenceIds.length > 0 ? `Note. [evidence:${section.evidenceIds[0]}]` : '';
    });
    sections.launchRecommendation = `We recommend launch immediately. [evidence:${plan.sections.find(s => s.key === 'launchRecommendation')!.evidenceIds[0]}]`;
    const evaluation = evaluateNarrative({ plan, sections, bundle });
    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(i => /contradicts/.test(i))).toBe(true);
  });
});
