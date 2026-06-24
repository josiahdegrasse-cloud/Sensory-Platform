import type { CommercializationReportSnapshot } from '../commercialization-report';
import type { WrittenReportResult } from './types';
import type { ReportSectionDrafts } from './agent-types';

function sectionText(draft: WrittenReportResult | undefined, patterns: RegExp[]): string {
  const sections = draft?.pages.flatMap(page => page.sections) ?? [];
  return sections.find(section =>
    patterns.some(pattern => pattern.test(`${section.sectionId} ${section.heading} ${section.body}`)),
  )?.body.trim() ?? '';
}

export function mapWrittenDraftToSections(
  draft: WrittenReportResult | undefined,
  snapshot: CommercializationReportSnapshot,
): Partial<ReportSectionDrafts> {
  return {
    executiveSummary: sectionText(draft, [/executive|summary|decision/i]) || snapshot.narrative.executiveSummary,
    productPerformance: sectionText(draft, [/performance|sensory|product/i]) || snapshot.narrative.whyLiked,
    methodEvidenceIntegration: sectionText(draft, [/method|evidence|integration|calculation/i]),
    keyCommercialInsights: sectionText(draft, [/commercial|insight|strategy/i]) || snapshot.narrative.launchRecommendation,
    conceptPackagingDirection: sectionText(draft, [/concept|packag|position/i]) || snapshot.narrative.packagingRationale,
    commercializationPlan: sectionText(draft, [/plan|action|next/i]) || snapshot.narrative.launchRecommendation,
    risksWatchPoints: sectionText(draft, [/risk|watch|limitation|claim/i]) || snapshot.narrative.claimCaution,
    appendixSourceRecord: sectionText(draft, [/appendix|source|trace/i]),
    claimsLimitations: sectionText(draft, [/claim|caution|limitation/i]) || snapshot.narrative.claimCaution,
  };
}

export function buildNarrativeFromSections(
  sections: Partial<ReportSectionDrafts>,
  fallback: CommercializationReportSnapshot,
) {
  return {
    executiveSummary: sections.executiveSummary || fallback.narrative.executiveSummary,
    whyPanelistsLikedIt: sections.productPerformance || fallback.narrative.whyLiked,
    packagingRationale: sections.conceptPackagingDirection || fallback.narrative.packagingRationale,
    launchRecommendation: sections.commercializationPlan || sections.keyCommercialInsights || fallback.narrative.launchRecommendation,
    claimCaution: sections.claimsLimitations || sections.risksWatchPoints || fallback.narrative.claimCaution,
  };
}

export function applyOrchestratedNarrative(
  snapshot: CommercializationReportSnapshot,
  narrative: ReturnType<typeof buildNarrativeFromSections>,
): CommercializationReportSnapshot {
  return {
    ...snapshot,
    narrative: {
      executiveSummary: narrative.executiveSummary,
      whyLiked: narrative.whyPanelistsLikedIt,
      packagingRationale: narrative.packagingRationale,
      launchRecommendation: narrative.launchRecommendation,
      claimCaution: narrative.claimCaution,
    },
  };
}
