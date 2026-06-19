import { describe, expect, it } from 'vitest';
import {
  coconutCheddarAugmentation,
  coconutCheddarContext,
  coconutCheddarDecision,
  coconutCheddarSnapshot,
} from './fixtures';
import { buildReportContext } from './context';
import { runQcPipeline } from './pipeline';
import { stageHeadline } from './stage';
import { validateReportContext } from './validate';
import { validateDimensionEvidenceConsistency } from './validate';
import type { GeneratedSections } from './validate';

// A clean, stage-appropriate rendering of the Coconut Cheddar conditional report.
function cleanSections(): GeneratedSections {
  return {
    sections: [
      { label: 'Decision', text: 'Advance to next gate — conditional. Proceed to pilot-scale confirmation and target-consumer concept validation. This is not approval for market launch.' },
      { label: 'Executive rationale', text: 'Coconut Cheddar v3.0 reached a sensory GO at ISSF 76.7 with 91% model confidence. Texture performance is 43/100, below the readiness line.' },
      { label: 'Evidence dashboard', text: 'Sensory descriptor profile 99/100 from a panel of 14: Cheese 13/14, Butter 12/14, Lactic acid 11/14.' },
      { label: 'Commercial interpretation', text: 'The descriptor profile gives a defensible sensory identity; texture must be remediated before claims are locked.' },
      { label: 'Concept strategy', text: 'Positioning and pricing are hypotheses pending a target-consumer concept test (n=0).' },
      { label: 'Execution plan', text: 'Texture optimization is owned by R&D with a pilot-scale retest passing at a texture score of 60/100 and n of 18 or more.' },
      { label: 'Risks and limitations', text: 'Consumer preference is unvalidated at n=0; texture is below the readiness line; no external claims are approved.' },
      { label: 'Traceability', text: 'Method NFI-GST-1.1, fingerprint 699B8585, report version 4, approval status draft.' },
    ],
  };
}

describe('report-qc: Coconut Cheddar regression fixture', () => {
  it('classifies the expected stage and decision semantics', () => {
    const ctx = coconutCheddarContext('draft');
    expect(ctx.stage).toBe('conditional_advancement');
    expect(ctx.decision.launchAuthorization).toBe('not_approved');
    expect(ctx.decision.sensoryOutcome).toBe('GO');
    expect(Math.round(ctx.decision.modelConfidence * 100)).toBe(91);
    expect(ctx.decision.evidenceMaturity).toBe('limited');
    expect(ctx.concept.responseCount).toBe(0);
  });

  it('uses the conditional-advancement headline, not launch approval', () => {
    const ctx = coconutCheddarContext('draft');
    const head = stageHeadline(ctx.decision.stageDecisionCode, ctx.decision.sensoryOutcome);
    expect(head.headline).toBe('ADVANCE TO PILOT VALIDATION — CONDITIONAL');
    expect(head.subheading).toContain('not approval for commercialization or market launch');
  });

  it('surfaces the texture readiness failure and real limitations', () => {
    const ctx = coconutCheddarContext('draft');
    expect(ctx.dimensions.find(d => d.key === 'texture')!.score).toBeLessThan(ctx.thresholds.readiness);
    expect(ctx.limitations.length).toBeGreaterThanOrEqual(2);
    expect(ctx.limitations.some(l => /n=0|concept/i.test(l.cause))).toBe(true);
  });

  it('shows actual descriptors and frequencies for the descriptor score', () => {
    const ctx = coconutCheddarContext('draft');
    const cata = ctx.dimensions.find(d => d.key === 'cata')!;
    expect(cata.sampleSize).toBe(14);
    expect(cata.measures.join(' ')).toContain('Cheese 13/14');
    expect(cata.source).not.toMatch(/saved sensory decision model/i);
  });

  it('passes validation (export allowed) and scores well as a draft conditional report', () => {
    const ctx = coconutCheddarContext('draft');
    const result = runQcPipeline({ ctx, generated: cleanSections() });
    expect(result.exportAllowed).toBe(true);
    expect(result.contextValidation.errors.every(e => !e.blocksExport)).toBe(true);
    expect(result.score.totalScore).toBeGreaterThanOrEqual(97);
    // A draft is never client_ready even at a high score.
    expect(result.score.clientReady).toBe(false);
    expect(result.missingEvidence.some(m => /n=0/.test(m))).toBe(true);
  });
});

