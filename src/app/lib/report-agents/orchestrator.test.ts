import { describe, expect, it } from 'vitest';
import { coconutCheddarContext } from '../report-qc/fixtures';
import type {
  ReportAgentOutputMap,
  ReportAgentRole,
  ReportAgentRunner,
  ReportAgentTask,
  ReportRenderResult,
} from './types';
import { orchestrateReportAgents } from './orchestrator';
import { REPORT_AGENT_DEFINITIONS } from './roles';
import { validateAgentResult } from './result-validation';

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
    scientific_skeptic: {
      criticalChallenges: [],
      alternativeInterpretations: [],
      missingMethodDisclosures: [],
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
      'decision_consistency_auditor',
      'evidence_auditor',
      'scientific_skeptic',
    ]);
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

  it('uses only four AI passes for the standard drafting review', async () => {
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
      'scientific_skeptic',
      'professional_report_writer',
      'editorial_reviewer',
    ]);
    expect(result.finalDraft).toEqual(writerDraft);
    expect(result.state.exportStatus).toBe('demonstration_only');
    expect(result.state.completedAgents).toHaveLength(4);
  });
});
