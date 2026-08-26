import { describe, expect, it } from 'vitest';
import { coconutCheddarContext, coconutCheddarSnapshot } from '../report-qc/fixtures';
import {
  buildLocalReportWriterPacket,
  buildLocalReportWriterPrompt,
  localReportDraftFromSections,
  parseLocalReportSections,
  resolveLocalReportSections,
} from './report-writer';
import type { LocalReportSections } from './types';
import type { ReportSafeEvidenceCard } from '../evidence-assist';

const sections: LocalReportSections = {
  executiveSummary: 'This decision-led summary explains the current GO outcome, the evidence supporting controlled advancement, and the next commercial gate without implying unrestricted launch approval.',
  productPerformance: 'The sensory and instrumental evidence is interpreted together here, preserving the measured scores, the named population, and the limits associated with the available sample size.',
  conceptDirection: 'The selected concept direction translates the strongest supported product cues into clear positioning and packaging guidance while keeping unvalidated market conclusions as hypotheses.',
  commercialRecommendation: 'The recommendation advances the product through a controlled next step, assigns practical work, and defines the evidence that will be needed at the following decision gate.',
  risksAndNextSteps: 'The principal risks, claims boundaries, evidence limitations, and validation requirements are stated plainly so that the team can act without overstating what the present study demonstrates.',
};

describe('local Llama report writer', () => {
  it('builds a bounded, evidence-controlled packet', () => {
    const context = coconutCheddarContext();
    const packet = buildLocalReportWriterPacket(context);

    expect(packet.product.name).toBe(context.sampleName);
    expect(packet.decision.sensoryOutcome).toBe('GO');
    expect(packet.dimensions.length).toBeLessThanOrEqual(8);
    expect(packet.instrumental.findings.length).toBeLessThanOrEqual(8);
    expect(packet.prohibitedLanguage).toContain('ready for launch');
  });

  it('passes generic measured parameters to the writer with their uncertainty and benchmark boundary', () => {
    const context = coconutCheddarContext();
    context.instrumental.parameters = [{
      id: 'instrumental.s4.hardness',
      sampleId: 'S4',
      sampleName: context.sampleName,
      key: 'hardness',
      label: 'Hardness',
      family: 'texture_rheology',
      source: 'imported_parameter',
      unit: 'g',
      mean: 1240,
      observationCount: 4,
      standardDeviation: 84,
      minimum: 1110,
      maximum: 1360,
      replicateValues: [1110, 1220, 1270, 1360],
      metadata: {
        dataType: 'continuous',
        scaleType: 'ratio',
        zeroMeaningful: true,
        direction: 'lower',
        expectedMinimum: 1000,
        expectedMaximum: 1300,
        source: 'declared',
      },
      chartPreference: 'box',
      status: 'within_expected_range',
    }];

    const packet = buildLocalReportWriterPacket(context);

    expect(packet.instrumental.totalParameterCount).toBe(1);
    expect(packet.instrumental.measuredParameters).toEqual([expect.objectContaining({
      label: 'Hardness',
      value: 1240,
      unit: 'g',
      observationCount: 4,
      standardDeviation: 84,
      range: [1110, 1360],
      expectedRange: [1000, 1300],
    })]);
  });

  it('gives Llama the verified packet and explicit human-writing constraints', () => {
    const prompt = buildLocalReportWriterPrompt(coconutCheddarContext());

    expect(prompt).toContain('VERIFIED WRITER PACKET');
    expect(prompt).toContain('Each section should be 90–180 words');
    expect(prompt).toContain('executiveSummary');
  });

  it('adds only bounded report-safe literature guidance to the writer packet', () => {
    const evidenceCard: ReportSafeEvidenceCard = {
      id: 'ea-1',
      citationLabel: 'L1',
      topic: 'texture confirmation',
      evidenceUse: 'validation_guidance',
      appliesTo: ['texture'],
      supports: ['pilot-scale confirmation'],
      doesNotSupport: ['product preference'],
      safeReportLanguage: 'Confirm texture using a controlled pilot-scale comparison.',
      claimPermission: 'context_only',
      confidence: 'high',
      limitations: ['External literature is not product-specific proof.'],
      contentFingerprint: 'sha256:one',
    };
    const packet = buildLocalReportWriterPacket(coconutCheddarContext(), [evidenceCard]);

    expect(packet.externalLiterature).toEqual([expect.objectContaining({
      citation: 'L1',
      recommendedAction: evidenceCard.safeReportLanguage,
      projectRationale: expect.stringMatching(/texture performance is 43\/100/i),
      doesNotSupport: ['product preference'],
    })]);
    expect(JSON.stringify(packet)).not.toMatch(/sourcePath|retrievedExcerpt|chunkId/);
  });

  it('parses complete structured output and rejects incomplete prose', () => {
    expect(parseLocalReportSections(JSON.stringify(sections))).toEqual(sections);
    expect(() => parseLocalReportSections(JSON.stringify({ executiveSummary: sections.executiveSummary })))
      .toThrow(/did not complete/i);
  });

  it('replaces only incomplete model sections with governed deterministic copy', () => {
    const result = resolveLocalReportSections(JSON.stringify({
      ...sections,
      executiveSummary: 'Too short.',
    }), coconutCheddarSnapshot());

    expect(result.fallbackSections).toEqual(['executiveSummary']);
    expect(result.sections.executiveSummary).toContain('Coconut Cheddar v3.0 reached a sensory GO');
    expect(result.sections.productPerformance).toBe(sections.productPerformance);
    expect(Object.values(result.sections).every(section => section.length >= 80)).toBe(true);
  });

  it('can produce a governed draft when the local model truncates its JSON', () => {
    const result = resolveLocalReportSections('{"executiveSummary":', coconutCheddarSnapshot());

    expect(result.fallbackSections).toEqual([
      'executiveSummary',
      'productPerformance',
      'conceptDirection',
      'commercialRecommendation',
      'risksAndNextSteps',
    ]);
    expect(Object.values(result.sections).every(section => section.length >= 80)).toBe(true);
  });

  it('maps local prose into the existing governed report structure', () => {
    const context = coconutCheddarContext();
    const draft = localReportDraftFromSections(context, sections);

    expect(draft.pages).toHaveLength(5);
    expect(draft.pages[0].sections[0]).toMatchObject({
      sectionId: 'executive-summary',
      body: sections.executiveSummary,
    });
    expect(draft.pages[4].sections[0].limitationIds).toEqual(context.limitations.map(item => item.id));
  });
});
