import { describe, expect, it } from 'vitest';
import { coconutCheddarContext } from '../report-qc/fixtures';
import type {
  ReportAgentOutputMap,
  ReportAgentRole,
  ReportAgentRunner,
  ReportAgentTask,
  ReportRenderResult,
} from './types';
import { orchestrateReportAgents, allowedEvidenceIds } from './orchestrator';
import { REPORT_AGENT_DEFINITIONS } from './roles';
import { validateAgentResult } from './result-validation';

describe('allowedEvidenceIds', () => {
  it('authorizes the gates and limitations the agents are shown, not just source evidence', () => {
    const ctx = coconutCheddarContext();
    const allowed = new Set(allowedEvidenceIds(ctx));

    // Regression: science reviewers are shown gates + limitations and cite
    // them (e.g. "sensory.qc", "weak-dimension"); those must be citeable, not
    // rejected as "unauthorized evidence id(s)".
    expect(ctx.gates.length).toBeGreaterThan(0);
    ctx.gates.forEach(gate => expect(allowed.has(gate.id)).toBe(true));
    expect(ctx.limitations.length).toBeGreaterThan(0);
    ctx.limitations.forEach(limitation => expect(allowed.has(limitation.id)).toBe(true));
    // Still includes the real source-evidence record ids.
    ctx.sourceEvidenceIds.forEach(id => expect(allowed.has(id)).toBe(true));
    // A truly fabricated id is still rejected.
    expect(allowed.has('totally-made-up-id')).toBe(false);
  });
});

const cleanSections = {
  sections: [
    { label: 'Decision', text: 'Advance conditionally to pilot validation. This is not approval for commercialization or launch.' },
    { label: 'Methodology', text: 'ISSF 76.7 is reproduced from the weighted sensory base, instrumental signal, and gate adjustment.' },
    { label: 'Limitations', text: 'Concept testing is pending (n=0), and reference/demo evidence cannot support external use.' },
  ],
};

function outputFor(role: ReportAgentRole): ReportAgentOutputMap[ReportAgentRole] {
  const outputs: Record<ReportAgentRole, ReportAgentOutputMap[ReportAgentRole]> = {
    evidence_auditor: { claims: [], blockers: [], warnings: [] },
    calculation_auditor: {
      verifiedCalculations: ['ISSF'],
      unexplainedCalculations: [],
      numericalConflicts: [],
      blockers: [],
      warnings: [],
    },
    sensory_science_reviewer: {
      criticalChallenges: [],
      alternativeInterpretations: [],
      missingMethodDisclosures: [],
      blockers: [],
    },
    instrumental_science_reviewer: {
      criticalChallenges: [],
      alternativeInterpretations: [],
      missingMethodDisclosures: [],
      blockers: [],
    },
    consumer_insights_reviewer: {
      insightThemes: [],
      overreachRisks: [],
      panelLimitations: [],
      blockers: [],
      warnings: [],
    },
    claims_compliance_reviewer: {
      reviewedClaims: [],
      blockedClaims: [],
      requiredDisclaimers: [],
      legalReviewRequired: [],
      warnings: [],
      blockers: [],
    },
    decision_consistency_auditor: {
      canonicalDecisionSummary: 'Advance conditionally to pilot validation.',
      decisionStatements: [{ page: 1, text: 'Advance conditionally to pilot validation.', status: 'consistent' }],
      blockers: [],
      warnings: [],
    },
    commercial_strategist: {
      supportedCommercialConclusions: [],
      positioningHypothesis: 'Plant-based cheddar hypothesis.',
      targetSegmentHypothesis: 'Need-based segment pending validation.',
      consumerNeedHypothesis: 'Familiar dairy-free cooking.',
      usageOccasionHypothesis: 'Everyday cooking.',
      productPromiseHypothesis: 'Familiar cheddar cues.',
      reasonsToBelieve: [],
      packagingHypothesis: 'Directional only.',
      conceptTestObjectives: ['Validate clarity.'],
      prohibitedExternalClaims: ['Consumer preferred.'],
    },
    action_plan_engineer: { immediateActions: [], laterActions: [], readinessGaps: [] },
    professional_report_writer: {
      pages: [{
        page: 1,
        title: 'Decision',
        sections: [{
          sectionId: 'decision',
          heading: 'Conditional advancement',
          body: 'Advance conditionally to pilot validation.',
          claimIds: [],
          evidenceIds: [],
          limitationIds: ['reference-demo-evidence'],
        }],
      }],
    },
    editorial_reviewer: { revisedSections: [], unresolvedIssues: [], blockers: [] },
    visual_qa_reviewer: { pageResults: [{ page: 1, issues: [] }], blockers: [], warnings: [] },
    conflict_resolver: {
      resolutions: [],
      humanReviewRequired: [],
      warnings: [],
      blockers: [],
    },
    client_red_team: {
      trustRisks: [],
      likelyClientQuestions: [],
      ambiguousStatements: [],
      releaseRecommendation: 'demonstration_only',
    },
    final_independent_judge: {
      categoryScores: {
        decisionClarity: 13,
        evidenceIntegrity: 13,
        methodologyReproducibility: 12,
        claimSupport: 12,
        commercialUsefulness: 12,
        actionability: 12,
        editorialQuality: 12,
        visualReadability: 12,
      },
      rawScore: 98,
      appliedCaps: [],
      finalScore: 98,
      blockers: [],
      releaseStatus: 'demonstration_only',
      rationale: 'The artifact is strong but remains demonstration-only.',
    },
  };
  return outputs[role];
}

