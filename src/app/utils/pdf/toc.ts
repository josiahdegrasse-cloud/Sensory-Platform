import {
  SLATE_200,
  SLATE_500,
  SLATE_700,
  SLATE_950,
  addContentPage,
  paragraph,
  setDisplayText,
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
  const { doc, margin, contentWidth, primary, accent } = ctx;
  let y = addContentPage(ctx);
  setText(doc, primary, 8, 'bold');
  doc.text('REPORT CONTENTS', margin, y);
  setDisplayText(doc, primary, 29, 'bold');
  doc.text('Evidence to decision', margin, y + 42);
  y = paragraph(
    doc,
    'A concise reading path through the product evidence, commercial direction, risks, and source record.',
    margin,
    y + 72,
    340,
    { color: SLATE_700, size: 10.5, lineHeight: 15 },
  ) + 34;
  doc.setDrawColor(...accent);
  doc.setLineWidth(3);
  doc.line(margin, y - 12, margin + 76, y - 12);

  const entryPositions: number[] = [];
  entries.forEach(entry => {
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.7);
    doc.line(margin, y, margin + contentWidth, y);
    setDisplayText(doc, accent, 18, 'bold');
    doc.text(entry.number.padStart(2, '0'), margin, y + 29);
    setDisplayText(doc, SLATE_950, 13, 'bold');
    doc.text(entry.title, margin + 45, y + 24);
    setText(doc, SLATE_500, 8.5);
    doc.text(entry.detail, margin + 45, y + 42);
    entryPositions.push(y + 27);
    y += 62;
  });

  doc.setDrawColor(...primary);
  doc.setLineWidth(1.2);
  doc.line(margin, y + 10, margin + contentWidth, y + 10);
  setDisplayText(doc, SLATE_950, 12, 'bold');
  doc.text('Reading note', margin, y + 36);
  paragraph(
    doc,
    'Begin with the recommendation. Use the evidence and provenance sections to understand its limits, then retain the appendix with any distributed copy.',
    margin,
    y + 57,
    390,
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
    setText(doc, SLATE_500, 8.5, 'bold');
    doc.text(String(pageNumber).padStart(2, '0'), width - margin, yCenter + 3, { align: 'right' });
  });
  doc.setPage(current);
}
