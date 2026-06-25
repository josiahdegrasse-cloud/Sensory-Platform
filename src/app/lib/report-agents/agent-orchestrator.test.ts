import { describe, expect, it } from 'vitest';
import { coconutCheddarContext } from '../report-qc/fixtures';
import { buildAgentBriefs } from './agent-brief-builder';
import { normalizeClaimRecord } from './agent-claim-policy';
import { REPORT_AGENT_WORKFLOW_STEPS } from './agent-orchestrator';

describe('commercialization report agent orchestration contract', () => {
  it('builds scoped briefs for quick draft and full release review modes', async () => {
    const ctx = coconutCheddarContext();
    const quick = buildAgentBriefs({ ctx, mode: 'quick_draft', reportContextHash: 'hash-1' });
    const full = buildAgentBriefs({ ctx, mode: 'full_release_review', reportContextHash: 'hash-1' });

    expect(quick.map(brief => brief.agentName)).toContain('claims_compliance');
    expect(quick.map(brief => brief.agentName)).not.toContain('instrumental_science');
    expect(full.map(brief => brief.agentName)).toEqual(expect.arrayContaining([
      'evidence_auditor',
      'sensory_science',
      'instrumental_science',
      'commercial_strategy',
      'concept_packaging',
      'claims_compliance',
      'section_writer',
      'editor',
      'qc_critic',
    ]));
    expect(full[0].evidenceScope.allowedEvidenceKeys).toEqual(ctx.sourceEvidenceIds);
    expect(full[0].decision.issfScore).toBe(ctx.issfScore);
  });

  it('downgrades restricted claims when concept evidence is missing', () => {
    const ctx = coconutCheddarContext();
    const claim = normalizeClaimRecord({
      id: 'claim-market',
      claim: 'Consumers prefer this product',
      claimType: 'consumer_preference',
      evidenceIds: [],
      confidence: 0.9,
      permittedWording: [],
      prohibitedWording: ['consumers prefer'],
      limitations: [],
      reviewerStatus: 'unreviewed',
    }, ctx);

    expect(claim.strength).toBe('unsupported');
    expect(claim.allowedLanguage).toMatch(/Unsupported claim removed/i);
  });

  it('exposes the requested workflow progress steps', () => {
    expect(REPORT_AGENT_WORKFLOW_STEPS.map(([, label]) => label)).toEqual([
      'Evidence audit',
      'Sensory interpretation',
      'Instrumental interpretation',
      'Concept/packaging interpretation',
      'Commercial strategy',
      'Claims check',
      'Section writing',
      'Editing',
      'QC critic',
      'Deterministic QC',
    ]);
  });

  it('orders staged workflow gates before and after narrative writing', () => {
    const steps = REPORT_AGENT_WORKFLOW_STEPS.map(([key]) => key);
    const evidenceAudit = steps.indexOf('evidence_auditor');
    const claimsCompliance = steps.indexOf('claims_compliance');
    const sectionWriting = steps.indexOf('section_writer');
    const qcCritic = steps.indexOf('qc_critic');

    expect(evidenceAudit).toBeGreaterThanOrEqual(0);
    expect(evidenceAudit).toBeLessThan(sectionWriting);
    expect(claimsCompliance).toBeLessThan(sectionWriting);
    expect(qcCritic).toBeGreaterThan(sectionWriting);
  });
});
