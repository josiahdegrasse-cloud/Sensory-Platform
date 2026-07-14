import { describe, expect, it } from 'vitest';
import { coconutCheddarContext } from '../report-qc/fixtures';
import { buildAgentBriefs } from './agent-brief-builder';
import { normalizeClaimRecord } from './agent-claim-policy';
import { hasGeneratedReportDraft, REPORT_AGENT_WORKFLOW_STEPS, sanitizeReportSnapshotForReview } from './agent-orchestrator';
import { isLocalGenerativeReportAgentModel, isOllamaReportAgentModel } from './api';
import type { ReportOrchestratorResult } from './agent-types';
import type { CommercializationReportSnapshot } from '../commercialization-report';

describe('commercialization report agent orchestration contract', () => {
  it('builds scoped briefs for quick draft and full release review modes', async () => {
    const ctx = coconutCheddarContext();
    const quick = buildAgentBriefs({ ctx, mode: 'quick_draft', reportContextHash: 'hash-1' });
    const full = buildAgentBriefs({ ctx, mode: 'full_release_review', reportContextHash: 'hash-1' });

    expect(quick.map(brief => brief.agentName)).toContain('claims_compliance_reviewer');
    expect(quick.map(brief => brief.agentName)).not.toContain('instrumental_science_reviewer');
    expect(full.map(brief => brief.agentName)).toEqual(expect.arrayContaining([
      'evidence_auditor',
      'calculation_auditor',
      'sensory_science_reviewer',
      'instrumental_science_reviewer',
      'consumer_insights_reviewer',
      'claims_compliance_reviewer',
      'decision_consistency_auditor',
      'commercial_strategist',
      'action_plan_engineer',
      'professional_report_writer',
      'editorial_reviewer',
      'visual_qa_reviewer',
      'client_red_team',
      'conflict_resolver',
      'final_independent_judge',
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
      'Calculation audit',
      'Sensory science review',
      'Instrumental science review',
      'Consumer insights review',
      'Claims compliance review',
      'Decision consistency audit',
      'Commercial strategy',
      'Action plan',
      'Professional writing',
      'Editorial review',
      'Visual PDF QA',
      'Client red-team',
      'Conflict resolution',
      'Final release judge',
      'Deterministic QC',
    ]);
  });

  it('orders staged workflow gates before and after narrative writing', () => {
    const steps = REPORT_AGENT_WORKFLOW_STEPS.map(([key]) => key);
    const evidenceAudit = steps.indexOf('evidence_auditor');
    const claimsCompliance = steps.indexOf('claims_compliance_reviewer');
    const sectionWriting = steps.indexOf('professional_report_writer');
    const conflictResolver = steps.indexOf('conflict_resolver');
    const finalJudge = steps.indexOf('final_independent_judge');

    expect(evidenceAudit).toBeGreaterThanOrEqual(0);
    expect(evidenceAudit).toBeLessThan(sectionWriting);
    expect(claimsCompliance).toBeLessThan(sectionWriting);
    expect(conflictResolver).toBeGreaterThan(sectionWriting);
    expect(finalJudge).toBeGreaterThan(conflictResolver);
  });

  it('repairs legacy packaging prompt leakage before release preflight', () => {
    const context = coconutCheddarContext();
    const snapshot = {
      narrative: {
        executiveSummary: 'Confirmed GO recommendation.',
        whyLiked: 'Sensory dimensions support the response.',
        packagingRationale: 'Packaging rationale: use the evidence bundle as the source of truth.',
        launchRecommendation: 'Proceed to buyer review.',
        claimCaution: 'Broader claims require validation.',
      },
    } as CommercializationReportSnapshot;

    const sanitized = sanitizeReportSnapshotForReview(snapshot, context);

    expect(sanitized.narrative.packagingRationale).toBe(context.conceptStrategy.packagingHypothesis);
    expect(sanitized.narrative.packagingRationale).not.toMatch(/evidence bundle/i);
  });

  it('only reports a generated draft after the professional writer ran', () => {
    const base = { metadata: { agentsRun: [] } } as unknown as ReportOrchestratorResult;
    expect(hasGeneratedReportDraft(base)).toBe(false);
    expect(hasGeneratedReportDraft({
      ...base,
      metadata: { ...base.metadata, agentsRun: ['professional_report_writer'] },
    })).toBe(true);
  });

  it('distinguishes an Ollama-backed run from deterministic fallback output', () => {
    expect(isOllamaReportAgentModel('ollama:llama3.2:3b')).toBe(true);
    expect(isOllamaReportAgentModel('local_deterministic_ollama_unavailable')).toBe(false);
    expect(isLocalGenerativeReportAgentModel('ollama:llama3.2:3b')).toBe(true);
    expect(isLocalGenerativeReportAgentModel('llama_cpp:qwen2.5-1.5b-instruct-q4_k_m.gguf')).toBe(true);
    expect(isLocalGenerativeReportAgentModel('local_deterministic_agent')).toBe(false);
  });
});
