import type { EvidenceBundle } from './report-evidence-types';
import {
  REPORT_SECTION_KEYS,
  interpretEvidenceBundle,
  type DecisionInterpretation,
  type ReportClaim,
  type ReportSectionKey,
} from './report-decision-interpreter';

export type ReportSectionPlan = {
  key: ReportSectionKey;
  title: string;
  guidance: string;
  claims: ReportClaim[];
  evidenceIds: string[];
  /** True when the section must be backed by evidence-bundle records to publish. */
  evidenceBacked: boolean;
};

export type ReportPlan = {
  projectId: string;
  candidateDecision: DecisionInterpretation['candidateDecision'];
  confidence: DecisionInterpretation['confidence'];
  headline: string;
  sections: ReportSectionPlan[];
};

const SECTION_META: Record<ReportSectionKey, { title: string; guidance: string; evidenceBacked: boolean }> = {
  executiveSummary: {
    title: 'Executive recommendation',
    guidance: 'State the launch recommendation and the deterministic decision per sample. Cite the decision/ISSF/confidence evidence.',
    evidenceBacked: true,
  },
  whyLiked: {
    title: 'Why panelists liked it',
    guidance: 'Explain the consumer response using dimension scores and any trained-panel reference. Cite each dimension/comparison record used.',
    evidenceBacked: true,
  },
  packagingRationale: {
    title: 'Packaging rationale',
    guidance: 'Describe the chosen packaging direction in plain, client-facing language, based on the concept inputs (positioning, target consumer, format). Write only what the concept supports; do not cite sensory metrics. Never use internal terms such as "evidence bundle".',
    evidenceBacked: false,
  },
  launchRecommendation: {
    title: 'Launch recommendation',
    guidance: 'Give the go-to-market recommendation consistent with the overall candidate decision and confidence. Cite the decision evidence.',
    evidenceBacked: true,
  },
  claimCaution: {
    title: 'Claims and limitations',
    guidance: 'Disclose every missing-data issue, quality warning, and failed critical gate. Cite each. Do not make claims that exceed the evidence.',
    evidenceBacked: true,
  },
};

// Deterministic section plan: groups the interpreter's claims by section and
// allots the evidence ids each section is allowed to cite.
export function buildReportPlan(bundle: EvidenceBundle): ReportPlan {
  const interpretation = interpretEvidenceBundle(bundle);
  const claimsBySection = new Map<ReportSectionKey, ReportClaim[]>();
  interpretation.claims.forEach(claim => {
    claimsBySection.set(claim.section, [...(claimsBySection.get(claim.section) ?? []), claim]);
  });

  const sections: ReportSectionPlan[] = REPORT_SECTION_KEYS.map(key => {
    const claims = claimsBySection.get(key) ?? [];
    const evidenceIds = [...new Set(claims.flatMap(claim => claim.evidenceIds))];
    return {
      key,
      title: SECTION_META[key].title,
      guidance: SECTION_META[key].guidance,
      claims,
      evidenceIds,
      evidenceBacked: SECTION_META[key].evidenceBacked,
    };
  });

  return {
    projectId: bundle.projectId,
    candidateDecision: interpretation.candidateDecision,
    confidence: interpretation.confidence,
    headline: interpretation.headline,
    sections,
  };
}
