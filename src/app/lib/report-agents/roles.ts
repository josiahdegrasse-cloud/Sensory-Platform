import type { ReportAgentRole } from './types';

export interface ReportAgentDefinition {
  role: ReportAgentRole;
  label: string;
  temperature: number;
  freshContext: boolean;
  systemInstruction: string;
}

const IMMUTABILITY_RULES = [
  'Treat every supplied number, evidence id, sample size, decision, gate outcome, approval state, and fingerprint as immutable.',
  'Never invent missing evidence or silently convert missing values to zero.',
  'Return only the requested structured JSON shape.',
  'State uncertainty explicitly and cite supplied evidence ids where the schema permits.',
].join(' ');

function definition(
  role: ReportAgentRole,
  label: string,
  temperature: number,
  freshContext: boolean,
  purpose: string,
): ReportAgentDefinition {
  return {
    role,
    label,
    temperature,
    freshContext,
    systemInstruction: `${purpose} ${IMMUTABILITY_RULES}`,
  };
}

export const REPORT_AGENT_DEFINITIONS: Record<ReportAgentRole, ReportAgentDefinition> = {
  evidence_auditor: definition(
    'evidence_auditor',
    'Evidence Auditor',
    0.1,
    false,
    'Audit whether every proposed claim is supported by the scoped evidence. Distinguish sensory, consumer, instrumental, benchmarked, and non-benchmarked evidence. You may restrict wording but may not rewrite source data.',
  ),
  calculation_auditor: definition(
    'calculation_auditor',
    'Calculation Auditor',
    0,
    false,
    'Review the explanation of deterministic calculations. Reconcile every displayed value against the supplied calculation trace, including missing-data treatment, normalization, weights, thresholds, ISSF, confidence, and rounding.',
  ),
  scientific_skeptic: definition(
    'scientific_skeptic',
    'Scientific Skeptic',
    0.2,
    true,
    'Act as an adversarial food scientist, sensory scientist, statistician, and methods reviewer. Find alternative explanations, overreach, sample-design weaknesses, unjustified thresholds, and missing disclosures. Do not improve prose.',
  ),
  decision_consistency_auditor: definition(
    'decision_consistency_auditor',
    'Decision Consistency Auditor',
    0,
    true,
    'Compare every decision-related phrase with the canonical decision. Flag launch language, approval conflicts, title conflicts, confidence conflicts, and next-gate mismatches.',
  ),
  commercial_strategist: definition(
    'commercial_strategist',
    'Commercial Strategist',
    0.45,
    false,
    'Translate only approved evidence into useful commercial hypotheses. Separate known facts from hypotheses and define validation needs. Never invent research, benchmarks, pricing evidence, preference, or packaging appeal.',
  ),
  action_plan_engineer: definition(
    'action_plan_engineer',
    'Action-Plan Engineer',
    0.2,
    false,
    'Convert known defects, failed gates, and evidence gaps into a minimal operational plan. Preserve unknown owners and dates as null. Every action must resolve a named defect, risk, or gate and include measurable completion evidence.',
  ),
  professional_report_writer: definition(
    'professional_report_writer',
    'Professional Report Writer',
    0.4,
    false,
    'Write concise consulting-grade report sections using only approved structured inputs. Distinguish fact, calculation, hypothesis, and limitation. Do not add evidence, values, decisions, or claims.',
  ),
  editorial_reviewer: definition(
    'editorial_reviewer',
    'Editorial Reviewer',
    0.1,
    false,
    'Edit a completed structured draft for clarity, brevity, grammar, hierarchy, and professional tone without changing meaning, evidence, numbers, decisions, limitations, or approval status.',
  ),
  client_red_team: definition(
    'client_red_team',
    'Red-Team Client Reviewer',
    0.2,
    true,
    'Review the nearly final report as a skeptical paying client with no access to prior agents internal reasoning. Identify trust risks, ambiguity, over-certainty, missing information, legal concerns, and generated-sounding prose.',
  ),
  visual_qa_reviewer: definition(
    'visual_qa_reviewer',
    'Visual QA Reviewer',
    0.1,
    true,
    'Inspect every supplied rendered page image as a visual document. Detect clipping, overlap, broken glyphs, unreadable tables, density, weak hierarchy, missing warnings, misleading badges, duplicate pages, and database-export appearance.',
  ),
  final_independent_judge: definition(
    'final_independent_judge',
    'Final Independent Judge',
    0,
    true,
    'Independently score only the final artifact against the supplied rubric and deterministic results. Apply hard caps, confirm blockers and release status, and award no improvement or effort bonus. Do not repair the report.',
  ),
};

export const INITIAL_AUDIT_ROLES: ReportAgentRole[] = [
  'evidence_auditor',
  'calculation_auditor',
  'scientific_skeptic',
  'decision_consistency_auditor',
];

export const STRATEGY_ROLES: ReportAgentRole[] = [
  'commercial_strategist',
  'action_plan_engineer',
];

export const FINAL_SEQUENCE_ROLES: ReportAgentRole[] = [
  'professional_report_writer',
  'editorial_reviewer',
  'visual_qa_reviewer',
  'client_red_team',
  'final_independent_judge',
];
