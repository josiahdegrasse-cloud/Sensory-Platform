import {
  CHARCOAL,
  DEFAULT_ACCENT,
  SAGE,
  SLATE_950,
  addContentPage,
  chapterBanner,
  hexToRgb,
  imageDataUrl,
  renderFooter,
  type PdfContext,
  type Rgb,
} from './pdf/theme';
import {
  TOC_ENTRIES,
  buildClosingSection,
  buildConceptPackagingSection,
  buildCoverData,
  buildExecutiveSummarySection,
  buildProductEvidenceSection,
  buildRisksNextStepsSection,
  type CommercializationReportPdfInput,
} from './pdf/sections';
import { renderCoverPage } from './pdf/cover';
import { patchTocPageNumbers, renderTocPage } from './pdf/toc';
import { renderExecutiveSummaryChapter } from './pdf/chapters/executive-summary';
import { renderProductEvidenceChapter } from './pdf/chapters/product-evidence';
import { renderConceptPackagingChapter } from './pdf/chapters/concept-packaging';
import { renderRisksNextStepsChapter } from './pdf/chapters/risks-next-steps';
import { renderClosingPage } from './pdf/closing';

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
  const template = input.reportTemplate ?? 'standard';
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

  // Cover
  renderCoverPage(ctx, buildCoverData(input), { packaging, logo });

  // Contents and reading guide (page numbers are patched in once chapter pages are known)
  const tocLayout = renderTocPage(ctx, TOC_ENTRIES);
  const chapterPages: number[] = [];

  // Chapter 1: Executive summary and evidence confidence
  let y = addContentPage(ctx);
  y = chapterBanner(ctx, 'Section 1', 'Executive summary and evidence confidence', y);
  chapterPages.push(doc.getNumberOfPages());
  renderExecutiveSummaryChapter(ctx, buildExecutiveSummarySection(input), autoTable, y);

  // Chapter 2: Product evidence and decision rationale
  y = addContentPage(ctx);
  y = chapterBanner(ctx, 'Section 2', 'Product evidence and decision rationale', y);
  chapterPages.push(doc.getNumberOfPages());
  renderProductEvidenceChapter(ctx, buildProductEvidenceSection(input), autoTable, y);

  // Chapter 3: Concept, packaging, and market direction
  y = addContentPage(ctx);
  y = chapterBanner(ctx, 'Section 3', 'Concept, packaging, and market direction', y);
  chapterPages.push(doc.getNumberOfPages());
  renderConceptPackagingChapter(ctx, buildConceptPackagingSection(input), packaging, y);

  // Chapter 4: Commercialization risks and next actions (also covers the appendix entry)
  y = addContentPage(ctx);
  y = chapterBanner(ctx, 'Section 4', 'Commercialization risks and next actions', y);
  chapterPages.push(doc.getNumberOfPages());
  renderRisksNextStepsChapter(ctx, buildRisksNextStepsSection(input), autoTable, y);
  chapterPages.push(chapterPages[chapterPages.length - 1]);

  // Closing note
  y = addContentPage(ctx);
  y = chapterBanner(ctx, 'About this report', 'Sources, review status, and distribution', y);
  renderClosingPage(ctx, buildClosingSection(input), y);

  patchTocPageNumbers(ctx, tocLayout, chapterPages);

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
