import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { buildEvidenceBundleFromProfiles } from './report-evidence';
import { buildReportPlan } from './report-plan';
import { REPORT_SECTION_KEYS } from './report-decision-interpreter';

function bundleFor(sampleId: string) {
  const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === sampleId)!;
  return buildEvidenceBundleFromProfiles({
    projectId: sampleId,
    profiles: [profile],
    foodTypeSlug: 'cheese',
    createdBy: 'test-user',
    generatedAt: '2026-06-16T12:00:00.000Z',
    thresholds: { go: 75, stop: 45 },
  });
}

describe('buildReportPlan', () => {
  it('returns all narrative sections in canonical order', () => {
    const plan = buildReportPlan(bundleFor('S4'));
    expect(plan.sections.map(section => section.key)).toEqual(REPORT_SECTION_KEYS);
  });

  it('only allots evidence ids that exist on the bundle, per section', () => {
    const bundle = bundleFor('S4');
    const known = new Set(bundle.evidence.map(record => record.id));
    const plan = buildReportPlan(bundle);
    plan.sections.forEach(section => {
      section.evidenceIds.forEach(id => expect(known.has(id)).toBe(true));
    });
  });

  it('marks packaging as not evidence-backed and exec/launch as backed', () => {
    const plan = buildReportPlan(bundleFor('S4'));
    const byKey = Object.fromEntries(plan.sections.map(section => [section.key, section]));
    expect(byKey.packagingRationale.evidenceBacked).toBe(false);
    expect(byKey.executiveSummary.evidenceBacked).toBe(true);
    expect(byKey.launchRecommendation.evidenceBacked).toBe(true);
  });
});
