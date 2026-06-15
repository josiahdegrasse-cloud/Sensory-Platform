import {
  CHARCOAL,
  DEFAULT_ACCENT,
  SAGE,
  SLATE_950,
  addContentPage,
  hexToRgb,
  imageDataUrl,
  renderFooter,
  type PdfContext,
  type Rgb,
} from './pdf/theme';
import {
  buildAppendix,
  buildCommercialInsights,
  buildCommercializationPlan,
  buildConceptPackaging,
  buildDecisionSnapshot,
  buildExecutiveReadout,
  buildPerformanceDashboard,
  buildRisks,
  type CommercializationReportPdfInput,
} from './pdf/sections';
import {
  renderCommercialInsightsPage,
  renderDecisionSnapshotPage,
  renderExecutiveReadoutPage,
  renderPerformanceDashboardPage,
} from './pdf/pages/decision-pages';
import {
  renderAppendixPage,
  renderCommercializationPlanPage,
  renderConceptPackagingPage,
  renderRisksPage,
} from './pdf/pages/action-pages';
import { buildFinalSummary, renderFinalSummaryPage } from './pdf/pages/summary-page';

export type { CommercializationReportPdfInput } from './pdf/sections';

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\p{Diacritic}]/gu, '')
    .replace(/\bv(\d+)\.0\b/gi, 'v$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a clean, descriptive PDF filename, e.g.
 * `new-food-innovation-coconut-cheddar-v3-commercialization-report-go-2026-06-11.pdf`.
 * Falls back to "food-platform" when no client/organization name is available.
 */
export function buildCommercializationReportFilename(input: {
  clientName?: string | null;
  productName: string;
  decision?: string | null;
  generatedAt: string | Date;
  version?: number;
}) {
  const generatedAt = input.generatedAt instanceof Date ? input.generatedAt : new Date(input.generatedAt);
  const date = Number.isNaN(generatedAt.getTime())
    ? new Date().toISOString().slice(0, 10)
    : generatedAt.toISOString().slice(0, 10);
  const client = slugify(input.clientName || '') || 'food-platform';
  const product = slugify(input.productName) || 'product';
  const parts = [client, product, 'commercialization-report'];
  if (input.decision) parts.push(slugify(input.decision));
  parts.push(date);
  if (input.version && input.version > 1) parts.push(`r${input.version}`);
  return `${parts.join('-')}.pdf`;
}

export async function buildCommercializationReportPdf(input: CommercializationReportPdfInput) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const template = input.reportTemplate ?? 'editorial-sage';
  const primary: Rgb = template === 'editorial-sage' ? CHARCOAL : hexToRgb(input.primaryColor) ?? SLATE_950;
  const accent: Rgb = template === 'editorial-sage' ? SAGE : hexToRgb(input.accentColor) ?? DEFAULT_ACCENT;
  const ctx: PdfContext = {
    doc,
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
    margin: 40,
    contentWidth: doc.internal.pageSize.getWidth() - 80,
    primary,
    accent,
    organizationName: input.organizationName || 'Food Platform',
    productName: input.snapshot.product.sampleName,
    template,
  };

  const [packaging, logo] = await Promise.all([
    imageDataUrl(input.snapshot.concept.packagingImageUrl),
    imageDataUrl(input.logoUrl ?? ''),
  ]);

  renderDecisionSnapshotPage(ctx, buildDecisionSnapshot(input), { packaging, logo });

  addContentPage(ctx);
  renderExecutiveReadoutPage(ctx, buildExecutiveReadout(input));

  addContentPage(ctx);
  renderPerformanceDashboardPage(ctx, buildPerformanceDashboard(input));

  addContentPage(ctx);
  renderCommercialInsightsPage(ctx, buildCommercialInsights(input));

  addContentPage(ctx);
  renderConceptPackagingPage(ctx, buildConceptPackaging(input), packaging);

  addContentPage(ctx);
  renderCommercializationPlanPage(ctx, buildCommercializationPlan(input), autoTable);

  addContentPage(ctx);
  renderRisksPage(ctx, buildRisks(input), autoTable);

  addContentPage(ctx);
  renderAppendixPage(ctx, buildAppendix(input), autoTable);

  addContentPage(ctx);
  renderFinalSummaryPage(ctx, buildFinalSummary(input), autoTable);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    renderFooter(ctx, page, input.reportFooter);
  }

  const filename = buildCommercializationReportFilename({
    clientName: input.organizationName,
    productName: input.snapshot.product.sampleName,
    decision: input.snapshot.decision.outcome,
    generatedAt: input.snapshot.generatedAt,
    version: input.version,
  });
  return { doc, filename };
}

export async function downloadCommercializationReportPdf(input: CommercializationReportPdfInput) {
  const { doc, filename } = await buildCommercializationReportPdf(input);
  doc.save(filename);
}