describe('report-qc: validation guards', () => {
  it('blocks export on an unsupported consumer claim when concept n=0', () => {
    const ctx = coconutCheddarContext('draft');
    ctx.claims.push({
      id: 'claim.bad',
      claim: 'Consumers prefer this product.',
      claimType: 'consumer_preference',
      evidenceIds: [],
      confidence: 0.5,
      permittedWording: [],
      prohibitedWording: [],
      limitations: [],
      reviewerStatus: 'unreviewed',
    });
    const result = validateReportContext(ctx);
    expect(result.exportAllowed).toBe(false);
    expect(result.errors.some(e => e.code === 'unsupported-claim')).toBe(true);
  });

  it('caps the score and blocks export when a section is empty', () => {
    const ctx = coconutCheddarContext('draft');
    const broken: GeneratedSections = { sections: [{ label: 'Decision', text: '' }] };
    const result = runQcPipeline({ ctx, generated: broken });
    expect(result.exportAllowed).toBe(false);
    expect(result.score.totalScore).toBeLessThanOrEqual(84);
  });

  it('flags malformed core-message language', () => {
    const ctx = coconutCheddarContext('draft');
    const sections: GeneratedSections = {
      sections: [{ label: 'Core message', text: 'Lead with Dimension-level scores and trained-panel reference support the consumer response.' }],
    };
    const result = runQcPipeline({ ctx, generated: sections });
    expect(result.score.blockers.some(b => /malformed/.test(b))).toBe(true);
  });

  it('flags raw system language', () => {
    const ctx = coconutCheddarContext('draft');
    const sections: GeneratedSections = {
      sections: [{ label: 'Packaging', text: 'The chosen packaging direction is not grounded by the evidence bundle.' }],
    };
    const result = runQcPipeline({ ctx, generated: sections });
    expect(result.score.warnings.some(w => /evidence bundle/i.test(w))).toBe(true);
  });

  it('blocks export when an action has no owner', () => {
    const ctx = coconutCheddarContext('draft');
    ctx.actions[0].owner = null;
    const result = validateReportContext(ctx);
    expect(result.errors.some(e => e.code === 'action-without-owner')).toBe(true);
    expect(result.exportAllowed).toBe(false);
  });

  it('requires a due date or explicit unscheduled status', () => {
    const ctx = coconutCheddarContext();
    ctx.actions[0].unscheduled = false;
    const result = validateReportContext(ctx);
    expect(result.warnings.some(e => e.code === 'action-without-due-date')).toBe(true);
  });

  it('blocks an action without measurable completion evidence', () => {
    const ctx = coconutCheddarContext();
    ctx.actions[0].passingThreshold = '';
    expect(validateReportContext(ctx).errors.some(e => e.code === 'action-without-completion')).toBe(true);
  });

  it('reproduces ISSF and explains the confidence calculation', () => {
    const ctx = coconutCheddarContext();
    expect(ctx.methodology.reproducedIssf).toBeCloseTo(ctx.issfScore, 0);
    expect(ctx.methodology.formula).toContain('0.86');
    expect(ctx.methodology.confidenceCalculation.reduce((sum, row) => sum + row.contribution, 0)).toBeCloseTo(90.8, 1);
  });

  it('blocks a stored/calculated ISSF mismatch', () => {
    const ctx = coconutCheddarContext();
    ctx.methodology.storedIssf = 55;
    expect(validateReportContext(ctx).errors.some(e => e.code === 'calculation-mismatch')).toBe(true);
  });

  it('explains positive visible texture cues and the low composite', () => {
    const texture = coconutCheddarContext().dimensions.find(d => d.key === 'texture')!;
    expect(texture.calculationExplanation).toMatch(/missing firm and spreadable count as 0/i);
    expect(texture.calculationExplanation).toContain('42.7');
    expect(validateDimensionEvidenceConsistency(coconutCheddarContext()).exportAllowed).toBe(true);
  });

  it('blocks an unexplained low score when all displayed metrics look positive', () => {
    const ctx = coconutCheddarContext();
    const texture = ctx.dimensions.find(d => d.key === 'texture')!;
    texture.rawMetrics = [{ label: 'Smooth', value: 8.6, direction: 'higher_better' }];
    texture.calculationExplanation = 'Texture is 43/100.';
    expect(validateDimensionEvidenceConsistency(ctx).errors.some(e => e.code === 'unexplained-score-evidence-contradiction')).toBe(true);
  });

  it('shows instrumental evidence when available and an explicit limitation when absent', () => {
    expect(coconutCheddarContext().instrumental.findings.length).toBeGreaterThan(0);
    const ctx = buildReportContext({
      snapshot: coconutCheddarSnapshot(),
      decision: coconutCheddarDecision(),
      approvalStatus: 'draft',
      reportVersion: 1,
      augmentation: { ...coconutCheddarAugmentation(), instrumentalFindings: [], instrumentSignal: undefined },
    });
    expect(ctx.instrumental.absenceNote).toMatch(/No instrumental evidence was included/i);
  });

  it('labels descriptor evidence as category recognition rather than distinctiveness', () => {
    const ctx = coconutCheddarContext();
    expect(ctx.conceptStrategy.reasonsToBelieve.join(' ')).toMatch(/cheddar-category/i);
    expect(ctx.conceptStrategy.reasonsToBelieve.join(' ')).not.toMatch(/\bdistinctive\b/i);
  });

  it('detects duplicate paragraphs and raw system leakage', () => {
    const ctx = coconutCheddarContext();
    const repeated = 'This paragraph is deliberately long enough to trigger duplicate detection across report sections.';
    const result = runQcPipeline({ ctx, generated: { sections: [
      { label: 'One', text: repeated },
      { label: 'Two', text: repeated },
      { label: 'Three', text: 'Deterministic candidate decision across samples.' },
    ] } });
    expect(result.score.warnings.some(item => /duplicate-paragraph/.test(item))).toBe(true);
    expect(result.score.warnings.some(item => /raw-deterministic/.test(item))).toBe(true);
  });

  it('requires AI visual provenance and a directional label', () => {
    const ctx = coconutCheddarContext();
    ctx.imageProvenance.directionalDisclaimer = false;
    expect(validateReportContext(ctx).errors.some(e => e.code === 'concept-visual-not-directional')).toBe(true);
  });

  it('requires method version and explicit evidence populations', () => {
    const ctx = coconutCheddarContext();
    ctx.methodVersion = '';
    ctx.dimensions[0].sampleSize = null;
    const result = validateReportContext(ctx);
    expect(result.errors.some(e => e.code === 'missing-method-version')).toBe(true);
    expect(result.warnings.some(e => e.code === 'missing-sample-size')).toBe(true);
    expect(ctx.concept.responseCount).toBe(0);
  });
});

