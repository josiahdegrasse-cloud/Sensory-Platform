import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { buildEvidenceBundleFromProfiles } from './report-evidence';
import { buildReportPlan } from './report-plan';
import { containsInternalWritingInstructions, evaluateNarrative, stripEvidenceCitations } from './report-evaluator';

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

  it('strips inline evidence tokens and tidies the surrounding whitespace', () => {
    expect(
      stripEvidenceCitations('GO at 91% confidence [evidence:sample.s4.decision][evidence:sample.s4.issf-score].'),
    ).toBe('GO at 91% confidence.');
    expect(stripEvidenceCitations('Scores [evidence:a] indicate response.')).toBe('Scores indicate response.');
    expect(stripEvidenceCitations('No citations here.')).toBe('No citations here.');
  });

  it('flags generic hedged language as a quality issue', () => {
    const { bundle, plan } = planFor('S4');
    const sections: Record<string, string> = {};
    plan.sections.forEach(section => {
      sections[section.key] = section.evidenceBacked && section.evidenceIds.length > 0
        ? `Summary. [evidence:${section.evidenceIds[0]}]`
        : 'Concept-driven packaging note.';
    });
    const exec = plan.sections.find(s => s.key === 'executiveSummary')!;
    sections.executiveSummary = `Improve texture depending on the food type. [evidence:${exec.evidenceIds[0]}]`;
    const evaluation = evaluateNarrative({ plan, sections, bundle });
    expect(evaluation.issues.some(i => /hedged language/.test(i))).toBe(true);
  });

  it('flags an unsupported demographic claim with no citation or qualifier', () => {
    const { bundle, plan } = planFor('S4');
    const sections: Record<string, string> = {};
    plan.sections.forEach(section => { sections[section.key] = ''; });
    // packaging is evidenceBacked=false, so a target-consumer claim here has no citation
    const packaging = plan.sections.find(s => s.key === 'packagingRationale')!;
    sections[packaging.key] = 'Targets consumers aged 25-35 who want convenience.';
    const evaluation = evaluateNarrative({ plan, sections, bundle });
    expect(evaluation.issues.some(i => /demographic or price claim/.test(i))).toBe(true);
  });

  it('rejects internal writing instructions that leak into report prose', () => {
    const { bundle, plan } = planFor('S4');
    const sections: Record<string, string> = {};
    plan.sections.forEach(section => {
      sections[section.key] = section.evidenceBacked && section.evidenceIds.length > 0
        ? `Summary. [evidence:${section.evidenceIds[0]}]`
        : 'Concept-driven packaging note.';
    });
    sections.packagingRationale = 'Approved claim language: use the evidence bundle as the source of truth.';

    const evaluation = evaluateNarrative({ plan, sections, bundle });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.issues.some(issue => /internal writing instructions/.test(issue))).toBe(true);
    expect(containsInternalWritingInstructions(sections.packagingRationale)).toBe(true);
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