describe('report agent orchestration', () => {
  it('uses distinct role instructions and never defines an orchestrator writer role', () => {
    const instructions = Object.values(REPORT_AGENT_DEFINITIONS).map(item => item.systemInstruction);
    expect(new Set(instructions).size).toBe(instructions.length);
    expect(Object.keys(REPORT_AGENT_DEFINITIONS)).not.toContain('orchestrator');
    expect(REPORT_AGENT_DEFINITIONS.final_independent_judge.freshContext).toBe(true);
    expect(REPORT_AGENT_DEFINITIONS.professional_report_writer.temperature)
      .toBeGreaterThan(REPORT_AGENT_DEFINITIONS.calculation_auditor.temperature);
  });

  it('runs independent specialists and preserves demonstration-only authorization', async () => {
    const calls: ReportAgentRole[] = [];
    const runner: ReportAgentRunner = {
      async run<R extends ReportAgentRole>(task: ReportAgentTask<R>): Promise<ReportAgentOutputMap[R]> {
        calls.push(task.role);
        return outputFor(task.role) as ReportAgentOutputMap[R];
      },
    };
    const renderResult: ReportRenderResult = {
      generatedSections: cleanSections,
      writtenReport: outputFor('professional_report_writer') as ReportAgentOutputMap['professional_report_writer'],
      finalPdfText: 'Advance conditionally to pilot validation.',
      renderedPages: [{
        page: 1,
        imageUrl: 'data:image/png;base64,AA==',
        width: 595,
        height: 842,
        text: 'Advance conditionally to pilot validation.',
        minimumFontSizePt: 9,
        contrastFailures: [],
        warningRequired: true,
        warningVisible: true,
      }],
    };

    const result = await orchestrateReportAgents({
      context: coconutCheddarContext(),
      generatedSections: cleanSections,
      pageText: [{ page: 1, text: cleanSections.sections.map(section => section.text).join(' ') }],
      runner,
      render: async () => renderResult,
    });

    expect(calls.slice(0, 4).sort()).toEqual([
      'calculation_auditor',
      'evidence_auditor',
      'instrumental_science_reviewer',
      'sensory_science_reviewer',
    ]);
    expect(calls).toContain('consumer_insights_reviewer');
    expect(calls).toContain('claims_compliance_reviewer');
    expect(calls).toContain('decision_consistency_auditor');
    expect(calls).toContain('conflict_resolver');
    expect(calls[calls.length - 1]).toBe('final_independent_judge');
    expect(result.state.qualityScore).toBeGreaterThanOrEqual(97);
    expect(result.state.exportStatus).toBe('demonstration_only');
    expect(result.claimLineage).toEqual([]);
  });

  it('rejects agent attempts to mutate protected deterministic fields', () => {
    expect(() => validateAgentResult({
      role: 'evidence_auditor',
      packet: {
        contextSummary: {
          sourceEvidenceIds: [],
          concept: coconutCheddarContext().concept,
          dimensions: coconutCheddarContext().dimensions,
          instrumental: coconutCheddarContext().instrumental,
          limitations: coconutCheddarContext().limitations,
        },
        claims: [],
      },
      output: { claims: [], blockers: [], warnings: [], approvalStatus: 'approved' },
      allowedEvidenceIds: [],
    })).toThrow(/protected field/i);
  });

  it('uses only five AI passes for the standard drafting review', async () => {
    const calls: ReportAgentRole[] = [];
    const runner: ReportAgentRunner = {
      async run<R extends ReportAgentRole>(task: ReportAgentTask<R>): Promise<ReportAgentOutputMap[R]> {
        calls.push(task.role);
        return outputFor(task.role) as ReportAgentOutputMap[R];
      },
    };
    const writerDraft = outputFor('professional_report_writer') as ReportAgentOutputMap['professional_report_writer'];
    const result = await orchestrateReportAgents({
      mode: 'standard',
      context: coconutCheddarContext(),
      generatedSections: cleanSections,
      pageText: [{ page: 1, text: cleanSections.sections.map(section => section.text).join(' ') }],
      runner,
      render: async ({ draft }) => ({
        generatedSections: cleanSections,
        writtenReport: draft,
        finalPdfText: 'Internal draft',
        renderedPages: [],
      }),
    });

    expect(calls).toEqual([
      'evidence_auditor',
      'consumer_insights_reviewer',
      'claims_compliance_reviewer',
      'professional_report_writer',
      'editorial_reviewer',
    ]);
    expect(result.finalDraft).toEqual(writerDraft);
    expect(result.state.exportStatus).toBe('demonstration_only');
    expect(result.state.completedAgents).toHaveLength(5);
  });

  it('runs the standard review when action owners are readiness gaps', async () => {
    const calls: ReportAgentRole[] = [];
    const context = coconutCheddarContext();
    context.actions.forEach(action => { action.owner = null; });
    const runner: ReportAgentRunner = {
      async run<R extends ReportAgentRole>(task: ReportAgentTask<R>): Promise<ReportAgentOutputMap[R]> {
        calls.push(task.role);
        return outputFor(task.role) as ReportAgentOutputMap[R];
      },
    };

    const result = await orchestrateReportAgents({
      mode: 'standard',
      context,
      generatedSections: cleanSections,
      pageText: [{ page: 1, text: 'Conditional advancement.' }],
      runner,
      render: async ({ draft }) => ({
        generatedSections: cleanSections,
        writtenReport: draft,
        finalPdfText: 'Internal draft',
        renderedPages: [],
      }),
    });

    expect(calls).toHaveLength(5);
    expect(result.state.completedAgents).toHaveLength(5);
    expect(result.state.defects.filter(defect => defect.category === 'action-without-owner')).toHaveLength(5);
    expect(result.state.exportStatus).toBe('demonstration_only');
  });
});