describe('report-qc: stage classification across fixtures', () => {
  it('evidence_review when sensory outcome is STOP', () => {
    const ctx = buildReportContext({
      snapshot: coconutCheddarSnapshot(),
      decision: { ...coconutCheddarDecision(), decision: 'STOP' },
      approvalStatus: 'draft',
      reportVersion: 1,
      augmentation: coconutCheddarAugmentation(),
    });
    expect(ctx.stage).toBe('evidence_review');
  });

  it('commercialization_approval only when all gates pass, approved, n>0, and dimensions clear readiness', () => {
    const snapshot = coconutCheddarSnapshot({
      decision: { ...coconutCheddarSnapshot().decision, dimensions: { hedonic: 84, texture: 72, cata: 99, emotional: 86 } },
      evidence: { responseCount: 40, scaleMetrics: [], topSelections: [{ option: 'creamy', count: 30, percentage: 75 }], comments: [], purchaseIntent: 7.1 },
    });
    const ctx = buildReportContext({
      snapshot,
      decision: { ...coconutCheddarDecision(), dimensionScores: { hedonic: 84, texture: 72, cata: 99, emotional: 86 } },
      approvalStatus: 'approved',
      reportVersion: 2,
      claimsApproved: true,
      augmentation: coconutCheddarAugmentation(),
    });
    expect(ctx.stage).toBe('commercialization_approval');
    expect(ctx.decision.launchAuthorization).toBe('approved');
  });
});
