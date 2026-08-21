import {
  buildAppendix,
  buildClaimsMatrix,
  buildCommercializationPlan,
  buildCommercialReadiness,
  buildConceptPackaging,
  buildConsumerEvidence,
  buildDecisionBasis,
  buildDecisionSnapshot,
  buildExecutiveReadout,
  buildPerformanceDashboard,
  buildPanelStudyProfile,
  buildProductReadiness,
  buildRisks,
  buildScientificContext,
  type CommercializationReportPdfInput,
} from './sections';

/**
 * One canonical page contract shared by the PDF renderer, browser preview,
 * quality gate, and regression tests. Keep this intentionally short: the
 * client report is a decision document, not a database export.
 */
export const CLIENT_REPORT_V2_PAGES = [
  { number: 1, title: 'Client cover', heading: 'Client product decision report', purpose: 'A branded cover for the tested product and approved decision.' },
  { number: 2, title: 'Executive recommendation', heading: 'Executive recommendation', purpose: 'The decision, why it is supportable, and what leaders should do next.' },
  { number: 3, title: 'Product performance', heading: 'Product performance', purpose: 'Sensory results, instrumental context, and literature-guided interpretation.' },
  { number: 4, title: 'Consumer and concept response', heading: 'Consumer and concept response', purpose: 'What the concept evidence says, what remains directional, and the commercial meaning.' },
  { number: 5, title: 'Panel and study profile', heading: 'Panel and study profile', purpose: 'Who contributed, profile coverage, privacy rules, and the representativeness boundary.' },
  { number: 6, title: 'Scientific literature and evidence map', heading: 'Scientific literature and evidence map', purpose: 'How approved literature informs interpretation, validation design, and evidence limits.' },
  { number: 7, title: 'Recommended action plan', heading: 'Recommended action plan', purpose: 'Protect, improve, and validate workstreams with owners, gates, and passing evidence.' },
  { number: 8, title: 'Evidence and release record', heading: 'Evidence and release record', purpose: 'Claim permissions, limitations, literature, and approval boundary.' },
] as const;

export const CLIENT_REPORT_V2_PAGE_COUNT = CLIENT_REPORT_V2_PAGES.length;
export const CLIENT_REPORT_V2_PAGE_HEADINGS = CLIENT_REPORT_V2_PAGES.map(page => page.heading);

export function buildClientReportV2(input: CommercializationReportPdfInput) {
  return {
    cover: buildDecisionSnapshot(input),
    executive: buildExecutiveReadout(input),
    basis: buildDecisionBasis(input),
    performance: buildPerformanceDashboard(input),
    scientific: buildScientificContext(input),
    consumer: buildConsumerEvidence(input),
    panel: buildPanelStudyProfile(input),
    concept: buildConceptPackaging(input),
    plan: buildCommercializationPlan(input),
    productReadiness: buildProductReadiness(input),
    commercialReadiness: buildCommercialReadiness(input),
    risks: buildRisks(input),
    claims: buildClaimsMatrix(input),
    appendix: buildAppendix(input),
  };
}

export type ClientReportV2Data = ReturnType<typeof buildClientReportV2>;
