import {
  SLATE_50,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  WHITE,
  addContentPage,
  chapterBanner,
  paragraph,
  setText,
  type PdfContext,
} from './theme';
import type { TocEntry } from './sections';

export interface TocLayout {
  page: number;
  /** Vertical center of each entry row, used to patch in page numbers after chapters are rendered. */
  entryPositions: number[];
}

/** Renders the "report guide" / table-of-contents page and records row positions for later page-number patching. */
export function renderTocPage(ctx: PdfContext, entries: TocEntry[]): TocLayout {
  const { doc, margin, contentWidth, accent } = ctx;
  let y = addContentPage(ctx);
  y = chapterBanner(ctx, 'Report guide', 'From tested evidence to a commercialization decision', y);
  y = paragraph(
    doc,
    'This report is organized as a client-facing narrative. Each recommendation remains connected to the saved project evidence, decision record, and approval state.',
    margin,
    y,
    contentWidth,
    { color: SLATE_700, size: 11, lineHeight: 16 },
  ) + 24;

  const entryPositions: number[] = [];
  entries.forEach(entry => {
    doc.setFillColor(...SLATE_50);
    doc.roundedRect(margin, y, contentWidth, 58, 6, 6, 'F');
    doc.setFillColor(...accent);
    doc.circle(margin + 20, y + 29, 12, 'F');
    setText(doc, WHITE, 9, 'bold');
    doc.text(entry.number, margin + 20, y + 32, { align: 'center' });
    setText(doc, SLATE_950, 11, 'bold');
    doc.text(entry.title, margin + 44, y + 22);
    setText(doc, SLATE_500, 8.5);
    doc.text(entry.detail, margin + 44, y + 40);
    entryPositions.push(y + 29);
    y += 68;
  });

  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, y + 10, contentWidth, 86, 8, 8, 'F');
  setText(doc, SLATE_950, 10.5, 'bold');
  doc.text('How to use this report', margin + 14, y + 34);
  paragraph(
    doc,
    'Lead with the recommendation, then use the evidence and provenance sections to qualify what is known. Keep the appendix with any externally distributed copy so the decision remains traceable.',
    margin + 14,
    y + 55,
    contentWidth - 28,
    { size: 9.5, lineHeight: 13 },
  );

  return { page: doc.getNumberOfPages(), entryPositions };
}

/** Second-pass patch: writes the real page number for each TOC entry once chapter pages are known. */
export function patchTocPageNumbers(ctx: PdfContext, layout: TocLayout, chapterPages: number[]) {
  const { doc, width, margin } = ctx;
  const current = doc.getNumberOfPages();
  doc.setPage(layout.page);
  layout.entryPositions.forEach((yCenter, index) => {
    const pageNumber = chapterPages[index];
    if (pageNumber === undefined) return;
    setText(doc, SLATE_500, 9, 'bold');
    doc.text(`Page ${pageNumber}`, width - margin - 14, yCenter + 3, { align: 'right' });
  });
  doc.setPage(current);
}
